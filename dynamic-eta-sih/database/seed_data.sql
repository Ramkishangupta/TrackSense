-- =============================================================================
-- FILE: database/seed_data.sql
-- PURPOSE: Insert realistic multi-corridor dummy data for the Network Congestion Demo.
-- RUN THIS THIRD after schema.sql.
--
-- CONGESTION DEMO ARCHITECTURE:
--   3 intersecting routes ALL CONVERGE at Kanpur Central (CNB).
--   This creates a "traffic funnel" effect — multiple trains from different
--   directions share H3 hex cells near CNB, triggering congestion alerts.
--
--   ROUTE 1 — NORTH CORRIDOR  (4 trains):
--     New Delhi (NDLS) → Ghaziabad (GZB) → Aligarh (ALJN) → Tundla (TDL) → Kanpur (CNB)
--
--   ROUTE 2 — SOUTH-WEST CORRIDOR  (4 trains):
--     Mumbai CST (CSTM) → Jhansi (JHS) → Banda (BAND) → Kanpur (CNB)
--
--   ROUTE 3 — EAST CORRIDOR  (4 trains):
--     Howrah (HWH) → Prayagraj Jn (PRYJ) → Fatehpur (FTP) → Kanpur (CNB)
--
--   TOTAL: 12 trains | 11 stations | 3 routes | 1 convergence point (CNB)
--
-- HOW TO RUN:
--   psql -U postgres -d eta_sih_db -f database/seed_data.sql
-- =============================================================================

-- Clear existing data for clean re-runs during development.
TRUNCATE TABLE events_log, live_telemetry, routes, stations, trains RESTART IDENTITY CASCADE;

-- =============================================================================
-- SECTION 1: TRAINS (12 Trains across 3 corridors)
-- Delay status is distributed to make the demo visually rich:
--   ON-TIME (green), MINOR DELAY (amber), MAJOR DELAY (red)
-- =============================================================================
INSERT INTO trains (train_no, name, train_type) VALUES
    -- ROUTE 1: NORTH CORRIDOR — Delhi to Kanpur (4 trains)
    ('12004', 'New Delhi Rajdhani Express',  'Rajdhani'),  -- id=1  | ON-TIME
    ('12032', 'Lucknow Mail',                'Mail'),      -- id=2  | MINOR DELAY (18 min)
    ('14854', 'Marudhar Express',            'Express'),   -- id=3  | MAJOR DELAY (42 min) + fog
    ('12418', 'Prayagraj Express',           'Superfast'), -- id=4  | MINOR DELAY (10 min) — approaching CNB

    -- ROUTE 2: SOUTH-WEST CORRIDOR — Mumbai to Kanpur (4 trains)
    ('11078', 'Jhelum Express',              'Express'),   -- id=5  | ON-TIME
    ('12167', 'Varanasi Superfast Express',  'Superfast'), -- id=6  | MINOR DELAY (15 min)
    ('12191', 'Shridham Express',            'Express'),   -- id=7  | MODERATE DELAY (28 min) — approaching CNB
    ('22182', 'Jabalpur Intercity Express',  'Intercity'), -- id=8  | ON-TIME — near CNB

    -- ROUTE 3: EAST CORRIDOR — Howrah to Kanpur (4 trains)
    ('13005', 'Amritsar Mail',               'Mail'),      -- id=9  | ON-TIME
    ('12311', 'Kalka Mail',                  'Mail'),      -- id=10 | MINOR DELAY (12 min)
    ('13133', 'Seelampur Express',           'Express'),   -- id=11 | MAJOR DELAY (35 min) + chain pulling — approaching CNB
    ('15707', 'Katihar Express',             'Passenger'); -- id=12 | MAJOR DELAY (55 min) — near CNB

-- =============================================================================
-- SECTION 2: STATIONS (11 Stations across 3 corridors)
-- All real Indian railway stations with accurate GPS coordinates.
-- The PostGIS 'geom' column is auto-populated by the trigger in schema.sql.
-- =============================================================================

-- ROUTE 1 stations: North Corridor (Delhi → Kanpur)
INSERT INTO stations (name, code, lat, lng) VALUES
    ('New Delhi Railway Station',   'NDLS', 28.641862,  77.217151),  -- id=1
    ('Ghaziabad Junction',          'GZB',  28.668550,  77.437270),  -- id=2
    ('Aligarh Junction',            'ALJN', 27.880520,  78.079990),  -- id=3
    ('Tundla Junction',             'TDL',  27.209100,  78.256700),  -- id=4
    ('Kanpur Central',              'CNB',  26.459700,  80.349700);  -- id=5  ← CONVERGENCE POINT

-- ROUTE 2 stations: South-West Corridor (Mumbai → Kanpur)
-- CNB (id=5) is already inserted above — shared convergence point.
INSERT INTO stations (name, code, lat, lng) VALUES
    ('Mumbai Chhatrapati Shivaji Terminus', 'CSTM', 18.940300,  72.835500),  -- id=6
    ('Jhansi Junction',                     'JHS',  25.448900,  78.569000),  -- id=7
    ('Banda Junction',                      'BAND', 25.479800,  80.335100);  -- id=8

-- ROUTE 3 stations: East Corridor (Howrah → Kanpur)
-- CNB (id=5) is already inserted above — shared convergence point.
INSERT INTO stations (name, code, lat, lng) VALUES
    ('Howrah Junction',                     'HWH',  22.583200,  88.342700),  -- id=9
    ('Prayagraj Junction',                  'PRYJ', 25.446700,  81.840700),  -- id=10
    ('Fatehpur',                            'FTP',  25.929900,  80.814700);  -- id=11

-- =============================================================================
-- SECTION 3: ROUTES (Stop sequences + timetables for all 12 trains)
--
-- ROUTE 1 (North, Delhi → Kanpur ~380 km):
--   Stations: NDLS(1) → GZB(2) → ALJN(3) → TDL(4) → CNB(5)
-- ROUTE 2 (SW, Mumbai → Kanpur ~1095 km):
--   Stations: CSTM(6) → JHS(7) → BAND(8) → CNB(5)
-- ROUTE 3 (East, Howrah → Kanpur ~882 km):
--   Stations: HWH(9) → PRYJ(10) → FTP(11) → CNB(5)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ROUTE 1 TRAINS: North Corridor (Delhi → Kanpur)
-- ---------------------------------------------------------------------------

-- Train 1: 12004 — New Delhi Rajdhani Express (Departs 16:55, Arrives CNB 21:25)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (1, 1, 1, NULL,       '16:55:00', 0.00),     -- NDLS: Origin
    (1, 2, 2, '17:35:00', '17:37:00', 35.00),    -- GZB:    35 km
    (1, 3, 3, '18:55:00', '18:57:00', 130.00),   -- ALJN:  130 km
    (1, 4, 4, '19:50:00', '19:52:00', 178.00),   -- TDL:   178 km
    (1, 5, 5, '21:25:00', NULL,       380.00);   -- CNB:   380 km (Terminus)

-- Train 2: 12032 — Lucknow Mail (Departs 22:15, Arrives CNB 03:40 +1 day)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (2, 1, 1, NULL,       '22:15:00', 0.00),
    (2, 2, 2, '23:05:00', '23:08:00', 35.00),
    (2, 3, 3, '00:45:00', '00:48:00', 130.00),
    (2, 4, 4, '01:55:00', '01:57:00', 178.00),
    (2, 5, 5, '03:40:00', NULL,       380.00);

-- Train 3: 14854 — Marudhar Express (Departs 11:30, Arrives CNB 17:10)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (3, 1, 1, NULL,       '11:30:00', 0.00),
    (3, 2, 2, '12:20:00', '12:22:00', 35.00),
    (3, 3, 3, '13:55:00', '13:58:00', 130.00),
    (3, 4, 4, '14:50:00', '14:53:00', 178.00),
    (3, 5, 5, '17:10:00', NULL,       380.00);

-- Train 4: 12418 — Prayagraj Express (Departs 14:05, Arrives CNB 19:00)
-- Demo: Approaching CNB from TDL, minor delay — will enter CNB's H3 zone soon.
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (4, 1, 1, NULL,       '14:05:00', 0.00),
    (4, 2, 2, '14:48:00', '14:50:00', 35.00),
    (4, 3, 3, '16:10:00', '16:12:00', 130.00),
    (4, 4, 4, '17:05:00', '17:08:00', 178.00),
    (4, 5, 5, '19:00:00', NULL,       380.00);

-- ---------------------------------------------------------------------------
-- ROUTE 2 TRAINS: South-West Corridor (Mumbai → Kanpur, ~1095 km)
-- ---------------------------------------------------------------------------

-- Train 5: 11078 — Jhelum Express (Departs CSTM 11:05, Arrives CNB next day 08:30)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (5, 6, 1, NULL,       '11:05:00', 0.00),     -- CSTM: Origin
    (5, 7, 2, '21:45:00', '21:50:00', 755.00),   -- JHS:   755 km
    (5, 8, 3, '23:40:00', '23:43:00', 870.00),   -- BAND:  870 km
    (5, 5, 4, '08:30:00', NULL,       1095.00);  -- CNB:  1095 km (Terminus, +1 day)

-- Train 6: 12167 — Varanasi Superfast Express (Departs CSTM 08:10, Arrives CNB 06:00 +1)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (6, 6, 1, NULL,       '08:10:00', 0.00),
    (6, 7, 2, '19:30:00', '19:35:00', 755.00),
    (6, 8, 3, '21:15:00', '21:18:00', 870.00),
    (6, 5, 4, '06:00:00', NULL,       1095.00);

-- Train 7: 12191 — Shridham Express (Departs CSTM 07:25, Arrives CNB 07:15 +1)
-- Demo: Approaching CNB — a 28-min delay train in CNB's H3 zone — adds to congestion.
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (7, 6, 1, NULL,       '07:25:00', 0.00),
    (7, 7, 2, '18:00:00', '18:05:00', 755.00),
    (7, 8, 3, '20:00:00', '20:02:00', 870.00),
    (7, 5, 4, '07:15:00', NULL,       1095.00);

-- Train 8: 22182 — Jabalpur Intercity Express (Departs CSTM 06:00, Arrives CNB 04:30 +1)
-- Demo: Already near CNB, ON-TIME — contributing to H3 density count.
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (8, 6, 1, NULL,       '06:00:00', 0.00),
    (8, 7, 2, '17:20:00', '17:25:00', 755.00),
    (8, 8, 3, '19:00:00', '19:03:00', 870.00),
    (8, 5, 4, '04:30:00', NULL,       1095.00);

-- ---------------------------------------------------------------------------
-- ROUTE 3 TRAINS: East Corridor (Howrah → Kanpur, ~882 km)
-- ---------------------------------------------------------------------------

-- Train 9: 13005 — Amritsar Mail (Departs HWH 19:30, Arrives CNB 05:55 +1)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (9, 9, 1, NULL,       '19:30:00', 0.00),     -- HWH: Origin
    (9, 10, 2, '02:50:00', '02:55:00', 630.00),  -- PRYJ:  630 km
    (9, 11, 3, '04:10:00', '04:13:00', 760.00),  -- FTP:   760 km
    (9, 5,  4, '05:55:00', NULL,       882.00);  -- CNB:   882 km (Terminus)

-- Train 10: 12311 — Kalka Mail (Departs HWH 13:50, Arrives CNB 00:25 +1)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (10, 9,  1, NULL,       '13:50:00', 0.00),
    (10, 10, 2, '21:40:00', '21:45:00', 630.00),
    (10, 11, 3, '23:00:00', '23:03:00', 760.00),
    (10, 5,  4, '00:25:00', NULL,       882.00);

-- Train 11: 13133 — Seelampur Express (Departs HWH 08:10, Arrives CNB 19:00)
-- Demo: Approaching CNB — 35 min delayed due to chain pulling.
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (11, 9,  1, NULL,       '08:10:00', 0.00),
    (11, 10, 2, '15:30:00', '15:35:00', 630.00),
    (11, 11, 3, '17:00:00', '17:03:00', 760.00),
    (11, 5,  4, '19:00:00', NULL,       882.00);

-- Train 12: 15707 — Katihar Express (Departs HWH 07:00, Arrives CNB 17:50)
-- Demo: Near CNB, heavily delayed (55 min) — worst-case actor in congestion cluster.
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (12, 9,  1, NULL,       '07:00:00', 0.00),
    (12, 10, 2, '14:30:00', '14:35:00', 630.00),
    (12, 11, 3, '15:55:00', '15:58:00', 760.00),
    (12, 5,  4, '17:50:00', NULL,       882.00);

-- =============================================================================
-- SECTION 4: LIVE TELEMETRY (Initial GPS positions for all 12 trains)
--
-- CONGESTION DESIGN STRATEGY:
--   Trains are deliberately positioned so that 5 trains (from all 3 corridors)
--   converge within ~30 km of CNB simultaneously. The Python ETA engine will
--   detect that multiple trains share neighboring H3 cells and apply penalties.
--
--   H3 Resolution 7 hex cell diameter ≈ 10 km. Trains within 15-30 km of CNB
--   will occupy the same or adjacent cells, triggering the congestion alert.
--
--   TRAIN POSITIONS (ordered by delay for easy demo scanning):
--   NEAR CNB (≤30 km):  Trains 4, 7, 8, 11, 12  ← congestion cluster
--   MID-ROUTE:          Trains 2, 3, 6, 10        ← approaching cluster
--   FAR (origin side):  Trains 1, 5, 9            ← baseline / on-time
-- =============================================================================

-- ── ROUTE 1: NORTH CORRIDOR ──────────────────────────────────────────────────

-- Train 1: 12004 Rajdhani — Between NDLS and GZB, full speed, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (1, 28.6550, 77.3270, 130.00, 0,
     h3_lat_lng_to_cell(POINT(28.6550, 77.3270), 7)::TEXT, NOW());

-- Train 2: 12032 Lucknow Mail — Near Aligarh, MINOR DELAY (18 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (2, 27.9800, 78.0520, 95.00, 18,
     h3_lat_lng_to_cell(POINT(27.9800, 78.0520), 7)::TEXT, NOW());

-- Train 3: 14854 Marudhar — Between ALJN and TDL, crawling due to fog, MAJOR DELAY (42 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (3, 27.5400, 78.1730, 45.00, 42,
     h3_lat_lng_to_cell(POINT(27.5400, 78.1730), 7)::TEXT, NOW());

-- Train 4: 12418 Prayagraj — APPROACHING CNB (~25 km out), MINOR DELAY (10 min)
-- Deliberate: placed in CNB's adjacent H3 cell to start congestion count.
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (4, 26.6850, 80.0420, 110.00, 10,
     h3_lat_lng_to_cell(POINT(26.6850, 80.0420), 7)::TEXT, NOW());

-- ── ROUTE 2: SOUTH-WEST CORRIDOR ─────────────────────────────────────────────

-- Train 5: 11078 Jhelum — Near Jhansi, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (5, 25.5120, 78.6250, 120.00, 0,
     h3_lat_lng_to_cell(POINT(25.5120, 78.6250), 7)::TEXT, NOW());

-- Train 6: 12167 Varanasi SF — Between Jhansi and Banda, MINOR DELAY (15 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (6, 25.4830, 79.6200, 100.00, 15,
     h3_lat_lng_to_cell(POINT(25.4830, 79.6200), 7)::TEXT, NOW());

-- Train 7: 12191 Shridham — APPROACHING CNB (~18 km out via SW), MODERATE DELAY (28 min)
-- Deliberate: entering the same H3 congestion cluster as Train 4.
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (7, 26.3200, 80.1850, 80.00, 28,
     h3_lat_lng_to_cell(POINT(26.3200, 80.1850), 7)::TEXT, NOW());

-- Train 8: 22182 Jabalpur Intercity — VERY NEAR CNB (~8 km out), ON-TIME
-- Deliberate: inside the CNB H3 cell, densest congestion contributor.
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (8, 26.4000, 80.2800, 60.00, 0,
     h3_lat_lng_to_cell(POINT(26.4000, 80.2800), 7)::TEXT, NOW());

-- ── ROUTE 3: EAST CORRIDOR ───────────────────────────────────────────────────

-- Train 9: 13005 Amritsar Mail — Near Prayagraj, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (9, 25.4900, 81.7850, 110.00, 0,
     h3_lat_lng_to_cell(POINT(25.4900, 81.7850), 7)::TEXT, NOW());

-- Train 10: 12311 Kalka Mail — Between Prayagraj and Fatehpur, MINOR DELAY (12 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (10, 25.7200, 81.1200, 95.00, 12,
     h3_lat_lng_to_cell(POINT(25.7200, 81.1200), 7)::TEXT, NOW());

-- Train 11: 13133 Seelampur — APPROACHING CNB (~20 km out via East), MAJOR DELAY (35 min)
-- Deliberate: approaching from the east, same congestion cluster as Trains 4, 7, 8.
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (11, 26.5500, 80.6500, 70.00, 35,
     h3_lat_lng_to_cell(POINT(26.5500, 80.6500), 7)::TEXT, NOW());

-- Train 12: 15707 Katihar — VERY NEAR CNB (~10 km out via East), WORST DELAY (55 min)
-- Deliberate: deepest inside the CNB H3 zone, heaviest congestion anchor.
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (12, 26.5100, 80.4800, 50.00, 55,
     h3_lat_lng_to_cell(POINT(26.5100, 80.4800), 7)::TEXT, NOW());

-- =============================================================================
-- SECTION 5: EVENTS LOG
-- Active events are read by the FastAPI ETA engine to apply delay penalties.
-- Historical (is_active=FALSE) events populate the AI Copilot's RAG context.
-- =============================================================================

-- ACTIVE EVENTS (affect current ETA calculations)
INSERT INTO events_log (train_id, event_type, severity, description, is_active) VALUES
    -- Dense fog on the North Corridor (primary demo anomaly for Phase 2 injection)
    (3, 'weather_fog', 'high',
     'Dense fog near Aligarh-Tundla corridor. Visibility < 50m. Speed restricted to 45 km/h.', TRUE),

    -- Chain pulling on East Corridor train (secondary event near CNB)
    (11, 'chain_pulling', 'medium',
     'Emergency chain pulled near Fatehpur-Kanpur section. 15-min unscheduled halt. Guard verification in progress.', TRUE),

    -- Signal failure adding to SW Corridor congestion near CNB
    (7, 'signal_halt', 'medium',
     'Automatic signal failure at Banda outer. Train held for 28 mins. Signal restored, moving at restricted speed.', TRUE),

    -- Minor track maintenance on Route 3 (low severity, contributing to delay)
    (12, 'track_maintenance', 'low',
     'Planned track maintenance window between Fatehpur-Kanpur. Speed restriction: 60 km/h.', TRUE);

-- HISTORICAL EVENTS (resolved — useful for AI Copilot query context)
INSERT INTO events_log (train_id, event_type, severity, description, is_active) VALUES
    (2, 'signal_halt', 'low',
     'Brief signal halt at GZB outer. Resolved in 18 mins.', FALSE),

    (5, 'weather_fog', 'medium',
     'Fog delay at Mumbai Thane stretch. Resolved. 45-min delay recovered partially.', FALSE),

    (9, 'normal', 'low',
     'Minor unscheduled halt at Mughal Sarai for operational reasons. Recovered on-time.', FALSE);

-- =============================================================================
-- VERIFICATION QUERIES
-- Expected row counts after seed:
--   Trains: 12  |  Stations: 11  |  Routes: 48
--   Live Telemetry: 12  |  Events Log: 7 (4 active + 3 historical)
-- =============================================================================
SELECT 'Trains'         AS table_name, COUNT(*) AS row_count FROM trains
UNION ALL
SELECT 'Stations',        COUNT(*) FROM stations
UNION ALL
SELECT 'Routes',          COUNT(*) FROM routes
UNION ALL
SELECT 'Live Telemetry',  COUNT(*) FROM live_telemetry
UNION ALL
SELECT 'Events (Active)', COUNT(*) FROM events_log WHERE is_active = TRUE
UNION ALL
SELECT 'Events (Total)',  COUNT(*) FROM events_log;

-- Verify PostGIS geometry auto-populated for all 11 stations
SELECT name, code, ROUND(lat::NUMERIC, 4) AS lat, ROUND(lng::NUMERIC, 4) AS lng,
       ST_AsText(geom) AS geom_wkt
FROM stations ORDER BY id;

-- CONGESTION CHECK QUERY:
-- Shows all trains with their H3 cell and delay status — ordered by proximity to CNB.
-- The ETA engine uses this pattern to detect >2 trains in the same H3 cell.
SELECT
    t.train_no,
    t.name,
    t.train_type,
    lt.current_lat,
    lt.current_lng,
    lt.current_speed   AS speed_kmh,
    lt.delay_minutes,
    lt.h3_index,
    CASE
        WHEN lt.delay_minutes = 0         THEN 'ON-TIME'
        WHEN lt.delay_minutes BETWEEN 1 AND 20 THEN 'MINOR DELAY'
        WHEN lt.delay_minutes BETWEEN 21 AND 40 THEN 'MODERATE DELAY'
        ELSE 'MAJOR DELAY'
    END AS status,
    CASE
        WHEN e.id IS NOT NULL THEN e.event_type
        ELSE 'none'
    END AS active_event
FROM live_telemetry lt
JOIN trains t ON t.id = lt.train_id
LEFT JOIN events_log e ON e.train_id = lt.train_id AND e.is_active = TRUE
ORDER BY lt.delay_minutes DESC;

-- H3 CONGESTION DENSITY QUERY:
-- Counts how many trains share the same H3 hex cell.
-- Cells with count > 2 will trigger the mocked STGNN penalty in Phase 3.
SELECT
    h3_index,
    COUNT(*) AS train_count,
    STRING_AGG(t.train_no, ', ' ORDER BY t.train_no) AS trains_in_cell,
    CASE WHEN COUNT(*) >= 3 THEN 'HIGH CONGESTION'
         WHEN COUNT(*) = 2  THEN 'MODERATE CONGESTION'
         ELSE 'NORMAL'
    END AS congestion_level
FROM live_telemetry lt
JOIN trains t ON t.id = lt.train_id
GROUP BY h3_index
ORDER BY train_count DESC;
