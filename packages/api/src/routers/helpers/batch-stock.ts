import { db } from "@bikalpo-project/db";
import { inventory } from "@bikalpo-project/db/schema";
import { resolveVariantStockSemantics } from "@bikalpo-project/db/variant-definition";
import { and, eq } from "drizzle-orm";
import { type BatchSize, buildBatchGroups } from "./batch-groups";
import { allocateBatches } from "./expiry-batches";
import { loadShopStockIns, loadWarehouseStockIns } from "./expiry-stock";
import type { ProductListOwner } from "./owner-product-list";
import { unitName } from "./realtime-stock";

/**
 * Batch page (client, 2026-11-25): every product size holding stock from a
 * batch, with each batch's dates, Manufactured code, stock, and where it
 * came from. Batches come from the stock-ins typed on Add Stock and order
 * or purchase receiving.
 */
export async function loadBatchStock(owner: ProductListOwner) {
  const ownerType = owner.ownerType === "warehouse" ? "warehouse" : "shop";
  const rows = await db.query.inventory.findMany({
    where: and(
      eq(inventory.ownerType, ownerType),
      eq(inventory.ownerId, owner.ownerId),
    ),
    with: {
      variant: {
        with: {
          sourceVariantOption: true,
          brand: { columns: { name: true } },
          product: { columns: { id: true, name: true } },
        },
      },
    },
  });

  const sizes = new Map<number, BatchSize>();
  const available = new Map<number, number>();
  for (const row of rows) {
    const variant = row.variant;
    if (!variant?.product || !variant.sourceVariantOption) continue;
    let semantics: ReturnType<typeof resolveVariantStockSemantics>;
    try {
      semantics = resolveVariantStockSemantics(variant.sourceVariantOption);
    } catch {
      continue;
    }
    sizes.set(row.variantId, {
      variantId: row.variantId,
      productId: variant.product.id,
      productName: variant.product.name,
      sizeLabel: semantics.displayLabel,
      unit: unitName(
        semantics.entryType === "loose"
          ? (semantics.measurementUnit ?? semantics.operationalUnit)
          : semantics.operationalUnit,
      ),
      brandName: variant.brand?.name ?? null,
      color: variant.color?.trim() || null,
    });
    available.set(row.variantId, Number(row.availableQty ?? 0));
  }
  if (sizes.size === 0) return [];

  const variantIds = [...sizes.keys()];
  const stockIns =
    ownerType === "warehouse"
      ? await loadWarehouseStockIns(owner.ownerId, variantIds)
      : await loadShopStockIns(owner.ownerId, variantIds);
  const left = allocateBatches(stockIns, available);
  return buildBatchGroups(stockIns, left, sizes);
}
