import { db } from "@bikalpo-project/db";
import {
  category,
  coreProductIdentity,
  product,
  subCategory,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, countDistinct, eq, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";

const createSubcategoryInput = z.object({
  name: z.string().min(2).max(100).trim(),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .trim(),
  image: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  categoryId: z.number().int(),
});

const updateSubcategoryInput = createSubcategoryInput.extend({
  id: z.number().int(),
});

export const adminSubcategoryRouter = {
  /**
   * Get ALL subcategories globally with parent category and type info
   */
  getAllGlobal: adminProcedure.handler(async () => {
    return db.query.subCategory.findMany({
      with: {
        category: {
          columns: { id: true, name: true, typeId: true },
          with: {
            type: { columns: { id: true, name: true } },
          },
        },
      },
      orderBy: [asc(subCategory.displayOrder), asc(subCategory.name)],
    });
  }),

  /**
   * Get single subcategory by ID with products, brands, variants
   */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const sub = await db.query.subCategory.findFirst({
        where: eq(subCategory.id, input.id),
        with: {
          category: {
            columns: { id: true, name: true, typeId: true },
            with: {
              type: { columns: { id: true, name: true } },
            },
          },
        },
      });

      if (!sub) {
        throw new Error("Subcategory not found");
      }

      // Get products under this subcategory
      const products = await db.query.product.findMany({
        where: eq(product.subCategoryId, input.id),
        columns: {
          id: true,
          name: true,
          slug: true,
          size: true,
          status: true,
          image: true,
        },
        with: {
          brand: { columns: { id: true, name: true } },
          variants: {
            columns: { id: true, unitLabel: true, sku: true, packType: true },
          },
        },
        orderBy: [asc(product.name)],
      });

      const coreProducts = await db.query.coreProductIdentity.findMany({
        where: eq(coreProductIdentity.subCategoryId, input.id),
        columns: {
          id: true,
          name: true,
          sku: true,
          isActive: true,
        },
        orderBy: [asc(coreProductIdentity.name)],
      });
      const [sellerUsage] = await db
        .select({ value: countDistinct(product.createdById) })
        .from(product)
        .where(
          and(
            eq(product.subCategoryId, input.id),
            eq(product.status, "active"),
            ne(product.creatorSource, "admin"),
            isNotNull(product.createdById),
          ),
        );

      // Extract unique brands
      const brandsMap = new Map<number, string>();
      for (const p of products) {
        if (p.brand) {
          brandsMap.set(p.brand.id, p.brand.name);
        }
      }
      const brands = Array.from(brandsMap.entries()).map(([id, name]) => ({
        id,
        name,
      }));

      // Extract unique variants
      const variantsMap = new Map<
        number,
        { unitLabel: string; sku: string | null; packType: string | null }
      >();
      for (const p of products) {
        if (p.variants) {
          for (const v of p.variants) {
            variantsMap.set(v.id, {
              unitLabel: v.unitLabel,
              sku: v.sku,
              packType: v.packType,
            });
          }
        }
      }
      const variants = Array.from(variantsMap.entries()).map(([id, data]) => ({
        id,
        ...data,
      }));

      return {
        subcategory: sub,
        products,
        brands,
        variants,
        coreProducts,
        activeSellerCount: sellerUsage?.value ?? 0,
      };
    }),

  getAll: adminProcedure
    .route({
      method: "POST",
      path: "/admin/subcategories/list",
      tags: ["Admin Subcategories"],
      summary: "Get subcategories by category",
      description: "Get all subcategories for a given category",
    })
    .input(z.object({ categoryId: z.number().int() }))
    .handler(async ({ input }) => {
      return db.query.subCategory.findMany({
        where: eq(subCategory.categoryId, input.categoryId),
      });
    }),

  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/subcategories",
      tags: ["Admin Subcategories"],
      summary: "Create subcategory",
      description: "Create a new subcategory",
    })
    .input(createSubcategoryInput)
    .handler(async ({ input }) => {
      const activeCategory = await db.query.category.findFirst({
        where: and(
          eq(category.id, input.categoryId),
          eq(category.isActive, true),
        ),
        columns: { id: true },
        with: { type: { columns: { isActive: true } } },
      });
      if (!activeCategory || activeCategory.type?.isActive === false) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Select a category with an active Product Type before creating a Sub Category.",
        });
      }
      // Auto-generate next 3-digit skuCode scoped to categoryId
      const filterCondition = sql`${subCategory.categoryId} = ${input.categoryId}`;
      const skuCode = await nextSkuCode(
        subCategory,
        subCategory.skuCode,
        3,
        filterCondition,
      );

      const [result] = await db
        .insert(subCategory)
        .values({ ...input, skuCode })
        .returning();
      return result;
    }),

  update: adminProcedure
    .route({
      method: "PUT",
      path: "/admin/subcategories/update",
      tags: ["Admin Subcategories"],
      summary: "Update subcategory",
      description: "Update an existing subcategory",
    })
    .input(updateSubcategoryInput)
    .handler(async ({ input }) => {
      const existing = await db
        .select()
        .from(subCategory)
        .where(eq(subCategory.id, input.id))
        .limit(1);

      if (existing.length === 0) throw new Error("Subcategory not found");

      await db
        .update(subCategory)
        .set({
          name: input.name,
          slug: input.slug,
          image: input.image,
          isActive: input.isActive,
          displayOrder: input.displayOrder,
          categoryId: input.categoryId,
          updatedAt: new Date(),
        })
        .where(eq(subCategory.id, input.id));

      return { message: "Subcategory updated successfully" };
    }),

  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.subCategory.findFirst({
        where: eq(subCategory.id, input.id),
        columns: { id: true, name: true, isActive: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Sub Category not found" });
      }
      const [updated] = await db
        .update(subCategory)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(subCategory.id, input.id))
        .returning({ isActive: subCategory.isActive });
      return {
        isActive: updated!.isActive,
        message: `${existing.name} ${updated!.isActive ? "enabled" : "disabled"}`,
      };
    }),

  delete: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/subcategories/delete",
      tags: ["Admin Subcategories"],
      summary: "Delete subcategory",
      description: "Delete a subcategory",
    })
    .input(z.object({ subcategoryId: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db
        .select()
        .from(subCategory)
        .where(eq(subCategory.id, input.subcategoryId))
        .limit(1);

      if (existing.length === 0) throw new Error("Subcategory not found");

      const [linkedProduct, linkedCoreProduct] = await Promise.all([
        db.query.product.findFirst({
          where: eq(product.subCategoryId, input.subcategoryId),
          columns: { id: true },
        }),
        db.query.coreProductIdentity.findFirst({
          where: eq(coreProductIdentity.subCategoryId, input.subcategoryId),
          columns: { id: true },
        }),
      ]);
      if (linkedProduct || linkedCoreProduct) {
        throw new ORPCError("CONFLICT", {
          message:
            "This sub category is still used by Core Identities or products. Disable it instead.",
        });
      }

      await db
        .delete(subCategory)
        .where(eq(subCategory.id, input.subcategoryId));

      return { message: "Subcategory deleted successfully" };
    }),
};
