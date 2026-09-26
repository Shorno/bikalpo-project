import { db } from "@bikalpo-project/db";
import {
  brand,
  category,
  consumerPriceLog,
  coreProductIdentity,
  product,
  productBrand,
  productType,
  productVariant,
  productVariantPrice,
  subCategory,
  variantOption,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import {
  type ConsumerPriceUpdate,
  type consumerPriceListPagedSchema,
  type consumerPriceListParamsSchema,
  importConsumerReferencePricesSchema,
  priceFromMinorUnits,
  priceInMinorUnits,
  resolveReferencePriceUpdate,
} from "../consumer-price";
import { variantValueLabel } from "../routers/helpers/variant-value";

// Correlation keeps one result per price even when multiple generated variants exist.
const linkedVariant = sql`pv.product_id = ${product.id} AND (
  pv.source_variant_price_id = ${productVariantPrice.id} OR (
    pv.source_variant_price_id IS NULL AND pv.source_variant_option_id = ${productVariantPrice.variantOptionId}
    AND pv.brand_id IS NOT DISTINCT FROM ${productVariantPrice.brandId}
  ))`;
const activeLinkedVariant = sql`${linkedVariant} AND pv.is_active = true`;
const isCylinderPricing = sql<boolean>`(
  coalesce(${variantOption.definition}->>'container', '') = 'cylinder'
  OR EXISTS (SELECT 1 FROM product_variant pv WHERE ${activeLinkedVariant}
    AND (pv.pack_type = 'cylinder' OR pv.packaging_type = 'cylinder' OR pv.exchange_enabled = true))
)`;
const exchangeEnabled = sql<boolean>`coalesce((SELECT pv.exchange_enabled FROM product_variant pv
  WHERE ${activeLinkedVariant} ORDER BY pv.id LIMIT 1), false)`;
const exchangeCredit = sql<string>`coalesce((SELECT pv.exchange_credit_amount FROM product_variant pv
  WHERE ${activeLinkedVariant} ORDER BY pv.id LIMIT 1), 0)::text`;
// Core identity is a filter; each expandable row represents one actual product.
const groupKey = sql<string>`'p:' || ${product.id}::text`;

export function createConsumerPriceService(database: typeof db) {
  function priceQuery() {
    return database
      .select({
        variantPriceId: productVariantPrice.id,
        consumerPrice: productVariantPrice.consumerPrice,
        updatedAt: productVariantPrice.updatedAt,
        productId: product.id,
        productName: sql<string>`${product.name}`.as("product_name"),
        productSku: product.sku,
        variantOptionId: variantOption.id,
        variantName: variantOption.name,
        variantUnit: variantOption.unit,
        variantSize: variantOption.size,
        variantDefinition: variantOption.definition,
        typeId: productType.id,
        typeName: sql<string | null>`${productType.name}`.as("type_name"),
        categoryId: category.id,
        categoryName: sql<string>`${category.name}`.as("category_name"),
        subCategoryName: subCategory.name,
        coreProductId: coreProductIdentity.id,
        coreProductName: sql<string | null>`${coreProductIdentity.name}`.as(
          "core_product_name",
        ),
        coreProductSku: coreProductIdentity.sku,
        primaryBrandName: brand.name,
        groupKey: groupKey.as("group_key"),
        isCylinderPricing: isCylinderPricing.as("is_cylinder_pricing"),
        exchangeEnabled: exchangeEnabled.as("exchange_enabled"),
        exchangeCreditAmount: exchangeCredit.as("exchange_credit_amount"),
        variantPriceBrandName: sql<
          string | null
        >`(SELECT b.name FROM brand b WHERE b.id = ${productVariantPrice.brandId})`.as(
          "variant_price_brand_name",
        ),
        updatedByName: sql<
          string | null
        >`(SELECT l.actor_name FROM consumer_price_log l
      WHERE l.variant_price_id = ${productVariantPrice.id} ORDER BY l.created_at DESC, l.id DESC LIMIT 1)`.as(
          "updated_by_name",
        ),
      })
      .from(productVariantPrice)
      .innerJoin(product, eq(productVariantPrice.productId, product.id))
      .innerJoin(
        variantOption,
        eq(productVariantPrice.variantOptionId, variantOption.id),
      )
      .innerJoin(category, eq(product.categoryId, category.id))
      .leftJoin(productType, eq(category.typeId, productType.id))
      .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
      .leftJoin(
        coreProductIdentity,
        eq(product.coreProductId, coreProductIdentity.id),
      )
      .leftJoin(brand, eq(product.brandId, brand.id));
  }

  function priceConditions(
    input: z.infer<typeof consumerPriceListParamsSchema>,
  ) {
    const conditions: SQL[] = [
      eq(productVariantPrice.isActive, true),
      eq(product.creatorSource, "admin"),
    ];
    if (input.search?.trim()) {
      // Treat user text literally, including SQL LIKE wildcard characters.
      const search = `%${input.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(
        or(
          ilike(product.name, search),
          ilike(product.sku, search),
          ilike(coreProductIdentity.sku, search),
          ilike(coreProductIdentity.name, search),
          ilike(variantOption.name, search),
          ilike(brand.name, search),
          sql`EXISTS (SELECT 1 FROM brand b WHERE b.id = ${productVariantPrice.brandId} AND b.name ILIKE ${search})`,
          // Scanned barcodes contain existing local or canonical catalog SKU identifiers.
          sql`EXISTS (SELECT 1 FROM product_variant pv LEFT JOIN catalog_variant cv ON cv.id = pv.catalog_variant_id
        WHERE ${activeLinkedVariant} AND (pv.sku ILIKE ${search} OR pv.preferred_local_sku ILIKE ${search} OR cv.global_sku ILIKE ${search}))`,
          sql`('PRD-' || lpad(${product.id}::text, 6, '0')) ILIKE ${search}`,
          sql`('CORE-' || lpad(${coreProductIdentity.id}::text, 6, '0')) ILIKE ${search}`,
        )!,
      );
    }
    if (input.typeId != null)
      conditions.push(eq(category.typeId, input.typeId));
    if (input.categoryId != null)
      conditions.push(eq(product.categoryId, input.categoryId));
    if (input.subCategoryId != null)
      conditions.push(eq(product.subCategoryId, input.subCategoryId));
    if (input.coreProductId != null)
      conditions.push(eq(product.coreProductId, input.coreProductId));
    return and(...conditions);
  }

  async function fetchPriceRows(where: SQL | undefined) {
    const rows = await priceQuery()
      .where(where)
      .orderBy(
        asc(productType.name),
        asc(category.name),
        asc(coreProductIdentity.name),
        asc(product.name),
        asc(productVariantPrice.sortOrder),
        asc(variantOption.name),
        asc(productVariantPrice.id),
      );

    const productIds = [...new Set(rows.map((row) => row.productId))];
    const brandLinks = productIds.length
      ? await database.query.productBrand.findMany({
          columns: { productId: true },
          where: inArray(productBrand.productId, productIds),
          with: { brand: { columns: { name: true } } },
        })
      : [];
    const brandsByProduct = new Map<number, string[]>();
    for (const link of brandLinks) {
      if (link.brand?.name)
        brandsByProduct.set(link.productId, [
          ...(brandsByProduct.get(link.productId) ?? []),
          link.brand.name,
        ]);
    }
    return rows.map((row) => {
      const {
        variantSize,
        variantDefinition,
        primaryBrandName,
        variantPriceBrandName,
        exchangeCreditAmount,
        ...rest
      } = row;
      return {
        ...rest,
        typeName: row.typeName ?? "Uncategorized",
        categoryName: row.categoryName ?? "—",
        subCategoryName: row.subCategoryName ?? "—",
        brandDisplay:
          variantPriceBrandName ||
          primaryBrandName ||
          brandsByProduct.get(row.productId)?.join(", ") ||
          "—",
        variantValue: variantValueLabel({
          name: row.variantName,
          unit: row.variantUnit,
          size: variantSize,
          definition: variantDefinition,
        }),
        exchangePrice: row.exchangeEnabled
          ? priceFromMinorUnits(
              Math.max(
                0,
                priceInMinorUnits(row.consumerPrice) -
                  priceInMinorUnits(exchangeCreditAmount),
              ),
            )
          : null,
      };
    });
  }

  async function fetchConsumerReferencePriceData(
    input: z.infer<typeof consumerPriceListParamsSchema>,
  ) {
    return { items: await fetchPriceRows(priceConditions(input)) };
  }

  /** Page by actual product, so all of its matching variants stay together. */
  async function fetchConsumerReferencePricePage(
    input: z.infer<typeof consumerPriceListPagedSchema>,
  ) {
    const where = priceConditions(input);
    const filteredRows = priceQuery().where(where).as("filtered_prices");
    const [stats] = await database
      .select({
        totalGroups: sql<number>`count(distinct ${filteredRows.groupKey})::int`,
        totalVariants: sql<number>`count(*)::int`,
        lastUpdated: sql<Date | null>`max(${filteredRows.updatedAt})`,
      })
      .from(filteredRows);
    const limit = input.limit ?? 15;
    const totalGroups = stats?.totalGroups ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalGroups / limit));
    const page = Math.min(input.page ?? 1, totalPages);
    const groups = await database
      .select({ key: filteredRows.groupKey })
      .from(filteredRows)
      .groupBy(filteredRows.groupKey)
      .orderBy(
        sql`min(${filteredRows.typeName}) asc nulls last`,
        sql`min(${filteredRows.categoryName}) asc nulls last`,
        sql`min(${filteredRows.coreProductName}) asc nulls last`,
        sql`min(${filteredRows.productName}) asc nulls last`,
        filteredRows.groupKey,
      )
      .limit(limit)
      .offset((page - 1) * limit);
    return {
      items: groups.length
        ? await fetchPriceRows(
            and(
              where,
              inArray(
                groupKey,
                groups.map((group) => group.key),
              ),
            ),
          )
        : [],
      stats: {
        totalProducts: totalGroups,
        totalVariants: stats?.totalVariants ?? 0,
        lastUpdated: stats?.lastUpdated
          ? new Date(stats.lastUpdated).toISOString()
          : null,
      },
      pagination: { page, limit, totalGroups, totalPages },
    };
  }

  /** Inline and Excel updates use the same validation, scope, dual-write and audit transaction. */
  async function saveConsumerReferencePrices(
    rows: ConsumerPriceUpdate[],
    actor: { id: string; name?: string | null },
    source: "inline" | "excel",
  ) {
    const parsed = importConsumerReferencePricesSchema.parse({ rows });
    return database.transaction(async (tx) => {
      const ids = parsed.rows
        .map((row) => row.variantPriceId)
        .sort((a, b) => a - b);
      const existingRows = await tx
        .select({
          id: productVariantPrice.id,
          productId: product.id,
          creatorSource: product.creatorSource,
          variantOptionId: productVariantPrice.variantOptionId,
          brandId: productVariantPrice.brandId,
          consumerPrice: productVariantPrice.consumerPrice,
          isActive: productVariantPrice.isActive,
          isCylinderPricing,
        })
        .from(productVariantPrice)
        .innerJoin(product, eq(productVariantPrice.productId, product.id))
        .innerJoin(
          variantOption,
          eq(productVariantPrice.variantOptionId, variantOption.id),
        )
        .where(inArray(productVariantPrice.id, ids))
        .orderBy(asc(productVariantPrice.id))
        .for("update", { of: productVariantPrice });
      const byId = new Map(existingRows.map((row) => [row.id, row]));
      const now = new Date();
      let updatedCount = 0;
      for (const input of parsed.rows) {
        const existing = byId.get(input.variantPriceId);
        if (!existing || !existing.isActive)
          throw new ORPCError("NOT_FOUND", {
            message: `Variant Price ID ${input.variantPriceId} is missing or inactive`,
          });
        if (existing.creatorSource !== "admin")
          throw new ORPCError("FORBIDDEN", {
            message: `Variant Price ID ${input.variantPriceId} is not an admin reference price`,
          });
        const generatedWhere = and(
          eq(productVariant.productId, existing.productId),
          or(
            eq(productVariant.sourceVariantPriceId, existing.id),
            sql`${productVariant.sourceVariantPriceId} IS NULL AND ${productVariant.sourceVariantOptionId} = ${existing.variantOptionId}
          AND ${productVariant.brandId} IS NOT DISTINCT FROM ${existing.brandId}`,
          ),
        );
        const generated = await tx
          .select({
            id: productVariant.id,
            isActive: productVariant.isActive,
            exchangeEnabled: productVariant.exchangeEnabled,
            exchangeCreditAmount: productVariant.exchangeCreditAmount,
          })
          .from(productVariant)
          .where(generatedWhere)
          .orderBy(asc(productVariant.id))
          .for("update");
        const current = generated.find((variant) => variant.isActive);
        if (input.exchangePrice != null && !current)
          throw new ORPCError("BAD_REQUEST", {
            message: `Variant Price ID ${input.variantPriceId} has no active cylinder variant`,
          });
        let next;
        try {
          next = resolveReferencePriceUpdate(input, {
            isCylinderPricing: existing.isCylinderPricing,
            exchangeEnabled: current?.exchangeEnabled ?? false,
            exchangeCreditAmount: current?.exchangeCreditAmount ?? "0",
          });
        } catch (error) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Variant Price ID ${input.variantPriceId}: ${error instanceof Error ? error.message : "Invalid price"}`,
          });
        }
        const previousExchangePrice = current?.exchangeEnabled
          ? priceFromMinorUnits(
              Math.max(
                0,
                priceInMinorUnits(existing.consumerPrice) -
                  priceInMinorUnits(current.exchangeCreditAmount),
              ),
            )
          : null;
        if (
          priceInMinorUnits(existing.consumerPrice) ===
            priceInMinorUnits(next.consumerPrice) &&
          previousExchangePrice === next.exchangePrice
        )
          continue;

        await tx
          .update(productVariantPrice)
          .set({ consumerPrice: next.consumerPrice, updatedAt: now })
          .where(eq(productVariantPrice.id, existing.id));
        await tx
          .update(productVariant)
          .set({
            price: next.consumerPrice,
            exchangeEnabled: next.exchangeEnabled,
            exchangeCreditAmount: next.exchangeCreditAmount,
            updatedAt: now,
          })
          .where(generatedWhere);
        await tx.insert(consumerPriceLog).values({
          variantPriceId: existing.id,
          productId: existing.productId,
          actorId: actor.id,
          actorName: actor.name?.trim() || actor.id,
          source,
          previousPrice: existing.consumerPrice,
          newPrice: next.consumerPrice,
          previousExchangePrice,
          newExchangePrice: next.exchangePrice,
          createdAt: now,
        });
        updatedCount++;
      }
      return { success: true as const, updatedCount };
    });
  }

  return {
    fetchConsumerReferencePriceData,
    fetchConsumerReferencePricePage,
    saveConsumerReferencePrices,
  };
}

export const {
  fetchConsumerReferencePriceData,
  fetchConsumerReferencePricePage,
  saveConsumerReferencePrices,
} = createConsumerPriceService(db);
