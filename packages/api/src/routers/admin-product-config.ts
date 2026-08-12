import { db } from "@bikalpo-project/db";
import {
  shouldDeactivateOmittedBrands,
  validateBrandCreationSubmission,
} from "@bikalpo-project/db/brand-creation";
import {
  type AdminProductGenerationTemplateDetails,
  adminProductGenerationTemplate,
  brand as brandTable,
  coreProductIdentity,
  product,
  productBrand,
  productImage,
  productVariant,
  subCategory,
  variantOption,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure } from "../index";
import { generateSku } from "./helpers/generate-sku";
import {
  resolveConcreteVariantForConfig,
  syncBrandVariantPrices,
} from "./helpers/sync-generated-variants";

// === Input Schemas ===

const getConfigSchema = z.object({
  coreProductId: z.number().int(),
});

const sharedTemplateDetailsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  videoUrl: z.string().max(500).optional().nullable(),
  image: z.string().min(1),
  additionalImages: z.array(z.string()).max(6).default([]),
  features: z
    .array(
      z.object({
        title: z.string(),
        items: z.array(z.object({ key: z.string(), value: z.string() })),
      }),
    )
    .default([]),
  trackingType: z.enum(["none", "batch", "serial"]).default("none"),
  returnPolicyEnabled: z.boolean().default(true),
  expiryEnabled: z.boolean().default(false),
  damageControlEnabled: z.boolean().default(false),
  stockTrackingEnabled: z.boolean().default(true),
  minimumOrderEnabled: z.boolean().default(true),
  minimumOrderQty: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("1"),
  conversionEnabled: z.boolean().default(false),
  inventoryLooseUnitEnabled: z.boolean().default(false),
  inventoryLooseUnit: z.string().default("kg"),
  isReturnablePack: z.boolean().default(false),
  defaultPackDepositAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .default("0"),
  visibility: z.enum(["public", "private"]).default("public"),
});

const configureSchema = z
  .object({
    coreProductId: z.number().int(),
    expectedVersion: z.number().int().positive().optional().nullable(),
    details: sharedTemplateDetailsSchema,
    brands: z
      .array(
        z.object({
          brandId: z.number().int(),
          variants: z
            .array(
              z.object({
                variantOptionId: z.number().int(),
                consumerPrice: z
                  .string()
                  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid price"),
              }),
            )
            .min(1),
        }),
      )
      .min(1),
  })
  .superRefine((value, context) => {
    value.brands.forEach((brandConfig, brandIndex) => {
      const optionIds = brandConfig.variants.map(
        (variant) => variant.variantOptionId,
      );
      const uniqueOptionIds = new Set(optionIds);
      if (uniqueOptionIds.size !== optionIds.length) {
        context.addIssue({
          code: "custom",
          message: "A brand cannot contain duplicate variant options",
          path: ["brands", brandIndex, "variants"],
        });
      }
    });
  });

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildInitialTemplateDetails(core: {
  name: string;
  slug: string;
  description: string | null;
  image: string;
}): AdminProductGenerationTemplateDetails {
  return {
    name: core.name,
    slug: core.slug,
    description: core.description,
    shortDescription: null,
    videoUrl: null,
    size: "",
    price: "0",
    image: core.image,
    additionalImages: [],
    features: [],
    inStock: true,
    isFeatured: false,
    reorderLevel: 0,
    supplier: null,
    isReturnablePack: false,
    defaultPackDepositAmount: "0",
    allowedPackBrands: [],
    allowedPackSizes: [],
    returnPolicyEnabled: true,
    trackingType: "none",
    expiryEnabled: false,
    damageControlEnabled: false,
    stockTrackingEnabled: true,
    minimumOrderEnabled: true,
    minimumOrderQty: "1",
    conversionEnabled: false,
    inventoryLooseUnitEnabled: false,
    inventoryLooseUnit: "kg",
    visibility: "public",
    scheduledAt: null,
    status: "active",
  };
}

/**
 * Admin product configuration.
 *
 * A core product's "configuration" is derived, not stored: it is the set of
 * admin-owned product rows linked to it (one product per brand, enforced by
 * the product_core_brand_admin_unique partial index). `configure` syncs that
 * set from the desired brand + variant selection; per-product identity fields
 * (name, image, description, …) are never touched here — they belong to the
 * per-product edit flow (product.update).
 */
export const adminProductConfigRouter = {
  /**
   * Get the derived configuration of a core product: every admin product
   * generated from it (including inactive ones, so the editor can offer
   * reactivation) with its brand and variant option selection.
   */
  get: adminProcedure
    .route({
      method: "POST",
      path: "/admin/product-config/get",
      tags: ["Admin Product Config"],
      summary: "Get core product configuration",
      description:
        "Get the per-brand products and variant selections configured for a core product",
    })
    .input(getConfigSchema)
    .handler(async ({ input }) => {
      const core = await db.query.coreProductIdentity.findFirst({
        where: eq(coreProductIdentity.id, input.coreProductId),
        with: {
          category: {
            columns: { id: true, name: true, slug: true, typeId: true },
          },
          subCategory: { columns: { id: true, name: true } },
        },
      });

      if (!core) {
        throw new ORPCError("NOT_FOUND", {
          message: "Core product identity not found",
        });
      }
      if (core.creatorSource !== "admin") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only admin-created core products can be edited here",
        });
      }

      const [template, products] = await Promise.all([
        db.query.adminProductGenerationTemplate.findFirst({
          where: eq(
            adminProductGenerationTemplate.coreProductId,
            input.coreProductId,
          ),
        }),
        db.query.product.findMany({
          where: and(
            eq(product.coreProductId, input.coreProductId),
            eq(product.creatorSource, "admin"),
          ),
          with: {
            brand: {
              columns: { id: true, name: true, slug: true, logo: true },
            },
            variantPrices: {
              with: {
                variantOption: {
                  columns: {
                    id: true,
                    name: true,
                    unit: true,
                    size: true,
                    variantType: true,
                    definitionKind: true,
                    definition: true,
                    needsReview: true,
                    isActive: true,
                  },
                },
              },
              orderBy: (vp, { asc }) => [asc(vp.sortOrder)],
            },
          },
          orderBy: (p, { asc }) => [asc(p.createdAt)],
        }),
      ]);

      const brands = products
        .filter((p) => p.brandId !== null)
        .map((p) => ({
          brandId: p.brandId!,
          brandName: p.brand?.name ?? "Unknown brand",
          brandLogo: p.brand?.logo ?? null,
          productId: p.id,
          productName: p.name,
          productSlug: p.slug,
          productImage: p.image,
          status: p.status,
          product: {
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            shortDescription: p.shortDescription,
            image: p.image,
            features: p.features,
            status: p.status,
            visibility: p.visibility,
            trackingType: p.trackingType,
            expiryEnabled: p.expiryEnabled,
            damageControlEnabled: p.damageControlEnabled,
            stockTrackingEnabled: p.stockTrackingEnabled,
            returnPolicyEnabled: p.returnPolicyEnabled,
            minimumOrderEnabled: p.minimumOrderEnabled,
            minimumOrderQty: p.minimumOrderQty,
            conversionEnabled: p.conversionEnabled,
            inventoryLooseUnitEnabled: p.inventoryLooseUnitEnabled,
            inventoryLooseUnit: p.inventoryLooseUnit,
            isReturnablePack: p.isReturnablePack,
            defaultPackDepositAmount: p.defaultPackDepositAmount,
            updatedAt: p.updatedAt,
          },
          variantOptions: p.variantPrices.map((vp) => ({
            variantOptionId: vp.variantOptionId,
            variantOptionName: vp.variantOption?.name ?? null,
            consumerPrice: vp.consumerPrice,
            isActive: vp.isActive,
            sortOrder: vp.sortOrder,
            definitionKind: vp.variantOption?.definitionKind ?? null,
            definition: vp.variantOption?.definition ?? null,
            needsReview: vp.variantOption?.needsReview ?? true,
            requiresDefinitionReview:
              vp.variantOption?.needsReview === true ||
              vp.variantOption?.definition == null,
          })),
        }));

      return {
        core,
        template: {
          version: template?.version ?? null,
          details: sharedTemplateDetailsSchema.parse(
            template?.details ?? buildInitialTemplateDetails(core),
          ),
        },
        brands,
      };
    }),

  /**
   * Create or sync the per-brand products of a core product from the
   * desired brand + variant option selection.
   */
  configure: adminProcedure
    .route({
      method: "POST",
      path: "/admin/product-config/configure",
      tags: ["Admin Product Config"],
      summary: "Configure core product brands",
      description:
        "Generate/sync one product per selected brand for a core product",
    })
    .input(configureSchema)
    .handler(async ({ context, input }) => {
      const { coreProductId, brands } = input;

      const brandIds = brands.map((b) => b.brandId);
      if (new Set(brandIds).size !== brandIds.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Duplicate brands in configuration",
        });
      }

      const core = await db.query.coreProductIdentity.findFirst({
        where: eq(coreProductIdentity.id, coreProductId),
        with: {
          category: { columns: { id: true, slug: true, typeId: true } },
        },
      });
      if (!core) {
        throw new ORPCError("NOT_FOUND", {
          message: "Core product identity not found",
        });
      }
      if (core.creatorSource !== "admin") {
        throw new ORPCError("BAD_REQUEST", {
          message: "Only admin-created core products can be edited here",
        });
      }

      const submission = validateBrandCreationSubmission(
        core.brandCreationMode,
        brands.length,
      );
      if (!submission.valid) {
        throw new ORPCError("BAD_REQUEST", { message: submission.message });
      }

      const brandRows = await db.query.brand.findMany({
        where: and(
          inArray(brandTable.id, brandIds),
          eq(brandTable.isActive, true),
        ),
      });
      if (brandRows.length !== brandIds.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "One or more brands do not exist",
        });
      }
      const brandMap = new Map(brandRows.map((b) => [b.id, b]));

      const requestedVariantOptionIds = [
        ...new Set(
          brands.flatMap((brandConfig) =>
            brandConfig.variants.map((variant) => variant.variantOptionId),
          ),
        ),
      ];
      const variantOptionRows = await db.query.variantOption.findMany({
        where: inArray(variantOption.id, requestedVariantOptionIds),
      });
      if (variantOptionRows.length !== requestedVariantOptionIds.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "One or more variant options do not exist",
        });
      }

      for (const option of variantOptionRows) {
        resolveConcreteVariantForConfig(option);
      }

      const typeId = core.category?.typeId ?? null;
      const invalidVariant = variantOptionRows.find((option) => {
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

      let subCategorySlug = "xx";
      if (core.subCategoryId) {
        const sub = await db.query.subCategory.findFirst({
          where: eq(subCategory.id, core.subCategoryId),
          columns: { slug: true },
        });
        subCategorySlug = sub?.slug || "xx";
      }

      const result = await db.transaction(async (tx) => {
        const currentTemplate =
          await tx.query.adminProductGenerationTemplate.findFirst({
            where: eq(
              adminProductGenerationTemplate.coreProductId,
              coreProductId,
            ),
          });
        if (
          input.expectedVersion != null &&
          currentTemplate?.version !== input.expectedVersion
        ) {
          throw new ORPCError("CONFLICT", {
            message:
              "This shared template changed in another session. Reload it.",
          });
        }

        const initialTemplateDetails = buildInitialTemplateDetails(core);
        const previousSharedDetails = sharedTemplateDetailsSchema.parse(
          currentTemplate?.details ?? initialTemplateDetails,
        );
        const templateChanged =
          !currentTemplate ||
          JSON.stringify(previousSharedDetails) !==
            JSON.stringify(input.details);
        const effectiveTemplateDetails = {
          ...(currentTemplate?.details ?? initialTemplateDetails),
          ...input.details,
        };
        if (!currentTemplate) {
          await tx.insert(adminProductGenerationTemplate).values({
            coreProductId,
            version: 1,
            details: effectiveTemplateDetails,
            createdById: context.session.user.id,
          });
        } else if (templateChanged) {
          await tx
            .update(adminProductGenerationTemplate)
            .set({
              version: currentTemplate.version + 1,
              details: effectiveTemplateDetails,
              updatedAt: new Date(),
            })
            .where(
              eq(adminProductGenerationTemplate.coreProductId, coreProductId),
            );
        }

        const existingProducts = await tx.query.product.findMany({
          where: and(
            eq(product.coreProductId, coreProductId),
            eq(product.creatorSource, "admin"),
          ),
        });
        const existingByBrand = new Map(
          existingProducts
            .filter((p) => p.brandId !== null)
            .map((p) => [p.brandId!, p]),
        );

        const created: { brandId: number; productId: number }[] = [];
        const updated: { brandId: number; productId: number }[] = [];
        const reactivated: { brandId: number; productId: number }[] = [];
        const deactivated: { brandId: number; productId: number }[] = [];

        for (const brandConfig of brands) {
          const brandRow = brandMap.get(brandConfig.brandId)!;
          const existing = existingByBrand.get(brandConfig.brandId);

          if (existing) {
            // Never touch customized identity fields — only status
            // and the variant selection.
            if (existing.status === "inactive") {
              await tx
                .update(product)
                .set({ status: "active" })
                .where(eq(product.id, existing.id));
              reactivated.push({
                brandId: brandConfig.brandId,
                productId: existing.id,
              });
            } else {
              updated.push({
                brandId: brandConfig.brandId,
                productId: existing.id,
              });
            }

            await syncBrandVariantPrices(tx, {
              productId: existing.id,
              brandId: brandConfig.brandId,
              variants: brandConfig.variants,
              settings: existing,
            });
            continue;
          }

          // === Generate a new per-brand product ===
          const details = effectiveTemplateDetails;
          const name = `${brandRow.name} ${details.name}`;

          const baseSlug =
            slugify(`${brandRow.slug}-${details.slug}`) ||
            `product-${coreProductId}-${brandConfig.brandId}`;
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

          const [countResult] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(product)
            .where(eq(product.categoryId, core.categoryId));
          const sku = generateSku({
            subCategorySlug,
            categorySlug: core.category?.slug || "xx",
            serialNumber: (countResult?.count ?? 0) + 1,
            userId: context.session.user.id,
          });

          const [newProduct] = await tx
            .insert(product)
            .values({
              name,
              slug,
              sku,
              description: details.description ?? null,
              shortDescription: details.shortDescription ?? null,
              videoUrl: details.videoUrl ?? null,
              image: details.image,
              size: details.size,
              price: details.price,
              categoryId: core.categoryId,
              subCategoryId: core.subCategoryId ?? null,
              brandId: brandConfig.brandId,
              coreProductId,
              creatorSource: "admin",
              createdById: context.session.user.id,
              status: details.status,
              visibility: details.visibility,
              scheduledAt: details.scheduledAt
                ? new Date(details.scheduledAt)
                : null,
              inStock: details.inStock,
              isFeatured: details.isFeatured,
              reorderLevel: details.reorderLevel,
              supplier: details.supplier ?? null,
              features: details.features,
              trackingType: details.trackingType,
              returnPolicyEnabled: details.returnPolicyEnabled,
              expiryEnabled: details.expiryEnabled,
              damageControlEnabled: details.damageControlEnabled,
              stockTrackingEnabled: details.stockTrackingEnabled,
              minimumOrderEnabled: details.minimumOrderEnabled,
              minimumOrderQty: details.minimumOrderQty,
              conversionEnabled: details.conversionEnabled,
              inventoryLooseUnitEnabled: details.inventoryLooseUnitEnabled,
              inventoryLooseUnit: details.inventoryLooseUnit,
              isReturnablePack: details.isReturnablePack,
              defaultPackDepositAmount: details.defaultPackDepositAmount,
              allowedPackBrands: details.allowedPackBrands,
              allowedPackSizes: details.allowedPackSizes,
            })
            .returning();

          if (!newProduct) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: `Failed to create product for brand "${brandRow.name}"`,
            });
          }

          await tx.insert(productBrand).values({
            productId: newProduct.id,
            brandId: brandConfig.brandId,
          });

          if (details.additionalImages.length > 0) {
            await tx.insert(productImage).values(
              details.additionalImages.map((imageUrl) => ({
                productId: newProduct.id,
                imageUrl,
              })),
            );
          }

          await syncBrandVariantPrices(tx, {
            productId: newProduct.id,
            brandId: brandConfig.brandId,
            variants: brandConfig.variants,
            settings: newProduct,
          });

          created.push({
            brandId: brandConfig.brandId,
            productId: newProduct.id,
          });
        }

        // Brands removed from the configuration → deactivate their
        // products (order/cart FKs and customizations survive;
        // re-adding the brand reactivates the same row).
        if (shouldDeactivateOmittedBrands(core.brandCreationMode)) {
          const selectedBrandIds = new Set(brandIds);
          for (const [existingBrandId, existing] of existingByBrand) {
            if (
              !selectedBrandIds.has(existingBrandId) &&
              existing.status !== "inactive"
            ) {
              await tx
                .update(product)
                .set({ status: "inactive" })
                .where(eq(product.id, existing.id));
              await tx
                .update(productVariant)
                .set({ isActive: false })
                .where(eq(productVariant.productId, existing.id));
              deactivated.push({
                brandId: existingBrandId,
                productId: existing.id,
              });
            }
          }
        }

        return {
          created,
          updated,
          reactivated,
          deactivated,
          templateVersion: currentTemplate
            ? templateChanged
              ? currentTemplate.version + 1
              : currentTemplate.version
            : 1,
        };
      });

      return {
        message: "Core product configuration saved",
        ...result,
      };
    }),
};
