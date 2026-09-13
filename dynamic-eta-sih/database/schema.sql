-- =============================================================================
-- FILE: database/schema.sql
-- PURPOSE: Define all core tables for the Dynamic Train ETA Prediction System.
-- RUN THIS SECOND after init_h3_postgis.sql.
--
-- HOW TO RUN:
--   psql -U postgres -d eta_sih_db -f database/schema.sql
-- =============================================================================

-- Drop tables in reverse dependency order for clean re-runs during development.
DROP TABLE IF EXISTS events_log CASCADE;
DROP TABLE IF EXISTS live_telemetry CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS trains CASCADE;

-- =============================================================================
-- TABLE: trains
-- Stores the static master data for each train (like a train's identity card).
-- =============================================================================
CREATE TABLE trains (
    id            SERIAL PRIMARY KEY,
    train_no      VARCHAR(10)  NOT NULL UNIQUE,   -- Official Indian Railways train number (e.g., '12004')
    name          VARCHAR(100) NOT NULL,           -- Train name (e.g., 'New Delhi Rajdhani Express')
    train_type    VARCHAR(50)  NOT NULL            -- Category: 'Rajdhani', 'Shatabdi', 'Passenger', 'Freight'
);

COMMENT ON TABLE trains IS 'Master registry of all active trains in the simulation.';

-- =============================================================================
-- TABLE: stations
-- Stores station identity and geospatial location as a PostGIS POINT geometry.
-- =============================================================================
CREATE TABLE stations (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,           -- Full station name (e.g., 'New Delhi Railway Station')
    code          VARCHAR(10)  NOT NULL UNIQUE,    -- Official station code (e.g., 'NDLS')
    lat           NUMERIC(10, 6) NOT NULL,         -- Latitude (decimal degrees)
    lng           NUMERIC(10, 6) NOT NULL,         -- Longitude (decimal degrees)
    -- PostGIS geometry column: stores as 2D Point in WGS84 coordinate system (SRID 4326).
    -- This enables spatial queries like finding nearby stations.
    geom          GEOMETRY(POINT, 4326)
);

COMMENT ON TABLE stations IS 'Station master data including PostGIS spatial geometry.';
COMMENT ON COLUMN stations.geom IS 'PostGIS 2D Point geometry in WGS84 (SRID 4326). Auto-populated from lat/lng.';

-- Create a spatial index on the geometry column for fast geospatial lookups.
CREATE INDEX idx_stations_geom ON stations USING GIST (geom);

-- =============================================================================
-- TABLE: routes
-- Defines the ordered schedule of stations for each train.
-- Each row represents a single stop on a train's journey.
-- =============================================================================
CREATE TABLE routes (
    id                   SERIAL PRIMARY KEY,
    train_id             INT           NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    station_id           INT           NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    station_sequence     INT           NOT NULL,   -- Order of the stop (1 = origin, 2 = next stop, etc.)
    expected_arrival     TIME          ,           -- Scheduled arrival time (NULL for origin station)
    expected_departure   TIME          ,           -- Scheduled departure time (NULL for terminus station)
    distance_from_start  NUMERIC(8, 2) NOT NULL,   -- Cumulative distance in KM from the train's origin station

    -- A train can only stop at the same station once per route.
    CONSTRAINT uq_route_train_station UNIQUE (train_id, station_id),
    CONSTRAINT uq_route_train_sequence UNIQUE (train_id, station_sequence)
);

COMMENT ON TABLE routes IS 'Scheduled stop sequence and timetable for each train on its route.';

-- Index to speed up queries fetching the full route for a specific train.
CREATE INDEX idx_routes_train_id ON routes (train_id);

-- =============================================================================
-- TABLE: live_telemetry
-- The heart of the real-time simulation. Updated continuously by the Python simulator.
-- Stores the current GPS location and Uber H3 index for each active train.
-- =============================================================================
CREATE TABLE live_telemetry (
    id              SERIAL PRIMARY KEY,
    train_id        INT             NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    current_lat     NUMERIC(10, 6)  NOT NULL,       -- Current latitude from simulated GPS
    current_lng     NUMERIC(10, 6)  NOT NULL,       -- Current longitude from simulated GPS
    current_speed   NUMERIC(5, 2)   DEFAULT 0,      -- Current speed in km/h
    delay_minutes   INT             DEFAULT 0,       -- Calculated delay vs. schedule in minutes
    -- H3 index at resolution 7 (~5.16 km avg edge length). Used for congestion detection.
    -- Stored as TEXT to maintain compatibility without needing the H3 type.
    h3_index        TEXT,
    recorded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(), -- Timestamp of this telemetry record
    -- Ensure each train has only one 'current' telemetry record (upsert target).
    CONSTRAINT uq_telemetry_train UNIQUE (train_id)
);

COMMENT ON TABLE live_telemetry IS 'Real-time GPS telemetry updated by the Python simulator every ~10 seconds.';
COMMENT ON COLUMN live_telemetry.h3_index IS 'Uber H3 hexagonal grid index at resolution 7. Used for STGNN-like congestion detection.';

-- Index to speed up H3-based congestion queries (finding all trains in the same hex cell).
CREATE INDEX idx_telemetry_h3 ON live_telemetry (h3_index);

-- Index for time-series analysis and latest-record queries.
CREATE INDEX idx_telemetry_recorded_at ON live_telemetry (recorded_at DESC);

-- =============================================================================
-- TABLE: events_log
-- Tracks all anomaly events injected by the simulator (fog, chain pulling, etc.).
-- Used by the ETA engine to apply additional delay penalties.
-- =============================================================================
CREATE TABLE events_log (
    id          SERIAL PRIMARY KEY,
    train_id    INT          NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    -- Event types match the PRD scenarios: 'weather_fog', 'chain_pulling', 'signal_halt', 'normal'
    event_type  VARCHAR(50)  NOT NULL DEFAULT 'normal',
    severity    VARCHAR(20)  NOT NULL DEFAULT 'low',   -- 'low', 'medium', 'high'
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,    -- Active events affect ETA calculation
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events_log IS 'Log of anomaly events (fog, halts) injected by the simulator. Active events add penalty to ETA.';

-- Index for quickly finding all currently ACTIVE events for a specific train.
CREATE INDEX idx_events_train_active ON events_log (train_id, is_active);

-- =============================================================================
-- TRIGGER: Auto-populate the PostGIS geometry column on stations insert/update.
-- This ensures geom is always in sync with the lat/lng columns.
-- =============================================================================
CREATE OR REPLACE FUNCTION sync_station_geom()
RETURNS TRIGGER AS $$
BEGIN
    -- ST_SetSRID and ST_MakePoint construct a PostGIS POINT geometry from lng, lat.
    -- Note: PostGIS uses (longitude, latitude) order, which is the (X, Y) convention.
    NEW.geom = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_station_geom
BEFORE INSERT OR UPDATE ON stations
FOR EACH ROW EXECUTE FUNCTION sync_station_geom();
