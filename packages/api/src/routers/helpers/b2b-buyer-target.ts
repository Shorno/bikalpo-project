import {
  catalogVariant,
  inventory,
  product,
  productBrand,
  productVariant,
  productVariantPrice,
} from "@bikalpo-project/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { resolveConcreteVariantForConfig } from "./sync-generated-variants";

type OwnerType = "shop" | "warehouse";

type VariantIdentity = {
  id: number;
  catalogVariantId: number | null;
  sourceVariantOptionId: number | null;
  linkedRetailVariantId: number | null;
  brandId: number | null;
  sku: string | null;
  product: {
    id: number;
    coreProductId: number | null;
    brandId: number | null;
    creatorSource: string;
    createdById: string | null;
  };
};

function effectiveBrandId(variant: VariantIdentity) {
  return variant.brandId ?? variant.product.brandId ?? null;
}

async function lockIdentity(
  tx: any,
  input: {
    ownerType?: OwnerType;
    ownerId?: string;
    coreProductId: number;
    brandId: number | null;
    variantOptionId: number;
  },
) {
  const key = [
    "b2b-variant",
    input.ownerType ?? "catalog",
    input.ownerId ?? "global",
    input.coreProductId,
    input.brandId ?? 0,
    input.variantOptionId,
  ].join(":");
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
  );
}

async function loadVariantIdentity(tx: any, variantId: number) {
  return (await tx.query.productVariant.findFirst({
    where: eq(productVariant.id, variantId),
    columns: {
      id: true,
      catalogVariantId: true,
      sourceVariantOptionId: true,
      linkedRetailVariantId: true,
      brandId: true,
      sku: true,
    },
    with: {
      product: {
        columns: {
          id: true,
          coreProductId: true,
          brandId: true,
          creatorSource: true,
          createdById: true,
        },
      },
    },
  })) as VariantIdentity | undefined;
}

export async function ensureCatalogVariantForVariant(
  tx: any,
  variantId: number,
) {
  const source = await loadVariantIdentity(tx, variantId);
  if (!source) throw new Error(`Variant ${variantId} was not found`);
  if (!source.product.coreProductId || !source.sourceVariantOptionId) {
    throw new Error(
      `Variant ${variantId} is missing its Admin product or variant identity`,
    );
  }

  if (source.catalogVariantId) {
    const existing = await tx.query.catalogVariant.findFirst({
      where: eq(catalogVariant.id, source.catalogVariantId),
    });
    if (!existing) {
      throw new Error(
        `Variant ${variantId} references a missing catalog variant`,
      );
    }
    return { source, catalog: existing };
  }

  const identity = {
    coreProductId: source.product.coreProductId,
    brandId: effectiveBrandId(source),
    variantOptionId: source.sourceVariantOptionId,
  };
  await lockIdentity(tx, identity);

  let canonical = await tx.query.catalogVariant.findFirst({
    where: and(
      eq(catalogVariant.coreProductId, identity.coreProductId),
      identity.brandId === null
        ? sql`${catalogVariant.brandId} IS NULL`
        : eq(catalogVariant.brandId, identity.brandId),
      eq(catalogVariant.variantOptionId, identity.variantOptionId),
    ),
  });

  if (!canonical) {
    [canonical] = await tx
      .insert(catalogVariant)
      .values({
        coreProductId: identity.coreProductId,
        brandId: identity.brandId,
        variantOptionId: identity.variantOptionId,
      })
      .returning();
  }
  if (!canonical) throw new Error("Could not create catalog variant identity");

  await tx
    .update(productVariant)
    .set({ catalogVariantId: canonical.id })
    .where(eq(productVariant.id, source.id));

  return {
    source: { ...source, catalogVariantId: canonical.id },
    catalog: canonical,
  };
}

async function uniqueProductSlug(tx: any, base: string) {
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 140);
  let slug = normalized || "retailer-product";
  let suffix = 2;
  while (
    await tx.query.product.findFirst({
      where: eq(product.slug, slug),
      columns: { id: true },
    })
  ) {
    slug = `${normalized}-${suffix++}`.slice(0, 150);
  }
  return slug;
}

/**
 * Ensure a retailer-owned operational variant exists before an order is saved.
 * The variant remains private and unpriced until the retailer configures it.
 */
export async function ensureShopBuyerTargetVariant(
  tx: any,
  input: {
    shopId: string;
    sourceVariantId: number;
    requestedTargetVariantId?: number | null;
  },
) {
  const source = await loadVariantIdentity(tx, input.sourceVariantId);
  if (!source)
    throw new Error(`Variant ${input.sourceVariantId} was not found`);

  const targetSeedId =
    input.requestedTargetVariantId ?? source.linkedRetailVariantId ?? source.id;
  const seed = await loadVariantIdentity(tx, targetSeedId);
  if (!seed) throw new Error(`Target variant ${targetSeedId} was not found`);
  if (!seed.product.coreProductId || !seed.sourceVariantOptionId) {
    throw new Error(
      `Target variant ${targetSeedId} is missing its Admin product or variant identity`,
    );
  }

  const [{ catalog: sourceCatalog }, { catalog: targetCatalog }] =
    await Promise.all([
      ensureCatalogVariantForVariant(tx, source.id),
      ensureCatalogVariantForVariant(tx, seed.id),
    ]);

  const targetBrandId = effectiveBrandId(seed);
  await lockIdentity(tx, {
    ownerType: "shop",
    ownerId: input.shopId,
    coreProductId: seed.product.coreProductId,
    brandId: targetBrandId,
    variantOptionId: seed.sourceVariantOptionId,
  });

  let targetProduct = await tx.query.product.findFirst({
    where: and(
      eq(product.creatorSource, "shop"),
      eq(product.createdById, input.shopId),
      eq(product.coreProductId, seed.product.coreProductId),
      targetBrandId === null
        ? sql`${product.brandId} IS NULL`
        : eq(product.brandId, targetBrandId),
    ),
    with: { variants: true },
  });

  if (!targetProduct) {
    const adminTemplate =
      (await tx.query.product.findFirst({
        where: and(
          eq(product.creatorSource, "admin"),
          eq(product.coreProductId, seed.product.coreProductId),
          targetBrandId === null
            ? sql`${product.brandId} IS NULL`
            : eq(product.brandId, targetBrandId),
        ),
      })) ??
      (await tx.query.product.findFirst({
        where: eq(product.id, seed.product.id),
      }));
    if (!adminTemplate) {
      throw new Error("Admin product template was not found for buyer setup");
    }

    const slug = await uniqueProductSlug(
      tx,
      `${adminTemplate.slug}-${input.shopId.slice(0, 6)}`,
    );
    const [created] = await tx
      .insert(product)
      .values({
        name: adminTemplate.name,
        slug,
        description: adminTemplate.description,
        categoryId: adminTemplate.categoryId,
        subCategoryId: adminTemplate.subCategoryId,
        brandId: targetBrandId,
        coreProductId: seed.product.coreProductId,
        size: adminTemplate.size,
        price: "0",
        reorderLevel: adminTemplate.reorderLevel,
        sku: `SHOP-${input.shopId.slice(0, 6)}-${seed.product.coreProductId}-${targetBrandId ?? 0}`,
        supplier: null,
        image: adminTemplate.image,
        shortDescription: adminTemplate.shortDescription,
        videoUrl: adminTemplate.videoUrl,
        features: adminTemplate.features,
        inStock: false,
        isFeatured: false,
        isReturnablePack: adminTemplate.isReturnablePack,
        defaultPackDepositAmount: adminTemplate.defaultPackDepositAmount,
        allowedPackBrands: adminTemplate.allowedPackBrands,
        allowedPackSizes: adminTemplate.allowedPackSizes,
        returnPolicyEnabled: adminTemplate.returnPolicyEnabled,
        trackingType: adminTemplate.trackingType,
        expiryEnabled: adminTemplate.expiryEnabled,
        damageControlEnabled: adminTemplate.damageControlEnabled,
        stockTrackingEnabled: adminTemplate.stockTrackingEnabled,
        minimumOrderEnabled: adminTemplate.minimumOrderEnabled,
        minimumOrderQty: adminTemplate.minimumOrderQty,
        inventoryUnit: adminTemplate.inventoryUnit,
        conversionEnabled: adminTemplate.conversionEnabled,
        inventoryLooseUnitEnabled: adminTemplate.inventoryLooseUnitEnabled,
        inventoryLooseUnit: adminTemplate.inventoryLooseUnit,
        visibility: "private",
        status: "active",
        creatorSource: "shop",
        createdById: input.shopId,
        derivedFromProductId: adminTemplate.id,
      })
      .returning();
    if (!created) throw new Error("Could not create retailer product mapping");
    targetProduct = { ...created, variants: [] } as any;

    if (targetBrandId !== null) {
      await tx
        .insert(productBrand)
        .values({ productId: created.id, brandId: targetBrandId })
        .onConflictDoNothing();
    }
  }

  let targetVariant = targetProduct.variants.find(
    (variant: any) =>
      variant.catalogVariantId === targetCatalog.id ||
      variant.sourceVariantOptionId === seed.sourceVariantOptionId,
  );

  if (targetVariant) {
    if (targetVariant.catalogVariantId !== targetCatalog.id) {
      await tx
        .update(productVariant)
        .set({ catalogVariantId: targetCatalog.id, isActive: true })
        .where(eq(productVariant.id, targetVariant.id));
      targetVariant = {
        ...targetVariant,
        catalogVariantId: targetCatalog.id,
      };
    }
  } else {
    const option = await tx.query.variantOption.findFirst({
      where: (row: any, { eq: equals }: any) =>
        equals(row.id, seed.sourceVariantOptionId),
    });
    if (!option) throw new Error("Admin variant option was not found");
    const resolved = resolveConcreteVariantForConfig(option);

    let priceRow = await tx.query.productVariantPrice.findFirst({
      where: and(
        eq(productVariantPrice.productId, targetProduct.id),
        eq(productVariantPrice.variantOptionId, option.id),
        targetBrandId === null
          ? sql`${productVariantPrice.brandId} IS NULL`
          : eq(productVariantPrice.brandId, targetBrandId),
      ),
    });
    if (!priceRow) {
      [priceRow] = await tx
        .insert(productVariantPrice)
        .values({
          productId: targetProduct.id,
          variantOptionId: option.id,
          brandId: targetBrandId,
          consumerPrice: "0",
          sortOrder: targetProduct.variants.length,
        })
        .returning();
    }

    [targetVariant] = await tx
      .insert(productVariant)
      .values({
        productId: targetProduct.id,
        brandId: targetBrandId,
        size: option.size ?? null,
        sku: `SHOP-${targetProduct.id}-B${targetBrandId ?? 0}-VO${option.id}-${targetProduct.variants.length}`,
        unitLabel: resolved.label,
        quantitySelectorLabel: resolved.label,
        packagingType: resolved.packagingType,
        weightKg: resolved.weightKg,
        price: "0",
        orderMin: targetProduct.minimumOrderEnabled
          ? targetProduct.minimumOrderQty
          : "1",
        orderUnit: resolved.orderUnit,
        packType: resolved.packType,
        packWeightKg: resolved.weightKg || null,
        sellUnit: resolved.label,
        variantType: "retail",
        orderType: "b2c",
        visibilityRole: "consumer",
        stockSource: "shop",
        sourceVariantPriceId: priceRow?.id ?? null,
        sourceVariantOptionId: option.id,
        catalogVariantId: targetCatalog.id,
        stockQuantity: 0,
        reorderLevel: 0,
        sortOrder: targetProduct.variants.length,
        isActive: true,
      })
      .returning();
  }
  if (!targetVariant)
    throw new Error("Could not create retailer target variant");

  await tx
    .insert(inventory)
    .values({
      ownerType: "shop",
      ownerId: input.shopId,
      variantId: targetVariant.id,
      availableQty: "0",
      reservedQty: "0",
      retailPrice: null,
    })
    .onConflictDoNothing({
      target: [inventory.ownerType, inventory.ownerId, inventory.variantId],
    });

  return {
    sourceCatalogVariantId: sourceCatalog.id,
    sourceGlobalSku: sourceCatalog.globalSku,
    sourceLocalSku: source.sku,
    targetCatalogVariantId: targetCatalog.id,
    targetVariantId: targetVariant.id,
    targetLocalSku: targetVariant.sku ?? null,
  };
}

/** Ensure a buyer warehouse receives into its own owner-specific variant. */
export async function ensureWarehouseBuyerTargetVariant(
  tx: any,
  input: {
    warehouseId: string;
    sourceVariantId: number;
    requestedTargetVariantId?: number | null;
  },
) {
  const source = await loadVariantIdentity(tx, input.sourceVariantId);
  if (!source)
    throw new Error(`Variant ${input.sourceVariantId} was not found`);
  const seedId =
    input.requestedTargetVariantId ?? source.linkedRetailVariantId ?? source.id;
  const seed = await loadVariantIdentity(tx, seedId);
  if (!seed?.product.coreProductId || !seed.sourceVariantOptionId) {
    throw new Error("Warehouse target is missing its Admin variant identity");
  }

  const [{ catalog: sourceCatalog }, { catalog: targetCatalog }] =
    await Promise.all([
      ensureCatalogVariantForVariant(tx, source.id),
      ensureCatalogVariantForVariant(tx, seed.id),
    ]);
  const brandId = effectiveBrandId(seed);
  await lockIdentity(tx, {
    ownerType: "warehouse",
    ownerId: input.warehouseId,
    coreProductId: seed.product.coreProductId,
    brandId,
    variantOptionId: seed.sourceVariantOptionId,
  });

  let targetProduct = await tx.query.product.findFirst({
    where: and(
      eq(product.creatorSource, "warehouse"),
      eq(product.createdById, input.warehouseId),
      eq(product.coreProductId, seed.product.coreProductId),
      brandId === null
        ? sql`${product.brandId} IS NULL`
        : eq(product.brandId, brandId),
    ),
    with: { variants: true },
  });

  if (!targetProduct) {
    const template =
      (await tx.query.product.findFirst({
        where: and(
          eq(product.creatorSource, "admin"),
          eq(product.coreProductId, seed.product.coreProductId),
          brandId === null
            ? sql`${product.brandId} IS NULL`
            : eq(product.brandId, brandId),
        ),
      })) ??
      (await tx.query.product.findFirst({
        where: eq(product.id, seed.product.id),
      }));
    if (!template) throw new Error("Warehouse product template was not found");
    const slug = await uniqueProductSlug(
      tx,
      `${template.slug}-${input.warehouseId.slice(0, 6)}`,
    );
    const [created] = await tx
      .insert(product)
      .values({
        name: template.name,
        slug,
        description: template.description,
        categoryId: template.categoryId,
        subCategoryId: template.subCategoryId,
        brandId,
        coreProductId: seed.product.coreProductId,
        size: template.size,
        price: template.price,
        reorderLevel: template.reorderLevel,
        sku: `WH-${input.warehouseId.slice(0, 6)}-${seed.product.coreProductId}-${brandId ?? 0}`,
        supplier: template.supplier,
        image: template.image,
        shortDescription: template.shortDescription,
        videoUrl: template.videoUrl,
        features: template.features,
        inStock: false,
        isFeatured: false,
        isReturnablePack: template.isReturnablePack,
        defaultPackDepositAmount: template.defaultPackDepositAmount,
        allowedPackBrands: template.allowedPackBrands,
        allowedPackSizes: template.allowedPackSizes,
        returnPolicyEnabled: template.returnPolicyEnabled,
        trackingType: template.trackingType,
        expiryEnabled: template.expiryEnabled,
        damageControlEnabled: template.damageControlEnabled,
        stockTrackingEnabled: template.stockTrackingEnabled,
        minimumOrderEnabled: template.minimumOrderEnabled,
        minimumOrderQty: template.minimumOrderQty,
        inventoryUnit: template.inventoryUnit,
        conversionEnabled: template.conversionEnabled,
        inventoryLooseUnitEnabled: template.inventoryLooseUnitEnabled,
        inventoryLooseUnit: template.inventoryLooseUnit,
        visibility: "private",
        status: "active",
        creatorSource: "warehouse",
        createdById: input.warehouseId,
        createdByWarehouseId: input.warehouseId,
        derivedFromProductId: template.id,
      })
      .returning();
    if (!created) throw new Error("Could not create buyer warehouse product");
    targetProduct = { ...created, variants: [] } as any;
    if (brandId !== null) {
      await tx
        .insert(productBrand)
        .values({ productId: created.id, brandId })
        .onConflictDoNothing();
    }
  }

  let targetVariant = targetProduct.variants.find(
    (variant: any) =>
      variant.catalogVariantId === targetCatalog.id ||
      variant.sourceVariantOptionId === seed.sourceVariantOptionId,
  );
  if (targetVariant) {
    if (targetVariant.catalogVariantId !== targetCatalog.id) {
      await tx
        .update(productVariant)
        .set({ catalogVariantId: targetCatalog.id, isActive: true })
        .where(eq(productVariant.id, targetVariant.id));
      targetVariant = { ...targetVariant, catalogVariantId: targetCatalog.id };
    }
  } else {
    const [option, seedVariant] = await Promise.all([
      tx.query.variantOption.findFirst({
        where: (row: any, { eq: equals }: any) =>
          equals(row.id, seed.sourceVariantOptionId),
      }),
      tx.query.productVariant.findFirst({
        where: eq(productVariant.id, seed.id),
      }),
    ]);
    if (!option || !seedVariant)
      throw new Error("Warehouse variant seed was not found");
    const resolved = resolveConcreteVariantForConfig(option);
    let priceRow = await tx.query.productVariantPrice.findFirst({
      where: and(
        eq(productVariantPrice.productId, targetProduct.id),
        eq(productVariantPrice.variantOptionId, option.id),
        brandId === null
          ? sql`${productVariantPrice.brandId} IS NULL`
          : eq(productVariantPrice.brandId, brandId),
      ),
    });
    if (!priceRow) {
      [priceRow] = await tx
        .insert(productVariantPrice)
        .values({
          productId: targetProduct.id,
          variantOptionId: option.id,
          brandId,
          consumerPrice: seedVariant.price,
          sortOrder: targetProduct.variants.length,
        })
        .returning();
    }
    [targetVariant] = await tx
      .insert(productVariant)
      .values({
        productId: targetProduct.id,
        brandId,
        size: option.size ?? seedVariant.size,
        sku: `WH-${targetProduct.id}-B${brandId ?? 0}-VO${option.id}-${targetProduct.variants.length}`,
        unitLabel: resolved.label,
        quantitySelectorLabel: resolved.label,
        packagingType: resolved.packagingType,
        weightKg: resolved.weightKg,
        price: seedVariant.price,
        orderMin: seedVariant.orderMin,
        orderMax: seedVariant.orderMax,
        orderIncrement: seedVariant.orderIncrement,
        orderUnit: resolved.orderUnit,
        packType: resolved.packType,
        packWeightKg: resolved.weightKg || null,
        sellUnit: resolved.label,
        variantType: "trade",
        orderType: "b2b",
        visibilityRole: "shop_owner",
        stockSource: "warehouse",
        sourceVariantPriceId: priceRow?.id ?? null,
        sourceVariantOptionId: option.id,
        catalogVariantId: targetCatalog.id,
        stockQuantity: 0,
        reorderLevel: seedVariant.reorderLevel,
        sortOrder: targetProduct.variants.length,
        isActive: true,
      })
      .returning();
  }
  if (!targetVariant)
    throw new Error("Could not create buyer warehouse target");

  return {
    sourceCatalogVariantId: sourceCatalog.id,
    sourceGlobalSku: sourceCatalog.globalSku,
    sourceLocalSku: source.sku,
    targetVariantId: targetVariant.id,
    targetLocalSku: targetVariant.sku ?? null,
  };
}

export async function assertInventoryVariantOwnedBy(
  tx: any,
  input: { ownerType: OwnerType; ownerId: string; variantId: number },
) {
  const identity = await loadVariantIdentity(tx, input.variantId);
  const expectedCreator = input.ownerType === "shop" ? "shop" : "warehouse";
  if (
    !identity ||
    identity.product.creatorSource !== expectedCreator ||
    identity.product.createdById !== input.ownerId
  ) {
    throw new Error(
      `${input.ownerType} inventory target must belong to the receiving owner`,
    );
  }
  return identity;
}
