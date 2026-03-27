/**
 * Open Order Matching Engine
 *
 * Core business logic for the open order system:
 * 1. Split cart items into sub-orders by product category
 * 2. Find eligible sellers (area + distance + stock + OTP load)
 * 3. Create bid records for eligible sellers
 * 4. Select winner (lowest total bid)
 *
 * Used by customer.placeOpenOrder and the timeout handler.
 */

import { db } from "@bikalpo-project/db";
import {
    category,
    inventory,
    openOrderBid,
    openOrderBidItem,
    order,
    orderItem,
    product,
    productVariant,
    sellerAreaMapping,
    user,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, sql, ne } from "drizzle-orm";
import {
    findAreasForPoint,
    calculateSellerDistance,
} from "./location-service";
import { haversineDistance } from "@bikalpo-project/db/spatial-helpers";

// ─── Constants ───

/** Max distance (km) from consumer to eligible seller */
const MAX_DISTANCE_KM = 5;

/** Max pending bids per shop (OTP load cap) */
const MAX_PENDING_BIDS = 2;

/** Default lock timeout in seconds */
export const DEFAULT_LOCK_TIMEOUT_SECONDS = 100;

/** Default broadcast window in minutes */
export const DEFAULT_BROADCAST_MINUTES = 5;

// ─── Types ───

export interface CartItemForSplit {
    productId: number;
    variantId: number | null;
    shopId: string | null;
    productName: string;
    productImage: string;
    productSize: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    categoryId: number | null;
    categoryName: string | null;
}

export interface SubOrderGroup {
    label: string;
    categoryId: number | null;
    items: CartItemForSplit[];
}

export interface EligibleSeller {
    shopId: string;
    shopName: string;
    shopLat: string | null;
    shopLng: string | null;
    distanceKm: number;
    pendingBids: number;
}

// ─── 1. Auto-Split Engine ───

/**
 * Group cart items into sub-orders by product category.
 * Items with the same categoryId go into one sub-order.
 * Items with no category go into an "Other" group.
 */
export function splitCartIntoSubOrders(
    items: CartItemForSplit[],
): SubOrderGroup[] {
    const groups = new Map<string, SubOrderGroup>();

    for (const item of items) {
        const key = item.categoryId ? String(item.categoryId) : "other";
        const label = item.categoryName ?? "Other Items";

        if (!groups.has(key)) {
            groups.set(key, {
                label,
                categoryId: item.categoryId,
                items: [],
            });
        }
        groups.get(key)!.items.push(item);
    }

    return Array.from(groups.values());
}

// ─── 2. Eligible Seller Filter ───

/**
 * Find all shops eligible to bid on a sub-order.
 *
 * Filters applied in order:
 * 1. Area permission: shop is assigned to an area containing the consumer
 * 2. Distance ≤ 5km from consumer
 * 3. Shop is active (not banned)
 * 4. Shop has stock for ALL items in the sub-order
 * 5. OTP load < 2 (fewer than 2 pending/locked bids)
 *
 * Returns sellers ranked by distance ASC, then by pending bids ASC.
 */
export async function findEligibleSellers(
    consumerLat: number,
    consumerLng: number,
    subOrderItems: CartItemForSplit[],
): Promise<EligibleSeller[]> {
    // Step 1: Find areas the consumer is in
    const consumerAreas = await findAreasForPoint(consumerLat, consumerLng);
    const consumerAreaIds = consumerAreas.map((a) => a.areaId);

    // Step 2: Get all active shop owners
    const shopOwners = await db
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

    const eligible: EligibleSeller[] = [];

    for (const shop of shopOwners) {
        // Filter: must have coordinates
        if (!shop.shopLat || !shop.shopLng) continue;

        // Filter: distance ≤ 5km
        const dist = haversineDistance(
            consumerLat,
            consumerLng,
            parseFloat(shop.shopLat),
            parseFloat(shop.shopLng),
        );
        if (dist > MAX_DISTANCE_KM) continue;

        // Filter: area permission (if areas are configured)
        if (consumerAreaIds.length > 0) {
            const sellerMappings = await db
                .select({ areaId: sellerAreaMapping.areaId })
                .from(sellerAreaMapping)
                .where(
                    and(
                        eq(sellerAreaMapping.sellerId, shop.id),
                        eq(sellerAreaMapping.isActive, true),
                    ),
                );

            // If seller has area restrictions, check they overlap with consumer's areas
            if (sellerMappings.length > 0) {
                const sellerAreaIds = sellerMappings.map((m) => m.areaId);
                const hasOverlap = consumerAreaIds.some((id) =>
                    sellerAreaIds.includes(id),
                );
                if (!hasOverlap) continue;
            }
            // If seller has no area mappings, they serve all areas (no restriction)
        }

        // Filter: has stock for ALL items
        let hasAllStock = true;
        for (const item of subOrderItems) {
            if (!item.variantId) continue;

            // Get all variants for this product (shop might stock a different variant)
            const productVars = await db.query.productVariant.findMany({
                where: eq(productVariant.productId, item.productId),
                columns: { id: true },
            });
            const variantIds = productVars.map((v) => v.id);

            if (variantIds.length === 0) {
                hasAllStock = false;
                break;
            }

            const shopInv = await db.query.inventory.findFirst({
                where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, shop.id),
                    inArray(inventory.variantId, variantIds),
                    sql`CAST(${inventory.availableQty} AS numeric) >= ${item.quantity}`,
                ),
            });

            if (!shopInv) {
                hasAllStock = false;
                break;
            }
        }
        if (!hasAllStock) continue;

        // Filter: OTP load < MAX_PENDING_BIDS
        const [pendingCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(openOrderBid)
            .where(
                and(
                    eq(openOrderBid.shopId, shop.id),
                    inArray(openOrderBid.status, ["available", "locked"]),
                ),
            );
        const pending = Number(pendingCount?.count ?? 0);
        if (pending >= MAX_PENDING_BIDS) continue;

        eligible.push({
            shopId: shop.id,
            shopName: shop.shopName ?? shop.name,
            shopLat: shop.shopLat,
            shopLng: shop.shopLng,
            distanceKm: Math.round(dist * 100) / 100,
            pendingBids: pending,
        });
    }

    // Rank: distance ASC, then pending bids ASC
    eligible.sort((a, b) => {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        return a.pendingBids - b.pendingBids;
    });

    return eligible;
}

// ─── 3. Create Bids ───

/**
 * Create bid records for all eligible sellers on a sub-order.
 * Each seller gets a bid with status = 'available'.
 * Also creates bid items with the platform base price for each order item.
 */
export async function createBidsForSubOrder(
    subOrderId: number,
    sellers: EligibleSeller[],
    subOrderItemIds: number[],
): Promise<typeof openOrderBid.$inferSelect[]> {
    if (sellers.length === 0) return [];

    // Get the order items with their prices
    const items = await db.query.orderItem.findMany({
        where: inArray(orderItem.id, subOrderItemIds),
    });

    const createdBids: typeof openOrderBid.$inferSelect[] = [];

    for (let i = 0; i < sellers.length; i++) {
        const seller = sellers[i]!;

        // Create the bid
        const [bid] = await db
            .insert(openOrderBid)
            .values({
                subOrderId,
                shopId: seller.shopId,
                rank: i + 1,
                distanceKm: String(seller.distanceKm),
                status: "available",
                timeoutSeconds: DEFAULT_LOCK_TIMEOUT_SECONDS,
            })
            .returning();

        if (!bid) continue;

        // Create bid items with platform prices
        if (items.length > 0) {
            await db.insert(openOrderBidItem).values(
                items.map((item) => ({
                    bidId: bid.id,
                    orderItemId: item.id,
                    platformPrice: item.unitPrice,
                    sellerPrice: null,
                })),
            );
        }

        createdBids.push(bid);
    }

    return createdBids;
}

// ─── 4. Winner Selection ───

/**
 * Select the winning bid for a sub-order.
 * Picks the submitted bid with the lowest totalBid.
 * Marks it as winner, sets order.shopId, changes order status to confirmed.
 * Marks other bids as 'lost'.
 *
 * Returns the winning bid or null if no submitted bids exist.
 */
export async function selectWinner(
    subOrderId: number,
): Promise<typeof openOrderBid.$inferSelect | null> {
    // Get all submitted bids for this sub-order, ordered by totalBid ASC
    const submittedBids = await db
        .select()
        .from(openOrderBid)
        .where(
            and(
                eq(openOrderBid.subOrderId, subOrderId),
                eq(openOrderBid.status, "submitted"),
            ),
        )
        .orderBy(sql`CAST(${openOrderBid.totalBid} AS numeric) ASC`);

    if (submittedBids.length === 0) return null;

    const winner = submittedBids[0]!;

    await db.transaction(async (tx) => {
        // Mark winner
        await tx
            .update(openOrderBid)
            .set({ isWinner: true })
            .where(eq(openOrderBid.id, winner.id));

        // Mark others as lost
        const loserIds = submittedBids
            .filter((b) => b.id !== winner.id)
            .map((b) => b.id);
        if (loserIds.length > 0) {
            await tx
                .update(openOrderBid)
                .set({ status: "lost" })
                .where(inArray(openOrderBid.id, loserIds));
        }

        // Also mark any remaining available/locked bids as lost
        await tx
            .update(openOrderBid)
            .set({ status: "lost" })
            .where(
                and(
                    eq(openOrderBid.subOrderId, subOrderId),
                    ne(openOrderBid.id, winner.id),
                    inArray(openOrderBid.status, ["available", "locked"]),
                ),
            );

        // Update the sub-order: assign shop + confirm
        await tx
            .update(order)
            .set({
                shopId: winner.shopId,
                status: "confirmed",
            })
            .where(eq(order.id, subOrderId));
    });

    return winner;
}

// ─── 5. Timeout Checker ───

/**
 * Check for expired bids (lazy timeout).
 * Called on poll from consumer/shop.
 * Marks timed-out locked bids as 'expired'.
 * Returns the IDs of expired bids.
 */
export async function checkAndExpireBids(
    subOrderId: number,
): Promise<number[]> {
    const now = new Date();

    // Find locked bids that have exceeded their expiresAt
    const expiredBids = await db
        .select({ id: openOrderBid.id })
        .from(openOrderBid)
        .where(
            and(
                eq(openOrderBid.subOrderId, subOrderId),
                eq(openOrderBid.status, "locked"),
                sql`${openOrderBid.expiresAt} <= ${now}`,
            ),
        );

    const expiredIds = expiredBids.map((b) => b.id);

    if (expiredIds.length > 0) {
        await db
            .update(openOrderBid)
            .set({ status: "expired" })
            .where(inArray(openOrderBid.id, expiredIds));
    }

    return expiredIds;
}

/**
 * Check if the broadcast period has ended for a sub-order.
 * If yes, auto-select the winner or cancel if no bids.
 * Returns the action taken: 'winner_selected' | 'cancelled' | 'still_active'
 */
export async function checkBroadcastExpiry(
    subOrderId: number,
): Promise<"winner_selected" | "cancelled" | "still_active"> {
    const subOrder = await db.query.order.findFirst({
        where: eq(order.id, subOrderId),
        columns: { broadcastExpiresAt: true, status: true },
    });

    if (!subOrder?.broadcastExpiresAt) return "still_active";
    if (new Date() < subOrder.broadcastExpiresAt) return "still_active";
    if (subOrder.status !== "matching_shop" && subOrder.status !== "negotiating") {
        return "still_active";
    }

    // Expire any remaining locked bids
    await checkAndExpireBids(subOrderId);

    // Try to select a winner from submitted bids
    const winner = await selectWinner(subOrderId);
    if (winner) return "winner_selected";

    // No submitted bids — cancel the sub-order
    await db
        .update(order)
        .set({ status: "cancelled" })
        .where(eq(order.id, subOrderId));

    // Mark all remaining bids as lost
    await db
        .update(openOrderBid)
        .set({ status: "lost" })
        .where(
            and(
                eq(openOrderBid.subOrderId, subOrderId),
                inArray(openOrderBid.status, ["available", "locked"]),
            ),
        );

    return "cancelled";
}
