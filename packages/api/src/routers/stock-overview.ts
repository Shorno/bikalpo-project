/**
 * Stock Overview Router
 *
 * Provides hierarchical stock view for warehouse/shop owners:
 *   Level 1: Aggregated by product identity (e.g. "Soybean Oil — 5000L")
 *   Level 2: Breakdown by variant × brand (e.g. "Ifad 1L — 300 pcs")
 *   Level 3: Inner pack details (e.g. "5kg × 10 pcs inside")
 */

import { db } from "@bikalpo-project/db";
import {
    inventory,
    product,
    productVariant,
    brand,
    category,
    subCategory,
} from "@bikalpo-project/db/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";

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

export const stockOverviewRouter = {
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
                    // Product-level unit size (carton/sack KG)
                    unitSize: product.unitSize,
                    // Total weight in KG (sum of qty × weightKg)
                    totalWeightKg: sql<string>`COALESCE(SUM(${inventory.availableQty}::numeric * ${productVariant.weightKg}::numeric), 0)`.as("total_weight_kg"),
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(category, eq(product.categoryId, category.id))
                .leftJoin(subCategory, eq(product.subCategoryId, subCategory.id))
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
                    product.unitSize,
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

            // Get all inventory rows for this product's variants
            const rows = await db
                .select({
                    inventoryId: inventory.id,
                    variantId: productVariant.id,
                    variantType: productVariant.variantType,
                    packType: productVariant.packType,
                    packagingType: productVariant.packagingType,
                    unitLabel: productVariant.unitLabel,
                    weightKg: productVariant.weightKg,
                    packWeightKg: productVariant.packWeightKg,
                    innerPackSizeKg: productVariant.innerPackSizeKg,
                    packCountInside: productVariant.packCountInside,
                    sku: productVariant.sku,
                    color: productVariant.color,
                    size: productVariant.size,
                    availableQty: inventory.availableQty,
                    reservedQty: inventory.reservedQty,
                    retailPrice: inventory.retailPrice,
                    brandId: brand.id,
                    brandName: brand.name,
                    brandLogo: brand.logo,
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(brand, eq(productVariant.brandId, brand.id))
                .where(
                    and(
                        eq(inventory.ownerType, input.ownerType),
                        eq(inventory.ownerId, ownerId),
                        eq(productVariant.productId, input.productId),
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
                innerPackSizeKg: string | null;
                packCountInside: number | null;
                items: Array<{
                    variantId: number;
                    brand: { id: number | null; name: string; logo: string | null } | null;
                    color: string | null;
                    size: string | null;
                    availableQty: number;
                    reservedQty: number;
                    retailPrice: string | null;
                    sku: string | null;
                    status: ReturnType<typeof getStockStatus>;
                }>;
            }>();

            let looseOpenStock = 0;
            let looseFullDrum = 0;

            for (const row of enrichedRows) {
                const qty = parseFloat(row.availableQty || "0");
                const packKey = row.packType || row.packagingType || "other";
                const isLoose = packKey === "loose";

                if (isLoose) {
                    // For loose variants, just accumulate totals
                    looseOpenStock += qty;
                }

                // Group key: packType + weightKg for uniqueness
                const groupKey = `${packKey}_${row.weightKg}`;

                if (!variantGroupMap.has(groupKey)) {
                    // Build a generic group label from pack type + weight
                    // e.g. "Carton (12.00kg)" instead of "Carton 12×1L (IFAD)"
                    const packLabel = packKey.charAt(0).toUpperCase() + packKey.slice(1);
                    const wt = parseFloat(row.weightKg || "0");
                    const genericLabel = isLoose
                        ? `Loose (per KG)`
                        : `${packLabel} (${wt % 1 === 0 ? wt.toFixed(0) : wt}kg)`;

                    variantGroupMap.set(groupKey, {
                        packType: packKey,
                        unitLabel: genericLabel,
                        weightKg: row.weightKg,
                        innerPackSizeKg: row.innerPackSizeKg,
                        packCountInside: row.packCountInside,
                        items: [],
                    });
                }

                variantGroupMap.get(groupKey)!.items.push({
                    variantId: row.variantId,
                    brand: row.brand,
                    color: row.color,
                    size: row.size,
                    availableQty: qty,
                    reservedQty: parseFloat(row.reservedQty || "0"),
                    retailPrice: row.retailPrice,
                    sku: row.sku,
                    status: getStockStatus(qty),
                });
            }

            // Calculate total
            const totalQty = enrichedRows.reduce((sum, r) => sum + parseFloat(r.availableQty || "0"), 0);

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
};
