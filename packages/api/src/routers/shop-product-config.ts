import { db } from "@bikalpo-project/db";
import {
  shouldDeactivateOmittedBrands,
  validateBrandCreationSubmission,
} from "@bikalpo-project/db/brand-creation";
import { shouldEnableWarehouseCylinderExchange } from "@bikalpo-project/db/fulfillment";
import {
  adminProductGenerationTemplate,
  brand,
  coreProductIdentity,
  inventory,
  product,
  productBrand,
  productImage,
  productVariant,
  productVariantPrice,
  shopProductGenerationTemplate,
  variantOption,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { shopModuleProcedure } from "../index";
import { shopTenantId } from "../shop-portal-scope";
import { recalculateOffersForShopProduct } from "../services/open-order-matching";
import {
  isConcreteVariantOption,
  linkProductVariantsToCatalog,
  resolveConcreteVariantForConfig,
} from "./helpers/sync-generated-variants";
import { syncWarehouseCylinderExchange } from "./helpers/warehouse-cylinder-exchange";

const configuredVariantSchema = z.object({
  variantOptionId: z.number().int().positive(),
  exchangeEnabled: z.boolean().default(false),
  exchangeCreditAmount: z.coerce
    .number()
    .finite()
    .min(0)
    .max(99_999_999)
    .default(0)
    .transform((value) => value.toFixed(2)),
});

const templateDetailsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  videoUrl: z.string().max(500).optional().nullable(),
  image: z.string().min(1),
  additionalImages: z.array(z.string()).default([]),
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
  minimumOrderQty: z.string().default("1"),
  conversionEnabled: z.boolean().default(false),
  inventoryLooseUnitEnabled: z.boolean().default(false),
  inventoryLooseUnit: z.string().default("kg"),
  isReturnablePack: z.boolean().default(false),
  defaultPackDepositAmount: z.string().default("0"),
  allowedPackBrands: z.array(z.string()).default([]),
  allowedPackSizes: z.array(z.string()).default([]),
  visibility: z.enum(["public", "private"]).default("private"),
});

const configureSchema = z.object({
  coreProductId: z.number().int().positive(),
  expectedVersion: z.number().int().positive().optional().nullable(),
  details: templateDetailsSchema,
  brands: z
    .array(
      z.object({
        brandId: z.number().int().positive(),
        variants: z.array(configuredVariantSchema).min(1),
      }),
    )
    .min(1),
});

const updateSchema = z.object({
  productId: z.number().int().positive(),
  details: templateDetailsSchema.extend({
    status: z.enum(["active", "draft", "inactive"]),
  }),
  variants: z.array(configuredVariantSchema).min(1),
});

type TemplateDetails = z.infer<typeof templateDetailsSchema>;

function fullTemplateDetails(
  core: { name: string; slug: string },
  details: TemplateDetails,
) {
  return {
    name: details.name,
    slug: core.slug,
    description: details.description ?? null,
    shortDescription: details.shortDescription ?? null,
    videoUrl: details.videoUrl ?? null,
    size: "—",
    price: "0",
    image: details.image,
    additionalImages: details.additionalImages,
    features: details.features,
    inStock: false,
    isFeatured: false,
    reorderLevel: 0,
    supplier: null,
    isReturnablePack: details.isReturnablePack,
    defaultPackDepositAmount: details.defaultPackDepositAmount,
    allowedPackBrands: details.allowedPackBrands,
    allowedPackSizes: details.allowedPackSizes,
    returnPolicyEnabled: details.returnPolicyEnabled,
    trackingType: details.trackingType,
    expiryEnabled: details.expiryEnabled,
    damageControlEnabled: details.damageControlEnabled,
    stockTrackingEnabled: details.stockTrackingEnabled,
    minimumOrderEnabled: details.minimumOrderEnabled,
    minimumOrderQty: details.minimumOrderQty,
    conversionEnabled: details.conversionEnabled,
    inventoryLooseUnitEnabled: details.inventoryLooseUnitEnabled,
    inventoryLooseUnit: details.inventoryLooseUnit,
    visibility: details.visibility,
    scheduledAt: null,
    status: "draft" as const,
  };
}

function optionIsValid(
  option: {
    isActive: boolean;
    typeId: number | null;
    categoryId: number | null;
  },
  typeId: number | null,
  categoryId: number,
) {
  return (
    option.isActive &&
    ((option.typeId === null && option.categoryId === null) ||
      (option.typeId === typeId && option.categoryId === null) ||
      (option.typeId === typeId && option.categoryId === categoryId))
  );
}

async function assertNoShopStock(
  tx: any,
  shopId: string,
  variantIds: number[],
  label: string,
) {
  if (variantIds.length === 0) return;
  const [live] = await tx
    .select({ count: count() })
    .from(inventory)
    .where(
      and(
        eq(inventory.ownerType, "shop"),
        eq(inventory.ownerId, shopId),
        inArray(inventory.variantId, variantIds),
        sql`(${inventory.availableQty}::numeric > 0 OR ${inventory.reservedQty}::numeric > 0)`,
      ),
    );
  if (Number(live?.count ?? 0) > 0) {
    throw new ORPCError("CONFLICT", {
      message: `${label} still has available or reserved stock. Resolve stock before removing it.`,
    });
  }
}

async function loadScopedOptions(
  tx: any,
  optionIds: number[],
  typeId: number | null,
  categoryId: number,
): Promise<Map<number, any>> {
  const rows = optionIds.length
    ? await tx.query.variantOption.findMany({
        where: inArray(variantOption.id, optionIds),
      })
    : [];
  if (rows.length !== optionIds.length) {
    throw new ORPCError("BAD_REQUEST", {
      message: "One or more selected variants are invalid",
    });
  }
  for (const option of rows) {
    if (!optionIsValid(option, typeId, categoryId)) {
      throw new ORPCError("BAD_REQUEST", {
        message: `Variant "${option.name}" is not available for this core product`,
      });
    }
    resolveConcreteVariantForConfig(option);
  }
  return new Map<number, any>(
    rows.map((row: any): [number, any] => [row.id, row]),
  );
}

async function syncProductVariants({
  tx,
  shopId,
  targetProduct,
  brandId,
  desiredVariants,
  optionMap,
  details,
}: {
  tx: any;
  shopId: string;
  targetProduct: any;
  brandId: number;
  desiredVariants: Array<z.infer<typeof configuredVariantSchema>>;
  optionMap: Map<number, any>;
  details: TemplateDetails;
}) {
  const desiredOptionIds = desiredVariants.map((row) => row.variantOptionId);
  const configurationByOption = new Map(
    desiredVariants.map((row) => [row.variantOptionId, row]),
  );
  const existingVariants = targetProduct.variants ?? [];
  const existingByOption = new Map(
    existingVariants
      .filter((row: any) => row.sourceVariantOptionId !== null)
      .map((row: any) => [row.sourceVariantOptionId, row]),
  );
  const desiredSet = new Set(desiredOptionIds);
  const removed = existingVariants.filter(
    (row: any) =>
      row.sourceVariantOptionId !== null &&
      !desiredSet.has(row.sourceVariantOptionId),
  );
  await assertNoShopStock(
    tx,
    shopId,
    removed.map((row: any) => row.id),
    targetProduct.name,
  );
  if (removed.length > 0) {
    const removedIds = removed.map((row: any) => row.id);
    await tx
      .update(productVariant)
      .set({ isActive: false })
      .where(inArray(productVariant.id, removedIds));
    await tx
      .update(productVariantPrice)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(productVariantPrice.productId, targetProduct.id),
          inArray(
            productVariantPrice.variantOptionId,
            removed.map((row: any) => row.sourceVariantOptionId),
          ),
        ),
      );
  }

  for (const [sortOrder, optionId] of desiredOptionIds.entries()) {
    const option = optionMap.get(optionId)!;
    const resolved = resolveConcreteVariantForConfig(option);
    const cylinderSale = configurationByOption.get(optionId)!;
    const label = resolved.label;
    const existing = existingByOption.get(optionId) as any;
    if (existing) {
      await tx
        .update(productVariant)
        .set({
          isActive: true,
          unitLabel: label,
          quantitySelectorLabel: label,
          packagingType: resolved.packagingType,
          weightKg: resolved.weightKg,
          orderUnit: resolved.orderUnit,
          packType: resolved.packType,
          packWeightKg: resolved.weightKg || null,
          sellUnit: label,
          sortOrder,
          exchangeEnabled: cylinderSale.exchangeEnabled,
          exchangeCreditAmount: cylinderSale.exchangeEnabled
            ? cylinderSale.exchangeCreditAmount
            : "0.00",
        })
        .where(eq(productVariant.id, existing.id));
      const existingPrice = await tx.query.productVariantPrice.findFirst({
        where: and(
          eq(productVariantPrice.productId, targetProduct.id),
          eq(productVariantPrice.variantOptionId, optionId),
          eq(productVariantPrice.brandId, brandId),
        ),
      });
      if (existingPrice) {
        await tx
          .update(productVariantPrice)
          .set({ isActive: true, sortOrder, updatedAt: new Date() })
          .where(eq(productVariantPrice.id, existingPrice.id));
      } else {
        await tx.insert(productVariantPrice).values({
          productId: targetProduct.id,
          variantOptionId: optionId,
          brandId,
          consumerPrice: "0",
          sortOrder,
        });
      }
      await tx
        .insert(inventory)
        .values({
          ownerType: "shop",
          ownerId: shopId,
          variantId: existing.id,
          availableQty: "0",
          retailPrice: null,
        })
        .onConflictDoNothing({
          target: [inventory.ownerType, inventory.ownerId, inventory.variantId],
        });
      continue;
    }

    const [priceRow] = await tx
      .insert(productVariantPrice)
      .values({
        productId: targetProduct.id,
        variantOptionId: optionId,
        brandId,
        consumerPrice: "0",
        sortOrder,
      })
      .returning();
    const [variantRow] = await tx
      .insert(productVariant)
      .values({
        productId: targetProduct.id,
        brandId,
        size: option.size ?? null,
        sku: `SHOP-${targetProduct.id}-B${brandId}-VO${option.id}-${sortOrder}`,
        unitLabel: label,
        quantitySelectorLabel: label,
        packagingType: resolved.packagingType,
        weightKg: resolved.weightKg,
        price: "0",
        orderMin: details.minimumOrderEnabled ? details.minimumOrderQty : "1",
        orderUnit: resolved.orderUnit,
        packType: resolved.packType,
        packWeightKg: resolved.weightKg || null,
        sellUnit: label,
        variantType: "retail",
        orderType: "b2c",
        visibilityRole: "consumer",
        stockSource: "shop",
        sourceVariantPriceId: priceRow!.id,
        sourceVariantOptionId: option.id,
        stockQuantity: 0,
        reorderLevel: 0,
        sortOrder,
        isActive: true,
        exchangeEnabled: cylinderSale.exchangeEnabled,
        exchangeCreditAmount: cylinderSale.exchangeEnabled
          ? cylinderSale.exchangeCreditAmount
          : "0.00",
      })
      .returning();
    await tx.insert(inventory).values({
      ownerType: "shop",
      ownerId: shopId,
      variantId: variantRow!.id,
      availableQty: "0",
      retailPrice: null,
    });
  }

  await linkProductVariantsToCatalog(tx, targetProduct.id);
}

export const shopProductConfigEndpoints = {
  getShopCoreConfiguration: shopModuleProcedure("inventory")
    .input(z.object({ coreProductId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      const core = await db.query.coreProductIdentity.findFirst({
        where: and(
          eq(coreProductIdentity.id, input.coreProductId),
          eq(coreProductIdentity.creatorSource, "admin"),
        ),
        with: {
          category: { with: { type: true } },
          subCategory: true,
        },
      });
      if (!core) {
        throw new ORPCError("NOT_FOUND", {
          message: "Admin core product identity not found",
        });
      }

      const [adminTemplate, shopTemplate, adminProducts, currentProducts] =
        await Promise.all([
          db.query.adminProductGenerationTemplate.findFirst({
            where: eq(adminProductGenerationTemplate.coreProductId, core.id),
          }),
          db.query.shopProductGenerationTemplate.findFirst({
            where: and(
              eq(shopProductGenerationTemplate.coreProductId, core.id),
              eq(shopProductGenerationTemplate.shopId, shopId),
            ),
          }),
          db.query.product.findMany({
            where: and(
              eq(product.coreProductId, core.id),
              eq(product.creatorSource, "admin"),
              eq(product.status, "active"),
            ),
            with: {
              brand: true,
              variantPrices: {
                where: eq(productVariantPrice.isActive, true),
                with: { variantOption: true },
              },
            },
          }),
          db.query.product.findMany({
            where: and(
              eq(product.coreProductId, core.id),
              eq(product.creatorSource, "shop"),
              eq(product.createdById, shopId),
            ),
            with: {
              brand: true,
              variants: { with: { sourceVariantOption: true } },
            },
          }),
        ]);

      const [brands, allVariantOptions] = await Promise.all([
        db.query.brand.findMany({ orderBy: [brand.name] }),
        db.query.variantOption.findMany({
          where: eq(variantOption.isActive, true),
          orderBy: [variantOption.sortOrder, variantOption.name],
        }),
      ]);
      const typeId = core.category?.typeId ?? null;
      const variantOptions = allVariantOptions.filter(
        (option) =>
          optionIsValid(option, typeId, core.categoryId) &&
          isConcreteVariantOption(option),
      );

      return {
        core,
        version: shopTemplate?.version ?? null,
        sourceAdminTemplateVersion:
          shopTemplate?.sourceAdminTemplateVersion ??
          adminTemplate?.version ??
          null,
        defaults: shopTemplate?.details ??
          adminTemplate?.details ?? {
            name: core.name,
            slug: core.slug,
            image: core.image,
            additionalImages: [],
            features: [],
          },
        adminDefaults: adminTemplate?.details ?? null,
        adminPreset: {
          available: adminProducts.length > 0,
          templateVersion: adminTemplate?.version ?? null,
          brands: adminProducts
            .filter((row) => row.brandId !== null)
            .map((row) => ({
              brandId: row.brandId!,
              brandName: row.brand?.name ?? "Unknown brand",
              sourceProductId: row.id,
              variants: row.variantPrices.map((price) => ({
                variantOptionId: price.variantOptionId,
                variantOptionName: price.variantOption?.name ?? null,
                definitionKind: price.variantOption?.definitionKind ?? null,
                definition: price.variantOption?.definition ?? null,
                needsReview: price.variantOption?.needsReview ?? true,
              })),
            })),
        },
        current: currentProducts.map((row) => ({
          productId: row.id,
          productName: row.name,
          productSlug: row.slug,
          productImage: row.image,
          brandId: row.brandId,
          brandName: row.brand?.name ?? null,
          status: row.status,
          variants: row.variants
            .filter((variant) => variant.sourceVariantOptionId !== null)
            .map((variant) => ({
              variantId: variant.id,
              variantOptionId: variant.sourceVariantOptionId!,
              variantOptionName: variant.sourceVariantOption?.name ?? null,
              isActive: variant.isActive,
              definitionKind:
                variant.sourceVariantOption?.definitionKind ?? null,
              definition: variant.sourceVariantOption?.definition ?? null,
              needsReview: variant.sourceVariantOption?.needsReview ?? true,
              exchangeEnabled: variant.exchangeEnabled,
              exchangeCreditAmount: variant.exchangeCreditAmount,
            })),
        })),
        options: { brands, variantOptions },
      };
    }),

  configureShopCoreProducts: shopModuleProcedure("inventory")
    .input(configureSchema)
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      const brandIds = input.brands.map((row) => row.brandId);
      if (new Set(brandIds).size !== brandIds.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "A brand can only be selected once",
        });
      }
      for (const row of input.brands) {
        const ids = row.variants.map((variant) => variant.variantOptionId);
        if (new Set(ids).size !== ids.length) {
          throw new ORPCError("BAD_REQUEST", {
            message: "A variant can only be selected once per brand",
          });
        }
      }

      const result = await db.transaction(async (tx) => {
        const core = await tx.query.coreProductIdentity.findFirst({
          where: and(
            eq(coreProductIdentity.id, input.coreProductId),
            eq(coreProductIdentity.creatorSource, "admin"),
          ),
          with: { category: { with: { type: true } }, subCategory: true },
        });
        if (!core) {
          throw new ORPCError("NOT_FOUND", {
            message: "Admin core product identity not found",
          });
        }
        const submission = validateBrandCreationSubmission(
          core.brandCreationMode,
          input.brands.length,
        );
        if (!submission.valid) {
          throw new ORPCError("BAD_REQUEST", { message: submission.message });
        }
        const requestedExchangeVariants = input.brands.flatMap((row) =>
          row.variants.filter((variant) => variant.exchangeEnabled),
        );
        if (
          core.category?.type?.family !== "lpg" &&
          requestedExchangeVariants.length > 0
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Empty cylinder exchange is only available for LPG products",
          });
        }
        const existingTemplate =
          await tx.query.shopProductGenerationTemplate.findFirst({
            where: and(
              eq(shopProductGenerationTemplate.coreProductId, core.id),
              eq(shopProductGenerationTemplate.shopId, shopId),
            ),
          });
        if (
          input.expectedVersion != null &&
          existingTemplate?.version !== input.expectedVersion
        ) {
          throw new ORPCError("CONFLICT", {
            message:
              "This configuration changed in another session. Reload it.",
          });
        }

        const brandRows = await tx.query.brand.findMany({
          where: and(inArray(brand.id, brandIds), eq(brand.isActive, true)),
        });
        if (brandRows.length !== brandIds.length) {
          throw new ORPCError("BAD_REQUEST", {
            message: "One or more selected brands are not approved",
          });
        }
        const brandMap = new Map(brandRows.map((row) => [row.id, row]));
        const optionIds = [
          ...new Set(
            input.brands.flatMap((row) =>
              row.variants.map((variant) => variant.variantOptionId),
            ),
          ),
        ];
        const optionMap = await loadScopedOptions(
          tx,
          optionIds,
          core.category?.typeId ?? null,
          core.categoryId,
        );
        const adminProducts = await tx.query.product.findMany({
          where: and(
            eq(product.coreProductId, core.id),
            eq(product.creatorSource, "admin"),
          ),
        });
        const existingProducts = await tx.query.product.findMany({
          where: and(
            eq(product.coreProductId, core.id),
            eq(product.creatorSource, "shop"),
            eq(product.createdById, shopId),
          ),
          with: { variants: true },
        });
        const adminTemplate =
          await tx.query.adminProductGenerationTemplate.findFirst({
            where: eq(adminProductGenerationTemplate.coreProductId, core.id),
          });
        const adminByBrand = new Map(
          adminProducts
            .filter((row) => row.brandId !== null)
            .map((row) => [row.brandId!, row]),
        );
        const existingByBrand = new Map(
          existingProducts
            .filter((row) => row.brandId !== null)
            .map((row) => [row.brandId!, row]),
        );
        const template = fullTemplateDetails(core, input.details);
        const created: number[] = [];
        const updated: number[] = [];
        const deactivated: number[] = [];

        for (const brandConfig of input.brands) {
          const brandRow = brandMap.get(brandConfig.brandId)!;
          let targetProduct = existingByBrand.get(brandRow.id) as any;
          if (!targetProduct) {
            const baseSlug =
              `${brandRow.slug}-${core.slug}-${shopId.slice(0, 6)}`
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "")
                .slice(0, 140);
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
            const [inserted] = await tx
              .insert(product)
              .values({
                name: `${brandRow.name} ${input.details.name}`
                  .trim()
                  .slice(0, 150),
                slug,
                description: input.details.description ?? null,
                shortDescription: input.details.shortDescription ?? null,
                videoUrl: input.details.videoUrl ?? null,
                categoryId: core.categoryId,
                subCategoryId: core.subCategoryId,
                brandId: brandRow.id,
                coreProductId: core.id,
                size: "—",
                price: "0",
                sku: `SHOP-${shopId.slice(0, 6)}-${core.id}-${brandRow.id}`,
                image: input.details.image,
                features: input.details.features,
                trackingType: input.details.trackingType,
                returnPolicyEnabled: input.details.returnPolicyEnabled,
                expiryEnabled: input.details.expiryEnabled,
                damageControlEnabled: input.details.damageControlEnabled,
                stockTrackingEnabled: input.details.stockTrackingEnabled,
                minimumOrderEnabled: input.details.minimumOrderEnabled,
                minimumOrderQty: input.details.minimumOrderQty,
                conversionEnabled: input.details.conversionEnabled,
                inventoryLooseUnitEnabled:
                  input.details.inventoryLooseUnitEnabled,
                inventoryLooseUnit: input.details.inventoryLooseUnit,
                isReturnablePack: input.details.isReturnablePack,
                defaultPackDepositAmount:
                  input.details.defaultPackDepositAmount,
                allowedPackBrands: input.details.allowedPackBrands,
                allowedPackSizes: input.details.allowedPackSizes,
                visibility: input.details.visibility,
                status: "active",
                inStock: false,
                creatorSource: "shop",
                createdById: shopId,
                derivedFromProductId: adminByBrand.get(brandRow.id)?.id ?? null,
              })
              .returning();
            if (!inserted) {
              throw new ORPCError("INTERNAL_SERVER_ERROR", {
                message: `Could not create ${brandRow.name} product`,
              });
            }
            targetProduct = { ...inserted, variants: [] };
            await tx.insert(productBrand).values({
              productId: inserted.id,
              brandId: brandRow.id,
            });
            if (input.details.additionalImages.length > 0) {
              await tx.insert(productImage).values(
                input.details.additionalImages.map((imageUrl) => ({
                  productId: inserted.id,
                  imageUrl,
                })),
              );
            }
            created.push(inserted.id);
          } else {
            if (targetProduct.status !== "active") {
              await tx
                .update(product)
                .set({ status: "active" })
                .where(eq(product.id, targetProduct.id));
            }
            updated.push(targetProduct.id);
          }

          await syncProductVariants({
            tx,
            shopId,
            targetProduct,
            brandId: brandRow.id,
            desiredVariants: brandConfig.variants,
            optionMap,
            details: input.details,
          });
        }

        if (shouldDeactivateOmittedBrands(core.brandCreationMode)) {
          const selectedBrands = new Set(brandIds);
          for (const row of existingProducts) {
            if (row.brandId === null || selectedBrands.has(row.brandId))
              continue;
            await assertNoShopStock(
              tx,
              shopId,
              row.variants.map((variant) => variant.id),
              row.name,
            );
            await tx
              .update(product)
              .set({ status: "inactive" })
              .where(eq(product.id, row.id));
            await tx
              .update(productVariant)
              .set({ isActive: false })
              .where(eq(productVariant.productId, row.id));
            await tx
              .update(productVariantPrice)
              .set({ isActive: false, updatedAt: new Date() })
              .where(eq(productVariantPrice.productId, row.id));
            deactivated.push(row.id);
          }
        }

        await tx
          .insert(shopProductGenerationTemplate)
          .values({
            coreProductId: core.id,
            shopId,
            version: 1,
            sourceAdminTemplateVersion:
              existingTemplate?.sourceAdminTemplateVersion ??
              adminTemplate?.version ??
              null,
            details: template,
            createdById: shopId,
          })
          .onConflictDoUpdate({
            target: [
              shopProductGenerationTemplate.shopId,
              shopProductGenerationTemplate.coreProductId,
            ],
            set: {
              version: sql`${shopProductGenerationTemplate.version} + 1`,
              sourceAdminTemplateVersion:
                existingTemplate?.sourceAdminTemplateVersion ??
                adminTemplate?.version ??
                null,
              details: template,
              createdById: shopId,
              updatedAt: new Date(),
            },
          });

        const cylinderExchangeEnabled = shouldEnableWarehouseCylinderExchange({
          isReturnablePack: input.details.isReturnablePack,
          family: core.category?.type?.family,
          name: core.category?.type?.name,
          slug: core.category?.type?.slug,
        });
        for (const productId of new Set([...created, ...updated])) {
          await syncWarehouseCylinderExchange(tx, {
            productId,
            enabled: cylinderExchangeEnabled,
          });
        }

        return { created, updated, deactivated };
      });
      const recalculatedOrderIds = new Set<number>();
      for (const productId of [...result.updated, ...result.deactivated]) {
        for (const orderId of await recalculateOffersForShopProduct(
          productId,
          shopId,
        )) {
          recalculatedOrderIds.add(orderId);
        }
      }
      for (const orderId of recalculatedOrderIds) {
        context.realtime.emitToOrder(orderId, "open-order:offer-updated", {
          orderId,
          reason: "retailer_exchange_configuration_changed",
        });
      }
      return {
        ...result,
        recalculatedOpenOrders: recalculatedOrderIds.size,
      };
    }),

  getShopOwnedProductForEdit: shopModuleProcedure("inventory")
    .input(z.object({ productId: z.number().int().positive() }))
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      const found = await db.query.product.findFirst({
        where: and(
          eq(product.id, input.productId),
          eq(product.creatorSource, "shop"),
          eq(product.createdById, shopId),
        ),
        with: {
          brand: { columns: { id: true, name: true, slug: true } },
          category: {
            columns: { id: true, name: true, typeId: true },
            with: { type: true },
          },
          subCategory: { columns: { id: true, name: true } },
          coreProduct: { columns: { id: true, name: true, image: true } },
          images: true,
          productBrands: { with: { brand: true } },
          variantPrices: { with: { variantOption: true } },
          variants: {
            with: { sourceVariantOption: true },
          },
        },
      });
      if (!found || !found.coreProductId || !found.brandId) {
        throw new ORPCError("NOT_FOUND", {
          message: "Retailer product not found or is not configurable",
        });
      }
      const allOptions = await db.query.variantOption.findMany({
        where: eq(variantOption.isActive, true),
        orderBy: [variantOption.sortOrder, variantOption.name],
      });
      const options = allOptions.filter(
        (option) =>
          optionIsValid(
            option,
            found.category?.typeId ?? null,
            found.categoryId,
          ) && isConcreteVariantOption(option),
      );
      return { product: found, options: { variantOptions: options } };
    }),

  updateShopOwnedProduct: shopModuleProcedure("inventory")
    .input(updateSchema)
    .handler(async ({ context, input }) => {
      const shopId = shopTenantId(context.session.user);
      const optionIds = input.variants.map((row) => row.variantOptionId);
      if (new Set(optionIds).size !== optionIds.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "A variant can only be selected once",
        });
      }
      const result = await db.transaction(async (tx) => {
        const existing = await tx.query.product.findFirst({
          where: and(
            eq(product.id, input.productId),
            eq(product.creatorSource, "shop"),
            eq(product.createdById, shopId),
          ),
          with: {
            brand: true,
            category: {
              columns: { typeId: true },
              with: {
                type: { columns: { family: true, name: true, slug: true } },
              },
            },
            coreProduct: true,
            variants: true,
          },
        });
        if (!existing || !existing.coreProductId || !existing.brandId) {
          throw new ORPCError("NOT_FOUND", {
            message: "Retailer product not found or is not configurable",
          });
        }
        if (
          existing.category?.type?.family !== "lpg" &&
          input.variants.some((row) => row.exchangeEnabled)
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message:
              "Empty cylinder exchange is only available for LPG products",
          });
        }
        const optionMap = await loadScopedOptions(
          tx,
          optionIds,
          existing.category?.typeId ?? null,
          existing.categoryId,
        );
        await syncProductVariants({
          tx,
          shopId,
          targetProduct: existing,
          brandId: existing.brandId,
          desiredVariants: input.variants,
          optionMap,
          details: input.details,
        });
        const anyExchangeEnabled = input.variants.some(
          (row) => row.exchangeEnabled,
        );
        await tx
          .update(product)
          .set({
            name: input.details.name,
            description: input.details.description ?? null,
            shortDescription: input.details.shortDescription ?? null,
            videoUrl: input.details.videoUrl ?? null,
            image: input.details.image,
            features: input.details.features,
            trackingType: input.details.trackingType,
            returnPolicyEnabled: input.details.returnPolicyEnabled,
            expiryEnabled: input.details.expiryEnabled,
            damageControlEnabled: input.details.damageControlEnabled,
            stockTrackingEnabled: input.details.stockTrackingEnabled,
            minimumOrderEnabled: input.details.minimumOrderEnabled,
            minimumOrderQty: input.details.minimumOrderQty,
            conversionEnabled: input.details.conversionEnabled,
            inventoryLooseUnitEnabled: input.details.inventoryLooseUnitEnabled,
            inventoryLooseUnit: input.details.inventoryLooseUnit,
            isReturnablePack: anyExchangeEnabled,
            defaultPackDepositAmount: input.details.defaultPackDepositAmount,
            allowedPackBrands: input.details.allowedPackBrands,
            allowedPackSizes: input.details.allowedPackSizes,
            visibility: input.details.visibility,
            status: input.details.status,
          })
          .where(eq(product.id, existing.id));
        await tx
          .delete(productImage)
          .where(eq(productImage.productId, existing.id));
        if (input.details.additionalImages.length > 0) {
          await tx.insert(productImage).values(
            input.details.additionalImages.map((imageUrl) => ({
              productId: existing.id,
              imageUrl,
            })),
          );
        }
        return { productId: existing.id };
      });
      const recalculatedOrderIds = await recalculateOffersForShopProduct(
        result.productId,
        shopId,
      );
      for (const orderId of recalculatedOrderIds) {
        context.realtime.emitToOrder(orderId, "open-order:offer-updated", {
          orderId,
          reason: "retailer_exchange_configuration_changed",
        });
      }
      return {
        ...result,
        recalculatedOpenOrders: recalculatedOrderIds.length,
      };
    }),
};
