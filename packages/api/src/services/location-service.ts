/**
 * Location Service — High-level spatial query helpers for the Bikalpo platform.
 *
 * Provides business-logic functions on top of the low-level spatial-helpers:
 * - Find which area(s) a lat/lng point falls into
 * - Find sellers that serve a given area
 * - Calculate distance from a point to a seller
 * - Populate area fields on an order at placement time
 * - Check if a seller is authorised to serve a consumer's area
 *
 * All geometry operations are done in application code (no PostGIS).
 */

import { db } from "@bikalpo-project/db";
import {
    area,
    sellerAreaMapping,
    user,
} from "@bikalpo-project/db/schema";
import {
    haversineDistance,
    pointInGeoJSONPolygon,
    isWithinRadius,
} from "@bikalpo-project/db/spatial-helpers";
import { and, eq, inArray } from "drizzle-orm";

// ─── Types ───

export interface AreaMatch {
    areaId: number;
    areaName: string;
    areaSlug: string;
    matchType: "polygon" | "radius" | "named";
}

export interface SellerWithDistance {
    sellerId: string;
    sellerName: string;
    shopName: string | null;
    shopLat: string | null;
    shopLng: string | null;
    distanceKm: number | null;
}

// ─── Area Lookup ───

/**
 * Find all active areas that contain a given lat/lng point.
 *
 * Checks polygon containment first, then radius-based areas.
 * Returns all matching areas (a point can be in multiple areas).
 */
export async function findAreasForPoint(
    lat: number,
    lng: number,
): Promise<AreaMatch[]> {
    const allAreas = await db.query.area.findMany({
        where: eq(area.isActive, true),
        columns: {
            id: true,
            name: true,
            slug: true,
            polygon: true,
            centerLat: true,
            centerLng: true,
            radiusKm: true,
        },
    });

    const matches: AreaMatch[] = [];

    for (const a of allAreas) {
        // Polygon check
        if (a.polygon && a.polygon.length > 0) {
            if (pointInGeoJSONPolygon(lat, lng, a.polygon)) {
                matches.push({
                    areaId: a.id,
                    areaName: a.name,
                    areaSlug: a.slug,
                    matchType: "polygon",
                });
            }
            continue; // polygon takes priority over radius for the same area
        }

        // Radius check
        if (a.centerLat && a.centerLng && a.radiusKm) {
            const centerLat = parseFloat(a.centerLat);
            const centerLng = parseFloat(a.centerLng);
            const radiusKm = parseFloat(a.radiusKm);

            if (
                !isNaN(centerLat) &&
                !isNaN(centerLng) &&
                !isNaN(radiusKm) &&
                isWithinRadius(lat, lng, centerLat, centerLng, radiusKm)
            ) {
                matches.push({
                    areaId: a.id,
                    areaName: a.name,
                    areaSlug: a.slug,
                    matchType: "radius",
                });
            }
        }
    }

    return matches;
}

/**
 * Find the best matching area for a given lat/lng point.
 * Prefers polygon matches over radius matches.
 * Returns null if no area contains the point.
 */
export async function findBestAreaForPoint(
    lat: number,
    lng: number,
): Promise<AreaMatch | null> {
    const matches = await findAreasForPoint(lat, lng);
    if (matches.length === 0) return null;

    // Prefer polygon matches
    const polygonMatch = matches.find((m) => m.matchType === "polygon");
    return polygonMatch || matches[0]!;
}

// ─── Seller Lookup ───

/**
 * Find all sellers assigned to a given area.
 * Returns seller info with optional distance from a reference point.
 */
export async function getSellersForArea(
    areaId: number,
    refLat?: number,
    refLng?: number,
): Promise<SellerWithDistance[]> {
    // Find active seller mappings for this area
    const mappings = await db
        .select({
            sellerId: sellerAreaMapping.sellerId,
        })
        .from(sellerAreaMapping)
        .where(
            and(
                eq(sellerAreaMapping.areaId, areaId),
                eq(sellerAreaMapping.isActive, true),
            ),
        );

    if (mappings.length === 0) return [];

    // Get seller details
    const sellerIds = mappings.map((m) => m.sellerId);
    const sellers = await db
        .select({
            id: user.id,
            name: user.name,
            shopName: user.shopName,
            shopLat: user.shopLat,
            shopLng: user.shopLng,
        })
        .from(user)
        .where(inArray(user.id, sellerIds));

    return sellers.map((s) => {
        let distanceKm: number | null = null;
        if (
            refLat !== undefined &&
            refLng !== undefined &&
            s.shopLat &&
            s.shopLng
        ) {
            distanceKm = haversineDistance(
                refLat,
                refLng,
                parseFloat(s.shopLat),
                parseFloat(s.shopLng),
            );
            distanceKm = Math.round(distanceKm * 100) / 100;
        }
        return {
            sellerId: s.id,
            sellerName: s.name,
            shopName: s.shopName,
            shopLat: s.shopLat,
            shopLng: s.shopLng,
            distanceKm,
        };
    });
}

/**
 * Find all sellers reachable from a given lat/lng.
 * A seller is reachable if:
 *  1. They are assigned to an area that contains the point, OR
 *  2. Their shop is within a default proximity radius
 */
export async function findSellersNearPoint(
    lat: number,
    lng: number,
    defaultProximityKm = 10,
): Promise<SellerWithDistance[]> {
    // Strategy 1: area-based matching
    const areas = await findAreasForPoint(lat, lng);
    const sellersFromAreas: SellerWithDistance[] = [];

    for (const areaMatch of areas) {
        const sellers = await getSellersForArea(areaMatch.areaId, lat, lng);
        for (const s of sellers) {
            // Deduplicate
            if (!sellersFromAreas.find((x) => x.sellerId === s.sellerId)) {
                sellersFromAreas.push(s);
            }
        }
    }

    // Strategy 2: proximity-based fallback (sellers with shop coordinates)
    if (sellersFromAreas.length === 0) {
        const allShopOwners = await db
            .select({
                id: user.id,
                name: user.name,
                shopName: user.shopName,
                shopLat: user.shopLat,
                shopLng: user.shopLng,
            })
            .from(user)
            .where(
                and(
                    eq(user.role, "shop_owner"),
                    eq(user.banned, false),
                ),
            );

        for (const s of allShopOwners) {
            if (s.shopLat && s.shopLng) {
                const dist = haversineDistance(
                    lat,
                    lng,
                    parseFloat(s.shopLat),
                    parseFloat(s.shopLng),
                );
                if (dist <= defaultProximityKm) {
                    sellersFromAreas.push({
                        sellerId: s.id,
                        sellerName: s.name,
                        shopName: s.shopName,
                        shopLat: s.shopLat,
                        shopLng: s.shopLng,
                        distanceKm: Math.round(dist * 100) / 100,
                    });
                }
            }
        }
    }

    // Sort by distance
    return sellersFromAreas.sort((a, b) => {
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
    });
}

// ─── Order Area Population ───

/**
 * Compute the area-related fields for an order based on consumer location.
 * Called during order placement to populate consumerAreaId, matchedAreaId,
 * locationLat, locationLng.
 */
export async function computeOrderAreaFields(
    consumerLat: number | null | undefined,
    consumerLng: number | null | undefined,
): Promise<{
    consumerAreaId: number | null;
    matchedAreaId: number | null;
    locationLat: string | null;
    locationLng: string | null;
}> {
    const result = {
        consumerAreaId: null as number | null,
        matchedAreaId: null as number | null,
        locationLat: consumerLat != null ? String(consumerLat) : null,
        locationLng: consumerLng != null ? String(consumerLng) : null,
    };

    if (consumerLat == null || consumerLng == null) return result;

    const bestArea = await findBestAreaForPoint(consumerLat, consumerLng);
    if (bestArea) {
        result.consumerAreaId = bestArea.areaId;
        result.matchedAreaId = bestArea.areaId;
    }

    return result;
}

// ─── Seller Area Permission ───

/**
 * Check if a seller is authorized to serve a given area.
 */
export async function isSellerAuthorizedForArea(
    sellerId: string,
    areaId: number,
): Promise<boolean> {
    const mapping = await db.query.sellerAreaMapping.findFirst({
        where: and(
            eq(sellerAreaMapping.sellerId, sellerId),
            eq(sellerAreaMapping.areaId, areaId),
            eq(sellerAreaMapping.isActive, true),
        ),
    });
    return !!mapping;
}

/**
 * Check if a seller is authorized to serve a consumer at a given lat/lng.
 * Returns true if the consumer is in any area the seller is assigned to.
 */
export async function isSellerAuthorizedForPoint(
    sellerId: string,
    lat: number,
    lng: number,
): Promise<boolean> {
    // Get seller's areas
    const sellerMappings = await db
        .select({ areaId: sellerAreaMapping.areaId })
        .from(sellerAreaMapping)
        .where(
            and(
                eq(sellerAreaMapping.sellerId, sellerId),
                eq(sellerAreaMapping.isActive, true),
            ),
        );

    if (sellerMappings.length === 0) return true; // No area restrictions

    // Get the area details
    const areaIds = sellerMappings.map((m) => m.areaId);
    const sellerAreas = await db.query.area.findMany({
        where: and(inArray(area.id, areaIds), eq(area.isActive, true)),
    });

    // Check if the point falls in any of the seller's areas
    for (const a of sellerAreas) {
        if (a.polygon && a.polygon.length > 0) {
            if (pointInGeoJSONPolygon(lat, lng, a.polygon)) return true;
        }
        if (a.centerLat && a.centerLng && a.radiusKm) {
            if (
                isWithinRadius(
                    lat,
                    lng,
                    parseFloat(a.centerLat),
                    parseFloat(a.centerLng),
                    parseFloat(a.radiusKm),
                )
            )
                return true;
        }
    }

    return false;
}

// ─── Distance Helpers ───

/**
 * Calculate distance between a consumer and a seller.
 * Returns distance in km or null if coordinates are missing.
 */
export function calculateSellerDistance(
    consumerLat: number | string | null,
    consumerLng: number | string | null,
    sellerLat: number | string | null,
    sellerLng: number | string | null,
): number | null {
    if (!consumerLat || !consumerLng || !sellerLat || !sellerLng) return null;

    const cLat = typeof consumerLat === "string" ? parseFloat(consumerLat) : consumerLat;
    const cLng = typeof consumerLng === "string" ? parseFloat(consumerLng) : consumerLng;
    const sLat = typeof sellerLat === "string" ? parseFloat(sellerLat) : sellerLat;
    const sLng = typeof sellerLng === "string" ? parseFloat(sellerLng) : sellerLng;

    if (isNaN(cLat) || isNaN(cLng) || isNaN(sLat) || isNaN(sLng)) return null;

    return Math.round(haversineDistance(cLat, cLng, sLat, sLng) * 100) / 100;
}
