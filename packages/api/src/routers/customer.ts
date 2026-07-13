/**
 * Customer-facing ORPC Router
 *
 * Contains all queries and mutations for the B2C marketplace customer view.
 * - No admin, dealer, shop owner, inventory write, ledger, or analytics logic
 * - Only retail variants (B2C)
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
  computeOrderAreaFields,
  findAreasForPoint,
  findSellersNearPoint,
} from "../services/location-service";
import {
  type CartItemForSplit,
  checkAndExpireBids,
  checkBroadcastExpiry,
  createBidsForSubOrder,
  DEFAULT_BROADCAST_MINUTES,
  findEligibleSellers,
  splitCartIntoSubOrders,
} from "../services/open-order-matching";
import {
  convertEstimateToB2bOrder,
  estimateOrderAcceptSchema,
} from "./helpers/estimate-order-conversion";
import {
  asNumber,
  buildReferenceCatalogData,
  buildPublicProductDetailPayload,
  getPrimaryWebViewProduct,
  getScopedWebViewProductRows,
  isConsumerVisibleVariant,
  serializeWebViewCoreProduct,
  uniqueStrings,
} from "./helpers/customer-product-detail";

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

type CustomerPurchaseMode = "standard" | "exchange" | "new";

type CustomerVariantPricingContext = {
  id: number;
  unitLabel?: string | null;
  quantitySelectorLabel?: string | null;
  price?: string | number | null;
  weightKg?: string | number | null;
  sku?: string | null;
  isPackReturnRequired?: boolean | null;
  packDepositAmount?: string | number | null;
};

type ResolvedConsumerPricing = {
  basePrice: number;
  depositAmount: number;
  purchaseMode: CustomerPurchaseMode;
  purchaseModeLabel: string | null;
  finalPrice: number;
  variant: CustomerVariantPricingContext | null;
};

function getCustomerPurchaseModeLabel(
  purchaseMode: CustomerPurchaseMode,
): string | null {
  switch (purchaseMode) {
    case "exchange":
      return "Exchange Cylinder";
    case "new":
      return "New Cylinder";
    default:
      return null;
  }
}

function normalizeCustomerPurchaseMode(args: {
  variant?: CustomerVariantPricingContext | null;
  requestedMode?: CustomerPurchaseMode | null;
}): {
  purchaseMode: CustomerPurchaseMode;
  purchaseModeLabel: string | null;
  depositAmount: number;
} {
  const isReturnable = Boolean(args.variant?.isPackReturnRequired);
  const depositAmount = isReturnable
    ? Number(args.variant?.packDepositAmount ?? 0)
    : 0;

  if (!isReturnable || depositAmount <= 0) {
    return {
      purchaseMode: "standard" as const,
      purchaseModeLabel: null,
      depositAmount: 0,
    };
  }

  const purchaseMode = args.requestedMode === "new" ? "new" : "exchange";
  return {
    purchaseMode,
    purchaseModeLabel: getCustomerPurchaseModeLabel(purchaseMode),
    depositAmount,
  };
}

function inferStoredCustomerPurchaseMode(args: {
  variant?: CustomerVariantPricingContext | null;
  basePrice: number;
  linePrice: number;
}): {
  purchaseMode: CustomerPurchaseMode;
  purchaseModeLabel: string | null;
  depositAmount: number;
} {
  const normalized = normalizeCustomerPurchaseMode({
    variant: args.variant,
    requestedMode: "exchange",
  });

  if (normalized.purchaseMode === "standard") {
    return normalized;
  }

  const roundedBase = Number(args.basePrice.toFixed(2));
  const roundedLine = Number(args.linePrice.toFixed(2));
  const roundedWithDeposit = Number(
    (args.basePrice + normalized.depositAmount).toFixed(2),
  );

  if (roundedLine === roundedWithDeposit && roundedWithDeposit !== roundedBase) {
    return {
      purchaseMode: "new" as const,
      purchaseModeLabel: getCustomerPurchaseModeLabel("new"),
      depositAmount: normalized.depositAmount,
    };
  }

  return normalized;
}

function buildCustomerPurchaseDisplaySize(args: {
  variant?: CustomerVariantPricingContext | null;
  productSize?: string | null;
  purchaseModeLabel?: string | null;
}) {
  const baseLabel =
    args.variant?.quantitySelectorLabel ||
    args.variant?.unitLabel ||
    args.productSize ||
    "Default";

  return args.purchaseModeLabel
    ? `${baseLabel} - ${args.purchaseModeLabel}`
    : baseLabel;
}

async function resolveConsumerPricing(args: {
  productId: number;
  variantId?: number | null;
  shopId?: string | null;
  productPrice: string | number | null;
  variant?: CustomerVariantPricingContext | null;
  requestedMode?: CustomerPurchaseMode | null;
}) {
  let variant = args.variant ?? null;

  if (!variant && args.variantId != null) {
    variant =
      (await db.query.productVariant.findFirst({
        where: eq(productVariant.id, args.variantId),
        columns: {
          id: true,
          unitLabel: true,
          quantitySelectorLabel: true,
          price: true,
          weightKg: true,
          sku: true,
          isPackReturnRequired: true,
          packDepositAmount: true,
        },
      })) ?? null;
  }

  let basePrice = Number(args.productPrice ?? 0);

  if (args.variantId != null && args.shopId) {
    let shopInventoryRecord = await db.query.inventory.findFirst({
      where: and(
        eq(inventory.ownerType, "shop"),
        eq(inventory.ownerId, args.shopId),
        eq(inventory.variantId, args.variantId),
      ),
      columns: {
        retailPrice: true,
      },
    });

    if (!shopInventoryRecord) {
      const productVariants = await db.query.productVariant.findMany({
        where: eq(productVariant.productId, args.productId),
        columns: { id: true },
      });
      const variantIds = productVariants.map((entry) => entry.id);
      if (variantIds.length > 0) {
        shopInventoryRecord = await db.query.inventory.findFirst({
          where: and(
            eq(inventory.ownerType, "shop"),
            eq(inventory.ownerId, args.shopId),
            inArray(inventory.variantId, variantIds),
            sql`CAST(${inventory.availableQty} AS numeric) > 0`,
          ),
          columns: {
            retailPrice: true,
          },
        });
      }
    }

    if (shopInventoryRecord?.retailPrice) {
      basePrice = Number(shopInventoryRecord.retailPrice);
    }
  }

  if (args.variantId != null && variant?.price != null) {
    const fallbackProductPrice = Number(args.productPrice ?? 0);
    if (basePrice === fallbackProductPrice || !Number.isFinite(basePrice)) {
      basePrice = Number(variant.price);
    }
  }

  const normalized = normalizeCustomerPurchaseMode({
    variant,
    requestedMode: args.requestedMode,
  });
  const finalPrice =
    normalized.purchaseMode === "new"
      ? basePrice + normalized.depositAmount
      : basePrice;

  return {
    basePrice,
    depositAmount: normalized.depositAmount,
    purchaseMode: normalized.purchaseMode,
    purchaseModeLabel: normalized.purchaseModeLabel,
    finalPrice,
    variant,
  } satisfies ResolvedConsumerPricing;
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

async function resolveWebViewProductDetailContext(input: {
  id?: number;
  slug?: string;
}) {
  const requestedSlug = input.slug?.trim();
  const identityCondition = input.id
    ? eq(coreProductIdentity.id, input.id)
    : eq(coreProductIdentity.slug, requestedSlug ?? "");

  const matchedProduct = requestedSlug
    ? await db.query.product.findFirst({
        where: and(
          ...getWebViewProductConditions(),
          eq(product.slug, requestedSlug),
        ),
        columns: {
          id: true,
          coreProductId: true,
          brandId: true,
          slug: true,
        },
      })
    : null;

  let found = await db.query.coreProductIdentity.findFirst({
    where: identityCondition,
    with: {
      category: {
        columns: { id: true, name: true, slug: true, typeId: true },
        with: {
          type: {
            columns: {
              id: true,
              name: true,
              slug: true,
              inventoryBehaviour: true,
            },
          },
        },
      },
      subCategory: { columns: { id: true, name: true, slug: true } },
    },
  });

  if (!found) {
    if (matchedProduct?.coreProductId) {
      found = await db.query.coreProductIdentity.findFirst({
        where: eq(coreProductIdentity.id, matchedProduct.coreProductId),
        with: {
          category: {
            columns: { id: true, name: true, slug: true, typeId: true },
            with: {
              type: {
                columns: {
                  id: true,
                  name: true,
                  slug: true,
                  inventoryBehaviour: true,
                },
              },
            },
          },
          subCategory: { columns: { id: true, name: true, slug: true } },
        },
      });
    }
  }

  if (!found) {
    throw new ORPCError("NOT_FOUND", { message: "Product not found" });
  }

  const allProductRows = await db.query.product.findMany({
    where: and(...getWebViewProductConditions(), eq(product.coreProductId, found.id)),
    with: {
      category: { columns: { id: true, name: true, slug: true } },
      subCategory: { columns: { id: true, name: true, slug: true } },
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
  });
  const productRows = getScopedWebViewProductRows(allProductRows);
  const requestedProduct = matchedProduct
    ? productRows.find((productRow) => productRow.id === matchedProduct.id) ??
      allProductRows.find((productRow) => productRow.id === matchedProduct.id) ??
      null
    : null;
  const primaryProduct = requestedProduct ?? getPrimaryWebViewProduct(productRows);

  return {
    coreProduct: found,
    allProductRows,
    productRows,
    requestedProduct,
    primaryProduct,
  };
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
      const { coreProduct: found, productRows, primaryProduct } =
        await resolveWebViewProductDetailContext(input);
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
      const referenceCatalog = buildReferenceCatalogData(productRows);
      const detail = buildPublicProductDetailPayload({
        coreProduct: found,
        productRows,
        primaryProduct,
        summary,
        referenceCatalog,
      });
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
          brands: referenceCatalog.brands,
          variants: referenceCatalog.variants,
          referencePrices: referenceCatalog.referencePrices,
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
        detail,
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
      const { coreProduct, productRows, primaryProduct } =
        await resolveWebViewProductDetailContext({ slug: input.slug });
      if (!primaryProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      // Get RETAIL variants only for consumer-facing detail page
      // (TRADE variants are for shop owners / B2B)
      const variants = await db.query.productVariant.findMany({
        where: and(
          eq(productVariant.productId, primaryProduct.id),
          or(
            eq(productVariant.variantType, "retail"),
            isNull(productVariant.variantType),
          ),
        ),
        orderBy: [asc(productVariant.sortOrder)],
      });

      // Serialize product and variants with proper price conversion
      const foundSerialized = {
        ...primaryProduct,
        slug: primaryProduct.slug ?? coreProduct.slug,
        price: asNumber(primaryProduct.price),
      };
      const variantsSerialized = variants.map((v) => ({
        ...v,
        price: asNumber(v.price),
      }));

      const [reviewStatsMap, sellerCountMap] = await Promise.all([
        getCoreReviewStatsMap([coreProduct.id]),
        getCoreSellerCountMap([coreProduct.id]),
      ]);
      const summary = serializeWebViewCoreProduct(
        coreProduct,
        productRows,
        reviewStatsMap,
        sellerCountMap,
      );
      const reviewStats = summary.reviewStats;
      const referenceCatalog = buildReferenceCatalogData(productRows);
      const productIds = productRows.map((productRow) => productRow.id);
      const activeRetailVariantIds = productRows.flatMap((productRow) =>
        (productRow.variants ?? [])
          .filter(isConsumerVisibleVariant)
          .map((variant: any) => variant.id),
      );
      const fulfilledStatuses = [
        "approved",
        "confirmed",
        "processing",
        "ready_for_dispatch",
        "partially_invoiced",
        "invoiced",
        "delivered",
      ] as const;
      const [cartRows, orderRows, stockRows] =
        productIds.length > 0
          ? await Promise.all([
              db
                .select({
                  cartCount: count(cartItem.id),
                })
                .from(cartItem)
                .where(inArray(cartItem.productId, productIds)),
              db
                .select({
                  totalOrders:
                    sql<number>`COUNT(DISTINCT ${orderItem.orderId})`.mapWith(
                      Number,
                    ),
                  totalUnitsSold:
                    sql<number>`COALESCE(SUM(${orderItem.quantity}), 0)`.mapWith(
                      Number,
                    ),
                  totalSalesValue:
                    sql<number>`COALESCE(SUM(${orderItem.totalPrice}), 0)`.mapWith(
                      Number,
                    ),
                  lastOrderedAt: sql<Date | null>`MAX(${order.createdAt})`,
                })
                .from(orderItem)
                .innerJoin(order, eq(orderItem.orderId, order.id))
                .where(
                  and(
                    inArray(orderItem.productId, productIds),
                    inArray(order.status, fulfilledStatuses),
                  ),
                ),
              activeRetailVariantIds.length > 0
                ? db
                    .select({
                      productId: productVariant.productId,
                      variantId: productVariant.id,
                      variantOptionId: productVariant.sourceVariantOptionId,
                      brandId: productVariant.brandId,
                      brandName: brand.name,
                      color: productVariant.color,
                      size: productVariant.size,
                      unitLabel: productVariant.unitLabel,
                      orderUnit: productVariant.orderUnit,
                      packType: productVariant.packType,
                      availableQty:
                        sql<number>`COALESCE(SUM(CAST(${inventory.availableQty} AS numeric)), 0)`.mapWith(
                          Number,
                        ),
                      inCartonQty:
                        sql<number>`COALESCE(SUM(CAST(${inventory.inCartonQty} AS numeric)), 0)`.mapWith(
                          Number,
                        ),
                      activeCartonCount:
                        sql<number>`COALESCE(SUM(${inventory.activeCartonCount}), 0)`.mapWith(
                          Number,
                        ),
                      sellerCount:
                        sql<number>`COUNT(DISTINCT ${inventory.ownerId})`.mapWith(
                          Number,
                        ),
                    })
                    .from(inventory)
                    .innerJoin(
                      productVariant,
                      eq(inventory.variantId, productVariant.id),
                    )
                    .leftJoin(brand, eq(productVariant.brandId, brand.id))
                    .where(
                      and(
                        eq(inventory.ownerType, "shop"),
                        inArray(inventory.variantId, activeRetailVariantIds),
                        eq(productVariant.isActive, true),
                        sql`CAST(${inventory.availableQty} AS numeric) > 0`,
                      ),
                    )
                    .groupBy(
                      productVariant.productId,
                      productVariant.id,
                      productVariant.sourceVariantOptionId,
                      productVariant.brandId,
                      brand.name,
                      productVariant.color,
                      productVariant.size,
                      productVariant.unitLabel,
                      productVariant.orderUnit,
                      productVariant.packType,
                    )
                : Promise.resolve([]),
            ])
          : [[{ cartCount: 0 }], [], []];
      const detail = buildPublicProductDetailPayload({
        coreProduct,
        productRows,
        primaryProduct,
        summary,
        referenceCatalog,
        stockRows,
        cartCount: cartRows[0]?.cartCount ?? 0,
        orderMetrics: {
          totalOrders: orderRows[0]?.totalOrders ?? 0,
          totalUnitsSold: orderRows[0]?.totalUnitsSold ?? 0,
          totalSalesValue: orderRows[0]?.totalSalesValue ?? 0,
          lastOrderedAt: orderRows[0]?.lastOrderedAt ?? null,
        },
      });

      return {
        product: foundSerialized,
        variants: variantsSerialized,
        reviewStats,
        summary,
        detail,
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
        where: eq(order.userId, userId),
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
        .where(and(eq(order.id, input.orderId), eq(order.userId, userId)))
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
        where: sql`${order.userId} = ${userId} AND ${order.status} NOT IN ('delivered', 'cancelled')`,
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
                  quantitySelectorLabel: true,
                  price: true,
                  weightKg: true,
                  sku: true,
                  isPackReturnRequired: true,
                  packDepositAmount: true,
                },
              },
            },
          },
        },
      });

      if (!userCart) return { items: [], totalItems: 0, totalPrice: 0 };

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

      const items = await Promise.all(
        userCart.items.map(async (item) => {
          const pricing = await resolveConsumerPricing({
            productId: item.productId,
            variantId: item.variantId,
            shopId: item.shopId,
            productPrice: item.product.price,
            variant: item.variant,
          });
          const storedMode = inferStoredCustomerPurchaseMode({
            variant: pricing.variant,
            basePrice: pricing.basePrice,
            linePrice: Number(item.price),
          });
          const displayName = pricing.variant?.unitLabel
            ? `${item.product.name} - ${pricing.variant.unitLabel}`
            : item.product.name;
          const displaySize = buildCustomerPurchaseDisplaySize({
            variant: pricing.variant,
            productSize: item.product.size,
            purchaseModeLabel: storedMode.purchaseModeLabel,
          });
          const currentPrice =
            storedMode.purchaseMode === "new"
              ? pricing.basePrice + storedMode.depositAmount
              : pricing.basePrice;

          return {
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            name: displayName,
            slug: item.product.slug,
            categorySlug: undefined as string | undefined,
            image: item.product.image,
            size: displaySize,
            price: Number(item.price),
            currentPrice,
            quantity: item.quantity,
            inStock: item.product.inStock,
            shopId: item.shopId,
            shopName: item.shopId ? shopMap.get(item.shopId) || null : null,
            purchaseMode: storedMode.purchaseMode,
            purchaseModeLabel: storedMode.purchaseModeLabel,
            depositAmount: storedMode.depositAmount,
          };
        }),
      );

      const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalPrice = items.reduce(
        (sum, i) => sum + i.price * i.quantity,
        0,
      );

      return { items, totalItems, totalPrice };
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
    .input(z.object({ slug: z.string() }))
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
            with: {
              product: {
                columns: {
                  id: true,
                  name: true,
                  slug: true,
                  image: true,
                  description: true,
                },
                with: {
                  images: true,
                  category: { columns: { name: true, slug: true } },
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
        if (!prod) continue;

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

      return {
        shop: shopData,
        products: Array.from(productMap.values()),
      };
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
        purchaseMode: z.enum(["standard", "exchange", "new"]).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const productData = await db.query.product.findFirst({
        where: eq(product.id, input.productId),
      });
      if (!productData)
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      if (!productData.inStock)
        throw new ORPCError("BAD_REQUEST", {
          message: "Product is out of stock",
        });

      const pricing = await resolveConsumerPricing({
        productId: input.productId,
        variantId: input.variantId,
        shopId: input.shopId,
        productPrice: productData.price,
        requestedMode: input.purchaseMode,
      });
      const itemPrice = pricing.finalPrice.toFixed(2);

      // Get or create cart
      let userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
      });
      if (!userCart) {
        const [newCart] = await db.insert(cart).values({ userId }).returning();
        userCart = newCart!;
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
      const existingItems = await db.query.cartItem.findMany({
        where: and(...dupConditions),
      });
      const existing =
        existingItems.find(
          (item) => Number(item.price) === Number(Number(itemPrice).toFixed(2)),
        ) ?? null;

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

      return { success: true, message: "Item added to cart" };
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
        return { success: true, message: "Item removed from cart" };
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
            with: { product: true, variant: true },
          },
        },
      });

      if (!userCart || userCart.items.length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Your cart is empty" });
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
        if (!item.product.inStock)
          throw new ORPCError("BAD_REQUEST", {
            message: `${item.product.name} is out of stock`,
          });

        // B2B orders (shop_owner) MUST have a variant selected
        if (context.session.user.role === "shop_owner" && !item.variantId) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Please select a variant for ${item.product.name} before placing a B2B order`,
          });
        }

        // Check stock: for B2C (with shopId), check shop inventory; otherwise check variant/product stock
        let stockQty: number;
        if (item.shopId) {
          // B2C: check shop's inventory (may be on a different variant than the one selected)
          const productVariants = await db.query.productVariant.findMany({
            where: eq(productVariant.productId, item.productId),
            columns: { id: true },
          });
          const variantIds = productVariants.map((v) => v.id);
          const shopInv =
            variantIds.length > 0
              ? await db.query.inventory.findFirst({
                  where: and(
                    eq(inventory.ownerType, "shop"),
                    eq(inventory.ownerId, item.shopId),
                    inArray(inventory.variantId, variantIds),
                    sql`CAST(${inventory.availableQty} AS numeric) > 0`,
                  ),
                })
              : null;
          stockQty = shopInv ? Number(shopInv.availableQty) : 0;
        } else {
          stockQty = item.variant ? item.variant.stockQuantity : 999; // product-level stockQuantity removed; skip product-level check
        }

        if (stockQty < item.quantity) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Insufficient stock for ${item.product.name}. Available: ${stockQty}`,
          });
        }

        const itemTotal = Number(item.price) * item.quantity;
        subtotal += itemTotal;

        const weightPerUnit = item.variant
          ? Number(item.variant.weightKg)
          : parseWeightFromSize(item.product.size);
        totalWeightKg += weightPerUnit * item.quantity;
        const pricing = await resolveConsumerPricing({
          productId: item.productId,
          variantId: item.variantId,
          shopId: item.shopId,
          productPrice: item.product.price,
          variant: item.variant,
        });
        const storedMode = inferStoredCustomerPurchaseMode({
          variant: pricing.variant,
          basePrice: pricing.basePrice,
          linePrice: Number(item.price),
        });
        const productSizeLabel = buildCustomerPurchaseDisplaySize({
          variant: pricing.variant,
          productSize: item.product.size,
          purchaseModeLabel: storedMode.purchaseModeLabel,
        });

        orderItems.push({
          productId: item.productId,
          variantId: item.variantId ?? null,
          shopId: item.shopId ?? null,
          productName: item.product.name,
          productImage: item.product.image,
          productSize: productSizeLabel,
          quantity: item.quantity,
          unitPrice: item.price,
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
            unitPrice: oi.unitPrice,
            totalPrice: oi.totalPrice,
          })),
        );

        // Deduct stock
        for (const oi of orderItems) {
          if (oi.shopId && oi.variantId) {
            // B2C: deduct from shop's retail inventory
            // The shop's inventory variant may differ from the cart's variant
            // (e.g. TRADE vs RETAIL), so find the actual inventory record
            const productVars = await tx.query.productVariant.findMany({
              where: eq(productVariant.productId, oi.productId),
              columns: { id: true },
            });
            const vIds = productVars.map((v) => v.id);
            if (vIds.length > 0) {
              const shopInvRecord = await tx.query.inventory.findFirst({
                where: and(
                  eq(inventory.ownerType, "shop"),
                  eq(inventory.ownerId, oi.shopId),
                  inArray(inventory.variantId, vIds),
                ),
                columns: { id: true },
              });
              if (shopInvRecord) {
                await tx
                  .update(inventory)
                  .set({
                    availableQty: sql`${inventory.availableQty}::numeric - ${oi.quantity}`,
                    updatedAt: new Date(),
                  })
                  .where(eq(inventory.id, shopInvRecord.id));
              }
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
        // Restore stock
        for (const item of orderData.items) {
          if (item.variantId) {
            await tx
              .update(productVariant)
              .set({
                stockQuantity: sql`${productVariant.stockQuantity} + ${item.quantity}`,
              })
              .where(eq(productVariant.id, item.variantId));
          } else {
            // product-level stockQuantity removed — stock is tracked via inventory
          }
        }

        await tx
          .update(order)
          .set({ status: "cancelled", cancelledAt: new Date() })
          .where(eq(order.id, input.orderId));
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
  /** Place an open order: auto-split + broadcast to sellers */
  placeOpenOrder: protectedProcedure
    .route({
      method: "POST",
      path: "/customer/open-orders",
      tags: ["Customer", "Open Order"],
      summary: "Place an open order (auto-match shops)",
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

      // Validate location is provided
      if (!input.shippingInfo.lat || !input.shippingInfo.lng) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Location (lat/lng) is required for open orders",
        });
      }

      const consumerLat = parseFloat(input.shippingInfo.lat);
      const consumerLng = parseFloat(input.shippingInfo.lng);
      if (isNaN(consumerLat) || isNaN(consumerLng)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid location coordinates",
        });
      }

      // Get cart with product + variant + category data
      const userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
        with: {
          items: {
            with: { product: true, variant: true },
          },
        },
      });

      if (!userCart || userCart.items.length === 0) {
        throw new ORPCError("BAD_REQUEST", { message: "Your cart is empty" });
      }

      // Build items with category info for splitting
      const cartItemsForSplit: CartItemForSplit[] = [];
      let subtotal = 0;

      for (const item of userCart.items) {
        if (!item.product) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Product not found for cart item",
          });
        }

        // Get category name
        let categoryName: string | null = null;
        let categoryId: number | null = null;
        if (item.product.categoryId) {
          const cat = await db.query.category.findFirst({
            where: eq(category.id, item.product.categoryId),
            columns: { id: true, name: true },
          });
          if (cat) {
            categoryId = cat.id;
            categoryName = cat.name;
          }
        }

        const itemTotal = Number(item.price) * item.quantity;
        subtotal += itemTotal;
        const pricing = await resolveConsumerPricing({
          productId: item.productId,
          variantId: item.variantId,
          shopId: item.shopId,
          productPrice: item.product.price,
          variant: item.variant,
        });
        const storedMode = inferStoredCustomerPurchaseMode({
          variant: pricing.variant,
          basePrice: pricing.basePrice,
          linePrice: Number(item.price),
        });
        const productSizeLabel = buildCustomerPurchaseDisplaySize({
          variant: pricing.variant,
          productSize: item.product.size,
          purchaseModeLabel: storedMode.purchaseModeLabel,
        });

        cartItemsForSplit.push({
          productId: item.productId,
          variantId: item.variantId ?? null,
          shopId: null, // Open order: no shop selected
          productName: item.product.name,
          productImage: item.product.image,
          productSize: productSizeLabel,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: itemTotal.toFixed(2),
          categoryId,
          categoryName,
        });
      }

      // Split into sub-order groups by category
      const subOrderGroups = splitCartIntoSubOrders(cartItemsForSplit);

      // Compute area fields
      const areaFields = await computeOrderAreaFields(consumerLat, consumerLng);

      // Broadcast expiry
      const broadcastExpiresAt = new Date(
        Date.now() + DEFAULT_BROADCAST_MINUTES * 60 * 1000,
      );

      // Transaction: create parent order + sub-orders + bids
      const result = await db.transaction(async (tx) => {
        // Create parent order
        const [parentOrder] = await tx
          .insert(order)
          .values({
            orderNumber: generateOrderNumber(),
            userId,
            orderType: "b2c",
            isOpenOrder: true,
            status: "matching_shop",
            subtotal: subtotal.toFixed(2),
            shippingCost: "0",
            discount: "0",
            total: subtotal.toFixed(2),
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
            broadcastExpiresAt,
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

        const parentId = parentOrder!.id;

        // Create sub-orders
        const subOrders: Array<{
          id: number;
          label: string;
          itemIds: number[];
          items: CartItemForSplit[];
        }> = [];

        for (const group of subOrderGroups) {
          let subOrderId: number;
          let subOrderItemIds: number[];

          if (subOrderGroups.length === 1) {
            // Single group — use parent order directly (no split)
            subOrderId = parentId;

            // Insert order items on the parent
            const insertedItems = await tx
              .insert(orderItem)
              .values(
                group.items.map((it) => ({
                  orderId: parentId,
                  productId: it.productId,
                  variantId: it.variantId,
                  productName: it.productName,
                  productImage: it.productImage,
                  productSize: it.productSize,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  totalPrice: it.totalPrice,
                })),
              )
              .returning();

            subOrderItemIds = insertedItems.map((i) => i.id);

            // Update parent with sub-order label
            await tx
              .update(order)
              .set({ subOrderLabel: group.label })
              .where(eq(order.id, parentId));
          } else {
            // Multiple groups — create child sub-orders
            const groupSubtotal = group.items.reduce(
              (sum, it) => sum + Number(it.totalPrice),
              0,
            );

            const [subOrder] = await tx
              .insert(order)
              .values({
                orderNumber: `${parentOrder!.orderNumber}-${subOrders.length + 1}`,
                userId,
                orderType: "b2c",
                isOpenOrder: true,
                parentOrderId: parentId,
                subOrderLabel: group.label,
                status: "matching_shop",
                subtotal: groupSubtotal.toFixed(2),
                shippingCost: "0",
                discount: "0",
                total: groupSubtotal.toFixed(2),
                paymentStatus: "pending",
                paymentMethod: input.paymentMethod,
                shippingName: input.shippingInfo.name,
                shippingPhone: input.shippingInfo.phone,
                shippingAddress: input.shippingInfo.address,
                shippingCity: input.shippingInfo.city,
                shippingArea: input.shippingInfo.area,
                broadcastExpiresAt,
                ...(areaFields.consumerAreaId && {
                  consumerAreaId: areaFields.consumerAreaId,
                }),
                ...(areaFields.locationLat && {
                  locationLat: areaFields.locationLat,
                }),
                ...(areaFields.locationLng && {
                  locationLng: areaFields.locationLng,
                }),
              })
              .returning();

            subOrderId = subOrder!.id;

            const insertedItems = await tx
              .insert(orderItem)
              .values(
                group.items.map((it) => ({
                  orderId: subOrderId,
                  productId: it.productId,
                  variantId: it.variantId,
                  productName: it.productName,
                  productImage: it.productImage,
                  productSize: it.productSize,
                  quantity: it.quantity,
                  unitPrice: it.unitPrice,
                  totalPrice: it.totalPrice,
                })),
              )
              .returning();

            subOrderItemIds = insertedItems.map((i) => i.id);
          }

          subOrders.push({
            id: subOrderId,
            label: group.label,
            itemIds: subOrderItemIds,
            items: group.items,
          });
        }

        // Clear cart
        await tx.delete(cartItem).where(eq(cartItem.cartId, userCart.id));

        return { parentOrder: parentOrder!, subOrders };
      });

      // Post-transaction: find eligible sellers and create bids
      for (const sub of result.subOrders) {
        const sellers = await findEligibleSellers(
          consumerLat,
          consumerLng,
          sub.items,
        );

        if (sellers.length > 0) {
          await createBidsForSubOrder(sub.id, sellers, sub.itemIds);

          // Emit WebSocket broadcast to each eligible shop
          try {
            const { io } = await import("../../server/src/socket" as any).catch(
              () => ({ io: null }),
            );
            // We'll emit from the API layer using a direct import pattern
            // For now, bids are created — shops will discover via polling
          } catch {
            // Socket not available in this context — shops will poll
          }
        } else {
          // No eligible sellers — cancel this sub-order immediately
          await db
            .update(order)
            .set({ status: "cancelled" })
            .where(eq(order.id, sub.id));
        }
      }

      return {
        success: true,
        order: {
          id: result.parentOrder.id,
          orderNumber: result.parentOrder.orderNumber,
        },
        subOrders: result.subOrders.map((s) => ({
          id: s.id,
          label: s.label,
          itemCount: s.items.length,
        })),
        broadcastExpiresAt: broadcastExpiresAt.toISOString(),
      };
    }),

  /** Get open order status (consumer polls this) */
  getOpenOrderStatus: protectedProcedure
    .route({
      method: "GET",
      path: "/customer/open-orders/{orderId}/status",
      tags: ["Customer", "Open Order"],
      summary: "Get open order status with bids",
    })
    .input(z.object({ orderId: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      // Get the parent order
      const parentOrder = await db.query.order.findFirst({
        where: and(
          eq(order.id, input.orderId),
          eq(order.userId, userId),
          eq(order.isOpenOrder, true),
        ),
        with: { items: true },
      });

      if (!parentOrder) {
        throw new ORPCError("NOT_FOUND", { message: "Open order not found" });
      }

      // Get sub-orders (or use parent if no children)
      let subOrders: (typeof parentOrder)[];
      const children = await db.query.order.findMany({
        where: and(
          eq(order.parentOrderId, parentOrder.id),
          eq(order.isOpenOrder, true),
        ),
        with: { items: true },
      });

      subOrders = children.length > 0 ? children : [parentOrder];

      // For each sub-order, get bids and check timeouts
      const subOrderData = await Promise.all(
        subOrders.map(async (sub) => {
          // Lazy timeout check
          await checkAndExpireBids(sub.id);
          const expiryResult = await checkBroadcastExpiry(sub.id);

          // Refresh sub-order status after potential changes
          const freshSub = await db.query.order.findFirst({
            where: eq(order.id, sub.id),
            with: { items: true },
          });

          // Get all bids for this sub-order
          const bids = await db
            .select({
              id: openOrderBid.id,
              shopId: openOrderBid.shopId,
              status: openOrderBid.status,
              rank: openOrderBid.rank,
              distanceKm: openOrderBid.distanceKm,
              totalBid: openOrderBid.totalBid,
              deliveryCharge: openOrderBid.deliveryCharge,
              isWinner: openOrderBid.isWinner,
              lockedAt: openOrderBid.lockedAt,
              submittedAt: openOrderBid.submittedAt,
              expiresAt: openOrderBid.expiresAt,
              shopName: user.shopName,
            })
            .from(openOrderBid)
            .leftJoin(user, eq(user.id, openOrderBid.shopId))
            .where(eq(openOrderBid.subOrderId, sub.id))
            .orderBy(
              sql`CAST(${openOrderBid.totalBid} AS numeric) ASC NULLS LAST`,
            );

          // Get bid items for submitted bids
          const submittedBidIds = bids
            .filter((b) => b.status === "submitted" || b.isWinner)
            .map((b) => b.id);

          let bidItems: any[] = [];
          if (submittedBidIds.length > 0) {
            bidItems = await db
              .select()
              .from(openOrderBidItem)
              .where(inArray(openOrderBidItem.bidId, submittedBidIds));
          }

          return {
            subOrderId: sub.id,
            label: freshSub?.subOrderLabel ?? sub.subOrderLabel,
            status: freshSub?.status ?? sub.status,
            items: (freshSub ?? sub).items.map((i) => ({
              id: i.id,
              productName: i.productName,
              productImage: i.productImage,
              productSize: i.productSize,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
            })),
            bids: bids.map((b) => ({
              bidId: b.id,
              shopName: b.shopName ?? "Shop",
              status: b.status,
              distanceKm: b.distanceKm,
              totalBid: b.totalBid,
              deliveryCharge: b.deliveryCharge,
              isWinner: b.isWinner,
              expiresAt: b.expiresAt?.toISOString() ?? null,
              items: bidItems
                .filter((bi) => bi.bidId === b.id)
                .map((bi) => ({
                  orderItemId: bi.orderItemId,
                  platformPrice: bi.platformPrice,
                  sellerPrice: bi.sellerPrice,
                })),
            })),
            offersReceived: bids.filter((b) => b.status === "submitted").length,
            winnerShopName: bids.find((b) => b.isWinner)?.shopName ?? null,
          };
        }),
      );

      // Determine overall progress stage
      const allStatuses = subOrderData.map((s) => s.status);
      let stage:
        | "splitting"
        | "broadcasting"
        | "negotiating"
        | "finalizing"
        | "confirmed"
        | "cancelled";

      if (allStatuses.every((s) => s === "confirmed")) {
        stage = "confirmed";
      } else if (allStatuses.every((s) => s === "cancelled")) {
        stage = "cancelled";
      } else if (allStatuses.some((s) => s === "confirmed")) {
        stage = "finalizing";
      } else if (subOrderData.some((s) => s.offersReceived > 0)) {
        stage = "negotiating";
      } else {
        stage = "broadcasting";
      }

      return {
        orderId: parentOrder.id,
        orderNumber: parentOrder.orderNumber,
        stage,
        broadcastExpiresAt:
          parentOrder.broadcastExpiresAt?.toISOString() ?? null,
        subOrders: subOrderData,
      };
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
