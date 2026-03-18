-- PostGIS Foundation Migration
-- NOTE: PostGIS extension is NOT available on this DB server.
-- All spatial operations use application-level math (Haversine, ray-casting)
-- instead of PostGIS functions. Geometry data is stored as:
--   - polygon: JSONB (GeoJSON coordinates)
--   - lat/lng: TEXT columns
--
-- If PostGIS becomes available in the future, uncomment the sections below.

-- CREATE EXTENSION IF NOT EXISTS postgis;
-- ALTER TABLE "area" ADD COLUMN IF NOT EXISTS "boundary" geometry(Polygon, 4326);
-- ALTER TABLE "area" ADD COLUMN IF NOT EXISTS "center_point" geometry(Point, 4326);
-- CREATE INDEX IF NOT EXISTS "area_boundary_gist_idx" ON "area" USING GIST ("boundary");
-- CREATE INDEX IF NOT EXISTS "area_center_point_gist_idx" ON "area" USING GIST ("center_point");

-- No additional SQL needed — all new columns are managed by Drizzle schema (db:push).
