/**
 * B2B → Retail Inventory Conversion Helper
 *
 * When a B2B buyer confirms receipt, this:
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

import {
    isContainerFulfillmentMode,
    isDirectFulfillmentMode,
    usesWeightPoolFulfillmentMode,
    type FulfillmentMode,
} from "@bikalpo-project/db/fulfillment";
import {
    areVariantOptionsStructurallyCompatible,
    resolveVariantOperations,
} from "@bikalpo-project/db/variant-definition";
import {
    carton,
    inventory,
    invoice,
    order,
    orderItem,
    product,
    productVariant,
    user,
    variantConversionMap,
} from "@bikalpo-project/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { assertCompatibleB2bTargetVariant, getReceivedRetailerQty } from "./b2b-inventory-movement";
import {
    assertInventoryVariantOwnedBy,
    ensureShopBuyerTargetVariant,
    ensureWarehouseBuyerTargetVariant,
} from "./b2b-buyer-target";

/** Seller reserved stock is owned by consumeB2bOrderReservations once it has run. */
export function shouldDeductWarehouseSellerStock(order: {
    sellerStockConsumedAt?: Date | string | null;
}) {
    return !order.sellerStockConsumedAt;
}

/**
 * Convert B2B order items to retail inventory upon confirmed receipt.
 * Must be called inside the receipt transaction.
 */
export async function convertB2bOrderToRetailInventory(tx: any, orderId: number) {
    console.log(`[B2B-CONVERT] Starting conversion for order #${orderId}`);

    // 1. Load the order to check if it's B2B and determine source warehouse
    const orderData = await tx.query.order.findFirst({
        where: eq(order.id, orderId),
        columns: {
            id: true,
            userId: true,
            orderType: true,
            warehouseId: true,
            sellerStockConsumedAt: true,
        },
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
    const allItems = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, orderId),
    });

    // ─── IDEMPOTENCY GUARD ───
    // Receipt can be completed through the retailer or verified self-pickup path.
    // Skip items already converted to prevent double-counting inventory.
    const items = allItems.filter((item: any) => item.conversionStatus !== "converted");

    if (items.length === 0) {
        console.log(`[B2B-CONVERT] All items already converted for order #${orderId}, skipping`);
        return;
    }

    console.log(
        `[B2B-CONVERT] Converting ${items.length}/${allItems.length} items (${allItems.length - items.length} already converted)`,
    );

    const buyer = await tx.query.user.findFirst({
        where: eq(user.id, orderData.userId),
        columns: { id: true, role: true },
    });

    if (buyer?.role === "warehouse") {
        await transferB2bOrderToWarehouseInventory(tx, {
            buyerWarehouseId: orderData.userId,
            supplierWarehouseId: sourceOwnerId,
            items,
            deductSellerStock: shouldDeductWarehouseSellerStock(orderData),
        });
        return;
    }

    // 3. For each item, find the TRADE variant → convert → update inventory
    for (const item of items) {
        const claimed = await tx
            .update(orderItem)
            .set({ conversionStatus: "converting" })
            .where(
                and(
                    eq(orderItem.id, item.id),
                    sql`coalesce(${orderItem.conversionStatus}, 'pending') NOT IN ('converting', 'converted')`,
                ),
            )
            .returning({ id: orderItem.id });
        if (claimed.length === 0) continue;

        // Resolve variant: use order item's variant, or fall back to product's first variant
        let resolvedVariantId = item.variantId;
        console.log(
            `[B2B-CONVERT] Item productId=${item.productId}, variantId=${item.variantId}, supplyMode=${item.supplyMode ?? "legacy"}`,
        );
        if (!resolvedVariantId) {
            const firstVariant = await tx.query.productVariant.findFirst({
                where: eq(productVariant.productId, item.productId),
                columns: { id: true },
            });
            console.log(`[B2B-CONVERT] No variantId, fallback variant=${firstVariant?.id ?? "NONE"}`);
            if (!firstVariant) {
                throw new Error(`No source variant exists for order item ${item.id}`);
            }
            resolvedVariantId = firstVariant.id;
        }

        const tradeVariant = await tx.query.productVariant.findFirst({
            where: eq(productVariant.id, resolvedVariantId),
            columns: {
                id: true,
                productId: true,
                variantType: true,
                linkedRetailVariantId: true,
                catalogVariantId: true,
                conversionRatio: true,
                conversionLossPercent: true,
                brandId: true,
                packCountInside: true,
                innerPackSizeKg: true,
                weightKg: true,
            },
            with: {
                sourceVariantOption: true,
                catalogVariant: {
                    columns: { conversionTargetCatalogVariantId: true },
                },
            },
        });

        if (!tradeVariant) {
            throw new Error(`Source variant ${resolvedVariantId} was not found`);
        }
        if (!tradeVariant.sourceVariantOption) {
            throw new Error("Source variant is missing its Admin Variant definition");
        }
        const sourceOperations = resolveVariantOperations(tradeVariant.sourceVariantOption);

        const orderedQty = Number(item.modifiedQty ?? item.quantity);
        const purchaseUnitPrice = item.modifiedUnitPrice
            ? String(item.modifiedUnitPrice)
            : item.unitPrice
              ? String(item.unitPrice)
              : null;

        // Load product to get unitSize (carton/sack total size)
        const productData = await tx.query.product.findFirst({
            where: eq(product.id, item.productId),
            columns: {
                id: true,
                brandId: true,
                coreProductId: true,
            },
            with: {
                category: {
                    columns: { id: true, name: true, slug: true },
                    with: {
                        type: {
                            columns: {
                                inventoryBehaviour: true,
                            },
                        },
                    },
                },
            },
        });
        const productUnitSize = 0;
        const inventoryBehaviour = productData?.category?.type?.inventoryBehaviour ?? "fixed_pack";

        // ─── Determine target variant & conversion ratio ───
        // NEW: Check shop's supplyMode first, then fall back to legacy logic

        let targetRetailVariantId: number;
        let conversionRatio: number;
        let isPackBreakdown = false;
        let conversionSource = "legacy"; // For logging

        const rawSupplyMode = String(item.supplyMode || "").toLowerCase();
        const shopSupplyMode = rawSupplyMode ? (rawSupplyMode as FulfillmentMode) : null;
        const shopTargetVariantId = item.targetVariantId; // number | null

        if (
            shopSupplyMode &&
            isContainerFulfillmentMode(shopSupplyMode) &&
            inventoryBehaviour === "auto_break" &&
            shopTargetVariantId
        ) {
            // ═══ PACK MODE: Shop chose a specific retail variant (e.g. 5KG) ═══
            targetRetailVariantId = shopTargetVariantId;

            const isLooseTrade = sourceOperations.receivingMode === "loose";
            const tradeWeightKg = Number(tradeVariant.weightKg || 0);

            if (isLooseTrade) {
                // Loose variant ordered as carton: look up actual carton weight
                const activeCarton = await tx.query.carton.findFirst({
                    where: and(eq(carton.variantId, tradeVariant.id), eq(carton.status, "active")),
                    columns: { totalWeightKg: true },
                    orderBy: [desc(carton.createdAt)],
                });

                const cartonWeightKg = Number(activeCarton?.totalWeightKg || 0);
                // Each ordered unit = 1 carton = cartonWeightKg in KG
                conversionRatio = cartonWeightKg > 0 ? cartonWeightKg : 1;
                conversionSource = "loose_carton_weight";
                console.log(
                    `[B2B-CONVERT] Loose carton mode: cartonKg=${cartonWeightKg}, ratio=${conversionRatio} (KG per carton)`,
                );
            } else {
                // Pack variant ordered as carton: use carton weight for ratio
                const targetVariant = await tx.query.productVariant.findFirst({
                    where: eq(productVariant.id, shopTargetVariantId),
                    columns: { id: true, weightKg: true },
                });

                const targetWeightKg = Number(targetVariant?.weightKg || 0);

                // Look up actual carton weight first (e.g. 50 KG per carton)
                const packCarton = await tx.query.carton.findFirst({
                    where: and(eq(carton.variantId, tradeVariant.id), eq(carton.status, "active")),
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
                    console.log(
                        `[B2B-CONVERT] Pack carton mode: ${cartonTotalWeightKg}KG carton / ${targetWeightKg}KG pack = ${conversionRatio} pcs`,
                    );
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
                console.log(
                    `[B2B-CONVERT] Pack mode: target=${shopTargetVariantId}, cartonKg=${cartonTotalWeightKg}, cartonPacks=${cartonTotalPacks}, tradeKg=${tradeWeightKg}, targetKg=${targetWeightKg}, ratio=${conversionRatio}`,
                );
            }
        } else if (
            shopSupplyMode &&
            usesWeightPoolFulfillmentMode(shopSupplyMode) &&
            inventoryBehaviour === "loose_convert"
        ) {
            // ═══ BULK → LOOSE MODE: Convert drums/cartons to a loose KG/L pool ═══
            const looseTargetCandidates = shopTargetVariantId
                ? []
                : await tx.query.productVariant.findMany({
                      where: eq(productVariant.productId, tradeVariant.productId),
                      columns: { id: true, weightKg: true },
                      with: { sourceVariantOption: true },
                  });
            const derivedLooseTarget = looseTargetCandidates.find(
                (candidate: any) =>
                    candidate.sourceVariantOption &&
                    resolveVariantOperations(candidate.sourceVariantOption).receivingMode === "loose",
            );
            const looseTargetVariant = shopTargetVariantId
                ? await tx.query.productVariant.findFirst({
                      where: eq(productVariant.id, shopTargetVariantId),
                      columns: { id: true, weightKg: true },
                  })
                : derivedLooseTarget;

            targetRetailVariantId = looseTargetVariant?.id ?? tradeVariant.id;

            const activeCarton = await tx.query.carton.findFirst({
                where: and(eq(carton.variantId, tradeVariant.id), eq(carton.status, "active")),
                columns: { totalWeightKg: true },
                orderBy: [desc(carton.createdAt)],
            });

            const containerWeightKg = Number(activeCarton?.totalWeightKg || 0);
            const variantWeightKg = Number(tradeVariant.weightKg || 0);
            conversionRatio = containerWeightKg > 0 ? containerWeightKg : variantWeightKg > 0 ? variantWeightKg : 1;
            conversionSource = "bulk_loose_convert";
            console.log(
                `[B2B-CONVERT] Bulk loose convert: mode=${shopSupplyMode}, target=${targetRetailVariantId}, ratio=${conversionRatio}`,
            );
        } else if (shopSupplyMode === "loose") {
            // ═══ LOOSE MODE: Direct KG transfer — no conversion ═══
            // Add raw KG directly to shop's loose variant inventory.
            // total_kg = variant_weight × quantity — no ratio math needed.
            targetRetailVariantId = tradeVariant.id;

            const variantWeightKg = Number(tradeVariant.weightKg || 0);
            // conversionRatio here means "KG per ordered unit"
            conversionRatio = variantWeightKg > 0 ? variantWeightKg : 1;

            conversionSource = "loose_direct_kg";
            console.log(
                `[B2B-CONVERT] Loose direct KG: target=${targetRetailVariantId}, variantKg=${variantWeightKg}, ratio=${conversionRatio} (KG per unit), totalKg=${orderedQty * conversionRatio}`,
            );
        } else if (
            shopSupplyMode &&
            (isDirectFulfillmentMode(shopSupplyMode) ||
                (isContainerFulfillmentMode(shopSupplyMode) && inventoryBehaviour === "fixed_pack"))
        ) {
            // ═══ DIRECT UNIT MODE: transfer fixed-pack, cylinder, pair, unit, or box as-is ═══
            targetRetailVariantId = shopTargetVariantId ?? tradeVariant.linkedRetailVariantId ?? tradeVariant.id;
            conversionRatio = 1;
            conversionSource = "direct_unit_transfer";

            if (!sourceOperations.allowsDecimal && !Number.isInteger(orderedQty)) {
                throw new Error(`${sourceOperations.operationalUnit} transfers require whole quantities`);
            }
            const targetVariant =
                targetRetailVariantId === tradeVariant.id
                    ? tradeVariant
                    : await tx.query.productVariant.findFirst({
                          where: eq(productVariant.id, targetRetailVariantId),
                          columns: { id: true },
                          with: { sourceVariantOption: true },
                      });
            if (!targetVariant?.sourceVariantOption) {
                throw new Error("Linked target variant is missing its Admin Variant definition");
            }
            const targetOperations = resolveVariantOperations(targetVariant.sourceVariantOption);
            if (
                sourceOperations.operationalUnit !== targetOperations.operationalUnit ||
                !areVariantOptionsStructurallyCompatible(
                    tradeVariant.sourceVariantOption,
                    targetVariant.sourceVariantOption,
                )
            ) {
                throw new Error("Linked variants must use the same structured definition and operational unit");
            }
            console.log(
                `[B2B-CONVERT] Direct transfer: mode=${shopSupplyMode}, target=${targetRetailVariantId}, ratio=${conversionRatio}`,
            );
        } else {
            // ═══ LEGACY MODE: No supplyMode set — use existing logic ═══
            // Look up conversion rule from variantConversionMap (set by admin UI)
            const conversionMap = await tx.query.variantConversionMap.findFirst({
                where: eq(variantConversionMap.fromVariantId, tradeVariant.id),
            });

            // Use map rule first, then fall back to variant's own fields
            targetRetailVariantId = conversionMap?.toVariantId ?? tradeVariant.linkedRetailVariantId ?? tradeVariant.id;

            const isLoose = sourceOperations.receivingMode === "loose";
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
                console.log(
                    `[B2B-CONVERT] Auto-calc from unitSize: ${productUnitSize}KG / ${variantSize}KG = ${conversionRatio}`,
                );
            } else {
                conversionRatio = 1;
            }

            conversionSource = conversionMap ? "conversion_map" : "variant_fields";
        }

        const lossPercent = Number(tradeVariant.conversionLossPercent || 0);
        const isNoLossTransfer =
            conversionSource === "loose_direct_kg" ||
            conversionSource === "bulk_loose_convert" ||
            conversionSource === "direct_unit_transfer";
        // Direct loose/unit transfers: no loss applied
        // Supplier target variants are conversion choices, not buyer inventory
        // identities. Resolve the exact retailer-owned variant before crediting.
        const buyerTarget = await ensureShopBuyerTargetVariant(tx, {
            shopId: orderData.userId,
            sourceVariantId: tradeVariant.id,
            requestedTargetVariantId: targetRetailVariantId === tradeVariant.id ? null : targetRetailVariantId,
        });
        targetRetailVariantId = buyerTarget.targetVariantId;
        await assertInventoryVariantOwnedBy(tx, {
            ownerType: "shop",
            ownerId: orderData.userId,
            variantId: targetRetailVariantId,
        });
        await tx
            .update(orderItem)
            .set({
                targetVariantId: targetRetailVariantId,
                catalogVariantId: buyerTarget.sourceCatalogVariantId,
                globalSkuSnapshot: buyerTarget.sourceGlobalSku,
                sourceSkuSnapshot: buyerTarget.sourceLocalSku,
                targetSkuSnapshot: buyerTarget.targetLocalSku,
            })
            .where(eq(orderItem.id, item.id));

        const calculatedRetailQty = isNoLossTransfer
            ? orderedQty * conversionRatio
            : orderedQty * conversionRatio * (1 - lossPercent / 100);
        const hasMovementSnapshot =
            item.inventoryQty !== null &&
            item.inventoryQty !== undefined &&
            item.conversionFactor !== null &&
            item.conversionFactor !== undefined;
        const sourceInventoryQty = hasMovementSnapshot ? Number(item.inventoryQty) : calculatedRetailQty;
        const receivedOrderQty = Number(item.receivedQty ?? orderedQty);
        const retailerInventoryQty = hasMovementSnapshot
            ? getReceivedRetailerQty({
                  receivedOrderQty,
                  approvedOrderQty: orderedQty,
                  retailerInventoryQty: orderedQty * Number(item.conversionFactor),
              })
            : calculatedRetailQty;

        // Calculate per-pack price when doing pack breakdown
        let effectiveRetailPrice = purchaseUnitPrice;
        if (isPackBreakdown && purchaseUnitPrice && conversionRatio > 1) {
            effectiveRetailPrice = (Number(purchaseUnitPrice) / conversionRatio).toFixed(2);
        }

        const targetIdentity =
            targetRetailVariantId === tradeVariant.id
                ? {
                      ...tradeVariant,
                      product: productData,
                  }
                : await tx.query.productVariant.findFirst({
                      where: eq(productVariant.id, targetRetailVariantId),
                      columns: {
                          id: true,
                          productId: true,
                          brandId: true,
                          catalogVariantId: true,
                      },
                      with: {
                          product: {
                              columns: {
                                  id: true,
                                  brandId: true,
                                  coreProductId: true,
                              },
                          },
                      },
                  });
        if (!targetIdentity) {
            throw new Error(`Target retail variant ${targetRetailVariantId} was not found`);
        }
        assertCompatibleB2bTargetVariant({ ...tradeVariant, product: productData }, targetIdentity);

        console.log(
            `[B2B-CONVERT] Variant ${tradeVariant.id}: source=${conversionSource}, target=${targetRetailVariantId}, ratio=${conversionRatio}, packBreakdown=${isPackBreakdown}, orderedQty=${orderedQty}, sourceQty=${sourceInventoryQty}, retailQty=${retailerInventoryQty}, perPackPrice=${effectiveRetailPrice ?? "N/A"}`,
        );

        // ─── A. Deduct warehouse inventory ───

        const sourceInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, sourceOwnerId),
                eq(inventory.variantId, tradeVariant.id),
            ),
        });

        if (shouldDeductWarehouseSellerStock(orderData)) {
            if (!sourceInv) {
                throw new Error(`Warehouse inventory was not found for variant ${tradeVariant.id}`);
            }

            // retailQty already accounts for all modes:
            //   - pack carton:  orderedQty × packsPerCarton (e.g. 1 × 20 = 20 packs)
            //   - loose carton: orderedQty × cartonWeightKg (e.g. 1 × 50 = 50 KG)
            //   - loose direct:  orderedQty × variantWeightKg (e.g. 3 × 20 = 60 KG)
            // Since availableQty stores pack count (for packs) or KG (for loose),
            // retailQty is always the correct deduction amount.
            const deductQty = sourceInventoryQty;
            const reservedQty = Number(sourceInv.reservedQty || 0);
            const availableQty = Number(sourceInv.availableQty || 0);
            const newReservedQty = Math.max(0, reservedQty - deductQty);
            const newSourceQty =
                reservedQty >= deductQty ? availableQty : Math.max(0, availableQty - (deductQty - reservedQty));

            // Also decrement inCartonQty for carton orders (packs leaving warehouse inside a carton)
            const isCartonOrder =
                conversionSource === "shop_pack_choice" ||
                conversionSource === "loose_carton_weight" ||
                (conversionSource === "direct_unit_transfer" &&
                    !!shopSupplyMode &&
                    isContainerFulfillmentMode(shopSupplyMode)) ||
                (conversionSource === "bulk_loose_convert" &&
                    !!shopSupplyMode &&
                    isContainerFulfillmentMode(shopSupplyMode));
            const currentInCarton = Number(sourceInv.inCartonQty || 0);
            const newInCarton = isCartonOrder ? Math.max(0, currentInCarton - deductQty) : currentInCarton;
            const currentActiveCartonCount = Number(sourceInv.activeCartonCount || 0);
            const newActiveCartonCount = isCartonOrder
                ? Math.max(0, currentActiveCartonCount - orderedQty)
                : currentActiveCartonCount;

            console.log(
                `[B2B-CONVERT] Deducting: avail ${availableQty}→${newSourceQty}, inCarton ${currentInCarton}→${newInCarton}, cartons ${currentActiveCartonCount}→${newActiveCartonCount}, deductQty=${deductQty}`,
            );

            const allocatedCartons = hasMovementSnapshot
                ? await tx.query.carton.findMany({
                      where: and(
                          eq(carton.reservedForOrderItemId, item.id),
                          inArray(carton.status, ["reserved", "dispatched"]),
                      ),
                      columns: { id: true },
                  })
                : [];
            const sourceUpdate = hasMovementSnapshot
                ? await tx
                      .update(inventory)
                      .set({
                          reservedQty: sql`${inventory.reservedQty}::numeric - ${deductQty}`,
                          updatedAt: new Date(),
                      })
                      .where(
                          and(eq(inventory.id, sourceInv.id), sql`${inventory.reservedQty}::numeric >= ${deductQty}`),
                      )
                      .returning({ id: inventory.id })
                : sourceOperations.receivingMode === "direct"
                  ? await tx
                        .update(inventory)
                        .set({
                            reservedQty: sql`${inventory.reservedQty}::numeric - ${deductQty}`,
                            updatedAt: new Date(),
                        })
                        .where(
                            and(eq(inventory.id, sourceInv.id), sql`${inventory.reservedQty}::numeric >= ${deductQty}`),
                        )
                        .returning({ id: inventory.id })
                  : await tx
                        .update(inventory)
                        .set({
                            availableQty: newSourceQty.toFixed(2),
                            reservedQty: newReservedQty.toFixed(2),
                            ...(isCartonOrder ? { inCartonQty: newInCarton.toFixed(2) } : {}),
                            ...(isCartonOrder ? { activeCartonCount: newActiveCartonCount } : {}),
                            updatedAt: new Date(),
                        })
                        .where(eq(inventory.id, sourceInv.id))
                        .returning({ id: inventory.id });
            if (sourceUpdate.length === 0) {
                throw new Error(`Reserved stock changed for variant ${tradeVariant.id}`);
            }

            // Mark consumed carton records as "sold" (FIFO: oldest first)
            if (allocatedCartons.length > 0) {
                await tx
                    .update(carton)
                    .set({ status: "sold" })
                    .where(
                        inArray(
                            carton.id,
                            allocatedCartons.map((row: { id: number }) => row.id),
                        ),
                    );
            } else if (isCartonOrder && !hasMovementSnapshot) {
                const activeCartons = await tx.query.carton.findMany({
                    where: and(
                        eq(carton.warehouseId, sourceOwnerId),
                        eq(carton.variantId, tradeVariant.id),
                        eq(carton.status, "active"),
                    ),
                    orderBy: [carton.createdAt], // FIFO
                });

                let cartonsToConsume = orderedQty; // number of cartons ordered
                for (const c of activeCartons) {
                    if (cartonsToConsume <= 0) break;
                    await tx.update(carton).set({ status: "sold" }).where(eq(carton.id, c.id));
                    console.log(`[B2B-CONVERT] Marked carton ${c.cartonId} (id=${c.id}) as sold`);
                    cartonsToConsume--;
                }
            }
        }

        // ─── B. Upsert shop owner's RETAIL inventory ───

        if (retailerInventoryQty > 0) {
            // Use per-pack price (after breakdown), or fall back to warehouse's retail_price
            const initialRetailPrice =
                effectiveRetailPrice ?? (sourceInv?.retailPrice ? String(sourceInv.retailPrice) : null);

            await tx
                .insert(inventory)
                .values({
                    ownerType: "shop" as const,
                    ownerId: orderData.userId,
                    variantId: targetRetailVariantId,
                    availableQty: retailerInventoryQty.toFixed(2),
                    reservedQty: "0",
                    ...(initialRetailPrice ? { retailPrice: initialRetailPrice } : {}),
                })
                .onConflictDoUpdate({
                    target: [inventory.ownerType, inventory.ownerId, inventory.variantId],
                    set: {
                        availableQty: sql`${inventory.availableQty}::numeric + ${retailerInventoryQty}`,
                        updatedAt: new Date(),
                    },
                });
        }

        // ─── C. Update order item conversion status ───

        await tx
            .update(orderItem)
            .set({
                conversionStatus: "converted",
                convertedQty: retailerInventoryQty.toFixed(2),
            })
            .where(and(eq(orderItem.id, item.id), sql`${orderItem.conversionStatus} IS DISTINCT FROM 'converted'`));
    }
}

async function transferB2bOrderToWarehouseInventory(
    tx: any,
    input: {
        buyerWarehouseId: string;
        supplierWarehouseId: string;
        items: any[];
        deductSellerStock: boolean;
    },
) {
    console.log(
        `[B2B-W2W] Starting flat warehouse transfer from ${input.supplierWarehouseId} to ${input.buyerWarehouseId}`,
    );

    for (const item of input.items) {
        if (!item.variantId) {
            throw new Error(`Order item ${item.id} has no source variant`);
        }

        const approvedOrderQty = Number(item.modifiedQty ?? item.quantity);
        const receivedOrderQty = Number(item.receivedQty ?? approvedOrderQty);
        const sourceInventoryQty = Number(item.inventoryQty ?? approvedOrderQty);
        const targetInventoryQty =
            item.conversionFactor !== null && item.conversionFactor !== undefined
                ? getReceivedRetailerQty({
                      receivedOrderQty,
                      approvedOrderQty,
                      retailerInventoryQty: approvedOrderQty * Number(item.conversionFactor),
                  })
                : receivedOrderQty;
        if (
            !Number.isFinite(approvedOrderQty) ||
            !Number.isFinite(receivedOrderQty) ||
            !Number.isFinite(sourceInventoryQty) ||
            !Number.isFinite(targetInventoryQty) ||
            approvedOrderQty <= 0 ||
            receivedOrderQty < 0 ||
            receivedOrderQty > approvedOrderQty ||
            sourceInventoryQty <= 0 ||
            targetInventoryQty < 0
        ) {
            throw new Error(`Order item ${item.id} has an invalid movement snapshot`);
        }

        const buyerTarget = await ensureWarehouseBuyerTargetVariant(tx, {
            warehouseId: input.buyerWarehouseId,
            sourceVariantId: item.variantId,
            requestedTargetVariantId: item.targetVariantId,
        });
        const targetVariantId = buyerTarget.targetVariantId;
        await assertInventoryVariantOwnedBy(tx, {
            ownerType: "warehouse",
            ownerId: input.buyerWarehouseId,
            variantId: targetVariantId,
        });
        await tx
            .update(orderItem)
            .set({
                targetVariantId,
                catalogVariantId: buyerTarget.sourceCatalogVariantId,
                globalSkuSnapshot: buyerTarget.sourceGlobalSku,
                sourceSkuSnapshot: buyerTarget.sourceLocalSku,
                targetSkuSnapshot: buyerTarget.targetLocalSku,
            })
            .where(eq(orderItem.id, item.id));
        const [sourceIdentity, targetIdentity] = await Promise.all([
            tx.query.productVariant.findFirst({
                where: eq(productVariant.id, item.variantId),
                columns: {
                    id: true,
                    productId: true,
                    brandId: true,
                    catalogVariantId: true,
                },
                with: {
                    catalogVariant: {
                        columns: { conversionTargetCatalogVariantId: true },
                    },
                    product: {
                        columns: {
                            id: true,
                            brandId: true,
                            coreProductId: true,
                        },
                    },
                },
            }),
            tx.query.productVariant.findFirst({
                where: eq(productVariant.id, targetVariantId),
                columns: {
                    id: true,
                    productId: true,
                    brandId: true,
                    catalogVariantId: true,
                },
                with: {
                    product: {
                        columns: {
                            id: true,
                            brandId: true,
                            coreProductId: true,
                        },
                    },
                },
            }),
        ]);
        if (!sourceIdentity || !targetIdentity) {
            throw new Error(`Order item ${item.id} has an invalid variant mapping`);
        }
        assertCompatibleB2bTargetVariant(sourceIdentity, targetIdentity);

        const sourceInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, input.supplierWarehouseId),
                eq(inventory.variantId, item.variantId),
            ),
        });

        if (input.deductSellerStock) {
            if (!sourceInv) {
                throw new Error(`Supplier inventory is missing for variant ${item.variantId}`);
            }

            const released = await tx
                .update(inventory)
                .set({
                    reservedQty: sql`${inventory.reservedQty}::numeric - ${sourceInventoryQty}`,
                    updatedAt: new Date(),
                })
                .where(and(eq(inventory.id, sourceInv.id), sql`${inventory.reservedQty}::numeric >= ${sourceInventoryQty}`))
                .returning({ id: inventory.id });
            if (released.length === 0) {
                throw new Error(`Reserved stock changed for variant ${item.variantId}`);
            }

            const allocatedCartons = await tx.query.carton.findMany({
                where: and(eq(carton.reservedForOrderItemId, item.id), inArray(carton.status, ["reserved", "dispatched"])),
                columns: { id: true },
            });
            if (allocatedCartons.length > 0) {
                await tx
                    .update(carton)
                    .set({ status: "sold" })
                    .where(
                        inArray(
                            carton.id,
                            allocatedCartons.map((row: { id: number }) => row.id),
                        ),
                    );
            }
        }

        const buyerInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, input.buyerWarehouseId),
                eq(inventory.variantId, targetVariantId),
            ),
        });

        if (targetInventoryQty > 0 && buyerInv) {
            await tx
                .update(inventory)
                .set({
                    availableQty: (Number(buyerInv.availableQty || 0) + targetInventoryQty).toFixed(2),
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, buyerInv.id));
        } else if (targetInventoryQty > 0) {
            const initialPrice = sourceInv?.retailPrice
                ? String(sourceInv.retailPrice)
                : item.unitPrice
                  ? String(item.unitPrice)
                  : null;

            await tx.insert(inventory).values({
                ownerType: "warehouse" as const,
                ownerId: input.buyerWarehouseId,
                variantId: targetVariantId,
                availableQty: targetInventoryQty.toFixed(2),
                reservedQty: "0",
                ...(initialPrice ? { retailPrice: initialPrice } : {}),
            });
        }

        await tx
            .update(orderItem)
            .set({
                conversionStatus: "converted",
                convertedQty: targetInventoryQty.toFixed(2),
            })
            .where(and(eq(orderItem.id, item.id), sql`${orderItem.conversionStatus} IS DISTINCT FROM 'converted'`));

        console.log(
            `[B2B-W2W] Transferred source=${item.variantId}, target=${targetVariantId}, sourceQty=${sourceInventoryQty}, receivedQty=${targetInventoryQty}, item=${item.id}`,
        );
    }
}

/**
 * Receive one delivered invoice shipment into the buyer warehouse inventory.
 * Supports partial (split) invoices without closing the parent order early.
 */
export async function receiveB2bInvoiceShipment(
    tx: any,
    input: {
        invoiceId: number;
        buyerWarehouseId: string;
        receivedItems?: Array<{ invoiceItemId: number; receivedQty: number }>;
    },
) {
    const inv = await tx.query.invoice.findFirst({
        where: eq(invoice.id, input.invoiceId),
        with: { items: true, order: true },
    });

    if (!inv?.order) {
        throw new Error("Invoice not found");
    }
    if (inv.order.userId !== input.buyerWarehouseId) {
        throw new Error("Not authorized to receive this shipment");
    }
    if (!inv.order.warehouseId) {
        throw new Error("Supplier warehouse not found on order");
    }
    if (inv.order.orderType !== "b2b") {
        throw new Error("Only B2B supplier shipments can be received here");
    }
    if (inv.deliveryStatus !== "delivered") {
        throw new Error("Shipment has not been delivered yet");
    }
    if (inv.receivedAt) {
        throw new Error("Shipment has already been received");
    }

    const orderItems = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, inv.orderId),
    });

    const receivedByItemId = new Map(
        (input.receivedItems ?? []).map((row) => [row.invoiceItemId, row.receivedQty]),
    );

    for (const receipt of input.receivedItems ?? []) {
        if (!inv.items.some((item: { id: number }) => item.id === receipt.invoiceItemId)) {
            throw new Error(`Invoice item ${receipt.invoiceItemId} does not belong to this shipment`);
        }
        if (receipt.receivedQty < 0) {
            throw new Error("Received quantity cannot be negative");
        }
    }

    const deductSellerStock = shouldDeductWarehouseSellerStock(inv.order);

    for (const invoiceLine of inv.items) {
        const shippedQty = invoiceLine.quantity;
        const qty = receivedByItemId.has(invoiceLine.id)
            ? receivedByItemId.get(invoiceLine.id)!
            : shippedQty;

        if (qty > shippedQty) {
            throw new Error(
                `Received quantity for ${invoiceLine.productName} cannot exceed shipped quantity ${shippedQty}`,
            );
        }
        if (qty <= 0) continue;

        const exactLinkedItem = invoiceLine.orderItemId
            ? orderItems.find((item: typeof orderItem.$inferSelect) => item.id === invoiceLine.orderItemId)
            : null;
        const exactVariantItems = invoiceLine.variantId
            ? orderItems.filter(
                  (item: typeof orderItem.$inferSelect) => item.variantId === invoiceLine.variantId,
              )
            : [];
        const matchedOrderItem =
            exactLinkedItem ?? (exactVariantItems.length === 1 ? exactVariantItems[0] : null);

        if (!matchedOrderItem?.variantId) {
            throw new Error(`No matching order item for product ${invoiceLine.productName}`);
        }

        const approvedOrderQty = matchedOrderItem.modifiedQty ?? matchedOrderItem.quantity;
        const previouslyReceived = Number(matchedOrderItem.receivedQty ?? 0);
        if (previouslyReceived + qty > approvedOrderQty) {
            throw new Error(
                `Received quantity for ${invoiceLine.productName} exceeds approved order quantity`,
            );
        }

        const hasMovementSnapshot =
            matchedOrderItem.inventoryQty !== null &&
            matchedOrderItem.inventoryQty !== undefined &&
            matchedOrderItem.conversionFactor !== null &&
            matchedOrderItem.conversionFactor !== undefined;

        const fullSourceInventoryQty = Number(matchedOrderItem.inventoryQty ?? approvedOrderQty);
        const sourceInventoryQty = hasMovementSnapshot
            ? (fullSourceInventoryQty * qty) / approvedOrderQty
            : qty;
        const targetInventoryQty = hasMovementSnapshot
            ? getReceivedRetailerQty({
                  receivedOrderQty: qty,
                  approvedOrderQty,
                  retailerInventoryQty: approvedOrderQty * Number(matchedOrderItem.conversionFactor),
              })
            : qty;

        if (
            !Number.isFinite(sourceInventoryQty) ||
            !Number.isFinite(targetInventoryQty) ||
            sourceInventoryQty <= 0 ||
            targetInventoryQty < 0
        ) {
            throw new Error(`Order item ${matchedOrderItem.id} has an invalid movement snapshot`);
        }

        const buyerTarget = await ensureWarehouseBuyerTargetVariant(tx, {
            warehouseId: input.buyerWarehouseId,
            sourceVariantId: matchedOrderItem.variantId,
            requestedTargetVariantId: matchedOrderItem.targetVariantId,
        });
        const targetVariantId = buyerTarget.targetVariantId;
        await assertInventoryVariantOwnedBy(tx, {
            ownerType: "warehouse",
            ownerId: input.buyerWarehouseId,
            variantId: targetVariantId,
        });

        const [sourceIdentity, targetIdentity] = await Promise.all([
            tx.query.productVariant.findFirst({
                where: eq(productVariant.id, matchedOrderItem.variantId),
                columns: {
                    id: true,
                    productId: true,
                    brandId: true,
                    catalogVariantId: true,
                },
                with: {
                    catalogVariant: {
                        columns: { conversionTargetCatalogVariantId: true },
                    },
                    product: {
                        columns: {
                            id: true,
                            brandId: true,
                            coreProductId: true,
                        },
                    },
                },
            }),
            tx.query.productVariant.findFirst({
                where: eq(productVariant.id, targetVariantId),
                columns: {
                    id: true,
                    productId: true,
                    brandId: true,
                    catalogVariantId: true,
                },
                with: {
                    product: {
                        columns: {
                            id: true,
                            brandId: true,
                            coreProductId: true,
                        },
                    },
                },
            }),
        ]);
        if (!sourceIdentity || !targetIdentity) {
            throw new Error(`Order item ${matchedOrderItem.id} has an invalid variant mapping`);
        }
        assertCompatibleB2bTargetVariant(sourceIdentity, targetIdentity);

        const sourceInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, inv.order.warehouseId),
                eq(inventory.variantId, matchedOrderItem.variantId),
            ),
        });

        if (deductSellerStock) {
            if (!sourceInv) {
                throw new Error(`Supplier inventory is missing for variant ${matchedOrderItem.variantId}`);
            }

            const released = await tx
                .update(inventory)
                .set({
                    reservedQty: sql`${inventory.reservedQty}::numeric - ${sourceInventoryQty}`,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(inventory.id, sourceInv.id),
                        sql`${inventory.reservedQty}::numeric >= ${sourceInventoryQty}`,
                    ),
                )
                .returning({ id: inventory.id });
            if (released.length === 0) {
                throw new Error(`Reserved stock changed for variant ${matchedOrderItem.variantId}`);
            }
        }

        const buyerInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, input.buyerWarehouseId),
                eq(inventory.variantId, targetVariantId),
            ),
        });

        if (targetInventoryQty > 0 && buyerInv) {
            await tx
                .update(inventory)
                .set({
                    availableQty: (Number(buyerInv.availableQty || 0) + targetInventoryQty).toFixed(2),
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, buyerInv.id));
        } else if (targetInventoryQty > 0) {
            const initialPrice = sourceInv?.retailPrice
                ? String(sourceInv.retailPrice)
                : matchedOrderItem.unitPrice
                  ? String(matchedOrderItem.unitPrice)
                  : null;

            await tx.insert(inventory).values({
                ownerType: "warehouse" as const,
                ownerId: input.buyerWarehouseId,
                variantId: targetVariantId,
                availableQty: targetInventoryQty.toFixed(2),
                reservedQty: "0",
                ...(initialPrice ? { retailPrice: initialPrice } : {}),
            });
        }

        const nextReceivedQty = previouslyReceived + qty;
        const prevConverted = Number(matchedOrderItem.convertedQty ?? 0);
        const nextConverted = prevConverted + targetInventoryQty;

        await tx
            .update(orderItem)
            .set({
                targetVariantId,
                catalogVariantId: buyerTarget.sourceCatalogVariantId,
                globalSkuSnapshot: buyerTarget.sourceGlobalSku,
                sourceSkuSnapshot: buyerTarget.sourceLocalSku,
                targetSkuSnapshot: buyerTarget.targetLocalSku,
                receivedQty: nextReceivedQty,
                convertedQty: nextConverted.toFixed(2),
                conversionStatus: nextReceivedQty >= approvedOrderQty ? "converted" : "pending",
            })
            .where(eq(orderItem.id, matchedOrderItem.id));

        matchedOrderItem.receivedQty = nextReceivedQty;
        matchedOrderItem.convertedQty = nextConverted.toFixed(2);
    }

    const claimed = await tx
        .update(invoice)
        .set({ receivedAt: new Date() })
        .where(and(eq(invoice.id, inv.id), sql`${invoice.receivedAt} IS NULL`))
        .returning({ id: invoice.id });
    if (claimed.length === 0) {
        throw new Error("Shipment was already received");
    }

    const allInvoices = await tx.query.invoice.findMany({
        where: eq(invoice.orderId, inv.orderId),
    });
    const allReceived =
        allInvoices.length > 0 &&
        allInvoices.every((row: { id: number; receivedAt: Date | null }) =>
            row.id === inv.id ? true : !!row.receivedAt,
        );

    if (allReceived && inv.order.status === "delivered") {
        await tx
            .update(order)
            .set({ receivedAt: inv.order.receivedAt ?? new Date() })
            .where(and(eq(order.id, inv.orderId), sql`${order.receivedAt} IS NULL`));
    }

    return { invoiceId: inv.id, orderId: inv.orderId, allReceived };
}
