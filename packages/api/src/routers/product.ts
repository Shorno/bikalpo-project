import { db, FULFILLMENT_UNIT_CODES } from "@bikalpo-project/db";
import { validateBrandCreationSubmission } from "@bikalpo-project/db/brand-creation";
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
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  consumerPriceListPagedSchema,
  consumerPriceListParamsSchema,
  importConsumerReferencePricesSchema,
  updateConsumerReferencePriceSchema,
} from "../consumer-price";
import { adminProcedure, publicProcedure } from "../index";
import {
  fetchConsumerReferencePriceData,
  fetchConsumerReferencePricePage,
  saveConsumerReferencePrices,
} from "../services/consumer-reference-prices";
import { generateSku, nextSkuCode } from "./helpers/generate-sku";
import {
  applyGeneratedVariantExchangeSettings,
  attachExchangeSettingsToVariantPrices,
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
  newCoreProductName: z.string().trim().min(1).max(150).optional(),
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
        exchangeEnabled: z.boolean().optional().default(false),
        exchangeCreditAmount: z
          .string()
          .regex(/^\d+(\.\d{1,2})?$/)
          .optional()
          .default("0"),
      }),
    )
    .optional(),
});

const updateProductSchema = createProductSchema
  .omit({ newCoreProductName: true })
  .extend({
    id: z.number(),
  });

function slugifyCoreProductName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
          category: {
            with: { type: true },
          },
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
              sku: true,
              catalogVariantId: true,
              price: true,
              variantType: true,
              brandId: true,
              unitLabel: true,
              sellUnit: true,
              packType: true,
              weightKg: true,
              color: true,
              size: true,
              isActive: true,
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
          variants: {
            columns: {
              id: true,
              unitLabel: true,
              variantType: true,
              brandId: true,
              exchangeCreditAmount: true,
              exchangeEnabled: true,
              sourceVariantOptionId: true,
            },
          },
        },
      });

      if (!foundProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      return { product: attachExchangeSettingsToVariantPrices(foundProduct) };
    }),

  /**
   * Admin Brand Product creation from a reusable Core Product Identity.
   * One submission stores shared defaults and creates one independent product
   * per selected brand.
   */
  create: adminProcedure
    .route({
      method: "POST",
      path: "/products",
      tags: ["Product Management"],
      summary: "Create per-brand products",
      description:
        "Create brand products from a reusable admin core product identity",
    })
    .input(createProductSchema)
    .handler(async ({ context, input }) => {
      const {
        additionalImages = [],
        variantPrices = [],
        brandIds = [],
        ...productData
      } = input;
      const requestedCoreProductId = productData.coreProductId;
      const newCoreProductName = productData.newCoreProductName?.trim();

      if (!requestedCoreProductId && !newCoreProductName) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Select or enter a core product identity",
        });
      }
      if (requestedCoreProductId && newCoreProductName) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an existing core identity or create a new one",
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
        let coreProductId = requestedCoreProductId;

        if (!coreProductId && newCoreProductName) {
          const coreSlug = slugifyCoreProductName(newCoreProductName);
          if (!coreSlug) {
            throw new ORPCError("BAD_REQUEST", {
              message: "Enter a core identity name with letters or numbers",
            });
          }

          const activeCategory = await tx.query.category.findFirst({
            where: and(
              eq(categoryTable.id, productData.categoryId),
              eq(categoryTable.isActive, true),
            ),
            columns: { id: true, typeId: true },
          });
          const activeType = activeCategory?.typeId
            ? await tx.query.productType.findFirst({
                where: and(
                  eq(productType.id, activeCategory.typeId),
                  eq(productType.isActive, true),
                ),
                columns: { id: true },
              })
            : null;
          const activeSubCategory = productData.subCategoryId
            ? await tx.query.subCategory.findFirst({
                where: and(
                  eq(subCategory.id, productData.subCategoryId),
                  eq(subCategory.categoryId, productData.categoryId),
                  eq(subCategory.isActive, true),
                ),
                columns: { id: true },
              })
            : null;
          if (
            !activeCategory ||
            !activeType ||
            (productData.subCategoryId && !activeSubCategory)
          ) {
            throw new ORPCError("BAD_REQUEST", {
              message:
                "Core identities require an active Type, Category, and Sub Category path",
            });
          }

          const duplicateCore = await tx.query.coreProductIdentity.findFirst({
            where: or(
              eq(coreProductIdentity.name, newCoreProductName),
              eq(coreProductIdentity.slug, coreSlug),
            ),
            columns: { id: true },
          });
          if (duplicateCore) {
            throw new ORPCError("CONFLICT", {
              message:
                "That core identity already exists. Select it from the search results instead.",
            });
          }

          const coreSkuScope = productData.subCategoryId
            ? sql`${coreProductIdentity.subCategoryId} = ${productData.subCategoryId}`
            : sql`${coreProductIdentity.categoryId} = ${productData.categoryId} AND ${coreProductIdentity.subCategoryId} IS NULL`;
          const coreSku = await nextSkuCode(
            coreProductIdentity,
            coreProductIdentity.sku,
            3,
            coreSkuScope,
            tx,
          );
          const [createdCore] = await tx
            .insert(coreProductIdentity)
            .values({
              sku: coreSku,
              name: newCoreProductName,
              slug: coreSlug,
              description: productData.description ?? null,
              image: productData.image,
              categoryId: productData.categoryId,
              subCategoryId: productData.subCategoryId ?? null,
              createdById: context.session.user.id,
              creatorSource: "admin",
              isActive: true,
              brandCreationMode: "batch",
            })
            .returning({ id: coreProductIdentity.id });
          if (!createdCore) {
            throw new ORPCError("INTERNAL_SERVER_ERROR", {
              message: "Could not create the core product identity",
            });
          }
          coreProductId = createdCore.id;
        }

        if (!coreProductId) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Select or enter a core product identity",
          });
        }

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
        const submission = validateBrandCreationSubmission(
          core.brandCreationMode,
          brandIds.length,
        );
        if (!submission.valid) {
          throw new ORPCError("BAD_REQUEST", { message: submission.message });
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

        const existingBrandProducts = await tx.query.product.findMany({
          where: and(
            eq(product.coreProductId, coreProductId),
            eq(product.creatorSource, "admin"),
            inArray(product.brandId, brandIds),
          ),
          columns: { brandId: true },
        });
        if (existingBrandProducts.length > 0) {
          const duplicateBrandNames = existingBrandProducts
            .map((existing) =>
              existing.brandId
                ? brandMap.get(existing.brandId)?.name
                : undefined,
            )
            .filter((name): name is string => Boolean(name));
          throw new ORPCError("CONFLICT", {
            message: `A product already exists for ${duplicateBrandNames.join(", ")} under this core identity. Choose another brand or edit the existing product.`,
          });
        }

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
          conversionEnabled: productData.conversionEnabled,
          inventoryLooseUnitEnabled: productData.inventoryLooseUnitEnabled,
          inventoryLooseUnit: productData.inventoryLooseUnit,
          visibility: productData.visibility,
          scheduledAt: productData.scheduledAt ?? null,
          status: productData.status,
        } satisfies AdminProductGenerationTemplateDetails;

        // Keep the reusable admin preset current for future Brand Products.
        // Existing Brand Products remain independent and are not rewritten.
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
          await applyGeneratedVariantExchangeSettings(
            tx,
            newProduct.id,
            variantsByBrand.get(brandId)!,
          );
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
        existing.coreProductId !== null && existing.creatorSource === "admin";
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
        await applyGeneratedVariantExchangeSettings(db, id, variantPrices);
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
        await applyGeneratedVariantExchangeSettings(db, id, variantPrices);
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
          variants: {
            columns: {
              id: true,
              unitLabel: true,
              variantType: true,
              brandId: true,
              exchangeCreditAmount: true,
              exchangeEnabled: true,
              sourceVariantOptionId: true,
            },
          },
        },
      });

      if (!foundProduct) {
        throw new ORPCError("NOT_FOUND", { message: "Product not found" });
      }

      return { product: attachExchangeSettingsToVariantPrices(foundProduct) };
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
    .handler(async ({ input, context }) =>
      saveConsumerReferencePrices([input], context.session.user, "inline"),
    ),

  importConsumerReferencePrices: adminProcedure
    .route({
      method: "POST",
      path: "/products/consumer-reference-prices/import",
      tags: ["Product Management"],
      summary: "Import validated Excel price rows atomically",
    })
    .input(importConsumerReferencePricesSchema)
    .handler(async ({ input, context }) =>
      saveConsumerReferencePrices(input.rows, context.session.user, "excel"),
    ),

  exportConsumerReferencePrices: adminProcedure
    .route({
      method: "POST",
      path: "/products/consumer-reference-prices/export",
      tags: ["Product Management"],
      summary: "Export all matching prices for an Excel workbook",
    })
    .input(consumerPriceListParamsSchema)
    .handler(async ({ input }) => fetchConsumerReferencePriceData(input)),

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
        "ExchangePriceBDT",
        "UpdatedAt",
        "UpdatedBy",
        "VariantPriceId",
      ];
      const escapeCsv = (v: string) =>
        `"${(/^[=+@\-\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
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
            i.exchangePrice ?? "",
            i.updatedAt ? i.updatedAt.toISOString() : "",
            i.updatedByName ?? "",
            String(i.variantPriceId),
          ]
            .map((c) => escapeCsv(String(c)))
            .join(","),
        ),
      ];
      return { csv: lines.join("\n") };
    }),
};
