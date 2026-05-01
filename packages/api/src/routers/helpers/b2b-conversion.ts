/**
 * B2B → Retail Inventory Conversion Helper
 *
 * When a B2B order is delivered, this:
 *   1. Deducts warehouse inventory for the TRADE variant
 *   2. Converts to RETAIL variant quantity using conversionRatio & lossPercent
 *   3. Adds to shop owner's retail inventory
 *
 * Flow: Warehouse → Shop (warehouse is the sole stock source)
 *
 * Supply Mode (NEW):
 *   - If order item has supplyMode="pack" + targetVariantId → use shop's choice
 *   - If order item has supplyMode="loose" → find loose RETAIL variant
 *   - Otherwise → fall back to existing conversion map logic (backward compat)
 *
 * Note: Stock ledger writes have been removed — audit trail is handled
 * at the application level if needed in the future.
 */

import {and, eq} from "drizzle-orm";
import {carton, inventory, order, orderItem, product, productVariant, variantConversionMap,} from "@bikalpo-project/db/schema";
import {desc} from "drizzle-orm";

/**
 * Convert B2B order items to retail inventory upon delivery.
 * Must be called inside the delivery transaction.
 */
export async function convertB2bOrderToRetailInventory(
    tx: any,
    orderId: number,
) {
    console.log(`[B2B-CONVERT] Starting conversion for order #${orderId}`);

    // 1. Load the order to check if it's B2B and determine source warehouse
    const orderData = await tx.query.order.findFirst({
        where: eq(order.id, orderId),
        columns: { id: true, userId: true, orderType: true, warehouseId: true },
    });

    if (!orderData || orderData.orderType !== "b2b") {
        console.log(`[B2B-CONVERT] Skipping: orderType=${orderData?.orderType}`);
        return; // Skip non-B2B orders
    }

    if (!orderData.warehouseId) {
        console.warn(`[B2B-CONVERT] No warehouseId on B2B order #${orderId}, skipping`);
        return;
    }

    const sourceOwnerId = orderData.warehouseId;
    console.log(`[B2B-CONVERT] Order is B2B, buyer=${orderData.userId}, warehouse=${sourceOwnerId}`);

    // 2. Load order items
    const items = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, orderId),
    });

    // 3. For each item, find the TRADE variant → convert → update inventory
    for (const item of items) {
        // Resolve variant: use order item's variant, or fall back to product's first variant
        let resolvedVariantId = item.variantId;
        console.log(`[B2B-CONVERT] Item productId=${item.productId}, variantId=${item.variantId}, supplyMode=${item.supplyMode ?? 'legacy'}`);
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

        // Load product to get unitSize (carton/sack total size)
        const productData = await tx.query.product.findFirst({
            where: eq(product.id, item.productId),
            columns: { id: true, unitSize: true },
        });
        const productUnitSize = Number(productData?.unitSize || 0);

        // ─── Determine target variant & conversion ratio ───
        // NEW: Check shop's supplyMode first, then fall back to legacy logic

        let targetRetailVariantId: number;
        let conversionRatio: number;
        let isPackBreakdown = false;
        let conversionSource = "legacy"; // For logging

        const shopSupplyMode = item.supplyMode; // "loose" | "pack" | null (legacy)
        const shopTargetVariantId = item.targetVariantId; // number | null

        if (shopSupplyMode === "pack" && shopTargetVariantId) {
            // ═══ PACK MODE: Shop chose a specific retail variant (e.g. 5KG) ═══
            targetRetailVariantId = shopTargetVariantId;

            const isLooseTrade = (tradeVariant.packType || "").toLowerCase() === "loose";
            const tradeWeightKg = Number(tradeVariant.weightKg || 0);

            if (isLooseTrade) {
                // Loose variant ordered as carton: look up actual carton weight
                const activeCarton = await tx.query.carton.findFirst({
                    where: and(
                        eq(carton.variantId, tradeVariant.id),
                        eq(carton.status, "active"),
                    ),
                    columns: { totalWeightKg: true },
                    orderBy: [desc(carton.createdAt)],
                });

                const cartonWeightKg = Number(activeCarton?.totalWeightKg || 0);
                // Each ordered unit = 1 carton = cartonWeightKg in KG
                conversionRatio = cartonWeightKg > 0 ? cartonWeightKg : 1;
                conversionSource = "loose_carton_weight";
                console.log(`[B2B-CONVERT] Loose carton mode: cartonKg=${cartonWeightKg}, ratio=${conversionRatio} (KG per carton)`);
            } else {
                // Pack variant ordered as carton: use carton weight for ratio
                const targetVariant = await tx.query.productVariant.findFirst({
                    where: eq(productVariant.id, shopTargetVariantId),
                    columns: { id: true, weightKg: true },
                });

                const targetWeightKg = Number(targetVariant?.weightKg || 0);

                // Look up actual carton weight first (e.g. 50 KG per carton)
                const packCarton = await tx.query.carton.findFirst({
                    where: and(
                        eq(carton.variantId, tradeVariant.id),
                        eq(carton.status, "active"),
                    ),
                    columns: { totalWeightKg: true, totalPacks: true },
                    orderBy: [desc(carton.createdAt)],
                });

                const cartonTotalWeightKg = Number(packCarton?.totalWeightKg || 0);
                const cartonTotalPacks = Number(packCarton?.totalPacks || 0);

                if (cartonTotalPacks > 0) {
                    // Best: carton has pack count (e.g. 10 pcs per carton)
                    conversionRatio = cartonTotalPacks;
                    console.log(`[B2B-CONVERT] Pack carton mode: ${cartonTotalPacks} pcs/carton from totalPacks`);
                } else if (cartonTotalWeightKg > 0 && targetWeightKg > 0) {
                    // Fallback: carton weight / pack weight (e.g. 50 KG / 5 KG = 10 pcs)
                    conversionRatio = cartonTotalWeightKg / targetWeightKg;
                    console.log(`[B2B-CONVERT] Pack carton mode: ${cartonTotalWeightKg}KG carton / ${targetWeightKg}KG pack = ${conversionRatio} pcs`);
                } else if (tradeWeightKg > 0 && targetWeightKg > 0) {
                    // Last resort: variant weight ratio
                    conversionRatio = tradeWeightKg / targetWeightKg;
                } else if (productUnitSize > 0 && targetWeightKg > 0) {
                    conversionRatio = productUnitSize / targetWeightKg;
                } else {
                    conversionRatio = Number(tradeVariant.packCountInside || 1);
                }

                isPackBreakdown = true;
                conversionSource = "shop_pack_choice";
                console.log(`[B2B-CONVERT] Pack mode: target=${shopTargetVariantId}, cartonKg=${cartonTotalWeightKg}, cartonPacks=${cartonTotalPacks}, tradeKg=${tradeWeightKg}, targetKg=${targetWeightKg}, ratio=${conversionRatio}`);
            }

        } else if (shopSupplyMode === "loose") {
            // ═══ LOOSE MODE: Shop wants KG added as loose stock ═══
            // Find the loose RETAIL variant for this product
            const looseVariant = await tx.query.productVariant.findFirst({
                where: and(
                    eq(productVariant.productId, tradeVariant.productId),
                    eq(productVariant.packType, "loose"),
                ),
                columns: { id: true },
            });

            targetRetailVariantId = looseVariant?.id ?? tradeVariant.id;

            // For loose: 1 carton = cartonWeightKg in KG
            // Look up actual carton weight from active cartons
            const looseCarton = await tx.query.carton.findFirst({
                where: and(
                    eq(carton.variantId, tradeVariant.id),
                    eq(carton.status, "active"),
                ),
                columns: { totalWeightKg: true },
                orderBy: [desc(carton.createdAt)],
            });

            const looseCartonWeightKg = Number(looseCarton?.totalWeightKg || 0);
            const tradeWeightKg = Number(tradeVariant.weightKg || 0);
            conversionRatio = looseCartonWeightKg > 0
                ? looseCartonWeightKg
                : tradeWeightKg > 0
                    ? tradeWeightKg
                    : productUnitSize > 0
                        ? productUnitSize
                        : 1;

            conversionSource = "shop_loose_choice";
            console.log(`[B2B-CONVERT] Loose mode: target=${targetRetailVariantId}, cartonKg=${looseCartonWeightKg}, tradeKg=${tradeWeightKg}, ratio=${conversionRatio} (KG per unit)`);

        } else {
            // ═══ LEGACY MODE: No supplyMode set — use existing logic ═══
            // Look up conversion rule from variantConversionMap (set by admin UI)
            const conversionMap = await tx.query.variantConversionMap.findFirst({
                where: eq(variantConversionMap.fromVariantId, tradeVariant.id),
            });

            // Use map rule first, then fall back to variant's own fields
            targetRetailVariantId =
                conversionMap?.toVariantId ??
                tradeVariant.linkedRetailVariantId ??
                tradeVariant.id;

            const isLoose = tradeVariant.packType === "loose";
            const packCount = Number(tradeVariant.packCountInside || 0);
            const variantSize = Number(tradeVariant.weightKg || 0);

            if (conversionMap?.conversionRatio) {
                conversionRatio = Number(conversionMap.conversionRatio);
            } else if (tradeVariant.conversionRatio) {
                conversionRatio = Number(tradeVariant.conversionRatio);
            } else if (!isLoose && packCount > 1) {
                conversionRatio = packCount;
                isPackBreakdown = true;
            } else if (!isLoose && productUnitSize > 0 && variantSize > 0 && productUnitSize > variantSize) {
                conversionRatio = productUnitSize / variantSize;
                isPackBreakdown = true;
                console.log(`[B2B-CONVERT] Auto-calc from unitSize: ${productUnitSize}KG / ${variantSize}KG = ${conversionRatio}`);
            } else {
                conversionRatio = 1;
            }

            conversionSource = conversionMap ? "conversion_map" : "variant_fields";
        }

        const lossPercent = Number(tradeVariant.conversionLossPercent || 0);
        const retailQty =
            orderedQty * conversionRatio * (1 - lossPercent / 100);

        // Calculate per-pack price when doing pack breakdown
        const packCount = Number(tradeVariant.packCountInside || 0);
        let effectiveRetailPrice = purchaseUnitPrice;
        if (isPackBreakdown && purchaseUnitPrice && conversionRatio > 1) {
            effectiveRetailPrice = (Number(purchaseUnitPrice) / conversionRatio).toFixed(2);
        }

        console.log(`[B2B-CONVERT] Variant ${tradeVariant.id}: source=${conversionSource}, target=${targetRetailVariantId}, ratio=${conversionRatio}, packBreakdown=${isPackBreakdown}, orderedQty=${orderedQty}, retailQty=${retailQty}, perPackPrice=${effectiveRetailPrice ?? 'N/A'}`);

        // ─── A. Deduct warehouse inventory ───

        const sourceInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, sourceOwnerId),
                eq(inventory.variantId, tradeVariant.id),
            ),
        });

        if (sourceInv) {
            // For loose cartons: deduct in KG (retailQty), not carton count
            const isLooseDeduction = conversionSource === "loose_carton_weight" || conversionSource === "shop_loose_choice";
            const deductQty = isLooseDeduction ? retailQty : orderedQty;
            const newSourceQty = Math.max(
                0,
                Number(sourceInv.availableQty) - deductQty,
            );

            await tx
                .update(inventory)
                .set({
                    availableQty: newSourceQty.toFixed(2),
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, sourceInv.id));
        } else {
            console.warn(`[B2B-CONVERT] No warehouse inventory found for variant ${tradeVariant.id} owner ${sourceOwnerId}`);
        }

        // ─── B. Upsert shop owner's RETAIL inventory ───

        const shopInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "shop"),
                eq(inventory.ownerId, orderData.userId),
                eq(inventory.variantId, targetRetailVariantId),
            ),
        });

        if (shopInv) {
            const updatedQty =
                Number(shopInv.availableQty) + retailQty;

            await tx
                .update(inventory)
                .set({
                    availableQty: updatedQty.toFixed(2),
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, shopInv.id));
        } else {
            // Use per-pack price (after breakdown), or fall back to warehouse's retail_price
            const initialRetailPrice = effectiveRetailPrice
                ?? (sourceInv?.retailPrice ? String(sourceInv.retailPrice) : null);

            await tx.insert(inventory).values({
                ownerType: "shop" as const,
                ownerId: orderData.userId,
                variantId: targetRetailVariantId,
                availableQty: retailQty.toFixed(2),
                reservedQty: "0",
                ...(initialRetailPrice ? { retailPrice: initialRetailPrice } : {}),
            });
        }

        // ─── C. Update order item conversion status ───

        try {
            await tx
                .update(orderItem)
                .set({
                    conversionStatus: "converted",
                    convertedQty: retailQty.toFixed(2),
                })
                .where(eq(orderItem.id, item.id));
        } catch (e) {
            // Graceful: if columns don't exist yet (legacy DB), skip
            console.warn(`[B2B-CONVERT] Could not update conversionStatus for item ${item.id}:`, e);
        }
    }
}
