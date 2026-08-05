import { db } from "@bikalpo-project/db";
import {
  category,
  coreProductIdentity,
  product,
  productType,
  variantOption,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, asc, countDistinct, eq, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, publicProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";

// Validation schemas
const categoryNameSchema = z.string().min(2).max(100).trim();
const categorySlugSchema = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .trim();

const createCategorySchema = z.object({
  name: categoryNameSchema,
  slug: categorySlugSchema,
  image: z.string().max(255).optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).default(0),
  typeId: z.number().int(),
});

const updateCategorySchema = z.object({
  id: z.number().int(),
  name: categoryNameSchema,
  slug: categorySlugSchema.optional(),
  image: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  typeId: z.number().int().nullable().optional(),
});

async function assertCategoryNameIsUnique(name: string, excludeId?: number) {
  const normalizedName = name.trim().toLowerCase();
  const nameMatches = sql`lower(trim(${category.name})) = ${normalizedName}`;
  const duplicate = await db.query.category.findFirst({
    where:
      excludeId === undefined
        ? nameMatches
        : and(nameMatches, ne(category.id, excludeId)),
    columns: { id: true },
  });

  if (duplicate) {
    throw new ORPCError("CONFLICT", {
      message: `A Category named "${name.trim()}" already exists.`,
    });
  }
}

async function assertProductTypeIsActive(typeId: number) {
  const activeType = await db.query.productType.findFirst({
    where: and(eq(productType.id, typeId), eq(productType.isActive, true)),
    columns: { id: true },
  });

  if (!activeType) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Select an active Type before saving the Category.",
    });
  }
}

export const categoryRouter = {
  /**
   * Get all categories with subcategories and type info
   * REST: GET /api/categories
   */
  getAll: publicProcedure
    .route({
      method: "GET",
      path: "/categories",
      tags: ["Categories"],
      summary: "Get all categories",
      description: "Get all categories with their subcategories and type info",
    })
    .handler(async () => {
      return await db.query.category.findMany({
        with: {
          subCategory: true,
          type: { columns: { id: true, name: true } },
        },
        orderBy: [asc(category.displayOrder)],
      });
    }),

  /**
   * Get active categories only
   * REST: GET /api/categories/active
   */
  getActive: publicProcedure
    .route({
      method: "GET",
      path: "/categories/active",
      tags: ["Categories"],
      summary: "Get active categories",
      description:
        "Get only active categories with subcategories for public display",
    })
    .handler(async () => {
      return await db.query.category.findMany({
        where: (c, { eq }) => eq(c.isActive, true),
        with: { subCategory: true },
        orderBy: [asc(category.displayOrder)],
      });
    }),

  /**
   * Get category by ID with subcategories, type info, and products
   * REST: GET /api/categories/{id}
   */
  getById: publicProcedure
    .route({
      method: "GET",
      path: "/categories/{id}",
      tags: ["Categories"],
      summary: "Get category by ID",
      description:
        "Get a single category with subcategories, type, and products by its ID",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const result = await db.query.category.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
        with: {
          subCategory: true,
          type: { columns: { id: true, name: true } },
        },
      });

      if (!result) {
        throw new ORPCError("NOT_FOUND", { message: "Category not found" });
      }

      // Fetch products under this category
      const products = await db.query.product.findMany({
        where: (p, { eq }) => eq(p.categoryId, input.id),
        columns: {
          id: true,
          name: true,
          slug: true,
          size: true,
          status: true,
        },
        with: {
          subCategory: { columns: { id: true, name: true } },
          images: { columns: { imageUrl: true }, limit: 1 },
        },
        orderBy: (p, { asc }) => [asc(p.name)],
      });

      const [sellerUsageRows, activeSellerUsageRows] = await Promise.all([
        db
          .select({ value: countDistinct(product.createdById) })
          .from(product)
          .where(
            and(
              eq(product.categoryId, input.id),
              ne(product.creatorSource, "admin"),
              isNotNull(product.createdById),
            ),
          ),
        db
          .select({ value: countDistinct(product.createdById) })
          .from(product)
          .where(
            and(
              eq(product.categoryId, input.id),
              eq(product.status, "active"),
              ne(product.creatorSource, "admin"),
              isNotNull(product.createdById),
            ),
          ),
      ]);
      const sellerUsage = sellerUsageRows[0];
      const activeSellerUsage = activeSellerUsageRows[0];

      return {
        ...result,
        products,
        sellerCount: sellerUsage?.value ?? 0,
        activeSellerCount: activeSellerUsage?.value ?? 0,
      };
    }),

  /**
   * Create a new category
   * REST: POST /api/categories
   */
  create: adminProcedure
    .route({
      method: "POST",
      path: "/categories",
      tags: ["Admin Categories"],
      summary: "Create category",
      description: "Create a new category (admin only)",
    })
    .input(createCategorySchema)
    .handler(async ({ input }) => {
      await Promise.all([
        assertCategoryNameIsUnique(input.name),
        assertProductTypeIsActive(input.typeId),
      ]);
      // Auto-generate next 3-digit skuCode scoped to typeId
      const filterCondition = input.typeId
        ? sql`${category.typeId} = ${input.typeId}`
        : sql`${category.typeId} IS NULL`;
      const skuCode = await nextSkuCode(
        category,
        category.skuCode,
        3,
        filterCondition,
      );

      const [newCategory] = await db
        .insert(category)
        .values({ ...input, skuCode })
        .returning();
      return {
        data: newCategory,
        message: "Category created successfully",
      };
    }),

  /**
   * Update a category
   * REST: PUT /api/categories/{id}
   */
  update: adminProcedure
    .route({
      method: "PUT",
      path: "/categories/{id}",
      tags: ["Admin Categories"],
      summary: "Update category",
      description: "Update an existing category (admin only)",
    })
    .input(updateCategorySchema)
    .handler(async ({ input }) => {
      const { id, ...data } = input;

      const existing = await db.query.category.findFirst({
        where: (c, { eq }) => eq(c.id, id),
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Category not found" });
      }

      await assertCategoryNameIsUnique(data.name, id);
      if (data.typeId !== undefined && data.typeId !== existing.typeId) {
        if (data.typeId === null) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "An assigned Category cannot be returned to an unassigned Type.",
          });
        }
        await assertProductTypeIsActive(data.typeId);
      }

      await db
        .update(category)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(category.id, id));

      return { message: "Category updated successfully" };
    }),

  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.category.findFirst({
        where: eq(category.id, input.id),
        columns: { id: true, name: true, isActive: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Category not found" });
      }
      const [updated] = await db
        .update(category)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(category.id, input.id))
        .returning({ isActive: category.isActive });
      return {
        isActive: updated!.isActive,
        message: `${existing.name} ${updated!.isActive ? "enabled" : "disabled"}`,
      };
    }),

  /**
   * Delete a category (blocked if subcategories exist)
   * REST: DELETE /api/categories/{id}
   */
  delete: adminProcedure
    .route({
      method: "DELETE",
      path: "/categories/{id}",
      tags: ["Admin Categories"],
      summary: "Delete category",
      description:
        "Delete a category (admin only). Blocked if subcategories exist.",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.category.findFirst({
        where: (c, { eq }) => eq(c.id, input.id),
        with: { subCategory: true },
      });

      if (!existing) {
        throw new ORPCError("NOT_FOUND", { message: "Category not found" });
      }

      if (existing.subCategory.length > 0) {
        throw new ORPCError("CONFLICT", {
          message: `Cannot delete "${existing.name}" because it has ${existing.subCategory.length} subcategories. Remove all subcategories first.`,
        });
      }

      const [linkedProduct, linkedCoreIdentity, linkedVariant] =
        await Promise.all([
          db.query.product.findFirst({
            where: eq(product.categoryId, input.id),
            columns: { id: true },
          }),
          db.query.coreProductIdentity.findFirst({
            where: eq(coreProductIdentity.categoryId, input.id),
            columns: { id: true },
          }),
          db.query.variantOption.findFirst({
            where: eq(variantOption.categoryId, input.id),
            columns: { id: true },
          }),
        ]);
      if (linkedProduct || linkedCoreIdentity || linkedVariant) {
        throw new ORPCError("CONFLICT", {
          message: `Cannot delete "${existing.name}" because Core Identities, products, or Variants still reference it. Disable the category instead.`,
        });
      }

      await db.delete(category).where(eq(category.id, input.id));

      return { message: "Category deleted successfully" };
    }),
};
