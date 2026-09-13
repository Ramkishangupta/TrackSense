"""
backend-python/app/simulator/generator.py
==========================================
RTIS & COA Mock Simulator — Dynamic Train ETA Prediction System (SIH 2026)

PURPOSE:
  Mimics the Indian Railways' RTIS (Real-Time Train Information System) and COA
  (Control Office Application) by continuously injecting live GPS telemetry and
  anomaly events into the PostgreSQL database.

ARCHITECTURE:
  - Runs as an infinite loop (standalone process, separate from FastAPI).
  - Each "tick" advances every active train along its route geometry.
  - TIME_ACCELERATION makes trains move fast enough to be visible on the live map.
  - Anomaly engine injects fog/halt events with configurable probability.
  - FORCED DEMO EVENTS guarantee the congestion scenario is visible within 3 ticks.

CONGESTION DESIGN:
  Trains 4, 7, 8, 11, 12 start ≤30 km from Kanpur Central (CNB).
  With TIME_ACCELERATION=300, each 10-second tick simulates 5 minutes of travel.
  Within 3-4 ticks, these trains converge in the same H3 resolution-7 cell (~10 km²),
  triggering the congestion alert in Phase 3's dynamic ETA engine.

HOW TO RUN:
  cd backend-python
  python -m app.simulator.generator
"""

import os
import sys
import time
import random
import logging
from datetime import datetime, timezone
from typing import Optional

# Force UTF-8 output on Windows so emoji characters don't cause UnicodeEncodeError.
# This must happen before any print() calls.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass  # Python < 3.7 fallback — emoji will be replaced with '?'

from dotenv import load_dotenv
from sqlalchemy import text
from geopy.distance import geodesic
import h3

# Load .env before importing our DB module
load_dotenv()

# Append project root so we can import app.core.database
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from app.core.database import SessionLocal, test_connection

# =============================================================================
# CONFIGURATION (overridable via .env)
# =============================================================================

# Real seconds between each simulation tick
TICK_INTERVAL: int = int(os.getenv("SIMULATOR_TICK_INTERVAL", 10))

# Each real tick simulates this many seconds of train travel.
# 300 = 10 real seconds → 5 simulated minutes. Fast enough to show map movement.
TIME_ACCELERATION: int = int(os.getenv("SIMULATOR_TIME_ACCELERATION", 300))

# H3 hexagonal grid resolution for congestion mapping
H3_RESOLUTION: int = int(os.getenv("H3_RESOLUTION", 7))

# Anomaly probabilities (per train per tick)
ANOMALY_FOG_PROB: float = 0.05    # 5% → weather_fog
ANOMALY_HALT_PROB: float = 0.03   # 3% → unscheduled_halt
ANOMALY_SIGNAL_PROB: float = 0.02 # 2% → signal_halt
ANOMALY_RESOLVE_PROB: float = 0.12 # 12% → resolve old event after 60s

# FORCED DEMO EVENTS on Tick 1:
# These guarantee the scenario described in phases.md is visible immediately.
#   - 2 trains get weather_fog
#   - 1 train gets unscheduled_halt
# Train IDs map to seed_data.sql inserts (1-indexed SERIAL):
#   id=3  → 14854 Marudhar Express (North corridor, already delayed)
#   id=11 → 13133 Seelampur Express (East corridor, approaching CNB)
#   id=12 → 15707 Katihar Express   (East corridor, near CNB)
FORCED_FOG_TRAIN_IDS: list[int] = [3, 11]
FORCED_HALT_TRAIN_ID: int = 12

# Base speed (km/h) by train category
BASE_SPEED_BY_TYPE: dict[str, float] = {
    "Rajdhani":   130.0,
    "Shatabdi":   120.0,
    "Superfast":  115.0,
    "Mail":       100.0,
    "Express":     95.0,
    "Intercity":   90.0,
    "Passenger":   70.0,
}

# Speed factor and per-tick delay penalty for each event type
EVENT_MODIFIERS: dict[str, dict] = {
    "weather_fog":       {"speed_factor": 0.35, "delay_add": 5},
    "unscheduled_halt":  {"speed_factor": 0.00, "delay_add": 8},
    "signal_halt":       {"speed_factor": 0.00, "delay_add": 3},
    "chain_pulling":     {"speed_factor": 0.00, "delay_add": 6},
    "track_maintenance": {"speed_factor": 0.50, "delay_add": 2},
    "normal":            {"speed_factor": 1.00, "delay_add": 0},
}

# Terminal icons for clean, scannable output
EVENT_ICONS: dict[str, str] = {
    "weather_fog":       "🌫️ ",
    "unscheduled_halt":  "🛑",
    "signal_halt":       "🚦",
    "chain_pulling":     "⛓️ ",
    "track_maintenance": "🔧",
}

# =============================================================================
# DATABASE QUERY HELPERS
# =============================================================================

def fetch_all_trains(session) -> list:
    """Return all trains with their type for speed calculation."""
    result = session.execute(text(
        "SELECT id, train_no, name, train_type FROM trains ORDER BY id"
    ))
    return result.fetchall()


def fetch_route(session, train_id: int) -> list:
    """
    Fetch ordered route stops (with GPS coords) for a train.
    Returns rows: (station_sequence, distance_from_start, lat, lng, name, code)
    """
    result = session.execute(text("""
        SELECT
            r.station_sequence,
            r.distance_from_start,
            s.lat,
            s.lng,
            s.name  AS station_name,
            s.code  AS station_code
        FROM routes r
        JOIN stations s ON s.id = r.station_id
        WHERE r.train_id = :tid
        ORDER BY r.station_sequence
    """), {"tid": train_id})
    return result.fetchall()


def fetch_telemetry(session, train_id: int):
    """Get latest telemetry record for a train."""
    result = session.execute(text("""
        SELECT current_lat, current_lng, current_speed, delay_minutes, h3_index
        FROM live_telemetry
        WHERE train_id = :tid
    """), {"tid": train_id})
    return result.fetchone()


def fetch_active_event(session, train_id: int):
    """Get the most recent active anomaly event for a train (if any)."""
    result = session.execute(text("""
        SELECT event_type, severity
        FROM events_log
        WHERE train_id = :tid AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 1
    """), {"tid": train_id})
    return result.fetchone()


def upsert_telemetry(session, train_id: int, lat: float, lng: float,
                     speed: float, delay: int, h3_idx: str) -> None:
    """
    UPSERT train position into live_telemetry.
    Uses ON CONFLICT on the UNIQUE(train_id) constraint — 1 row per train.
    This is the core write operation called every tick for every train.
    """
    session.execute(text("""
        INSERT INTO live_telemetry
            (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at)
        VALUES
            (:tid, :lat, :lng, :spd, :dly, :h3, NOW())
        ON CONFLICT (train_id) DO UPDATE SET
            current_lat   = EXCLUDED.current_lat,
            current_lng   = EXCLUDED.current_lng,
            current_speed = EXCLUDED.current_speed,
            delay_minutes = EXCLUDED.delay_minutes,
            h3_index      = EXCLUDED.h3_index,
            recorded_at   = EXCLUDED.recorded_at
    """), {"tid": train_id, "lat": lat, "lng": lng,
           "spd": speed, "dly": delay, "h3": h3_idx})


# =============================================================================
# MOVEMENT ENGINE
# =============================================================================

def find_nearest_segment(cur_lat: float, cur_lng: float, route: list) -> int:
    """
    Find which route segment the train is currently on.
    Returns the index of the FROM station (segment = route[idx] → route[idx+1]).
    Uses minimum distance to route waypoints as a proxy.
    """
    min_dist = float("inf")
    nearest_idx = 0
    for i, stop in enumerate(route):
        d = geodesic((cur_lat, cur_lng), (float(stop.lat), float(stop.lng))).km
        if d < min_dist:
            min_dist = d
            nearest_idx = i

    # If nearest is the terminus, hold on the last segment
    if nearest_idx >= len(route) - 1:
        return len(route) - 2
    return nearest_idx


def advance_position(cur_lat: float, cur_lng: float, route: list,
                     speed_kmh: float, real_interval_s: int) -> tuple[float, float]:
    """
    Move a train forward along its route using linear interpolation.

    PHYSICS:
      distance_km = speed_kmh × (real_interval_s × TIME_ACCELERATION) / 3600
      Each tick's simulated travel time = real_interval_s × TIME_ACCELERATION.
      E.g., TICK=10s, ACCEL=300 → 10×300=3000s simulated = 50 minutes.
      At 100 km/h: 50min → 83 km of travel per tick.

    Returns (new_lat, new_lng).
    """
    if speed_kmh <= 0:
        return cur_lat, cur_lng  # Train is halted — no movement

    # Simulated seconds of movement this tick
    simulated_seconds = real_interval_s * TIME_ACCELERATION
    km_to_travel = (speed_kmh * simulated_seconds) / 3600.0

    seg_idx = find_nearest_segment(cur_lat, cur_lng, route)
    pos_lat, pos_lng = cur_lat, cur_lng
    remaining_km = km_to_travel

    # Walk forward through route segments until distance is consumed
    while remaining_km > 0 and seg_idx < len(route) - 1:
        next_stop = route[seg_idx + 1]
        next_lat, next_lng = float(next_stop.lat), float(next_stop.lng)
        dist_to_next = geodesic((pos_lat, pos_lng), (next_lat, next_lng)).km

        if dist_to_next < 0.01:
            # Already at (or past) this waypoint — move to next segment
            seg_idx += 1
            continue

        if remaining_km >= dist_to_next:
            # Consume this full segment and continue
            remaining_km -= dist_to_next
            pos_lat, pos_lng = next_lat, next_lng
            seg_idx += 1
        else:
            # Interpolate fractionally within this segment
            frac = remaining_km / dist_to_next
            pos_lat = pos_lat + (next_lat - pos_lat) * frac
            pos_lng = pos_lng + (next_lng - pos_lng) * frac
            remaining_km = 0

    # Clamp to terminus if we overshot the last waypoint
    last = route[-1]
    if seg_idx >= len(route) - 1:
        pos_lat, pos_lng = float(last.lat), float(last.lng)

    return round(pos_lat, 6), round(pos_lng, 6)


# =============================================================================
# ANOMALY ENGINE
# =============================================================================

def write_event(session, train_id: int, event_type: str, severity: str,
                description: str) -> None:
    """
    Deactivate any existing active events for this train, then insert the new one.
    This ensures only ONE active event per train at a time (clean state machine).
    """
    # Auto-resolve previous active events
    session.execute(text("""
        UPDATE events_log
        SET is_active = FALSE
        WHERE train_id = :tid AND is_active = TRUE
    """), {"tid": train_id})

    # Insert new event
    session.execute(text("""
        INSERT INTO events_log
            (train_id, event_type, severity, description, is_active, created_at)
        VALUES
            (:tid, :etype, :sev, :desc, TRUE, NOW())
    """), {"tid": train_id, "etype": event_type,
           "sev": severity, "desc": description})


def maybe_resolve_event(session, train_id: int) -> bool:
    """
    Randomly resolve a long-running event (after 60 simulated seconds).
    Returns True if an event was resolved (for logging).
    """
    if random.random() < ANOMALY_RESOLVE_PROB:
        result = session.execute(text("""
            UPDATE events_log
            SET is_active = FALSE
            WHERE train_id = :tid
              AND is_active = TRUE
              AND created_at < NOW() - INTERVAL '60 seconds'
            RETURNING train_id
        """), {"tid": train_id})
        return result.rowcount > 0
    return False


def try_inject_anomaly(session, train_id: int, train_no: str,
                       forced_type: Optional[str] = None) -> Optional[tuple[str, str]]:
    """
    Attempt to inject an anomaly event.
    - If forced_type is provided, always inject that event type.
    - Otherwise roll dice against configured probabilities.
    Returns (event_type, severity) on injection, or None if no event fired.
    """
    roll = random.random()

    if forced_type:
        event_type = forced_type
    elif roll < ANOMALY_FOG_PROB:
        event_type = "weather_fog"
    elif roll < ANOMALY_FOG_PROB + ANOMALY_HALT_PROB:
        event_type = "unscheduled_halt"
    elif roll < ANOMALY_FOG_PROB + ANOMALY_HALT_PROB + ANOMALY_SIGNAL_PROB:
        event_type = "signal_halt"
    else:
        return None  # No anomaly this tick

    # Map event to severity
    severity_map = {
        "weather_fog":       random.choice(["medium", "high"]),
        "unscheduled_halt":  "medium",
        "signal_halt":       "low",
        "chain_pulling":     "medium",
    }
    severity = severity_map.get(event_type, "low")

    # Human-readable descriptions for AI Copilot context
    descriptions = {
        "weather_fog":      f"Dense fog on active corridor. Train {train_no} speed restricted to 35% nominal.",
        "unscheduled_halt": f"Train {train_no} making unscheduled halt. Guard inspection in progress.",
        "signal_halt":      f"Signal failure ahead of {train_no}. Train held at outer home signal.",
        "chain_pulling":    f"Emergency chain pulled on {train_no}. RPF/GRP staff responding.",
    }

    write_event(session, train_id, event_type, severity,
                descriptions.get(event_type, f"Anomaly on {train_no}"))
    return event_type, severity


# =============================================================================
# CONGESTION MONITOR
# =============================================================================

def query_h3_congestion(session) -> list:
    """
    Count trains sharing the same H3 cell.
    Cells with ≥2 trains = congestion. This mirrors the Phase 3 ETA engine logic
    so the simulator output validates the same data the API will use.
    """
    result = session.execute(text("""
        SELECT
            lt.h3_index,
            COUNT(*)                              AS train_count,
            STRING_AGG(t.train_no, ', '
                       ORDER BY t.train_no)       AS trains,
            MAX(lt.delay_minutes)                 AS max_delay
        FROM live_telemetry lt
        JOIN trains t ON t.id = lt.train_id
        WHERE lt.h3_index IS NOT NULL
        GROUP BY lt.h3_index
        HAVING COUNT(*) >= 2
        ORDER BY train_count DESC
    """))
    return result.fetchall()


# =============================================================================
# CORE SIMULATION TICK
# =============================================================================

def run_tick(session, trains: list, routes_map: dict, tick: int) -> tuple[list, list]:
    """
    Single simulation tick: advance every train, inject anomalies, upsert telemetry.

    Returns:
      updates    — list of dicts (one per train) for terminal display
      event_logs — list of strings describing anomaly events this tick
    """
    updates: list[dict] = []
    event_logs: list[str] = []

    for train in trains:
        tid       = train.id
        train_no  = train.train_no
        train_type = train.train_type
        route     = routes_map.get(tid)

        if not route or len(route) < 2:
            continue  # Skip trains with incomplete route data

        telemetry = fetch_telemetry(session, tid)
        if not telemetry:
            continue  # No starting position — skip (shouldn't happen after seed)

        cur_lat   = float(telemetry.current_lat)
        cur_lng   = float(telemetry.current_lng)
        cur_delay = int(telemetry.delay_minutes)

        # ── ANOMALY PHASE ──────────────────────────────────────────────
        active_event = fetch_active_event(session, tid)

        if tick == 1:
            # TICK 1: Force guaranteed demo scenario
            if tid in FORCED_FOG_TRAIN_IDS:
                result = try_inject_anomaly(session, tid, train_no, forced_type="weather_fog")
                if result:
                    event_logs.append(f"🌫️  FORCED FOG        → Train {train_no}")
                    active_event = type("E", (), {"event_type": "weather_fog", "severity": "high"})()

            elif tid == FORCED_HALT_TRAIN_ID:
                result = try_inject_anomaly(session, tid, train_no, forced_type="unscheduled_halt")
                if result:
                    event_logs.append(f"🛑  FORCED HALT       → Train {train_no}")
                    active_event = type("E", (), {"event_type": "unscheduled_halt", "severity": "medium"})()

        else:
            # SUBSEQUENT TICKS: probabilistic injection / resolution
            if active_event:
                resolved = maybe_resolve_event(session, tid)
                if resolved:
                    event_logs.append(f"✅  RESOLVED          → Train {train_no} ({active_event.event_type})")
                    active_event = None
            else:
                result = try_inject_anomaly(session, tid, train_no)
                if result:
                    etype, esev = result
                    icon = EVENT_ICONS.get(etype, "⚠️ ")
                    event_logs.append(f"{icon}  {etype.upper():<20} → Train {train_no} ({esev})")
                    active_event = type("E", (), {"event_type": etype, "severity": esev})()

        # ── SPEED & DELAY CALCULATION ──────────────────────────────────
        event_type = active_event.event_type if active_event else "normal"
        modifier   = EVENT_MODIFIERS.get(event_type, EVENT_MODIFIERS["normal"])
        base_speed = BASE_SPEED_BY_TYPE.get(train_type, 95.0)
        eff_speed  = base_speed * modifier["speed_factor"]
        new_delay  = cur_delay + modifier["delay_add"]

        # ── POSITION ADVANCE ───────────────────────────────────────────
        new_lat, new_lng = advance_position(
            cur_lat, cur_lng, route, eff_speed, TICK_INTERVAL
        )

        # ── H3 INDEXING (Python h3 v4 API) ────────────────────────────
        new_h3 = h3.latlng_to_cell(new_lat, new_lng, H3_RESOLUTION)

        # ── UPSERT TO DATABASE ─────────────────────────────────────────
        upsert_telemetry(session, tid, new_lat, new_lng,
                         round(eff_speed, 2), new_delay, new_h3)

        updates.append({
            "train_no":  train_no,
            "train_type": train_type,
            "lat":       new_lat,
            "lng":       new_lng,
            "speed":     round(eff_speed, 1),
            "delay":     new_delay,
            "h3":        new_h3,
            "halted":    eff_speed == 0,
            "event":     event_type if event_type != "normal" else None,
        })

    session.commit()
    return updates, event_logs


# =============================================================================
# TERMINAL OUTPUT RENDERER
# =============================================================================

def print_tick_summary(tick: int, updates: list, event_logs: list,
                       congestion: list) -> None:
    """
    Render a clean, scannable terminal output block for each tick.
    Designed to look professional during a live hackathon demo.
    """
    ts  = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
    sep = "─" * 66

    print(f"\n{sep}")
    print(f"  [Tick #{tick:04d}]  {ts}  │  {len(updates)} trains updated")
    print(sep)

    for u in updates:
        if u["halted"]:
            motion = "🛑 HALTED    "
        else:
            motion = f"🚂 {u['speed']:5.1f} km/h"

        delay_str = f"+{u['delay']}m" if u["delay"] > 0 else "on-time"
        event_str = f"  [{u['event']}]" if u["event"] else ""

        print(
            f"  {u['train_no']:<7} {motion}  "
            f"Delay: {delay_str:<8}  "
            f"H3: …{u['h3'][-6:]}{event_str}"
        )

    if event_logs:
        print(f"\n  ⚡  ANOMALY EVENTS THIS TICK:")
        for log_line in event_logs:
            print(f"     {log_line}")

    if congestion:
        print(f"\n  🔴  H3 CONGESTION DETECTED:")
        for cell in congestion:
            level = "HIGH    " if cell.train_count >= 3 else "MODERATE"
            print(
                f"     [{level}] …{cell.h3_index[-8:]}  "
                f"→ {cell.train_count} trains: {cell.trains}  "
                f"(max delay: +{cell.max_delay}m)"
            )
    else:
        print(f"\n  🟢  No H3 congestion detected this tick.")


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main() -> None:
    """
    Simulator entry point.
    1. Validates DB connection.
    2. Pre-loads all train + route data.
    3. Runs the infinite tick loop.
    """
    # Suppress SQLAlchemy INFO logs to keep terminal clean
    logging.basicConfig(level=logging.WARNING)
    logging.getLogger("sqlalchemy").setLevel(logging.ERROR)

    print("=" * 66)
    print("  🚂  ETA Simulator  —  RTIS & COA Mock Engine")
    print(f"  Tick Interval   : {TICK_INTERVAL}s real  "
          f"({TICK_INTERVAL * TIME_ACCELERATION}s simulated / tick)")
    print(f"  Time Accel      : {TIME_ACCELERATION}×  "
          f"(1 real min = {TIME_ACCELERATION / 60:.1f} simulated min)")
    print(f"  H3 Resolution   : {H3_RESOLUTION}")
    print(f"  Fog Probability : {ANOMALY_FOG_PROB * 100:.0f}%/train/tick")
    print(f"  Halt Probability: {ANOMALY_HALT_PROB * 100:.0f}%/train/tick")
    print("=" * 66)

    # --- Connectivity check ---
    print("\n  Connecting to database…", end=" ", flush=True)
    if not test_connection():
        print("\n  Check your DATABASE_URL in .env and try again.")
        sys.exit(1)
    print("OK ✅")

    # --- Pre-load static data ---
    with SessionLocal() as session:
        trains = fetch_all_trains(session)
        if not trains:
            print("  ❌  No trains found. Run seed_data.sql first.")
            sys.exit(1)

        print(f"  Loaded {len(trains)} trains.\n")

        routes_map: dict[int, list] = {}
        for train in trains:
            routes_map[train.id] = fetch_route(session, train.id)

        missing = [t.train_no for t in trains if not routes_map.get(t.id)]
        if missing:
            print(f"  ⚠️  No route found for: {', '.join(missing)}")

    print("  Starting simulation loop. Press Ctrl+C to stop.\n")

    tick = 0
    while True:
        tick += 1
        tick_start = time.monotonic()

        try:
            with SessionLocal() as session:
                updates, event_logs = run_tick(session, trains, routes_map, tick)
                congestion = query_h3_congestion(session)

            print_tick_summary(tick, updates, event_logs, congestion)

        except KeyboardInterrupt:
            print("\n\n  Simulator stopped by user. Goodbye! 👋")
            sys.exit(0)

        except Exception as exc:
            # Graceful degradation: log error and continue next tick (never crash)
            print(f"\n  ❌  Tick #{tick} ERROR: {exc}")
            print("     Retrying next tick…")

        # Sleep for the remainder of TICK_INTERVAL
        elapsed = time.monotonic() - tick_start
        sleep_for = max(0.0, TICK_INTERVAL - elapsed)
        time.sleep(sleep_for)


if __name__ == "__main__":
    main()
