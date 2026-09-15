-- =============================================================================
-- FILE: database/seed_telemetry.sql
-- PURPOSE: Insert starting positions for all 25 trains.
-- =============================================================================

INSERT INTO live_telemetry (train_id, current_lat, current_lng, current_speed, delay_minutes, h3_index, recorded_at) VALUES
    -- Route 1 (NDLS -> CNB)
    (1, 28.6418, 77.2171, 130.00,  0, '873da1ab2ffffff', NOW()),
    (2, 28.6685, 77.4372,  95.00, 18, '873dae123ffffff', NOW()),
    (3, 27.8805, 78.0799,  90.00, 42, '873db87c5ffffff', NOW()),
    (4, 27.2091, 78.2567, 115.00, 10, '873db9ac1ffffff', NOW()),
    (5, 26.5000, 80.3000, 130.00,  0, '873d8c39effffff', NOW()), -- Approaching CNB

    -- Route 2 (CSTM -> JHS)
    (6, 18.9403, 72.8355, 110.00, 15, '873da1ab2ffffff', NOW()),
    (7, 21.0455, 75.8011, 105.00, 10, '873dae123ffffff', NOW()),
    (8, 22.6184, 77.7712,  95.00,  0, '873db87c5ffffff', NOW()),
    (9, 23.2599, 77.4126,  90.00, 20, '873db9ac1ffffff', NOW()),
    (10, 24.1683, 78.1884, 110.00,  5, '873d8c39effffff', NOW()), -- Approaching JHS

    -- Route 3 (HWH -> PRYJ)
    (11, 22.5832, 88.3427, 100.00,  0, '873da1ab2ffffff', NOW()),
    (12, 23.7925, 86.4320,  95.00, 15, '873dae123ffffff', NOW()),
    (13, 24.7955, 85.0000,  90.00, 30, '873db87c5ffffff', NOW()),
    (14, 25.2818, 83.1189,  80.00, 55, '873db9ac1ffffff', NOW()),
    (15, 25.4000, 82.0000, 120.00,  5, '873d8c39effffff', NOW()), -- Approaching PRYJ

    -- Route 4 (NGP -> CNB)
    (16, 21.1500, 79.0833, 115.00,  0, '873da1ab2ffffff', NOW()),
    (17, 22.6184, 77.7712, 100.00, 20, '873dae123ffffff', NOW()),
    (18, 25.4489, 78.5690, 110.00,  0, '873db87c5ffffff', NOW()), -- At JHS
    (19, 25.9928, 79.4674, 115.00, 12, '873db9ac1ffffff', NOW()),
    (20, 26.4000, 80.2000,  90.00, 35, '873d8c39effffff', NOW()), -- Approaching CNB

    -- Route 5 (LKO -> PRYJ)
    (21, 26.8306, 80.9238,  95.00,  0, '873da1ab2ffffff', NOW()),
    (22, 26.2307, 81.2407,  90.00, 10, '873dae123ffffff', NOW()),
    (23, 25.9189, 81.9839,  85.00, 25, '873db87c5ffffff', NOW()),
    (24, 25.5000, 81.8500, 110.00,  5, '873db9ac1ffffff', NOW()), -- Approaching PRYJ
    (25, 25.4467, 81.8407,  90.00,  0, '873d8c39effffff', NOW()); -- At PRYJ
