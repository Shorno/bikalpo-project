import { db, FULFILLMENT_UNIT_CODES } from "@bikalpo-project/db";
import {
  type AdminProductGenerationTemplateDetails,
  adminProductGenerationTemplate,
  brand as brandTable,
  category as categoryTable,
  coreProductIdentity,
  estimateItem,
  invoiceItem,
  orderItem,
  product,
  productBrand,
  productImage,
  productType,
  productVariant,
  productVariantPrice,
  subCategory,
  variantOption,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";
import { generateSku } from "./helpers/generate-sku";
import {
  buildAutoVariantRows,
  linkProductVariantsToCatalog,
  syncBrandVariantPrices,
} from "./helpers/sync-generated-variants";

// Input schemas
const productIdSchema = z.object({
  id: z.number(),
});

// ProductFeatureGroup schema matching the DB type
const productFeatureItemSchema = z.object({
  key: z.string(),
  value: z.string(),
});

const productFeatureGroupSchema = z.object({
  title: z.string(),
  items: z.array(productFeatureItemSchema),
});

const createProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional().nullable(),
  price: z.string(),
  size: z.string(), // required
  image: z.string(), // required
  categoryId: z.number(),
  subCategoryId: z.number().optional().nullable(),
  brandIds: z.array(z.number().int()).optional(),

  inStock: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  reorderLevel: z.number().default(0),
  sku: z.string().optional().nullable(),
  supplier: z.string().optional().nullable(),
  features: z.array(productFeatureGroupSchema).optional(),
  additionalImages: z.array(z.string()).optional(),
  // B2B + B2C Pack Return fields
  isReturnablePack: z.boolean().default(false),
  defaultPackDepositAmount: z.string().optional().default("0"),
  allowedPackBrands: z.array(z.string()).optional(),
  allowedPackSizes: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "draft"]).default("active"),

  // === New fields for Core Identity-driven flow ===
  coreProductId: z.number().int().optional().nullable(),
  shortDescription: z.string().optional().nullable(),
  videoUrl: z.string().optional().nullable(),
  // Behavior settings
  trackingType: z.enum(["none", "batch", "serial"]).default("none"),
  expiryEnabled: z.boolean().default(false),
  damageControlEnabled: z.boolean().default(false),
  stockTrackingEnabled: z.boolean().default(true),
  returnPolicyEnabled: z.boolean().default(true),
  minimumOrderEnabled: z.boolean().default(true),
  minimumOrderQty: z
    .string()
    .min(1)
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("1"),
  inventoryUnit: z.enum(FULFILLMENT_UNIT_CODES).default("unit"),
  conversionEnabled: z.boolean().default(false),
  inventoryLooseUnitEnabled: z.boolean().default(false),
  inventoryLooseUnit: z.enum(FULFILLMENT_UNIT_CODES).default("kg"),
  // Delivery
  deliveryCostPerCarton: z.string().optional().nullable(),
  /** Total unit size in KG (e.g. 50 for 50KG carton). Used for conversion. */
  unitSize: z.string().optional().nullable(),
  // Visibility / publish
  visibility: z.enum(["public", "private"]).default("public"),
  scheduledAt: z.string().optional().nullable(), // ISO date string
  // Variant prices (brand + variant + consumer reference price)
  variantPrices: z
    .array(
      z.object({
        variantOptionId: z.number().int(),
        brandId: z.number().int().optional().nullable(),
        consumerPrice: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/)
          .default("0"),
      }),
    )
    .optional(),
});

const updateProductSchema = createProductSchema.extend({
  id: z.number(),
});

const consumerPriceListParamsSchema = z.object({
  search: z.string().optional(),
  typeId: z.number().int().optional(),
  categoryId: z.number().int().optional(),
  subCategoryId: z.number().int().optional(),
  coreProductId: z.number().int().optional(),
});

const consumerPriceListPagedSchema = consumerPriceListParamsSchema.extend({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const updateConsumerReferencePriceSchema = z.object({
  variantPriceId: z.number().int(),
  consumerPrice: z
    .string()
    .min(1)
    .regex(/^\d+(\.\d{1,2})?$/),
});

type ConsumerPriceListInput = z.infer<typeof consumerPriceListParamsSchema>;

async function fetchConsumerReferencePriceData(input: ConsumerPriceListInput) {
  const conditions: SQL[] = [
    eq(productVariantPrice.isActive, true),
    eq(product.creatorSource, "admin"),
  ];

  if (input.search?.trim()) {
    const s = `%${input.search.trim()}%`;
    conditions.push(
      or(
        ilike(product.name, s),
        ilike(product.sku, s),
        ilike(variantOption.name, s),
        ilike(brandTable.name, s),
        ilike(coreProductIdentity.name, s),
      )!,
    );
  }
  if (input.typeId != null) {
    conditions.push(eq(categoryTable.typeId, input.typeId));
  }
  if (input.categoryId != null) {
    conditions.push(eq(product.categoryId, input.categoryId));
  }
  if (input.subCategoryId != null) {
    conditions.push(eq(product.subCategoryId, input.subCategoryId));
  }
  if (input.coreProductId != null) {
    conditions.push(eq(product.coreProductId, input.coreProductId));
  }

  const where = and(...conditions);

  const rows = await db
    .select({
      variantPriceId: productVariantPrice.id,
      consumerPrice: productVariantPrice.consumerPrice,
      updatedAt: productVariantPrice.updatedAt,
      sortOrder: productVariantPrice.sortOrder,
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      variantOptionId: variantOption.id,
      variantName: variantOption.name,
      variantUnit: variantOption.unit,
      categoryId: categoryTable.id,
      categoryName: categoryTable.name,
      typeId: productType.id,
      typeName: productType.name,
      subCategoryId: subCategory.id,
      subCategoryName: subCategory.name,
      coreProductId: coreProductIdentity.id,
      coreProductName: coreProductIdentity.name,
      coreProductSku: coreProductIdentity.sku,
      primaryBrandName: brandTable.name,
      variantPriceBrandId: productVariantPrice.brandId,
      variantPriceBrandName: sql<
        string | null
      >`(SELECT b2.name FROM brand b2 WHERE b2.id = ${productVariantPrice.brandId})`.as(
        "variant_price_brand_name",
      ),
    })
    .from(productVariantPrice)
    .innerJoin(product, eq(productVariantPrice.productId, product.id))
    .innerJoin(
      variantOption,
      eq(productVariantPrice.variantOptionId, variantOption.id),
    )
    .innerJoin(categoryTable, eq(product.categoryId, categoryTable.id))
    .leftJoin(productType, eq(categoryTable.typeId, productType.id))
    .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
    .leftJoin(
      coreProductIdentity,
      eq(product.coreProductId, coreProductIdentity.id),
    )
    .leftJoin(brandTable, eq(product.brandId, brandTable.id))
    .where(where)
    .orderBy(
      asc(productType.name),
      asc(categoryTable.name),
      asc(coreProductIdentity.name),
      asc(product.name),
      asc(productVariantPrice.sortOrder),
      asc(variantOption.name),
    );

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const brandLinks =
    productIds.length === 0
      ? []
      : await db.query.productBrand.findMany({
          where: inArray(productBrand.productId, productIds),
          with: { brand: { columns: { name: true } } },
        });

  const brandsByProduct = new Map<number, string>();
  for (const link of brandLinks) {
    const name = link.brand?.name;
    if (!name) continue;
    const prev = brandsByProduct.get(link.productId);
    brandsByProduct.set(link.productId, prev ? `${prev}, ${name}` : name);
  }

  const items = rows.map((r) => {
    const brandDisplay =
      r.variantPriceBrandName?.trim() ||
      r.primaryBrandName?.trim() ||
      brandsByProduct.get(r.productId) ||
      "—";
    const identityLabel = r.coreProductName ?? r.productName;
    const skuLabel = r.coreProductSku ?? r.productSku ?? "—";
    const coreLine = `${identityLabel} (${skuLabel}) • ${r.categoryName ?? "—"} → ${r.subCategoryName ?? "—"} → ${identityLabel}`;

    return {
      variantPriceId: r.variantPriceId,
      consumerPrice: String(r.consumerPrice),
      updatedAt: r.updatedAt,
      productId: r.productId,
      productName: r.productName,
      productSku: r.productSku,
      variantOptionId: r.variantOptionId,
      variantName: r.variantName,
      variantUnit: r.variantUnit,
      brandDisplay,
      typeId: r.typeId,
      typeName: r.typeName ?? "Uncategorized",
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "—",
      subCategoryName: r.subCategoryName ?? "—",
      coreProductId: r.coreProductId,
      coreProductName: r.coreProductName,
      coreProductSku: r.coreProductSku,
      coreLine,
    };
  });

  const uniqueCoreOrProduct = new Set<string>();
  for (const i of items) {
    uniqueCoreOrProduct.add(
      i.coreProductId != null ? `c:${i.coreProductId}` : `p:${i.productId}`,
    );
  }
  const totalCoreProducts = uniqueCoreOrProduct.size;
  const totalVariants = items.length;
  let lastUpdated: Date | null = null;
  for (const i of items) {
    if (i.updatedAt && (!lastUpdated || i.updatedAt > lastUpdated)) {
      lastUpdated = i.updatedAt;
    }
  }

  return {
    items,
    stats: {
      totalCoreProducts,
      totalVariants,
      lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
    },
  };
}

/**
 * Server-side paginated consumer reference prices.
 * Pages by "group" (core product, or standalone product when it has no core
 * identity) so a group's brand/variant rows are never split across pages.
 * Stats are aggregated over the full filtered set, independent of the page.
 */
async function fetchConsumerReferencePricePage(
  input: z.infer<typeof consumerPriceListPagedSchema>,
) {
  const conditions: SQL[] = [
    eq(productVariantPrice.isActive, true),
    eq(product.creatorSource, "admin"),
  ];

  if (input.search?.trim()) {
    const s = `%${input.search.trim()}%`;
    conditions.push(
      or(
        ilike(product.name, s),
        ilike(product.sku, s),
        ilike(variantOption.name, s),
        ilike(brandTable.name, s),
        ilike(coreProductIdentity.name, s),
      )!,
    );
  }
  if (input.typeId != null)
    conditions.push(eq(categoryTable.typeId, input.typeId));
  if (input.categoryId != null)
    conditions.push(eq(product.categoryId, input.categoryId));
  if (input.subCategoryId != null)
    conditions.push(eq(product.subCategoryId, input.subCategoryId));
  if (input.coreProductId != null)
    conditions.push(eq(product.coreProductId, input.coreProductId));

  const where = and(...conditions);

  const page = input.page && input.page > 0 ? input.page : 1;
  const limit =
    input.limit && input.limit > 0 ? Math.min(input.limit, 100) : 15;
  const offset = (page - 1) * limit;

  const groupKeyExpr = sql<string>`coalesce('c:' || ${coreProductIdentity.id}::text, 'p:' || ${product.id}::text)`;

  // ── Stats over the full filtered set (one aggregate query) ──
  const [statsRow] = await db
    .select({
      totalGroups: sql<number>`count(distinct coalesce('c:' || ${coreProductIdentity.id}::text, 'p:' || ${product.id}::text))::int`,
      totalVariants: sql<number>`count(*)::int`,
      lastUpdated: sql<Date | null>`max(${productVariantPrice.updatedAt})`,
    })
    .from(productVariantPrice)
    .innerJoin(product, eq(productVariantPrice.productId, product.id))
    .innerJoin(
      variantOption,
      eq(productVariantPrice.variantOptionId, variantOption.id),
    )
    .innerJoin(categoryTable, eq(product.categoryId, categoryTable.id))
    .leftJoin(productType, eq(categoryTable.typeId, productType.id))
    .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
    .leftJoin(
      coreProductIdentity,
      eq(product.coreProductId, coreProductIdentity.id),
    )
    .leftJoin(brandTable, eq(product.brandId, brandTable.id))
    .where(where);

  const totalGroups = statsRow?.totalGroups ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalGroups / limit));

  // ── Page of group keys (ordered the same way as the row query) ──
  const pagedGroups = await db
    .select({ gk: groupKeyExpr })
    .from(productVariantPrice)
    .innerJoin(product, eq(productVariantPrice.productId, product.id))
    .innerJoin(
      variantOption,
      eq(productVariantPrice.variantOptionId, variantOption.id),
    )
    .innerJoin(categoryTable, eq(product.categoryId, categoryTable.id))
    .leftJoin(productType, eq(categoryTable.typeId, productType.id))
    .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
    .leftJoin(
      coreProductIdentity,
      eq(product.coreProductId, coreProductIdentity.id),
    )
    .leftJoin(brandTable, eq(product.brandId, brandTable.id))
    .where(where)
    .groupBy(groupKeyExpr)
    .orderBy(
      sql`min(${productType.name}) asc nulls last`,
      sql`min(${categoryTable.name}) asc nulls last`,
      sql`min(${coreProductIdentity.name}) asc nulls last`,
      sql`min(${product.name}) asc nulls last`,
    )
    .limit(limit)
    .offset(offset);

  const coreIds: number[] = [];
  const standaloneProductIds: number[] = [];
  for (const g of pagedGroups) {
    const key = g.gk;
    if (!key) continue;
    const sep = key.indexOf(":");
    const kind = key.slice(0, sep);
    const id = Number(key.slice(sep + 1));
    if (!Number.isFinite(id)) continue;
    if (kind === "c") coreIds.push(id);
    else standaloneProductIds.push(id);
  }

  const emptyStats = {
    totalCoreProducts: totalGroups,
    totalVariants: statsRow?.totalVariants ?? 0,
    lastUpdated: statsRow?.lastUpdated
      ? new Date(statsRow.lastUpdated).toISOString()
      : null,
  };

  if (coreIds.length === 0 && standaloneProductIds.length === 0) {
    return {
      items: [],
      stats: emptyStats,
      pagination: { page, limit, totalGroups, totalPages },
    };
  }

  const groupFilter = or(
    coreIds.length ? inArray(product.coreProductId, coreIds) : undefined,
    standaloneProductIds.length
      ? and(
          isNull(product.coreProductId),
          inArray(product.id, standaloneProductIds),
        )
      : undefined,
  );

  const rows = await db
    .select({
      variantPriceId: productVariantPrice.id,
      consumerPrice: productVariantPrice.consumerPrice,
      updatedAt: productVariantPrice.updatedAt,
      sortOrder: productVariantPrice.sortOrder,
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      variantOptionId: variantOption.id,
      variantName: variantOption.name,
      variantUnit: variantOption.unit,
      categoryId: categoryTable.id,
      categoryName: categoryTable.name,
      typeId: productType.id,
      typeName: productType.name,
      subCategoryId: subCategory.id,
      subCategoryName: subCategory.name,
      coreProductId: coreProductIdentity.id,
      coreProductName: coreProductIdentity.name,
      coreProductSku: coreProductIdentity.sku,
      primaryBrandName: brandTable.name,
      variantPriceBrandId: productVariantPrice.brandId,
      variantPriceBrandName: sql<
        string | null
      >`(SELECT b2.name FROM brand b2 WHERE b2.id = ${productVariantPrice.brandId})`.as(
        "variant_price_brand_name",
      ),
    })
    .from(productVariantPrice)
    .innerJoin(product, eq(productVariantPrice.productId, product.id))
    .innerJoin(
      variantOption,
      eq(productVariantPrice.variantOptionId, variantOption.id),
    )
    .innerJoin(categoryTable, eq(product.categoryId, categoryTable.id))
    .leftJoin(productType, eq(categoryTable.typeId, productType.id))
    .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
    .leftJoin(
      coreProductIdentity,
      eq(product.coreProductId, coreProductIdentity.id),
    )
    .leftJoin(brandTable, eq(product.brandId, brandTable.id))
    .where(and(where, groupFilter))
    .orderBy(
      asc(productType.name),
      asc(categoryTable.name),
      asc(coreProductIdentity.name),
      asc(product.name),
      asc(productVariantPrice.sortOrder),
      asc(variantOption.name),
    );

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const brandLinks =
    productIds.length === 0
      ? []
      : await db.query.productBrand.findMany({
          where: inArray(productBrand.productId, productIds),
          with: { brand: { columns: { name: true } } },
        });

  const brandsByProduct = new Map<number, string>();
  for (const link of brandLinks) {
    const name = link.brand?.name;
    if (!name) continue;
    const prev = brandsByProduct.get(link.productId);
    brandsByProduct.set(link.productId, prev ? `${prev}, ${name}` : name);
  }

  const items = rows.map((r) => {
    const brandDisplay =
      r.variantPriceBrandName?.trim() ||
      r.primaryBrandName?.trim() ||
      brandsByProduct.get(r.productId) ||
      "—";
    const identityLabel = r.coreProductName ?? r.productName;
    const skuLabel = r.coreProductSku ?? r.productSku ?? "—";
    const coreLine = `${identityLabel} (${skuLabel}) • ${r.categoryName ?? "—"} → ${r.subCategoryName ?? "—"} → ${identityLabel}`;

    return {
      variantPriceId: r.variantPriceId,
      consumerPrice: String(r.consumerPrice),
      updatedAt: r.updatedAt,
      productId: r.productId,
      productName: r.productName,
      productSku: r.productSku,
      variantOptionId: r.variantOptionId,
      variantName: r.variantName,
      variantUnit: r.variantUnit,
      brandDisplay,
      typeId: r.typeId,
      typeName: r.typeName ?? "Uncategorized",
      categoryId: r.categoryId,
      categoryName: r.categoryName ?? "—",
      subCategoryName: r.subCategoryName ?? "—",
      coreProductId: r.coreProductId,
      coreProductName: r.coreProductName,
      coreProductSku: r.coreProductSku,
      coreLine,
    };
  });

  return {
    items,
    stats: emptyStats,
    pagination: { page, limit, totalGroups, totalPages },
  };
}

export const productRouter = {
  /**
   * Get admin-owned products for the Admin Web View.
   * REST: GET /products/admin-web-view
   */
  getAdminWebViewProducts: adminProcedure
    .route({
      method: "GET",
      path: "/products/admin-web-view",
      tags: ["Product Management"],
      summary: "Get admin Web View products",
      description: "Get admin-owned products with full card relations",
    })
    .handler(async () => {
      const products = await db.query.product.findMany({
        where: eq(product.creatorSource, "admin"),
        orderBy: [desc(product.createdAt)],
        with: {
          category: true,
          subCategory: true,
          brand: true,
          images: true,
          productBrands: {
            with: { brand: true },
          },
          variants: {
            with: { brand: true },
            columns: {
              id: true,
              variantType: true,
              brandId: true,
              unitLabel: true,
            },
          },
          variantPrices: {
            with: { variantOption: true },
          },
        },
      });

      return { products };
    }),

  /**
   * Get one admin-owned product for the Admin Web View.
   * REST: GET /products/admin-web-view/:id
   */
  getAdminWebViewProductById: adminProcedure
    .route({
      method: "GET",
      path: "/products/admin-web-view/{id}",
      tags: ["Product Management"],
      summary: "Get admin Web View product by ID",
      description: "Get one admin-owned product with full detail relations",
    })
    .input(productIdSchema)
    .handler(async ({ input }) => {
      const foundProduct = await db.query.product.findFirst({
        where: and(
          eq(product.id, input.id),
          eq(product.creatorSource, "admin"),
        ),
        with: {
          category: true,
          subCategory: true,
          brand: true,
          images: true,
          productBrands: {
            with: { brand: true },
          },
          variantPrices: {
            with: {
              variantOption: true,
            },
          },
        },
      });

      if (!foundProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      return { product: foundProduct };
    }),

  /**
   * First-time admin product creation for a core product.
   * One submission stores the initial shared template and creates one
   * independent product per selected brand.
   */
  create: adminProcedure
    .route({
      method: "POST",
      path: "/products",
      tags: ["Product Management"],
      summary: "Create per-brand products",
      description: "Create the initial admin products for a core product",
    })
    .input(createProductSchema)
    .handler(async ({ context, input }) => {
      const {
        additionalImages = [],
        variantPrices = [],
        brandIds = [],
        ...productData
      } = input;
      const coreProductId = productData.coreProductId;

      if (!coreProductId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select an admin core product before creating products",
        });
      }
      if (brandIds.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select at least one brand",
        });
      }
      if (new Set(brandIds).size !== brandIds.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "A brand can only be selected once",
        });
      }

      const variantsByBrand = new Map<number, typeof variantPrices>();
      for (const variant of variantPrices) {
        if (!variant.brandId || !brandIds.includes(variant.brandId)) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Every variant must belong to a selected brand",
          });
        }
        const brandVariants = variantsByBrand.get(variant.brandId) ?? [];
        if (
          brandVariants.some(
            (row) => row.variantOptionId === variant.variantOptionId,
          )
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A variant can only be selected once per brand",
          });
        }
        brandVariants.push(variant);
        variantsByBrand.set(variant.brandId, brandVariants);
      }
      if (brandIds.some((brandId) => !variantsByBrand.get(brandId)?.length)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select at least one variant for every brand",
        });
      }

      const products = await db.transaction(async (tx) => {
        const core = await tx.query.coreProductIdentity.findFirst({
          where: eq(coreProductIdentity.id, coreProductId),
          with: {
            category: { columns: { id: true, slug: true, typeId: true } },
            subCategory: { columns: { id: true, slug: true } },
          },
        });
        if (!core) {
          throw new ORPCError("NOT_FOUND", {
            message: "Core product identity not found",
          });
        }
        if (core.creatorSource !== "admin") {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Only admin-created core products can generate admin products",
          });
        }

        // Product existence is the single source of truth for "already
        // created". A leftover generation template does not block Add — it is
        // overwritten by the upsert below.
        const existingProduct = await tx.query.product.findFirst({
          where: and(
            eq(product.coreProductId, coreProductId),
            eq(product.creatorSource, "admin"),
          ),
          columns: { id: true },
        });
        if (existingProduct) {
          throw new ORPCError("CONFLICT", {
            message:
              "This core product has already been created. Use Edit instead.",
          });
        }

        const brandRows = await tx.query.brand.findMany({
          where: inArray(brandTable.id, brandIds),
        });
        if (brandRows.length !== brandIds.length) {
          throw new ORPCError("BAD_REQUEST", {
            message: "One or more selected brands do not exist",
          });
        }
        const brandMap = new Map(brandRows.map((row) => [row.id, row]));

        const requestedVariantIds = [
          ...new Set(variantPrices.map((row) => row.variantOptionId)),
        ];
        const variantRows = await tx.query.variantOption.findMany({
          where: inArray(variantOption.id, requestedVariantIds),
        });
        if (variantRows.length !== requestedVariantIds.length) {
          throw new ORPCError("BAD_REQUEST", {
            message: "One or more selected variants do not exist",
          });
        }
        const typeId = core.category?.typeId ?? null;
        const invalidVariant = variantRows.find((option) => {
          const isGlobal = option.typeId === null && option.categoryId === null;
          const isTypeWide =
            typeId !== null &&
            option.typeId === typeId &&
            option.categoryId === null;
          const isCategoryScoped =
            typeId !== null &&
            option.typeId === typeId &&
            option.categoryId === core.categoryId;
          return (
            !option.isActive || !(isGlobal || isTypeWide || isCategoryScoped)
          );
        });
        if (invalidVariant) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Variant option "${invalidVariant.name}" is not available for this core product`,
          });
        }

        const templateDetails = {
          name: productData.name,
          slug: productData.slug,
          description: productData.description ?? null,
          shortDescription: productData.shortDescription ?? null,
          videoUrl: productData.videoUrl ?? null,
          size: productData.size,
          price: productData.price,
          image: productData.image,
          additionalImages,
          features: productData.features ?? [],
          inStock: productData.inStock,
          isFeatured: productData.isFeatured,
          reorderLevel: productData.reorderLevel,
          supplier: productData.supplier?.trim() || null,
          isReturnablePack: productData.isReturnablePack,
          defaultPackDepositAmount: productData.defaultPackDepositAmount,
          allowedPackBrands: productData.allowedPackBrands ?? [],
          allowedPackSizes: productData.allowedPackSizes ?? [],
          returnPolicyEnabled: productData.returnPolicyEnabled,
          trackingType: productData.trackingType,
          expiryEnabled: productData.expiryEnabled,
          damageControlEnabled: productData.damageControlEnabled,
          stockTrackingEnabled: productData.stockTrackingEnabled,
          minimumOrderEnabled: productData.minimumOrderEnabled,
          minimumOrderQty: productData.minimumOrderQty,
          inventoryUnit: productData.inventoryUnit,
          conversionEnabled: productData.conversionEnabled,
          inventoryLooseUnitEnabled: productData.inventoryLooseUnitEnabled,
          inventoryLooseUnit: productData.inventoryLooseUnit,
          visibility: productData.visibility,
          scheduledAt: productData.scheduledAt ?? null,
          status: productData.status,
        } satisfies AdminProductGenerationTemplateDetails;

        // Upsert: overwrite any stale template left over from a previous
        // setup that was fully deleted, so re-adding a core always works.
        await tx
          .insert(adminProductGenerationTemplate)
          .values({
            coreProductId,
            version: 1,
            details: templateDetails,
            createdById: context.session.user.id,
          })
          .onConflictDoUpdate({
            target: adminProductGenerationTemplate.coreProductId,
            set: {
              version: 1,
              details: templateDetails,
              createdById: context.session.user.id,
              updatedAt: new Date(),
            },
          });

        const [countResult] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(product)
          .where(eq(product.categoryId, core.categoryId));
        const baseSerial = countResult?.count ?? 0;
        const createdProducts: Array<typeof product.$inferSelect> = [];

        for (const [brandIndex, brandId] of brandIds.entries()) {
          const brandRow = brandMap.get(brandId)!;
          const name = `${brandRow.name} ${templateDetails.name}`.trim();
          if (name.length > 150) {
            throw new ORPCError("BAD_REQUEST", {
              message: `The generated product name for ${brandRow.name} exceeds 150 characters`,
            });
          }

          const rawSlug = `${brandRow.slug}-${templateDetails.slug}`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
          const baseSlug = (
            rawSlug || `product-${coreProductId}-${brandId}`
          ).slice(0, 140);
          let slug = baseSlug;
          let suffix = 2;
          while (
            await tx.query.product.findFirst({
              where: eq(product.slug, slug),
              columns: { id: true },
            })
          ) {
            slug = `${baseSlug}-${suffix++}`;
          }

          const sku = generateSku({
            subCategorySlug: core.subCategory?.slug || "xx",
            categorySlug: core.category?.slug || "xx",
            serialNumber: baseSerial + brandIndex + 1,
            userId: context.session.user.id,
          });
          const [newProduct] = await tx
            .insert(product)
            .values({
              name,
              slug,
              sku,
              description: templateDetails.description ?? null,
              shortDescription: templateDetails.shortDescription ?? null,
              videoUrl: templateDetails.videoUrl ?? null,
              categoryId: core.categoryId,
              subCategoryId: core.subCategoryId ?? null,
              brandId,
              coreProductId,
              creatorSource: "admin",
              createdById: context.session.user.id,
              size: templateDetails.size,
              price: templateDetails.price,
              reorderLevel: templateDetails.reorderLevel,
              supplier: templateDetails.supplier ?? null,
              image: templateDetails.image,
              features: templateDetails.features,
              inStock: templateDetails.inStock,
              isFeatured: templateDetails.isFeatured,
              isReturnablePack: templateDetails.isReturnablePack,
              defaultPackDepositAmount:
                templateDetails.defaultPackDepositAmount,
              allowedPackBrands: templateDetails.allowedPackBrands,
              allowedPackSizes: templateDetails.allowedPackSizes,
              returnPolicyEnabled: templateDetails.returnPolicyEnabled,
              trackingType: templateDetails.trackingType,
              expiryEnabled: templateDetails.expiryEnabled,
              damageControlEnabled: templateDetails.damageControlEnabled,
              stockTrackingEnabled: templateDetails.stockTrackingEnabled,
              minimumOrderEnabled: templateDetails.minimumOrderEnabled,
              minimumOrderQty: templateDetails.minimumOrderQty,
              inventoryUnit: templateDetails.inventoryUnit,
              conversionEnabled: templateDetails.conversionEnabled,
              inventoryLooseUnitEnabled:
                templateDetails.inventoryLooseUnitEnabled,
              inventoryLooseUnit: templateDetails.inventoryLooseUnit,
              visibility: templateDetails.visibility,
              scheduledAt: templateDetails.scheduledAt
                ? new Date(templateDetails.scheduledAt)
                : null,
              status: templateDetails.status,
            })
            .returning();
          if (!newProduct) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: `Could not create the ${brandRow.name} product`,
            });
          }

          await tx
            .insert(productBrand)
            .values({ productId: newProduct.id, brandId });
          if (additionalImages.length > 0) {
            await tx.insert(productImage).values(
              additionalImages.map((imageUrl) => ({
                productId: newProduct.id,
                imageUrl,
              })),
            );
          }
          await syncBrandVariantPrices(tx, {
            productId: newProduct.id,
            brandId,
            variants: variantsByBrand.get(brandId)!.map((row) => ({
              variantOptionId: row.variantOptionId,
              consumerPrice: row.consumerPrice,
            })),
            settings: newProduct,
          });
          createdProducts.push(newProduct);
        }

        return createdProducts;
      });

      return { product: products[0], products, count: products.length };
    }),

  /**
   * Update a product
   * REST: PUT /products/:id
   */
  update: adminProcedure
    .route({
      method: "PUT",
      path: "/products/{id}",
      tags: ["Product Management"],
      summary: "Update product",
      description: "Update an existing product",
    })
    .input(updateProductSchema)
    .handler(async ({ input }) => {
      const {
        id,
        additionalImages,
        variantPrices: inputVariantPrices,
        brandIds: inputBrandIds,
        ...updateData
      } = input;

      const existing = await db.query.product.findFirst({
        where: eq(product.id, id),
        columns: {
          id: true,
          brandId: true,
          coreProductId: true,
          categoryId: true,
          subCategoryId: true,
          createdByWarehouseId: true,
          creatorSource: true,
        },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      // Core-managed products keep their core identity and brand fixed.
      // Their own variant set remains editable without affecting siblings.
      const isCoreManaged =
        existing.coreProductId !== null &&
        existing.creatorSource === "admin";
      const brandIds = isCoreManaged ? undefined : inputBrandIds;
      if (isCoreManaged && !existing.brandId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Core-managed products must have a brand",
        });
      }
      if (
        isCoreManaged &&
        inputVariantPrices?.some(
          (row) => row.brandId != null && row.brandId !== existing.brandId,
        )
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Variants must belong to the product's existing brand",
        });
      }
      if (isCoreManaged && inputVariantPrices) {
        const optionIds = inputVariantPrices.map((row) => row.variantOptionId);
        if (new Set(optionIds).size !== optionIds.length) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A variant can only be selected once",
          });
        }
        const [core, options] = await Promise.all([
          db.query.coreProductIdentity.findFirst({
            where: eq(coreProductIdentity.id, existing.coreProductId!),
            with: {
              category: { columns: { typeId: true } },
            },
          }),
          optionIds.length > 0
            ? db.query.variantOption.findMany({
                where: inArray(variantOption.id, optionIds),
              })
            : Promise.resolve([]),
        ]);
        if (!core || options.length !== optionIds.length) {
          throw new ORPCError("BAD_REQUEST", {
            message: "One or more variants are invalid",
          });
        }
        const typeId = core.category?.typeId ?? null;
        const invalid = options.find((option) => {
          const isGlobal = option.typeId === null && option.categoryId === null;
          const isTypeWide =
            typeId !== null &&
            option.typeId === typeId &&
            option.categoryId === null;
          const isCategoryScoped =
            typeId !== null &&
            option.typeId === typeId &&
            option.categoryId === core.categoryId;
          return (
            !option.isActive || !(isGlobal || isTypeWide || isCategoryScoped)
          );
        });
        if (invalid) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Variant option "${invalid.name}" is not available for this product`,
          });
        }
      }
      const variantPrices = inputVariantPrices;

      // Set brandId at product level
      const productBrandId = isCoreManaged
        ? existing.brandId
        : brandIds && brandIds.length > 0
          ? brandIds[0]
          : null;

      const [updatedProduct] = await db
        .update(product)
        .set({
          ...updateData,
          brandId: productBrandId,
          categoryId: isCoreManaged
            ? existing.categoryId
            : updateData.categoryId,
          subCategoryId: isCoreManaged
            ? existing.subCategoryId
            : updateData.subCategoryId || null,
          coreProductId: isCoreManaged
            ? existing.coreProductId
            : updateData.coreProductId || null,
          shortDescription: updateData.shortDescription || null,
          videoUrl: updateData.videoUrl || null,
          scheduledAt: updateData.scheduledAt
            ? new Date(updateData.scheduledAt)
            : null,
          sku: (updateData.sku ?? "").toString().trim() || null,
          supplier: (updateData.supplier ?? "").toString().trim() || null,
          reorderLevel: updateData.reorderLevel ?? 0,
        })
        .where(eq(product.id, id))
        .returning();

      if (!updatedProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      if (additionalImages !== undefined) {
        await db.delete(productImage).where(eq(productImage.productId, id));

        if (additionalImages.length > 0) {
          await db.insert(productImage).values(
            additionalImages.map((imageUrl) => ({
              productId: id,
              imageUrl,
            })),
          );
        }
      }

      // Sync product brands (M2M)
      if (brandIds !== undefined) {
        await db.delete(productBrand).where(eq(productBrand.productId, id));
        if (brandIds.length > 0) {
          await db.insert(productBrand).values(
            brandIds.map((bId) => ({
              productId: id,
              brandId: bId,
            })),
          );
        }
      }

      if (isCoreManaged && variantPrices !== undefined) {
        if (variantPrices.length === 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Select at least one variant",
          });
        }
        await syncBrandVariantPrices(db, {
          productId: id,
          brandId: existing.brandId!,
          variants: variantPrices.map((row) => ({
            variantOptionId: row.variantOptionId,
            consumerPrice: row.consumerPrice,
          })),
          settings: updatedProduct,
        });
      }

      // Standalone products retain the legacy replace behavior.
      if (!isCoreManaged && variantPrices && variantPrices.length > 0) {
        // Delete old variant prices
        await db
          .delete(productVariantPrice)
          .where(eq(productVariantPrice.productId, id));

        // Delete old auto-generated product_variant rows (those with sourceVariantPriceId)
        // Keep manually-created legacy variants untouched
        await db
          .delete(productVariant)
          .where(
            and(
              eq(productVariant.productId, id),
              sql`${productVariant.sourceVariantPriceId} IS NOT NULL`,
            ),
          );

        // 1. Insert new product_variant_price rows
        const insertedPrices = await db
          .insert(productVariantPrice)
          .values(
            variantPrices.map((vp, idx) => ({
              productId: id,
              variantOptionId: vp.variantOptionId,
              brandId: vp.brandId || null,
              consumerPrice: vp.consumerPrice || "0",
              sortOrder: idx,
            })),
          )
          .returning();

        // 2. Fetch variant_option metadata
        const voIds = variantPrices.map((vp) => vp.variantOptionId);
        const variantOptions = await db
          .select()
          .from(variantOption)
          .where(inArray(variantOption.id, voIds));
        const voMap = Object.fromEntries(
          variantOptions.map((vo) => [vo.id, vo]),
        );

        // 3. Auto-generate new product_variant rows
        const autoVariantRows = buildAutoVariantRows({
          productId: id,
          insertedPrices,
          voMap,
          settings: updateData,
        });

        if (autoVariantRows.length > 0) {
          await db.insert(productVariant).values(autoVariantRows).returning();
        }

        await linkProductVariantsToCatalog(db, id);
      }

      return { product: updatedProduct };
    }),

  /**
   * Delete a product
   * REST: DELETE /products/:id
   */
  delete: adminProcedure
    .route({
      method: "DELETE",
      path: "/products/{id}",
      tags: ["Product Management"],
      summary: "Delete product",
      description: "Delete a product by ID",
    })
    .input(
      productIdSchema.extend({
        /**
         * Force a permanent hard delete instead of the default deactivate
         * behaviour for admin brand products. Also removes order/invoice/
         * estimate line items that would otherwise block the delete. Intended
         * for cleaning up test data.
         */
        force: z.boolean().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const existing = await db.query.product.findFirst({
        where: eq(product.id, input.id),
        columns: {
          id: true,
          brandId: true,
          coreProductId: true,
          createdByWarehouseId: true,
          creatorSource: true,
        },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      // Admin brand products are deactivated (not deleted) to preserve the
      // core identity — unless a force delete is explicitly requested.
      if (
        !input.force &&
        existing.coreProductId !== null &&
        existing.creatorSource === "admin"
      ) {
        await db.transaction(async (tx) => {
          await tx
            .update(product)
            .set({ status: "inactive" })
            .where(eq(product.id, input.id));
          await tx
            .update(productVariant)
            .set({ isActive: false })
            .where(eq(productVariant.productId, input.id));
        });
        return { success: true, deactivated: true };
      }

      const deletedProduct = await db.transaction(async (tx) => {
        if (input.force) {
          // Clear "restrict" FKs that would otherwise block deletion. Everything
          // else product-owned (variants, prices, images, brands, cart items,
          // reviews, stock logs, pack rules) cascades automatically.
          await tx.delete(orderItem).where(eq(orderItem.productId, input.id));
          await tx
            .delete(invoiceItem)
            .where(eq(invoiceItem.productId, input.id));
          await tx
            .delete(estimateItem)
            .where(eq(estimateItem.productId, input.id));
        }
        const [deleted] = await tx
          .delete(product)
          .where(eq(product.id, input.id))
          .returning();

        // If this was an admin brand product and no admin products remain for
        // its core, drop the now-orphaned generation template so the core
        // reverts to "unconfigured" (core list shows Add again, and the Add
        // flow no longer rejects it as already-created).
        if (input.force && existing.coreProductId !== null) {
          const remaining = await tx.query.product.findFirst({
            where: and(
              eq(product.coreProductId, existing.coreProductId),
              eq(product.creatorSource, "admin"),
            ),
            columns: { id: true },
          });
          if (!remaining) {
            await tx
              .delete(adminProductGenerationTemplate)
              .where(
                eq(
                  adminProductGenerationTemplate.coreProductId,
                  existing.coreProductId,
                ),
              );
          }
        }

        return deleted;
      });

      if (!deletedProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      return { success: true, deactivated: false };
    }),

  /**
   * Get product by ID
   * REST: GET /products/:id
   */
  getById: publicProcedure
    .route({
      method: "GET",
      path: "/products/{id}",
      tags: ["Products"],
      summary: "Get product by ID",
      description: "Get a single product by its ID",
    })
    .input(productIdSchema)
    .handler(async ({ input }) => {
      const foundProduct = await db.query.product.findFirst({
        where: eq(product.id, input.id),
        with: {
          category: true,
          subCategory: true,
          brand: true,
          images: true,
          productBrands: {
            with: { brand: true },
          },
          variantPrices: {
            with: {
              variantOption: true,
            },
          },
        },
      });

      if (!foundProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      return { product: foundProduct };
    }),

  /**
   * Get all products (public)
   * REST: GET /products
   */
  getAll: publicProcedure
    .route({
      method: "GET",
      path: "/products",
      tags: ["Products"],
      summary: "Get all products",
      description: "Get all products with full relations",
    })
    .handler(async () => {
      const products = await db.query.product.findMany({
        orderBy: [desc(product.createdAt)],
        with: {
          category: true,
          subCategory: true,
          brand: true,
          images: true,
          productBrands: {
            with: { brand: true },
          },
          variants: {
            with: { brand: true },
            columns: {
              id: true,
              variantType: true,
              brandId: true,
              unitLabel: true,
            },
          },
          variantPrices: {
            with: { variantOption: true },
          },
        },
      });

      return { products };
    }),

  /**
   * Get product by slug (public)
   * REST: GET /products/by-slug/:slug
   */
  getBySlug: publicProcedure
    .route({
      method: "GET",
      path: "/products/by-slug/{slug}",
      tags: ["Products"],
      summary: "Get product by slug",
      description: "Get a single product by its slug",
    })
    .input(z.object({ slug: z.string() }))
    .handler(async ({ input }) => {
      const foundProduct = await db.query.product.findFirst({
        where: eq(product.slug, input.slug),
        with: {
          category: { columns: { name: true, slug: true } },
          subCategory: { columns: { name: true } },
          images: true,
        },
      });

      if (!foundProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      return { product: foundProduct };
    }),

  /**
   * Search products (public)
   * REST: GET /products/search
   */
  search: publicProcedure
    .route({
      method: "GET",
      path: "/products/search",
      tags: ["Products"],
      summary: "Search products",
      description: "Search products by name",
    })
    .input(z.object({ query: z.string() }))
    .handler(async ({ input }) => {
      if (!input.query || input.query.trim().length === 0) {
        return { products: [] };
      }

      const products = await db.query.product.findMany({
        where: ilike(product.name, `%${input.query}%`),
        with: {
          category: { columns: { name: true, slug: true } },
        },
        limit: 10,
      });

      return { products };
    }),

  /**
   * Get filtered products (public)
   * REST: GET /products/filtered
   */
  getFiltered: publicProcedure
    .route({
      method: "GET",
      path: "/products/filtered",
      tags: ["Products"],
      summary: "Get filtered products",
      description: "Get products with filters for category, price, and sorting",
    })
    .input(
      z.object({
        category: z.string().optional().nullable(),
        brand: z.string().optional().nullable(),
        minPrice: z.number().optional().nullable(),
        maxPrice: z.number().optional().nullable(),
        sort: z.string().optional().nullable(),
      }),
    )
    .handler(async ({ input }) => {
      const { category: categorySlug, minPrice, maxPrice, sort } = input;

      const conditions: SQL[] = [];

      // Category filter
      if (categorySlug) {
        const matchedCategory = await db.query.category.findFirst({
          where: eq(categoryTable.slug, categorySlug),
          columns: { id: true },
        });

        if (matchedCategory) {
          conditions.push(eq(product.categoryId, matchedCategory.id));
        } else {
          return { products: [] };
        }
      }

      // Price filters
      if (minPrice != null) {
        conditions.push(gte(product.price, minPrice.toString()));
      }
      if (maxPrice != null) {
        conditions.push(lte(product.price, maxPrice.toString()));
      }

      // Get order by
      const getOrderBy = () => {
        switch (sort) {
          case "price_asc":
            return asc(product.price);
          case "price_desc":
            return desc(product.price);
          case "name_asc":
            return asc(product.name);
          case "name_desc":
            return desc(product.name);
          default:
            return desc(product.createdAt);
        }
      };

      const products = await db.query.product.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          category: { columns: { name: true, slug: true } },
        },
        orderBy: getOrderBy(),
      });

      return { products };
    }),

  /**
   * List consumer reference prices (B2C / retail variant_price rows) for admin pricing console
   */
  listConsumerReferencePrices: adminProcedure
    .route({
      method: "GET",
      path: "/products/consumer-reference-prices",
      tags: ["Product Management"],
      summary: "List consumer reference prices",
      description:
        "Admin view of retail (or unset-type) variant prices with taxonomy for consumer price management.",
    })
    .input(consumerPriceListPagedSchema)
    .handler(async ({ input }) => fetchConsumerReferencePricePage(input)),

  /**
   * Update a single consumer reference price (product_variant_price + linked product_variant)
   */
  updateConsumerReferencePrice: adminProcedure
    .route({
      method: "PUT",
      path: "/products/variant-prices/consumer-price",
      tags: ["Product Management"],
      summary: "Update consumer reference price",
      description:
        "Updates reference consumer price and syncs linked auto-generated product_variant rows.",
    })
    .input(updateConsumerReferencePriceSchema)
    .handler(async ({ input }) => {
      const [existing] = await db
        .select({
          id: productVariantPrice.id,
          createdByWarehouseId: product.createdByWarehouseId,
          creatorSource: product.creatorSource,
        })
        .from(productVariantPrice)
        .innerJoin(product, eq(productVariantPrice.productId, product.id))
        .where(eq(productVariantPrice.id, input.variantPriceId));

      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Variant price row not found",
        });
      }

      if (existing.creatorSource !== "admin") {
        throw new ORPCError("FORBIDDEN", {
          message: "Only admin-created product prices can be updated here",
        });
      }

      await db
        .update(productVariantPrice)
        .set({ consumerPrice: input.consumerPrice, updatedAt: new Date() })
        .where(eq(productVariantPrice.id, input.variantPriceId));

      await db
        .update(productVariant)
        .set({ price: input.consumerPrice, updatedAt: new Date() })
        .where(eq(productVariant.sourceVariantPriceId, input.variantPriceId));

      return { success: true as const };
    }),

  /**
   * Export consumer reference price list as CSV (same filters as list)
   */
  exportConsumerPricesCSV: adminProcedure
    .route({
      method: "POST",
      path: "/products/consumer-reference-prices/export-csv",
      tags: ["Product Management"],
      summary: "Export consumer reference prices CSV",
    })
    .input(consumerPriceListParamsSchema)
    .handler(async ({ input }) => {
      const { items } = await fetchConsumerReferencePriceData(input);
      const header = [
        "Type",
        "Category",
        "SubCategory",
        "CoreOrProduct",
        "Brand",
        "Variant",
        "Unit",
        "ReferencePriceBDT",
        "UpdatedAt",
        "VariantPriceId",
      ];
      const escapeCsv = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines = [
        header.join(","),
        ...items.map((i) =>
          [
            i.typeName,
            i.categoryName,
            i.subCategoryName,
            i.coreProductName ?? i.productName,
            i.brandDisplay,
            i.variantName,
            i.variantUnit,
            i.consumerPrice,
            i.updatedAt ? i.updatedAt.toISOString() : "",
            String(i.variantPriceId),
          ]
            .map((c) => escapeCsv(String(c)))
            .join(","),
        ),
      ];
      return { csv: lines.join("\n") };
    }),

};
