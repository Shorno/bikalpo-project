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
  brand,
  brandUpdate,
  cart,
  cartItem,
  category,
  estimate,
  itemRequest,
  order,
  orderItem,
  payment,
  product,
  productReview,
  productVariant,
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
  lte,
  sql,
  sum,
} from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";

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

const shippingInfoSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  area: z.string().optional(),
  postalCode: z.string().optional(),
  customerNote: z.string().optional(),
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
    for (const rule of rules.rows as any[]) {
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

// ════════════════════════════════════════════════════════════════
// QUERIES (read-only, customer-facing)
// ════════════════════════════════════════════════════════════════

const queries = {
  // ── Products ─────────────────────────────────────────────────

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

      const conditions: any[] = [];

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

      // Brand filter
      if (brandSlug) {
        const slugs = brandSlug.split(",").filter(Boolean);
        const brands = await db.query.brand.findMany({
          where: inArray(brand.slug, slugs),
        });
        if (brands.length > 0) {
          conditions.push(
            inArray(
              product.brandId,
              brands.map((b) => b.id),
            ),
          );
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
            brand: true,
            images: true,
          },
          orderBy: getOrderBy(),
          limit,
          offset,
        }),
        db.select({ count: count() }).from(product).where(whereClause),
      ]);

      const totalCount = countResult[0]?.count || 0;
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
        where: ilike(product.name, `%${input.query}%`),
        with: { category: { columns: { name: true, slug: true } } },
        limit: 10,
      });
      return { products: results };
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
        where: eq(product.slug, input.slug),
        with: {
          category: { columns: { name: true, slug: true } },
          subCategory: { columns: { name: true } },
          brand: { columns: { id: true, name: true, slug: true, logo: true } },
          images: true,
        },
      });
      if (!found)
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });

      // Get variants (B2C retail only)
      const variants = await db.query.productVariant.findMany({
        where: eq(productVariant.productId, found.id),
        orderBy: [asc(productVariant.sortOrder)],
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
        product: found,
        variants,
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
            ),
            with: { category: { columns: { name: true, slug: true } } },
            limit: prodLimit,
            orderBy: [desc(product.createdAt)],
          });
          return { ...cat, products, totalProducts: products.length };
        }),
      );

      return { categories: result.filter((c) => c.products.length > 0) };
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
        where: eq(brand.isActive, true),
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
      return { order: found };
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
      });
      return { order: activeOrder || null };
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
            },
          },
        },
      });

      if (!userCart) return { items: [], totalItems: 0, totalPrice: 0 };

      const items = userCart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        name: item.product.name,
        slug: item.product.slug,
        image: item.product.image,
        size: item.product.size,
        price: Number(item.price),
        currentPrice: Number(item.product.price),
        quantity: item.quantity,
        inStock: item.product.inStock,
      }));

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

  /** Get customer's estimates (approved/converted only) */
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
          inArray(estimate.status, ["approved", "converted"]),
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

      const reorderItems = await Promise.all(
        orderData.items.map(async (item) => {
          const currentProduct = await db.query.product.findFirst({
            where: eq(product.id, item.productId),
          });

          return {
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            productSize: item.productSize,
            originalQuantity: item.quantity,
            quantity: item.quantity,
            originalPrice: item.unitPrice,
            currentPrice: currentProduct?.price || item.unitPrice,
            inStock: currentProduct?.inStock ?? false,
            stockQuantity: currentProduct?.stockQuantity ?? 0,
            productExists: !!currentProduct,
          };
        }),
      );

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
        conditions.push(eq(itemRequest.status, input.status as any));
      }

      if (input?.search) {
        conditions.push(
          sql`(${ilike(itemRequest.itemName, `%${input.search}%`)} OR ${ilike(
            itemRequest.requestNumber,
            `%${input.search}%`,
          )})` as any,
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
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

      // Get or create cart
      let userCart = await db.query.cart.findFirst({
        where: eq(cart.userId, userId),
      });
      if (!userCart) {
        const [newCart] = await db.insert(cart).values({ userId }).returning();
        userCart = newCart!;
      }

      // Check if item exists
      const existing = await db.query.cartItem.findFirst({
        where: and(
          eq(cartItem.cartId, userCart.id),
          eq(cartItem.productId, input.productId),
        ),
      });

      if (existing) {
        await db
          .update(cartItem)
          .set({
            quantity: existing.quantity + input.quantity,
            price: productData.price,
          })
          .where(eq(cartItem.id, existing.id));
      } else {
        await db.insert(cartItem).values({
          cartId: userCart.id,
          productId: input.productId,
          variantId: input.variantId ?? null,
          quantity: input.quantity,
          price: productData.price,
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

        const stockQty = item.variant
          ? item.variant.stockQuantity
          : item.product.stockQuantity;
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

        orderItems.push({
          productId: item.productId,
          variantId: item.variantId ?? null,
          productName: item.product.name,
          productImage: item.product.image,
          productSize: item.variant?.quantitySelectorLabel ?? item.product.size,
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

      // Transaction: create order, deduct stock, clear cart
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
          if (oi.variantId) {
            await tx
              .update(productVariant)
              .set({
                stockQuantity: sql`${productVariant.stockQuantity} - ${oi.quantity}`,
              })
              .where(eq(productVariant.id, oi.variantId));
          } else {
            await tx
              .update(product)
              .set({
                stockQuantity: sql`${product.stockQuantity} - ${oi.quantity}`,
              })
              .where(eq(product.id, oi.productId));
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
            await tx
              .update(product)
              .set({
                stockQuantity: sql`${product.stockQuantity} + ${item.quantity}`,
              })
              .where(eq(product.id, item.productId));
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
          .enum([
            "cash_on_delivery",
            "bkash",
            "nagad",
            "bank_transfer",
            "card",
          ])
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

        if (currentProduct.stockQuantity < item.quantity) {
          throw new ORPCError("BAD_REQUEST", {
            message: `Insufficient stock for ${currentProduct.name}. Available: ${currentProduct.stockQuantity}`,
          });
        }

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

        // Deduct stock
        for (const oi of orderItems) {
          await tx
            .update(product)
            .set({
              stockQuantity: sql`${product.stockQuantity} - ${oi.quantity}`,
            })
            .where(eq(product.id, oi.productId));
        }

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
        priority: z
          .enum(["low", "medium", "high"])
          .default("medium"),
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
      z.object({
        estimateId: z.number(),
        shippingName: z.string().min(1),
        shippingPhone: z.string().min(1),
        shippingAddress: z.string().min(1),
        shippingCity: z.string().min(1),
        shippingArea: z.string().optional().nullable(),
        shippingPostalCode: z.string().optional().nullable(),
        customerNote: z.string().optional().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const userId = context.session.user.id;
      const userRole = context.session.user.role;

      if (userRole !== "admin" && userRole !== "salesman" && userRole !== "customer") {
        throw new ORPCError("FORBIDDEN", { message: "Unauthorized" });
      }

      const estimateData = await db.query.estimate.findFirst({
        where: eq(estimate.id, input.estimateId),
        with: { items: true },
      });

      if (!estimateData) {
        throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
      }

      // If customer, verify ownership
      if (userRole === "customer" && estimateData.customerId !== userId) {
        throw new ORPCError("FORBIDDEN", {
          message: "You do not own this estimate",
        });
      }

      // Check active orders
      const activeOrder = await db.query.order.findFirst({
        where: sql`${order.userId} = ${estimateData.customerId}
          AND ${order.status} NOT IN ('delivered', 'cancelled')`,
      });

      if (activeOrder) {
        throw new ORPCError("CONFLICT", {
          message:
            "Customer already has an active order. Please wait until it's delivered or cancelled.",
        });
      }

      if (estimateData.status === "converted") {
        throw new ORPCError("CONFLICT", {
          message: "Estimate has already been converted",
        });
      }

      if (estimateData.status !== "approved" && estimateData.status !== "sent") {
        throw new ORPCError("BAD_REQUEST", {
          message: `Only sent or approved estimates can be converted. Current status: ${estimateData.status}`,
        });
      }

      // Convert in a transaction
      const result = await db.transaction(async (tx) => {
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const [newOrder] = await tx
          .insert(order)
          .values({
            orderNumber,
            userId: estimateData.customerId,
            subtotal: estimateData.subtotal,
            discount: estimateData.discount,
            total: estimateData.total,
            shippingCost: "0",
            status: "pending",
            paymentStatus: "pending",
            paymentMethod: "cash_on_delivery",
            shippingName: input.shippingName,
            shippingPhone: input.shippingPhone,
            shippingEmail: null,
            shippingAddress: input.shippingAddress,
            shippingCity: input.shippingCity,
            shippingArea: input.shippingArea || null,
            shippingPostalCode: input.shippingPostalCode || null,
            customerNote: input.customerNote || null,
          })
          .returning();

        if (!newOrder) throw new Error("Failed to create order");

        // Create order items from estimate items
        const orderItems = estimateData.items.map((item) => ({
          orderId: newOrder.id,
          productId: item.productId,
          productName: item.productName,
          productImage: item.productImage || "",
          productSize: "N/A",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }));

        await tx.insert(orderItem).values(orderItems);

        // Reduce stock
        for (const item of estimateData.items) {
          await tx
            .update(product)
            .set({
              stockQuantity: sql`${product.stockQuantity} - ${item.quantity}`,
            })
            .where(eq(product.id, item.productId));
        }

        // Update estimate status
        await tx
          .update(estimate)
          .set({
            status: "converted",
            convertedOrderId: newOrder.id,
            convertedAt: new Date(),
          })
          .where(eq(estimate.id, input.estimateId));

        return newOrder;
      });

      return { success: true, order: result };
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
// Export combined customer router
// ════════════════════════════════════════════════════════════════

export const customerRouter = {
  ...queries,
  ...mutations,
};
