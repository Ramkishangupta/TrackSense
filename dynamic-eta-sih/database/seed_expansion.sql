-- =============================================================================
-- FILE: database/seed_expansion.sql
-- PURPOSE: Expand the demo network from 12 → 20 trains, add 3 intermediate
--          stations so the map looks busier and more realistic.
--
-- MUST BE RUN AFTER seed_data.sql (it appends, does not truncate).
--
-- NEW STATIONS (3):
--   Etawah (ETW)    — Route 1 intermediate between TDL and CNB
--   Orai (ORAI)     — Route 2 intermediate between JHS and BAND
--   Mirzapur (MZP)  — Route 3 intermediate between PRYJ and FTP
--
-- NEW TRAINS (8):
--   Route 1 North:   12034 Kanpur Shatabdi, 12802 Purushottam SF  (ids 13-14)
--   Route 2 South-W: 12137 Punjab Mail, 12139 Sewagram Express    (ids 15-16)
--   Route 3 East:    12381 Poorva Express, 12307 Jodhpur Express   (ids 17-18)
--   Route 1 extra:   12556 Gorakhdham Exp, 14216 Ganga Gomti Exp   (ids 19-20)
--
-- HOW TO RUN:
--   psql -U postgres -d eta_sih_db -f database/seed_expansion.sql
-- =============================================================================

-- =============================================================================
-- NEW STATIONS
-- =============================================================================
INSERT INTO stations (name, code, lat, lng) VALUES
    ('Etawah Junction',    'ETW',  26.787400,  79.024100),  -- id=12
    ('Orai',               'ORAI', 25.989200,  79.448600),  -- id=13
    ('Mirzapur',           'MZP',  25.151200,  82.572100);  -- id=14

-- =============================================================================
-- NEW TRAINS
-- =============================================================================
INSERT INTO trains (train_no, name, train_type) VALUES
    -- Route 1 extra (North corridor)
    ('12034', 'Kanpur Shatabdi Express',   'Shatabdi'),   -- id=13
    ('12802', 'Purushottam SF Express',    'Superfast'),  -- id=14

    -- Route 2 extra (South-West corridor)
    ('12137', 'Punjab Mail',               'Mail'),       -- id=15
    ('12139', 'Sewagram Express',          'Express'),    -- id=16

    -- Route 3 extra (East corridor)
    ('12381', 'Poorva Express',            'Superfast'),  -- id=17
    ('12307', 'Jodhpur SF Express',        'Superfast'),  -- id=18

    -- Route 1 bonus (more north trains for density)
    ('12556', 'Gorakhdham Express',        'Express'),    -- id=19
    ('14216', 'Ganga Gomti Express',       'Intercity');  -- id=20

-- =============================================================================
-- ROUTES FOR NEW TRAINS
-- (Using new intermediate stations: ETW=12, ORAI=13, MZP=14)
-- =============================================================================

-- Train 13: 12034 Kanpur Shatabdi (Route 1 + ETW)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (13, 1,  1, NULL,       '06:15:00', 0.00),
    (13, 2,  2, '06:50:00', '06:52:00', 35.00),
    (13, 3,  3, '08:15:00', '08:17:00', 130.00),
    (13, 4,  4, '09:10:00', '09:12:00', 178.00),
    (13, 12, 5, '10:30:00', '10:32:00', 280.00),
    (13, 5,  6, '11:45:00', NULL,       380.00);

-- Train 14: 12802 Purushottam SF (Route 1 + ETW)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (14, 1,  1, NULL,       '18:30:00', 0.00),
    (14, 2,  2, '19:10:00', '19:12:00', 35.00),
    (14, 3,  3, '20:45:00', '20:47:00', 130.00),
    (14, 4,  4, '21:40:00', '21:42:00', 178.00),
    (14, 12, 5, '22:55:00', '22:57:00', 280.00),
    (14, 5,  6, '00:10:00', NULL,       380.00);

-- Train 15: 12137 Punjab Mail (Route 2 + ORAI)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (15, 6,  1, NULL,       '22:05:00', 0.00),
    (15, 7,  2, '09:30:00', '09:35:00', 755.00),
    (15, 13, 3, '11:00:00', '11:02:00', 820.00),
    (15, 8,  4, '12:15:00', '12:18:00', 870.00),
    (15, 5,  5, '15:00:00', NULL,       1095.00);

-- Train 16: 12139 Sewagram Express (Route 2 + ORAI)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (16, 6,  1, NULL,       '14:40:00', 0.00),
    (16, 7,  2, '02:00:00', '02:05:00', 755.00),
    (16, 13, 3, '03:30:00', '03:32:00', 820.00),
    (16, 8,  4, '04:45:00', '04:48:00', 870.00),
    (16, 5,  5, '07:30:00', NULL,       1095.00);

-- Train 17: 12381 Poorva Express (Route 3 + MZP)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (17, 9,  1, NULL,       '20:05:00', 0.00),
    (17, 10, 2, '03:20:00', '03:25:00', 630.00),
    (17, 14, 3, '04:40:00', '04:42:00', 700.00),
    (17, 11, 4, '06:00:00', '06:03:00', 760.00),
    (17, 5,  5, '07:45:00', NULL,       882.00);

-- Train 18: 12307 Jodhpur SF Express (Route 3 + MZP)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (18, 9,  1, NULL,       '16:50:00', 0.00),
    (18, 10, 2, '00:10:00', '00:15:00', 630.00),
    (18, 14, 3, '01:30:00', '01:32:00', 700.00),
    (18, 11, 4, '02:50:00', '02:53:00', 760.00),
    (18, 5,  5, '04:35:00', NULL,       882.00);

-- Train 19: 12556 Gorakhdham Express (Route 1 + ETW)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (19, 1,  1, NULL,       '13:40:00', 0.00),
    (19, 2,  2, '14:20:00', '14:22:00', 35.00),
    (19, 3,  3, '15:55:00', '15:57:00', 130.00),
    (19, 4,  4, '16:50:00', '16:52:00', 178.00),
    (19, 12, 5, '18:05:00', '18:07:00', 280.00),
    (19, 5,  6, '19:20:00', NULL,       380.00);

-- Train 20: 14216 Ganga Gomti Express (Route 1 + ETW)
INSERT INTO routes (train_id, station_id, station_sequence, expected_arrival, expected_departure, distance_from_start) VALUES
    (20, 1,  1, NULL,       '15:20:00', 0.00),
    (20, 2,  2, '16:00:00', '16:02:00', 35.00),
    (20, 3,  3, '17:35:00', '17:37:00', 130.00),
    (20, 4,  4, '18:30:00', '18:32:00', 178.00),
    (20, 12, 5, '19:45:00', '19:47:00', 280.00),
    (20, 5,  6, '21:00:00', NULL,       380.00);

-- Verify
SELECT t.train_no, t.name, t.train_type
FROM trains t WHERE t.id > 12 ORDER BY t.id;
