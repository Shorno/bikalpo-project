/**
 * Public / Customer-facing ORPC Router
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
  cart,
  cartItem,
  category,
  order,
  orderItem,
  payment,
  product,
  productImage,
  productReview,
  productVariant,
  subCategory,
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
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, publicProcedure } from "../index";

// ────────────────────────────────────────────────────────────────
// Shared Zod Schemas
// ────────────────────────────────────────────────────────────────

const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(12),
});

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
        (_area != null && _area !== "" && rule.area.toLowerCase() === _area.toLowerCase());
      if (!areaMatch) continue;
      const minKg = rule.min_weight_kg != null ? Number(rule.min_weight_kg) : 0;
      const maxKg =
        rule.max_weight_kg != null ? Number(rule.max_weight_kg) : Number.MAX_SAFE_INTEGER;
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
// QUERIES (read-only, public or light auth)
// ════════════════════════════════════════════════════════════════

const queries = {
  // ── Products ─────────────────────────────────────────────────

  /** Get public products with full-featured filtering & pagination */
  getPublicProducts: publicProcedure
    .route({
      method: "GET",
      path: "/public/products",
      tags: ["Public"],
      summary: "Get public products with filters",
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
          conditions.push(inArray(product.categoryId, cats.map((c) => c.id)));
        } else {
          return { products: [], pagination: { page, limit, totalCount: 0, totalPages: 0 } };
        }
      }

      // Subcategory filter
      if (subcategory) {
        const slugs = subcategory.split(",").filter(Boolean);
        const subs = await db.query.subCategory.findMany({
          where: inArray(subCategory.slug, slugs),
        });
        if (subs.length > 0) {
          conditions.push(inArray(product.subCategoryId, subs.map((s) => s.id)));
        }
      }

      // Brand filter
      if (brandSlug) {
        const slugs = brandSlug.split(",").filter(Boolean);
        const brands = await db.query.brand.findMany({
          where: inArray(brand.slug, slugs),
        });
        if (brands.length > 0) {
          conditions.push(inArray(product.brandId, brands.map((b) => b.id)));
        }
      }

      // Price filters
      if (minPrice) conditions.push(gte(product.price, minPrice));
      if (maxPrice) conditions.push(lte(product.price, maxPrice));

      // In-stock filter
      if (inStockStr === "true") conditions.push(eq(product.inStock, true));

      // Search
      if (search) conditions.push(ilike(product.name, `%${search}%`));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
        pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
      };
    }),

  /** Search products by name (quick search, max 10) */
  searchProducts: publicProcedure
    .route({
      method: "GET",
      path: "/public/products/search",
      tags: ["Public"],
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
      path: "/public/products/{slug}",
      tags: ["Public"],
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
      if (!found) throw new ORPCError("NOT_FOUND", { message: "Product not found" });

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
      path: "/public/products/{productId}/reviews",
      tags: ["Public"],
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
      path: "/public/categories",
      tags: ["Public"],
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
      path: "/public/categories/{slug}",
      tags: ["Public"],
      summary: "Get category by slug",
    })
    .input(z.object({ slug: z.string() }))
    .handler(async ({ input }) => {
      const found = await db.query.category.findFirst({
        where: and(eq(category.slug, input.slug), eq(category.isActive, true)),
        with: { subCategory: true },
      });
      if (!found) throw new ORPCError("NOT_FOUND", { message: "Category not found" });
      return { category: found };
    }),

  /** Get categories with their products (for home page) */
  getCategoriesWithProducts: publicProcedure
    .route({
      method: "GET",
      path: "/public/categories/with-products",
      tags: ["Public"],
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
            where: and(eq(product.categoryId, cat.id), eq(product.inStock, true)),
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
      path: "/public/categories/{slug}/subcategories",
      tags: ["Public"],
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
        where: and(eq(subCategory.categoryId, cat.id), eq(subCategory.isActive, true)),
        orderBy: [asc(subCategory.displayOrder)],
      });
      return { subcategories };
    }),

  // ── Brands ───────────────────────────────────────────────────

  /** Get active brands */
  getActiveBrands: publicProcedure
    .route({
      method: "GET",
      path: "/public/brands",
      tags: ["Public"],
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
      path: "/public/orders",
      tags: ["Public"],
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
      path: "/public/orders/{orderNumber}",
      tags: ["Public"],
      summary: "Get order by order number",
    })
    .input(z.object({ orderNumber: z.string() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const found = await db.query.order.findFirst({
        where: and(eq(order.orderNumber, input.orderNumber), eq(order.userId, userId)),
        with: { items: true },
      });
      if (!found) throw new ORPCError("NOT_FOUND", { message: "Order not found" });
      return { order: found };
    }),

  /** Get order status (order + payment info) */
  getOrderStatus: protectedProcedure
    .route({
      method: "GET",
      path: "/public/orders/{orderId}/status",
      tags: ["Public"],
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

      if (!orderData) throw new ORPCError("NOT_FOUND", { message: "Order not found" });

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
      path: "/public/orders/active",
      tags: ["Public"],
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
      path: "/public/cart",
      tags: ["Public"],
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
      const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

      return { items, totalItems, totalPrice };
    }),

  // ── Profile (authenticated customer) ─────────────────────────

  /** Get customer profile */
  getProfile: protectedProcedure
    .route({
      method: "GET",
      path: "/public/profile",
      tags: ["Public"],
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
      path: "/public/addresses",
      tags: ["Public"],
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
      path: "/public/announcements",
      tags: ["Public"],
      summary: "Get active announcements",
    })
    .handler(async () => {
      const items = await db.query.announcement.findMany({
        where: eq(announcement.active, true),
      });
      return { announcements: items };
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
      path: "/public/cart/add",
      tags: ["Public"],
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
      if (!productData) throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      if (!productData.inStock) throw new ORPCError("BAD_REQUEST", { message: "Product is out of stock" });

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
          .set({ quantity: existing.quantity + input.quantity, price: productData.price })
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
      path: "/public/cart/update",
      tags: ["Public"],
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
      path: "/public/cart/remove",
      tags: ["Public"],
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
      path: "/public/cart/clear",
      tags: ["Public"],
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
      path: "/public/orders",
      tags: ["Public"],
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
          throw new ORPCError("BAD_REQUEST", { message: "Product not found for cart item" });
        if (!item.product.inStock)
          throw new ORPCError("BAD_REQUEST", {
            message: `${item.product.name} is out of stock`,
          });

        const stockQty = item.variant ? item.variant.stockQuantity : item.product.stockQuantity;
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
      path: "/public/orders/{orderId}/cancel",
      tags: ["Public"],
      summary: "Cancel pending order",
    })
    .input(z.object({ orderId: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const orderData = await db.query.order.findFirst({
        where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
        with: { items: true },
      });

      if (!orderData) throw new ORPCError("NOT_FOUND", { message: "Order not found" });
      if (orderData.status !== "pending") {
        throw new ORPCError("BAD_REQUEST", { message: "Only pending orders can be cancelled" });
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
      path: "/public/reviews",
      tags: ["Public"],
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
        .where(and(eq(order.userId, userId), eq(orderItem.productId, input.productId)))
        .limit(1);

      if (ordered.length === 0)
        throw new ORPCError("FORBIDDEN", { message: "You can only review products you ordered" });

      // Check duplicate
      const existing = await db.query.productReview.findFirst({
        where: and(eq(productReview.productId, input.productId), eq(productReview.userId, userId)),
      });
      if (existing)
        throw new ORPCError("CONFLICT", { message: "You have already reviewed this product" });

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
      path: "/public/addresses",
      tags: ["Public"],
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
      path: "/public/addresses/{id}/update",
      tags: ["Public"],
      summary: "Update address",
    })
    .input(addressFormSchema.extend({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const { id, ...data } = input;

      const existing = await db.query.address.findFirst({
        where: and(eq(address.id, id), eq(address.userId, userId)),
      });
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Address not found" });

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
      path: "/public/addresses/{id}/delete",
      tags: ["Public"],
      summary: "Delete address",
    })
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const existing = await db.query.address.findFirst({
        where: and(eq(address.id, input.id), eq(address.userId, userId)),
      });
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Address not found" });

      await db.delete(address).where(eq(address.id, input.id));

      // If deleted was default, set first remaining as default
      if (existing.isDefault) {
        const remaining = await db.query.address.findFirst({
          where: eq(address.userId, userId),
          orderBy: [desc(address.createdAt)],
        });
        if (remaining) {
          await db.update(address).set({ isDefault: true }).where(eq(address.id, remaining.id));
        }
      }

      return { success: true };
    }),

  /** Set default address */
  setDefaultAddress: protectedProcedure
    .route({
      method: "POST",
      path: "/public/addresses/{id}/default",
      tags: ["Public"],
      summary: "Set default address",
    })
    .input(z.object({ id: z.number() }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const existing = await db.query.address.findFirst({
        where: and(eq(address.id, input.id), eq(address.userId, userId)),
      });
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Address not found" });

      await db.update(address).set({ isDefault: false }).where(eq(address.userId, userId));
      await db.update(address).set({ isDefault: true }).where(eq(address.id, input.id));

      return { success: true };
    }),

  // ── Profile ──────────────────────────────────────────────────

  /** Update customer profile */
  updateProfile: protectedProcedure
    .route({
      method: "POST",
      path: "/public/profile",
      tags: ["Public"],
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
};

// ════════════════════════════════════════════════════════════════
// Export combined public router
// ════════════════════════════════════════════════════════════════

export const publicRouter = {
  ...queries,
  ...mutations,
};
