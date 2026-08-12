import { db } from "@bikalpo-project/db";
import {
  brand,
  order,
  orderItem,
  product,
  productBrand,
  productVariant,
  productVariantPrice,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";

// Validation schemas
const createBrandSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .trim(),
  logo: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
});

const updateBrandSchema = createBrandSchema.extend({
  id: z.number().int(),
});

export const brandRouter = {
  /**
   * Get all brands
   * REST: GET /api/brands
   */
  getAll: publicProcedure
    .route({
      method: "GET",
      path: "/brands",
      tags: ["Brands"],
      summary: "Get all brands",
      description: "Get all brands ordered by display order",
    })
    .handler(async () => {
      return await db.query.brand.findMany({
        orderBy: [asc(brand.displayOrder)],
      });
    }),

  /** Admin list enriched with taxonomy and usage aggregates. */
  getAdminAll: adminProcedure
    .route({
      method: "GET",
      path: "/admin/brands",
      tags: ["Admin Brands"],
      summary: "Get brands with setup usage",
    })
    .handler(async () => {
      const [brands, configuredProducts] = await Promise.all([
        db.query.brand.findMany({ orderBy: [asc(brand.displayOrder)] }),
        db.query.product.findMany({
          columns: {
            id: true,
            brandId: true,
            categoryId: true,
            coreProductId: true,
          },
          with: {
            category: { columns: { id: true, name: true } },
            productBrands: { columns: { brandId: true } },
            variantPrices: {
              columns: { brandId: true, variantOptionId: true },
            },
          },
        }),
      ]);

      return brands.map((item) => {
        const categoryMap = new Map<number, string>();
        const productIds = new Set<number>();
        const coreProductIds = new Set<number>();
        const variantOptionIds = new Set<number>();

        for (const configuredProduct of configuredProducts) {
          const isUsed =
            configuredProduct.brandId === item.id ||
            configuredProduct.productBrands.some(
              (link) => link.brandId === item.id,
            ) ||
            configuredProduct.variantPrices.some(
              (price) => price.brandId === item.id,
            );
          if (!isUsed) continue;
          productIds.add(configuredProduct.id);
          categoryMap.set(
            configuredProduct.category.id,
            configuredProduct.category.name,
          );
          if (configuredProduct.coreProductId) {
            coreProductIds.add(configuredProduct.coreProductId);
          }
          const appliesToWholeProduct =
            configuredProduct.brandId === item.id ||
            configuredProduct.productBrands.some(
              (link) => link.brandId === item.id,
            );
          for (const price of configuredProduct.variantPrices) {
            if (appliesToWholeProduct || price.brandId === item.id) {
              variantOptionIds.add(price.variantOptionId);
            }
          }
        }

        return {
          ...item,
          categories: [...categoryMap.entries()].map(([id, name]) => ({
            id,
            name,
          })),
          productCount: productIds.size,
          coreIdentityCount: coreProductIds.size,
          variantCount: variantOptionIds.size,
        };
      });
    }),

  /**
   * Get brand by ID
   * REST: GET /api/brands/{id}
   */
  getById: publicProcedure
    .route({
      method: "GET",
      path: "/brands/{id}",
      tags: ["Brands"],
      summary: "Get brand by ID",
      description: "Get a single brand by its ID",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const result = await db.query.brand.findFirst({
        where: (item, { eq }) => eq(item.id, input.id),
      });
      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Brand not found" });
      }
      return result;
    }),

  getAdminById: adminProcedure
    .route({
      method: "GET",
      path: "/admin/brands/{id}",
      tags: ["Admin Brands"],
      summary: "Get brand setup detail",
      description:
        "Get a brand with its category, Core Identity, product, and variant usage",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const result = await db.query.brand.findFirst({
        where: (b, { eq }) => eq(b.id, input.id),
      });

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Brand not found" });
      }

      const [directProducts, productLinks, priceLinks] = await Promise.all([
        db
          .select({ id: product.id })
          .from(product)
          .where(eq(product.brandId, input.id)),
        db
          .select({ id: productBrand.productId })
          .from(productBrand)
          .where(eq(productBrand.brandId, input.id)),
        db
          .select({ id: productVariantPrice.productId })
          .from(productVariantPrice)
          .where(eq(productVariantPrice.brandId, input.id)),
      ]);
      const productIds = [
        ...new Set([
          ...directProducts.map((row) => row.id),
          ...productLinks.map((row) => row.id),
          ...priceLinks.map((row) => row.id),
        ]),
      ];
      const wholeProductBrandIds = new Set([
        ...directProducts.map((row) => row.id),
        ...productLinks.map((row) => row.id),
      ]);
      const configuredProducts = productIds.length
        ? await db.query.product.findMany({
            where: inArray(product.id, productIds),
            columns: {
              id: true,
              name: true,
              status: true,
              brandId: true,
              coreProductId: true,
            },
            with: {
              category: { columns: { id: true, name: true } },
              coreProduct: {
                columns: {
                  id: true,
                  name: true,
                  sku: true,
                  categoryId: true,
                  subCategoryId: true,
                },
                with: {
                  category: {
                    columns: { id: true, name: true, typeId: true },
                    with: {
                      type: { columns: { id: true, name: true } },
                    },
                  },
                  subCategory: { columns: { id: true, name: true } },
                },
              },
              variantPrices: {
                columns: { id: true, brandId: true, isActive: true },
                with: {
                  variantOption: {
                    columns: {
                      id: true,
                      name: true,
                      unit: true,
                      size: true,
                      variantType: true,
                      skuCode: true,
                    },
                  },
                },
              },
            },
          })
        : [];
      const categories = [
        ...new Map(
          configuredProducts.map((item) => [item.category.id, item.category]),
        ).values(),
      ];
      const coreIdentities = [
        ...new Map(
          configuredProducts
            .filter((item) => item.coreProduct)
            .map((item) => [item.coreProduct!.id, item.coreProduct!]),
        ).values(),
      ].sort((a, b) => {
        const typeOrder = (a.category.type?.name ?? "").localeCompare(
          b.category.type?.name ?? "",
        );
        if (typeOrder !== 0) return typeOrder;
        const categoryOrder = a.category.name.localeCompare(b.category.name);
        if (categoryOrder !== 0) return categoryOrder;
        const subCategoryOrder = (a.subCategory?.name ?? "").localeCompare(
          b.subCategory?.name ?? "",
        );
        return subCategoryOrder || a.name.localeCompare(b.name);
      });
      const variants = [
        ...new Map(
          configuredProducts.flatMap((item) =>
            item.variantPrices
              .filter(
                (price) =>
                  wholeProductBrandIds.has(item.id) ||
                  price.brandId === input.id,
              )
              .map(
                (price) =>
                  [price.variantOption.id, price.variantOption] as const,
              ),
          ),
        ).values(),
      ];
      const variantIds = variants.map((variant) => variant.id);
      const [topVariantUsage] =
        productIds.length > 0 && variantIds.length > 0
          ? await db
              .select({
                variantOptionId: productVariant.sourceVariantOptionId,
                deliveredUnits: sql<number>`coalesce(sum(coalesce(${orderItem.deliveredQty}, ${orderItem.quantity})), 0)::int`,
              })
              .from(productVariant)
              .innerJoin(orderItem, eq(orderItem.variantId, productVariant.id))
              .innerJoin(order, eq(order.id, orderItem.orderId))
              .where(
                and(
                  inArray(productVariant.productId, productIds),
                  inArray(productVariant.sourceVariantOptionId, variantIds),
                  eq(order.status, "delivered"),
                ),
              )
              .groupBy(productVariant.sourceVariantOptionId)
              .orderBy(
                desc(
                  sql`sum(coalesce(${orderItem.deliveredQty}, ${orderItem.quantity}))`,
                ),
              )
              .limit(1)
          : [];
      const topSellingVariant = topVariantUsage?.variantOptionId
        ? {
            ...variants.find(
              (variant) => variant.id === topVariantUsage.variantOptionId,
            )!,
            deliveredUnits: topVariantUsage.deliveredUnits,
          }
        : null;

      return {
        ...result,
        categories,
        coreIdentities,
        variants,
        configuredProducts,
        productCount: configuredProducts.length,
        topSellingVariant,
      };
    }),

  /**
   * Create a new brand
   * REST: POST /api/brands
   */
  create: adminProcedure
    .route({
      method: "POST",
      path: "/brands",
      tags: ["Admin Brands"],
      summary: "Create brand",
      description: "Create a new brand (admin only)",
    })
    .input(createBrandSchema)
    .handler(async ({ input }) => {
      // Auto-generate next available 2-digit skuCode
      const skuCode = await nextSkuCode(brand, brand.skuCode, 2);

      const [newBrand] = await db
        .insert(brand)
        .values({ ...input, skuCode })
        .returning();
      return {
        data: newBrand,
        message: "Brand created successfully",
      };
    }),

  /**
   * Update a brand
   * REST: PUT /api/brands/{id}
   */
  update: adminProcedure
    .route({
      method: "PUT",
      path: "/brands/{id}",
      tags: ["Admin Brands"],
      summary: "Update brand",
      description: "Update an existing brand (admin only)",
    })
    .input(updateBrandSchema)
    .handler(async ({ input }) => {
      const { id, ...data } = input;

      const existing = await db.query.brand.findFirst({
        where: (b, { eq }) => eq(b.id, id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Brand not found" });
      }

      await db
        .update(brand)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(brand.id, id));

      return { message: "Brand updated successfully" };
    }),

  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.brand.findFirst({
        where: eq(brand.id, input.id),
        columns: { id: true, name: true, isActive: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Brand not found" });
      }
      const [updated] = await db
        .update(brand)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(brand.id, input.id))
        .returning({ isActive: brand.isActive });
      return {
        isActive: updated!.isActive,
        message: `${existing.name} ${updated!.isActive ? "enabled" : "disabled"}`,
      };
    }),

  /**
   * Delete a brand
   * REST: DELETE /api/brands/{id}
   */
  delete: adminProcedure
    .route({
      method: "DELETE",
      path: "/brands/{id}",
      tags: ["Admin Brands"],
      summary: "Delete brand",
      description: "Delete a brand (admin only)",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.brand.findFirst({
        where: (b, { eq }) => eq(b.id, input.id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Brand not found" });
      }

      const [reference] = await db
        .select({ id: product.id })
        .from(product)
        .leftJoin(productBrand, eq(productBrand.productId, product.id))
        .leftJoin(
          productVariantPrice,
          eq(productVariantPrice.productId, product.id),
        )
        .where(
          or(
            eq(product.brandId, input.id),
            eq(productBrand.brandId, input.id),
            eq(productVariantPrice.brandId, input.id),
          ),
        )
        .limit(1);
      if (reference) {
        throw new ORPCError("CONFLICT", {
          message: `Cannot delete "${existing.name}" because configured products or variants still use it. Disable the brand instead.`,
        });
      }

      await db.delete(brand).where(eq(brand.id, input.id));

      return { message: "Brand deleted successfully" };
    }),
};
