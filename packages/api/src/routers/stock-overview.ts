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
    stockEntry,
    coreProductIdentity,
} from "@bikalpo-project/db/schema";
import { and, eq, sql, desc, lt, gte } from "drizzle-orm";
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
            const ownerId = context.session.user.id;

            const ownerFilter = and(
                eq(inventory.ownerType, input.ownerType),
                eq(inventory.ownerId, ownerId),
            );

            // ── Main KPIs ──
            const [mainKPI] = await db
                .select({
                    totalProducts: sql<number>`COUNT(DISTINCT ${product.id})::int`,
                    totalSKU: sql<number>`COUNT(DISTINCT ${inventory.variantId})::int`,
                    totalUnits: sql<string>`COALESCE(SUM(${inventory.availableQty}::numeric), 0)`,
                    totalStockValue: sql<string>`COALESCE(SUM(${inventory.availableQty}::numeric * COALESCE(${inventory.retailPrice}::numeric, 0)), 0)`,
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .innerJoin(product, eq(productVariant.productId, product.id))
                .where(ownerFilter);

            // ── Stock Status (In Stock / Out of Stock) ──
            const statusRows = await db
                .select({
                    inStock: sql<number>`COUNT(*) FILTER (WHERE ${inventory.availableQty}::numeric > 0)::int`,
                    outOfStock: sql<number>`COUNT(*) FILTER (WHERE ${inventory.availableQty}::numeric <= 0)::int`,
                })
                .from(inventory)
                .where(ownerFilter);

            // ── Pack Type Breakdown ──
            const packTypeRows = await db
                .select({
                    packagingType: productVariant.packagingType,
                    totalUnits: sql<string>`COALESCE(SUM(${inventory.availableQty}::numeric), 0)`,
                    itemCount: sql<number>`COUNT(*)::int`,
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .where(ownerFilter)
                .groupBy(productVariant.packagingType)
                .orderBy(desc(sql`SUM(${inventory.availableQty}::numeric)`));

            // ── Expiring Soon (within 30 days) ──
            const today = new Date().toISOString().split("T")[0]!;
            const thirtyDaysLater = new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString().split("T")[0]!;

            const [expiringResult] = await db
                .select({
                    count: sql<number>`COUNT(DISTINCT ${stockEntry.id})::int`,
                })
                .from(stockEntry)
                .where(
                    and(
                        eq(stockEntry.warehouseId, ownerId),
                        gte(sql`${stockEntry.expiryDate}::date`, sql`${today}::date`),
                        lt(sql`${stockEntry.expiryDate}::date`, sql`${thirtyDaysLater}::date`),
                    ),
                );

            // ── Highest Stock Value by Category ──
            const topCategoryRows = await db
                .select({
                    categoryName: category.name,
                    stockValue: sql<string>`COALESCE(SUM(${inventory.availableQty}::numeric * COALESCE(${inventory.retailPrice}::numeric, 0)), 0)`,
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .innerJoin(product, eq(productVariant.productId, product.id))
                .innerJoin(category, eq(product.categoryId, category.id))
                .where(ownerFilter)
                .groupBy(category.id, category.name)
                .orderBy(desc(sql`SUM(${inventory.availableQty}::numeric * COALESCE(${inventory.retailPrice}::numeric, 0))`))
                .limit(5);

            return {
                mainKPI: {
                    totalProducts: mainKPI?.totalProducts ?? 0,
                    totalSKU: mainKPI?.totalSKU ?? 0,
                    totalUnits: parseFloat(mainKPI?.totalUnits ?? "0"),
                    totalStockValue: parseFloat(mainKPI?.totalStockValue ?? "0"),
                },
                stockStatus: {
                    inStock: statusRows[0]?.inStock ?? 0,
                    outOfStock: statusRows[0]?.outOfStock ?? 0,
                },
                packTypeBreakdown: packTypeRows.map((r) => ({
                    packagingType: r.packagingType,
                    totalUnits: parseFloat(r.totalUnits),
                    itemCount: r.itemCount,
                })),
                alerts: {
                    expiringSoon: expiringResult?.count ?? 0,
                },
                quickInsights: {
                    topCategories: topCategoryRows.map((r) => ({
                        name: r.categoryName,
                        value: parseFloat(r.stockValue),
                    })),
                },
            };
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
                .leftJoin(brand, eq(product.brandId, brand.id))
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
            const conditions = [
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
                    categoryName: category.name,
                    subCategoryName: subCategory.name,
                    variantId: productVariant.id,
                    packagingType: productVariant.packagingType,
                    weightKg: productVariant.weightKg,
                    unitLabel: productVariant.unitLabel,
                    color: productVariant.color,
                    size: productVariant.size,
                    availableQty: inventory.availableQty,
                    brandName: brand.name,
                })
                .from(inventory)
                .innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
                .innerJoin(product, eq(productVariant.productId, product.id))
                .leftJoin(coreProductIdentity, eq(product.coreProductId, coreProductIdentity.id))
                .leftJoin(category, eq(product.categoryId, category.id))
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
                categoryName: string | null;
                subCategoryName: string | null;
                totalQty: number;
                variantIds: Set<number>;
                productIds: Set<number>;
                hasColorSize: boolean;
                breakdownMap: Map<string, { qty: number; unit: string }>;
            };

            const groupMap = new Map<string, GroupData>();

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
                        categoryName: row.categoryName,
                        subCategoryName: row.subCategoryName,
                        totalQty: 0,
                        variantIds: new Set(),
                        productIds: new Set(),
                        hasColorSize: false,
                        breakdownMap: new Map(),
                    });
                }

                const g = groupMap.get(groupKey)!;
                g.totalQty += qty;
                g.variantIds.add(row.variantId);
                g.productIds.add(row.productId);
                if (row.color || row.size) g.hasColorSize = true;

                // Aggregate by packaging type
                const packType = row.packagingType || "other";
                const isLoose = packType === "loose";
                const label = isLoose
                    ? "Loose"
                    : packType.charAt(0).toUpperCase() + packType.slice(1);

                if (!g.breakdownMap.has(packType)) {
                    g.breakdownMap.set(packType, { qty: 0, unit: isLoose ? "KG" : label });
                }
                g.breakdownMap.get(packType)!.qty += qty;
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
                let stdUnit = "Pc";
                if (!g.hasColorSize) {
                    stdUnit = "KG";
                }

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
};
