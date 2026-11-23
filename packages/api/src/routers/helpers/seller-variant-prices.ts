import { db } from "@bikalpo-project/db";
import { inventory } from "@bikalpo-project/db/schema";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Puts the seller's own selling price (their inventory row) on each variant
 * as `retailPrice`, so product edit shows Exchange and New. The admin
 * reference price on `variantPrices` is not the seller's price.
 */
export async function withOwnerRetailPrices<
  P extends { variants: Array<{ id: number }> },
>(found: P, ownerType: "shop" | "warehouse", ownerId: string) {
  const variantIds = found.variants.map((variant) => variant.id);
  const rows = variantIds.length
    ? await db
        .select({
          variantId: inventory.variantId,
          retailPrice: inventory.retailPrice,
        })
        .from(inventory)
        .where(
          and(
            eq(inventory.ownerType, ownerType),
            eq(inventory.ownerId, ownerId),
            inArray(inventory.variantId, variantIds),
          ),
        )
    : [];
  const priceByVariant = new Map(
    rows.map((row) => [row.variantId, row.retailPrice]),
  );
  return {
    ...found,
    variants: found.variants.map((variant) => ({
      ...variant,
      retailPrice: priceByVariant.get(variant.id) ?? null,
    })),
  };
}
