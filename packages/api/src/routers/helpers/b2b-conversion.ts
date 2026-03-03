/**
 * B2B → Retail Inventory Conversion Helper
 *
 * When a B2B order is delivered, this converts the purchased TRADE variant
 * quantities into RETAIL variant inventory for the shop owner.
 *
 * Flow:
 *   1. Load order items with their variant info
 *   2. For each TRADE variant with a linkedRetailVariantId:
 *      - Calculate retail qty = ordered qty × conversionRatio × (1 - lossPercent/100)
 *      - Upsert into inventory (ownerType='shop', ownerId=order.userId)
 */

import { and, eq, sql } from "drizzle-orm";
import {
    order,
    orderItem,
    productVariant,
    inventory,
} from "@bikalpo-project/db/schema";

/**
 * Convert B2B order items to retail inventory upon delivery.
 * Must be called inside the delivery transaction.
 */
export async function convertB2bOrderToRetailInventory(
    tx: any,
    orderId: number,
) {
    // 1. Load the order to check if it's B2B
    const orderData = await tx.query.order.findFirst({
        where: eq(order.id, orderId),
        columns: { id: true, userId: true, orderType: true },
    });

    if (!orderData || orderData.orderType !== "b2b") {
        return; // Skip non-B2B orders
    }

    // 2. Load order items
    const items = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, orderId),
    });

    // 3. For each item, find the TRADE variant → check for linked RETAIL variant
    for (const item of items) {
        if (!item.variantId) continue;

        const tradeVariant = await tx.query.productVariant.findFirst({
            where: eq(productVariant.id, item.variantId),
            columns: {
                id: true,
                variantType: true,
                linkedRetailVariantId: true,
                conversionRatio: true,
                conversionLossPercent: true,
            },
        });

        if (!tradeVariant) continue;

        // Determine target retail variant
        const retailVariantId = tradeVariant.linkedRetailVariantId;

        // If no linked retail variant, use the same variant (direct inventory add)
        const targetVariantId = retailVariantId ?? tradeVariant.id;

        // Calculate conversion
        const conversionRatio = Number(tradeVariant.conversionRatio || 1);
        const lossPercent = Number(tradeVariant.conversionLossPercent || 0);
        const rawQty = item.quantity * conversionRatio;
        const retailQty = rawQty * (1 - lossPercent / 100);

        // 4. Upsert into inventory for the shop owner
        const existing = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "shop"),
                eq(inventory.ownerId, orderData.userId),
                eq(inventory.variantId, targetVariantId),
            ),
        });

        if (existing) {
            // Add to existing stock
            await tx
                .update(inventory)
                .set({
                    availableQty: sql`(${inventory.availableQty}::numeric + ${retailQty.toFixed(2)}::numeric)::text`,
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, existing.id));
        } else {
            // Create new inventory record
            await tx.insert(inventory).values({
                ownerType: "shop" as const,
                ownerId: orderData.userId,
                variantId: targetVariantId,
                availableQty: retailQty.toFixed(2),
                reservedQty: "0",
            });
        }
    }
}
