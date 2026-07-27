/**
 * Customer-facing ORPC Router
 *
 * Contains all queries and mutations for the B2C marketplace customer view.
 * - No admin, dealer, shop owner, inventory write, ledger, or analytics logic
 * - Canonical catalog variants for public reference products
 * - Read-only access to stock and pricing
 * - Location-based filtering where applicable
 */

import { db } from "@bikalpo-project/db";
import {
  address,
  announcement,
  area,
  brand,
  brandUpdate,
  cart,
  cartItem,
  category,
  comboOffer,
  coreProductIdentity,
  customerHomeTab,
  customerHomeTabProduct,
  deliveryGroupInvoice,
  estimate,
  inventory,
  invoice,
  itemRequest,
  offer,
  openOrderBid,
  openOrderBidItem,
  order,
  orderItem,
  payment,
  product,
  productReview,
  productVariant,
  sellerAreaMapping,
  subCategory,
  supportTicket,
  supportTicketReply,
  user,
  userProfile,
} from "@bikalpo-project/db/schema";
import {
  resolveVariantMovementSemantics,
  resolveVariantOption,
} from "@bikalpo-project/db/variant-definition";
import { ORPCError } from "@orpc/server";
import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";
import { z } from "zod";

import {
  adminProcedure,
  consumerProcedure,
  protectedProcedure,
  publicProcedure,
} from "../index";
import {
  getDirectCartInventoryIssue,
  resolveDirectCartInventorySnapshot,
} from "../services/direct-cart-domain";
import {
  computeOrderAreaFields,
  findAreasForPoint,
  findSellersNearPoint,
} from "../services/location-service";
import {
  resolveCartTransition,
  sortComparableOffers,
} from "../services/open-order-domain";
import {
  acceptOpenOrderOffer,
  type CartItemForOpenOrder,
  cancelOpenOrder,
  createOffersForOrder,
  findEligibleSellers,
  OFFER_WINDOW_SECONDS,
  reconcileOpenOrder,
  SELECTION_WINDOW_SECONDS,
} from "../services/open-order-matching";
import { buildStoreProductDetail } from "../services/retailer-store-product-detail";
import {
  convertEstimateToB2bOrder,
  estimateOrderAcceptSchema,
} from "./helpers/estimate-order-conversion";
import {
  getReferenceProductEffectivePrice,
  getReferenceSellerKey,
  isOpenOrderReferenceSelectionEligible,
  sortReferenceProducts,
} from "./helpers/reference-product-catalog";
import {
  buildRetailerStorefrontFacets,
  filterAndSortRetailerStorefrontProducts,
  retailerStorefrontSortValues,
} from "./helpers/retailer-storefront-catalog";

// ────────────────────────────────────────────────────────────────
// Shared Zod Schemas
// ────────────────────────────────────────────────────────────────

const productFiltersSchema = z.object({
  category: z.string().optional().nullable(),
  subcategory: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  minPrice: z.string().optional().nullable(),
  maxPrice: z.string().optional().nullable(),
  inStock: z.string().optional().nullable(),
  search: z.string().optional().nullable(),
  sort: z.string().optional().nullable(),
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("12"),
});

const webViewProductDetailSchema = z
  .object({
    id: z.number().int().optional(),
    slug: z.string().optional(),
  })
  .refine((input) => input.id != null || !!input.slug?.trim(), {
    message: "Product id or slug is required",
  });

const shippingInfoSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  area: z.string().optional(),
  postalCode: z.string().optional(),
  customerNote: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
});

const addressFormSchema = z.object({
  label: z.string().min(1, "Label is required"),
  recipientName: z.string().min(2, "Recipient name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  area: z.string().optional(),
  postalCode: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const profileFormSchema = z.object({
  businessName: z.string().min(1).max(100),
  ownerName: z.string().min(1).max(100),
  phoneNumber: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  facebook: z.string().url().optional().nullable().or(z.literal("")),
  whatsapp: z.string().optional().nullable(),
});

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function parseWeightFromSize(size: string | null): number {
  if (!size || typeof size !== "string") return 0;
  const m = size.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

function generateOrderNumber(): string {
  const d = new Date();
  const yy = d.getFullYear().toString().slice(-2);
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${yy}${mm}${dd}-${rand}`;
}

// Simple in-memory delivery cost calculation (re-uses delivery rules from DB)
async function calculateDeliveryCost(
  totalWeightKg: number,
  _area?: string,
): Promise<number> {
  try {
    // Query delivery rules if the table exists
    const rules = await db.execute(
      sql`SELECT * FROM delivery_rule WHERE is_active = true ORDER BY sort_order ASC, id ASC`,
    );
    for (const rule of rules.rows as Array<{
      area: string | null;
      min_weight_kg: string | number | null;
      max_weight_kg: string | number | null;
      base_cost: string | number | null;
      per_kg_cost: string | number | null;
    }>) {
      const areaMatch =
        rule.area == null ||
        rule.area === "" ||
        (_area != null &&
          _area !== "" &&
          rule.area.toLowerCase() === _area.toLowerCase());
      if (!areaMatch) continue;
      const minKg = rule.min_weight_kg != null ? Number(rule.min_weight_kg) : 0;
      const maxKg =
        rule.max_weight_kg != null
          ? Number(rule.max_weight_kg)
          : Number.MAX_SAFE_INTEGER;
      if (totalWeightKg < minKg || totalWeightKg > maxKg) continue;
      const base = Number(rule.base_cost) || 0;
      const perKg = Number(rule.per_kg_cost) || 0;
      return Math.max(0, base + perKg * totalWeightKg);
    }
  } catch {
    // delivery_rule table may not exist – fall back to 0
  }
  return 0;
}

function asNumber(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isConsumerVisibleVariant(variant: any): boolean {
  const isRetailType =
    variant.variantType === "retail" || variant.variantType == null;
  const isConsumerRole =
    variant.visibilityRole === "consumer" ||
    variant.visibilityRole === "all" ||
    variant.visibilityRole == null;

  return variant.isActive !== false && isRetailType && isConsumerRole;
}

function getVariantOptionLabel(option: any): string {
  return option ? resolveVariantOption(option).label : "Variant";
}

function getVariantUnitLabel(option: any): string {
  return option ? resolveVariantOption(option).orderUnit : "";
}

function getActiveReferencePrices(productRow: any) {
  const activeConsumerVariants = (productRow.variants ?? []).filter(
    isConsumerVisibleVariant,
  );
  const variantPriceIds = new Set(
    activeConsumerVariants
      .map((variant: any) => variant.sourceVariantPriceId)
      .filter((id: number | null | undefined): id is number => id != null),
  );

  return (productRow.variantPrices ?? []).filter((priceRow: any) => {
    if (priceRow.isActive === false) return false;
    if (variantPriceIds.size === 0) return true;
    return variantPriceIds.has(priceRow.id);
  });
}

function getWebViewProductConditions() {
  const scheduledCondition = or(
    isNull(product.scheduledAt),
    lte(product.scheduledAt, new Date()),
  );

  return [
    eq(product.status, "active"),
    eq(product.visibility, "public"),
    scheduledCondition,
  ].filter(Boolean) as SQL[];
}

type ReferencePriceEntry = {
  productRow: any;
  row: any;
  price: number;
};

function getProductReferencePriceEntries(
  productRows: any[],
): ReferencePriceEntry[] {
  return productRows.flatMap((productRow) =>
    getActiveReferencePrices(productRow).map((row: any) => ({
      productRow,
      row,
      price: asNumber(row.consumerPrice),
    })),
  );
}

function getLowestReferencePriceFromRows(productRows: any[]) {
  const priced = getProductReferencePriceEntries(productRows)
    .filter((entry) => entry.price > 0)
    .sort((a, b) => a.price - b.price);

  if (priced[0]) return priced[0];

  return (
    productRows
      .map((productRow) => ({
        productRow,
        row: null,
        price: asNumber(productRow.price),
      }))
      .filter((entry) => entry.price > 0)
      .sort((a, b) => a.price - b.price)[0] ?? null
  );
}

function getPrimaryWebViewProduct(productRows: any[]) {
  return (
    productRows.find((productRow) => productRow.creatorSource === "admin") ??
    productRows[0] ??
    null
  );
}

function getScopedWebViewProductRows(productRows: any[]) {
  const adminRows = productRows.filter(
    (productRow) => productRow.creatorSource === "admin",
  );

  return adminRows.length > 0 ? adminRows : productRows;
}

function serializeWebViewCoreProduct(
  coreProduct: any,
  productRows: any[],
  reviewStatsMap: Record<
    number,
    { averageRating: number; totalReviews: number }
  >,
  sellerCountMap: Record<number, number>,
) {
  const primaryProduct = getPrimaryWebViewProduct(productRows);
  const lowest = getLowestReferencePriceFromRows(productRows);
  const fallbackPrice = asNumber(primaryProduct?.price);
  const displayPrice = lowest?.price ?? fallbackPrice;
  const referenceRow = lowest?.row;
  const identityDescription =
    coreProduct.description ||
    primaryProduct?.shortDescription ||
    primaryProduct?.description ||
    "";

  return {
    id: coreProduct.id,
    name: coreProduct.name,
    slug: coreProduct.slug,
    shortDescription:
      primaryProduct?.shortDescription ?? coreProduct.description ?? null,
    coreIdentity: {
      id: coreProduct.id,
      name: coreProduct.name,
      sku: coreProduct.sku ?? primaryProduct?.sku ?? null,
      description: identityDescription,
    },
    image: coreProduct.image || primaryProduct?.image || null,
    price: displayPrice,
    unitLabel: referenceRow
      ? getVariantUnitLabel(referenceRow.variantOption)
      : primaryProduct?.size,
    variantLabel: referenceRow
      ? getVariantOptionLabel(referenceRow.variantOption)
      : primaryProduct?.size,
    inStock: productRows.some((productRow) => productRow.inStock),
    category: coreProduct.category,
    subCategory: coreProduct.subCategory,
    reviewStats: reviewStatsMap[coreProduct.id] ?? {
      averageRating: 0,
      totalReviews: 0,
    },
    sellerCount: sellerCountMap[coreProduct.id] ?? 0,
  };
}

function isBetterReferencePriceEntry(
  next: ReferencePriceEntry,
  current: ReferencePriceEntry,
) {
  const nextPrice = asNumber(next.row.consumerPrice);
  const currentPrice = asNumber(current.row.consumerPrice);

  if (nextPrice > 0 && currentPrice <= 0) return true;
  if (nextPrice <= 0 && currentPrice > 0) return false;
  if (nextPrice !== currentPrice) return nextPrice < currentPrice;
  return (next.row.sortOrder ?? 0) < (current.row.sortOrder ?? 0);
}

function getUniqueReferencePriceEntries(productRows: any[]) {
  const selected = new Map<string, ReferencePriceEntry>();

  for (const entry of getProductReferencePriceEntries(productRows)) {
    const key = `${entry.row.brandId ?? "default"}:${entry.row.variantOptionId}`;
    const current = selected.get(key);
    if (!current || isBetterReferencePriceEntry(entry, current)) {
      selected.set(key, entry);
    }
  }

  return Array.from(selected.values()).sort((a, b) => {
    if (a.price > 0 && b.price <= 0) return -1;
    if (a.price <= 0 && b.price > 0) return 1;
    const priceDiff = a.price - b.price;
    if (priceDiff !== 0) return priceDiff;
    return getVariantOptionLabel(a.row.variantOption).localeCompare(
      getVariantOptionLabel(b.row.variantOption),
    );
  });
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => !!value?.trim())),
  );
}

function productRowsMatchBrandFilter(productRows: any[], brandIds: number[]) {
  if (brandIds.length === 0) return true;

  return productRows.some(
    (productRow) =>
      (productRow.productBrands ?? []).some((link: any) =>
        brandIds.includes(link.brandId),
      ) ||
      (productRow.variantPrices ?? []).some(
        (priceRow: any) =>
          priceRow.isActive !== false &&
          priceRow.brandId != null &&
          brandIds.includes(priceRow.brandId),
      ),
  );
}

async function getCoreReviewStatsMap(coreProductIds: number[]) {
  const reviewStatsMap: Record<
    number,
    { averageRating: number; totalReviews: number }
  > = {};

  if (coreProductIds.length === 0) return reviewStatsMap;

  const reviewRows = await db
    .select({
      coreProductId: product.coreProductId,
      averageRating: avg(productReview.rating),
      totalReviews: count(productReview.id),
    })
    .from(productReview)
    .innerJoin(product, eq(productReview.productId, product.id))
    .where(
      and(
        inArray(product.coreProductId, coreProductIds),
        ...getWebViewProductConditions(),
      ),
    )
    .groupBy(product.coreProductId);

  for (const row of reviewRows) {
    if (row.coreProductId == null) continue;
    reviewStatsMap[row.coreProductId] = {
      averageRating: row.averageRating
        ? Number.parseFloat(row.averageRating)
        : 0,
      totalReviews: row.totalReviews || 0,
    };
  }

  return reviewStatsMap;
}

async function getCoreSellerCountMap(coreProductIds: number[]) {
  const sellerCountMap: Record<number, number> = {};

  if (coreProductIds.length === 0) return sellerCountMap;

  const sellerRows = await db
    .select({
      coreProductId: product.coreProductId,
      sellerCount: sql<number>`COUNT(DISTINCT ${inventory.ownerId})`.mapWith(
        Number,
      ),
    })
    .from(inventory)
    .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
    .innerJoin(product, eq(productVariant.productId, product.id))
    .innerJoin(user, eq(inventory.ownerId, user.id))
    .where(
      and(
        eq(inventory.ownerType, "shop"),
        inArray(product.coreProductId, coreProductIds),
        ...getWebViewProductConditions(),
        eq(productVariant.isActive, true),
        sql`CAST(${inventory.availableQty} AS numeric) > 0`,
        eq(user.role, "shop_owner"),
        eq(user.sellerStatus, "approved"),
      ),
    )
    .groupBy(product.coreProductId);

  for (const row of sellerRows) {
    if (row.coreProductId == null) continue;
    sellerCountMap[row.coreProductId] = row.sellerCount || 0;
  }

  return sellerCountMap;
}

type AdminReferenceProductIdentity = {
  brandId: number | null;
  coreProductId: number | null;
};

async function getReferenceSellerCountMap(
  referenceProducts: AdminReferenceProductIdentity[],
) {
  const sellerCountMap: Record<string, number> = {};
  const coreProductIds = [
    ...new Set(
      referenceProducts
        .map((referenceProduct) => referenceProduct.coreProductId)
        .filter((id): id is number => id != null),
    ),
  ];

  if (coreProductIds.length === 0) return sellerCountMap;

  const sellerRows = await db
    .select({
      brandId: product.brandId,
      coreProductId: product.coreProductId,
      sellerCount: sql<number>`COUNT(DISTINCT ${inventory.ownerId})`.mapWith(
        Number,
      ),
    })
    .from(inventory)
    .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
    .innerJoin(product, eq(productVariant.productId, product.id))
    .innerJoin(user, eq(inventory.ownerId, user.id))
    .where(
      and(
        eq(inventory.ownerType, "shop"),
        inArray(product.coreProductId, coreProductIds),
        ...getWebViewProductConditions(),
        eq(productVariant.isActive, true),
        sql`CAST(${inventory.availableQty} AS numeric) > 0`,
        eq(user.role, "shop_owner"),
        eq(user.sellerStatus, "approved"),
      ),
    )
    .groupBy(product.coreProductId, product.brandId);

  for (const row of sellerRows) {
    if (row.coreProductId == null) continue;
    sellerCountMap[getReferenceSellerKey(row.coreProductId, row.brandId)] =
      row.sellerCount || 0;
  }

  return sellerCountMap;
}

async function getReferenceReviewStatsMap(productIds: number[]) {
  const reviewStatsMap: Record<
    number,
    { averageRating: number; totalReviews: number }
  > = {};

  if (productIds.length === 0) return reviewStatsMap;

  const reviewRows = await db
    .select({
      averageRating: avg(productReview.rating),
      productId: productReview.productId,
      totalReviews: count(productReview.id),
    })
    .from(productReview)
    .where(inArray(productReview.productId, productIds))
    .groupBy(productReview.productId);

  for (const row of reviewRows) {
    reviewStatsMap[row.productId] = {
      averageRating: row.averageRating
        ? Number.parseFloat(row.averageRating)
        : 0,
      totalReviews: row.totalReviews || 0,
    };
  }

  return reviewStatsMap;
}

// ════════════════════════════════════════════════════════════════
// QUERIES (read-only, customer-facing)
// ════════════════════════════════════════════════════════════════

const queries = {
  // ── Products ─────────────────────────────────────────────────

  /** Get admin core products for the web-view reference marketplace */
  getWebViewProducts: adminProcedure
    .route({
      method: "GET",
      path: "/customer/web-view-products",
      tags: ["Customer"],
      summary: "Get public web view reference products",
    })
    .input(productFiltersSchema)
    .handler(async ({ input }) => {
      const {
        category: categorySlug,
        subcategory,
        brand: brandSlug,
        minPrice,
        maxPrice,
        search,
        sort = "newest",
        page: pageStr = "1",
        limit: limitStr = "12",
      } = input;

      const page = Math.max(1, Number.parseInt(pageStr, 10) || 1);
      const limit = Math.max(
        1,
        Math.min(60, Number.parseInt(limitStr, 10) || 12),
      );
      const offset = (page - 1) * limit;
      const conditions: SQL[] = [];
      let brandFilterIds: number[] = [];

      if (categorySlug) {
        const slugs = categorySlug.split(",").filter(Boolean);
        const cats = await db.query.category.findMany({
          where: inArray(category.slug, slugs),
        });
        if (cats.length === 0) {
          return {
            products: [],
            pagination: { page, limit, totalCount: 0, totalPages: 0 },
          };
        }
        conditions.push(
          inArray(
            coreProductIdentity.categoryId,
            cats.map((c) => c.id),
          ),
        );
      }

      if (subcategory) {
        const slugs = subcategory.split(",").filter(Boolean);
        const subs = await db.query.subCategory.findMany({
          where: inArray(subCategory.slug, slugs),
        });
        if (subs.length > 0) {
          conditions.push(
            inArray(
              coreProductIdentity.subCategoryId,
              subs.map((s) => s.id),
            ),
          );
        }
      }

      if (brandSlug) {
        const slugs = brandSlug.split(",").filter(Boolean);
        const brands = await db.query.brand.findMany({
          where: inArray(brand.slug, slugs),
        });
        if (brands.length === 0) {
          return {
            products: [],
            pagination: { page, limit, totalCount: 0, totalPages: 0 },
          };
        }

        brandFilterIds = brands.map((b) => b.id);
      }

      if (search?.trim()) {
        const q = `%${search.trim()}%`;
        const searchCondition = or(
          ilike(coreProductIdentity.name, q),
          ilike(coreProductIdentity.description, q),
          ilike(coreProductIdentity.sku, q),
        );
        if (searchCondition) conditions.push(searchCondition);
      }

      const coreRows = await db.query.coreProductIdentity.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          category: { columns: { name: true, slug: true } },
          subCategory: { columns: { name: true, slug: true } },
        },
        orderBy: [desc(coreProductIdentity.createdAt)],
      });

      const coreProductIds = coreRows.map((coreProduct) => coreProduct.id);
      const productRows =
        coreProductIds.length > 0
          ? await db.query.product.findMany({
              where: and(
                ...getWebViewProductConditions(),
                inArray(product.coreProductId, coreProductIds),
              ),
              with: {
                category: { columns: { name: true, slug: true } },
                subCategory: { columns: { name: true, slug: true } },
                coreProduct: true,
                images: true,
                productBrands: { with: { brand: true } },
                variantPrices: {
                  with: {
                    brand: true,
                    variantOption: true,
                  },
                },
                variants: {
                  with: {
                    brand: true,
                    sourceVariantOption: true,
                  },
                },
              },
              orderBy: [desc(product.createdAt)],
            })
          : [];

      const productRowsByCoreId = new Map<number, any[]>();
      for (const productRow of productRows) {
        if (productRow.coreProductId == null) continue;
        const rows = productRowsByCoreId.get(productRow.coreProductId) ?? [];
        rows.push(productRow);
        productRowsByCoreId.set(productRow.coreProductId, rows);
      }

      const [reviewStatsMap, sellerCountMap] = await Promise.all([
        getCoreReviewStatsMap(coreProductIds),
        getCoreSellerCountMap(coreProductIds),
      ]);

      let serialized = coreRows
        .map((coreProduct) => {
          const scopedRows = getScopedWebViewProductRows(
            productRowsByCoreId.get(coreProduct.id) ?? [],
          );

          return { coreProduct, scopedRows };
        })
        .filter(({ scopedRows }) =>
          productRowsMatchBrandFilter(scopedRows, brandFilterIds),
        )
        .map(({ coreProduct, scopedRows }) =>
          serializeWebViewCoreProduct(
            coreProduct,
            scopedRows,
            reviewStatsMap,
            sellerCountMap,
          ),
        );

      if (minPrice) {
        const minValue = asNumber(minPrice);
        serialized = serialized.filter((p) => asNumber(p.price) >= minValue);
      }
      if (maxPrice) {
        const maxValue = asNumber(maxPrice);
        serialized = serialized.filter((p) => asNumber(p.price) <= maxValue);
      }

      serialized = serialized.sort((a, b) => {
        switch (sort) {
          case "price-asc":
          case "price_asc":
            return asNumber(a.price) - asNumber(b.price);
          case "price-desc":
          case "price_desc":
            return asNumber(b.price) - asNumber(a.price);
          case "name-asc":
          case "name_asc":
            return a.name.localeCompare(b.name);
          case "name-desc":
          case "name_desc":
            return b.name.localeCompare(a.name);
          default:
            return 0;
        }
      });

      const totalCount = serialized.length;
      const products = serialized.slice(offset, offset + limit);

      return {
        products,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  /** Get one core product reference detail for the web-view modal */
  getWebViewProductDetail: adminProcedure
    .route({
      method: "GET",
      path: "/customer/web-view-products/detail",
      tags: ["Customer"],
      summary: "Get public web view reference product detail",
    })
    .input(webViewProductDetailSchema)
    .handler(async ({ input }) => {
      const identityCondition = input.id
        ? eq(coreProductIdentity.id, input.id)
        : eq(coreProductIdentity.slug, input.slug?.trim() ?? "");

      let found = await db.query.coreProductIdentity.findFirst({
        where: identityCondition,
        with: {
          category: { columns: { name: true, slug: true } },
          subCategory: { columns: { name: true, slug: true } },
        },
      });

      if (!found) {
        const productIdentityCondition = input.id
          ? eq(product.id, input.id)
          : eq(product.slug, input.slug?.trim() ?? "");
        const foundProduct = await db.query.product.findFirst({
          where: and(
            ...getWebViewProductConditions(),
            productIdentityCondition,
          ),
          columns: { coreProductId: true },
        });

        if (foundProduct?.coreProductId) {
          found = await db.query.coreProductIdentity.findFirst({
            where: eq(coreProductIdentity.id, foundProduct.coreProductId),
            with: {
              category: { columns: { name: true, slug: true } },
              subCategory: { columns: { name: true, slug: true } },
            },
          });
        }
      }

      if (!found) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      const allProductRows = await db.query.product.findMany({
        where: and(
          ...getWebViewProductConditions(),
          eq(product.coreProductId, found.id),
        ),
        with: {
          images: true,
          productBrands: { with: { brand: true } },
          variantPrices: {
            with: {
              brand: true,
              variantOption: true,
            },
          },
          variants: {
            with: {
              brand: true,
              sourceVariantOption: true,
            },
          },
        },
        orderBy: [desc(product.createdAt)],
      });
      const productRows = getScopedWebViewProductRows(allProductRows);

      const primaryProduct = getPrimaryWebViewProduct(productRows);
      const [reviewStatsMap, sellerCountMap] = await Promise.all([
        getCoreReviewStatsMap([found.id]),
        getCoreSellerCountMap([found.id]),
      ]);
      const summary = serializeWebViewCoreProduct(
        found,
        productRows,
        reviewStatsMap,
        sellerCountMap,
      );
      const activeConsumerVariants = productRows.flatMap((productRow) =>
        (productRow.variants ?? []).filter(isConsumerVisibleVariant),
      );
      const variantByPriceId = new Map<number, any>();
      for (const variant of activeConsumerVariants) {
        if (variant.sourceVariantPriceId != null) {
          variantByPriceId.set(variant.sourceVariantPriceId, variant);
        }
      }

      const brandMap = new Map<
        number,
        { id: number; name: string; slug: string | null; logo: string | null }
      >();

      for (const productRow of productRows) {
        for (const link of productRow.productBrands ?? []) {
          if (link.brand) {
            brandMap.set(link.brand.id, {
              id: link.brand.id,
              name: link.brand.name,
              slug: link.brand.slug,
              logo: link.brand.logo,
            });
          }
        }
      }

      const variantMap = new Map<
        number,
        {
          id: number;
          label: string;
          unitLabel: string;
          unit: string | null;
          size: string | null;
          variantType: string | null;
        }
      >();

      for (const variant of activeConsumerVariants) {
        if (variant.brand) {
          brandMap.set(variant.brand.id, {
            id: variant.brand.id,
            name: variant.brand.name,
            slug: variant.brand.slug,
            logo: variant.brand.logo,
          });
        }

        const variantOption = variant.sourceVariantOption;
        if (variantOption) {
          variantMap.set(variantOption.id, {
            id: variantOption.id,
            label: variant.unitLabel || getVariantOptionLabel(variantOption),
            unitLabel: getVariantUnitLabel(variantOption),
            unit: variantOption.unit,
            size: variantOption.size,
            variantType: variantOption.variantType,
          });
        }
      }

      const referencePrices = getUniqueReferencePriceEntries(productRows).map(
        ({ row: priceRow }) => {
          if (priceRow.brand) {
            brandMap.set(priceRow.brand.id, {
              id: priceRow.brand.id,
              name: priceRow.brand.name,
              slug: priceRow.brand.slug,
              logo: priceRow.brand.logo,
            });
          }

          const generatedVariant = variantByPriceId.get(priceRow.id);
          const variantOption = priceRow.variantOption;
          if (variantOption) {
            variantMap.set(variantOption.id, {
              id: variantOption.id,
              label:
                generatedVariant?.unitLabel ||
                getVariantOptionLabel(variantOption),
              unitLabel: getVariantUnitLabel(variantOption),
              unit: variantOption.unit,
              size: variantOption.size,
              variantType: variantOption.variantType,
            });
          }

          return {
            id: priceRow.id,
            brandId: priceRow.brandId,
            brandName: priceRow.brand?.name ?? null,
            variantOptionId: priceRow.variantOptionId,
            variantId: generatedVariant?.id ?? null,
            variantLabel:
              generatedVariant?.unitLabel ||
              getVariantOptionLabel(variantOption),
            unitLabel: getVariantUnitLabel(variantOption),
            consumerPrice: asNumber(priceRow.consumerPrice),
            color: generatedVariant?.color ?? null,
            size: generatedVariant?.size ?? variantOption?.size ?? null,
            packType: generatedVariant?.packType ?? null,
          };
        },
      );

      const brands = Array.from(brandMap.values());
      const returnableProducts = productRows.filter(
        (productRow) => productRow.isReturnablePack,
      );
      const packDepositAmount =
        returnableProducts
          .map((productRow) => asNumber(productRow.defaultPackDepositAmount))
          .find((value) => value > 0) ?? 0;

      return {
        product: {
          ...summary,
          description: primaryProduct?.description ?? found.description,
          videoUrl: primaryProduct?.videoUrl ?? null,
          images: uniqueStrings([
            found.image,
            ...productRows.flatMap((productRow) => [
              productRow.image,
              ...((productRow.images ?? []).map(
                (image: any) => image.imageUrl,
              ) ?? []),
            ]),
          ]),
          brands:
            brands.length > 0
              ? brands
              : [{ id: null, name: "Default", slug: null, logo: null }],
          variants: Array.from(variantMap.values()),
          referencePrices,
          emptyPackReturn: {
            enabled: returnableProducts.length > 0,
            depositAmount: packDepositAmount,
            companies: uniqueStrings(
              returnableProducts.flatMap(
                (productRow) => productRow.allowedPackBrands ?? [],
              ),
            ),
            packSizes: uniqueStrings(
              returnableProducts.flatMap(
                (productRow) => productRow.allowedPackSizes ?? [],
              ),
            ),
          },
        },
      };
    }),

  /** Get admin-created branded reference products for public discovery */
  getReferenceProducts: publicProcedure
    .route({
      method: "GET",
      path: "/customer/reference-products",
      tags: ["Customer"],
      summary: "Get public admin reference products",
    })
    .input(productFiltersSchema)
    .handler(async ({ input }) => {
      const {
        category: categorySlug,
        subcategory,
        brand: brandSlug,
        minPrice,
        maxPrice,
        inStock: inStockString,
        search,
        sort = "newest",
        page: pageString = "1",
        limit: limitString = "12",
      } = input;

      const page = Math.max(1, Number.parseInt(pageString, 10) || 1);
      const limit = Math.max(
        1,
        Math.min(100, Number.parseInt(limitString, 10) || 12),
      );
      const offset = (page - 1) * limit;
      const emptyResult = () => ({
        products: [],
        pagination: { page, limit, totalCount: 0, totalPages: 0 },
      });
      const conditions: SQL[] = [
        ...getWebViewProductConditions(),
        eq(product.creatorSource, "admin"),
        isNotNull(product.coreProductId),
        isNotNull(product.brandId),
      ];

      if (categorySlug) {
        const categorySlugs = categorySlug.split(",").filter(Boolean);
        const categories = await db.query.category.findMany({
          where: inArray(category.slug, categorySlugs),
          columns: { id: true },
        });
        if (categories.length === 0) return emptyResult();
        conditions.push(
          inArray(
            product.categoryId,
            categories.map((categoryRow) => categoryRow.id),
          ),
        );
      }

      if (subcategory) {
        const subcategorySlugs = subcategory.split(",").filter(Boolean);
        const subcategories = await db.query.subCategory.findMany({
          where: inArray(subCategory.slug, subcategorySlugs),
          columns: { id: true },
        });
        if (subcategories.length === 0) return emptyResult();
        conditions.push(
          inArray(
            product.subCategoryId,
            subcategories.map((subcategoryRow) => subcategoryRow.id),
          ),
        );
      }

      if (brandSlug) {
        const brandSlugs = brandSlug.split(",").filter(Boolean);
        const brands = await db.query.brand.findMany({
          where: inArray(brand.slug, brandSlugs),
          columns: { id: true },
        });
        if (brands.length === 0) return emptyResult();
        conditions.push(
          inArray(
            product.brandId,
            brands.map((brandRow) => brandRow.id),
          ),
        );
      }

      if (search?.trim()) {
        conditions.push(ilike(product.name, `%${search.trim()}%`));
      }

      if (inStockString === "true") conditions.push(eq(product.inStock, true));
      if (inStockString === "false")
        conditions.push(eq(product.inStock, false));

      const referenceProductRows = await db.query.product.findMany({
        where: and(...conditions),
        with: {
          category: { columns: { slug: true, name: true } },
          subCategory: { columns: { name: true } },
          brand: {
            columns: { id: true, name: true, slug: true, logo: true },
          },
          images: true,
          variants: {
            columns: {
              catalogVariantId: true,
              id: true,
              isActive: true,
              price: true,
              productId: true,
              sourceVariantPriceId: true,
              visibilityRole: true,
            },
            with: {
              catalogVariant: {
                columns: {
                  brandId: true,
                  configurationState: true,
                  coreProductId: true,
                  isActive: true,
                },
              },
            },
          },
          variantPrices: {
            columns: {
              consumerPrice: true,
              id: true,
              isActive: true,
            },
          },
        },
      });

      const referenceProducts = referenceProductRows.filter(
        (referenceProduct) =>
          referenceProduct.variants.some((variant) =>
            isOpenOrderReferenceSelectionEligible({
              product: referenceProduct,
              variant,
            }),
          ),
      );

      const productIds = referenceProducts.map(
        (referenceProduct) => referenceProduct.id,
      );
      const [reviewStatsMap, sellerCountMap] = await Promise.all([
        getReferenceReviewStatsMap(productIds),
        getReferenceSellerCountMap(referenceProducts),
      ]);

      let serializedProducts = referenceProducts.map((referenceProduct) => {
        const effectivePrice =
          getReferenceProductEffectivePrice(referenceProduct);
        const {
          variantPrices: _variantPrices,
          variants: _variants,
          ...productData
        } = referenceProduct;
        const sellerCount = referenceProduct.coreProductId
          ? sellerCountMap[
              getReferenceSellerKey(
                referenceProduct.coreProductId,
                referenceProduct.brandId,
              )
            ] || 0
          : 0;

        return {
          ...productData,
          price: effectivePrice,
          reviewStats: reviewStatsMap[referenceProduct.id] || {
            averageRating: 0,
            totalReviews: 0,
          },
          sellerCount,
        };
      });

      if (minPrice != null && minPrice !== "") {
        const minimumPrice = asNumber(minPrice);
        serializedProducts = serializedProducts.filter(
          (referenceProduct) =>
            asNumber(referenceProduct.price) >= minimumPrice,
        );
      }
      if (maxPrice != null && maxPrice !== "") {
        const maximumPrice = asNumber(maxPrice);
        serializedProducts = serializedProducts.filter(
          (referenceProduct) =>
            asNumber(referenceProduct.price) <= maximumPrice,
        );
      }

      serializedProducts = sortReferenceProducts(serializedProducts, sort);
      const totalCount = serializedProducts.length;

      return {
        products: serializedProducts.slice(offset, offset + limit),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  /** Get customer products with full-featured filtering & pagination */
  getCustomerProducts: publicProcedure
    .route({
      method: "GET",
      path: "/customer/products",
      tags: ["Customer"],
      summary: "Get customer products with filters",
    })
    .input(productFiltersSchema)
    .handler(async ({ input }) => {
      const {
        category: categorySlug,
        subcategory,
        brand: brandSlug,
        minPrice,
        maxPrice,
        inStock: inStockStr,
        search,
        sort = "newest",
        page: pageStr = "1",
        limit: limitStr = "12",
      } = input;

      const page = Math.max(1, parseInt(pageStr, 10) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(limitStr, 10) || 12));
      const offset = (page - 1) * limit;

      // Only active, public, non-scheduled products are sellable
      const conditions: SQL[] = [...getWebViewProductConditions()];

      // Category filter
      if (categorySlug) {
        const slugs = categorySlug.split(",").filter(Boolean);
        const cats = await db.query.category.findMany({
          where: inArray(category.slug, slugs),
        });
        if (cats.length > 0) {
          conditions.push(
            inArray(
              product.categoryId,
              cats.map((c) => c.id),
            ),
          );
        } else {
          return {
            products: [],
            pagination: { page, limit, totalCount: 0, totalPages: 0 },
          };
        }
      }

      // Subcategory filter
      if (subcategory) {
        const slugs = subcategory.split(",").filter(Boolean);
        const subs = await db.query.subCategory.findMany({
          where: inArray(subCategory.slug, slugs),
        });
        if (subs.length > 0) {
          conditions.push(
            inArray(
              product.subCategoryId,
              subs.map((s) => s.id),
            ),
          );
        }
      }

      // Brand filter — filter by product-level brand
      if (brandSlug) {
        const slugs = brandSlug.split(",").filter(Boolean);
        const brands = await db.query.brand.findMany({
          where: inArray(brand.slug, slugs),
        });
        if (brands.length > 0) {
          const brandIds = brands.map((b) => b.id);
          conditions.push(inArray(product.brandId, brandIds));
        } else {
          return {
            products: [],
            pagination: { page, limit, totalCount: 0, totalPages: 0 },
          };
        }
      }

      // Price filters
      if (minPrice) conditions.push(gte(product.price, minPrice));
      if (maxPrice) conditions.push(lte(product.price, maxPrice));

      // In-stock filter
      if (inStockStr === "true") conditions.push(eq(product.inStock, true));

      // Search
      if (search) conditions.push(ilike(product.name, `%${search}%`));

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Sort
      const getOrderBy = () => {
        switch (sort) {
          case "price-asc":
          case "price_asc":
            return [asc(product.price)];
          case "price-desc":
          case "price_desc":
            return [desc(product.price)];
          case "name-asc":
          case "name_asc":
            return [asc(product.name)];
          case "name-desc":
          case "name_desc":
            return [desc(product.name)];
          case "newest":
          default:
            return [desc(product.createdAt)];
        }
      };

      const [products, countResult] = await Promise.all([
        db.query.product.findMany({
          where: whereClause,
          with: {
            category: { columns: { slug: true, name: true } },
            subCategory: { columns: { name: true } },
            brand: {
              columns: { id: true, name: true, slug: true, logo: true },
            },
            images: true,
            variants: {
              columns: { id: true, price: true, isActive: true },
            },
          },
          orderBy: getOrderBy(),
          limit,
          offset,
        }),
        db.select({ count: count() }).from(product).where(whereClause),
      ]);

      const totalCount = countResult[0]?.count || 0;

      // Batch-fetch review stats for all returned products
      const productIds = products.map((p) => p.id);
      const reviewStatsMap: Record<
        number,
        { averageRating: number; totalReviews: number }
      > = {};
      if (productIds.length > 0) {
        const reviewRows = await db
          .select({
            productId: productReview.productId,
            averageRating: avg(productReview.rating),
            totalReviews: count(productReview.id),
          })
          .from(productReview)
          .where(inArray(productReview.productId, productIds))
          .groupBy(productReview.productId);

        for (const row of reviewRows) {
          reviewStatsMap[row.productId] = {
            averageRating: row.averageRating
              ? parseFloat(row.averageRating)
              : 0,
            totalReviews: row.totalReviews || 0,
          };
        }
      }

      // Batch-fetch seller counts (how many distinct product listings share the same coreProductId)
      const coreProductIds = products
        .map((p) => p.coreProductId)
        .filter((id): id is number => id != null);
      const sellerCountMap: Record<number, number> = {};
      if (coreProductIds.length > 0) {
        const uniqueCoreIds = [...new Set(coreProductIds)];
        const sellerRows = await db
          .select({
            coreProductId: product.coreProductId,
            sellerCount: count(product.id),
          })
          .from(product)
          .where(inArray(product.coreProductId, uniqueCoreIds))
          .groupBy(product.coreProductId);

        for (const row of sellerRows) {
          if (row.coreProductId != null) {
            sellerCountMap[row.coreProductId] = row.sellerCount || 0;
          }
        }
      }

      // Serialize products with proper price conversion + enrichments
      const serializedProducts = products.map((p) => {
        // Compute lowest variant price from the included variants
        const activeVariants = (p.variants || []).filter(
          (v) => v.isActive !== false,
        );
        const variantPrices = activeVariants
          .map((v) => parseFloat(v.price) || 0)
          .filter((price) => price > 0);
        const lowestVariantPrice =
          variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
        const basePrice = parseFloat(p.price) || 0;
        const effectivePrice =
          lowestVariantPrice > 0 ? lowestVariantPrice : basePrice;

        // Destructure to exclude variants from the response
        const { variants: _variants, ...productData } = p;

        return {
          ...productData,
          price: effectivePrice,
          reviewStats: reviewStatsMap[p.id] || {
            averageRating: 0,
            totalReviews: 0,
          },
          sellerCount: p.coreProductId
            ? sellerCountMap[p.coreProductId] || 0
            : 0,
        };
      });

      return {
        products: serializedProducts,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  /** Search products by name (quick search, max 10) */
  searchProducts: publicProcedure
    .route({
      method: "GET",
      path: "/customer/products/search",
      tags: ["Customer"],
      summary: "Quick search products",
    })
    .input(z.object({ query: z.string() }))
    .handler(async ({ input }) => {
      if (!input.query.trim()) return { products: [] };
      const results = await db.query.product.findMany({
        where: and(
          ilike(product.name, `%${input.query}%`),
          ...getWebViewProductConditions(),
        ),
        with: { category: { columns: { name: true, slug: true } } },
        limit: 10,
      });
      const serializedResults = results.map((p) => ({
        ...p,
        price: parseFloat(p.price),
      }));
      return { products: serializedResults };
    }),

  /** Get product by slug with all relations */
  getProductDetails: publicProcedure
    .route({
      method: "GET",
      path: "/customer/products/{slug}",
      tags: ["Customer"],
      summary: "Get product details by slug",
    })
    .input(z.object({ slug: z.string() }))
    .handler(async ({ input }) => {
      const found = await db.query.product.findFirst({
        where: and(
          eq(product.slug, input.slug),
          ...getWebViewProductConditions(),
        ),
        with: {
          category: { columns: { name: true, slug: true } },
          subCategory: { columns: { name: true } },
          brand: { columns: { id: true, name: true, slug: true, logo: true } },
          images: true,
        },
      });
      if (!found)
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });

      const isAdminReference = found.creatorSource === "admin";
      const variantRows = await db.query.productVariant.findMany({
        where: eq(productVariant.productId, found.id),
        with: {
          catalogVariant: {
            columns: {
              brandId: true,
              configurationState: true,
              coreProductId: true,
              isActive: true,
            },
          },
        },
        orderBy: [asc(productVariant.sortOrder)],
      });
      const variants = variantRows.filter((variant) =>
        isAdminReference
          ? isOpenOrderReferenceSelectionEligible({
              product: found,
              variant,
            })
          : variant.variantType === "retail" || variant.variantType == null,
      );
      if (variants.length === 0) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      // Serialize product and variants with proper price conversion
      const foundSerialized = {
        ...found,
        price: parseFloat(found.price),
      };
      const variantsSerialized = variants.map((variant) => {
        const { catalogVariant: _catalogVariant, ...variantData } = variant;
        return {
          ...variantData,
          price: parseFloat(variant.price),
        };
      });

      // Get review stats
      const reviewStats = await db
        .select({
          averageRating: avg(productReview.rating),
          totalReviews: count(productReview.id),
        })
        .from(productReview)
        .where(eq(productReview.productId, found.id));

      return {
        product: foundSerialized,
        variants: variantsSerialized,
        reviewStats: {
          averageRating: reviewStats[0]?.averageRating
            ? parseFloat(reviewStats[0].averageRating)
            : 0,
          totalReviews: reviewStats[0]?.totalReviews || 0,
        },
      };
    }),

  /** Get reviews for a product */
  getProductReviews: publicProcedure
    .route({
      method: "GET",
      path: "/customer/products/{productId}/reviews",
      tags: ["Customer"],
      summary: "Get reviews for a product",
    })
    .input(z.object({ productId: z.number() }))
    .handler(async ({ input }) => {
      const reviews = await db.query.productReview.findMany({
        where: eq(productReview.productId, input.productId),
        with: {
          user: { columns: { id: true, name: true, image: true } },
        },
        orderBy: [desc(productReview.createdAt)],
      });

      const stats = await db
        .select({
          averageRating: avg(productReview.rating),
          totalReviews: count(productReview.id),
        })
        .from(productReview)
        .where(eq(productReview.productId, input.productId));

      return {
        reviews,
        stats: {
          averageRating: stats[0]?.averageRating
            ? parseFloat(stats[0].averageRating)
            : 0,
          totalReviews: stats[0]?.totalReviews || 0,
        },
      };
    }),

  // ── Categories ───────────────────────────────────────────────

  /** Get all active categories with subcategories */
  getActiveCategories: publicProcedure
    .route({
      method: "GET",
      path: "/customer/categories",
      tags: ["Customer"],
      summary: "Get active categories",
    })
    .handler(async () => {
      const categories = await db.query.category.findMany({
        where: eq(category.isActive, true),
        with: { subCategory: true },
        orderBy: [asc(category.displayOrder)],
      });
      return { categories };
    }),

  /** Get category by slug */
  getCategoryBySlug: publicProcedure
    .route({
      method: "GET",
      path: "/customer/categories/{slug}",
      tags: ["Customer"],
      summary: "Get category by slug",
    })
    .input(z.object({ slug: z.string() }))
    .handler(async ({ input }) => {
      const found = await db.query.category.findFirst({
        where: and(eq(category.slug, input.slug), eq(category.isActive, true)),
        with: { subCategory: true },
      });
      if (!found)
        throw new ORPCError("NOT_FOUND", { message: "Category not found" });
      return { category: found };
    }),

  /** Get categories with their products (for home page) */
  getCategoriesWithProducts: publicProcedure
    .route({
      method: "GET",
      path: "/customer/categories/with-products",
      tags: ["Customer"],
      summary: "Get categories with products for home page",
    })
    .input(z.object({ limit: z.number().min(1).max(20).default(4) }).optional())
    .handler(async ({ input }) => {
      const prodLimit = input?.limit ?? 4;
      const categories = await db.query.category.findMany({
        where: eq(category.isActive, true),
        orderBy: [asc(category.displayOrder)],
      });

      const result = await Promise.all(
        categories.map(async (cat) => {
          const products = await db.query.product.findMany({
            where: and(
              eq(product.categoryId, cat.id),
              eq(product.inStock, true),
              ...getWebViewProductConditions(),
            ),
            with: {
              category: { columns: { name: true, slug: true } },
              brand: {
                columns: { id: true, name: true, slug: true, logo: true },
              },
              variants: {
                columns: { id: true, price: true, isActive: true },
              },
            },
            limit: prodLimit,
            orderBy: [desc(product.createdAt)],
          });

          // Batch-fetch review stats
          const pIds = products.map((p) => p.id);
          const reviewStatsMap: Record<
            number,
            { averageRating: number; totalReviews: number }
          > = {};
          if (pIds.length > 0) {
            const reviewRows = await db
              .select({
                productId: productReview.productId,
                averageRating: avg(productReview.rating),
                totalReviews: count(productReview.id),
              })
              .from(productReview)
              .where(inArray(productReview.productId, pIds))
              .groupBy(productReview.productId);
            for (const row of reviewRows) {
              reviewStatsMap[row.productId] = {
                averageRating: row.averageRating
                  ? parseFloat(row.averageRating)
                  : 0,
                totalReviews: row.totalReviews || 0,
              };
            }
          }

          // Batch-fetch seller counts
          const coreIds = products
            .map((p) => p.coreProductId)
            .filter((id): id is number => id != null);
          const sellerCountMap: Record<number, number> = {};
          if (coreIds.length > 0) {
            const uniqueCoreIds = [...new Set(coreIds)];
            const sellerRows = await db
              .select({
                coreProductId: product.coreProductId,
                sellerCount: count(product.id),
              })
              .from(product)
              .where(inArray(product.coreProductId, uniqueCoreIds))
              .groupBy(product.coreProductId);
            for (const row of sellerRows) {
              if (row.coreProductId != null) {
                sellerCountMap[row.coreProductId] = row.sellerCount || 0;
              }
            }
          }

          // Serialize products with enrichments (compute min variant price in JS)
          const serializedProducts = products.map((p) => {
            const activeVariants = (p.variants || []).filter(
              (v) => v.isActive !== false,
            );
            const variantPrices = activeVariants
              .map((v) => parseFloat(v.price) || 0)
              .filter((price) => price > 0);
            const lowestVariantPrice =
              variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
            const basePrice = parseFloat(p.price) || 0;
            const effectivePrice =
              lowestVariantPrice > 0 ? lowestVariantPrice : basePrice;

            const { variants: _variants, ...productData } = p;
            return {
              ...productData,
              price: effectivePrice,
              reviewStats: reviewStatsMap[p.id] || {
                averageRating: 0,
                totalReviews: 0,
              },
              sellerCount: p.coreProductId
                ? sellerCountMap[p.coreProductId] || 0
                : 0,
            };
          });
          return {
            ...cat,
            products: serializedProducts,
            totalProducts: serializedProducts.length,
          };
        }),
      );

      return { categories: result.filter((c) => c.products.length > 0) };
    }),

  /** Get curated customer home tabs with products */
  getHomeProductTabs: consumerProcedure
    .route({
      method: "GET",
      path: "/customer/home-product-tabs",
      tags: ["Customer"],
      summary: "Get curated home product tabs",
    })
    .handler(async () => {
      const tabs = await db.query.customerHomeTab.findMany({
        where: eq(customerHomeTab.isActive, true),
        orderBy: [asc(customerHomeTab.displayOrder), asc(customerHomeTab.id)],
        with: {
          products: {
            where: eq(customerHomeTabProduct.isActive, true),
            orderBy: [
              asc(customerHomeTabProduct.displayOrder),
              asc(customerHomeTabProduct.id),
            ],
          },
        },
      });

      return {
        tabs: tabs
          .map((tab) => ({
            ...tab,
            products: tab.products.map((item) => ({
              ...item,
              price: Number(item.price),
            })),
          }))
          .filter((tab) => tab.products.length > 0),
      };
    }),

  /** Get subcategories by category slug */
  getSubcategoriesByCategory: publicProcedure
    .route({
      method: "GET",
      path: "/customer/categories/{slug}/subcategories",
      tags: ["Customer"],
      summary: "Get subcategories by category slug",
    })
    .input(z.object({ slug: z.string() }))
    .handler(async ({ input }) => {
      const cat = await db.query.category.findFirst({
        where: and(eq(category.slug, input.slug), eq(category.isActive, true)),
        columns: { id: true },
      });
      if (!cat) return { subcategories: [] };

      const subcategories = await db.query.subCategory.findMany({
        where: and(
          eq(subCategory.categoryId, cat.id),
          eq(subCategory.isActive, true),
        ),
        orderBy: [asc(subCategory.displayOrder)],
      });
      return { subcategories };
    }),

  // ── Brands ───────────────────────────────────────────────────

  /** Get active brands */
  getActiveBrands: publicProcedure
    .route({
      method: "GET",
      path: "/customer/brands",
      tags: ["Customer"],
      summary: "Get active brands",
    })
    .handler(async () => {
      const brands = await db.query.brand.findMany({
        orderBy: [asc(brand.displayOrder)],
      });
      return { brands };
    }),

  // ── Orders (authenticated customer) ──────────────────────────

  /** Get customer's orders */
  getMyOrders: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/orders",
      tags: ["Customer"],
      summary: "Get customer orders",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const orders = await db.query.order.findMany({
        where: and(eq(order.userId, userId), eq(order.isOpenOrder, false)),
        with: { items: true },
        orderBy: [desc(order.createdAt)],
      });
      return { orders };
    }),

  /** Get order details by order number */
  getOrderByNumber: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/orders/{orderNumber}",
      tags: ["Customer"],
      summary: "Get order by order number",
    })
    .input(z.object({ orderNumber: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const found = await db.query.order.findFirst({
        where: and(
          eq(order.orderNumber, input.orderNumber),
          eq(order.userId, userId),
          eq(order.isOpenOrder, false),
        ),
        with: { items: true },
      });
      if (!found)
        throw new ORPCError("NOT_FOUND", { message: "Order not found" });

      const orderInvoices = await db.query.invoice.findMany({
        where: eq(invoice.orderId, found.id),
        columns: { id: true },
      });

      let deliveryInfo: { status: string; otp: string | null } | null = null;

      if (orderInvoices.length > 0) {
        const invoiceIds = orderInvoices.map((inv) => inv.id);
        const deliveryInvoice = await db.query.deliveryGroupInvoice.findFirst({
          where: sql`${deliveryGroupInvoice.invoiceId} IN (${sql.join(
            invoiceIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          with: { group: true },
        });

        if (deliveryInvoice) {
          deliveryInfo = {
            status: deliveryInvoice.group.status,
            otp:
              deliveryInvoice.group.status === "out_for_delivery"
                ? deliveryInvoice.deliveryOtp
                : null,
          };
        }
      }

      return { order: found, deliveryInfo };
    }),

  /** Get order status (order + payment info) */
  getOrderStatus: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/orders/{orderId}/status",
      tags: ["Customer"],
      summary: "Get order status with payment",
    })
    .input(z.object({ orderId: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const [orderData] = await db
        .select()
        .from(order)
        .where(
          and(
            eq(order.id, input.orderId),
            eq(order.userId, userId),
            eq(order.isOpenOrder, false),
          ),
        )
        .limit(1);

      if (!orderData)
        throw new ORPCError("NOT_FOUND", { message: "Order not found" });

      const [paymentData] = await db
        .select()
        .from(payment)
        .where(eq(payment.orderId, input.orderId))
        .limit(1);

      return { order: orderData, payment: paymentData || null };
    }),

  /** Get active order (not delivered/cancelled) */
  getActiveOrder: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/orders/active",
      tags: ["Customer"],
      summary: "Get active order",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const activeOrder = await db.query.order.findFirst({
        where: sql`${order.userId} = ${userId} AND ${order.isOpenOrder} = false AND ${order.status} NOT IN ('delivered', 'cancelled')`,
        with: { items: true },
        orderBy: [desc(order.createdAt)],
      });
      if (!activeOrder) {
        return { order: null, deliveryInfo: null };
      }

      const orderInvoices = await db.query.invoice.findMany({
        where: eq(invoice.orderId, activeOrder.id),
        columns: { id: true },
      });

      let deliveryInfo: { status: string; otp: string | null } | null = null;

      if (orderInvoices.length > 0) {
        const invoiceIds = orderInvoices.map((inv) => inv.id);
        const deliveryInvoice = await db.query.deliveryGroupInvoice.findFirst({
          where: sql`${deliveryGroupInvoice.invoiceId} IN (${sql.join(
            invoiceIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          with: { group: true },
        });

        if (deliveryInvoice) {
          deliveryInfo = {
            status: deliveryInvoice.group.status,
            otp:
              deliveryInvoice.group.status === "out_for_delivery"
                ? deliveryInvoice.deliveryOtp
                : null,
          };
        }
      }

      return { order: activeOrder, deliveryInfo };
    }),

  // ── Cart (authenticated customer) ────────────────────────────

  /** Get current cart */
  getCart: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/cart",
      tags: ["Customer"],
      summary: "Get current cart",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
        with: {
          items: {
            with: {
              product: {
                columns: {
                  id: true,
                  name: true,
                  slug: true,
                  image: true,
                  size: true,
                  price: true,
                  inStock: true,
                },
              },
              variant: {
                columns: {
                  id: true,
                  unitLabel: true,
                  price: true,
                  weightKg: true,
                  sku: true,
                },
              },
            },
          },
        },
      });

      if (!userCart) {
        return {
          mode: null,
          directShopId: null,
          items: [],
          totalItems: 0,
          totalPrice: 0,
        };
      }

      // Resolve shop names for B2C items
      const shopIds = [
        ...new Set(
          userCart.items
            .map((i) => i.shopId)
            .filter((id): id is string => !!id),
        ),
      ];
      const shopMap = new Map<string, string>();
      if (shopIds.length > 0) {
        const shops = await db
          .select({ id: user.id, shopName: user.shopName, name: user.name })
          .from(user)
          .where(inArray(user.id, shopIds));
        for (const s of shops) {
          shopMap.set(s.id, s.shopName || s.name);
        }
      }

      const directVariantIds = [
        ...new Set(
          userCart.items
            .filter((item) => item.shopId && item.variantId)
            .map((item) => item.variantId as number),
        ),
      ];
      const directInventoryRows =
        shopIds.length > 0 && directVariantIds.length > 0
          ? await db.query.inventory.findMany({
              where: and(
                eq(inventory.ownerType, "shop"),
                inArray(inventory.ownerId, shopIds),
                inArray(inventory.variantId, directVariantIds),
              ),
              columns: {
                ownerId: true,
                variantId: true,
                availableQty: true,
                retailPrice: true,
              },
            })
          : [];
      const directInventoryMap = new Map(
        directInventoryRows.map((row) => [
          `${row.ownerId}:${row.variantId}`,
          row,
        ]),
      );

      const items = userCart.items.map((item) => {
        const variant = item.variant;
        // Use variant-specific data when available
        const displayName = variant
          ? `${item.product.name} — ${variant.unitLabel}`
          : item.product.name;
        const displaySize = variant ? variant.unitLabel : item.product.size;
        const directInventory =
          item.shopId && item.variantId
            ? directInventoryMap.get(`${item.shopId}:${item.variantId}`)
            : undefined;
        const directSnapshot =
          item.shopId && item.variantId
            ? resolveDirectCartInventorySnapshot({
                availableQuantity: Number(
                  directInventory?.availableQty ?? Number.NaN,
                ),
                requestedQuantity: item.quantity,
                retailPrice: Number(directInventory?.retailPrice ?? Number.NaN),
              })
            : null;
        const currentPrice = directSnapshot
          ? directSnapshot.currentPrice
          : variant
            ? Number(variant.price)
            : Number(item.product.price);

        return {
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          name: displayName,
          slug: item.product.slug,
          categorySlug: undefined as string | undefined,
          image: item.product.image,
          size: displaySize,
          price: directSnapshot ? currentPrice : Number(item.price),
          currentPrice,
          quantity: item.quantity,
          inStock: directSnapshot
            ? directSnapshot.inStock
            : item.product.inStock,
          shopId: item.shopId,
          shopName: item.shopId ? shopMap.get(item.shopId) || null : null,
        };
      });

      const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalPrice = items.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0,
      );

      return {
        mode: userCart.mode,
        directShopId: userCart.directShopId,
        items,
        totalItems,
        totalPrice,
      };
    }),

  // ── Profile (authenticated customer) ─────────────────────────

  /** Get customer profile */
  getProfile: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/profile",
      tags: ["Customer"],
      summary: "Get customer profile",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;

      const [userData] = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (!userData) return { profile: null };

      const [profileData] = await db
        .select()
        .from(userProfile)
        .where(eq(userProfile.userId, userId))
        .limit(1);

      return {
        profile: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          businessName: profileData?.businessName || null,
          ownerName: profileData?.ownerName || userData.name || null,
          phoneNumber: profileData?.phoneNumber || userData.phoneNumber || null,
          vatNumber: profileData?.vatNumber || null,
          address: profileData?.address || null,
          facebook: profileData?.facebook || null,
          whatsapp: profileData?.whatsapp || userData.phoneNumber || null,
        },
      };
    }),

  // ── Addresses (authenticated customer) ───────────────────────

  /** Get customer addresses */
  getMyAddresses: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/addresses",
      tags: ["Customer"],
      summary: "Get customer addresses",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const addresses = await db.query.address.findMany({
        where: eq(address.userId, userId),
        orderBy: [desc(address.isDefault), desc(address.createdAt)],
      });
      return { addresses };
    }),

  // ── Announcements ────────────────────────────────────────────

  /** Get active announcements */
  getAnnouncements: publicProcedure
    .route({
      method: "GET",
      path: "/customer/announcements",
      tags: ["Customer"],
      summary: "Get active announcements",
    })
    .handler(async () => {
      const items = await db.query.announcement.findMany({
        where: eq(announcement.active, true),
      });
      return { announcements: items };
    }),

  // ── Estimates ─────────────────────────────────────────────────

  /** Get customer's visible estimates */
  getEstimatesByCustomer: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/estimates",
      tags: ["Customer"],
      summary: "Get customer estimates",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;

      const estimates = await db.query.estimate.findMany({
        where: and(
          eq(estimate.customerId, userId),
          inArray(estimate.status, ["sent", "approved", "converted"]),
        ),
        with: {
          items: true,
          salesman: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: [desc(estimate.createdAt)],
      });

      return { estimates };
    }),

  /** Get single estimate by ID */
  getEstimateById: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/estimates/{id}",
      tags: ["Customer"],
      summary: "Get estimate by ID",
    })
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const estimateData = await db.query.estimate.findFirst({
        where: eq(estimate.id, input.id),
        with: {
          items: true,
          customer: {
            columns: {
              id: true,
              name: true,
              email: true,
              phoneNumber: true,
              shopName: true,
            },
          },
          salesman: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!estimateData) {
        throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
      }

      // Verify access: must be customer, salesman, or admin
      const isCustomer = estimateData.customerId === userId;
      const isCreator = estimateData.salesmanId === userId;
      const isAdmin = context.session.user.role === "admin";

      if (!isCustomer && !isCreator && !isAdmin) {
        throw new ORPCError("FORBIDDEN", {
          message: "Not authorized to view this estimate",
        });
      }

      // Customers can only view approved/sent/converted estimates
      if (isCustomer && !isCreator && !isAdmin) {
        const allowedStatuses = ["sent", "approved", "converted"];
        if (!allowedStatuses.includes(estimateData.status)) {
          throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
        }
      }

      return { estimate: estimateData };
    }),

  // ── Estimated Delivery Cost ──────────────────────────────────

  /** Get estimated delivery cost based on area */
  getEstimatedDeliveryCost: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/delivery-cost",
      tags: ["Customer"],
      summary: "Get estimated delivery cost",
    })
    .input(z.object({ area: z.string().optional() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      // Get cart to calculate total weight
      const userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
        with: {
          items: {
            with: { product: true, variant: true },
          },
        },
      });

      if (!userCart || userCart.items.length === 0) {
        return { deliveryCost: 0 };
      }

      let totalWeightKg = 0;
      for (const item of userCart.items) {
        const weightPerUnit = item.variant
          ? Number(item.variant.weightKg)
          : parseWeightFromSize(item.product?.size ?? null);
        totalWeightKg += weightPerUnit * item.quantity;
      }

      const deliveryCost = await calculateDeliveryCost(
        totalWeightKg,
        input.area,
      );

      return { deliveryCost };
    }),

  // ── Reorder ──────────────────────────────────────────────────

  /** Get order items with current prices for reordering */
  getReorderItems: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/orders/{orderId}/reorder",
      tags: ["Customer"],
      summary: "Get reorder items",
    })
    .input(z.object({ orderId: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const orderData = await db.query.order.findFirst({
        where: eq(order.id, input.orderId),
        with: { items: true },
      });

      if (!orderData) {
        throw new ORPCError("NOT_FOUND", { message: "Order not found" });
      }

      if (orderData.userId !== userId) {
        throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
      }

      // Check if order came from an unapproved estimate
      const estimateRecord = await db.query.estimate.findFirst({
        where: eq(estimate.convertedOrderId, orderData.id),
        columns: { status: true },
      });

      if (
        estimateRecord &&
        estimateRecord.status !== "approved" &&
        estimateRecord.status !== "converted"
      ) {
        throw new ORPCError("NOT_FOUND", { message: "Order not found" });
      }

      if (orderData.status !== "delivered") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only delivered orders can be reordered",
        });
      }

      // Batch fetch all products in one query instead of N+1
      const productIds = Array.from(
        new Set(orderData.items.map((item) => item.productId)),
      );
      const products = productIds.length
        ? await db.query.product.findMany({
            where: inArray(product.id, productIds),
          })
        : [];
      const productsById = new Map(products.map((p) => [p.id, p]));

      const reorderItems = orderData.items.map((item) => {
        const currentProduct = productsById.get(item.productId);
        return {
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage,
          productSize: item.productSize,
          originalQuantity: item.quantity,
          quantity: item.quantity,
          originalPrice: item.unitPrice,
          currentPrice: currentProduct?.price ?? item.unitPrice,
          inStock: currentProduct?.inStock ?? false,
          stockQuantity: 0, // stockQuantity removed from product table
          productExists: !!currentProduct,
        };
      });

      return {
        items: reorderItems,
        originalOrder: {
          id: orderData.id,
          orderNumber: orderData.orderNumber,
          shippingName: orderData.shippingName,
          shippingPhone: orderData.shippingPhone,
          shippingEmail: orderData.shippingEmail,
          shippingAddress: orderData.shippingAddress,
          shippingCity: orderData.shippingCity,
          shippingArea: orderData.shippingArea,
          shippingPostalCode: orderData.shippingPostalCode,
        },
      };
    }),

  // ── Support Tickets ──────────────────────────────────────────

  /** Get customer's support tickets */
  getCustomerTickets: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/tickets",
      tags: ["Customer"],
      summary: "Get customer support tickets",
    })
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(50).default(10),
          status: z.string().optional(),
        })
        .optional(),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const offset = (page - 1) * limit;

      const conditions = [eq(supportTicket.customerId, userId)];

      if (
        input?.status &&
        ["open", "in_progress", "resolved", "closed"].includes(input.status)
      ) {
        conditions.push(
          eq(
            supportTicket.status,
            input.status as "open" | "in_progress" | "resolved" | "closed",
          ),
        );
      }

      const tickets = await db
        .select()
        .from(supportTicket)
        .where(and(...conditions))
        .orderBy(desc(supportTicket.createdAt))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(supportTicket)
        .where(and(...conditions));

      const totalCount = Number(countResult?.count) || 0;

      return {
        tickets,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  /** Get single ticket with replies */
  getTicketDetails: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/tickets/{ticketId}",
      tags: ["Customer"],
      summary: "Get ticket details with replies",
    })
    .input(z.object({ ticketId: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const [ticket] = await db
        .select()
        .from(supportTicket)
        .where(eq(supportTicket.id, input.ticketId));

      if (!ticket) {
        throw new ORPCError("NOT_FOUND", { message: "Ticket not found" });
      }

      if (ticket.customerId !== userId) {
        throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
      }

      const replies = await db
        .select({
          id: supportTicketReply.id,
          ticketId: supportTicketReply.ticketId,
          userId: supportTicketReply.userId,
          message: supportTicketReply.message,
          isStaffReply: supportTicketReply.isStaffReply,
          createdAt: supportTicketReply.createdAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(supportTicketReply)
        .leftJoin(user, eq(supportTicketReply.userId, user.id))
        .where(eq(supportTicketReply.ticketId, input.ticketId))
        .orderBy(supportTicketReply.createdAt);

      return {
        ticket: {
          ...ticket,
          replies: replies.map((r) => ({
            ...r,
            user: {
              id: r.userId,
              name: r.userName || "Unknown",
              image: r.userImage,
            },
          })),
        },
      };
    }),

  // ── Item Requests ────────────────────────────────────────────

  /** Get customer's item requests */
  getCustomerItemRequests: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/item-requests",
      tags: ["Customer"],
      summary: "Get customer item requests",
    })
    .input(
      z
        .object({
          page: z.number().min(1).default(1),
          limit: z.number().min(1).max(50).default(10),
          status: z.string().optional(),
          search: z.string().optional(),
        })
        .optional(),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const offset = (page - 1) * limit;

      const conditions: ReturnType<typeof eq>[] = [
        eq(itemRequest.customerId, userId),
      ];

      if (input?.status && input.status !== "all") {
        conditions.push(eq(itemRequest.status, input.status as never));
      }

      if (input?.search) {
        conditions.push(
          sql`(${ilike(itemRequest.itemName, `%${input.search}%`)} OR ${ilike(
            itemRequest.requestNumber,
            `%${input.search}%`,
          )})`,
        );
      }

      const [countResult] = await db
        .select({ count: count() })
        .from(itemRequest)
        .where(and(...conditions));

      const totalCount = countResult?.count || 0;

      const requests = await db
        .select({
          id: itemRequest.id,
          requestNumber: itemRequest.requestNumber,
          customerId: itemRequest.customerId,
          itemName: itemRequest.itemName,
          brand: itemRequest.brand,
          category: itemRequest.category,
          quantity: itemRequest.quantity,
          description: itemRequest.description,
          image: itemRequest.image,
          status: itemRequest.status,
          adminResponse: itemRequest.adminResponse,
          suggestedProductId: itemRequest.suggestedProductId,
          processedById: itemRequest.processedById,
          processedAt: itemRequest.processedAt,
          createdAt: itemRequest.createdAt,
          updatedAt: itemRequest.updatedAt,
          suggestedProduct: {
            id: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
          },
        })
        .from(itemRequest)
        .leftJoin(product, eq(itemRequest.suggestedProductId, product.id))
        .where(and(...conditions))
        .orderBy(desc(itemRequest.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        requests,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  // ── Brand Updates ───────────────────────────────────────────

  /** Get active brand updates */
  getBrandUpdates: publicProcedure
    .route({
      method: "GET",
      path: "/customer/brand-updates",
      tags: ["Customer"],
      summary: "Get active brand updates",
    })
    .handler(async () => {
      const updates = await db
        .select()
        .from(brandUpdate)
        .where(eq(brandUpdate.active, true))
        .orderBy(desc(brandUpdate.createdAt));
      return { updates };
    }),

  // ── Offers ──────────────────────────────────────────────────

  /** Get active offers for homepage display */
  getActiveOffers: publicProcedure
    .route({
      method: "GET",
      path: "/customer/offers",
      tags: ["Customer"],
      summary: "Get active offers",
      description: "Get all active offers to display on the homepage",
    })
    .input(
      z
        .object({
          limit: z.number().min(1).max(50).default(10),
        })
        .optional(),
    )
    .handler(async ({ input }) => {
      const limit = input?.limit || 10;
      const activeOffers = await db
        .select()
        .from(offer)
        .where(eq(offer.active, true))
        .orderBy(desc(offer.priority), desc(offer.createdAt))
        .limit(limit);
      return { offers: activeOffers };
    }),

  /** Get single active offer details */
  getOfferById: publicProcedure
    .route({
      method: "GET",
      path: "/customer/offers/{id}",
      tags: ["Customer"],
      summary: "Get offer by id",
      description: "Get a single active offer details by id",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const foundOffer = await db.query.offer.findFirst({
        where: and(eq(offer.id, input.id), eq(offer.active, true)),
      });

      if (!foundOffer) {
        throw new ORPCError("NOT_FOUND", { message: "Offer not found" });
      }

      return { offer: foundOffer };
    }),

  /** Get combo offers by category */
  getComboOffers: publicProcedure
    .route({
      method: "GET",
      path: "/customer/combo-offers",
      tags: ["Customer"],
      summary: "Get combo offers",
      description: "Get all active combo offers filtered by category",
    })
    .input(
      z
        .object({
          category: z.string().optional(),
          limit: z.number().min(1).max(50).default(12),
        })
        .optional(),
    )
    .handler(async ({ input }) => {
      const limit = input?.limit || 12;
      const conditions = [eq(comboOffer.active, true)];

      if (input?.category) {
        conditions.push(eq(comboOffer.category, input.category));
      }

      const offers = await db
        .select()
        .from(comboOffer)
        .where(and(...conditions))
        .orderBy(desc(comboOffer.priority), desc(comboOffer.createdAt))
        .limit(limit);

      return { offers };
    }),

  // ── Verified Users ──────────────────────────────────────────

  /** Get verified users with filtering & pagination */
  getVerifiedUsers: publicProcedure
    .route({
      method: "GET",
      path: "/customer/verified-users",
      tags: ["Customer"],
      summary: "Get verified users",
    })
    .input(
      z.object({
        search: z.string().optional(),
        area: z.string().optional(),
        sortBy: z.enum(["top_buyers", "most_orders", "newest"]).optional(),
        page: z.number().optional(),
        limit: z.number().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const page = input.page || 1;
      const limit = input.limit || 12;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [eq(user.role, "customer"), eq(user.banned, false)];

      if (input.search) {
        const searchTerm = `%${input.search.toLowerCase()}%`;
        conditions.push(
          sql`(
            LOWER(${user.name}) ILIKE ${searchTerm} OR
            LOWER(COALESCE(${user.shopName}, '')) ILIKE ${searchTerm} OR
            LOWER(COALESCE(${user.ownerName}, '')) ILIKE ${searchTerm}
          )`,
        );
      }

      const baseUsers = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          shopName: user.shopName,
          ownerName: user.ownerName,
          image: user.image,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(and(...conditions));

      // Enrich each user with order stats and reviews
      const usersWithDetails = await Promise.all(
        baseUsers.map(async (u) => {
          const orderStats = await db
            .select({
              orderCount: count(order.id),
              totalSpend: sum(order.total),
              area: sql<string>`MODE() WITHIN GROUP (ORDER BY ${order.shippingArea})`,
            })
            .from(order)
            .where(eq(order.userId, u.id))
            .groupBy(order.userId);

          const userReviews = await db
            .select({
              id: productReview.id,
              comment: productReview.comment,
              rating: productReview.rating,
            })
            .from(productReview)
            .where(eq(productReview.userId, u.id))
            .orderBy(desc(productReview.createdAt))
            .limit(2);

          const stats = orderStats[0];
          return {
            ...u,
            area: stats?.area || null,
            totalOrders: Number(stats?.orderCount) || 0,
            totalSpend: Number(stats?.totalSpend) || 0,
            reviews: userReviews,
          };
        }),
      );

      // Filter by area
      let filteredUsers = usersWithDetails;
      if (input.area && input.area !== "all") {
        filteredUsers = usersWithDetails.filter((u) =>
          u.area?.toLowerCase().includes(input.area!.toLowerCase()),
        );
      }

      // Sort
      const sortedUsers = [...filteredUsers].sort((a, b) => {
        switch (input.sortBy) {
          case "most_orders":
            return b.totalOrders - a.totalOrders;
          case "newest":
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          case "top_buyers":
          default:
            return b.totalOrders - a.totalOrders;
        }
      });

      // Paginate
      const paginatedUsers = sortedUsers.slice(offset, offset + limit);

      // Unique areas for filters
      const uniqueAreas = [
        ...new Set(
          usersWithDetails.map((u) => u.area).filter((a): a is string => !!a),
        ),
      ].sort();

      return {
        users: paginatedUsers,
        totalCount: sortedUsers.length,
        totalPages: Math.ceil(sortedUsers.length / limit),
        currentPage: page,
        areas: uniqueAreas,
      };
    }),

  /** Get count of verified users */
  getVerifiedUsersCount: publicProcedure
    .route({
      method: "GET",
      path: "/customer/verified-users/count",
      tags: ["Customer"],
      summary: "Get verified users count",
    })
    .handler(async () => {
      const [result] = await db
        .select({ count: count() })
        .from(user)
        .where(and(eq(user.role, "customer"), eq(user.banned, false)));
      return { count: Number(result?.count) || 0 };
    }),

  /** Get products purchased by a customer (public, for verified-customers page) */
  getCustomerPurchasedProducts: publicProcedure
    .route({
      method: "GET",
      path: "/customer/{customerId}/purchased-products",
      tags: ["Customer"],
      summary: "Get customer purchased products (public)",
      description:
        "Get aggregated list of products a customer has ordered (public access)",
    })
    .input(z.object({ customerId: z.string().min(1) }))
    .handler(async ({ input }) => {
      const products = await db
        .select({
          productId: orderItem.productId,
          productName: orderItem.productName,
          productImage: orderItem.productImage,
          productSize: orderItem.productSize,
          totalQuantity: sql<number>`SUM(${orderItem.quantity})::int`,
          totalOrders: sql<number>`COUNT(DISTINCT ${orderItem.orderId})::int`,
          lastOrderedAt: sql<Date>`MAX(${order.createdAt})`,
          categoryId: product.categoryId,
        })
        .from(orderItem)
        .innerJoin(order, eq(orderItem.orderId, order.id))
        .innerJoin(product, eq(orderItem.productId, product.id))
        .where(eq(order.userId, input.customerId))
        .groupBy(
          orderItem.productId,
          orderItem.productName,
          orderItem.productImage,
          orderItem.productSize,
          product.categoryId,
        )
        .orderBy(desc(sql`MAX(${order.createdAt})`))
        .limit(20);

      const categoryIds = [
        ...new Set(products.map((p) => p.categoryId).filter(Boolean)),
      ] as number[];

      let categoryMap: Record<number, string> = {};
      if (categoryIds.length > 0) {
        const categories = await db
          .select({ id: category.id, name: category.name })
          .from(category)
          .where(inArray(category.id, categoryIds));

        categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
      }

      return {
        data: products.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          productImage: p.productImage,
          productSize: p.productSize,
          categoryName: p.categoryId ? categoryMap[p.categoryId] || null : null,
          totalQuantity: Number(p.totalQuantity) || 0,
          totalOrders: Number(p.totalOrders) || 0,
          lastOrderedAt: p.lastOrderedAt,
        })),
      };
    }),

  // ── Shops (Seller Store Discovery) ─────────────────────────

  /** List approved shops for consumer browsing */
  getShops: publicProcedure
    .route({
      method: "GET",
      path: "/customer/shops",
      tags: ["Customer"],
      summary: "List approved seller shops",
    })
    .input(
      z.object({
        search: z.string().optional(),
        areaId: z.number().optional(),
        lat: z.string().optional(),
        lng: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(12),
      }),
    )
    .handler(async ({ input }) => {
      const page = input.page;
      const limit = input.limit;
      const offset = (page - 1) * limit;

      const conditions: SQL[] = [
        eq(user.role, "shop_owner"),
        eq(user.sellerStatus, "approved"),
        sql`${user.shopSlug} IS NOT NULL`,
      ];

      if (input.search) {
        conditions.push(
          or(
            ilike(user.shopName, `%${input.search}%`),
            ilike(user.name, `%${input.search}%`),
          )!,
        );
      }

      // Location-based filter: find sellers near the consumer's location
      let nearbySellerIds: string[] | null = null;
      if (input.lat && input.lng) {
        const lat = parseFloat(input.lat);
        const lng = parseFloat(input.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          const nearbySellers = await findSellersNearPoint(lat, lng);
          nearbySellerIds = nearbySellers.map((s) => s.sellerId);
          if (nearbySellerIds.length > 0) {
            conditions.push(inArray(user.id, nearbySellerIds));
          } else {
            return {
              shops: [],
              pagination: { page, limit, totalCount: 0, totalPages: 0 },
            };
          }
        }
      }

      // Area filter: find seller IDs in the selected area
      if (input.areaId && !nearbySellerIds) {
        const areaSellers = await db
          .select({ sellerId: sellerAreaMapping.sellerId })
          .from(sellerAreaMapping)
          .where(eq(sellerAreaMapping.areaId, input.areaId));

        const sellerIds = areaSellers.map((s) => s.sellerId);
        if (sellerIds.length > 0) {
          conditions.push(inArray(user.id, sellerIds));
        } else {
          // No sellers in this area — return empty
          return {
            shops: [],
            pagination: { page, limit, totalCount: 0, totalPages: 0 },
          };
        }
      }

      const where = and(...conditions);

      const [shops, countResult] = await Promise.all([
        db
          .select({
            id: user.id,
            name: user.name,
            shopName: user.shopName,
            shopSlug: user.shopSlug,
            shopAddress: user.shopAddress,
            businessType: user.businessType,
            image: user.image,
          })
          .from(user)
          .where(where)
          .orderBy(asc(user.shopName))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(user).where(where),
      ]);

      const totalCount = countResult[0]?.count || 0;

      return {
        shops,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    }),

  /** Get a single shop by slug with their retail products */
  getShopBySlug: publicProcedure
    .route({
      method: "GET",
      path: "/customer/shops/{slug}",
      tags: ["Customer"],
      summary: "Get shop details and retail products",
    })
    .input(
      z.object({
        slug: z.string(),
        productSlug: z.string().trim().max(200).optional().nullable(),
        search: z.string().trim().max(150).optional().nullable(),
        category: z.string().trim().max(150).optional().nullable(),
        subcategory: z.string().trim().max(150).optional().nullable(),
        sort: z.enum(retailerStorefrontSortValues).default("recommended"),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(48).default(12),
      }),
    )
    .handler(async ({ input }) => {
      // 1. Find the shop owner by slug
      const shop = await db
        .select({
          id: user.id,
          name: user.name,
          shopName: user.shopName,
          shopSlug: user.shopSlug,
          shopAddress: user.shopAddress,
          businessType: user.businessType,
          image: user.image,
          shopLat: user.shopLat,
          shopLng: user.shopLng,
        })
        .from(user)
        .where(
          and(
            eq(user.shopSlug, input.slug),
            eq(user.role, "shop_owner"),
            eq(user.sellerStatus, "approved"),
          ),
        )
        .limit(1);

      if (!shop[0]) {
        throw new ORPCError("NOT_FOUND", { message: "Shop not found" });
      }

      const shopData = shop[0];

      // 2. Get shop's retail inventory with product details
      const inventoryItems = await db.query.inventory.findMany({
        where: and(
          eq(inventory.ownerType, "shop"),
          eq(inventory.ownerId, shopData.id),
        ),
        with: {
          variant: {
            columns: {
              id: true,
              sku: true,
              unitLabel: true,
              quantitySelectorLabel: true,
              price: true,
              isActive: true,
            },
            with: {
              product: {
                columns: {
                  id: true,
                  name: true,
                  slug: true,
                  image: true,
                  description: true,
                  status: true,
                  visibility: true,
                  scheduledAt: true,
                  creatorSource: true,
                  createdById: true,
                  createdAt: true,
                },
                with: {
                  images: true,
                  category: { columns: { name: true, slug: true } },
                  subCategory: { columns: { name: true, slug: true } },
                },
              },
            },
          },
        },
      });

      // 3. Transform into product-centric view with shop prices
      const productMap = new Map<number, any>();
      for (const inv of inventoryItems) {
        const prod = inv.variant?.product;
        if (
          !prod ||
          !inv.variant?.isActive ||
          prod.status !== "active" ||
          prod.visibility !== "public" ||
          prod.creatorSource !== "shop" ||
          prod.createdById !== shopData.id ||
          (prod.scheduledAt != null && prod.scheduledAt > new Date()) ||
          Number(inv.availableQty || 0) <= 0 ||
          Number(inv.retailPrice || 0) <= 0
        ) {
          continue;
        }

        if (!productMap.has(prod.id)) {
          productMap.set(prod.id, {
            ...prod,
            variants: [],
          });
        }

        productMap.get(prod.id)!.variants.push({
          variantId: inv.variantId,
          sku: inv.variant?.sku,
          unitLabel: inv.variant?.unitLabel,
          quantitySelectorLabel: inv.variant?.quantitySelectorLabel,
          basePrice: inv.variant?.price,
          retailPrice: inv.retailPrice,
          availableQty: inv.availableQty,
        });
      }

      const completeCatalog = Array.from(productMap.values()).map((product) => {
        const variants = product.variants as Array<{
          retailPrice: string | number;
          availableQty: string | number;
        }>;

        return {
          ...product,
          lowestRetailPrice: Math.min(
            ...variants.map((variant) => Number(variant.retailPrice)),
          ),
          variantCount: variants.length,
          totalAvailableQty: variants.reduce(
            (sum, variant) => sum + Number(variant.availableQty),
            0,
          ),
        };
      });
      const facets = buildRetailerStorefrontFacets(completeCatalog);
      const filteredProducts = filterAndSortRetailerStorefrontProducts(
        completeCatalog,
        {
          productSlug: input.productSlug,
          search: input.search,
          category: input.category,
          subcategory: input.subcategory,
          sort: input.sort,
        },
      );
      const totalCount = filteredProducts.length;
      const totalPages = Math.ceil(totalCount / input.limit);
      const safePage = totalPages > 0 ? Math.min(input.page, totalPages) : 1;
      const offset = (safePage - 1) * input.limit;

      return {
        shop: shopData,
        products: filteredProducts.slice(offset, offset + input.limit),
        facets,
        catalogProductCount: completeCatalog.length,
        pagination: {
          page: safePage,
          limit: input.limit,
          totalCount,
          totalPages,
        },
      };
    }),

  /** Get one retailer-owned product with exact store inventory and prices. */
  getStoreProductDetail: publicProcedure
    .route({
      method: "GET",
      path: "/customer/shops/{shopSlug}/products/{productSlug}",
      tags: ["Customer"],
      summary: "Get a retailer-owned product detail",
    })
    .input(
      z.object({
        shopSlug: z.string().trim().min(1),
        productSlug: z.string().trim().min(1),
      }),
    )
    .handler(async ({ input }) => {
      const shop = await db.query.user.findFirst({
        where: and(
          eq(user.shopSlug, input.shopSlug),
          eq(user.role, "shop_owner"),
          eq(user.sellerStatus, "approved"),
        ),
        columns: {
          id: true,
          name: true,
          shopName: true,
          shopSlug: true,
          shopAddress: true,
          businessType: true,
          image: true,
          shopLat: true,
          shopLng: true,
        },
      });

      if (!shop) {
        throw new ORPCError("NOT_FOUND", { message: "Shop not found" });
      }

      const foundProduct = await db.query.product.findFirst({
        where: and(
          eq(product.slug, input.productSlug),
          eq(product.creatorSource, "shop"),
          eq(product.createdById, shop.id),
          ...getWebViewProductConditions(),
        ),
        with: {
          category: { columns: { name: true, slug: true } },
          subCategory: { columns: { name: true, slug: true } },
          brand: { columns: { id: true, name: true, slug: true } },
          images: { columns: { imageUrl: true } },
        },
      });

      if (!foundProduct) {
        throw new ORPCError("NOT_FOUND", {
          message: "Store product not found",
        });
      }

      const variantRows = await db.query.productVariant.findMany({
        where: eq(productVariant.productId, foundProduct.id),
        orderBy: [asc(productVariant.sortOrder), asc(productVariant.id)],
      });
      const variantIds = variantRows.map((variant) => variant.id);
      const inventoryRows =
        variantIds.length > 0
          ? await db.query.inventory.findMany({
              where: and(
                eq(inventory.ownerType, "shop"),
                eq(inventory.ownerId, shop.id),
                inArray(inventory.variantId, variantIds),
              ),
              columns: {
                variantId: true,
                availableQty: true,
                retailPrice: true,
              },
            })
          : [];
      const inventoryByVariantId = new Map(
        inventoryRows.map((row) => [row.variantId, row]),
      );

      const detail = buildStoreProductDetail({
        shop,
        product: foundProduct,
        variants: variantRows.map((variant) => {
          const inventoryRow = inventoryByVariantId.get(variant.id);
          return {
            ...variant,
            inventory:
              inventoryRow?.retailPrice != null
                ? {
                    availableQty: inventoryRow.availableQty,
                    retailPrice: inventoryRow.retailPrice,
                  }
                : null,
          };
        }),
      });

      if (!detail) {
        throw new ORPCError("NOT_FOUND", {
          message: "Store product has no purchasable variants",
        });
      }

      return detail;
    }),

  /** Get all sellers who have a specific product in stock */
  getProductSellers: publicProcedure
    .route({
      method: "GET",
      path: "/customer/products/{productId}/sellers",
      tags: ["Customer"],
      summary: "Get sellers selling a product with their prices",
    })
    .input(z.object({ productId: z.number() }))
    .handler(async ({ input }) => {
      // 1. Get all active variant IDs for this product
      // We check all variant types because the conversion may store
      // inventory against the TRADE variant when linkedRetailVariantId is null
      const activeVariants = await db
        .select({ id: productVariant.id })
        .from(productVariant)
        .where(
          and(
            eq(productVariant.productId, input.productId),
            eq(productVariant.isActive, true),
          ),
        );

      const variantIds = activeVariants.map((v) => v.id);
      if (variantIds.length === 0) {
        return { sellers: [] };
      }

      // 2. Find all shop inventories for these variants with stock > 0
      const shopInventories = await db
        .select({
          shopId: inventory.ownerId,
          variantId: inventory.variantId,
          retailPrice: inventory.retailPrice,
          availableQty: inventory.availableQty,
        })
        .from(inventory)
        .where(
          and(
            eq(inventory.ownerType, "shop"),
            inArray(inventory.variantId, variantIds),
            sql`CAST(${inventory.availableQty} AS numeric) > 0`,
          ),
        );

      if (shopInventories.length === 0) {
        return { sellers: [] };
      }

      // 3. Get unique shop IDs and fetch shop details
      const shopIds = [...new Set(shopInventories.map((inv) => inv.shopId))];
      const shops = await db
        .select({
          id: user.id,
          name: user.name,
          shopName: user.shopName,
          shopSlug: user.shopSlug,
          shopAddress: user.shopAddress,
          image: user.image,
        })
        .from(user)
        .where(
          and(
            inArray(user.id, shopIds),
            eq(user.role, "shop_owner"),
            eq(user.sellerStatus, "approved"),
          ),
        );

      const shopMap = new Map(shops.map((s) => [s.id, s]));

      // 4. Group inventories by shop, picking the lowest price variant per shop
      const sellerMap = new Map<
        string,
        {
          shopId: string;
          shopName: string | null;
          shopSlug: string | null;
          shopImage: string | null;
          shopAddress: string | null;
          retailPrice: string | null;
          availableQty: string;
        }
      >();

      for (const inv of shopInventories) {
        const shop = shopMap.get(inv.shopId);
        if (!shop) continue; // Not approved or not found

        const existing = sellerMap.get(inv.shopId);
        const currentPrice = Number(inv.retailPrice || 0);
        const existingPrice = Number(existing?.retailPrice || Infinity);

        if (!existing || currentPrice < existingPrice) {
          sellerMap.set(inv.shopId, {
            shopId: shop.id,
            shopName: shop.shopName || shop.name,
            shopSlug: shop.shopSlug,
            shopImage: shop.image,
            shopAddress: shop.shopAddress,
            retailPrice: inv.retailPrice,
            availableQty: inv.availableQty,
          });
        }
      }

      // Sort by price ascending
      const sellers = Array.from(sellerMap.values()).sort(
        (a, b) => Number(a.retailPrice || 0) - Number(b.retailPrice || 0),
      );

      return { sellers };
    }),

  /** List available areas for the area picker */
  getAreas: publicProcedure
    .route({
      method: "GET",
      path: "/customer/areas",
      tags: ["Customer"],
      summary: "List available service areas",
    })
    .handler(async () => {
      const areas = await db.query.area.findMany({
        where: eq(area.isActive, true),
        orderBy: [asc(area.name)],
        columns: {
          id: true,
          name: true,
          slug: true,
          parentId: true,
        },
      });
      return { areas };
    }),

  /** Find areas containing a given lat/lng point */
  getNearbyAreas: publicProcedure
    .route({
      method: "GET",
      path: "/customer/areas/nearby",
      tags: ["Customer"],
      summary: "Find areas containing a location",
    })
    .input(z.object({ lat: z.string(), lng: z.string() }))
    .handler(async ({ input }) => {
      const lat = parseFloat(input.lat);
      const lng = parseFloat(input.lng);
      if (isNaN(lat) || isNaN(lng)) return { areas: [] };
      const matches = await findAreasForPoint(lat, lng);
      return { areas: matches };
    }),

  /** Find sellers reachable from a given lat/lng */
  getNearbySellers: publicProcedure
    .route({
      method: "GET",
      path: "/customer/sellers/nearby",
      tags: ["Customer"],
      summary: "Find sellers serving a location",
    })
    .input(z.object({ lat: z.string(), lng: z.string() }))
    .handler(async ({ input }) => {
      const lat = parseFloat(input.lat);
      const lng = parseFloat(input.lng);
      if (isNaN(lat) || isNaN(lng)) return { sellers: [] };
      const sellers = await findSellersNearPoint(lat, lng);
      return { sellers };
    }),
};

// ════════════════════════════════════════════════════════════════
// MUTATIONS (customer-triggered actions)
// ════════════════════════════════════════════════════════════════

const mutations = {
  // ── Cart ─────────────────────────────────────────────────────

  /** Add item to cart */
  addToCart: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/cart/add",
      tags: ["Customer"],
      summary: "Add item to cart",
    })
    .input(
      z.object({
        productId: z.number(),
        quantity: z.number().min(1).default(1),
        variantId: z.number().optional(),
        shopId: z.string().optional(), // B2C: which shop to buy from
        purchaseMode: z.enum(["open_order", "direct"]).optional(),
        replaceCart: z.boolean().default(false),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const purchaseMode =
        input.purchaseMode ?? (input.shopId ? "direct" : "open_order");
      if (purchaseMode === "direct" && !input.shopId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "A direct cart requires a retailer.",
        });
      }
      if (purchaseMode === "open_order" && input.shopId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Open-order items cannot be tied to a retailer.",
        });
      }

      const productData = await db.query.product.findFirst({
        where: eq(product.id, input.productId),
      });
      if (!productData)
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      if (purchaseMode === "open_order") {
        const referenceVariant = input.variantId
          ? await db.query.productVariant.findFirst({
              where: and(
                eq(productVariant.id, input.variantId),
                eq(productVariant.productId, input.productId),
              ),
              with: {
                catalogVariant: {
                  columns: {
                    brandId: true,
                    configurationState: true,
                    coreProductId: true,
                    isActive: true,
                  },
                },
              },
            })
          : null;
        if (
          !referenceVariant ||
          !isOpenOrderReferenceSelectionEligible({
            product: productData,
            variant: referenceVariant,
          })
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Choose an active public catalog variant for an open order.",
          });
        }
      }

      let directInventory: typeof inventory.$inferSelect | null | undefined =
        null;
      if (purchaseMode === "direct") {
        if (
          productData.creatorSource !== "shop" ||
          productData.createdById !== input.shopId ||
          productData.status !== "active" ||
          productData.visibility !== "public" ||
          (productData.scheduledAt != null &&
            productData.scheduledAt > new Date())
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "This product does not belong to the selected retailer.",
          });
        }

        if (!input.variantId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Choose a retailer variant before adding this item.",
          });
        }

        const directVariant = await db.query.productVariant.findFirst({
          where: and(
            eq(productVariant.id, input.variantId),
            eq(productVariant.productId, input.productId),
            eq(productVariant.isActive, true),
          ),
          columns: { id: true },
        });
        if (!directVariant) {
          throw new ORPCError("BAD_REQUEST", {
            message: "The selected retailer variant is unavailable.",
          });
        }

        directInventory = await db.query.inventory.findFirst({
          where: and(
            eq(inventory.ownerType, "shop"),
            eq(inventory.ownerId, input.shopId!),
            eq(inventory.variantId, input.variantId),
          ),
        });
        const inventoryIssue = directInventory
          ? getDirectCartInventoryIssue({
              availableQuantity: Number(directInventory.availableQty),
              requestedQuantity: input.quantity,
              retailPrice: Number(directInventory.retailPrice),
            })
          : "The selected variant is not stocked by this retailer.";
        if (inventoryIssue) {
          throw new ORPCError("BAD_REQUEST", {
            message: inventoryIssue,
          });
        }
      }

      // Determine price: shop retail price (B2C) > variant base price > product price
      let itemPrice = productData.price;

      if (purchaseMode === "direct" && directInventory?.retailPrice) {
        itemPrice = directInventory.retailPrice;
      } else if (input.variantId) {
        const variantData = await db.query.productVariant.findFirst({
          where: eq(productVariant.id, input.variantId),
          columns: { price: true },
        });
        if (variantData?.price) {
          itemPrice = variantData.price;
        }
      }

      // Get or create an explicitly typed cart.
      let userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
        with: { items: { columns: { id: true } } },
      });
      if (!userCart) {
        const [newCart] = await db
          .insert(cart)
          .values({
            userId,
            mode: purchaseMode,
            directShopId: purchaseMode === "direct" ? input.shopId! : null,
          })
          .returning();
        userCart = { ...newCart!, items: [] };
      } else {
        try {
          const transition = resolveCartTransition({
            hasItems: userCart.items.length > 0,
            currentMode: userCart.mode,
            currentDirectShopId: userCart.directShopId,
            requestedMode: purchaseMode,
            requestedDirectShopId:
              purchaseMode === "direct" ? input.shopId! : null,
            replaceCart: input.replaceCart,
          });
          if (transition.replaceExistingItems) {
            await db.delete(cartItem).where(eq(cartItem.cartId, userCart.id));
          }
          await db
            .update(cart)
            .set({
              mode: purchaseMode,
              directShopId: purchaseMode === "direct" ? input.shopId! : null,
            })
            .where(eq(cart.id, userCart.id));
        } catch (error) {
          throw new ORPCError("CONFLICT", {
            message:
              error instanceof Error
                ? error.message
                : "Replace the current cart first.",
          });
        }
      }

      // Check if same item + variant + shop combo exists
      const dupConditions = [
        eq(cartItem.cartId, userCart.id),
        eq(cartItem.productId, input.productId),
      ];
      if (input.variantId) {
        dupConditions.push(eq(cartItem.variantId, input.variantId));
      } else {
        dupConditions.push(isNull(cartItem.variantId));
      }
      if (input.shopId) {
        dupConditions.push(eq(cartItem.shopId, input.shopId));
      } else {
        dupConditions.push(isNull(cartItem.shopId));
      }
      const existing = await db.query.cartItem.findFirst({
        where: and(...dupConditions),
      });

      if (purchaseMode === "direct" && directInventory) {
        const inventoryIssue = getDirectCartInventoryIssue({
          availableQuantity: Number(directInventory.availableQty),
          requestedQuantity: (existing?.quantity ?? 0) + input.quantity,
          retailPrice: Number(directInventory.retailPrice),
        });
        if (inventoryIssue) {
          throw new ORPCError("BAD_REQUEST", {
            message: inventoryIssue,
          });
        }
      }

      if (existing) {
        await db
          .update(cartItem)
          .set({
            quantity: existing.quantity + input.quantity,
            price: itemPrice,
          })
          .where(eq(cartItem.id, existing.id));
      } else {
        await db.insert(cartItem).values({
          cartId: userCart.id,
          productId: input.productId,
          variantId: input.variantId ?? null,
          shopId: input.shopId ?? null,
          quantity: input.quantity,
          price: itemPrice,
        });
      }

      return {
        success: true,
        message:
          purchaseMode === "open_order"
            ? "Added to open order"
            : "Item added to cart",
        mode: purchaseMode,
      };
    }),

  /** Update cart item quantity */
  updateCartItem: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/cart/update",
      tags: ["Customer"],
      summary: "Update cart item quantity",
    })
    .input(z.object({ cartItemId: z.number(), quantity: z.number().min(0) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const item = await db.query.cartItem.findFirst({
        where: eq(cartItem.id, input.cartItemId),
        with: { cart: true },
      });
      if (!item || item.cart.userId !== userId) {
        throw new ORPCError("NOT_FOUND", { message: "Cart item not found" });
      }

      if (input.quantity < 1) {
        await db.delete(cartItem).where(eq(cartItem.id, input.cartItemId));
        const remaining = await db.query.cartItem.findFirst({
          where: eq(cartItem.cartId, item.cartId),
          columns: { id: true },
        });
        if (!remaining) {
          await db
            .update(cart)
            .set({ mode: null, directShopId: null })
            .where(eq(cart.id, item.cartId));
        }
        return { success: true, message: "Item removed from cart" };
      }

      if (item.cart.mode === "direct") {
        if (!item.variantId || !item.shopId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "This direct cart item is missing its retailer variant.",
          });
        }

        const directInventory = await db.query.inventory.findFirst({
          where: and(
            eq(inventory.ownerType, "shop"),
            eq(inventory.ownerId, item.shopId),
            eq(inventory.variantId, item.variantId),
          ),
        });
        const inventoryIssue = directInventory
          ? getDirectCartInventoryIssue({
              availableQuantity: Number(directInventory.availableQty),
              requestedQuantity: input.quantity,
              retailPrice: Number(directInventory.retailPrice),
            })
          : "The selected variant is not stocked by this retailer.";
        if (inventoryIssue) {
          throw new ORPCError("BAD_REQUEST", {
            message: inventoryIssue,
          });
        }
      }

      await db
        .update(cartItem)
        .set({ quantity: input.quantity })
        .where(eq(cartItem.id, input.cartItemId));

      return { success: true, message: "Cart updated" };
    }),

  /** Remove item from cart */
  removeFromCart: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/cart/remove",
      tags: ["Customer"],
      summary: "Remove item from cart",
    })
    .input(z.object({ cartItemId: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const item = await db.query.cartItem.findFirst({
        where: eq(cartItem.id, input.cartItemId),
        with: { cart: true },
      });
      if (!item || item.cart.userId !== userId) {
        throw new ORPCError("NOT_FOUND", { message: "Cart item not found" });
      }

      await db.delete(cartItem).where(eq(cartItem.id, input.cartItemId));
      const remaining = await db.query.cartItem.findFirst({
        where: eq(cartItem.cartId, item.cartId),
        columns: { id: true },
      });
      if (!remaining) {
        await db
          .update(cart)
          .set({ mode: null, directShopId: null })
          .where(eq(cart.id, item.cartId));
      }
      return { success: true, message: "Item removed from cart" };
    }),

  /** Clear entire cart */
  clearCart: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/cart/clear",
      tags: ["Customer"],
      summary: "Clear cart",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
      });
      if (userCart) {
        await db.delete(cartItem).where(eq(cartItem.cartId, userCart.id));
        await db
          .update(cart)
          .set({ mode: null, directShopId: null })
          .where(eq(cart.id, userCart.id));
      }
      return { success: true, message: "Cart cleared" };
    }),

  // ── Orders ───────────────────────────────────────────────────

  /** Place a new order from cart */
  placeOrder: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/orders",
      tags: ["Customer"],
      summary: "Place order from cart",
    })
    .input(
      z.object({
        shippingInfo: shippingInfoSchema,
        paymentMethod: z
          .enum(["cash_on_delivery", "bkash", "nagad", "bank_transfer", "card"])
          .default("cash_on_delivery"),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      // Check for active order
      const activeOrder = await db.query.order.findFirst({
        where: sql`${order.userId} = ${userId} AND ${order.status} NOT IN ('delivered', 'cancelled')`,
      });
      if (activeOrder) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "You already have an active order. Please wait until it's delivered or cancelled.",
        });
      }

      // Get cart
      const userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
        with: {
          items: {
            with: {
              product: {
                with: {
                  category: {
                    with: { type: { columns: { family: true } } },
                  },
                },
              },
              variant: { with: { sourceVariantOption: true } },
            },
          },
        },
      });

      if (!userCart || userCart.items.length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Your cart is empty" });
      }
      if (
        context.session.user.role === "consumer" &&
        userCart.mode !== "direct"
      ) {
        throw new ORPCError("CONFLICT", {
          message: "Use Request offers to check out an open-order cart.",
        });
      }
      if (userCart.mode === "direct") {
        if (!userCart.directShopId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "This direct cart is missing its retailer.",
          });
        }
        const activeRetailer = await db.query.user.findFirst({
          where: and(
            eq(user.id, userCart.directShopId),
            eq(user.role, "shop_owner"),
            eq(user.sellerStatus, "approved"),
          ),
          columns: { id: true },
        });
        if (!activeRetailer) {
          throw new ORPCError("BAD_REQUEST", {
            message: "The selected retailer is no longer available.",
          });
        }
      }

      // Validate stock & build order items
      const orderItems: Array<{
        productId: number;
        variantId: number | null;
        shopId: string | null;
        productName: string;
        productImage: string;
        productSize: string;
        quantity: number;
        quantityUnit: string | null;
        inventoryUnit: string | null;
        conversionFactor: string;
        inventoryQty: string;
        unitPrice: string;
        totalPrice: string;
      }> = [];

      let subtotal = 0;
      let totalWeightKg = 0;

      for (const item of userCart.items) {
        if (!item.product)
          throw new ORPCError("BAD_REQUEST", {
            message: "Product not found for cart item",
          });
        const isDirectItem =
          userCart.mode === "direct" &&
          item.shopId != null &&
          item.variantId != null;
        if (!isDirectItem && !item.product.inStock)
          throw new ORPCError("BAD_REQUEST", {
            message: `${item.product.name} is out of stock`,
          });
        if (
          isDirectItem &&
          (item.product.creatorSource !== "shop" ||
            item.product.createdById !== item.shopId ||
            item.shopId !== userCart.directShopId ||
            item.product.status !== "active" ||
            item.product.visibility !== "public" ||
            (item.product.scheduledAt != null &&
              item.product.scheduledAt > new Date()) ||
            item.variant?.productId !== item.productId ||
            item.variant?.isActive !== true)
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: `${item.product.name} is not owned by the selected retailer`,
          });
        }

        // B2B orders (shop_owner) MUST have a variant selected
        if (context.session.user.role === "shop_owner" && !item.variantId) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Please select a variant for ${item.product.name} before placing a B2B order`,
          });
        }

        // Check stock: for B2C (with shopId), check shop inventory; otherwise check variant/product stock
        let stockQty: number;
        let unitPrice = Number(item.price);
        if (item.shopId) {
          // Capacity-specific products must resolve the exact selected variant.
          const shopInv = item.variantId
            ? await db.query.inventory.findFirst({
                where: and(
                  eq(inventory.ownerType, "shop"),
                  eq(inventory.ownerId, item.shopId),
                  eq(inventory.variantId, item.variantId),
                ),
              })
            : null;
          const directSnapshot = resolveDirectCartInventorySnapshot({
            availableQuantity: Number(shopInv?.availableQty ?? Number.NaN),
            requestedQuantity: item.quantity,
            retailPrice: Number(shopInv?.retailPrice ?? Number.NaN),
          });
          if (directSnapshot.issue) {
            throw new ORPCError("BAD_REQUEST", {
              message: directSnapshot.issue,
            });
          }
          stockQty = Number(shopInv?.availableQty ?? 0);
          unitPrice = directSnapshot.currentPrice;
        } else {
          stockQty = item.variant ? item.variant.stockQuantity : 999; // product-level stockQuantity removed; skip product-level check
        }

        if (stockQty < item.quantity) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Insufficient stock for ${item.product.name}. Available: ${stockQty}`,
          });
        }

        const movementSemantics = item.variant?.sourceVariantOption
          ? resolveVariantMovementSemantics(
              item.variant.sourceVariantOption,
              item.product.category?.type?.family ?? "generic",
            )
          : null;
        if (
          movementSemantics?.inventoryUnit === "cylinder" &&
          !Number.isInteger(item.quantity)
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: `${item.product.name} must be ordered in whole cylinders`,
          });
        }

        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;

        const weightPerUnit = item.variant
          ? Number(item.variant.weightKg)
          : parseWeightFromSize(item.product.size);
        totalWeightKg += weightPerUnit * item.quantity;

        orderItems.push({
          productId: item.productId,
          variantId: item.variantId ?? null,
          shopId: item.shopId ?? null,
          productName: item.product.name,
          productImage: item.product.image,
          productSize: item.variant?.quantitySelectorLabel ?? item.product.size,
          quantity: item.quantity,
          quantityUnit:
            movementSemantics?.enteredUnit ||
            item.variant?.orderUnit ||
            item.variant?.packType ||
            null,
          inventoryUnit:
            movementSemantics?.inventoryUnit ||
            item.variant?.orderUnit ||
            item.variant?.packType ||
            null,
          conversionFactor: movementSemantics?.conversionFactor ?? "1",
          inventoryQty: String(item.quantity),
          unitPrice: unitPrice.toFixed(2),
          totalPrice: itemTotal.toFixed(2),
        });
      }

      const shippingCost = await calculateDeliveryCost(
        totalWeightKg,
        input.shippingInfo.area,
      );
      const total = subtotal + shippingCost;

      // Compute area fields from consumer location
      const consumerLat = input.shippingInfo.lat
        ? parseFloat(input.shippingInfo.lat)
        : null;
      const consumerLng = input.shippingInfo.lng
        ? parseFloat(input.shippingInfo.lng)
        : null;
      const areaFields = await computeOrderAreaFields(consumerLat, consumerLng);

      // Transaction: create order, deduct stock, clear cart
      const result = await db.transaction(async (tx) => {
        // Auto-tag order type based on user role
        const orderType =
          context.session.user.role === "shop_owner"
            ? ("b2b" as const)
            : ("b2c" as const);

        // For B2C orders: determine the shop from cart items
        const b2cShopId =
          orderType === "b2c"
            ? (orderItems.find((oi) => oi.shopId)?.shopId ?? null)
            : null;

        const [newOrder] = await tx
          .insert(order)
          .values({
            orderNumber: generateOrderNumber(),
            userId,
            orderType,
            shopId: b2cShopId,
            subtotal: subtotal.toFixed(2),
            shippingCost: shippingCost.toFixed(2),
            discount: "0",
            total: total.toFixed(2),
            status: "pending",
            paymentStatus: "pending",
            paymentMethod: input.paymentMethod,
            shippingName: input.shippingInfo.name,
            shippingPhone: input.shippingInfo.phone,
            shippingEmail: input.shippingInfo.email,
            shippingAddress: input.shippingInfo.address,
            shippingCity: input.shippingInfo.city,
            shippingArea: input.shippingInfo.area,
            shippingPostalCode: input.shippingInfo.postalCode,
            customerNote: input.shippingInfo.customerNote,
            // Populate area fields from consumer location
            ...(areaFields.consumerAreaId && {
              consumerAreaId: areaFields.consumerAreaId,
            }),
            ...(areaFields.matchedAreaId && {
              matchedAreaId: areaFields.matchedAreaId,
            }),
            ...(areaFields.locationLat && {
              locationLat: areaFields.locationLat,
            }),
            ...(areaFields.locationLng && {
              locationLng: areaFields.locationLng,
            }),
          })
          .returning();

        await tx.insert(orderItem).values(
          orderItems.map((oi) => ({
            orderId: newOrder!.id,
            productId: oi.productId,
            variantId: oi.variantId,
            productName: oi.productName,
            productImage: oi.productImage,
            productSize: oi.productSize,
            quantity: oi.quantity,
            quantityUnit: oi.quantityUnit,
            inventoryUnit: oi.inventoryUnit,
            conversionFactor: oi.conversionFactor,
            inventoryQty: oi.inventoryQty,
            unitPrice: oi.unitPrice,
            totalPrice: oi.totalPrice,
          })),
        );

        // Deduct stock
        for (const oi of orderItems) {
          if (oi.shopId && oi.variantId) {
            const updated = await tx
              .update(inventory)
              .set({
                availableQty: sql`${inventory.availableQty}::numeric - ${oi.quantity}`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(inventory.ownerType, "shop"),
                  eq(inventory.ownerId, oi.shopId),
                  eq(inventory.variantId, oi.variantId),
                  sql`CAST(${inventory.availableQty} AS numeric) >= ${oi.quantity}`,
                ),
              )
              .returning({ id: inventory.id });
            if (updated.length === 0) {
              throw new ORPCError("BAD_REQUEST", {
                message: `Insufficient stock for ${oi.productName}`,
              });
            }
          } else if (oi.variantId) {
            await tx
              .update(productVariant)
              .set({
                stockQuantity: sql`${productVariant.stockQuantity} - ${oi.quantity}`,
              })
              .where(eq(productVariant.id, oi.variantId));
          } else {
            // product-level stockQuantity removed — stock is tracked via inventory
          }
        }

        // Clear cart
        await tx.delete(cartItem).where(eq(cartItem.cartId, userCart.id));
        await tx
          .update(cart)
          .set({ mode: null, directShopId: null })
          .where(eq(cart.id, userCart.id));

        return newOrder!;
      });

      return {
        success: true,
        order: { id: result.id, orderNumber: result.orderNumber },
      };
    }),

  /** Cancel a pending order */
  cancelOrder: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/orders/{orderId}/cancel",
      tags: ["Customer"],
      summary: "Cancel pending order",
    })
    .input(z.object({ orderId: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const orderData = await db.query.order.findFirst({
        where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
        with: { items: true },
      });

      if (!orderData)
        throw new ORPCError("NOT_FOUND", { message: "Order not found" });
      if (orderData.status !== "pending") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only pending orders can be cancelled",
        });
      }

      await db.transaction(async (tx) => {
        const cancelled = await tx
          .update(order)
          .set({ status: "cancelled", cancelledAt: new Date() })
          .where(and(eq(order.id, input.orderId), eq(order.status, "pending")))
          .returning({ id: order.id });
        if (cancelled.length === 0) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Order was already updated by another request",
          });
        }

        // Restore stock
        for (const item of orderData.items) {
          if (item.variantId) {
            if (orderData.shopId) {
              await tx
                .update(inventory)
                .set({
                  availableQty: sql`${inventory.availableQty}::numeric + ${item.inventoryQty ?? item.quantity}`,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, orderData.shopId),
                    eq(inventory.variantId, item.variantId),
                  ),
                );
            } else {
              await tx
                .update(productVariant)
                .set({
                  stockQuantity: sql`${productVariant.stockQuantity} + ${item.quantity}`,
                })
                .where(eq(productVariant.id, item.variantId));
            }
          } else {
            // product-level stockQuantity removed — stock is tracked via inventory
          }
        }
      });

      return { success: true, message: "Order cancelled" };
    }),

  // ── Reviews ──────────────────────────────────────────────────

  /** Create a product review */
  createReview: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/reviews",
      tags: ["Customer"],
      summary: "Create product review",
    })
    .input(
      z.object({
        productId: z.number(),
        rating: z.number().min(1).max(5),
        title: z.string().optional(),
        comment: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      // Check if user ordered this product
      const ordered = await db
        .select({ orderId: order.id })
        .from(order)
        .innerJoin(orderItem, eq(orderItem.orderId, order.id))
        .where(
          and(
            eq(order.userId, userId),
            eq(orderItem.productId, input.productId),
          ),
        )
        .limit(1);

      if (ordered.length === 0)
        throw new ORPCError("FORBIDDEN", {
          message: "You can only review products you ordered",
        });

      // Check duplicate
      const existing = await db.query.productReview.findFirst({
        where: and(
          eq(productReview.productId, input.productId),
          eq(productReview.userId, userId),
        ),
      });
      if (existing)
        throw new ORPCError("CONFLICT", {
          message: "You have already reviewed this product",
        });

      const [review] = await db
        .insert(productReview)
        .values({
          productId: input.productId,
          userId,
          rating: input.rating,
          title: input.title || null,
          comment: input.comment,
          isVerifiedPurchase: true,
        })
        .returning();

      return { success: true, review };
    }),

  // ── Addresses ────────────────────────────────────────────────

  /** Add a new address */
  addAddress: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/addresses",
      tags: ["Customer"],
      summary: "Add address",
    })
    .input(addressFormSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      if (input.isDefault) {
        await db
          .update(address)
          .set({ isDefault: false })
          .where(eq(address.userId, userId));
      }

      const existing = await db.query.address.findFirst({
        where: eq(address.userId, userId),
      });

      const [newAddr] = await db
        .insert(address)
        .values({
          userId,
          label: input.label,
          recipientName: input.recipientName,
          phone: input.phone,
          address: input.address,
          city: input.city,
          area: input.area || null,
          postalCode: input.postalCode || null,
          lat: input.lat || null,
          lng: input.lng || null,
          isDefault: input.isDefault || !existing,
        })
        .returning();

      return { success: true, address: newAddr };
    }),

  /** Update an address */
  updateAddress: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/addresses/{id}/update",
      tags: ["Customer"],
      summary: "Update address",
    })
    .input(addressFormSchema.extend({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { id, ...data } = input;

      const existing = await db.query.address.findFirst({
        where: and(eq(address.id, id), eq(address.userId, userId)),
      });
      if (!existing)
        throw new ORPCError("NOT_FOUND", { message: "Address not found" });

      if (data.isDefault) {
        await db
          .update(address)
          .set({ isDefault: false })
          .where(eq(address.userId, userId));
      }

      const [updated] = await db
        .update(address)
        .set({
          label: data.label,
          recipientName: data.recipientName,
          phone: data.phone,
          address: data.address,
          city: data.city,
          area: data.area || null,
          postalCode: data.postalCode || null,
          lat: data.lat || null,
          lng: data.lng || null,
          isDefault: data.isDefault ?? existing.isDefault,
          updatedAt: new Date(),
        })
        .where(eq(address.id, id))
        .returning();

      return { success: true, address: updated };
    }),

  /** Delete an address */
  deleteAddress: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/addresses/{id}/delete",
      tags: ["Customer"],
      summary: "Delete address",
    })
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const existing = await db.query.address.findFirst({
        where: and(eq(address.id, input.id), eq(address.userId, userId)),
      });
      if (!existing)
        throw new ORPCError("NOT_FOUND", { message: "Address not found" });

      await db.delete(address).where(eq(address.id, input.id));

      // If deleted was default, set first remaining as default
      if (existing.isDefault) {
        const remaining = await db.query.address.findFirst({
          where: eq(address.userId, userId),
          orderBy: [desc(address.createdAt)],
        });
        if (remaining) {
          await db
            .update(address)
            .set({ isDefault: true })
            .where(eq(address.id, remaining.id));
        }
      }

      return { success: true };
    }),

  /** Set default address */
  setDefaultAddress: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/addresses/{id}/default",
      tags: ["Customer"],
      summary: "Set default address",
    })
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const existing = await db.query.address.findFirst({
        where: and(eq(address.id, input.id), eq(address.userId, userId)),
      });
      if (!existing)
        throw new ORPCError("NOT_FOUND", { message: "Address not found" });

      await db
        .update(address)
        .set({ isDefault: false })
        .where(eq(address.userId, userId));
      await db
        .update(address)
        .set({ isDefault: true })
        .where(eq(address.id, input.id));

      return { success: true };
    }),

  // ── Profile ──────────────────────────────────────────────────

  /** Update customer profile */
  updateProfile: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/profile",
      tags: ["Customer"],
      summary: "Update customer profile",
    })
    .input(profileFormSchema)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const [existingProfile] = await db
        .select({ id: userProfile.id })
        .from(userProfile)
        .where(eq(userProfile.userId, userId))
        .limit(1);

      if (existingProfile) {
        await db
          .update(userProfile)
          .set({
            businessName: input.businessName,
            ownerName: input.ownerName,
            phoneNumber: input.phoneNumber || null,
            vatNumber: input.vatNumber || null,
            address: input.address || null,
            facebook: input.facebook || null,
            whatsapp: input.whatsapp || null,
          })
          .where(eq(userProfile.userId, userId));
      } else {
        await db.insert(userProfile).values({
          userId,
          businessName: input.businessName,
          ownerName: input.ownerName,
          phoneNumber: input.phoneNumber || null,
          vatNumber: input.vatNumber || null,
          address: input.address || null,
          facebook: input.facebook || null,
          whatsapp: input.whatsapp || null,
        });
      }

      return { success: true };
    }),

  // ── Reorder ──────────────────────────────────────────────────

  /** Place a reorder from a previous delivered order */
  placeReorder: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/orders/reorder",
      tags: ["Customer"],
      summary: "Place reorder from previous order",
    })
    .input(
      z.object({
        originalOrderId: z.number(),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number().min(1),
          }),
        ),
        shippingInfo: shippingInfoSchema,
        paymentMethod: z
          .enum(["cash_on_delivery", "bkash", "nagad", "bank_transfer", "card"])
          .default("cash_on_delivery"),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      // Verify original order belongs to user and is delivered
      const originalOrder = await db.query.order.findFirst({
        where: eq(order.id, input.originalOrderId),
      });

      if (!originalOrder || originalOrder.userId !== userId) {
        throw new ORPCError("NOT_FOUND", {
          message: "Original order not found",
        });
      }

      if (originalOrder.status !== "delivered") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only delivered orders can be reordered",
        });
      }

      // Check for active order
      const activeOrder = await db.query.order.findFirst({
        where: sql`${order.userId} = ${userId} AND ${order.status} NOT IN ('delivered', 'cancelled')`,
      });

      if (activeOrder) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "You already have an active order. Please wait until it's delivered or cancelled.",
        });
      }

      if (input.items.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message: "No items to reorder",
        });
      }

      // Validate stock and prepare order items
      const orderItems: Array<{
        productId: number;
        productName: string;
        productImage: string;
        productSize: string;
        quantity: number;
        unitPrice: string;
        totalPrice: string;
      }> = [];

      let subtotal = 0;
      let totalWeightKg = 0;

      for (const item of input.items) {
        const currentProduct = await db.query.product.findFirst({
          where: eq(product.id, item.productId),
        });

        if (!currentProduct) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Product not found",
          });
        }

        if (!currentProduct.inStock) {
          throw new ORPCError("BAD_REQUEST", {
            message: `${currentProduct.name} is out of stock`,
          });
        }

        // Skip product-level stock check since stockQuantity was removed from the product table

        const itemTotal = Number(currentProduct.price) * item.quantity;
        subtotal += itemTotal;

        totalWeightKg +=
          parseWeightFromSize(currentProduct.size) * item.quantity;

        orderItems.push({
          productId: currentProduct.id,
          productName: currentProduct.name,
          productImage: currentProduct.image,
          productSize: currentProduct.size,
          quantity: item.quantity,
          unitPrice: currentProduct.price,
          totalPrice: itemTotal.toFixed(2),
        });
      }

      const shippingCost = await calculateDeliveryCost(
        totalWeightKg,
        input.shippingInfo.area,
      );
      const total = subtotal + shippingCost;

      // Transaction: create order, deduct stock
      const result = await db.transaction(async (tx) => {
        const [newOrder] = await tx
          .insert(order)
          .values({
            orderNumber: generateOrderNumber(),
            userId,
            subtotal: subtotal.toFixed(2),
            shippingCost: shippingCost.toFixed(2),
            discount: "0",
            total: total.toFixed(2),
            status: "pending",
            paymentStatus: "pending",
            paymentMethod: input.paymentMethod,
            shippingName: input.shippingInfo.name,
            shippingPhone: input.shippingInfo.phone,
            shippingEmail: input.shippingInfo.email,
            shippingAddress: input.shippingInfo.address,
            shippingCity: input.shippingInfo.city,
            shippingArea: input.shippingInfo.area,
            shippingPostalCode: input.shippingInfo.postalCode,
            customerNote: input.shippingInfo.customerNote,
          })
          .returning();

        await tx.insert(orderItem).values(
          orderItems.map((oi) => ({
            orderId: newOrder!.id,
            ...oi,
          })),
        );

        // Stock deduction removed — stock is tracked via inventory

        return newOrder!;
      });

      return {
        success: true,
        order: { id: result.id, orderNumber: result.orderNumber },
      };
    }),

  // ── Support Tickets ──────────────────────────────────────────

  /** Create a new support ticket */
  createSupportTicket: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/tickets",
      tags: ["Customer"],
      summary: "Create support ticket",
    })
    .input(
      z.object({
        subject: z.string().min(1).max(200),
        message: z.string().min(1),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const ticketNumber = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const [newTicket] = await db
        .insert(supportTicket)
        .values({
          ticketNumber,
          customerId: userId,
          subject: input.subject,
          message: input.message,
          priority: input.priority,
          status: "open",
        })
        .returning();

      return { success: true, ticket: newTicket };
    }),

  /** Add a reply to a support ticket */
  addTicketReply: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/tickets/{ticketId}/reply",
      tags: ["Customer"],
      summary: "Add ticket reply",
    })
    .input(
      z.object({
        ticketId: z.number(),
        message: z.string().min(1),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      // Verify ticket ownership
      const [ticket] = await db
        .select()
        .from(supportTicket)
        .where(eq(supportTicket.id, input.ticketId));

      if (!ticket || ticket.customerId !== userId) {
        throw new ORPCError("NOT_FOUND", {
          message: "Ticket not found or unauthorized",
        });
      }

      const [newReply] = await db
        .insert(supportTicketReply)
        .values({
          ticketId: input.ticketId,
          userId,
          message: input.message,
          isStaffReply: false,
        })
        .returning();

      // Update ticket timestamp
      await db
        .update(supportTicket)
        .set({ updatedAt: new Date() })
        .where(eq(supportTicket.id, input.ticketId));

      return { success: true, reply: newReply };
    }),

  // ── Estimate Conversion ─────────────────────────────────────

  /** Convert an estimate to an order */
  convertEstimateToOrder: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/estimates/convert",
      tags: ["Customer"],
      summary: "Convert an approved estimate to an order",
    })
    .input(
      estimateOrderAcceptSchema.extend({
        estimateId: z.number().int().positive(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const { estimateId, ...orderInput } = input;

      return convertEstimateToB2bOrder({
        estimateId,
        receiverId: userId,
        order: orderInput,
      });
    }),

  // ── Item Requests ───────────────────────────────────────────

  /** Create a new item request */
  createItemRequest: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/item-requests",
      tags: ["Customer"],
      summary: "Create a new item request",
    })
    .input(
      z.object({
        itemName: z.string().min(2, "Item name must be at least 2 characters"),
        brand: z.string().optional(),
        category: z.string().optional(),
        quantity: z.number().min(1).default(1),
        description: z.string().optional(),
        image: z.string().optional(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const requestNumber = `REQ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const [newRequest] = await db
        .insert(itemRequest)
        .values({
          requestNumber,
          customerId: userId,
          itemName: input.itemName,
          brand: input.brand || null,
          category: input.category || null,
          quantity: input.quantity,
          description: input.description || null,
          image: input.image || null,
          status: "pending",
        })
        .returning();

      return { success: true, request: newRequest };
    }),
};

// ════════════════════════════════════════════════════════════════
// OPEN ORDER ENDPOINTS
// ════════════════════════════════════════════════════════════════

const openOrderEndpoints = {
  /** Preflight exact stock, then create one atomic request and its retailer offers. */
  placeOpenOrder: consumerProcedure
    .route({
      method: "POST",
      path: "/customer/open-orders",
      tags: ["Customer", "Open Order"],
      summary: "Place an atomic open order request",
    })
    .input(z.object({ shippingInfo: shippingInfoSchema }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const lat = Number(input.shippingInfo.lat);
      const lng = Number(input.shippingInfo.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Pin a valid delivery location before requesting offers.",
        });
      }

      const activeRequest = await db.query.order.findFirst({
        where: and(
          eq(order.userId, userId),
          eq(order.isOpenOrder, true),
          inArray(order.status, ["matching_shop", "negotiating"]),
        ),
        columns: { id: true },
      });
      if (activeRequest) {
        await reconcileOpenOrder(activeRequest.id);
        const stillActive = await db.query.order.findFirst({
          where: and(
            eq(order.id, activeRequest.id),
            inArray(order.status, ["matching_shop", "negotiating"]),
          ),
          columns: { id: true },
        });
        if (stillActive) {
          throw new ORPCError("CONFLICT", {
            message:
              "Finish or cancel your active open order before starting another.",
          });
        }
      }

      const userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
        with: {
          items: {
            with: {
              product: true,
              variant: { with: { catalogVariant: true } },
            },
          },
        },
      });
      if (!userCart?.items.length) {
        throw new ORPCError("BAD_REQUEST", { message: "Your cart is empty." });
      }
      if (
        userCart.mode !== "open_order" ||
        userCart.directShopId ||
        userCart.items.some((item) => item.shopId)
      ) {
        throw new ORPCError("CONFLICT", {
          message:
            "This cart is not an open-order cart. Replace it before requesting offers.",
        });
      }

      let referenceSubtotal = 0;
      const requestedItems: CartItemForOpenOrder[] = userCart.items.map(
        (item) => {
          if (
            !item.variant ||
            !item.variant.catalogVariantId ||
            !item.variant.catalogVariant ||
            !isOpenOrderReferenceSelectionEligible({
              product: item.product,
              variant: item.variant,
            })
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message: `${item.product.name} no longer has an orderable catalog variant.`,
            });
          }
          const totalPrice = Number(item.price) * item.quantity;
          referenceSubtotal += totalPrice;
          return {
            productId: item.productId,
            variantId: item.variant.id,
            catalogVariantId: item.variant.catalogVariantId,
            globalSkuSnapshot: item.variant.catalogVariant.globalSku,
            sourceSkuSnapshot: item.variant.sku,
            productName: item.product.name,
            productImage: item.product.image,
            productSize:
              item.variant.quantitySelectorLabel ?? item.product.size,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: totalPrice.toFixed(2),
          };
        },
      );

      const areaFields = await computeOrderAreaFields(lat, lng);
      const sellers = await findEligibleSellers(
        lat,
        lng,
        requestedItems,
        areaFields.consumerAreaId ?? undefined,
      );
      if (sellers.length === 0) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "No nearby retailer currently has every requested variant in full. Your cart has been kept—adjust quantities or try again later.",
        });
      }

      const now = new Date();
      const offerDeadline = new Date(
        now.getTime() + OFFER_WINDOW_SECONDS * 1000,
      );
      const selectionDeadline = new Date(
        offerDeadline.getTime() + SELECTION_WINDOW_SECONDS * 1000,
      );
      const result = await db
        .transaction(async (tx) => {
          const [request] = await tx
            .insert(order)
            .values({
              orderNumber: generateOrderNumber(),
              userId,
              orderType: "b2c",
              isOpenOrder: true,
              status: "matching_shop",
              subtotal: referenceSubtotal.toFixed(2),
              shippingCost: "0",
              discount: "0",
              total: referenceSubtotal.toFixed(2),
              paymentStatus: "pending",
              paymentMethod: "cash_on_delivery",
              shippingName: input.shippingInfo.name,
              shippingPhone: input.shippingInfo.phone,
              shippingEmail: input.shippingInfo.email,
              shippingAddress: input.shippingInfo.address,
              shippingCity: input.shippingInfo.city,
              shippingArea: input.shippingInfo.area,
              shippingPostalCode: input.shippingInfo.postalCode,
              customerNote: input.shippingInfo.customerNote,
              broadcastExpiresAt: offerDeadline,
              selectionExpiresAt: selectionDeadline,
              consumerAreaId: areaFields.consumerAreaId ?? null,
              matchedAreaId: areaFields.matchedAreaId ?? null,
              locationLat: String(lat),
              locationLng: String(lng),
            })
            .returning();
          if (!request) throw new Error("Open order could not be created.");

          const insertedItems = await tx
            .insert(orderItem)
            .values(
              requestedItems.map((item) => ({
                orderId: request.id,
                productId: item.productId,
                variantId: item.variantId,
                catalogVariantId: item.catalogVariantId,
                globalSkuSnapshot: item.globalSkuSnapshot,
                sourceSkuSnapshot: item.sourceSkuSnapshot,
                productName: item.productName,
                productImage: item.productImage,
                productSize: item.productSize,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              })),
            )
            .returning();

          await createOffersForOrder(
            tx,
            request.id,
            sellers,
            insertedItems.map((item) => ({
              id: item.id,
              catalogVariantId: item.catalogVariantId!,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          );
          await tx.delete(cartItem).where(eq(cartItem.cartId, userCart.id));
          await tx
            .update(cart)
            .set({ mode: null, directShopId: null })
            .where(eq(cart.id, userCart.id));
          return request;
        })
        .catch((error: unknown) => {
          const databaseError = error as { code?: string; constraint?: string };
          if (
            databaseError.code === "23505" &&
            databaseError.constraint ===
              "order_one_active_open_request_per_user_idx"
          ) {
            throw new ORPCError("CONFLICT", {
              message:
                "Finish or cancel your active open order before starting another.",
            });
          }
          throw error;
        });

      for (const seller of sellers) {
        context.realtime.emitToShop(seller.shopId, "open-order:new-request", {
          orderId: result.id,
          offerDeadline: offerDeadline.toISOString(),
        });
      }
      return {
        success: true,
        order: { id: result.id, orderNumber: result.orderNumber },
        offerDeadline: offerDeadline.toISOString(),
        selectionDeadline: selectionDeadline.toISOString(),
        eligibleRetailerCount: sellers.length,
      };
    }),

  /** List every Open Order separately from direct retailer orders. */
  getOpenOrderHistory: consumerProcedure
    .route({
      method: "GET",
      path: "/customer/open-orders",
      tags: ["Customer", "Open Order"],
      summary: "List the consumer's Open Order requests",
    })
    .handler(async ({ context }) => {
      const userId = context.session.user.id;
      const activeRequest = await db.query.order.findFirst({
        where: and(
          eq(order.userId, userId),
          eq(order.isOpenOrder, true),
          inArray(order.status, ["matching_shop", "negotiating"]),
        ),
        columns: { id: true },
      });

      if (activeRequest) {
        const transition = await reconcileOpenOrder(activeRequest.id);
        if (transition !== "unchanged") {
          const event =
            transition === "offer_window_closed"
              ? "open-order:offer-window-closed"
              : transition === "no_offers"
                ? "open-order:no-offers"
                : `open-order:${transition}`;
          context.realtime.emitToOrder(activeRequest.id, event, {
            orderId: activeRequest.id,
          });
        }
      }

      const requests = await db.query.order.findMany({
        where: and(eq(order.userId, userId), eq(order.isOpenOrder, true)),
        with: { items: true },
        orderBy: [desc(order.createdAt)],
      });
      if (requests.length === 0) return { history: [] };

      const requestIds = requests.map((request) => request.id);
      const bids = await db
        .select({
          orderId: openOrderBid.subOrderId,
          submittedAt: openOrderBid.submittedAt,
          isWinner: openOrderBid.isWinner,
        })
        .from(openOrderBid)
        .where(inArray(openOrderBid.subOrderId, requestIds));
      const offerCountByOrder = new Map<number, number>();
      for (const bid of bids) {
        if (!bid.submittedAt && !bid.isWinner) continue;
        offerCountByOrder.set(
          bid.orderId,
          (offerCountByOrder.get(bid.orderId) ?? 0) + 1,
        );
      }

      const selectedShopIds = [
        ...new Set(
          requests
            .map((request) => request.shopId)
            .filter((shopId): shopId is string => !!shopId),
        ),
      ];
      const selectedShops =
        selectedShopIds.length > 0
          ? await db.query.user.findMany({
              where: inArray(user.id, selectedShopIds),
              columns: { id: true, shopName: true },
            })
          : [];
      const shopNameById = new Map(
        selectedShops.map((shop) => [
          shop.id,
          shop.shopName ?? "Selected retailer",
        ]),
      );

      const now = new Date();
      return {
        history: requests.map((request) => {
          let requestStage:
            | "collecting_offers"
            | "selecting_offer"
            | "confirmed"
            | "cancelled"
            | "no_offers"
            | "expired";
          if (
            !["matching_shop", "negotiating", "cancelled"].includes(
              request.status,
            )
          ) {
            requestStage = "confirmed";
          } else if (request.status === "cancelled") {
            if (request.openOrderOutcome === "no_offers") {
              requestStage = "no_offers";
            } else if (request.openOrderOutcome === "selection_expired") {
              requestStage = "expired";
            } else {
              requestStage = "cancelled";
            }
          } else if (
            request.broadcastExpiresAt &&
            now < request.broadcastExpiresAt
          ) {
            requestStage = "collecting_offers";
          } else {
            requestStage = "selecting_offer";
          }

          return {
            orderId: request.id,
            orderNumber: request.orderNumber,
            requestStage,
            fulfillmentStatus: request.status,
            offerCount: offerCountByOrder.get(request.id) ?? 0,
            referenceSubtotal: Number(
              request.previousTotal ?? request.subtotal,
            ),
            finalTotal: request.shopId
              ? Number(request.confirmedTotal ?? request.total)
              : null,
            selectedRetailer: request.shopId
              ? (shopNameById.get(request.shopId) ?? "Selected retailer")
              : null,
            offerDeadline: request.broadcastExpiresAt?.toISOString() ?? null,
            selectionDeadline:
              request.selectionExpiresAt?.toISOString() ?? null,
            createdAt: request.createdAt.toISOString(),
            updatedAt: request.updatedAt.toISOString(),
            items: request.items.map((item) => ({
              id: item.id,
              productName: item.productName,
              productImage: item.productImage,
              productSize: item.productSize,
              quantity: item.quantity,
            })),
          };
        }),
      };
    }),

  /** Polling-safe status; comparable offers stay hidden until prices freeze. */
  getOpenOrderStatus: consumerProcedure
    .route({
      method: "GET",
      path: "/customer/open-orders/{orderId}/status",
      tags: ["Customer", "Open Order"],
      summary: "Get an open order request and frozen comparable offers",
    })
    .input(z.object({ orderId: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const owned = await db.query.order.findFirst({
        where: and(
          eq(order.id, input.orderId),
          eq(order.userId, userId),
          eq(order.isOpenOrder, true),
        ),
        columns: { id: true },
      });
      if (!owned)
        throw new ORPCError("NOT_FOUND", { message: "Open order not found." });

      const transition = await reconcileOpenOrder(input.orderId);
      if (transition !== "unchanged") {
        const event =
          transition === "offer_window_closed"
            ? "open-order:offer-window-closed"
            : transition === "no_offers"
              ? "open-order:no-offers"
              : `open-order:${transition}`;
        context.realtime.emitToOrder(input.orderId, event, {
          orderId: input.orderId,
        });
      }
      const request = await db.query.order.findFirst({
        where: eq(order.id, input.orderId),
        with: { items: true },
      });
      if (!request)
        throw new ORPCError("NOT_FOUND", { message: "Open order not found." });

      const rawOffers = await db
        .select({
          id: openOrderBid.id,
          shopId: openOrderBid.shopId,
          shopName: user.shopName,
          status: openOrderBid.status,
          distanceKm: openOrderBid.distanceKm,
          itemSubtotal: openOrderBid.itemSubtotal,
          discountType: openOrderBid.discountType,
          discountValue: openOrderBid.discountValue,
          discountAmount: openOrderBid.discountAmount,
          deliveryCharge: openOrderBid.deliveryCharge,
          finalTotal: openOrderBid.totalBid,
          priceFrozenAt: openOrderBid.priceFrozenAt,
          isWinner: openOrderBid.isWinner,
        })
        .from(openOrderBid)
        .leftJoin(user, eq(user.id, openOrderBid.shopId))
        .where(eq(openOrderBid.subOrderId, request.id));
      const submitted = rawOffers.filter(
        (offer) =>
          offer.status === "submitted" ||
          offer.isWinner ||
          (request.status === "confirmed" && offer.status === "lost") ||
          (offer.status === "expired" && !!offer.priceFrozenAt),
      );
      const canReveal =
        request.status === "confirmed" ||
        (!!request.broadcastExpiresAt &&
          new Date() >= request.broadcastExpiresAt);

      const bidItems =
        canReveal && submitted.length > 0
          ? await db
              .select({
                bidId: openOrderBidItem.bidId,
                orderItemId: openOrderBidItem.orderItemId,
                platformPrice: openOrderBidItem.platformPrice,
                sellerPrice: openOrderBidItem.sellerPrice,
              })
              .from(openOrderBidItem)
              .where(
                inArray(
                  openOrderBidItem.bidId,
                  submitted.map((offer) => offer.id),
                ),
              )
          : [];
      const offers = canReveal
        ? sortComparableOffers(
            submitted.map((offer) => ({
              offerId: offer.id,
              shopName: offer.shopName ?? "Retailer",
              distanceKm: Number(offer.distanceKm ?? 0),
              itemSubtotal: Number(offer.itemSubtotal ?? 0),
              discountType: offer.discountType,
              discountValue: Number(offer.discountValue ?? 0),
              discountAmount: Number(offer.discountAmount ?? 0),
              deliveryCharge: Number(offer.deliveryCharge ?? 0),
              finalTotal: Number(offer.finalTotal ?? 0),
              priceFrozenAt: offer.priceFrozenAt?.toISOString() ?? null,
              isWinner: offer.isWinner,
              items: bidItems
                .filter((item) => item.bidId === offer.id)
                .map((item) => ({
                  orderItemId: item.orderItemId,
                  referencePrice: Number(item.platformPrice),
                  retailerPrice: Number(item.sellerPrice),
                })),
            })),
          ).map((offer, index) => ({ ...offer, isLowestTotal: index === 0 }))
        : [];
      const referencePriceByOrderItem = new Map(
        bidItems.map((item) => [item.orderItemId, Number(item.platformPrice)]),
      );

      const now = new Date();
      let stage:
        | "collecting_offers"
        | "selecting_offer"
        | "confirmed"
        | "cancelled"
        | "no_offers"
        | "expired";
      if (request.status === "confirmed") stage = "confirmed";
      else if (request.status === "cancelled") {
        if (request.openOrderOutcome === "no_offers") stage = "no_offers";
        else if (request.openOrderOutcome === "selection_expired") {
          stage = "expired";
        } else stage = "cancelled";
      } else if (
        request.broadcastExpiresAt &&
        now < request.broadcastExpiresAt
      ) {
        stage = "collecting_offers";
      } else stage = "selecting_offer";

      return {
        orderId: request.id,
        orderNumber: request.orderNumber,
        stage,
        offerDeadline: request.broadcastExpiresAt?.toISOString() ?? null,
        selectionDeadline: request.selectionExpiresAt?.toISOString() ?? null,
        offerCount: submitted.length,
        offers,
        items: request.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          productImage: item.productImage,
          productSize: item.productSize,
          quantity: item.quantity,
          referenceUnitPrice:
            referencePriceByOrderItem.get(item.id) ?? Number(item.unitPrice),
          referenceTotal:
            (referencePriceByOrderItem.get(item.id) ?? Number(item.unitPrice)) *
            item.quantity,
        })),
        referenceSubtotal: Number(request.previousTotal ?? request.subtotal),
        finalRetailer:
          request.status === "confirmed"
            ? (offers.find((offer) => offer.isWinner)?.shopName ?? null)
            : null,
      };
    }),

  acceptOpenOrderOffer: consumerProcedure
    .route({
      method: "POST",
      path: "/customer/open-orders/{orderId}/accept",
      tags: ["Customer", "Open Order"],
      summary: "Accept one frozen retailer offer",
    })
    .input(z.object({ orderId: z.number(), offerId: z.number() }))
    .handler(async ({ context, input }) => {
      try {
        const accepted = await acceptOpenOrderOffer({
          userId: context.session.user.id,
          orderId: input.orderId,
          bidId: input.offerId,
        });
        context.realtime.emitToOrder(input.orderId, "open-order:accepted", {
          orderId: input.orderId,
          shopId: accepted.winningOffer.shopId,
        });
        context.realtime.emitToShop(
          accepted.winningOffer.shopId,
          "open-order:accepted",
          { orderId: input.orderId },
        );
        for (const shopId of accepted.losingShopIds) {
          context.realtime.emitToShop(shopId, "open-order:not-selected", {
            orderId: input.orderId,
          });
        }
        return { success: true, orderId: input.orderId };
      } catch (error) {
        throw new ORPCError("CONFLICT", {
          message:
            error instanceof Error
              ? error.message
              : "Offer could not be accepted.",
        });
      }
    }),

  cancelOpenOrder: consumerProcedure
    .route({
      method: "POST",
      path: "/customer/open-orders/{orderId}/cancel",
      tags: ["Customer", "Open Order"],
      summary: "Cancel an active open order request",
    })
    .input(z.object({ orderId: z.number() }))
    .handler(async ({ context, input }) => {
      try {
        const cancelled = await cancelOpenOrder(
          context.session.user.id,
          input.orderId,
        );
        context.realtime.emitToOrder(input.orderId, "open-order:cancelled", {
          orderId: input.orderId,
        });
        const shops = await db
          .select({ shopId: openOrderBid.shopId })
          .from(openOrderBid)
          .where(eq(openOrderBid.subOrderId, input.orderId));
        for (const shop of shops) {
          context.realtime.emitToShop(shop.shopId, "open-order:cancelled", {
            orderId: input.orderId,
          });
        }
        return { success: true, orderNumber: cancelled.orderNumber };
      } catch (error) {
        throw new ORPCError("CONFLICT", {
          message:
            error instanceof Error
              ? error.message
              : "Open order could not be cancelled.",
        });
      }
    }),
};

// ════════════════════════════════════════════════════════════════
// Export combined customer router
// ════════════════════════════════════════════════════════════════

export const customerRouter = {
  ...queries,
  ...mutations,
  ...openOrderEndpoints,
};
