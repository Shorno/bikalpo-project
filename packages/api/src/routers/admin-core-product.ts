import { db } from "@bikalpo-project/db";
import { BRAND_CREATION_MODES } from "@bikalpo-project/db/brand-creation";
import {
  category,
  coreProductIdentity,
  product,
  productType,
  subCategory,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ilike, isNotNull, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure } from "../index";
import { nextSkuCode } from "./helpers/generate-sku";

// === Input Schemas ===

const createCoreProductSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  image: z.string().min(1),
  categoryId: z.number().int(),
  subCategoryId: z.number().int().optional().nullable(),
  isActive: z.boolean().default(true),
  brandCreationMode: z.enum(BRAND_CREATION_MODES).default("batch"),
});

const updateCoreProductSchema = createCoreProductSchema.extend({
  id: z.number().int(),
  brandCreationMode: z.enum(BRAND_CREATION_MODES).optional(),
});

const listCoreProductsSchema = z.object({
  search: z.string().optional(),
  categoryId: z.number().int().optional(),
  subCategoryId: z.number().int().optional(),
  typeId: z.number().int().optional(),
  status: z.enum(["all", "active", "inactive"]).default("all"),
});

export const adminCoreProductRouter = {
  /**
   * List all core product identities with filters
   */
  getAll: adminProcedure
    .route({
      method: "POST",
      path: "/admin/core-products",
      tags: ["Admin Core Products"],
      summary: "List core products",
      description: "List all core product identities with optional filters",
    })
    .input(listCoreProductsSchema)
    .handler(async ({ input }) => {
      const conditions: SQL[] = [
        eq(coreProductIdentity.creatorSource, "admin"),
      ];

      if (input.search?.trim()) {
        const s = `%${input.search.trim()}%`;
        conditions.push(ilike(coreProductIdentity.name, s));
      }
      if (input.categoryId) {
        conditions.push(eq(coreProductIdentity.categoryId, input.categoryId));
      }
      if (input.subCategoryId) {
        conditions.push(
          eq(coreProductIdentity.subCategoryId, input.subCategoryId),
        );
      }
      if (input.typeId) {
        conditions.push(
          sql`${coreProductIdentity.categoryId} in (select id from category where type_id = ${input.typeId})`,
        );
      }
      if (input.status !== "all") {
        conditions.push(
          eq(coreProductIdentity.isActive, input.status === "active"),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const results = await db.query.coreProductIdentity.findMany({
        where,
        orderBy: [desc(coreProductIdentity.createdAt)],
        with: {
          category: {
            columns: {
              id: true,
              name: true,
              slug: true,
              typeId: true,
              skuCode: true,
            },
            with: {
              type: { columns: { id: true, name: true, skuCode: true } },
            },
          },
          subCategory: {
            columns: { id: true, name: true, skuCode: true },
          },
        },
      });

      // Per-core admin Brand Product counts drive Add/Edit/Manage in the list.
      const configRows = await db
        .select({
          coreProductId: product.coreProductId,
          totalBrandCount: sql<number>`count(*)::int`,
        })
        .from(product)
        .where(
          and(
            eq(product.creatorSource, "admin"),
            isNotNull(product.coreProductId),
          ),
        )
        .groupBy(product.coreProductId);
      const configMap = new Map(
        configRows.map((row) => [row.coreProductId, row]),
      );

      // Compose full hierarchical SKU for each core product
      const coreProducts = results.map((cp) => {
        const typeCode = cp.category?.type?.skuCode || "??";
        const catCode = cp.category?.skuCode || "???";
        const subCatCode = cp.subCategory?.skuCode || "???";
        const coreCode = cp.sku || "???";
        const composedSku = `${typeCode}-${catCode}-${subCatCode}-${coreCode}`;
        const config = configMap.get(cp.id);
        return {
          ...cp,
          composedSku,
          // "Configured" = at least one admin product exists (any status),
          // which is the true source of truth for the listing action.
          hasConfiguration: (config?.totalBrandCount ?? 0) > 0,
          configuredBrandCount: config?.totalBrandCount ?? 0,
        };
      });

      return { coreProducts };
    }),

  /**
   * Get a single core product identity by ID
   */
  getById: adminProcedure
    .route({
      method: "POST",
      path: "/admin/core-products/detail",
      tags: ["Admin Core Products"],
      summary: "Get core product by ID",
      description: "Get full details of a core product identity",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const result = await db.query.coreProductIdentity.findFirst({
        where: eq(coreProductIdentity.id, input.id),
        with: {
          category: {
            columns: { id: true, name: true, slug: true, typeId: true },
            with: {
              type: { columns: { id: true, name: true, skuCode: true } },
            },
          },
          subCategory: {
            columns: { id: true, name: true },
          },
        },
      });

      if (!result) {
        throw new ORPCError("NOT_FOUND", {
          message: "Core product identity not found",
        });
      }

      // "Configured" = at least one admin product exists for this core
      // (any status), matching the Add vs Edit rule used in the list.
      const existingProduct = await db.query.product.findFirst({
        where: and(
          eq(product.coreProductId, result.id),
          eq(product.creatorSource, "admin"),
        ),
        columns: { id: true },
      });

      const configuredProducts = await db.query.product.findMany({
        where: eq(product.coreProductId, result.id),
        columns: {
          id: true,
          name: true,
          status: true,
          creatorSource: true,
          brandId: true,
        },
        with: {
          brand: {
            columns: { id: true, name: true, logo: true, isActive: true },
          },
          variantPrices: {
            columns: { id: true, isActive: true },
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
      });

      const brandMap = new Map<
        number,
        {
          id: number;
          name: string;
          logo: string | null;
          isActive: boolean;
          productCount: number;
        }
      >();
      const variantMap = new Map<
        number,
        {
          id: number;
          name: string;
          unit: string;
          size: string | null;
          variantType: "pack" | "loose";
          skuCode: string | null;
          productCount: number;
        }
      >();

      for (const configuredProduct of configuredProducts) {
        if (configuredProduct.brand) {
          const current = brandMap.get(configuredProduct.brand.id);
          brandMap.set(configuredProduct.brand.id, {
            ...configuredProduct.brand,
            productCount: (current?.productCount ?? 0) + 1,
          });
        }
        for (const price of configuredProduct.variantPrices) {
          const option = price.variantOption;
          const current = variantMap.get(option.id);
          variantMap.set(option.id, {
            ...option,
            productCount: (current?.productCount ?? 0) + 1,
          });
        }
      }

      const configuredBrands = [...brandMap.values()].sort(
        (a, b) =>
          b.productCount - a.productCount || a.name.localeCompare(b.name),
      );
      const variantOptions = [...variantMap.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      return {
        coreProduct: {
          ...result,
          hasConfiguration: Boolean(existingProduct),
          configuredProducts,
          configuredBrands,
          variantOptions,
          packVariantCount: variantOptions.filter(
            (option) => option.variantType === "pack",
          ).length,
          looseVariantCount: variantOptions.filter(
            (option) => option.variantType === "loose",
          ).length,
          topBrand: configuredBrands[0] ?? null,
        },
      };
    }),

  /**
   * Create a new core product identity
   */
  create: adminProcedure
    .route({
      method: "POST",
      path: "/admin/core-products/create",
      tags: ["Admin Core Products"],
      summary: "Create core product",
      description: "Create a new core product identity with brands",
    })
    .input(createCoreProductSchema)
    .handler(async ({ input, context }) => {
      const identityData = input;

      const activeCategory = await db.query.category.findFirst({
        where: and(
          eq(category.id, identityData.categoryId),
          eq(category.isActive, true),
        ),
        columns: { id: true, typeId: true },
      });
      const activeType = activeCategory?.typeId
        ? await db.query.productType.findFirst({
            where: and(
              eq(productType.id, activeCategory.typeId),
              eq(productType.isActive, true),
            ),
            columns: { id: true },
          })
        : null;
      const activeSubCategory = identityData.subCategoryId
        ? await db.query.subCategory.findFirst({
            where: and(
              eq(subCategory.id, identityData.subCategoryId),
              eq(subCategory.categoryId, identityData.categoryId),
              eq(subCategory.isActive, true),
            ),
            columns: { id: true },
          })
        : null;
      if (
        !activeCategory ||
        !activeType ||
        (identityData.subCategoryId && !activeSubCategory)
      ) {
        throw new ORPCError("BAD_REQUEST", {
          message:
            "Core Identities can only be created under an active Type, Category, and Sub Category path.",
        });
      }

      // Check uniqueness for name
      const existingName = await db.query.coreProductIdentity.findFirst({
        where: eq(coreProductIdentity.name, identityData.name),
        columns: { id: true },
      });
      if (existingName) {
        throw new ORPCError("CONFLICT", {
          message: `A core product with name "${identityData.name}" already exists`,
        });
      }

      // Auto-generate 3-digit SKU scoped to subCategoryId (or categoryId if no subCat)
      let sku = identityData.sku;
      if (!sku) {
        const filterCondition = identityData.subCategoryId
          ? sql`${coreProductIdentity.subCategoryId} = ${identityData.subCategoryId}`
          : sql`${coreProductIdentity.categoryId} = ${identityData.categoryId} AND ${coreProductIdentity.subCategoryId} IS NULL`;
        sku = await nextSkuCode(
          coreProductIdentity,
          coreProductIdentity.sku,
          3,
          filterCondition,
        );
      }

      // Check uniqueness for SKU within the same scope
      const scopeCondition = identityData.subCategoryId
        ? and(
            eq(coreProductIdentity.sku, sku),
            eq(coreProductIdentity.subCategoryId, identityData.subCategoryId),
          )
        : and(
            eq(coreProductIdentity.sku, sku),
            eq(coreProductIdentity.categoryId, identityData.categoryId),
          );
      const existingSku = await db.query.coreProductIdentity.findFirst({
        where: scopeCondition,
        columns: { id: true },
      });
      if (existingSku) {
        throw new ORPCError("CONFLICT", {
          message: `A core product with SKU "${sku}" already exists in this category`,
        });
      }

      // Create identity
      const [created] = await db
        .insert(coreProductIdentity)
        .values({
          ...identityData,
          sku,
          subCategoryId: identityData.subCategoryId || null,
          createdById: context.session.user.id,
          creatorSource: "admin",
        })
        .returning();

      if (!created) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to create core product identity",
        });
      }

      return { message: "Core product created successfully", id: created.id };
    }),

  /**
   * Update a core product identity
   */
  update: adminProcedure
    .route({
      method: "PUT",
      path: "/admin/core-products/update",
      tags: ["Admin Core Products"],
      summary: "Update core product",
      description: "Update core product identity and brands",
    })
    .input(updateCoreProductSchema)
    .handler(async ({ input }) => {
      const { id, brandCreationMode, ...updateData } = input;

      // Check existence
      const existing = await db.query.coreProductIdentity.findFirst({
        where: eq(coreProductIdentity.id, id),
        columns: { id: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Core product identity not found",
        });
      }

      // Check uniqueness for name (exclude self)
      const existingName = await db.query.coreProductIdentity.findFirst({
        where: and(
          eq(coreProductIdentity.name, updateData.name),
          sql`${coreProductIdentity.id} != ${id}`,
        ),
        columns: { id: true },
      });
      if (existingName) {
        throw new ORPCError("CONFLICT", {
          message: `A core product with name "${updateData.name}" already exists`,
        });
      }

      // Update identity
      await db
        .update(coreProductIdentity)
        .set({
          ...updateData,
          ...(brandCreationMode ? { brandCreationMode } : {}),
          subCategoryId: updateData.subCategoryId || null,
        })
        .where(eq(coreProductIdentity.id, id));

      return { message: "Core product updated successfully" };
    }),

  toggleActive: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.coreProductIdentity.findFirst({
        where: eq(coreProductIdentity.id, input.id),
        columns: { id: true, name: true, isActive: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Core Identity not found",
        });
      }
      const [updated] = await db
        .update(coreProductIdentity)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(coreProductIdentity.id, input.id))
        .returning({ isActive: coreProductIdentity.isActive });
      return {
        isActive: updated!.isActive,
        message: `${existing.name} ${updated!.isActive ? "enabled" : "disabled"}`,
      };
    }),

  /**
   * Delete a core product identity
   */
  delete: adminProcedure
    .route({
      method: "DELETE",
      path: "/admin/core-products/delete",
      tags: ["Admin Core Products"],
      summary: "Delete core product",
      description: "Delete an unused core product identity",
    })
    .input(z.object({ id: z.number().int() }))
    .handler(async ({ input }) => {
      const existing = await db.query.coreProductIdentity.findFirst({
        where: eq(coreProductIdentity.id, input.id),
        columns: { id: true },
      });
      if (!existing) {
        throw new ORPCError("NOT_FOUND", {
          message: "Core product identity not found",
        });
      }

      const linkedProduct = await db.query.product.findFirst({
        where: eq(product.coreProductId, input.id),
        columns: { id: true },
      });
      if (linkedProduct) {
        throw new ORPCError("CONFLICT", {
          message:
            "This core product cannot be deleted because products have already been created from it. Keep the core identity and deactivate unwanted brand products instead.",
        });
      }

      try {
        await db
          .delete(coreProductIdentity)
          .where(eq(coreProductIdentity.id, input.id));
      } catch (error) {
        const databaseError = error as {
          cause?: { code?: string };
          code?: string;
        };
        if (
          databaseError.code === "23503" ||
          databaseError.cause?.code === "23503"
        ) {
          throw new ORPCError("CONFLICT", {
            message: "This core product is still in use and cannot be deleted.",
          });
        }
        throw error;
      }

      return { message: "Core product deleted successfully" };
    }),
};
