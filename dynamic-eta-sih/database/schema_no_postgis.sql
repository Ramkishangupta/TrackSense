-- =============================================================================
-- FILE: database/schema_no_postgis.sql
-- PURPOSE: Schema without PostGIS/H3 extensions for plain PostgreSQL 18.
--
-- The Python simulator handles H3 indexing via the `h3` Python library.
-- lat/lng are stored as plain NUMERIC columns (no PostGIS GEOMETRY needed).
--
-- HOW TO RUN:
--   psql -U postgres -d eta_sih_db -f database/schema_no_postgis.sql
-- =============================================================================

-- Drop tables in reverse dependency order for clean re-runs.
DROP TABLE IF EXISTS events_log CASCADE;
DROP TABLE IF EXISTS live_telemetry CASCADE;
DROP TABLE IF EXISTS routes CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS trains CASCADE;

-- =============================================================================
-- TABLE: trains
-- =============================================================================
CREATE TABLE trains (
    id            SERIAL PRIMARY KEY,
    train_no      VARCHAR(10)  NOT NULL UNIQUE,
    name          VARCHAR(100) NOT NULL,
    train_type    VARCHAR(50)  NOT NULL
);

COMMENT ON TABLE trains IS 'Master registry of all active trains in the simulation.';

-- =============================================================================
-- TABLE: stations
-- (No PostGIS geometry column — lat/lng stored as plain NUMERIC)
-- =============================================================================
CREATE TABLE stations (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100)   NOT NULL,
    code          VARCHAR(10)    NOT NULL UNIQUE,
    lat           NUMERIC(10, 6) NOT NULL,
    lng           NUMERIC(10, 6) NOT NULL
);

COMMENT ON TABLE stations IS 'Station master data with lat/lng coordinates.';

-- =============================================================================
-- TABLE: routes
-- =============================================================================
CREATE TABLE routes (
    id                   SERIAL PRIMARY KEY,
    train_id             INT           NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    station_id           INT           NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    station_sequence     INT           NOT NULL,
    expected_arrival     TIME,
    expected_departure   TIME,
    distance_from_start  NUMERIC(8, 2) NOT NULL,

    CONSTRAINT uq_route_train_station  UNIQUE (train_id, station_id),
    CONSTRAINT uq_route_train_sequence UNIQUE (train_id, station_sequence)
);

COMMENT ON TABLE routes IS 'Scheduled stop sequence and timetable for each train.';
CREATE INDEX idx_routes_train_id ON routes (train_id);

-- =============================================================================
-- TABLE: live_telemetry
-- =============================================================================
CREATE TABLE live_telemetry (
    id              SERIAL PRIMARY KEY,
    train_id        INT             NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    current_lat     NUMERIC(10, 6)  NOT NULL,
    current_lng     NUMERIC(10, 6)  NOT NULL,
    current_speed   NUMERIC(5, 2)   DEFAULT 0,
    delay_minutes   INT             DEFAULT 0,
    h3_index        TEXT,
    recorded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_telemetry_train UNIQUE (train_id)
);

COMMENT ON TABLE live_telemetry IS 'Real-time GPS telemetry updated by the Python simulator every ~10 seconds.';
CREATE INDEX idx_telemetry_h3          ON live_telemetry (h3_index);
CREATE INDEX idx_telemetry_recorded_at ON live_telemetry (recorded_at DESC);

-- =============================================================================
-- TABLE: events_log
-- =============================================================================
CREATE TABLE events_log (
    id          SERIAL PRIMARY KEY,
    train_id    INT          NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
    event_type  VARCHAR(50)  NOT NULL DEFAULT 'normal',
    severity    VARCHAR(20)  NOT NULL DEFAULT 'low',
    description TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE events_log IS 'Log of anomaly events injected by the simulator.';
CREATE INDEX idx_events_train_active ON events_log (train_id, is_active);
