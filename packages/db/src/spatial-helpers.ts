/**
 * Spatial helper functions for use WITHOUT PostGIS.
 *
 * Since PostGIS is not available on the DB server, all spatial operations
 * are performed at the application level using:
 * - Haversine formula for distance calculations
 * - Ray-casting algorithm for point-in-polygon tests
 * - SQL-level lat/lng column comparisons for bounding-box pre-filtering
 *
 * Coordinates use WGS 84 (standard GPS): latitude (-90 to 90), longitude (-180 to 180).
 */

import { sql, type SQL } from "drizzle-orm";

// ─── Constants ───

const EARTH_RADIUS_KM = 6371;

// ─── Pure JS Spatial Functions (for application-level use) ───

/**
 * Calculate the distance between two points using the Haversine formula.
 * @returns Distance in kilometers
 */
export function haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}

/**
 * Check if a point is inside a polygon using the ray-casting algorithm.
 *
 * @param lat - Point latitude
 * @param lng - Point longitude
 * @param polygon - Array of [lng, lat] coordinate pairs (GeoJSON format: lng first!)
 * @returns true if the point is inside the polygon
 */
export function pointInPolygon(
    lat: number,
    lng: number,
    polygon: number[][],
): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i]![1]!; // lat
        const yi = polygon[i]![0]!; // lng
        const xj = polygon[j]![1]!; // lat
        const yj = polygon[j]![0]!; // lng

        const intersect =
            yi > lng !== yj > lng &&
            lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;

        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Check if a point is inside a GeoJSON polygon (with coordinate rings).
 * GeoJSON polygons have coordinates as number[][][] (array of rings, each ring is array of [lng, lat]).
 *
 * @param lat - Point latitude
 * @param lng - Point longitude
 * @param polygonCoords - GeoJSON polygon coordinates (number[][][])
 * @returns true if point is inside the polygon's outer ring
 */
export function pointInGeoJSONPolygon(
    lat: number,
    lng: number,
    polygonCoords: number[][][],
): boolean {
    // Use the outer ring (first ring) for containment check
    const outerRing = polygonCoords[0];
    if (!outerRing || outerRing.length === 0) return false;
    return pointInPolygon(lat, lng, outerRing);
}

/**
 * Check if a point is within a given radius of a center point.
 *
 * @param pointLat - Point latitude
 * @param pointLng - Point longitude
 * @param centerLat - Center latitude
 * @param centerLng - Center longitude
 * @param radiusKm - Radius in kilometers
 * @returns true if the point is within the radius
 */
export function isWithinRadius(
    pointLat: number,
    pointLng: number,
    centerLat: number,
    centerLng: number,
    radiusKm: number,
): boolean {
    return haversineDistance(pointLat, pointLng, centerLat, centerLng) <= radiusKm;
}

// ─── SQL-Level Helpers (for Drizzle query pre-filtering) ───

/**
 * SQL bounding box filter for approximate distance pre-filtering.
 * This creates a rectangular bounding box around a point to pre-filter
 * rows before doing exact Haversine calculation in JS.
 *
 * @param latColumn - Name of the latitude column (text type, will be cast to numeric)
 * @param lngColumn - Name of the longitude column (text type, will be cast to numeric)
 * @param centerLat - Center point latitude
 * @param centerLng - Center point longitude
 * @param radiusKm - Radius in km for the bounding box
 * @returns SQL WHERE clause fragment
 */
export function sqlBoundingBox(
    latColumn: string,
    lngColumn: string,
    centerLat: number,
    centerLng: number,
    radiusKm: number,
): SQL {
    // 1 degree of latitude ≈ 111 km
    const latDelta = radiusKm / 111;
    // 1 degree of longitude varies by latitude
    const lngDelta = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));

    const minLat = centerLat - latDelta;
    const maxLat = centerLat + latDelta;
    const minLng = centerLng - lngDelta;
    const maxLng = centerLng + lngDelta;

    return sql`(
    ${sql.identifier(latColumn)}::numeric BETWEEN ${minLat} AND ${maxLat}
    AND ${sql.identifier(lngColumn)}::numeric BETWEEN ${minLng} AND ${maxLng}
  )`;
}

/**
 * SQL Haversine distance calculation.
 * Returns the distance in km between a row's lat/lng columns and a given point.
 * Useful for ORDER BY distance or HAVING distance < X.
 *
 * @param latColumn - Name of the latitude column (text type)
 * @param lngColumn - Name of the longitude column (text type)
 * @param centerLat - Target point latitude
 * @param centerLng - Target point longitude
 * @returns SQL expression evaluating to distance in km
 */
export function sqlHaversineDistance(
    latColumn: string,
    lngColumn: string,
    centerLat: number,
    centerLng: number,
): SQL<number> {
    return sql<number>`(
    ${EARTH_RADIUS_KM} * 2 * ASIN(SQRT(
      POWER(SIN(RADIANS(${sql.identifier(latColumn)}::numeric - ${centerLat}) / 2), 2) +
      COS(RADIANS(${centerLat})) *
      COS(RADIANS(${sql.identifier(latColumn)}::numeric)) *
      POWER(SIN(RADIANS(${sql.identifier(lngColumn)}::numeric - ${centerLng}) / 2), 2)
    ))
  )`;
}
