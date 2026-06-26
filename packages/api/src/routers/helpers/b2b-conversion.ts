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

import {carton, inventory, invoice, order, orderItem, product, productVariant, user, variantConversionMap,} from "@bikalpo-project/db/schema";
import {and, desc, eq} from "drizzle-orm";

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
    const allItems = await tx.query.orderItem.findMany({
        where: eq(orderItem.orderId, orderId),
    });

    // ─── IDEMPOTENCY GUARD ───
    // This function is called from multiple places (deliveryman confirms delivery,
    // shop owner marks received, warehouse marks delivered). Skip items that have
    // already been converted to prevent double-counting inventory.
    const items = allItems.filter(
        (item: any) => item.conversionStatus !== "converted",
    );

    if (items.length === 0) {
        console.log(`[B2B-CONVERT] All items already converted for order #${orderId}, skipping`);
        return;
    }

    console.log(`[B2B-CONVERT] Converting ${items.length}/${allItems.length} items (${allItems.length - items.length} already converted)`);

    const buyer = await tx.query.user.findFirst({
        where: eq(user.id, orderData.userId),
        columns: { id: true, role: true },
    });

    if (buyer?.role === "warehouse") {
        await transferB2bOrderToWarehouseInventory(tx, {
            buyerWarehouseId: orderData.userId,
            supplierWarehouseId: sourceOwnerId,
            items,
        });
        return;
    }

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

        const orderedQty = Number(item.modifiedQty ?? item.quantity);
        const purchaseUnitPrice = item.modifiedUnitPrice
            ? String(item.modifiedUnitPrice)
            : item.unitPrice
                ? String(item.unitPrice)
                : null;

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
            // ═══ LOOSE MODE: Direct KG transfer — no conversion ═══
            // Add raw KG directly to shop's loose variant inventory.
            // total_kg = variant_weight × quantity — no ratio math needed.
            targetRetailVariantId = tradeVariant.id;

            const variantWeightKg = Number(tradeVariant.weightKg || 0);
            // conversionRatio here means "KG per ordered unit"
            conversionRatio = variantWeightKg > 0 ? variantWeightKg : 1;

            conversionSource = "loose_direct_kg";
            console.log(`[B2B-CONVERT] Loose direct KG: target=${targetRetailVariantId}, variantKg=${variantWeightKg}, ratio=${conversionRatio} (KG per unit), totalKg=${orderedQty * conversionRatio}`);

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
        const isLooseDirect = conversionSource === "loose_direct_kg";
        // Loose direct: no loss applied — raw KG transfer
        const retailQty = isLooseDirect
            ? orderedQty * conversionRatio
            : orderedQty * conversionRatio * (1 - lossPercent / 100);

        // Calculate per-pack price when doing pack breakdown
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
            // retailQty already accounts for all modes:
            //   - pack carton:  orderedQty × packsPerCarton (e.g. 1 × 20 = 20 packs)
            //   - loose carton: orderedQty × cartonWeightKg (e.g. 1 × 50 = 50 KG)
            //   - loose direct:  orderedQty × variantWeightKg (e.g. 3 × 20 = 60 KG)
            // Since availableQty stores pack count (for packs) or KG (for loose),
            // retailQty is always the correct deduction amount.
            const deductQty = retailQty;
            const reservedQty = Number(sourceInv.reservedQty || 0);
            const availableQty = Number(sourceInv.availableQty || 0);
            const newReservedQty = Math.max(0, reservedQty - deductQty);
            const newSourceQty = reservedQty >= deductQty
                ? availableQty
                : Math.max(0, availableQty - (deductQty - reservedQty));

            // Also decrement inCartonQty for carton orders (packs leaving warehouse inside a carton)
            const isCartonOrder = conversionSource === "shop_pack_choice" || conversionSource === "loose_carton_weight";
            const currentInCarton = Number(sourceInv.inCartonQty || 0);
            const newInCarton = isCartonOrder
                ? Math.max(0, currentInCarton - deductQty)
                : currentInCarton;

            console.log(`[B2B-CONVERT] Deducting: avail ${availableQty}→${newSourceQty}, inCarton ${currentInCarton}→${newInCarton}, deductQty=${deductQty}`);

            await tx
                .update(inventory)
                .set({
                    availableQty: newSourceQty.toFixed(2),
                    reservedQty: newReservedQty.toFixed(2),
                    ...(isCartonOrder ? { inCartonQty: newInCarton.toFixed(2) } : {}),
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, sourceInv.id));

            // Mark consumed carton records as "sold" (FIFO: oldest first)
            if (isCartonOrder) {
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

async function transferB2bOrderToWarehouseInventory(
    tx: any,
    input: {
        buyerWarehouseId: string;
        supplierWarehouseId: string;
        items: any[];
    },
) {
    console.log(
        `[B2B-W2W] Starting flat warehouse transfer from ${input.supplierWarehouseId} to ${input.buyerWarehouseId}`,
    );

    for (const item of input.items) {
        if (!item.variantId) {
            await markItemTransferFailed(tx, item.id, "Missing variant for warehouse transfer");
            continue;
        }

        const transferQty = Number(item.modifiedQty ?? item.quantity);
        if (!Number.isFinite(transferQty) || transferQty <= 0) {
            await markItemTransferFailed(tx, item.id, "Invalid transfer quantity");
            continue;
        }

        const sourceInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, input.supplierWarehouseId),
                eq(inventory.variantId, item.variantId),
            ),
        });

        if (!sourceInv) {
            await markItemTransferFailed(tx, item.id, "Supplier warehouse inventory not found");
            continue;
        }

        const reservedQty = Number(sourceInv.reservedQty || 0);
        const availableQty = Number(sourceInv.availableQty || 0);
        const newReservedQty = Math.max(0, reservedQty - transferQty);
        const newSourceQty =
            reservedQty >= transferQty
                ? availableQty
                : Math.max(0, availableQty - (transferQty - reservedQty));

        await tx
            .update(inventory)
            .set({
                availableQty: newSourceQty.toFixed(2),
                reservedQty: newReservedQty.toFixed(2),
                updatedAt: new Date(),
            })
            .where(eq(inventory.id, sourceInv.id));

        const buyerInv = await tx.query.inventory.findFirst({
            where: and(
                eq(inventory.ownerType, "warehouse"),
                eq(inventory.ownerId, input.buyerWarehouseId),
                eq(inventory.variantId, item.variantId),
            ),
        });

        if (buyerInv) {
            await tx
                .update(inventory)
                .set({
                    availableQty: (
                        Number(buyerInv.availableQty || 0) + transferQty
                    ).toFixed(2),
                    updatedAt: new Date(),
                })
                .where(eq(inventory.id, buyerInv.id));
        } else {
            const initialPrice =
                sourceInv.retailPrice
                    ? String(sourceInv.retailPrice)
                    : item.unitPrice
                        ? String(item.unitPrice)
                        : null;

            await tx.insert(inventory).values({
                ownerType: "warehouse" as const,
                ownerId: input.buyerWarehouseId,
                variantId: item.variantId,
                availableQty: transferQty.toFixed(2),
                reservedQty: "0",
                ...(initialPrice ? { retailPrice: initialPrice } : {}),
            });
        }

        await tx
            .update(orderItem)
            .set({
                conversionStatus: "converted",
                convertedQty: transferQty.toFixed(2),
            })
            .where(eq(orderItem.id, item.id));

        console.log(
            `[B2B-W2W] Transferred variant=${item.variantId}, qty=${transferQty}, item=${item.id}`,
        );
    }
}

async function markItemTransferFailed(tx: any, itemId: number, reason: string) {
    console.warn(`[B2B-W2W] ${reason} for item ${itemId}`);
    await tx
        .update(orderItem)
        .set({ conversionStatus: "failed" })
        .where(eq(orderItem.id, itemId));
}

/**
 * Transfer a single variant quantity from supplier warehouse to buyer warehouse inventory.
 */
async function transferWarehouseVariantQty(
    tx: any,
    input: {
        supplierWarehouseId: string;
        buyerWarehouseId: string;
        variantId: number;
        quantity: number;
        unitPrice?: string | null;
    },
) {
    const { supplierWarehouseId, buyerWarehouseId, variantId, quantity } = input;
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    const sourceInv = await tx.query.inventory.findFirst({
        where: and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, supplierWarehouseId),
            eq(inventory.variantId, variantId),
        ),
    });

    if (!sourceInv) {
        throw new Error("Supplier warehouse inventory not found");
    }

    const reservedQty = Number(sourceInv.reservedQty || 0);
    const availableQty = Number(sourceInv.availableQty || 0);
    const newReservedQty = Math.max(0, reservedQty - quantity);
    const newSourceQty =
        reservedQty >= quantity
            ? availableQty
            : Math.max(0, availableQty - (quantity - reservedQty));

    await tx
        .update(inventory)
        .set({
            availableQty: newSourceQty.toFixed(2),
            reservedQty: newReservedQty.toFixed(2),
            updatedAt: new Date(),
        })
        .where(eq(inventory.id, sourceInv.id));

    const buyerInv = await tx.query.inventory.findFirst({
        where: and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, buyerWarehouseId),
            eq(inventory.variantId, variantId),
        ),
    });

    if (buyerInv) {
        await tx
            .update(inventory)
            .set({
                availableQty: (
                    Number(buyerInv.availableQty || 0) + quantity
                ).toFixed(2),
                updatedAt: new Date(),
            })
            .where(eq(inventory.id, buyerInv.id));
    } else {
        const initialPrice =
            sourceInv.retailPrice
                ? String(sourceInv.retailPrice)
                : input.unitPrice
                    ? String(input.unitPrice)
                    : null;

        await tx.insert(inventory).values({
            ownerType: "warehouse" as const,
            ownerId: buyerWarehouseId,
            variantId,
            availableQty: quantity.toFixed(2),
            reservedQty: "0",
            ...(initialPrice ? { retailPrice: initialPrice } : {}),
        });
    }
}

/**
 * Receive one delivered invoice shipment into the buyer warehouse's inventory.
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

    for (const invoiceItem of inv.items) {
        const qty = receivedByItemId.has(invoiceItem.id)
            ? receivedByItemId.get(invoiceItem.id)!
            : invoiceItem.quantity;

        if (qty <= 0) continue;

        const matchedOrderItem =
            orderItems.find(
                (item: typeof orderItem.$inferSelect) =>
                    item.productId === invoiceItem.productId &&
                    (item.productSize === invoiceItem.productSku ||
                        !invoiceItem.productSku),
            ) ??
            orderItems.find(
                (item: typeof orderItem.$inferSelect) =>
                    item.productId === invoiceItem.productId,
            );

        if (!matchedOrderItem?.variantId) {
            throw new Error(
                `No matching order item for product ${invoiceItem.productName}`,
            );
        }

        await transferWarehouseVariantQty(tx, {
            supplierWarehouseId: inv.order.warehouseId,
            buyerWarehouseId: input.buyerWarehouseId,
            variantId: matchedOrderItem.variantId,
            quantity: qty,
            unitPrice: matchedOrderItem.unitPrice,
        });

        const prevConverted = Number(matchedOrderItem.convertedQty ?? 0);
        const nextConverted = prevConverted + qty;
        const targetQty = matchedOrderItem.modifiedQty ?? matchedOrderItem.quantity;

        await tx
            .update(orderItem)
            .set({
                convertedQty: nextConverted.toFixed(2),
                conversionStatus:
                    nextConverted >= targetQty ? "converted" : "pending",
            })
            .where(eq(orderItem.id, matchedOrderItem.id));

        matchedOrderItem.convertedQty = nextConverted.toFixed(2);
    }

    await tx
        .update(invoice)
        .set({ receivedAt: new Date() })
        .where(eq(invoice.id, inv.id));

    const allInvoices = await tx.query.invoice.findMany({
        where: eq(invoice.orderId, inv.orderId),
    });
    const allReceived =
        allInvoices.length > 0 &&
        allInvoices.every((row: { receivedAt: Date | null }) => row.receivedAt);

    if (allReceived && inv.order.status === "delivered") {
        await tx
            .update(order)
            .set({ receivedAt: inv.order.receivedAt ?? new Date() })
            .where(eq(order.id, inv.orderId));
    }

    return { invoiceId: inv.id, orderId: inv.orderId, allReceived };
}
