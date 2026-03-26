/**
 * B2B → Retail Inventory Conversion Helper
 *
 * When a B2B order is delivered, this:
 *   1. Deducts source inventory (warehouse or super_seller) for the TRADE variant
 *   2. Converts to RETAIL variant quantity using conversionRatio & lossPercent
 *   3. Adds to shop owner's retail inventory
 *   4. Writes immutable stock ledger entries for full audit trail
 *
 * Supports both flows:
 *   - Warehouse → Shop (order.warehouseId is set)
 *   - Super Seller → Shop (fallback when no warehouseId)
 */

import { and, eq } from "drizzle-orm";
import {
    order,
    orderItem,
    productVariant,
    inventory,
    stockLedger,
} from "@bikalpo-project/db/schema";

/**
 * Convert B2B order items to retail inventory upon delivery.
 * Must be called inside the delivery transaction.
 */
export async function convertB2bOrderToRetailInventory(
    tx: any,
    orderId: number,
) {
    console.log(`[B2B-CONVERT] Starting conversion for order #${orderId}`);

    // 1. Load the order to check if it's B2B and determine source
    const orderData = await tx.query.order.findFirst({
        where: eq(order.id, orderId),
        columns: { id: true, userId: true, orderType: true, warehouseId: true },
    });

    if (!orderData || orderData.orderType !== "b2b") {
        console.log(`[B2B-CONVERT] Skipping: orderType=${orderData?.orderType}`);
        return; // Skip non-B2B orders
    }

    // Determine source inventory owner type and ID
    const sourceOwnerType: "warehouse" | "super_seller" = orderData.warehouseId
        ? "warehouse"
        : "super_seller";
    const sourceOwnerId: string | null = orderData.warehouseId ?? null;
    const sourceLabel = sourceOwnerType === "warehouse" ? "warehouse" : "super-seller";

    console.log(`[B2B-CONVERT] Order is B2B, buyer=${orderData.userId}, source=${sourceLabel} (${sourceOwnerId ?? "any"})`);

    // 2. Load order items
    const items = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, orderId),
    });

    // 3. For each item, find the TRADE variant → convert → update inventory + ledger
    for (const item of items) {
        // Resolve variant: use order item's variant, or fall back to product's first variant
        let resolvedVariantId = item.variantId;
        console.log(`[B2B-CONVERT] Item productId=${item.productId}, variantId=${item.variantId}`);
        if (!resolvedVariantId) {
            const firstVariant = await tx.query.productVariant.findFirst({
                where: eq(productVariant.productId, item.productId),
                columns: { id: true },
            });
            console.log(`[B2B-CONVERT] No variantId, fallback variant=${firstVariant?.id ?? 'NONE'}`);
            if (!firstVariant) continue; // No variant exists for this product, skip
            resolvedVariantId = firstVariant.id;
        }

        const tradeVariant = await tx.query.productVariant.findFirst({
            where: eq(productVariant.id, resolvedVariantId),
            columns: {
                id: true,
                variantType: true,
                linkedRetailVariantId: true,
                conversionRatio: true,
                conversionLossPercent: true,
            },
        });

        if (!tradeVariant) continue;

        const orderedQty = Number(item.quantity);
        const targetRetailVariantId =
            tradeVariant.linkedRetailVariantId ?? tradeVariant.id;
        const conversionRatio = Number(tradeVariant.conversionRatio || 1);
        const lossPercent = Number(tradeVariant.conversionLossPercent || 0);
        const retailQty =
            orderedQty * conversionRatio * (1 - lossPercent / 100);

        // ─── A. Deduct source inventory (warehouse or super_seller) ───

        // Build query conditions for source inventory lookup
        const sourceConditions = [
            eq(inventory.ownerType, sourceOwnerType),
            eq(inventory.variantId, tradeVariant.id),
        ];
        // If we know the specific owner (warehouse), filter by ownerId too
        if (sourceOwnerId) {
            sourceConditions.push(eq(inventory.ownerId, sourceOwnerId));
        }

        const sourceInv = await tx.query.inventory.findFirst({
            where: and(...sourceConditions),
        });

        if (sourceInv) {
            const newSourceQty = Math.max(
                0,
                Number(sourceInv.availableQty) - orderedQty,
            );

            await tx
                .update(inventory)
                .set({
                    availableQty: newSourceQty.toFixed(2),
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, sourceInv.id));

            // Ledger: OUT — stock dispatched from source
            await tx.insert(stockLedger).values({
                variantId: tradeVariant.id,
                ownerType: sourceOwnerType,
                ownerId: sourceInv.ownerId,
                changeType: "out" as const,
                qty: orderedQty.toFixed(2),
                reason: `B2B order #${orderId} delivered to shop (from ${sourceLabel})`,
                referenceType: "order" as const,
                referenceId: String(orderId),
                balanceAfter: newSourceQty.toFixed(2),
            });

            // Ledger: CONVERT_OUT — TRADE stock consumed for conversion
            await tx.insert(stockLedger).values({
                variantId: tradeVariant.id,
                ownerType: sourceOwnerType,
                ownerId: sourceInv.ownerId,
                changeType: "convert_out" as const,
                qty: orderedQty.toFixed(2),
                reason: `Converted to retail for order #${orderId} (from ${sourceLabel})`,
                referenceType: "conversion" as const,
                referenceId: String(orderId),
                balanceAfter: newSourceQty.toFixed(2),
            });
        } else {
            console.warn(`[B2B-CONVERT] No ${sourceLabel} inventory found for variant ${tradeVariant.id}${sourceOwnerId ? ` owner ${sourceOwnerId}` : ""}`);
        }

        // ─── B. Upsert shop owner's RETAIL inventory ───

        const shopInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "shop"),
                eq(inventory.ownerId, orderData.userId),
                eq(inventory.variantId, targetRetailVariantId),
            ),
        });

        let newShopBalance: string;

        if (shopInv) {
            const updatedQty =
                Number(shopInv.availableQty) + retailQty;
            newShopBalance = updatedQty.toFixed(2);

            await tx
                .update(inventory)
                .set({
                    availableQty: newShopBalance,
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, shopInv.id));
        } else {
            newShopBalance = retailQty.toFixed(2);

            await tx.insert(inventory).values({
                ownerType: "shop" as const,
                ownerId: orderData.userId,
                variantId: targetRetailVariantId,
                availableQty: newShopBalance,
                reservedQty: "0",
            });
        }

        // Ledger: CONVERT_IN — RETAIL stock gained by shop owner
        await tx.insert(stockLedger).values({
            variantId: targetRetailVariantId,
            ownerType: "shop",
            ownerId: orderData.userId,
            changeType: "convert_in" as const,
            qty: retailQty.toFixed(2),
            reason: `B2B order #${orderId} converted TRADE→RETAIL (ratio: ${conversionRatio}, loss: ${lossPercent}%, from ${sourceLabel})`,
            referenceType: "conversion" as const,
            referenceId: String(orderId),
            balanceAfter: newShopBalance,
        });
    }
}
