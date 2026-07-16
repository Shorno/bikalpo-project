import { db } from "@bikalpo-project/db";
import {
  brand,
  catalogVariant,
  category,
  coreProductIdentity,
  inventory,
  product,
  productType,
  productVariant,
  variantOption,
  warehouseVariantAlias,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, isNotNull, or, type SQL, sql } from "drizzle-orm";

import type { StructuredBrandStockSourceRow } from "./structured-stock-overview";

export type InventoryOwnerType = "warehouse" | "shop" | "super_seller";

/**
 * Loads stock rows with the Admin-owned variant definition attached. Keeping
 * this query shared ensures every owner dashboard interprets units and
 * movement semantics from the same source data.
 */
export async function loadStructuredBrandStockRows(
  input: {
    ownerType: InventoryOwnerType;
    brandId?: number;
    categoryId?: number;
    search?: string;
  },
  ownerId: string,
): Promise<StructuredBrandStockSourceRow[]> {
  const inventoryScope = and(
    eq(inventory.variantId, productVariant.id),
    eq(inventory.ownerType, input.ownerType),
    eq(inventory.ownerId, ownerId),
  );
  const conditions: SQL[] = [
    eq(product.status, "active"),
    eq(productVariant.isActive, true),
  ];

  if (input.ownerType === "warehouse") {
    const ownerCondition = or(
      eq(product.createdById, ownerId),
      eq(product.createdByWarehouseId, ownerId),
    );
    conditions.push(eq(product.creatorSource, "warehouse"));
    if (ownerCondition) conditions.push(ownerCondition);
  } else if (input.ownerType === "shop") {
    conditions.push(isNotNull(inventory.id));
    conditions.push(eq(product.creatorSource, "shop"));
    conditions.push(eq(product.createdById, ownerId));
  } else {
    conditions.push(isNotNull(inventory.id));
  }
  if (input.brandId !== undefined) {
    conditions.push(eq(brand.id, input.brandId));
  }
  if (input.categoryId !== undefined) {
    conditions.push(eq(product.categoryId, input.categoryId));
  }
  const search = input.search?.trim();
  if (search) {
    const term = `%${search}%`;
    const searchCondition = or(
      sql`${brand.name} ILIKE ${term}`,
      sql`${product.name} ILIKE ${term}`,
      sql`${coreProductIdentity.name} ILIKE ${term}`,
      sql`${productVariant.sku} ILIKE ${term}`,
      sql`${catalogVariant.globalSku} ILIKE ${term}`,
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      productId: product.id,
      productName: product.name,
      productImage: product.image,
      productStatus: product.status,
      productReorderLevel: product.reorderLevel,
      coreProductId: product.coreProductId,
      coreProductName: coreProductIdentity.name,
      coreProductSku: coreProductIdentity.sku,
      coreProductImage: coreProductIdentity.image,
      categoryId: category.id,
      categoryName: category.name,
      productTypeName: productType.name,
      family: productType.family,
      variantId: productVariant.id,
      variantSku: productVariant.sku,
      preferredLocalSku: productVariant.preferredLocalSku,
      catalogVariantId: productVariant.catalogVariantId,
      globalSku: catalogVariant.globalSku,
      variantIsActive: productVariant.isActive,
      variantReorderLevel: productVariant.reorderLevel,
      sourceVariantOptionId: productVariant.sourceVariantOptionId,
      sourceOptionName: variantOption.name,
      sourceOptionUnit: variantOption.unit,
      sourceOptionSize: variantOption.size,
      sourceOptionVariantType: variantOption.variantType,
      sourceOptionDefinitionKind: variantOption.definitionKind,
      sourceOptionDefinition: variantOption.definition,
      sourceOptionDisplayAlias: variantOption.displayAlias,
      sourceOptionNeedsReview: variantOption.needsReview,
      availableQty: inventory.availableQty,
      reservedQty: inventory.reservedQty,
      retailPrice: inventory.retailPrice,
      brandId: brand.id,
      brandName: brand.name,
      brandLogo: brand.logo,
      brandSlug: brand.slug,
    })
    .from(productVariant)
    .innerJoin(product, eq(productVariant.productId, product.id))
    .leftJoin(inventory, inventoryScope)
    .leftJoin(
      coreProductIdentity,
      eq(product.coreProductId, coreProductIdentity.id),
    )
    .innerJoin(category, eq(product.categoryId, category.id))
    .leftJoin(productType, eq(category.typeId, productType.id))
    .innerJoin(
      brand,
      eq(
        brand.id,
        sql`COALESCE(${productVariant.brandId}, ${product.brandId})`,
      ),
    )
    .leftJoin(
      variantOption,
      eq(productVariant.sourceVariantOptionId, variantOption.id),
    )
    .leftJoin(
      catalogVariant,
      eq(productVariant.catalogVariantId, catalogVariant.id),
    )
    .where(and(...conditions))
    .orderBy(
      brand.name,
      coreProductIdentity.name,
      product.name,
      variantOption.sortOrder,
      productVariant.sortOrder,
    );

  const coreProductIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.coreProductId === null ? [] : [row.coreProductId],
      ),
    ),
  ];
  const aliases =
    input.ownerType === "warehouse" && coreProductIds.length > 0
      ? await db.query.warehouseVariantAlias.findMany({
          where: and(
            eq(warehouseVariantAlias.warehouseId, ownerId),
            inArray(warehouseVariantAlias.coreProductId, coreProductIds),
          ),
          columns: {
            coreProductId: true,
            variantOptionId: true,
            alias: true,
          },
        })
      : [];
  const aliasMap = new Map(
    aliases.map((entry) => [
      `${entry.coreProductId}:${entry.variantOptionId}`,
      entry.alias,
    ]),
  );

  return rows.map((row) => ({
    productId: row.productId,
    variantId: row.variantId,
    coreProductId: row.coreProductId,
    coreProductName: row.coreProductName,
    coreProductSku: row.coreProductSku,
    coreProductImage: row.coreProductImage,
    productName: row.productName,
    productImage: row.productImage,
    productIsActive: row.productStatus === "active",
    productTypeName: row.productTypeName,
    brandId: row.brandId,
    brandName: row.brandName,
    brandLogo: row.brandLogo,
    brandSlug: row.brandSlug,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    family: row.family,
    sku: row.variantSku,
    catalogVariantId: row.catalogVariantId,
    globalSku: row.globalSku,
    localSku: row.preferredLocalSku ?? row.variantSku,
    variantIsActive: row.variantIsActive,
    sourceVariantOptionId: row.sourceVariantOptionId,
    sourceVariantOption:
      row.sourceVariantOptionId === null
        ? null
        : {
            name: row.sourceOptionName,
            unit: row.sourceOptionUnit,
            size: row.sourceOptionSize,
            variantType: row.sourceOptionVariantType,
            definitionKind: row.sourceOptionDefinitionKind,
            definition: row.sourceOptionDefinition,
            displayAlias: row.sourceOptionDisplayAlias,
            needsReview: row.sourceOptionNeedsReview,
          },
    displayAlias:
      row.coreProductId && row.sourceVariantOptionId
        ? (aliasMap.get(`${row.coreProductId}:${row.sourceVariantOptionId}`) ??
          null)
        : null,
    availableQty: row.availableQty,
    reservedQty: row.reservedQty,
    warehouseSellingPrice: row.retailPrice,
    variantReorderLevel: row.variantReorderLevel,
    productReorderLevel: row.productReorderLevel,
  }));
}
