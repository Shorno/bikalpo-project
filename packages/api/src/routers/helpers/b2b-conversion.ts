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
    variantConversionMap,
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
                productId: true,
                variantType: true,
                linkedRetailVariantId: true,
                conversionRatio: true,
                conversionLossPercent: true,
                brandId: true,
                packCountInside: true,
                innerPackSizeKg: true,
                weightKg: true,
                packType: true,
            },
        });

        if (!tradeVariant) continue;

        const orderedQty = Number(item.quantity);
        const purchaseUnitPrice = item.unitPrice ? String(item.unitPrice) : null;

        // Look up conversion rule from variantConversionMap (set by admin UI)
        const conversionMap = await tx.query.variantConversionMap.findFirst({
            where: eq(variantConversionMap.fromVariantId, tradeVariant.id),
        });

        // Use map rule first, then fall back to variant's own fields
        let targetRetailVariantId =
            conversionMap?.toVariantId ??
            tradeVariant.linkedRetailVariantId ??
            tradeVariant.id;

        // Brand-aware conversion: if the target retail variant doesn't match
        // the trade variant's brand, try to find a matching retail variant
        // with the same brand + same product
        if (tradeVariant.brandId && targetRetailVariantId !== tradeVariant.id) {
            const targetRetailVariant = await tx.query.productVariant.findFirst({
                where: eq(productVariant.id, targetRetailVariantId),
                columns: { id: true, brandId: true, productId: true, packType: true, weightKg: true },
            });

            if (targetRetailVariant && targetRetailVariant.brandId !== tradeVariant.brandId) {
                // Try to find a retail variant with matching brand + same pack type + same weight
                const brandMatchedRetail = await tx.query.productVariant.findFirst({
                    where: and(
                        eq(productVariant.productId, targetRetailVariant.productId),
                        eq(productVariant.brandId, tradeVariant.brandId),
                        eq(productVariant.variantType, "retail"),
                        eq(productVariant.isActive, true),
                    ),
                    columns: { id: true },
                });

                if (brandMatchedRetail) {
                    targetRetailVariantId = brandMatchedRetail.id;
                    console.log(`[B2B-CONVERT] Brand-aware: switched to variant ${brandMatchedRetail.id} matching brand ${tradeVariant.brandId}`);
                }
            }
        }

        // ─── Determine conversion ratio ───
        // Priority: conversionMap > variant.conversionRatio > packCountInside > 1
        // IMPORTANT: Loose products (packType='loose') skip packCountInside conversion.
        // They are sold as-is (by weight), only cartons/sacks should be broken down.
        const isLoose = tradeVariant.packType === "loose";
        const packCount = Number(tradeVariant.packCountInside || 0);
        let conversionRatio: number;
        let isPackBreakdown = false;

        if (conversionMap?.conversionRatio) {
            conversionRatio = Number(conversionMap.conversionRatio);
        } else if (tradeVariant.conversionRatio) {
            conversionRatio = Number(tradeVariant.conversionRatio);
        } else if (!isLoose && packCount > 1) {
            // Auto-convert using pack breakdown: 1 Carton = packCountInside inner packs
            // Skipped for loose products — they pass through at 1:1
            conversionRatio = packCount;
            isPackBreakdown = true;
        } else {
            conversionRatio = 1;
        }

        const lossPercent = Number(tradeVariant.conversionLossPercent || 0);
        const retailQty =
            orderedQty * conversionRatio * (1 - lossPercent / 100);

        // Calculate per-pack price when doing pack breakdown
        let effectiveRetailPrice = purchaseUnitPrice;
        if (isPackBreakdown && purchaseUnitPrice && packCount > 1) {
            const perPackPrice = (Number(purchaseUnitPrice) / packCount).toFixed(2);
            effectiveRetailPrice = perPackPrice;
        }

        console.log(`[B2B-CONVERT] Variant ${tradeVariant.id}: map=${conversionMap ? 'YES' : 'NO'}, target=${targetRetailVariantId}, ratio=${conversionRatio}, packBreakdown=${isPackBreakdown}, brand=${tradeVariant.brandId ?? 'none'}, orderedQty=${orderedQty}, retailQty=${retailQty}, perPackPrice=${effectiveRetailPrice ?? 'N/A'}`);

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

            // Use per-pack price (after breakdown), or fall back to warehouse's retail_price
            const initialRetailPrice = effectiveRetailPrice
                ?? (sourceInv?.retailPrice ? String(sourceInv.retailPrice) : null);

            await tx.insert(inventory).values({
                ownerType: "shop" as const,
                ownerId: orderData.userId,
                variantId: targetRetailVariantId,
                availableQty: newShopBalance,
                reservedQty: "0",
                ...(initialRetailPrice ? { retailPrice: initialRetailPrice } : {}),
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
