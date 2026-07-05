import { db } from "@bikalpo-project/db";
import { customerAssignment, estimate, estimateItem, inventory, order, orderItem, shopWarehouseConnection, user, warehouseWarehouseConnection } from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { adminProcedure, salesmanProcedure } from "../index";
import { localDateStamp } from "../utils/date";

// Validation schemas
const salesmanIdSchema = z.object({
    id: z.string(),
});

const assignCustomersSchema = z.object({
    salesmanId: z.string(),
    customerIds: z.array(z.string()).min(1, "At least one customer required"),
});

const unassignCustomerSchema = z.object({
    salesmanId: z.string(),
    customerId: z.string(),
});

const upcomingOrdersSchema = z.object({
    limit: z.number().optional().default(50),
});

const estimateCatalogSchema = z.object({
    search: z.string().optional(),
    productTypeId: z.number().int().positive().optional(),
    coreProductId: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
    subCategoryId: z.number().int().positive().optional(),
});

const estimateLineInputSchema = z.object({
    variantId: z.number().int().positive(),
    quantity: z.number().int().min(1),
});

const writeEstimateSchema = z.object({
    customerIds: z.array(z.string()).min(1, "At least one customer required"),
    items: z.array(estimateLineInputSchema).min(1, "At least one item required"),
    discountPercent: z.number().min(0).max(100).default(0),
    notes: z.string().nullable().optional(),
    validUntil: z.coerce.date().nullable().optional(),
});

const updateSalesmanEstimateSchema = z.object({
    id: z.number(),
    customerIds: z.array(z.string()).min(1).max(1).optional(),
    customerId: z.string().optional(),
    items: z.array(estimateLineInputSchema).min(1).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    validUntil: z.coerce.date().nullable().optional(),
    notes: z.string().nullable().optional(),
});

type AssignedShopType = "retailer" | "warehouse";

type AssignedShopSource = {
    id: string;
    customerType: AssignedShopType;
    connectionId: number;
    displayName: string;
    contactName: string;
    email: string;
    phoneNumber: string | null;
    address: string | null;
    locationLat: string | null;
    locationLng: string | null;
    shopName: string | null;
    warehouseName: string | null;
    ownerName: string | null;
    image: string | null;
    connectedAt: Date | null;
    lastOrderedAt: Date | null;
    assignedAt: Date;
    createdAt: Date;
};

type ResolvedEstimateLine = {
    variantId: number;
    productId: number;
    productName: string;
    productImage: string | null;
    productSize: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
};

function toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: number): string {
    return Math.max(0, value).toFixed(2);
}

function formatPackLabel(variant: {
    packWeightKg?: string | null;
    weightKg?: string | null;
    unitLabel?: string | null;
    packType?: string | null;
    packagingType?: string | null;
}) {
    const weight = toNumber(variant.packWeightKg || variant.weightKg);
    const unit = variant.unitLabel || "Unit";
    const packType = variant.packType || variant.packagingType || "";

    if (weight > 0) {
        const formattedWeight = Number.isInteger(weight) ? String(weight) : String(weight);
        return [formattedWeight, unit, packType].filter(Boolean).join(" ");
    }

    return [unit, packType].filter(Boolean).join(" ") || "Variant";
}

async function ensureAssignedCustomers({
    warehouseId,
    salesmanId,
    customerIds,
}: {
    warehouseId: string;
    salesmanId: string;
    customerIds: string[];
}) {
    const assignedShops = await getAssignedShopSources({ warehouseId, salesmanId });
    const assignedIds = new Set(assignedShops.map((shop) => shop.id));
    const missingId = customerIds.find((customerId) => !assignedIds.has(customerId));

    if (missingId) {
        throw new ORPCError("FORBIDDEN", {
            message: "One or more selected customers are not assigned to you",
        });
    }
}

async function resolveEstimateLines({
    warehouseId,
    items,
}: {
    warehouseId: string;
    items: Array<z.infer<typeof estimateLineInputSchema>>;
}) {
    const quantityByVariant = new Map<number, number>();
    for (const item of items) {
        quantityByVariant.set(
            item.variantId,
            (quantityByVariant.get(item.variantId) ?? 0) + item.quantity,
        );
    }

    const variantIds = Array.from(quantityByVariant.keys());
    const stockRows = await db.query.inventory.findMany({
        where: and(
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.ownerId, warehouseId),
            inArray(inventory.variantId, variantIds),
        ),
        columns: {
            variantId: true,
            availableQty: true,
            retailPrice: true,
        },
        with: {
            variant: {
                columns: {
                    id: true,
                    sku: true,
                    unitLabel: true,
                    price: true,
                    weightKg: true,
                    packWeightKg: true,
                    packType: true,
                    packagingType: true,
                },
                with: {
                    brand: {
                        columns: {
                            name: true,
                        },
                    },
                    product: {
                        columns: {
                            id: true,
                            name: true,
                            image: true,
                            size: true,
                        },
                        with: {
                            coreProduct: {
                                columns: {
                                    name: true,
                                    image: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    const stockByVariant = new Map(stockRows.map((row) => [row.variantId, row]));
    const lines: ResolvedEstimateLine[] = [];

    for (const [variantId, quantity] of quantityByVariant) {
        const stock = stockByVariant.get(variantId);
        if (!stock?.variant?.product) {
            throw new ORPCError("BAD_REQUEST", {
                message: `Variant ${variantId} is not available in this warehouse`,
            });
        }

        const availableQty = toNumber(stock.availableQty);
        if (availableQty < quantity) {
            throw new ORPCError("BAD_REQUEST", {
                message: `Insufficient stock for ${stock.variant.product.name}. Available ${availableQty}, requested ${quantity}`,
            });
        }

        const product = stock.variant.product;
        const unitPrice =
            toNumber(stock.retailPrice) > 0
                ? toNumber(stock.retailPrice)
                : toNumber(stock.variant.price);
        const productSize = formatPackLabel(stock.variant);
        const brandName = stock.variant.brand?.name;
        const productName = [
            product.coreProduct?.name || product.name,
            brandName,
            productSize,
        ]
            .filter(Boolean)
            .join(" - ");

        lines.push({
            variantId,
            productId: product.id,
            productName,
            productImage: product.coreProduct?.image || product.image || null,
            productSize,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
        });
    }

    return lines;
}

function getWarehouseSalesmanIds(context: { session: { user: unknown } }) {
    const sessionUser = context.session.user as {
        id: string;
        warehouseId?: string | null;
    };

    if (!sessionUser.warehouseId) {
        throw new ORPCError("FORBIDDEN", {
            message: "Warehouse sales access required",
        });
    }

    return {
        salesmanId: sessionUser.id,
        warehouseId: sessionUser.warehouseId,
    };
}

async function getAssignedShopSources({
    warehouseId,
    salesmanId,
    customerId,
}: {
    warehouseId: string;
    salesmanId: string;
    customerId?: string;
}) {
    const assignmentConditions: SQL[] = [
        eq(customerAssignment.warehouseId, warehouseId),
        eq(customerAssignment.salesmanId, salesmanId),
    ];

    if (customerId) {
        assignmentConditions.push(eq(customerAssignment.customerId, customerId));
    }

    const [retailerShops, buyerWarehouses] = await Promise.all([
        db
            .select({
                id: user.id,
                customerType: sql<AssignedShopType>`'retailer'`,
                connectionId: shopWarehouseConnection.id,
                displayName: sql<string>`COALESCE(${user.shopName}, ${user.name})`,
                contactName: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                address: user.shopAddress,
                locationLat: user.shopLat,
                locationLng: user.shopLng,
                shopName: user.shopName,
                warehouseName: sql<string | null>`NULL`,
                ownerName: user.ownerName,
                image: user.image,
                connectedAt: shopWarehouseConnection.connectedAt,
                lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
                assignedAt: customerAssignment.assignedAt,
                createdAt: user.createdAt,
            })
            .from(customerAssignment)
            .innerJoin(
                shopWarehouseConnection,
                and(
                    eq(customerAssignment.customerId, shopWarehouseConnection.shopId),
                    eq(customerAssignment.warehouseId, shopWarehouseConnection.warehouseId),
                    eq(shopWarehouseConnection.status, "active"),
                ),
            )
            .innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
            .where(and(...assignmentConditions)),
        db
            .select({
                id: user.id,
                customerType: sql<AssignedShopType>`'warehouse'`,
                connectionId: warehouseWarehouseConnection.id,
                displayName: sql<string>`COALESCE(${user.warehouseName}, ${user.name})`,
                contactName: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                address: user.warehouseAddress,
                locationLat: user.warehouseLat,
                locationLng: user.warehouseLng,
                shopName: sql<string | null>`NULL`,
                warehouseName: user.warehouseName,
                ownerName: user.ownerName,
                image: user.image,
                connectedAt: warehouseWarehouseConnection.connectedAt,
                lastOrderedAt: warehouseWarehouseConnection.lastOrderedAt,
                assignedAt: customerAssignment.assignedAt,
                createdAt: user.createdAt,
            })
            .from(customerAssignment)
            .innerJoin(
                warehouseWarehouseConnection,
                and(
                    eq(
                        customerAssignment.customerId,
                        warehouseWarehouseConnection.buyerWarehouseId,
                    ),
                    eq(
                        customerAssignment.warehouseId,
                        warehouseWarehouseConnection.supplierWarehouseId,
                    ),
                    eq(warehouseWarehouseConnection.status, "active"),
                ),
            )
            .innerJoin(user, eq(warehouseWarehouseConnection.buyerWarehouseId, user.id))
            .where(and(...assignmentConditions)),
    ]);

    return ([...retailerShops, ...buyerWarehouses] as AssignedShopSource[]).sort(
        (left, right) => right.assignedAt.getTime() - left.assignedAt.getTime(),
    );
}

async function enrichAssignedShopSources({
    sources,
    warehouseId,
    salesmanId,
}: {
    sources: AssignedShopSource[];
    warehouseId: string;
    salesmanId: string;
}) {
    if (sources.length === 0) return [];

    const customerIds = sources.map((source) => source.id);

    const [estimateStats, orderStats] = await Promise.all([
        db
            .select({
                customerId: estimate.customerId,
                totalEstimates: sql<number>`COUNT(*)::int`,
                lastEstimateDate: sql<Date | null>`MAX(${estimate.createdAt})`,
            })
            .from(estimate)
            .where(
                and(
                    eq(estimate.salesmanId, salesmanId),
                    inArray(estimate.customerId, customerIds),
                ),
            )
            .groupBy(estimate.customerId),
        db
            .select({
                customerId: order.userId,
                totalOrders: sql<number>`COUNT(*)::int`,
                totalSpent: sql<string>`COALESCE(SUM(${order.total}::numeric), 0)::text`,
                pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${order.paymentStatus} = 'pending' THEN ${order.total}::numeric ELSE 0 END), 0)::text`,
                lastOrderDate: sql<Date | null>`MAX(${order.createdAt})`,
            })
            .from(order)
            .where(
                and(
                    eq(order.warehouseId, warehouseId),
                    inArray(order.userId, customerIds),
                ),
            )
            .groupBy(order.userId),
    ]);

    const estimateStatsByCustomer = new Map(
        estimateStats.map((row) => [row.customerId, row]),
    );
    const orderStatsByCustomer = new Map(
        orderStats.map((row) => [row.customerId, row]),
    );

    return sources.map((source) => {
        const customerEstimateStats = estimateStatsByCustomer.get(source.id);
        const customerOrderStats = orderStatsByCustomer.get(source.id);
        const lastEstimateDate = customerEstimateStats?.lastEstimateDate ?? null;
        const lastOrderDate = customerOrderStats?.lastOrderDate ?? null;
        const lastActivityAt =
            lastEstimateDate && lastOrderDate
                ? lastEstimateDate > lastOrderDate
                    ? lastEstimateDate
                    : lastOrderDate
                : lastEstimateDate || lastOrderDate;

        return {
            ...source,
            name: source.contactName,
            totalEstimates: customerEstimateStats?.totalEstimates ?? 0,
            totalOrders: customerOrderStats?.totalOrders ?? 0,
            totalSpent: customerOrderStats?.totalSpent ?? "0",
            pendingAmount: customerOrderStats?.pendingAmount ?? "0",
            lastActivityAt,
        };
    });
}

export const salesmanRouter = {
    /**
     * Get salesman stats for dashboard
     * REST: GET /salesmen/stats
     */
    getStats: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/stats",
            tags: ["Salesman"],
            summary: "Get salesman stats",
            description: "Get statistics for the logged-in salesman's dashboard",
        })
        .handler(async ({ context }) => {
            const userId = context.session.user.id;

            // Get current month dates
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get estimates stats
            const estimates = await db.query.estimate.findMany({
                where: eq(estimate.salesmanId, userId),
                columns: {
                    status: true,
                    total: true,
                    createdAt: true,
                },
            });

            // Calculate estimate stats
            const estimateStats = {
                total: estimates.length,
                draft: 0,
                sent: 0,
                approved: 0,
                rejected: 0,
                converted: 0,
                thisMonth: 0,
                today: 0,
                totalValue: 0,
                convertedValue: 0,
            };

            for (const est of estimates) {
                const statusKey = est.status as keyof typeof estimateStats;
                if (typeof estimateStats[statusKey] === 'number') {
                    (estimateStats[statusKey] as number)++;
                }
                estimateStats.totalValue += Number(est.total);

                if (est.status === "converted") {
                    estimateStats.convertedValue += Number(est.total);
                }

                if (est.createdAt >= startOfMonth) {
                    estimateStats.thisMonth++;
                }
                if (est.createdAt >= today) {
                    estimateStats.today++;
                }
            }

            // Calculate conversion rate
            const conversionRate =
                estimateStats.total > 0
                    ? Math.round((estimateStats.converted / estimateStats.total) * 100)
                    : 0;

            // Get recent estimates
            const recentEstimates = await db.query.estimate.findMany({
                where: eq(estimate.salesmanId, userId),
                with: {
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            shopName: true,
                        },
                    },
                },
                orderBy: [desc(estimate.createdAt)],
                limit: 5,
            });

            return {
                stats: {
                    role: "salesman" as const,
                    estimates: estimateStats,
                    conversionRate,
                    recentEstimates,
                },
            };
        }),

    /**
     * Get upcoming orders for salesman's assigned customers
     * REST: GET /salesmen/upcoming-orders
     */
    getUpcomingOrders: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/upcoming-orders",
            tags: ["Salesman"],
            summary: "Get upcoming orders",
            description: "Get upcoming orders from the salesman's assigned customers",
        })
        .input(upcomingOrdersSchema)
        .handler(async ({ input, context }) => {
            const { salesmanId, warehouseId } = getWarehouseSalesmanIds(context);

            const assignedShops = await getAssignedShopSources({
                warehouseId,
                salesmanId,
            });
            const customerIds = assignedShops.map((shop) => shop.id);

            if (customerIds.length === 0) {
                return { orders: [] };
            }

            // Get orders with status confirmed or processing from assigned customers
            const ordersList = await db.query.order.findMany({
                where: and(
                    eq(order.warehouseId, warehouseId),
                    inArray(order.status, ["confirmed", "processing"]),
                    inArray(order.userId, customerIds)
                ),
                with: {
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            shopName: true,
                            phoneNumber: true,
                        },
                    },
                },
                orderBy: [desc(order.createdAt)],
                limit: input.limit,
            });

            return { orders: ordersList };
        }),

    /**
     * Get assigned customers for the current salesman
     * REST: GET /salesmen/customers
     */
    getAssignedCustomers: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/customers",
            tags: ["Salesman"],
            summary: "Get assigned customers",
            description: "Get list of customers assigned to the logged-in salesman",
        })
        .handler(async ({ context }) => {
            const { salesmanId, warehouseId } = getWarehouseSalesmanIds(context);
            const assignedShops = await getAssignedShopSources({
                warehouseId,
                salesmanId,
            });
            const enrichedCustomers = await enrichAssignedShopSources({
                sources: assignedShops,
                warehouseId,
                salesmanId,
            });

            return { customers: enrichedCustomers };
        }),

    /**
     * Get estimate catalog from the salesman's registered warehouse stock.
     * REST: GET /salesmen/estimate-catalog
     */
    getEstimateCatalog: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/estimate-catalog",
            tags: ["Salesman"],
            summary: "Get warehouse stock catalog for estimates",
            description: "Get stocked variants available for salesman estimates",
        })
        .input(estimateCatalogSchema)
        .handler(async ({ context, input }) => {
            const { warehouseId } = getWarehouseSalesmanIds(context);
            const search = input.search?.trim().toLowerCase();

            const rows = await db.query.inventory.findMany({
                where: and(
                    eq(inventory.ownerType, "warehouse"),
                    eq(inventory.ownerId, warehouseId),
                    sql`CAST(${inventory.availableQty} AS numeric) > 0`,
                ),
                columns: {
                    id: true,
                    variantId: true,
                    availableQty: true,
                    retailPrice: true,
                },
                with: {
                    variant: {
                        columns: {
                            id: true,
                            sku: true,
                            unitLabel: true,
                            price: true,
                            weightKg: true,
                            packWeightKg: true,
                            packType: true,
                            packagingType: true,
                        },
                        with: {
                            brand: {
                                columns: {
                                    id: true,
                                    name: true,
                                },
                            },
                            product: {
                                columns: {
                                    id: true,
                                    name: true,
                                    image: true,
                                    categoryId: true,
                                    subCategoryId: true,
                                    coreProductId: true,
                                },
                                with: {
                                    category: {
                                        columns: {
                                            id: true,
                                            name: true,
                                            typeId: true,
                                        },
                                        with: {
                                            type: {
                                                columns: {
                                                    id: true,
                                                    name: true,
                                                },
                                            },
                                        },
                                    },
                                    subCategory: {
                                        columns: {
                                            id: true,
                                            name: true,
                                            categoryId: true,
                                        },
                                    },
                                    coreProduct: {
                                        columns: {
                                            id: true,
                                            name: true,
                                            image: true,
                                            categoryId: true,
                                            subCategoryId: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            const mappedCatalog = rows
                .map((row) => {
                    const variant = row.variant;
                    const product = variant?.product;
                    if (!variant || !product) return null;

                    const variantLabel = formatPackLabel(variant);
                    const typeId = product.category?.typeId ?? null;
                    const typeName = product.category?.type?.name ?? null;
                    const categoryId = product.category?.id ?? product.categoryId ?? null;
                    const categoryName = product.category?.name ?? null;
                    const subCategoryId =
                        product.subCategory?.id ?? product.subCategoryId ?? null;
                    const subCategoryName = product.subCategory?.name ?? null;
                    const coreProductId =
                        product.coreProduct?.id ?? product.coreProductId ?? null;
                    const coreProductName = product.coreProduct?.name ?? null;
                    const nameParts = [
                        coreProductName || product.name,
                        variant.brand?.name,
                        variantLabel,
                    ].filter(Boolean);
                    const displayName = nameParts.join(" - ");
                    const haystack = [
                        displayName,
                        product.name,
                        coreProductName,
                        typeName,
                        categoryName,
                        subCategoryName,
                        variant.brand?.name,
                        variant.sku,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();

                    return {
                        inventoryId: row.id,
                        variantId: row.variantId,
                        productId: product.id,
                        name: displayName,
                        productName: coreProductName || product.name,
                        brandName: variant.brand?.name ?? null,
                        variantLabel,
                        sku: variant.sku,
                        image: product.coreProduct?.image || product.image,
                        availableQty: toNumber(row.availableQty),
                        unitPrice:
                            toNumber(row.retailPrice) > 0
                                ? toNumber(row.retailPrice)
                                : toNumber(variant.price),
                        typeId,
                        typeName,
                        categoryId,
                        categoryName,
                        subCategoryId,
                        subCategoryName,
                        coreProductId,
                        coreProductName,
                        searchText: haystack,
                    };
                });
            const catalog = mappedCatalog.filter(
                (item): item is NonNullable<(typeof mappedCatalog)[number]> =>
                    item !== null,
            );

            const matchesSearch = (item: NonNullable<(typeof catalog)[number]>) =>
                !search || item.searchText.includes(search);
            const matchesSelectedFilters = (
                item: NonNullable<(typeof catalog)[number]>,
            ) => {
                if (input.productTypeId && item.typeId !== input.productTypeId)
                    return false;
                if (input.coreProductId && item.coreProductId !== input.coreProductId)
                    return false;
                if (input.categoryId && item.categoryId !== input.categoryId)
                    return false;
                if (input.subCategoryId && item.subCategoryId !== input.subCategoryId)
                    return false;
                return true;
            };

            const searchRows = catalog.filter(matchesSearch);
            const products = searchRows
                .filter(matchesSelectedFilters)
                .map(({ searchText: _searchText, ...item }) => item);

            const sortByName = <T extends { name: string }>(items: T[]) =>
                items.sort((left, right) => left.name.localeCompare(right.name));

            const typeOptions = new Map<number, { id: number; name: string }>();
            const categoryOptions = new Map<
                number,
                { id: number; name: string; typeId: number | null }
            >();
            const subCategoryOptions = new Map<
                number,
                { id: number; name: string; categoryId: number }
            >();
            const coreProductOptions = new Map<
                number,
                {
                    id: number;
                    name: string;
                    typeId: number | null;
                    categoryId: number | null;
                    subCategoryId: number | null;
                }
            >();

            for (const item of searchRows) {
                if (item.typeId && item.typeName) {
                    typeOptions.set(item.typeId, {
                        id: item.typeId,
                        name: item.typeName,
                    });
                }

                const categoryMatches =
                    (!input.productTypeId || item.typeId === input.productTypeId) &&
                    (!input.coreProductId ||
                        item.coreProductId === input.coreProductId);
                if (categoryMatches && item.categoryId && item.categoryName) {
                    categoryOptions.set(item.categoryId, {
                        id: item.categoryId,
                        name: item.categoryName,
                        typeId: item.typeId,
                    });
                }

                const subCategoryMatches =
                    categoryMatches &&
                    (!input.categoryId || item.categoryId === input.categoryId);
                if (
                    subCategoryMatches &&
                    item.subCategoryId &&
                    item.subCategoryName &&
                    item.categoryId
                ) {
                    subCategoryOptions.set(item.subCategoryId, {
                        id: item.subCategoryId,
                        name: item.subCategoryName,
                        categoryId: item.categoryId,
                    });
                }

                const coreProductMatches =
                    (!input.productTypeId || item.typeId === input.productTypeId) &&
                    (!input.categoryId || item.categoryId === input.categoryId) &&
                    (!input.subCategoryId ||
                        item.subCategoryId === input.subCategoryId);
                if (
                    coreProductMatches &&
                    item.coreProductId &&
                    (item.coreProductName || item.productName)
                ) {
                    coreProductOptions.set(item.coreProductId, {
                        id: item.coreProductId,
                        name: item.coreProductName || item.productName,
                        typeId: item.typeId,
                        categoryId: item.categoryId,
                        subCategoryId: item.subCategoryId,
                    });
                }
            }

            return {
                products,
                filterOptions: {
                    types: sortByName(Array.from(typeOptions.values())),
                    coreProducts: sortByName(
                        Array.from(coreProductOptions.values()),
                    ),
                    categories: sortByName(Array.from(categoryOptions.values())),
                    subCategories: sortByName(
                        Array.from(subCategoryOptions.values()),
                    ),
                },
            };
        }),

    /**
     * Get customer details with order and estimate history
     * REST: GET /salesmen/customers/:id
     */
    getCustomerDetails: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/customers/{id}",
            tags: ["Salesman"],
            summary: "Get customer details",
            description: "Get detailed customer information with order and estimate history",
        })
        .input(z.object({ id: z.string() }))
        .handler(async ({ context, input }) => {
            const { salesmanId, warehouseId } = getWarehouseSalesmanIds(context);
            const [assignedShop] = await getAssignedShopSources({
                warehouseId,
                salesmanId,
                customerId: input.id,
            });

            if (!assignedShop) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Shop not found or not assigned to you",
                });
            }

            const [enrichedShop] = await enrichAssignedShopSources({
                sources: [assignedShop],
                warehouseId,
                salesmanId,
            });

            if (!enrichedShop) {
                throw new ORPCError("NOT_FOUND", {
                    message: "Shop not found or not assigned to you",
                });
            }

            // Get customer estimates
            const customerEstimates = await db
                .select({
                    id: estimate.id,
                    estimateNumber: estimate.estimateNumber,
                    total: estimate.total,
                    status: estimate.status,
                    createdAt: estimate.createdAt,
                })
                .from(estimate)
                .where(
                    and(
                        eq(estimate.customerId, input.id),
                        eq(estimate.salesmanId, salesmanId),
                    ),
                )
                .orderBy(desc(estimate.createdAt));

            // Get customer orders
            const customerOrders = await db
                .select({
                    id: order.id,
                    orderNumber: order.orderNumber,
                    total: order.total,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    createdAt: order.createdAt,
                })
                .from(order)
                .where(and(eq(order.userId, input.id), eq(order.warehouseId, warehouseId)))
                .orderBy(desc(order.createdAt));

            // Calculate stats
            const totalSpent = customerOrders.reduce(
                (sum, o) => sum + Number.parseFloat(o.total),
                0,
            );
            const pendingAmount = customerOrders
                .filter((o) => o.paymentStatus === "pending")
                .reduce((sum, o) => sum + Number.parseFloat(o.total), 0);

            return {
                customer: {
                    ...enrichedShop,
                    stats: {
                        totalEstimates: customerEstimates.length,
                        totalOrders: customerOrders.length,
                        totalSpent: totalSpent.toFixed(2),
                        pendingAmount: pendingAmount.toFixed(2),
                    },
                    estimates: customerEstimates,
                    orders: customerOrders,
                },
            };
        }),

    /**
     * Get all estimates for the current salesman
     * REST: GET /salesmen/estimates
     */
    getEstimates: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/estimates",
            tags: ["Salesman"],
            summary: "Get salesman estimates",
            description: "Get all estimates created by the logged-in salesman",
        })
        .input(z.object({ status: z.string().optional() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const conditions = [eq(estimate.salesmanId, userId)];

            if (input.status) {
                conditions.push(eq(estimate.status, input.status as typeof estimate.status.enumValues[number]));
            }

            const estimates = await db.query.estimate.findMany({
                where: conditions.length > 1 ? and(...conditions) : conditions[0],
                with: {
                    items: true,
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                        },
                    },
                },
                orderBy: [desc(estimate.createdAt)],
            });

            return { estimates };
        }),

    /**
     * Get estimate by ID
     * REST: GET /salesmen/estimates/:id
     */
    getEstimateById: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/estimates/{id}",
            tags: ["Salesman"],
            summary: "Get estimate by ID",
            description: "Get detailed estimate information by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;

            const estimateData = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
                with: {
                    items: true,
                    customer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                        },
                    },
                    salesman: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            });

            if (!estimateData) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            // Check permissions - salesman can only see their own
            if (estimateData.salesmanId !== userId) {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized to view this estimate" });
            }

            return { estimate: estimateData };
        }),

    /**
     * Create a new estimate
     * REST: POST /salesmen/estimates
     */
    createEstimate: salesmanProcedure
        .route({
            method: "POST",
            path: "/salesmen/estimates",
            tags: ["Salesman"],
            summary: "Create estimate",
            description: "Create a new estimate for one or more customers",
        })
        .input(writeEstimateSchema)
        .handler(async ({ context, input }) => {
            const { salesmanId, warehouseId } = getWarehouseSalesmanIds(context);
            const { customerIds, items, discountPercent, notes, validUntil } = input;

            await ensureAssignedCustomers({ warehouseId, salesmanId, customerIds });

            const resolvedLines = await resolveEstimateLines({ warehouseId, items });
            const subtotal = resolvedLines.reduce((sum, item) => sum + item.totalPrice, 0);
            const discountAmount = subtotal * (discountPercent / 100);
            const total = subtotal - discountAmount;
            const status = discountPercent > 5 ? "pending" : "sent";
            const approvedAt = status === "sent" ? new Date() : null;
            const sentAt = status === "sent" ? new Date() : null;

            // Generate estimate number: EST-YYYYMMDD-XXXX
            const generateEstimateNumber = () => {
                const date = localDateStamp();
                const random = Math.random().toString(36).slice(2, 6).toUpperCase();
                return `EST-${date}-${random}`;
            };

            let createdCount = 0;
            const createdEstimates: number[] = [];

            await db.transaction(async (tx) => {
                for (const customerId of customerIds) {
                    const estimateNumber = generateEstimateNumber();

                    // Create estimate
                    const [newEstimate] = await tx
                        .insert(estimate)
                        .values({
                            estimateNumber,
                            customerId,
                            salesmanId,
                            warehouseId,
                            subtotal: toMoney(subtotal),
                            discount: toMoney(discountAmount),
                            discountPercent: discountPercent.toFixed(2),
                            total: toMoney(total),
                            status,
                            validUntil: validUntil ? validUntil.toISOString().split("T")[0] : null,
                            notes: notes || null,
                            approvedAt,
                            sentAt,
                        })
                        .returning();

                    if (!newEstimate) {
                        continue;
                    }

                    // Insert items
                    const itemsToInsert = resolvedLines.map((item) => ({
                        estimateId: newEstimate.id,
                        productId: item.productId,
                        variantId: item.variantId,
                        productName: item.productName,
                        productImage: item.productImage,
                        productSize: item.productSize,
                        quantity: item.quantity,
                        unitPrice: toMoney(item.unitPrice),
                        discount: "0",
                        totalPrice: toMoney(item.totalPrice),
                    }));

                    await tx.insert(estimateItem).values(itemsToInsert);
                    createdEstimates.push(newEstimate.id);
                    createdCount++;
                }
            });

            if (createdCount === 0) {
                throw new ORPCError("BAD_REQUEST", { message: "No estimates created. All specified customers were not found." });
            }

            const message = createdCount === 1
                ? "Estimate created successfully"
                : `${createdCount} estimates created successfully`;

            return { success: true, message, count: createdCount, estimateIds: createdEstimates };
        }),

    /**
     * Get order by ID
     * REST: GET /salesmen/orders/:id
     */
    getOrderById: salesmanProcedure
        .route({
            method: "GET",
            path: "/salesmen/orders/{id}",
            tags: ["Salesman"],
            summary: "Get order by ID",
            description: "Get detailed order information by ID",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ input }) => {
            const orderData = await db.query.order.findFirst({
                where: eq(order.id, input.id),
                with: {
                    items: true,
                    user: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            phoneNumber: true,
                            shopName: true,
                            ownerName: true,
                        },
                    },
                },
            });

            if (!orderData) {
                throw new ORPCError("NOT_FOUND", { message: "Order not found" });
            }

            return { order: orderData };
        }),

    /**
     * Get all salesmen with stats
     * REST: GET /salesmen
     */
    getAll: adminProcedure
        .route({
            method: "GET",
            path: "/salesmen",
            tags: ["Sales Management"],
            summary: "Get all salesmen",
            description: "Get all salesmen with estimate counts and assigned customers count",
        })
        .handler(async () => {
            const salesmenData = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    createdAt: user.createdAt,
                    banned: user.banned,
                    estimatesCount: sql<number>`COALESCE((
            SELECT COUNT(*)::int FROM estimate WHERE estimate.salesman_id = "user"."id"
          ), 0)`,
                    assignedCustomersCount: sql<number>`COALESCE((
            SELECT COUNT(*)::int FROM customer_assignment WHERE customer_assignment.salesman_id = "user"."id"
          ), 0)`,
                })
                .from(user)
                .where(eq(user.role, "salesman"))
                .orderBy(user.name);

            const totalEstimates = salesmenData.reduce(
                (sum, s) => sum + (s.estimatesCount || 0),
                0
            );
            const activeCount = salesmenData.filter((s) => !s.banned).length;

            return {
                salesmen: salesmenData.map((s) => ({
                    ...s,
                    banned: s.banned || false,
                    estimatesCount: s.estimatesCount || 0,
                    assignedCustomersCount: s.assignedCustomersCount || 0,
                })),
                stats: {
                    total: salesmenData.length,
                    totalEstimates,
                    activeCount,
                },
            };
        }),

    /**
     * Get salesman by ID with assigned customers
     * REST: GET /salesmen/:id
     */
    getById: adminProcedure
        .route({
            method: "GET",
            path: "/salesmen/{id}",
            tags: ["Sales Management"],
            summary: "Get salesman by ID",
            description: "Get salesman details with their assigned customers",
        })
        .input(salesmanIdSchema)
        .handler(async ({ input }) => {
            const [salesmanData] = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    createdAt: user.createdAt,
                    banned: user.banned,
                    estimatesCount: sql<number>`COALESCE((
            SELECT COUNT(*)::int FROM estimate WHERE estimate.salesman_id = "user"."id"
          ), 0)`,
                })
                .from(user)
                .where(and(eq(user.id, input.id), eq(user.role, "salesman")));

            if (!salesmanData) {
                throw new ORPCError("NOT_FOUND", { message: "Salesman not found" });
            }

            // Get assigned customers
            const assignments = await db
                .select({
                    customerId: customerAssignment.customerId,
                    assignedAt: customerAssignment.assignedAt,
                    customerName: user.name,
                    customerEmail: user.email,
                    customerPhone: user.phoneNumber,
                    customerShopName: user.shopName,
                })
                .from(customerAssignment)
                .innerJoin(user, eq(customerAssignment.customerId, user.id))
                .where(eq(customerAssignment.salesmanId, input.id))
                .orderBy(user.name);

            const assignedCustomers = assignments.map((a) => ({
                id: a.customerId,
                name: a.customerName,
                email: a.customerEmail,
                phoneNumber: a.customerPhone,
                shopName: a.customerShopName,
                assignedAt: a.assignedAt,
            }));

            return {
                salesman: {
                    ...salesmanData,
                    banned: salesmanData.banned || false,
                    estimatesCount: salesmanData.estimatesCount || 0,
                    assignedCustomers,
                    assignedCustomersCount: assignedCustomers.length,
                },
            };
        }),

    /**
     * Get customers not assigned to any salesman
     * REST: GET /salesmen/unassigned-customers
     */
    getUnassignedCustomers: adminProcedure
        .route({
            method: "GET",
            path: "/salesmen/unassigned-customers",
            tags: ["Sales Management"],
            summary: "Get unassigned customers",
            description: "Get customers not assigned to any salesman",
        })
        .handler(async () => {
            // Get customer IDs that are already assigned
            const assignedIds = await db
                .select({ customerId: customerAssignment.customerId })
                .from(customerAssignment);

            const assignedCustomerIds = assignedIds.map((a) => a.customerId);

            // Get customers not in assigned list
            const customers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    shopName: user.shopName,
                })
                .from(user)
                .where(
                    assignedCustomerIds.length > 0
                        ? and(
                            eq(user.role, "customer"),
                            notInArray(user.id, assignedCustomerIds)
                        )
                        : eq(user.role, "customer")
                )
                .orderBy(user.name);

            return { customers };
        }),

    /**
     * Assign customers to a salesman
     * REST: POST /salesmen/assign
     */
    assignCustomers: adminProcedure
        .route({
            method: "POST",
            path: "/salesmen/assign",
            tags: ["Sales Management"],
            summary: "Assign customers",
            description: "Assign one or more customers to a salesman",
        })
        .input(assignCustomersSchema)
        .handler(async ({ input, context }) => {
            const [salesman] = await db
                .select({ warehouseId: user.warehouseId })
                .from(user)
                .where(and(eq(user.id, input.salesmanId), eq(user.role, "salesman")));

            if (!salesman?.warehouseId) {
                throw new ORPCError("NOT_FOUND", { message: "Salesman not found" });
            }
            const warehouseId = salesman.warehouseId;

            // Insert assignments
            await db.insert(customerAssignment).values(
                input.customerIds.map((customerId) => ({
                    warehouseId,
                    customerId,
                    salesmanId: input.salesmanId,
                    assignedBy: context.session.user.id,
                }))
            );

            return {
                message: `${input.customerIds.length} customer(s) assigned successfully`,
            };
        }),

    /**
     * Unassign a customer from a salesman
     * REST: DELETE /salesmen/unassign
     */
    unassignCustomer: adminProcedure
        .route({
            method: "DELETE",
            path: "/salesmen/unassign",
            tags: ["Sales Management"],
            summary: "Unassign customer",
            description: "Remove a customer assignment from a salesman",
        })
        .input(unassignCustomerSchema)
        .handler(async ({ input }) => {
            await db
                .delete(customerAssignment)
                .where(
                    and(
                        eq(customerAssignment.salesmanId, input.salesmanId),
                        eq(customerAssignment.customerId, input.customerId)
                    )
                );

            return { message: "Customer unassigned successfully" };
        }),

    /**
     * Update an existing estimate
     * REST: PUT /salesmen/estimates/:id
     */
    updateEstimate: salesmanProcedure
        .route({
            method: "PUT",
            path: "/salesmen/estimates/{id}",
            tags: ["Salesman"],
            summary: "Update estimate",
            description: "Update an existing estimate's items, discount, or metadata",
        })
        .input(updateSalesmanEstimateSchema)
        .handler(async ({ context, input }) => {
            const { salesmanId, warehouseId } = getWarehouseSalesmanIds(context);

            const existingEstimate = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
                with: { items: true },
            });

            if (!existingEstimate) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            if (existingEstimate.salesmanId !== salesmanId) {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized to update this estimate" });
            }

            if (existingEstimate.status === "converted" || existingEstimate.status === "rejected") {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Cannot update converted or rejected estimates",
                });
            }

            if (
                existingEstimate.items.some((item) => item.variantId === null) &&
                !input.items
            ) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Legacy estimates must be updated with warehouse-stock variants",
                });
            }

            const nextCustomerId = input.customerIds?.[0] ?? input.customerId;
            if (nextCustomerId) {
                await ensureAssignedCustomers({
                    warehouseId,
                    salesmanId,
                    customerIds: [nextCustomerId],
                });
            }

            const discountPercent =
                input.discountPercent ?? Number(existingEstimate.discountPercent || 0);
            const resolvedLines = input.items
                ? await resolveEstimateLines({ warehouseId, items: input.items })
                : null;
            const subtotal = resolvedLines
                ? resolvedLines.reduce((sum, item) => sum + item.totalPrice, 0)
                : Number(existingEstimate.subtotal);
            const discountAmount = subtotal * (discountPercent / 100);
            const total = subtotal - discountAmount;
            const status = discountPercent > 5 ? "pending" : "sent";
            const now = new Date();

            const updateData: Record<string, unknown> = {
                warehouseId: existingEstimate.warehouseId ?? warehouseId,
                subtotal: toMoney(subtotal),
                discount: toMoney(discountAmount),
                discountPercent: discountPercent.toFixed(2),
                total: toMoney(total),
                status,
                approvedAt: status === "sent" ? (existingEstimate.approvedAt ?? now) : null,
                sentAt: status === "sent" ? (existingEstimate.sentAt ?? now) : null,
            };

            if (nextCustomerId) updateData.customerId = nextCustomerId;
            if (input.validUntil !== undefined) {
                updateData.validUntil = input.validUntil
                    ? input.validUntil.toISOString().split("T")[0]
                    : null;
            }
            if (input.notes !== undefined) updateData.notes = input.notes;

            if (resolvedLines) {
                await db.transaction(async (tx) => {
                    await tx.update(estimate).set(updateData).where(eq(estimate.id, input.id));
                    await tx.delete(estimateItem).where(eq(estimateItem.estimateId, input.id));

                    const itemsToInsert = resolvedLines.map((item) => ({
                        estimateId: input.id,
                        productId: item.productId,
                        variantId: item.variantId,
                        productName: item.productName,
                        productImage: item.productImage,
                        productSize: item.productSize,
                        quantity: item.quantity,
                        unitPrice: toMoney(item.unitPrice),
                        discount: "0",
                        totalPrice: toMoney(item.totalPrice),
                    }));

                    await tx.insert(estimateItem).values(itemsToInsert);
                });
            } else {
                await db
                    .update(estimate)
                    .set(updateData)
                    .where(eq(estimate.id, input.id));
            }

            return { success: true };
        }),

    /**
     * Send a draft estimate (transitions to sent or pending)
     * REST: POST /salesmen/estimates/:id/send
     */
    sendEstimate: salesmanProcedure
        .route({
            method: "POST",
            path: "/salesmen/estimates/{id}/send",
            tags: ["Salesman"],
            summary: "Send estimate",
            description: "Send a draft estimate to the customer",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role;

            const existingEstimate = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
            });

            if (!existingEstimate) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            if (existingEstimate.salesmanId !== userId && userRole !== "admin") {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
            }

            if (existingEstimate.status !== "draft") {
                throw new ORPCError("BAD_REQUEST", { message: "Only draft estimates can be sent" });
            }

            const discountPercent = Number(existingEstimate.discountPercent || 0);
            const newStatus = discountPercent > 5 ? "pending" : "sent";

            const updateData: Record<string, unknown> = { status: newStatus };
            if (newStatus === "sent") {
                updateData.sentAt = new Date();
                updateData.approvedAt = existingEstimate.approvedAt ?? new Date();
            }

            await db.update(estimate).set(updateData).where(eq(estimate.id, input.id));

            return { success: true };
        }),

    /**
     * Delete an estimate
     * REST: DELETE /salesmen/estimates/:id
     */
    deleteEstimate: salesmanProcedure
        .route({
            method: "DELETE",
            path: "/salesmen/estimates/{id}",
            tags: ["Salesman"],
            summary: "Delete estimate",
            description: "Delete an estimate that hasn't been converted",
        })
        .input(z.object({ id: z.number() }))
        .handler(async ({ context, input }) => {
            const userId = context.session.user.id;
            const userRole = context.session.user.role;

            const existingEstimate = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
            });

            if (!existingEstimate) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            if (existingEstimate.salesmanId !== userId && userRole !== "admin") {
                throw new ORPCError("FORBIDDEN", { message: "Not authorized" });
            }

            if (existingEstimate.status === "converted") {
                throw new ORPCError("BAD_REQUEST", { message: "Cannot delete converted estimates" });
            }

            await db.delete(estimate).where(eq(estimate.id, input.id));

            return { success: true };
        }),

    /**
     * Convert an estimate to an order
     * REST: POST /salesmen/estimates/:id/convert
     */
    convertEstimateToOrder: salesmanProcedure
        .route({
            method: "POST",
            path: "/salesmen/estimates/{id}/convert",
            tags: ["Salesman"],
            summary: "Convert estimate to order",
            description: "Convert a sent/approved estimate into an order with stock deduction",
        })
        .input(z.object({
            id: z.number(),
            shippingName: z.string().min(1),
            shippingPhone: z.string().min(1),
            shippingAddress: z.string().min(1),
            shippingCity: z.string().min(1),
            shippingArea: z.string().optional().nullable(),
            shippingPostalCode: z.string().optional().nullable(),
            customerNote: z.string().optional().nullable(),
        }))
        .handler(async ({ context, input }) => {
            const userRole = context.session.user.role;

            if (userRole !== "admin" && userRole !== "salesman" && userRole !== "customer") {
                throw new ORPCError("FORBIDDEN", { message: "Unauthorized" });
            }

            const estimateData = await db.query.estimate.findFirst({
                where: eq(estimate.id, input.id),
                with: { items: true },
            });

            if (!estimateData) {
                throw new ORPCError("NOT_FOUND", { message: "Estimate not found" });
            }

            if (userRole === "customer" && estimateData.customerId !== context.session.user.id) {
                throw new ORPCError("FORBIDDEN", { message: "You do not own this estimate" });
            }

            // Check if customer has an active order
            const activeOrder = await db.query.order.findFirst({
                where: sql`${order.userId} = ${estimateData.customerId} 
                    AND ${order.status} NOT IN ('delivered', 'cancelled')`,
            });

            if (activeOrder) {
                throw new ORPCError("BAD_REQUEST", {
                    message: "Customer already has an active order. Please wait until it's delivered or cancelled.",
                });
            }

            if (estimateData.status === "converted") {
                throw new ORPCError("BAD_REQUEST", { message: "Estimate has already been converted" });
            }

            if (estimateData.status !== "approved" && estimateData.status !== "sent") {
                throw new ORPCError("BAD_REQUEST", {
                    message: `Only sent or approved estimates can be converted. Current status: ${estimateData.status}`,
                });
            }

            // Generate order number
            const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

            const result = await db.transaction(async (tx) => {
                const [newOrder] = await tx
                    .insert(order)
                    .values({
                        orderNumber,
                        userId: estimateData.customerId,
                        orderType: "b2b",
                        orderSource: "estimate",
                        warehouseId: estimateData.warehouseId ?? null,
                        subtotal: estimateData.subtotal,
                        discount: estimateData.discount,
                        total: estimateData.total,
                        shippingCost: "0",
                        status: "pending",
                        paymentStatus: "pending",
                        paymentMethod: "cash_on_delivery",
                        shippingName: input.shippingName,
                        shippingPhone: input.shippingPhone,
                        shippingEmail: null,
                        shippingAddress: input.shippingAddress,
                        shippingCity: input.shippingCity,
                        shippingArea: input.shippingArea || null,
                        shippingPostalCode: input.shippingPostalCode || null,
                        customerNote: input.customerNote || null,
                    })
                    .returning();

                if (!newOrder) {
                    throw new Error("Failed to create order");
                }

                // Create order items
                const orderItems = estimateData.items.map((item) => ({
                    orderId: newOrder.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    productName: item.productName,
                    productImage: item.productImage || "",
                    productSize: item.productSize || "N/A",
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                }));

                await tx.insert(orderItem).values(orderItems);


                // Stock deduction removed — stock is now tracked via the inventory system

                // Update estimate status
                await tx
                    .update(estimate)
                    .set({
                        status: "converted",
                        convertedOrderId: newOrder.id,
                        convertedAt: new Date(),
                    })
                    .where(eq(estimate.id, input.id));

                return newOrder;
            });

            return { success: true, order: result };
        }),
};

