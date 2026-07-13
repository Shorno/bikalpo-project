import type { db } from "@bikalpo-project/db";
import {
  productVariant,
  productVariantPrice,
  variantOption,
} from "@bikalpo-project/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  ConcreteVariantDefinitionError,
  resolveConcreteVariantOption,
  resolveVariantOption,
} from "@bikalpo-project/db/variant-definition";
import { ORPCError } from "@orpc/server";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbClient = typeof db | DbTransaction;

export type GeneratedVariantProductSettings = {
  minimumOrderEnabled?: boolean;
  minimumOrderQty?: string | null;
  inventoryUnit?: string | null;
  inventoryLooseUnitEnabled?: boolean;
  inventoryLooseUnit?: string | null;
};

type VariantPriceRow = typeof productVariantPrice.$inferSelect;
type VariantOptionRow = typeof variantOption.$inferSelect;

export function resolveConcreteVariantForConfig(
  option: VariantOptionRow | undefined,
) {
  if (!option) {
    throw new ORPCError("BAD_REQUEST", {
      message: "One or more selected variants do not exist",
    });
  }
  try {
    return resolveConcreteVariantOption(option);
  } catch (error) {
    if (error instanceof ConcreteVariantDefinitionError) {
      throw new ORPCError("BAD_REQUEST", { message: error.message });
    }
    throw error;
  }
}

export function isConcreteVariantOption(option: VariantOptionRow) {
  try {
    resolveConcreteVariantOption(option);
    return true;
  } catch {
    return false;
  }
}

export function getGeneratedVariantOrderMin(productData: {
  minimumOrderEnabled?: boolean;
  minimumOrderQty?: string | null;
}) {
  return productData.minimumOrderEnabled === false
    ? "1"
    : productData.minimumOrderQty || "1";
}

export function getGeneratedVariantOrderUnit(
  productData: {
    inventoryUnit?: string | null;
    inventoryLooseUnitEnabled?: boolean;
    inventoryLooseUnit?: string | null;
  },
  option:
    | { unit?: string | null; variantType?: "pack" | "loose" | string | null }
    | undefined,
) {
  const resolved = resolveVariantOption(option);
  if (resolved.definition) return resolved.orderUnit;
  if (
    option?.variantType === "loose" &&
    productData.inventoryLooseUnitEnabled
  ) {
    return (
      productData.inventoryLooseUnit ||
      productData.inventoryUnit ||
      option.unit ||
      "piece"
    );
  }

  return productData.inventoryUnit || option?.unit || "piece";
}

/** Refresh canonical metadata without replacing generated rows or commercial data. */
export async function resyncGeneratedVariantsForOption(
  client: DbClient,
  option: VariantOptionRow,
) {
  const resolved = resolveConcreteVariantForConfig(option);
  await client
    .update(productVariant)
    .set({
      unitLabel: resolved.label,
      quantitySelectorLabel: resolved.label,
      packagingType: resolved.packagingType,
      weightKg: resolved.weightKg,
      orderUnit: resolved.orderUnit,
      packType: resolved.packType,
      packWeightKg: resolved.weightKg || null,
      sellUnit: resolved.label,
      updatedAt: new Date(),
    })
    .where(eq(productVariant.sourceVariantOptionId, option.id));
}

/**
 * Build the auto-generated product_variant rows for a set of freshly
 * inserted product_variant_price rows. One variant per price row, carrying
 * sourceVariantPriceId/sourceVariantOptionId so re-syncs can find them.
 */
export function buildAutoVariantRows(params: {
  productId: number;
  insertedPrices: VariantPriceRow[];
  voMap: Record<number, VariantOptionRow>;
  settings: GeneratedVariantProductSettings;
  sortOrderOffset?: number;
}) {
  const { productId, insertedPrices, voMap, settings } = params;
  const offset = params.sortOrderOffset ?? 0;
  const generatedOrderMin = getGeneratedVariantOrderMin(settings);

  return insertedPrices.map((pvp, idx) => {
    const vo = voMap[pvp.variantOptionId];
    const resolved = resolveConcreteVariantForConfig(vo);
    const weightKg = resolved.weightKg || "0";

    return {
      productId,
      brandId: pvp.brandId || null,
      sku: `CP-${productId}-B${pvp.brandId ?? 0}-VO-${pvp.variantOptionId}`,
      unitLabel: resolved.label,
      quantitySelectorLabel: resolved.label,
      packagingType: resolved.packagingType,
      weightKg,
      price: pvp.consumerPrice || "0",
      orderMin: generatedOrderMin,
      orderUnit: getGeneratedVariantOrderUnit(settings, vo),
      packType: resolved.packType,
      packWeightKg: weightKg || null,
      sellUnit: resolved.label,
      sourceVariantPriceId: pvp.id,
      sourceVariantOptionId: pvp.variantOptionId,
      stockQuantity: 0,
      reorderLevel: 0,
      sortOrder: offset + idx,
      isActive: pvp.isActive ?? true,
    };
  });
}

/**
 * Diff-sync the variant option set of a single-brand product.
 *
 * - Options in `variantOptionIds` without a price row → insert price row +
 *   auto-generated variant (stock starts at 0).
 * - Existing price rows whose option is no longer selected → deactivate the
 *   price row and its generated variants (never delete: stock, order history
 *   and consumer prices survive; re-selecting reactivates the same rows).
 * - Previously deactivated rows whose option is selected again → reactivate.
 *
 * Existing rows keep their consumerPrice untouched.
 */
export async function syncBrandVariantPrices(
  client: DbClient,
  params: {
    productId: number;
    brandId: number;
    variants: Array<{
      variantOptionId: number;
      consumerPrice: string;
    }>;
    settings: GeneratedVariantProductSettings;
  },
) {
  const { productId, brandId, variants, settings } = params;
  const desiredVariantOptionIds = variants.map(
    (variant) => variant.variantOptionId,
  );
  if (
    new Set(desiredVariantOptionIds).size !== desiredVariantOptionIds.length
  ) {
    throw new Error("Duplicate variant options are not allowed");
  }
  const target = new Set(desiredVariantOptionIds);
  const desiredByOption = new Map(
    variants.map((variant) => [variant.variantOptionId, variant]),
  );

  const existing = await client
    .select()
    .from(productVariantPrice)
    .where(eq(productVariantPrice.productId, productId));

  const existingByOption = new Map(
    existing.map((row) => [row.variantOptionId, row]),
  );

  const toDeactivate = existing.filter(
    (row) => !target.has(row.variantOptionId) && row.isActive,
  );
  const toReactivate = existing.filter(
    (row) => target.has(row.variantOptionId) && !row.isActive,
  );
  const toAdd = desiredVariantOptionIds.filter(
    (voId) => !existingByOption.has(voId),
  );
  const retained = existing.filter((row) => target.has(row.variantOptionId));
  const selectedVariantOptions =
    desiredVariantOptionIds.length > 0
      ? await client
          .select()
          .from(variantOption)
          .where(inArray(variantOption.id, desiredVariantOptionIds))
      : [];
  const voMap = Object.fromEntries(
    selectedVariantOptions.map((option) => [option.id, option]),
  );

  if (toDeactivate.length > 0) {
    const priceIds = toDeactivate.map((row) => row.id);
    await client
      .update(productVariantPrice)
      .set({ isActive: false })
      .where(inArray(productVariantPrice.id, priceIds));
    await client
      .update(productVariant)
      .set({ isActive: false })
      .where(inArray(productVariant.sourceVariantPriceId, priceIds));
  }

  if (toReactivate.length > 0) {
    const priceIds = toReactivate.map((row) => row.id);
    await client
      .update(productVariantPrice)
      .set({ isActive: true })
      .where(inArray(productVariantPrice.id, priceIds));
    await client
      .update(productVariant)
      .set({ isActive: true })
      .where(inArray(productVariant.sourceVariantPriceId, priceIds));
  }

  for (const row of retained) {
    const desired = desiredByOption.get(row.variantOptionId)!;
    const consumerPrice = desired.consumerPrice || "0";
    if (row.consumerPrice !== consumerPrice || row.brandId !== brandId) {
      await client
        .update(productVariantPrice)
        .set({ consumerPrice, brandId })
        .where(eq(productVariantPrice.id, row.id));
    }
    const option = voMap[row.variantOptionId];
    const resolved = resolveConcreteVariantForConfig(option);
    await client
      .update(productVariant)
      .set({
        price: consumerPrice,
        brandId,
        orderMin: getGeneratedVariantOrderMin(settings),
        unitLabel: resolved.label,
        quantitySelectorLabel: resolved.label,
        packagingType: resolved.packagingType,
        weightKg: resolved.weightKg,
        orderUnit: resolved.orderUnit,
        packType: resolved.packType,
        packWeightKg: resolved.weightKg || null,
        sellUnit: resolved.label,
        isActive: true,
      })
      .where(eq(productVariant.sourceVariantPriceId, row.id));
  }

  if (toAdd.length > 0) {
    const maxSortOrder = existing.reduce(
      (max, row) => Math.max(max, row.sortOrder ?? 0),
      -1,
    );

    const insertedPrices = await client
      .insert(productVariantPrice)
      .values(
        toAdd.map((voId, idx) => ({
          productId,
          variantOptionId: voId,
          brandId,
          consumerPrice: desiredByOption.get(voId)?.consumerPrice || "0",
          sortOrder: maxSortOrder + 1 + idx,
        })),
      )
      .returning();

    const autoVariantRows = buildAutoVariantRows({
      productId,
      insertedPrices,
      voMap,
      settings,
      sortOrderOffset: maxSortOrder + 1,
    });

    if (autoVariantRows.length > 0) {
      await client.insert(productVariant).values(autoVariantRows);
    }
  }

  return {
    added: toAdd.length,
    deactivated: toDeactivate.length,
    reactivated: toReactivate.length,
  };
}
