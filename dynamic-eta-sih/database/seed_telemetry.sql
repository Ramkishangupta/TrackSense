-- =============================================================================
-- FILE: database/seed_telemetry.sql
-- PURPOSE: Insert initial live_telemetry rows without using h3 SQL extension.
--          H3 indexes were precomputed with Python h3 library at resolution 7.
-- HOW TO RUN (after schema_no_postgis.sql):
--   psql -U postgres -d eta_sih_db -f database/seed_telemetry.sql
-- =============================================================================

-- Clear any partial telemetry from the failed seed run
TRUNCATE TABLE live_telemetry RESTART IDENTITY CASCADE;

-- ── ROUTE 1: NORTH CORRIDOR ──────────────────────────────────────────────────
-- Train 1: 12004 Rajdhani — Between NDLS and GZB, full speed, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (1, 28.6550, 77.3270, 130.00, 0,  '873da1ab2ffffff', NOW());

-- Train 2: 12032 Lucknow Mail — Near Aligarh, MINOR DELAY (18 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (2, 27.9800, 78.0520, 95.00,  18, '873dae123ffffff', NOW());

-- Train 3: 14854 Marudhar — Between ALJN and TDL, fog delay, MAJOR DELAY (42 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (3, 27.5400, 78.1730, 45.00,  42, '873dae443ffffff', NOW());

-- Train 4: 12418 Prayagraj — APPROACHING CNB (~25 km out), MINOR DELAY (10 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (4, 26.6850, 80.0420, 110.00, 10, '873d8c101ffffff', NOW());

-- ── ROUTE 2: SOUTH-WEST CORRIDOR ─────────────────────────────────────────────
-- Train 5: 11078 Jhelum — Near Jhansi, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (5, 25.5120, 78.6250, 120.00, 0,  '873d8382affffff', NOW());

-- Train 6: 12167 Varanasi SF — Between Jhansi and Banda, MINOR DELAY (15 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (6, 25.4830, 79.6200, 100.00, 15, '873d8ece3ffffff', NOW());

-- Train 7: 12191 Shridham — APPROACHING CNB (~18 km out via SW), MODERATE DELAY (28 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (7, 26.3200, 80.1850, 80.00,  28, '873d8c44dffffff', NOW());

-- Train 8: 22182 Jabalpur Intercity — VERY NEAR CNB (~8 km out), ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (8, 26.4000, 80.2800, 60.00,  0,  '873d8c72effffff', NOW());

-- ── ROUTE 3: EAST CORRIDOR ───────────────────────────────────────────────────
-- Train 9: 13005 Amritsar Mail — Near Prayagraj, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (9, 25.4900, 81.7850, 110.00, 0,  '873d8b888ffffff', NOW());

-- Train 10: 12311 Kalka Mail — Between Prayagraj and Fatehpur, MINOR DELAY (12 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (10, 25.7200, 81.1200, 95.00,  12, '873d88730ffffff', NOW());

-- Train 11: 13133 Seelampur — APPROACHING CNB (~20 km out via East), MAJOR DELAY (35 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (11, 26.5500, 80.6500, 70.00,  35, '873d8c21affffff', NOW());

-- Train 12: 15707 Katihar — VERY NEAR CNB (~10 km out via East), WORST DELAY (55 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (12, 26.5100, 80.4800, 50.00,  55, '873d8c39effffff', NOW());

-- ── EXPANSION TRAINS (ids 13-20) ───────────────────────────────────────────

-- Train 13: 12034 Kanpur Shatabdi — Near GZB, full speed, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (13, 28.6600, 77.4000, 120.00, 0,  '873da1ac4ffffff', NOW());

-- Train 14: 12802 Purushottam SF — Near Tundla, MINOR DELAY (22 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (14, 27.2100, 78.2500, 115.00, 22, '873dae562ffffff', NOW());

-- Train 15: 12137 Punjab Mail — Near Orai, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (15, 25.9800, 79.4500, 100.00, 0,  '873d8ec95ffffff', NOW());

-- Train 16: 12139 Sewagram Express — Between ORAI and BAND, MINOR DELAY (20 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (16, 25.7200, 79.8900, 95.00,  20, '873d8ec11ffffff', NOW());

-- Train 17: 12381 Poorva Express — Near Mirzapur, ON-TIME
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (17, 25.1500, 82.5700, 115.00, 0,  '873d89b82ffffff', NOW());

-- Train 18: 12307 Jodhpur SF — Between MZP and FTP, MINOR DELAY (8 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (18, 25.5400, 81.7000, 115.00, 8,  '873d8b886ffffff', NOW());

-- Train 19: 12556 Gorakhdham Exp — Near Etawah, MODERATE DELAY (30 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (19, 26.7800, 79.0300, 95.00,  30, '873d8c685ffffff', NOW());

-- Train 20: 14216 Ganga Gomti Exp — Near ALJN, MINOR DELAY (15 min)
INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    (20, 27.8500, 78.1000, 90.00,  15, '873dae125ffffff', NOW());

-- Verify
SELECT
    t.train_no, t.name, t.train_type,
    lt.current_lat, lt.current_lng,
    lt.current_speed AS speed_kmh,
    lt.delay_minutes,
    lt.h3_index,
    lt.recorded_at
FROM live_telemetry lt
JOIN trains t ON t.id = lt.train_id
ORDER BY t.id;
