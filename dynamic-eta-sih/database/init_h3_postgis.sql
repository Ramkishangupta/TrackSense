-- =============================================================================
-- FILE: database/init_h3_postgis.sql
-- PURPOSE: Initialize the PostgreSQL database with required geospatial extensions.
-- RUN THIS FIRST before executing schema.sql or seed_data.sql.
--
-- PREREQUISITES:
--   1. PostgreSQL 14+ must be installed.
--   2. PostGIS extension: install via 'sudo apt install postgresql-15-postgis-3'
--      or via the PostgreSQL Application Stack Builder on Windows.
--   3. H3 extension: install via 'sudo apt install postgresql-15-h3' or
--      build from source: https://github.com/uber/h3-pg
--
-- HOW TO RUN:
--   psql -U postgres -c "CREATE DATABASE eta_sih_db;"
--   psql -U postgres -d eta_sih_db -f database/init_h3_postgis.sql
-- =============================================================================

-- Enable PostGIS for spatial data types (GEOMETRY, GEOGRAPHY) and spatial functions.
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable PostGIS topology (required by some PostGIS functions).
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable the H3 extension for Uber's hexagonal hierarchical geospatial indexing.
-- This allows us to calculate H3 cell indexes from lat/lng coordinates directly in SQL.
CREATE EXTENSION IF NOT EXISTS h3;

-- Enable H3 PostGIS integration bridge (allows H3 functions to work with PostGIS geometries).
CREATE EXTENSION IF NOT EXISTS h3_postgis CASCADE;

-- Verify that all extensions are installed correctly.
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name IN ('postgis', 'h3', 'h3_postgis')
ORDER BY name;
