-- PostGIS Foundation Migration
-- This migration enables PostGIS and adds spatial columns + indices.
-- Run this AFTER `drizzle-kit push` has created the base columns.

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Add geometry column to area table (for polygon boundaries)
-- Uses SRID 4326 (WGS 84 - standard GPS coordinates)
ALTER TABLE "area"
  ADD COLUMN IF NOT EXISTS "boundary" geometry(Polygon, 4326);

ALTER TABLE "area"
  ADD COLUMN IF NOT EXISTS "center_point" geometry(Point, 4326);

-- 3. Create spatial indices for fast lookups
CREATE INDEX IF NOT EXISTS "area_boundary_gist_idx"
  ON "area" USING GIST ("boundary");

CREATE INDEX IF NOT EXISTS "area_center_point_gist_idx"
  ON "area" USING GIST ("center_point");

-- 4. Backfill: convert existing polygon JSONB data to PostGIS geometry
-- Only runs if there's existing data with polygon JSONB
UPDATE "area"
SET "boundary" = ST_SetSRID(
  ST_GeomFromGeoJSON(
    json_build_object(
      'type', 'Polygon',
      'coordinates', "polygon"
    )::text
  ),
  4326
)
WHERE "polygon" IS NOT NULL AND "boundary" IS NULL;

-- 5. Backfill: convert existing center_lat/center_lng to PostGIS point
UPDATE "area"
SET "center_point" = ST_SetSRID(
  ST_MakePoint("center_lng"::double precision, "center_lat"::double precision),
  4326
)
WHERE "center_lat" IS NOT NULL
  AND "center_lng" IS NOT NULL
  AND "center_point" IS NULL;
