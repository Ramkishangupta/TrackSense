"""
backend-python/app/models/eta_engine.py
=========================================
Phase 3 — ETA Inference Engine

PURPOSE:
  Implements the two-stage ETA calculation logic described in the PRD:

  Stage 1 — Baseline ETA (Mocked LightGBM):
    Uses train physics: remaining distance ÷ average speed, corrected by
    the existing delay already accumulated. This mirrors what a real
    LightGBM model trained on historical timetable data would produce.

  Stage 2 — Dynamic ETA (Mocked STGNN):
    Queries live_telemetry and events_log to detect:
      • Congestion: ≥2 trains sharing the same H3 cell as the target train
        → +15 min penalty per extra train (capped at 45 min)
      • Active fog event on the train itself → +20 min penalty
      • Active halt/signal event → +10 min penalty
    Combines the penalties with the baseline to produce the final ETA.

DESIGN:
  - All DB calls use raw SQL via SQLAlchemy (matches the rest of the codebase).
  - No actual ML model file is loaded — this is a demo-safe mock.
  - The penalty math is fully documented so it can be explained during the pitch.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import text

# ---------------------------------------------------------------------------
# CONSTANTS
# ---------------------------------------------------------------------------

# Average speed (km/h) by train type — same table as in generator.py.
# Used as the denominator in the baseline ETA formula.
BASE_SPEED_BY_TYPE: dict[str, float] = {
    "Rajdhani":   130.0,
    "Shatabdi":   120.0,
    "Superfast":  115.0,
    "Mail":       100.0,
    "Express":     95.0,
    "Intercity":   90.0,
    "Passenger":   70.0,
}
DEFAULT_SPEED: float = 90.0  # Fallback if train_type is unknown

# Congestion penalty: added for each *additional* train beyond 1 in the same H3 cell.
# e.g., 3 trains in same cell → 2 extra trains → +30 min penalty.
CONGESTION_PENALTY_PER_TRAIN_MIN: int = 15
MAX_CONGESTION_PENALTY_MIN: int = 45  # Cap so ETA doesn't spiral unrealistically

# Weather and anomaly penalties (minutes)
FOG_PENALTY_MIN: int = 20
HALT_PENALTY_MIN: int = 10  # Covers signal_halt, unscheduled_halt, chain_pulling

# Arrival threshold — if remaining_km is below this value, the train is
# considered to have arrived at its terminus.  All penalty/ETA logic is
# bypassed and status is forced to "Arrived" so the dashboard shows
# a clean terminal state instead of a runaway congestion-penalty loop.
ARRIVAL_THRESHOLD_KM: float = 0.05


# ---------------------------------------------------------------------------
# DATA FETCH HELPERS (internal to this module)
# ---------------------------------------------------------------------------

def _fetch_train_details(session: Session, train_id: int) -> Optional[object]:
    """
    Fetch static train info + live telemetry + remaining route distance in
    a single joined query. Returns a Row or None if train_id is invalid.
    """
    row = session.execute(text("""
        SELECT
            t.id                AS train_id,
            t.train_no,
            t.name              AS train_name,
            t.train_type,
            lt.current_lat,
            lt.current_lng,
            lt.current_speed,
            lt.delay_minutes,
            lt.h3_index,
            lt.recorded_at
        FROM trains t
        JOIN live_telemetry lt ON lt.train_id = t.id
        WHERE t.id = :tid
    """), {"tid": train_id}).fetchone()
    return row


def _fetch_remaining_distance(session: Session, train_id: int,
                               current_lat: float, current_lng: float) -> float:
    """
    Estimate remaining distance to terminus using the pre-computed
    distance_from_start values on the routes table.

    Strategy:
      1. Find the last station (highest station_sequence) → total_route_km.
      2. Find the stop the train has most recently passed by comparing its
         current_lat/lng to each station's coordinates (Euclidean proxy).
      3. Remaining ≈ total_route_km − distance_of_nearest_passed_stop.

    This avoids a PostGIS call and is accurate enough for a demo.
    """
    stops = session.execute(text("""
        SELECT
            r.station_sequence,
            r.distance_from_start,
            s.lat,
            s.lng,
            s.code
        FROM routes r
        JOIN stations s ON s.id = r.station_id
        WHERE r.train_id = :tid
        ORDER BY r.station_sequence
    """), {"tid": train_id}).fetchall()

    if not stops:
        return 0.0

    total_km = float(stops[-1].distance_from_start)

    # Find the nearest stop to the current position (Euclidean on lat/lng —
    # fine for distances < 300 km at Indian Railway latitudes).
    nearest_idx = 0
    min_euclidean = math.inf
    for i, stop in enumerate(stops):
        euclidean = math.sqrt(
            (float(stop.lat) - current_lat) ** 2 +
            (float(stop.lng) - current_lng) ** 2
        )
        if euclidean < min_euclidean:
            min_euclidean = euclidean
            nearest_idx = i

    # Convert degrees to approx km (1 deg ~ 111 km)
    offset_km = min_euclidean * 111.0

    if nearest_idx == len(stops) - 1:
        # If the closest station is the terminus, the remaining distance
        # is just the straight-line distance to it. This prevents the ETA
        # from dropping to zero halfway through the final segment.
        return offset_km
    else:
        # Otherwise, use the nearest station's track distance as a proxy.
        base_remaining = total_km - float(stops[nearest_idx].distance_from_start)
        return max(base_remaining, 0.0)


def _fetch_congestion_count(session: Session, h3_index: str) -> int:
    """
    Count trains currently occupying the same H3 cell.
    A count > 1 means there are other trains in the same ~5 km hex cell.
    """
    if not h3_index:
        return 1
    row = session.execute(text("""
        SELECT COUNT(*) AS cnt
        FROM live_telemetry
        WHERE h3_index = :h3
    """), {"h3": h3_index}).fetchone()
    return int(row.cnt) if row else 1


def _fetch_active_event(session: Session, train_id: int) -> Optional[str]:
    """
    Return the event_type of the most recent active anomaly for this train,
    or None if the train is running normally.
    """
    row = session.execute(text("""
        SELECT event_type
        FROM events_log
        WHERE train_id = :tid AND is_active = TRUE
        ORDER BY created_at DESC
        LIMIT 1
    """), {"tid": train_id}).fetchone()
    return row.event_type if row else None


# ---------------------------------------------------------------------------
# STAGE 1 — BASELINE ETA (Mocked LightGBM)
# ---------------------------------------------------------------------------

def compute_baseline_eta(session: Session, train_id: int) -> dict:
    """
    Baseline ETA calculation using train physics:

        eta_minutes = (remaining_km / avg_speed_kmh) * 60 + existing_delay_min

    This mirrors what a LightGBM model trained on distance, speed, and
    historical delay features would output for an on-track, unaffected train.

    Returns a GTFS-RT-style dict:
        {
          trip_id, train_no, train_name, train_type,
          current_lat, current_lng, h3_index,
          remaining_km, avg_speed_kmh,
          existing_delay_min, travel_time_min, total_eta_min,
          expected_arrival,           # ISO-8601 UTC string
          delay_seconds,              # GTFS-RT field
          status, model_used
        }
    """
    train = _fetch_train_details(session, train_id)
    if train is None:
        return {"error": f"Train with id={train_id} not found."}

    avg_speed    = BASE_SPEED_BY_TYPE.get(train.train_type, DEFAULT_SPEED)
    remaining_km = _fetch_remaining_distance(
        session, train_id, float(train.current_lat), float(train.current_lng)
    )

    # ------------------------------------------------------------------ #
    # ARRIVAL GUARD — bypass ALL ETA/penalty logic when the train is      #
    # within ARRIVAL_THRESHOLD_KM of its terminus.                        #
    # Without this, all 12 trains parked at CNB share the same H3 cell   #
    # and receive the full 45-min congestion penalty every 5 seconds,     #
    # producing absurd "Major Delay" readings on an already-arrived train.#
    # ------------------------------------------------------------------ #
    if remaining_km < ARRIVAL_THRESHOLD_KM:
        now_utc = datetime.now(timezone.utc)
        return {
            "trip_id":            f"TRAIN-{train.train_no}",
            "train_no":           train.train_no,
            "train_name":         train.train_name,
            "train_type":         train.train_type,
            "current_lat":        float(train.current_lat),
            "current_lng":        float(train.current_lng),
            "h3_index":           train.h3_index,
            "remaining_km":       round(remaining_km, 2),
            "avg_speed_kmh":      avg_speed,
            "existing_delay_min": int(train.delay_minutes or 0),
            "travel_time_min":    0.0,
            "total_eta_min":      0.0,
            "expected_arrival":   now_utc.isoformat(),
            "delay_seconds":      0,
            "status":             "Arrived",
            "model_used":         "arrival_guard",
            "telemetry_age_s":    _telemetry_age_seconds(train.recorded_at),
        }

    # Core physics formula
    if avg_speed > 0 and remaining_km > 0:
        travel_time_min = (remaining_km / avg_speed) * 60.0
    else:
        travel_time_min = 0.0

    existing_delay = int(train.delay_minutes or 0)
    total_eta_min = travel_time_min + existing_delay

    # Wall-clock expected arrival
    now_utc = datetime.now(timezone.utc)
    expected_arrival = now_utc + timedelta(minutes=total_eta_min)

    return {
        "trip_id":           f"TRAIN-{train.train_no}",
        "train_no":          train.train_no,
        "train_name":        train.train_name,
        "train_type":        train.train_type,
        "current_lat":       float(train.current_lat),
        "current_lng":       float(train.current_lng),
        "h3_index":          train.h3_index,
        "remaining_km":      round(remaining_km, 2),
        "avg_speed_kmh":     avg_speed,
        "existing_delay_min": existing_delay,
        "travel_time_min":   round(travel_time_min, 1),
        "total_eta_min":     round(total_eta_min, 1),
        "expected_arrival":  expected_arrival.isoformat(),
        "delay_seconds":     existing_delay * 60,          # GTFS-RT standard field
        "status":            _delay_status(existing_delay),
        "model_used":        "baseline_lgbm_mock",
        "telemetry_age_s":   _telemetry_age_seconds(train.recorded_at),
    }


# ---------------------------------------------------------------------------
# STAGE 2 — DYNAMIC ETA (Mocked STGNN)
# ---------------------------------------------------------------------------

def compute_dynamic_eta(session: Session, train_id: int) -> dict:
    """
    Dynamic ETA = Baseline ETA + Congestion Penalty + Anomaly Penalty

    Penalty rules (mocking a Spatio-Temporal Graph Neural Network):

      Congestion penalty:
        trains_in_h3_cell = COUNT(*) in live_telemetry WHERE h3_index = this_train's_h3
        extra_trains       = max(0, trains_in_h3_cell − 1)
        penalty            = min(extra_trains × 15, 45)  minutes

      Anomaly penalty:
        weather_fog  → +20 min
        any halt/signal → +10 min

    Returns the same GTFS-RT-style dict as compute_baseline_eta() plus:
        congestion_count, congestion_penalty_min,
        anomaly_event, anomaly_penalty_min,
        total_dynamic_penalty_min, model_used = "dynamic_stgnn_mock"
    """
    # ------------------------------------------------------------------ #
    # ARRIVAL GUARD — must run BEFORE compute_baseline_eta so we never   #
    # even query congestion counts for a train that has already arrived. #
    # ------------------------------------------------------------------ #
    train = _fetch_train_details(session, train_id)
    if train is None:
        return {"error": f"Train with id={train_id} not found."}

    remaining_km = _fetch_remaining_distance(
        session, train_id,
        float(train.current_lat), float(train.current_lng)
    )
    if remaining_km < ARRIVAL_THRESHOLD_KM:
        now_utc = datetime.now(timezone.utc)
        avg_speed = BASE_SPEED_BY_TYPE.get(train.train_type, DEFAULT_SPEED)
        return {
            "trip_id":                  f"TRAIN-{train.train_no}",
            "train_no":                 train.train_no,
            "train_name":               train.train_name,
            "train_type":               train.train_type,
            "current_lat":              float(train.current_lat),
            "current_lng":              float(train.current_lng),
            "h3_index":                 train.h3_index,
            "remaining_km":             round(remaining_km, 2),
            "avg_speed_kmh":            avg_speed,
            "existing_delay_min":       int(train.delay_minutes or 0),
            "travel_time_min":          0.0,
            "total_eta_min":            0.0,
            "expected_arrival":         now_utc.isoformat(),
            "delay_seconds":            0,
            "status":                   "Arrived",
            "model_used":               "arrival_guard",
            "telemetry_age_s":          _telemetry_age_seconds(train.recorded_at),
            # Dynamic-specific fields zeroed out
            "congestion_count":         1,
            "congestion_penalty_min":   0,
            "anomaly_event":            "none",
            "anomaly_penalty_min":      0,
            "total_dynamic_penalty_min": 0,
            "baseline_eta_min":         0.0,
        }

    # Start from the baseline (arrival guard already passed above)
    baseline = compute_baseline_eta(session, train_id)
    if "error" in baseline:
        return baseline

    h3_index = baseline["h3_index"]
    existing_delay = baseline["existing_delay_min"]

    # --- Congestion penalty ---
    congestion_count = _fetch_congestion_count(session, h3_index)
    extra_trains = max(0, congestion_count - 1)
    congestion_penalty = min(
        extra_trains * CONGESTION_PENALTY_PER_TRAIN_MIN,
        MAX_CONGESTION_PENALTY_MIN
    )

    # --- Anomaly penalty ---
    active_event = _fetch_active_event(session, train_id)
    anomaly_penalty = 0
    if active_event == "weather_fog":
        anomaly_penalty = FOG_PENALTY_MIN
    elif active_event in ("unscheduled_halt", "signal_halt", "chain_pulling"):
        anomaly_penalty = HALT_PENALTY_MIN

    total_dynamic_penalty = congestion_penalty + anomaly_penalty

    # --- Final ETA ---
    total_dynamic_eta_min = baseline["total_eta_min"] + total_dynamic_penalty
    total_delay_min = existing_delay + total_dynamic_penalty

    now_utc = datetime.now(timezone.utc)
    expected_arrival_dynamic = now_utc + timedelta(minutes=total_dynamic_eta_min)

    return {
        # Carry forward all baseline fields
        **baseline,
        # Override with dynamic values
        "total_eta_min":            round(total_dynamic_eta_min, 1),
        "expected_arrival":         expected_arrival_dynamic.isoformat(),
        "delay_seconds":            int(total_delay_min * 60),
        "status":                   _delay_status(int(total_delay_min)),
        "model_used":               "dynamic_stgnn_mock",
        # New dynamic fields
        "congestion_count":         congestion_count,
        "congestion_penalty_min":   congestion_penalty,
        "anomaly_event":            active_event or "none",
        "anomaly_penalty_min":      anomaly_penalty,
        "total_dynamic_penalty_min": total_dynamic_penalty,
        "baseline_eta_min":         baseline["total_eta_min"],
    }


# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def _delay_status(delay_minutes: int) -> str:
    """Map delay in minutes to a human-readable status label."""
    if delay_minutes <= 0:
        return "ON_TIME"
    if delay_minutes <= 15:
        return "MINOR_DELAY"
    if delay_minutes <= 45:
        return "MODERATE_DELAY"
    return "MAJOR_DELAY"


def _telemetry_age_seconds(recorded_at) -> Optional[float]:
    """
    Return how many seconds ago the telemetry was last updated.
    Helps the frontend warn if data is stale.
    """
    if recorded_at is None:
        return None
    if recorded_at.tzinfo is None:
        # Make timezone-aware (assume UTC from the DB)
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - recorded_at
    return round(delta.total_seconds(), 1)
