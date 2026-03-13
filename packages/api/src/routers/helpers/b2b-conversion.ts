/**
 * B2B → Retail Inventory Conversion Helper
 *
 * When a B2B order is delivered, this:
 *   1. Deducts super-seller (admin) inventory for the TRADE variant
 *   2. Converts to RETAIL variant quantity using conversionRatio & lossPercent
 *   3. Adds to shop owner's retail inventory
 *   4. Writes immutable stock ledger entries for full audit trail
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

    // 1. Load the order to check if it's B2B
    const orderData = await tx.query.order.findFirst({
        where: eq(order.id, orderId),
        columns: { id: true, userId: true, orderType: true },
    });

    if (!orderData || orderData.orderType !== "b2b") {
        console.log(`[B2B-CONVERT] Skipping: orderType=${orderData?.orderType}`);
        return; // Skip non-B2B orders
    }
    console.log(`[B2B-CONVERT] Order is B2B, userId=${orderData.userId}`);

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

        // ─── A. Deduct super-seller (admin) inventory for the TRADE variant ───

        const superSellerInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "super_seller"),
                eq(inventory.variantId, tradeVariant.id),
            ),
        });

        if (superSellerInv) {
            const newSuperSellerQty = Math.max(
                0,
                Number(superSellerInv.availableQty) - orderedQty,
            );

            await tx
                .update(inventory)
                .set({
                    availableQty: newSuperSellerQty.toFixed(2),
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, superSellerInv.id));

            // Ledger: OUT — stock dispatched from super-seller
            await tx.insert(stockLedger).values({
                variantId: tradeVariant.id,
                ownerType: "super_seller",
                ownerId: superSellerInv.ownerId,
                changeType: "out" as const,
                qty: orderedQty.toFixed(2),
                reason: `B2B order #${orderId} delivered to shop`,
                referenceType: "order" as const,
                referenceId: String(orderId),
                balanceAfter: newSuperSellerQty.toFixed(2),
            });

            // Ledger: CONVERT_OUT — TRADE stock consumed for conversion
            await tx.insert(stockLedger).values({
                variantId: tradeVariant.id,
                ownerType: "super_seller",
                ownerId: superSellerInv.ownerId,
                changeType: "convert_out" as const,
                qty: orderedQty.toFixed(2),
                reason: `Converted to retail for order #${orderId}`,
                referenceType: "conversion" as const,
                referenceId: String(orderId),
                balanceAfter: newSuperSellerQty.toFixed(2),
            });
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
            reason: `B2B order #${orderId} converted TRADE→RETAIL (ratio: ${conversionRatio}, loss: ${lossPercent}%)`,
            referenceType: "conversion" as const,
            referenceId: String(orderId),
            balanceAfter: newShopBalance,
        });
    }
}
