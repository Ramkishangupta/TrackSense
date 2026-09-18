-- =============================================================================
-- FILE: database/02_seed.sql
-- PURPOSE: Insert realistic multi-hub demo data for the Network Congestion Demo.
--
-- CONGESTION DEMO ARCHITECTURE:
--   5 intersecting routes converging at 3 major hubs (Kanpur, Jhansi, Prayagraj).
--
--   ROUTE 1 (North → CNB) : New Delhi → GZB → ALJN → TDL → Kanpur (CNB) (Trains 1-5)
--   ROUTE 2 (West → JHS)  : Mumbai CST → BSL → ET → BPL → BINA → Jhansi (JHS) (Trains 6-10)
--   ROUTE 3 (East → PRYJ) : Howrah → DHN → GAYA → DDU → Prayagraj (PRYJ) (Trains 11-15)
--   ROUTE 4 (South → CNB) : Nagpur → ET → JHS → ORAI → Kanpur (CNB) (Trains 16-20)
--   ROUTE 5 (North → PRYJ): Lucknow → RBL → MBDP → Prayagraj (PRYJ) (Trains 21-25)
--
-- TOTAL: 25 trains | 20 stations | 5 routes | 3 convergence points
-- =============================================================================

TRUNCATE TABLE events_log, live_telemetry, routes, stations, trains RESTART IDENTITY CASCADE;

-- =============================================================================
-- SECTION 1: TRAINS (25 Trains across 5 corridors)
-- =============================================================================
INSERT INTO trains (train_no, name, train_type) VALUES
    -- ROUTE 1: Delhi to Kanpur (1-5)
    ('12004', 'New Delhi Rajdhani Express',  'Rajdhani'),
    ('12032', 'Lucknow Mail',                'Mail'),
    ('14854', 'Marudhar Express',            'Express'),
    ('12418', 'Prayagraj Express',           'Superfast'),
    ('12310', 'Patna Rajdhani',              'Rajdhani'),

    -- ROUTE 2: Mumbai to Jhansi (6-10)
    ('11078', 'Jhelum Express',              'Express'),
    ('12167', 'Varanasi Superfast',          'Superfast'),
    ('12191', 'Shridham Express',            'Express'),
    ('22182', 'Jabalpur Intercity',          'Intercity'),
    ('12137', 'Punjab Mail',                 'Mail'),

    -- ROUTE 3: Howrah to Prayagraj (11-15)
    ('13005', 'Amritsar Mail',               'Mail'),
    ('12311', 'Kalka Mail',                  'Mail'),
    ('13133', 'Seelampur Express',           'Express'),
    ('15707', 'Katihar Express',             'Passenger'),
    ('12273', 'Howrah NDLS Duronto',         'Rajdhani'),

    -- ROUTE 4: Nagpur to Kanpur (16-20)
    ('12615', 'Grand Trunk Express',         'Superfast'),
    ('12791', 'Secunderabad Patna Exp',      'Express'),
    ('12295', 'Sanghamitra Express',         'Superfast'),
    ('12625', 'Kerala Express',              'Superfast'),
    ('12621', 'Tamil Nadu Express',          'Superfast'),

    -- ROUTE 5: Lucknow to Prayagraj (21-25)
    ('14210', 'Lucknow Prayagraj Intr',      'Intercity'),
    ('14216', 'Ganga Gomti Express',         'Express'),
    ('14308', 'Bareilly Prayagraj Exp',      'Express'),
    ('12204', 'Garib Rath Express',          'Superfast'),
    ('12430', 'Lucknow NDLS Rajdhani',       'Rajdhani');

-- =============================================================================
-- SECTION 2: STATIONS
-- =============================================================================
INSERT INTO stations (name, code, lat, lng) VALUES
    ('New Delhi Railway Station',   'NDLS', 28.641862, 77.217151),  -- 1
    ('Ghaziabad Junction',          'GZB',  28.668550, 77.437270),  -- 2
    ('Aligarh Junction',            'ALJN', 27.880520, 78.079990),  -- 3
    ('Tundla Junction',             'TDL',  27.209100, 78.256700),  -- 4
    ('Kanpur Central',              'CNB',  26.459700, 80.349700),  -- 5  (HUB 1)

    ('Mumbai CST',                  'CSTM', 18.940300, 72.835500),  -- 6
    ('Bhusaval Junction',           'BSL',  21.045500, 75.801100),  -- 7
    ('Itarsi Junction',             'ET',   22.618400, 77.771200),  -- 8
    ('Bhopal Junction',             'BPL',  23.259900, 77.412600),  -- 9
    ('Bina Junction',               'BINA', 24.168300, 78.188400),  -- 10
    ('Jhansi Junction',             'JHS',  25.448900, 78.569000),  -- 11 (HUB 2)

    ('Howrah Junction',             'HWH',  22.583200, 88.342700),  -- 12
    ('Dhanbad Junction',            'DHN',  23.792500, 86.432000),  -- 13
    ('Gaya Junction',               'GAYA', 24.795500, 85.000000),  -- 14
    ('Pt. DD Upadhyaya',            'DDU',  25.281800, 83.118900),  -- 15
    ('Prayagraj Junction',          'PRYJ', 25.446700, 81.840700),  -- 16 (HUB 3)

    ('Nagpur Junction',             'NGP',  21.150000, 79.083300),  -- 17
    ('Orai',                        'ORAI', 25.992800, 79.467400),  -- 18

    ('Lucknow Junction',            'LKO',  26.830600, 80.923800),  -- 19
    ('Rae Bareli Junction',         'RBL',  26.230700, 81.240700),  -- 20
    ('Pratapgarh Junction',         'MBDP', 25.918900, 81.983900);  -- 21

-- =============================================================================
-- SECTION 3: ROUTES
-- =============================================================================

DO $$
DECLARE
    t_id INT;
BEGIN
    -- ROUTE 1 (Trains 1-5): NDLS(1) -> GZB(2) -> ALJN(3) -> TDL(4) -> CNB(5)
    FOR t_id IN 1..5 LOOP
        INSERT INTO routes (train_id, station_id, station_sequence, distance_from_start) VALUES
        (t_id, 1, 1, 0.00),
        (t_id, 2, 2, 35.00),
        (t_id, 3, 3, 130.00),
        (t_id, 4, 4, 210.00),
        (t_id, 5, 5, 380.00);
    END LOOP;

    -- ROUTE 2 (Trains 6-10): CSTM(6) -> BSL(7) -> ET(8) -> BPL(9) -> BINA(10) -> JHS(11)
    FOR t_id IN 6..10 LOOP
        INSERT INTO routes (train_id, station_id, station_sequence, distance_from_start) VALUES
        (t_id, 6, 1, 0.00),
        (t_id, 7, 2, 440.00),
        (t_id, 8, 3, 740.00),
        (t_id, 9, 4, 830.00),
        (t_id, 10, 5, 960.00),
        (t_id, 11, 6, 1110.00);
    END LOOP;

    -- ROUTE 3 (Trains 11-15): HWH(12) -> DHN(13) -> GAYA(14) -> DDU(15) -> PRYJ(16)
    FOR t_id IN 11..15 LOOP
        INSERT INTO routes (train_id, station_id, station_sequence, distance_from_start) VALUES
        (t_id, 12, 1, 0.00),
        (t_id, 13, 2, 260.00),
        (t_id, 14, 3, 460.00),
        (t_id, 15, 4, 660.00),
        (t_id, 16, 5, 810.00);
    END LOOP;

    -- ROUTE 4 (Trains 16-20): NGP(17) -> ET(8) -> JHS(11) -> ORAI(18) -> CNB(5)
    FOR t_id IN 16..20 LOOP
        INSERT INTO routes (train_id, station_id, station_sequence, distance_from_start) VALUES
        (t_id, 17, 1, 0.00),
        (t_id, 8, 2, 300.00),
        (t_id, 11, 3, 680.00),
        (t_id, 18, 4, 790.00),
        (t_id, 5, 5, 900.00);
    END LOOP;

    -- ROUTE 5 (Trains 21-25): LKO(19) -> RBL(20) -> MBDP(21) -> PRYJ(16)
    FOR t_id IN 21..25 LOOP
        INSERT INTO routes (train_id, station_id, station_sequence, distance_from_start) VALUES
        (t_id, 19, 1, 0.00),
        (t_id, 20, 2, 80.00),
        (t_id, 21, 3, 170.00),
        (t_id, 16, 4, 230.00);
    END LOOP;
END $$;
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
