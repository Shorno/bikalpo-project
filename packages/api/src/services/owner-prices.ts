import { db } from "@bikalpo-project/db";
import {
  brand,
  category,
  coreProductIdentity,
  inventory,
  product,
  productType,
  productVariant,
  subCategory,
  variantOption,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  eq,
  ilike,
  inArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import {
  consumerPriceListPagedSchema,
  priceFromMinorUnits,
  priceInMinorUnits,
  resolveReferencePriceUpdate,
  type updateProductReferencePricesSchema,
} from "../consumer-price";
import { variantValueLabel } from "../routers/helpers/variant-value";

/**
 * Seller (retailer / wholesaler) selling prices, shaped like the admin
 * reference price list so both panels reuse the admin price table.
 *
 * A row is one owner inventory line: `variantPriceId` carries the inventory
 * id, the New price is `inventory.retail_price` and the Exchange price is the
 * New price minus the owner variant's exchange credit.
 */
export type PriceOwnerType = "shop" | "warehouse";

export const ownerPriceListSchema = consumerPriceListPagedSchema.omit({
  coreProductId: true,
});

export type OwnerPriceUpdateInput = z.infer<
  typeof updateProductReferencePricesSchema
>;

const brandName = sql<
  string | null
>`coalesce((SELECT b.name FROM brand b WHERE b.id = ${productVariant.brandId}), ${brand.name})`;

function money(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return (Number.isFinite(amount) && amount > 0 ? amount : 0).toFixed(2);
}

/**
 * Lowest retail price a shop may set: the variant's base price plus its
 * required margin (percent and/or fixed amount, whichever is higher).
 */
export function shopMinimumRetailPrice(variant: {
  price: string | null;
  minMarginPercent: string | null;
  minMarginAmount: string | null;
}) {
  const basePrice = Number(variant.price || 0);
  const minMarginPercent = Number(variant.minMarginPercent || 0);
  const minMarginAmount = Number(variant.minMarginAmount || 0);
  let minimumPrice = basePrice;
  if (minMarginPercent > 0) {
    minimumPrice = basePrice * (1 + minMarginPercent / 100);
  }
  if (minMarginAmount > 0) {
    minimumPrice = Math.max(minimumPrice, basePrice + minMarginAmount);
  }
  return { basePrice, minimumPrice };
}

export function createOwnerPriceService(database: typeof db) {
  function baseQuery() {
    return database
      .select({
        inventoryId: inventory.id,
        retailPrice: inventory.retailPrice,
        updatedAt: inventory.updatedAt,
        variantId: productVariant.id,
        variantPrice: productVariant.price,
        variantSku: productVariant.sku,
        unitLabel: productVariant.unitLabel,
        quantitySelectorLabel: productVariant.quantitySelectorLabel,
        orderUnit: productVariant.orderUnit,
        packType: productVariant.packType,
        packagingType: productVariant.packagingType,
        exchangeEnabled: productVariant.exchangeEnabled,
        exchangeCreditAmount: productVariant.exchangeCreditAmount,
        optionName: variantOption.name,
        optionUnit: variantOption.unit,
        optionSize: variantOption.size,
        optionDefinition: variantOption.definition,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productCatalogCode: product.catalogCode,
        creatorSource: product.creatorSource,
        createdById: product.createdById,
        typeId: productType.id,
        typeName: productType.name,
        categoryId: category.id,
        categoryName: category.name,
        subCategoryId: subCategory.id,
        subCategoryName: subCategory.name,
        coreProductName: coreProductIdentity.name,
        coreCatalogCode: coreProductIdentity.catalogCode,
        brandName: brandName.as("owner_price_brand_name"),
      })
      .from(inventory)
      .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
      .innerJoin(product, eq(productVariant.productId, product.id))
      .leftJoin(
        variantOption,
        eq(productVariant.sourceVariantOptionId, variantOption.id),
      )
      .leftJoin(category, eq(product.categoryId, category.id))
      .leftJoin(productType, eq(category.typeId, productType.id))
      .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
      .leftJoin(
        coreProductIdentity,
        eq(product.coreProductId, coreProductIdentity.id),
      )
      .leftJoin(brand, eq(product.brandId, brand.id));
  }

  function ownerConditions(ownerType: PriceOwnerType, ownerId: string) {
    return [
      eq(inventory.ownerType, ownerType),
      eq(inventory.ownerId, ownerId),
      eq(productVariant.isActive, true),
    ];
  }

  function listConditions(
    ownerType: PriceOwnerType,
    ownerId: string,
    input: z.infer<typeof ownerPriceListSchema>,
  ) {
    const conditions: SQL[] = ownerConditions(ownerType, ownerId);
    if (input.search?.trim()) {
      const search = `%${input.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(
        or(
          ilike(product.name, search),
          ilike(product.sku, search),
          ilike(product.catalogCode, search),
          ilike(coreProductIdentity.name, search),
          ilike(coreProductIdentity.catalogCode, search),
          ilike(brand.name, search),
          ilike(productVariant.sku, search),
          ilike(productVariant.preferredLocalSku, search),
          ilike(productVariant.unitLabel, search),
          sql`EXISTS (SELECT 1 FROM brand b WHERE b.id = ${productVariant.brandId} AND b.name ILIKE ${search})`,
        )!,
      );
    }
    if (input.typeId != null) conditions.push(eq(category.typeId, input.typeId));
    if (input.categoryId != null)
      conditions.push(eq(product.categoryId, input.categoryId));
    if (input.subCategoryId != null)
      conditions.push(eq(product.subCategoryId, input.subCategoryId));
    return and(...conditions);
  }

  type BaseRow = Awaited<ReturnType<ReturnType<typeof baseQuery>["execute"]>>[number];

  function toPriceRow(row: BaseRow, ownerType: PriceOwnerType, ownerId: string) {
    const consumerPrice = money(row.retailPrice ?? row.variantPrice);
    const credit = money(row.exchangeCreditAmount);
    const option = row.optionName
      ? {
          name: row.optionName,
          unit: row.optionUnit,
          size: row.optionSize,
          definition: row.optionDefinition,
        }
      : null;
    const variantName =
      row.quantitySelectorLabel?.trim() ||
      row.unitLabel?.trim() ||
      row.variantSku ||
      "Variant";
    return {
      variantPriceId: row.inventoryId,
      variantId: row.variantId,
      productId: row.productId,
      productName: row.productName,
      productSku: row.productSku,
      productCatalogCode: row.productCatalogCode,
      coreCatalogCode: row.coreCatalogCode,
      consumerPrice,
      exchangeEnabled: row.exchangeEnabled,
      exchangeCreditAmount: credit,
      exchangePrice: row.exchangeEnabled
        ? priceFromMinorUnits(
            Math.max(
              0,
              priceInMinorUnits(consumerPrice) - priceInMinorUnits(credit),
            ),
          )
        : null,
      isCylinderPricing:
        row.exchangeEnabled ||
        row.packType === "cylinder" ||
        row.packagingType === "cylinder",
      // Exchange credit lives on the variant; only its creator may change it.
      canEditExchange:
        row.creatorSource === ownerType && row.createdById === ownerId,
      brandDisplay: row.brandName ?? "—",
      variantName,
      variantValue: option ? variantValueLabel(option) : variantName,
      variantUnit: row.optionUnit ?? row.orderUnit,
      updatedAt: row.updatedAt,
      // Owner prices keep no editor history.
      updatedById: null as string | null,
      typeName: row.typeName ?? "Uncategorized",
      categoryName: row.categoryName ?? "—",
      subCategoryName: row.subCategoryName ?? "—",
    };
  }

  const ordering = [
    asc(productType.name),
    asc(category.name),
    asc(coreProductIdentity.name),
    asc(product.name),
  ];

  /** Page by product so every variant of a product stays together. */
  async function listOwnerPrices(
    ownerType: PriceOwnerType,
    ownerId: string,
    input: z.infer<typeof ownerPriceListSchema>,
  ) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const where = listConditions(ownerType, ownerId, input);
    // Aggregate over the joins directly: a subquery of baseQuery() would
    // repeat column names (id, name) and Postgres rejects the reference.
    const [stats] = await database
      .select({
        totalGroups: sql<number>`count(distinct ${product.id})::int`,
        totalVariants: sql<number>`count(*)::int`,
        lastUpdated: sql<string | null>`max(${inventory.updatedAt})`,
      })
      .from(inventory)
      .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
      .innerJoin(product, eq(productVariant.productId, product.id))
      .leftJoin(category, eq(product.categoryId, category.id))
      .leftJoin(
        coreProductIdentity,
        eq(product.coreProductId, coreProductIdentity.id),
      )
      .leftJoin(brand, eq(product.brandId, brand.id))
      .where(where);
    const totalGroups = stats?.totalGroups ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalGroups / limit));
    const safePage = Math.min(page, totalPages);

    const productPage = await database
      .select({ productId: product.id })
      .from(inventory)
      .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
      .innerJoin(product, eq(productVariant.productId, product.id))
      .leftJoin(category, eq(product.categoryId, category.id))
      .leftJoin(productType, eq(category.typeId, productType.id))
      .leftJoin(
        coreProductIdentity,
        eq(product.coreProductId, coreProductIdentity.id),
      )
      .leftJoin(brand, eq(product.brandId, brand.id))
      .where(where)
      .groupBy(
        product.id,
        productType.name,
        category.name,
        coreProductIdentity.name,
        product.name,
      )
      .orderBy(...ordering, asc(product.id))
      .limit(limit)
      .offset((safePage - 1) * limit);
    const productIds = productPage.map((row) => row.productId);

    const rows = productIds.length
      ? await baseQuery()
          .where(and(where, inArray(product.id, productIds)))
          .orderBy(
            ...ordering,
            asc(product.id),
            asc(productVariant.sortOrder),
            asc(inventory.id),
          )
      : [];

    return {
      items: rows.map((row) => toPriceRow(row, ownerType, ownerId)),
      stats: {
        totalProducts: totalGroups,
        totalVariants: stats?.totalVariants ?? 0,
        lastUpdated: stats?.lastUpdated ?? null,
      },
      pagination: {
        page: safePage,
        limit,
        totalGroups,
        totalPages,
      },
    };
  }

  /** Type → Category → Sub-Category options from this owner's own products. */
  async function listOwnerPriceFilters(
    ownerType: PriceOwnerType,
    ownerId: string,
  ) {
    const rows = await database
      .selectDistinct({
        typeId: productType.id,
        typeName: productType.name,
        categoryId: category.id,
        categoryName: category.name,
        subCategoryId: subCategory.id,
        subCategoryName: subCategory.name,
      })
      .from(inventory)
      .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
      .innerJoin(product, eq(productVariant.productId, product.id))
      .innerJoin(category, eq(product.categoryId, category.id))
      .leftJoin(productType, eq(category.typeId, productType.id))
      .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
      .where(and(...ownerConditions(ownerType, ownerId)));

    const types = new Map<number, { id: number; name: string }>();
    const categories = new Map<
      number,
      {
        id: number;
        name: string;
        typeId: number | null;
        subCategory: { id: number; name: string }[];
      }
    >();
    for (const row of rows) {
      if (row.typeId != null && row.typeName)
        types.set(row.typeId, { id: row.typeId, name: row.typeName });
      const entry = categories.get(row.categoryId) ?? {
        id: row.categoryId,
        name: row.categoryName,
        typeId: row.typeId,
        subCategory: [],
      };
      if (
        row.subCategoryId != null &&
        row.subCategoryName &&
        !entry.subCategory.some((sub) => sub.id === row.subCategoryId)
      ) {
        entry.subCategory.push({
          id: row.subCategoryId,
          name: row.subCategoryName,
        });
      }
      categories.set(row.categoryId, entry);
    }
    const byName = (a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name, "en", { numeric: true });
    return {
      types: [...types.values()].sort(byName),
      categories: [...categories.values()].sort(byName).map((entry) => ({
        ...entry,
        subCategory: entry.subCategory.sort(byName),
      })),
    };
  }

  /**
   * Validate a product-wide edit and resolve what changes. Nothing is
   * written here, so a bad row rejects the whole save before any update.
   */
  async function planOwnerProductPriceUpdate(
    ownerType: PriceOwnerType,
    ownerId: string,
    input: OwnerPriceUpdateInput,
  ) {
    const inventoryIds = input.rows.map((row) => row.variantPriceId);
    const existing = await database
      .select({
        inventoryId: inventory.id,
        retailPrice: inventory.retailPrice,
        variantId: productVariant.id,
        variantPrice: productVariant.price,
        minMarginPercent: productVariant.minMarginPercent,
        minMarginAmount: productVariant.minMarginAmount,
        unitLabel: productVariant.unitLabel,
        packType: productVariant.packType,
        packagingType: productVariant.packagingType,
        exchangeEnabled: productVariant.exchangeEnabled,
        exchangeCreditAmount: productVariant.exchangeCreditAmount,
        productId: product.id,
        creatorSource: product.creatorSource,
        createdById: product.createdById,
      })
      .from(inventory)
      .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
      .innerJoin(product, eq(productVariant.productId, product.id))
      .where(
        and(
          ...ownerConditions(ownerType, ownerId),
          inArray(inventory.id, inventoryIds),
        ),
      );
    const byId = new Map(existing.map((row) => [row.inventoryId, row]));

    return input.rows.flatMap((row) => {
      const current = byId.get(row.variantPriceId);
      if (!current || current.productId !== input.productId) {
        throw new ORPCError("NOT_FOUND", {
          message: "A variant in this product is no longer in your price list. Refresh and try again.",
        });
      }
      const label = current.unitLabel || "Variant";
      const currentCredit = money(current.exchangeCreditAmount);
      let resolved: ReturnType<typeof resolveReferencePriceUpdate>;
      try {
        resolved = resolveReferencePriceUpdate(row, {
          isCylinderPricing:
            current.exchangeEnabled ||
            current.packType === "cylinder" ||
            current.packagingType === "cylinder",
          exchangeEnabled: current.exchangeEnabled,
          exchangeCreditAmount: currentCredit,
        });
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          message: `${label}: ${error instanceof Error ? error.message : "Enter valid prices"}`,
        });
      }

      if (ownerType === "shop") {
        const { basePrice, minimumPrice } = shopMinimumRetailPrice({
          price: current.variantPrice,
          minMarginPercent: current.minMarginPercent,
          minMarginAmount: current.minMarginAmount,
        });
        if (Number(resolved.consumerPrice) < minimumPrice) {
          throw new ORPCError("BAD_REQUEST", {
            message: `${label}: Price must be at least ৳${minimumPrice.toFixed(2)} (base ৳${basePrice.toFixed(2)} + required margin)`,
          });
        }
      }

      const priceChanged =
        money(current.retailPrice ?? current.variantPrice) !==
          resolved.consumerPrice || current.retailPrice == null;
      const exchangeChanged =
        resolved.exchangeEnabled !== current.exchangeEnabled ||
        (resolved.exchangeEnabled &&
          resolved.exchangeCreditAmount !== currentCredit);
      if (
        exchangeChanged &&
        (current.creatorSource !== ownerType ||
          current.createdById !== ownerId)
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: `${label}: The Exchange price for this variant is not managed by your store.`,
        });
      }
      if (!priceChanged && !exchangeChanged) return [];
      return [
        {
          inventoryId: current.inventoryId,
          variantId: current.variantId,
          retailPrice: priceChanged ? resolved.consumerPrice : null,
          exchange: exchangeChanged
            ? {
                exchangeEnabled: resolved.exchangeEnabled,
                exchangeCreditAmount: resolved.exchangeCreditAmount,
              }
            : null,
        },
      ];
    });
  }

  return {
    listOwnerPrices,
    listOwnerPriceFilters,
    planOwnerProductPriceUpdate,
  };
}

export type OwnerPriceChange = Awaited<
  ReturnType<
    ReturnType<typeof createOwnerPriceService>["planOwnerProductPriceUpdate"]
  >
>[number];

export const ownerPriceService = createOwnerPriceService(db);
