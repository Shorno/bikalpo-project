/**
 * PostGIS spatial helper functions for use with Drizzle ORM.
 *
 * These wrap common PostGIS operations as raw SQL fragments
 * that can be used in Drizzle's `sql` template tag.
 *
 * All functions assume SRID 4326 (WGS 84 — standard GPS coordinates).
 * Distance functions use geography cast for meter-accurate results.
 */

import { sql } from "drizzle-orm";

/**
 * Create a PostGIS Point from longitude and latitude.
 * Note: PostGIS uses (lng, lat) order, not (lat, lng).
 */
export function stMakePoint(lng: number, lat: number) {
    return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;
}

/**
 * Check if a point is inside a polygon.
 * Returns true if the point (lng, lat) is contained within the geometry column.
 *
 * @param geometryColumn — The polygon geometry column (e.g., area.boundary)
 * @param lng — Longitude of the point
 * @param lat — Latitude of the point
 */
export function stContains(geometryColumn: ReturnType<typeof sql>, lng: number, lat: number) {
    return sql`ST_Contains(${geometryColumn}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))`;
}

/**
 * Check if two geometries are within a specified distance (in meters).
 * Uses geography cast for accurate meter-based distance on the Earth's surface.
 *
 * @param geomA — First geometry column or expression
 * @param geomB — Second geometry column or expression
 * @param meters — Maximum distance in meters
 */
export function stDWithin(
    geomA: ReturnType<typeof sql>,
    geomB: ReturnType<typeof sql>,
    meters: number,
) {
    return sql`ST_DWithin(${geomA}::geography, ${geomB}::geography, ${meters})`;
}

/**
 * Calculate the distance between two geometries in meters.
 * Uses geography cast for accurate results.
 *
 * @param geomA — First geometry column or expression
 * @param geomB — Second geometry column or expression
 * @returns Distance in meters
 */
export function stDistance(
    geomA: ReturnType<typeof sql>,
    geomB: ReturnType<typeof sql>,
) {
    return sql<number>`ST_Distance(${geomA}::geography, ${geomB}::geography)`;
}

/**
 * Find the area that contains a given point.
 * Useful for determining which service area a consumer is in.
 *
 * Usage with Drizzle:
 * ```
 * const result = await db
 *   .select()
 *   .from(area)
 *   .where(stContainsPoint("boundary", lng, lat))
 *   .limit(1);
 * ```
 */
export function stContainsPoint(boundaryColumnName: string, lng: number, lat: number) {
    return sql`ST_Contains(${sql.identifier(boundaryColumnName)}, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))`;
}

/**
 * Find all records within a radius (in km) of a point.
 * Converts km to meters internally.
 *
 * @param geometryColumnName — Name of the geometry column
 * @param lng — Center point longitude
 * @param lat — Center point latitude
 * @param radiusKm — Radius in kilometers
 */
export function stWithinRadius(
    geometryColumnName: string,
    lng: number,
    lat: number,
    radiusKm: number,
) {
    const meters = radiusKm * 1000;
    return sql`ST_DWithin(
    ${sql.identifier(geometryColumnName)}::geography,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
    ${meters}
  )`;
}

/**
 * Calculate distance in km between a geometry column and a point.
 *
 * @param geometryColumnName — Name of the geometry column
 * @param lng — Point longitude
 * @param lat — Point latitude
 * @returns Distance in kilometers (as SQL expression)
 */
export function stDistanceKm(
    geometryColumnName: string,
    lng: number,
    lat: number,
) {
    return sql<number>`(ST_Distance(
    ${sql.identifier(geometryColumnName)}::geography,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
  ) / 1000.0)`;
}

/**
 * Convert a GeoJSON polygon object to a PostGIS geometry.
 * Useful when receiving polygon data from the frontend (Leaflet).
 *
 * @param geoJson — GeoJSON string (e.g., from Leaflet's toGeoJSON())
 */
export function stFromGeoJSON(geoJson: string) {
    return sql`ST_SetSRID(ST_GeomFromGeoJSON(${geoJson}), 4326)`;
}

/**
 * Convert a PostGIS geometry to GeoJSON string.
 * Useful when sending polygon data to the frontend.
 *
 * @param geometryColumn — The geometry column to convert
 */
export function stAsGeoJSON(geometryColumn: ReturnType<typeof sql>) {
    return sql<string>`ST_AsGeoJSON(${geometryColumn})`;
}
