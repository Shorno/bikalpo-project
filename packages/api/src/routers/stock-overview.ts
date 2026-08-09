/**
 * Stock Overview Router
 *
 * Provides hierarchical stock view for warehouse/shop owners:
 *   Level 1: Aggregated by product identity (e.g. "Soybean Oil — 5000L")
 *   Level 2: Breakdown by variant × brand (e.g. "Ifad 1L — 300 pcs")
 *   Level 3: Inner pack details (e.g. "5kg × 10 pcs inside")
 */

import { db } from "@bikalpo-project/db";
import { PRODUCT_TYPE_FAMILIES } from "@bikalpo-project/db/fulfillment";
import {
    brand,
    cartonConfig,
    category,
    coreProductIdentity,
    inventory,
    product,
    productType,
    productVariant,
    subCategory,
    variantOption,
    warehouseVariantAlias,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, eq, inArray, isNotNull, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { loadStructuredBrandStockRows } from "./helpers/structured-stock-data";
import {
    buildStructuredBrandStockDetail,
    buildStructuredBrandStockOverview,
    buildStructuredStockDetail,
    buildStructuredStockOverview,
} from "./helpers/structured-stock-overview";

/**
 * Stock status thresholds (configurable per-product later).
 * For now, use simple category-based defaults.
 */
function getStockStatus(qty: number, reorderLevel = 10): {
    label: string;
    badge: "in_stock" | "limited" | "low" | "out_of_stock";
} {
    if (qty <= 0) return { label: "Out of Stock", badge: "out_of_stock" };
    if (qty <= reorderLevel * 0.5) return { label: "Low Stock", badge: "low" };
    if (qty <= reorderLevel) return { label: "Limited", badge: "limited" };
    return { label: "In Stock", badge: "in_stock" };
}

const WEIGHT_UNITS = new Set(["KG", "KGS", "KILOGRAM", "KILOGRAMS"]);
const PIECE_UNITS = new Set(["PC", "PCS", "PIECE", "PIECES"]);
const DIRECT_COUNT_UNITS = new Set(["CYLINDER", "UNIT", "PAIR"]);

function isLpgTypeContext(typeName?: string | null) {
    return (
        String(typeName || "")
            .trim()
            .toLowerCase() === "lpg"
    );
}

function normalizeMeasureUnit(unit?: string | null) {
    return String(unit || "")
        .trim()
        .toUpperCase();
}

function parseLabelMeasure(label?: string | null) {
    const normalizedLabel = String(label || "").trim();
    if (!normalizedLabel) return null;

    const pieceMatch = normalizedLabel.match(
        /(\d+(?:\.\d+)?)\s*(pc|pcs|piece|pieces|pair|unit)\b/i,
    );
    if (pieceMatch) {
        const value = Number(pieceMatch[1]);
        if (value > 0) {
            return {
                quantityPerPack: value,
                quantityUnit:
                    normalizeMeasureUnit(pieceMatch[2]) === "PAIR" ? "PAIR" : "PCS",
            };
        }
    }

    const weightMatch = normalizedLabel.match(
        /(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms)\b/i,
    );
    if (weightMatch) {
        const value = Number(weightMatch[1]);
        if (value > 0) {
            return {
                quantityPerPack: value,
                quantityUnit: "KG",
            };
        }
    }

    return null;
}

function toBreakdownType(packType?: string | null, quantityUnit?: string | null) {
    const normalizedQuantityUnit = normalizeMeasureUnit(quantityUnit);
    if (DIRECT_COUNT_UNITS.has(normalizedQuantityUnit)) {
        return normalizedQuantityUnit.toLowerCase();
    }

    return packType || "other";
}

function getVariantMeasureInfo(input: {
    packType?: string | null;
    unitLabel?: string | null;
    orderUnit?: string | null;
    weightKg?: string | null;
    piecesPerUnit?: number | null;
    typeName?: string | null;
}) {
    const packType = input.packType || "other";
    const normalizedUnit = normalizeMeasureUnit(input.orderUnit);
    const weightKg = parseFloat(input.weightKg || "0");
    const piecesPerUnit = Number(input.piecesPerUnit || 0);
    const isLpgContext = isLpgTypeContext(input.typeName);

    // LPG capacity is reference content, not an inventory multiplier. A 12 KG
    // cylinder remains one inventory unit throughout summaries and movements.
    if (packType === "cylinder" || normalizedUnit === "CYLINDER") {
        return {
            quantityPerPack: 1,
            quantityUnit: "CYLINDER",
            isLoose: false,
        };
    }

    if (packType === "loose") {
        if (PIECE_UNITS.has(normalizedUnit)) {
            return { quantityPerPack: 1, quantityUnit: "PCS", isLoose: true };
        }
        if (weightKg > 0 || WEIGHT_UNITS.has(normalizedUnit)) {
            return { quantityPerPack: 1, quantityUnit: "KG", isLoose: true };
        }
        const parsedLooseLabel = parseLabelMeasure(input.unitLabel);
        if (parsedLooseLabel && parsedLooseLabel.quantityUnit !== "KG") {
            return {
                quantityPerPack: 1,
                quantityUnit: parsedLooseLabel.quantityUnit,
                isLoose: true,
            };
        }
        return { quantityPerPack: 1, quantityUnit: normalizedUnit || "KG", isLoose: true };
    }

    if (isLpgContext) {
        return { quantityPerPack: 1, quantityUnit: "CYLINDER", isLoose: false };
    }

    if (WEIGHT_UNITS.has(normalizedUnit) && weightKg > 0) {
        return { quantityPerPack: weightKg, quantityUnit: "KG", isLoose: false };
    }

    if (piecesPerUnit > 0) {
        return {
            quantityPerPack: piecesPerUnit,
            quantityUnit: PIECE_UNITS.has(normalizedUnit) ? "PCS" : normalizedUnit || "UNIT",
            isLoose: false,
        };
    }

    if (DIRECT_COUNT_UNITS.has(normalizedUnit)) {
        return {
            quantityPerPack: 1,
            quantityUnit: normalizedUnit,
            isLoose: false,
        };
    }

    const parsedLabel = parseLabelMeasure(input.unitLabel);
    if (parsedLabel) {
        return {
            quantityPerPack: parsedLabel.quantityPerPack,
            quantityUnit: parsedLabel.quantityUnit,
            isLoose: false,
        };
    }

    return { quantityPerPack: 1, quantityUnit: "PACK", isLoose: false };
}

type InventoryOwnerType = "warehouse" | "shop" | "super_seller";

export async function loadStructuredStockSnapshot(
    ownerType: InventoryOwnerType,
    ownerId: string,
) {
    const inventoryRows = await db.query.inventory.findMany({
        where: and(
            eq(inventory.ownerType, ownerType),
            eq(inventory.ownerId, ownerId),
        ),
        columns: {
            variantId: true,
            availableQty: true,
            reservedQty: true,
            retailPrice: true,
        },
        with: {
            variant: {
                columns: {
                    id: true,
                    sku: true,
                    preferredLocalSku: true,
                    catalogVariantId: true,
                    brandId: true,
                    isActive: true,
                    reorderLevel: true,
                    sourceVariantOptionId: true,
                },
                with: {
                    catalogVariant: {
                        columns: { globalSku: true },
                    },
                    brand: { columns: { id: true, name: true } },
                    sourceVariantOption: true,
                    product: {
                        columns: {
                            id: true,
                            name: true,
                            status: true,
                            reorderLevel: true,
                            categoryId: true,
                            brandId: true,
                            coreProductId: true,
                        },
                        with: {
                            brand: { columns: { id: true, name: true } },
                            coreProduct: { columns: { id: true } },
                            category: {
                                columns: { id: true, name: true },
                                with: {
                                    type: { columns: { id: true, name: true, family: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    const aliasKeys = inventoryRows.flatMap((row) => {
        const variant = row.variant;
        const coreProductId = variant?.product?.coreProduct?.id ?? null;
        return coreProductId && variant?.sourceVariantOptionId
            ? [{ coreProductId, variantOptionId: variant.sourceVariantOptionId }]
            : [];
    });
    const coreProductIds = [...new Set(aliasKeys.map((key) => key.coreProductId))];
    const aliases =
        ownerType === "warehouse" && coreProductIds.length > 0
            ? await db.query.warehouseVariantAlias.findMany({
                  where: and(
                      eq(warehouseVariantAlias.warehouseId, ownerId),
                      inArray(warehouseVariantAlias.coreProductId, coreProductIds),
                  ),
                  columns: {
                      coreProductId: true,
                      variantOptionId: true,
                      alias: true,
                  },
              })
            : [];
    const aliasMap = new Map(
        aliases.map((entry) => [
            `${entry.coreProductId}:${entry.variantOptionId}`,
            entry.alias,
        ]),
    );

    return buildStructuredStockOverview(
        inventoryRows.flatMap((row) => {
            const variant = row.variant;
            const productRow = variant?.product;
            if (!variant || !productRow) return [];

            const coreProductId = productRow.coreProduct?.id ?? null;
            const brandRow = variant.brand ?? productRow.brand;
            const displayAlias =
                coreProductId && variant.sourceVariantOptionId
                    ? aliasMap.get(
                          `${coreProductId}:${variant.sourceVariantOptionId}`,
                      ) ?? null
                    : null;

            return [
                {
                    productId: productRow.id,
                    variantId: variant.id,
                    coreProductId,
                    productName: productRow.name,
                    productIsActive: productRow.status === "active",
                    brandId: brandRow?.id ?? null,
                    brandName: brandRow?.name ?? null,
                    categoryId: productRow.categoryId,
                    categoryName: productRow.category?.name ?? "Uncategorized",
                    productTypeId: productRow.category?.type?.id ?? null,
                    productTypeName: productRow.category?.type?.name ?? null,
                    family: productRow.category?.type?.family ?? null,
                    sku: variant.sku,
                    catalogVariantId: variant.catalogVariantId,
                    globalSku: variant.catalogVariant?.globalSku ?? null,
                    localSku: variant.preferredLocalSku ?? variant.sku,
                    variantIsActive: variant.isActive,
                    sourceVariantOptionId: variant.sourceVariantOptionId,
                    sourceVariantOption: variant.sourceVariantOption,
                    displayAlias,
                    availableQty: row.availableQty,
                    reservedQty: row.reservedQty,
                    warehouseSellingPrice: row.retailPrice,
                    variantReorderLevel: variant.reorderLevel,
                    productReorderLevel: productRow.reorderLevel,
                },
            ];
        }),
    );
}

export const stockOverviewRouter = {
    /**
     * KPI Dashboard: Aggregated stats for the stock overview dashboard.
     * All values computed from real DB data — no hardcoded thresholds.
     */
    getStockDashboardKPI: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
            }),
        )
        .handler(async ({ context, input }) => {
            const snapshot = await loadStructuredStockSnapshot(
                input.ownerType,
                context.session.user.id,
            );
            return snapshot.dashboard;
        }),

    /**
     * Paginated exact-variant stock rows for the structured overview table.
     * Labels and units come only from Admin Variant Setup.
     */
    getStockDashboardVariants: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
                page: z.number().int().min(1).default(1),
                pageSize: z.number().int().min(1).max(100).default(25),
                search: z.string().trim().max(100).optional(),
                family: z.enum(PRODUCT_TYPE_FAMILIES).optional(),
                status: z
                    .enum(["in_stock", "low_stock", "out_of_stock"])
                    .optional(),
                configurationState: z
                    .enum(["valid", "needs_admin_variant_setup"])
                    .optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const snapshot = await loadStructuredStockSnapshot(
                input.ownerType,
                context.session.user.id,
            );
            const search = input.search?.toLocaleLowerCase();
            const filtered = snapshot.variants.filter((variant) => {
                if (input.family && variant.family !== input.family) return false;
                if (input.status && variant.status !== input.status) return false;
                if (
                    input.configurationState &&
                    variant.configurationState !== input.configurationState
                ) {
                    return false;
                }
                if (!search) return true;
                return [
                    variant.productName,
                    variant.brandName,
                    variant.globalSku,
                    variant.localSku,
                    variant.sku,
                    variant.canonicalLabel,
                    variant.displayAlias,
                ].some((value) => value?.toLocaleLowerCase().includes(search));
            });

            const total = filtered.length;
            const totalPages = Math.ceil(total / input.pageSize);
            const page = totalPages > 0 ? Math.min(input.page, totalPages) : 1;
            const offset = (page - 1) * input.pageSize;

            return {
                items: filtered.slice(offset, offset + input.pageSize),
                total,
                page,
                pageSize: input.pageSize,
                totalPages,
            };
        }),

    /**
     * Target-scoped stock detail resolved exclusively from Admin Variant Setup.
     * Warehouse-owned variants remain visible at zero stock; other owner types
     * must already have an inventory row for the requested variant.
     */
    getStructuredStockDetail: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
                target: z.discriminatedUnion("kind", [
                    z.object({
                        kind: z.literal("core"),
                        id: z.number().int().positive(),
                    }),
                    z.object({
                        kind: z.literal("product"),
                        id: z.number().int().positive(),
                    }),
                ]),
            }),
        )
        .handler(async ({ context, input }) => {
            const ownerId = context.session.user.id;
            const inventoryScope = and(
                eq(inventory.variantId, productVariant.id),
                eq(inventory.ownerType, input.ownerType),
                eq(inventory.ownerId, ownerId),
            );
            const ownerConditions: SQL[] =
                input.ownerType === "warehouse"
                    ? [
                          eq(product.creatorSource, "warehouse"),
                          or(
                              eq(product.createdById, ownerId),
                              eq(product.createdByWarehouseId, ownerId),
                          )!,
                      ]
                    : [isNotNull(inventory.id)];
            const targetCondition =
                input.target.kind === "core"
                    ? eq(product.coreProductId, input.target.id)
                    : eq(product.id, input.target.id);

            const rows = await db
                .select({
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image,
                    productStatus: product.status,
                    productReorderLevel: product.reorderLevel,
                    productBrandId: product.brandId,
                    coreProductId: product.coreProductId,
                    coreProductName: coreProductIdentity.name,
                    coreProductSku: coreProductIdentity.sku,
                    coreProductImage: coreProductIdentity.image,
                    categoryId: category.id,
                    categoryName: category.name,
                    productTypeId: productType.id,
                    productTypeName: productType.name,
                    family: productType.family,
                    variantId: productVariant.id,
                    variantSku: productVariant.sku,
                    variantBrandId: productVariant.brandId,
                    variantIsActive: productVariant.isActive,
                    variantReorderLevel: productVariant.reorderLevel,
                    sourceVariantOptionId: productVariant.sourceVariantOptionId,
                    sourceOptionName: variantOption.name,
                    sourceOptionUnit: variantOption.unit,
                    sourceOptionSize: variantOption.size,
                    sourceOptionVariantType: variantOption.variantType,
                    sourceOptionDefinitionKind: variantOption.definitionKind,
                    sourceOptionDefinition: variantOption.definition,
                    sourceOptionDisplayAlias: variantOption.displayAlias,
                    sourceOptionNeedsReview: variantOption.needsReview,
                    availableQty: inventory.availableQty,
                    reservedQty: inventory.reservedQty,
                    warehouseSellingPrice: inventory.retailPrice,
                    brandId: brand.id,
                    brandName: brand.name,
                })
                .from(productVariant)
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(
                    inventory,
                    inventoryScope,
                )
                .leftJoin(
                    coreProductIdentity,
                    eq(product.coreProductId, coreProductIdentity.id),
                )
                .innerJoin(category, eq(product.categoryId, category.id))
                .leftJoin(productType, eq(category.typeId, productType.id))
                .leftJoin(
                    brand,
                    eq(
                        brand.id,
                        sql`COALESCE(${productVariant.brandId}, ${product.brandId})`,
                    ),
                )
                .leftJoin(
                    variantOption,
                    eq(productVariant.sourceVariantOptionId, variantOption.id),
                )
                .where(
                    and(
                        targetCondition,
                        eq(product.status, "active"),
                        eq(productVariant.isActive, true),
                        ...ownerConditions,
                    ),
                )
                .orderBy(
                    product.name,
                    brand.name,
                    variantOption.sortOrder,
                    productVariant.sortOrder,
                );

            if (rows.length === 0) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Stock detail not found",
                });
            }

            const coreProductIds = [
                ...new Set(
                    rows.flatMap((row) =>
                        row.coreProductId === null ? [] : [row.coreProductId],
                    ),
                ),
            ];
            const aliases =
                input.ownerType === "warehouse" && coreProductIds.length > 0
                    ? await db.query.warehouseVariantAlias.findMany({
                          where: and(
                              eq(warehouseVariantAlias.warehouseId, ownerId),
                              inArray(
                                  warehouseVariantAlias.coreProductId,
                                  coreProductIds,
                              ),
                          ),
                          columns: {
                              coreProductId: true,
                              variantOptionId: true,
                              alias: true,
                          },
                      })
                    : [];
            const aliasMap = new Map(
                aliases.map((entry) => [
                    `${entry.coreProductId}:${entry.variantOptionId}`,
                    entry.alias,
                ]),
            );

            const detail = buildStructuredStockDetail(
                input.target,
                rows.map((row) => ({
                    productId: row.productId,
                    variantId: row.variantId,
                    coreProductId: row.coreProductId,
                    coreProductName: row.coreProductName,
                    coreProductSku: row.coreProductSku,
                    coreProductImage: row.coreProductImage,
                    productName: row.productName,
                    productImage: row.productImage,
                    productIsActive: row.productStatus === "active",
                    productTypeId: row.productTypeId,
                    productTypeName: row.productTypeName,
                    brandId: row.brandId ?? row.variantBrandId ?? row.productBrandId,
                    brandName: row.brandName,
                    categoryId: row.categoryId,
                    categoryName: row.categoryName,
                    family: row.family,
                    sku: row.variantSku,
                    variantIsActive: row.variantIsActive,
                    sourceVariantOptionId: row.sourceVariantOptionId,
                    sourceVariantOption:
                        row.sourceVariantOptionId === null
                            ? null
                            : {
                                  name: row.sourceOptionName,
                                  unit: row.sourceOptionUnit,
                                  size: row.sourceOptionSize,
                                  variantType: row.sourceOptionVariantType,
                                  definitionKind: row.sourceOptionDefinitionKind,
                                  definition: row.sourceOptionDefinition,
                                  displayAlias: row.sourceOptionDisplayAlias,
                                  needsReview: row.sourceOptionNeedsReview,
                              },
                    displayAlias:
                        row.coreProductId && row.sourceVariantOptionId
                            ? aliasMap.get(
                                  `${row.coreProductId}:${row.sourceVariantOptionId}`,
                              ) ?? null
                            : null,
                    availableQty: row.availableQty,
                    reservedQty: row.reservedQty,
                    warehouseSellingPrice: row.warehouseSellingPrice,
                    variantReorderLevel: row.variantReorderLevel,
                    productReorderLevel: row.productReorderLevel,
                })),
            );

            if (!detail) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Stock detail not found",
                });
            }

            return detail;
        }),

    /**
     * Level 1: Aggregated stock overview grouped by product.
     * Returns total quantity per product across all variants, with stock status.
     *
     * ownerType + ownerId scopes the view to the current user's inventory.
     */
    getStockOverview: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
                categoryId: z.number().int().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const ownerId = context.session.user.id;

            // Aggregate inventory by product
            // inventory → productVariant → product → category
            const results = await db
                .select({
                    productId: product.id,
                    productName: product.name,
                    productSlug: product.slug,
                    productImage: product.image,
                    categoryId: category.id,
                    categoryName: category.name,
                    subCategoryId: subCategory.id,
                    subCategoryName: subCategory.name,
                    // Sum available qty across all variants of this product
                    totalQty: sql<string>`COALESCE(SUM(${inventory.availableQty}::numeric), 0)`.as("total_qty"),
                    // Count distinct variants in inventory
                    variantCount: sql<number>`COUNT(DISTINCT ${inventory.variantId})::int`.as("variant_count"),
                    // Get the primary unit label for display
                    primaryUnit: sql<string>`(
                        SELECT ${productVariant.unitLabel}
                        FROM ${productVariant}
                        WHERE ${productVariant.productId} = ${product.id}
                        AND ${productVariant.isActive} = true
                        ORDER BY ${productVariant.sortOrder} ASC
                        LIMIT 1
                    )`.as("primary_unit"),
                    // Product-level unit size (carton/sack KG) — field removed from product table
                    unitSize: sql<string>`NULL`.as("unit_size"),
                    // Total weight in KG (sum of qty × weightKg)
                    totalWeightKg: sql<string>`COALESCE(SUM(${inventory.availableQty}::numeric * ${productVariant.weightKg}::numeric), 0)`.as("total_weight_kg"),
                    // Brand info (product-level brand)
                    brandId: product.brandId,
                    brandName: brand.name,
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(category, eq(product.categoryId, category.id))
                .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
                .leftJoin(brand, eq(product.brandId, brand.id))
                .where(
                    and(
                        eq(inventory.ownerType, input.ownerType),
                        eq(inventory.ownerId, ownerId),
                        input.categoryId ? eq(product.categoryId, input.categoryId) : undefined,
                    ),
                )
                .groupBy(
                    product.id,
                    product.name,
                    product.slug,
                    product.image,

                    product.brandId,
                    brand.name,
                    category.id,
                    category.name,
                    subCategory.id,
                    subCategory.name,
                )
                .orderBy(category.name, product.name);

            return {
                products: results.map((r) => {
                    const totalQty = parseFloat(r.totalQty || "0");
                    const totalWeightKg = parseFloat(r.totalWeightKg || "0");
                    const unitSizeKg = r.unitSize ? parseFloat(r.unitSize) : 0;
                    const cartonCount = unitSizeKg > 0 ? Math.floor(totalWeightKg / unitSizeKg) : 0;
                    const remainderKg = unitSizeKg > 0 ? totalWeightKg % unitSizeKg : 0;

                    return {
                        productId: r.productId,
                        productName: r.productName,
                        productSlug: r.productSlug,
                        productImage: r.productImage,
                        category: r.categoryName,
                        subCategory: r.subCategoryName,
                        brandId: r.brandId,
                        brandName: r.brandName,
                        totalQty,
                        totalWeightKg,
                        unitSizeKg,
                        cartonCount,
                        remainderKg,
                        variantCount: r.variantCount,
                        primaryUnit: r.primaryUnit || "pcs",
                        status: getStockStatus(totalQty),
                    };
                }),
            };
        }),

    /**
     * Level 2: Variant-level stock breakdown for a specific product.
     * Groups by packaging variant (1L, 2L, 5L, Loose), then by brand within each.
     *
     * Returns:
     *   - variantGroups: Array of { packType, unitLabel, weightKg, brands: [...] }
     *   - loosePool: { openStock, fullDrum } (for loose_convert products)
     */
    getStockBreakdown: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
                productId: z.number().int(),
            }),
        )
        .handler(async ({ context, input }) => {
            const ownerId = context.session.user.id;

            const warehouseOwnedConditions: SQL[] = input.ownerType === "warehouse"
                ? [
                    eq(product.creatorSource, "warehouse"),
                    or(
                        eq(product.createdById, ownerId),
                        eq(product.createdByWarehouseId, ownerId),
                    )!,
                    eq(product.status, "active"),
                    eq(productVariant.isActive, true),
                ]
                : [
                    eq(inventory.ownerType, input.ownerType),
                    eq(inventory.ownerId, ownerId),
                ];

            // Warehouse views are configuration-backed so variants remain visible at zero stock.
            const rows = await db
                .select({
                    inventoryId: inventory.id,
                    variantId: productVariant.id,
                    variantType: productVariant.variantType,
                    packType: productVariant.packType,
                    packagingType: productVariant.packagingType,
                    unitLabel: productVariant.unitLabel,
                    weightKg: productVariant.weightKg,
                    piecesPerUnit: productVariant.piecesPerUnit,
                    orderUnit: productVariant.orderUnit,
                    packWeightKg: productVariant.packWeightKg,
                    innerPackSizeKg: productVariant.innerPackSizeKg,
                    packCountInside: productVariant.packCountInside,
                    sku: productVariant.sku,
                    color: productVariant.color,
                    size: productVariant.size,
                    availableQty: inventory.availableQty,
                    inCartonQty: inventory.inCartonQty,
                    reservedQty: inventory.reservedQty,
                    retailPrice: inventory.retailPrice,
                    brandId: brand.id,
                    brandName: brand.name,
                    brandLogo: brand.logo,
                    typeName: productType.name,
                })
                .from(productVariant)
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(category, eq(product.categoryId, category.id))
                .leftJoin(productType, eq(category.typeId, productType.id))
                .leftJoin(inventory, and(
                    eq(inventory.variantId, productVariant.id),
                    eq(inventory.ownerType, input.ownerType),
                    eq(inventory.ownerId, ownerId),
                ))
                // Prefer variant-level brand, fall back to product-level brand
                .leftJoin(brand, eq(brand.id, sql`COALESCE(${productVariant.brandId}, ${product.brandId})`))
                .where(
                    and(
                        eq(productVariant.productId, input.productId),
                        ...warehouseOwnedConditions,
                    ),
                )
                .orderBy(productVariant.sortOrder, productVariant.weightKg);

            // Build enriched rows with brand info from variant
            const enrichedRows = rows.map((row) => ({
                ...row,
                brand: row.brandName
                    ? { id: row.brandId, name: row.brandName, logo: row.brandLogo }
                    : null,
            }));

            // Group by packaging type (packType or packagingType for legacy)
            const variantGroupMap = new Map<string, {
                packType: string;
                unitLabel: string;
                weightKg: string;
                piecesPerUnit: number | null;
                orderUnit: string | null;
                innerPackSizeKg: string | null;
                packCountInside: number | null;
                items: Array<{
                    variantId: number;
                    brand: { id: number | null; name: string; logo: string | null } | null;
                    color: string | null;
                    size: string | null;
                    availableQty: number;
                    totalQty: number;
                    inCartonQty: number;
                    availableForCartonQty: number;
                    reservedQty: number;
                    retailPrice: string | null;
                    sku: string | null;
                    status: ReturnType<typeof getStockStatus>;
                }>;
            }>();

            let looseOpenStock = 0;
            const looseFullDrum = 0;

            for (const row of enrichedRows) {
                const qty = parseFloat(row.availableQty || "0");
                const inCartonQty = parseFloat(row.inCartonQty || "0");
                const packKey = row.packType || row.packagingType || "other";
                const measure = getVariantMeasureInfo({
                    packType: packKey,
                    unitLabel: row.unitLabel,
                    orderUnit: row.orderUnit,
                    weightKg: row.weightKg,
                    piecesPerUnit: row.piecesPerUnit,
                    typeName: row.typeName,
                });
                const isLoose = measure.isLoose;

                if (isLoose) {
                    // For loose variants, subtract in-carton qty to get actual loose stock
                    looseOpenStock += Math.max(0, qty - inCartonQty);
                }

                // Group key: packType + weightKg for uniqueness
                const groupKey = `${packKey}_${measure.quantityUnit}_${measure.quantityPerPack}_${row.unitLabel || ""}`;

                if (!variantGroupMap.has(groupKey)) {
                    // Build a generic group label from pack type + weight
                    // e.g. "Carton (12.00kg)" instead of "Carton 12×1L (IFAD)"
                    const genericLabel = isLoose
                        ? `Loose (per KG)`
                        : row.unitLabel || "Pack";

                    variantGroupMap.set(groupKey, {
                        packType: packKey,
                        unitLabel: genericLabel,
                        weightKg: row.weightKg,
                        piecesPerUnit: row.piecesPerUnit,
                        orderUnit: row.orderUnit,
                        innerPackSizeKg: row.innerPackSizeKg,
                        packCountInside: row.packCountInside,
                        items: [],
                    });
                }

                // Subtract in-carton qty so display shows actual loose/uncartonned stock
                const displayQty = Math.max(0, qty - inCartonQty);

                variantGroupMap.get(groupKey)!.items.push({
                    variantId: row.variantId,
                    brand: row.brand,
                    color: row.color,
                    size: row.size,
                    availableQty: displayQty,
                    totalQty: qty,
                    inCartonQty,
                    availableForCartonQty: displayQty,
                    reservedQty: parseFloat(row.reservedQty || "0"),
                    retailPrice: row.retailPrice,
                    sku: row.sku,
                    status: getStockStatus(qty),
                });
            }

            // Calculate total
            const totalQty = enrichedRows.reduce((sum, r) => {
                const packKey = r.packType || r.packagingType || "other";
                const measure = getVariantMeasureInfo({
                    packType: packKey,
                    unitLabel: r.unitLabel,
                    orderUnit: r.orderUnit,
                    weightKg: r.weightKg,
                    piecesPerUnit: r.piecesPerUnit,
                    typeName: r.typeName,
                });
                const qty = parseFloat(r.availableQty || "0");
                return sum + qty * measure.quantityPerPack;
            }, 0);

            return {
                productId: input.productId,
                totalQty,
                variantGroups: Array.from(variantGroupMap.values()),
                loosePool: {
                    openStock: looseOpenStock,
                    fullDrum: looseFullDrum,
                },
            };
        }),

    /**
     * Get categories that have inventory for this owner.
     * Used for category filter in the stock overview page.
     */
    getStockCategories: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
            }),
        )
        .handler(async ({ context, input }) => {
            const ownerId = context.session.user.id;

            const results = await db
                .select({
                    categoryId: category.id,
                    categoryName: category.name,
                    categoryImage: category.image,
                    productCount: sql<number>`COUNT(DISTINCT ${product.id})::int`.as("product_count"),
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .innerJoin(product, eq(productVariant.productId, product.id))
                .innerJoin(category, eq(product.categoryId, category.id))
                .where(
                    and(
                        eq(inventory.ownerType, input.ownerType),
                        eq(inventory.ownerId, ownerId),
                    ),
                )
                .groupBy(category.id, category.name, category.image)
                .orderBy(category.name);

            return {
                categories: results.map((r) => ({
                    id: r.categoryId,
                    name: r.categoryName,
                    image: r.categoryImage,
                    productCount: r.productCount,
                })),
            };
        }),

    /**
     * Stock List: Paginated stock list at CORE IDENTITY level.
     * Each row = one core product identity (e.g., "Miniket Rice") aggregating
     * all brands/products/variants under it.
     * Falls back to product-level grouping for products without coreProductId.
     */
    getStockList: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
                categoryId: z.number().int().optional(),
                status: z.enum(["all", "in_stock", "out_of_stock"]).optional().default("all"),
                search: z.string().optional(),
                page: z.number().int().min(1).optional().default(1),
                pageSize: z.number().int().min(1).max(100).optional().default(20),
            }),
        )
        .handler(async ({ context, input }) => {
            const ownerId = context.session.user.id;
            const offset = (input.page - 1) * input.pageSize;

            // Build WHERE conditions
            const conditions: SQL[] = input.ownerType === "warehouse"
                ? [
                    eq(product.creatorSource, "warehouse"),
                    or(
                        eq(product.createdById, ownerId),
                        eq(product.createdByWarehouseId, ownerId),
                    )!,
                    eq(product.status, "active"),
                    eq(productVariant.isActive, true),
                ]
                : [
                    eq(inventory.ownerType, input.ownerType),
                    eq(inventory.ownerId, ownerId),
                ];
            if (input.categoryId) {
                conditions.push(eq(product.categoryId, input.categoryId));
            }
            if (input.search) {
                const term = `%${input.search}%`;
                conditions.push(
                    sql`(${product.name} ILIKE ${term} OR ${product.sku} ILIKE ${term} OR ${coreProductIdentity.name} ILIKE ${term} OR ${coreProductIdentity.sku} ILIKE ${term})`,
                );
            }

            // Get all inventory rows joined to core identity
            const rows = await db
                .select({
                    productId: product.id,
                    productName: product.name,
                    productImage: product.image,
                    coreProductId: product.coreProductId,
                    coreProductName: coreProductIdentity.name,
                    coreProductSku: coreProductIdentity.sku,
                    coreProductImage: coreProductIdentity.image,
                    typeName: productType.name,
                    categoryName: category.name,
                    subCategoryName: subCategory.name,
                    variantId: productVariant.id,
                    packagingType: productVariant.packagingType,
                    weightKg: productVariant.weightKg,
                    piecesPerUnit: productVariant.piecesPerUnit,
                    orderUnit: productVariant.orderUnit,
                    unitLabel: productVariant.unitLabel,
                    color: productVariant.color,
                    size: productVariant.size,
                    availableQty: inventory.availableQty,
                    brandName: brand.name,
                })
                .from(productVariant)
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(inventory, and(
                    eq(inventory.variantId, productVariant.id),
                    eq(inventory.ownerType, input.ownerType),
                    eq(inventory.ownerId, ownerId),
                ))
                .leftJoin(coreProductIdentity, eq(product.coreProductId, coreProductIdentity.id))
                .leftJoin(category, eq(product.categoryId, category.id))
                .leftJoin(productType, eq(category.typeId, productType.id))
                .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
                .leftJoin(brand, eq(productVariant.brandId, brand.id))
                .where(and(...conditions))
                .orderBy(sql`COALESCE(${coreProductIdentity.name}, ${product.name})`);

            // Aggregate by core product identity (or product if no core identity)
            type GroupData = {
                groupKey: string;
                coreProductId: number | null;
                coreProductName: string;
                coreProductSku: string | null;
                coreProductImage: string;
                typeName: string | null;
                categoryName: string | null;
                subCategoryName: string | null;
                totalQty: number;
                variantIds: Set<number>;
                productIds: Set<number>;
                hasColorSize: boolean;
                summaryUnit: string | null;
                breakdownMap: Map<string, { qty: number; unit: string; type: string }>;
            };

            const groupMap = new Map<string, GroupData>();

            // Fetch carton configs for all variant IDs we encountered
            const allVariantIds = new Set<number>();
            for (const row of rows) {
                allVariantIds.add(row.variantId);
            }
            const variantIdsArr = Array.from(allVariantIds);

            // Build carton config lookup: variantId → { packsPerCarton }
            const cartonConfigMap = new Map<number, { packsPerCarton: number }>();
            if (variantIdsArr.length > 0) {
                const configs = await db
                    .select({
                        variantId: cartonConfig.variantId,
                        packsPerCarton: cartonConfig.packsPerCarton,
                        isDefault: cartonConfig.isDefault,
                    })
                    .from(cartonConfig)
                    .where(
                        and(
                            inArray(cartonConfig.variantId, variantIdsArr),
                            eq(cartonConfig.isActive, true),
                        ),
                    );
                for (const c of configs) {
                    // Prefer default config, otherwise first one
                    if (!cartonConfigMap.has(c.variantId) || c.isDefault) {
                        cartonConfigMap.set(c.variantId, { packsPerCarton: c.packsPerCarton });
                    }
                }
            }

            for (const row of rows) {
                const qty = parseFloat(row.availableQty || "0");
                // Group key: use coreProductId if available, otherwise fall back to productId
                const groupKey = row.coreProductId
                    ? `core_${row.coreProductId}`
                    : `product_${row.productId}`;

                if (!groupMap.has(groupKey)) {
                    groupMap.set(groupKey, {
                        groupKey,
                        coreProductId: row.coreProductId,
                        coreProductName: row.coreProductName || row.productName,
                        coreProductSku: row.coreProductSku || null,
                        coreProductImage: row.coreProductImage || row.productImage,
                        typeName: row.typeName,
                        categoryName: row.categoryName,
                        subCategoryName: row.subCategoryName,
                        totalQty: 0,
                        variantIds: new Set(),
                        productIds: new Set(),
                        hasColorSize: false,
                        summaryUnit: null,
                        breakdownMap: new Map(),
                    });
                }

                const g = groupMap.get(groupKey)!;
                g.variantIds.add(row.variantId);
                g.productIds.add(row.productId);
                if (row.color || row.size) g.hasColorSize = true;

                // Calculate carton vs loose breakdown
                const packType = row.packagingType || "other";
                const measure = getVariantMeasureInfo({
                    packType,
                    unitLabel: row.unitLabel,
                    orderUnit: row.orderUnit,
                    weightKg: row.weightKg,
                    piecesPerUnit: row.piecesPerUnit,
                    typeName: row.typeName,
                });
                const isLoose = measure.isLoose;
                const breakdownType = toBreakdownType(packType, measure.quantityUnit);
                const isFashionRow =
                    String(row.typeName || "")
                        .trim()
                        .toLowerCase() === "fashion";
                const cfg = cartonConfigMap.get(row.variantId);

                if (!g.summaryUnit) {
                    g.summaryUnit = measure.quantityUnit;
                } else if (
                    normalizeMeasureUnit(g.summaryUnit) === "KG" &&
                    normalizeMeasureUnit(measure.quantityUnit) !== "KG"
                ) {
                    g.summaryUnit = measure.quantityUnit;
                }

                if (isLoose) {
                    // Loose stock stays in its own base unit.
                    g.totalQty += qty;
                    if (!g.breakdownMap.has("loose")) {
                        g.breakdownMap.set("loose", {
                            qty: 0,
                            unit: measure.quantityUnit,
                            type: "loose",
                        });
                    }
                    g.breakdownMap.get("loose")!.qty += qty;
                } else if (isFashionRow) {
                    // Fashion pack stock stays as open stock until a real bundle/carton is created.
                    const openMeasureQty = qty * measure.quantityPerPack;
                    g.totalQty += openMeasureQty;
                    if (!g.breakdownMap.has("loose")) {
                        g.breakdownMap.set("loose", {
                            qty: 0,
                            unit: measure.quantityUnit,
                            type: "loose",
                        });
                    }
                    g.breakdownMap.get("loose")!.qty += openMeasureQty;
                } else if (cfg && cfg.packsPerCarton > 0) {
                    // Has carton config → compute carton count + loose remainder
                    const cartonCount = Math.floor(qty / cfg.packsPerCarton);
                    const remainderPacks = qty % cfg.packsPerCarton;
                    const remainderMeasureQty = remainderPacks * measure.quantityPerPack;

                    g.totalQty += qty * measure.quantityPerPack;

                    if (cartonCount > 0) {
                        if (!g.breakdownMap.has("carton")) {
                            g.breakdownMap.set("carton", { qty: 0, unit: "Carton", type: "carton" });
                        }
                        g.breakdownMap.get("carton")!.qty += cartonCount;
                    }
                    if (remainderMeasureQty > 0) {
                        if (measure.quantityUnit === "KG") {
                            if (!g.breakdownMap.has("loose")) {
                                g.breakdownMap.set("loose", {
                                    qty: 0,
                                    unit: measure.quantityUnit,
                                    type: "loose",
                                });
                            }
                            g.breakdownMap.get("loose")!.qty += remainderMeasureQty;
                        } else {
                            if (!g.breakdownMap.has(breakdownType)) {
                                const label =
                                    breakdownType.charAt(0).toUpperCase() + breakdownType.slice(1);
                                g.breakdownMap.set(breakdownType, {
                                    qty: 0,
                                    unit: label,
                                    type: breakdownType,
                                });
                            }
                            g.breakdownMap.get(breakdownType)!.qty += remainderPacks;
                        }
                    }
                } else {
                    // No carton config → count as packs, total in base unit
                    g.totalQty += qty * measure.quantityPerPack;
                    const label =
                        breakdownType.charAt(0).toUpperCase() + breakdownType.slice(1);
                    if (!g.breakdownMap.has(breakdownType)) {
                        g.breakdownMap.set(breakdownType, {
                            qty: 0,
                            unit: label,
                            type: breakdownType,
                        });
                    }
                    g.breakdownMap.get(breakdownType)!.qty += qty;
                }
            }

            // Apply status filter
            let groups = Array.from(groupMap.values());
            if (input.status === "in_stock") {
                groups = groups.filter((g) => g.totalQty > 0);
            } else if (input.status === "out_of_stock") {
                groups = groups.filter((g) => g.totalQty <= 0);
            }

            // Sort by name
            groups.sort((a, b) => a.coreProductName.localeCompare(b.coreProductName));

            const totalCount = groups.length;
            const paginated = groups.slice(offset, offset + input.pageSize);

            const items = paginated.map((g) => {
                const stdUnit = g.summaryUnit || "KG";

                const breakdown = Array.from(g.breakdownMap.entries())
                    .map(([type, data]) => ({
                        packagingType: type,
                        label:
                            type === "loose"
                                ? "Loose"
                                : type.charAt(0).toUpperCase() + type.slice(1),
                        qty: data.qty,
                        unit: data.unit,
                    }))
                    .sort((a, b) => b.qty - a.qty);

                return {
                    groupKey: g.groupKey,
                    coreProductId: g.coreProductId,
                    coreProductName: g.coreProductName,
                    coreProductSku: g.coreProductSku,
                    coreProductImage: g.coreProductImage,
                    typeName: g.typeName,
                    categoryName: g.categoryName,
                    subCategoryName: g.subCategoryName,
                    totalQty: g.totalQty,
                    stdUnit,
                    variantCount: g.variantIds.size,
                    productCount: g.productIds.size,
                    // Return productIds for Level 2 detail fetching
                    productIds: Array.from(g.productIds),
                    hasColorSize: g.hasColorSize,
                    breakdown,
                    status: g.totalQty > 0 ? ("in_stock" as const) : ("out_of_stock" as const),
                };
            });

            return {
                items,
                totalCount,
                page: input.page,
                pageSize: input.pageSize,
                totalPages: Math.ceil(totalCount / input.pageSize),
            };
        }),

    /** Brand stock grouped with Admin Variant Setup semantics. */
    getBrandStockOverview: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
                search: z.string().optional(),
                categoryId: z.number().int().optional(),
            }),
        )
        .handler(async ({ context, input }) => {
            const rows = await loadStructuredBrandStockRows(
                input,
                context.session.user.id,
            );
            return { brands: buildStructuredBrandStockOverview(rows) };
        }),

    /** Exact brand products and variants with structured stock semantics. */
    getBrandStockDetail: protectedProcedure
        .input(
            z.object({
                ownerType: z.enum(["warehouse", "shop", "super_seller"]),
                brandId: z.number().int().positive(),
            }),
        )
        .handler(async ({ context, input }) => {
            const rows = await loadStructuredBrandStockRows(
                input,
                context.session.user.id,
            );
            const detail = buildStructuredBrandStockDetail(input.brandId, rows);
            if (!detail) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Brand stock detail not found",
                });
            }
            return detail;
        }),
};
