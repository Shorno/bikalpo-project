/**
 * Warehouse ORPC Router
 *
 * Contains:
 * - Public storefront queries (anyone with the slug can browse)
 * - Management queries (warehouse role only — inventory, orders, stats)
 * - Mutations (warehouse role only — update order status)
 */

import { buildProductTypeFulfillmentProfile, db } from "@bikalpo-project/db";
import {
	countAddableBrands,
	shouldDeactivateOmittedBrands,
	validateBrandCreationSubmission,
} from "@bikalpo-project/db/brand-creation";
import {
	resolveVariantOperations,
	resolveVariantStockSemantics,
} from "@bikalpo-project/db/variant-definition";
import {
	deliveryGroup,
	deliveryGroupInvoice,
	estimate,
	inventory,
	invoice,
	order,
	orderItem,
	shopWarehouseConnection,
	user,
	warehouseWarehouseConnection,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { localDateStamp } from "../utils/date";
import {
	and,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	lte,
	ne,
	or,
	sql,
	sum,
	type SQL,
} from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, warehouseProcedure } from "../index";
import {
	ISO_DATE_PATTERN,
	validateWarehouseStockTracking,
	WarehouseExpiryValidationError,
} from "../services/warehouse-expiry";
import {
	allocateCurrentStockLots,
	unitCostFromStockEntry,
} from "../services/warehouse-stock-lots";
import { ensureWarehouseBuyerTargetVariant } from "./helpers/b2b-buyer-target";
import { convertB2bOrderToRetailInventory } from "./helpers/b2b-conversion";
import {
	markOrderCartonsDispatched,
	consumeB2bOrderReservations,
	releaseB2bOrderReservations,
	reserveB2bOrderItemsAtApproval,
} from "./helpers/b2b-inventory-movement";
import { getCartonInventoryUnits } from "./helpers/carton-units";
import { creditWarehouseExchangeOrder } from "./helpers/empty-pack-stock";
import { completeSelfPickupInvoice } from "./helpers/self-pickup";
import { buildCanonicalOrderFlow } from "./helpers/order-lifecycle";
import {
	getDeliveryAssignmentKpiBucket,
	rollUpDeliveryAreaLabel,
} from "./helpers/delivery-team-assignment";
import {
	buildInvoiceProgress,
	configureExistingInvoiceFulfillment,
	createDispatchInvoiceForOrder,
	deriveDispatchQueueStatus,
	summarizeInvoiceProgress,
} from "./helpers/order-dispatch";
import {
	isConcreteVariantOption,
	linkProductVariantsToCatalog,
	resolveConcreteVariantForConfig,
} from "./helpers/sync-generated-variants";

// ────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────

const productFiltersSchema = z.object({
	category: z.string().optional().nullable(),
	subcategory: z.string().optional().nullable(),
	brand: z.string().optional().nullable(),
	minPrice: z.string().optional().nullable(),
	maxPrice: z.string().optional().nullable(),
	inStock: z.string().optional().nullable(),
	search: z.string().optional().nullable(),
	sort: z.string().optional().nullable(),
	page: z.string().optional().default("1"),
	limit: z.string().optional().default("12"),
});

// ────────────────────────────────────────────────────────────────
// Public Storefront Queries (accessible by anyone with the slug)
// ────────────────────────────────────────────────────────────────

const storefrontQueries = {
	/**
	 * Get warehouse info by slug (public).
	 * Returns warehouse name, product count. NOT listed in any public discovery.
	 */
	getStorefrontBySlug: publicProcedure
		.route({
			method: "GET",
			path: "/warehouse/storefront/{slug}",
			tags: ["Warehouse Storefront"],
			summary: "Get warehouse storefront info by slug",
		})
		.input(z.object({ slug: z.string() }))
		.handler(async ({ input }) => {
			const warehouseUser = await db
				.select({
					id: user.id,
					name: user.name,
					warehouseName: user.warehouseName,
					warehouseSlug: user.warehouseSlug,
					warehouseAddress: user.warehouseAddress,
					image: user.image,
				})
				.from(user)
				.where(
					and(eq(user.warehouseSlug, input.slug), eq(user.role, "warehouse")),
				)
				.limit(1);

			if (warehouseUser.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
			}

			const warehouse = warehouseUser[0]!;

			// Count products in this warehouse's inventory
			const [productCount] = await db
				.select({ count: count() })
				.from(inventory)
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, warehouse.id),
					),
				);

			return {
				...warehouse,
				productCount: productCount?.count || 0,
			};
		}),

	/**
	 * Get products available in a warehouse storefront (public).
	 */
	getStorefrontProducts: publicProcedure
		.route({
			method: "GET",
			path: "/warehouse/storefront/{slug}/products",
			tags: ["Warehouse Storefront"],
			summary: "Get warehouse storefront products",
		})
		.input(
			z
				.object({
					slug: z.string(),
				})
				.merge(productFiltersSchema),
		)
		.handler(async ({ input }) => {
			const {
				slug,
				category: categorySlug,
				subcategory,
				brand: brandSlug,
				minPrice,
				maxPrice,
				search,
				sort = "newest",
				page: pageStr = "1",
				limit: limitStr = "12",
			} = input;

			// Find warehouse user
			const warehouseUser = await db
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.warehouseSlug, slug), eq(user.role, "warehouse")))
				.limit(1);

			if (warehouseUser.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
			}

			const warehouseId = warehouseUser[0]!.id;
			const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
			const limit = Math.min(
				50,
				Math.max(1, parseInt(limitStr ?? "12", 10) || 12),
			);
			const offset = (page - 1) * limit;
			const getVariantBrand = (inv: any) =>
				inv.variant?.brand ?? inv.variant?.product?.brand ?? null;
			const getGroupKey = (inv: any) => {
				const prod = inv.variant?.product;
				const brand = getVariantBrand(inv);
				return `${prod?.id ?? "unknown"}:${brand?.id ?? "no-brand"}`;
			};

			// Get inventory items for this warehouse with product details
			const warehouseInventory = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, warehouseId),
					sql`CAST(${inventory.availableQty} AS numeric) > 0`,
				),
				with: {
					variant: {
						with: {
							catalogVariant: {
								columns: { id: true, globalSku: true },
							},
							brand: {
								columns: { id: true, name: true, slug: true, logo: true },
							},
							product: {
								with: {
									brand: {
										columns: { id: true, name: true, slug: true, logo: true },
									},
									category: {
										columns: { name: true, slug: true },
										with: {
											type: {
												columns: {
													family: true,
													name: true,
													slug: true,
													inventoryBehaviour: true,
												},
											},
										},
									},
									subCategory: { columns: { name: true, slug: true } },
									images: { limit: 1 },
								},
							},
						},
					},
				},
			});

			// Filter in application layer
			const filtered = warehouseInventory.filter((inv) => {
				const prod = inv.variant?.product;
				if (!prod) return false;

				if (categorySlug) {
					if (prod.category?.slug !== categorySlug) return false;
				}
				if (subcategory) {
					const slugs = subcategory.split(",").filter(Boolean);
					if (!prod.subCategory?.slug || !slugs.includes(prod.subCategory.slug))
						return false;
				}
				if (brandSlug) {
					const itemBrand = getVariantBrand(inv);
					if (itemBrand?.slug !== brandSlug) return false;
				}
				if (search) {
					const itemBrand = getVariantBrand(inv);
					const normalizedSearch = search.toLowerCase();
					if (
						!prod.name.toLowerCase().includes(normalizedSearch) &&
						!itemBrand?.name?.toLowerCase().includes(normalizedSearch) &&
						!inv.variant?.sku?.toLowerCase().includes(normalizedSearch) &&
						!inv.variant?.catalogVariant?.globalSku
							?.toLowerCase()
							.includes(normalizedSearch)
					)
						return false;
				}
				if (minPrice) {
					if (Number(inv.variant.price) < Number(minPrice)) return false;
				}
				if (maxPrice) {
					if (Number(inv.variant.price) > Number(maxPrice)) return false;
				}
				return true;
			});

			// Group by product + brand so each card can expose multiple variants.
			const grouped = new Map<string, any[]>();
			for (const inv of filtered) {
				const key = getGroupKey(inv);
				const existing = grouped.get(key);
				if (existing) existing.push(inv);
				else grouped.set(key, [inv]);
			}

			const productCards = Array.from(grouped.values()).map((items) => {
				items.sort((a, b) => {
					const aSort = a.variant?.sortOrder ?? 0;
					const bSort = b.variant?.sortOrder ?? 0;
					if (aSort !== bSort) return aSort - bSort;
					return Number(a.variant?.price ?? 0) - Number(b.variant?.price ?? 0);
				});

				const primary = items[0]!;
				const totalAvailableQty = items.reduce(
					(sum, item) => sum + (Number(item.availableQty) || 0),
					0,
				);

				return {
					inventoryId: primary.id,
					availableQty: String(totalAvailableQty),
					retailPrice: primary.retailPrice,
					brand: getVariantBrand(primary),
					variant: primary.variant,
					product: primary.variant?.product,
					variants: items.map((inv) => {
						const productType = inv.variant?.product?.category?.type;
						const profile = buildProductTypeFulfillmentProfile({
							family: productType?.family,
							name: productType?.name,
							slug: productType?.slug,
							inventoryBehaviour: productType?.inventoryBehaviour,
							trackingType: inv.variant?.product?.trackingType,
							isReturnablePack: inv.variant?.product?.isReturnablePack,
						});
						return {
							inventoryId: inv.id,
							catalogVariantId: inv.variant?.catalogVariantId ?? null,
							globalSku: inv.variant?.catalogVariant?.globalSku ?? null,
							localSku:
								inv.variant?.preferredLocalSku ?? inv.variant?.sku ?? null,
							availableQty: inv.availableQty,
							retailPrice: inv.retailPrice,
							fulfillmentMode: profile.defaultMode,
							targetVariantId: inv.variant?.linkedRetailVariantId ?? null,
							variant: inv.variant,
						};
					}),
				};
			});

			// Sort cards by their representative variant/product.
			productCards.sort((a, b) => {
				const prodA = a.product;
				const prodB = b.product;
				if (!prodA || !prodB) return 0;
				switch (sort) {
					case "price_asc":
						return Number(a.variant.price) - Number(b.variant.price);
					case "price_desc":
						return Number(b.variant.price) - Number(a.variant.price);
					case "oldest":
						return (
							new Date(prodA.createdAt).getTime() -
							new Date(prodB.createdAt).getTime()
						);
					default:
						return (
							new Date(prodB.createdAt).getTime() -
							new Date(prodA.createdAt).getTime()
						);
				}
			});

			const totalCount = productCards.length;
			const paginated = productCards.slice(offset, offset + limit);

			return {
				products: paginated,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	/**
	 * Get categories available in a warehouse storefront (public).
	 */
	getStorefrontCategories: publicProcedure
		.route({
			method: "GET",
			path: "/warehouse/storefront/{slug}/categories",
			tags: ["Warehouse Storefront"],
			summary: "Get warehouse storefront categories",
		})
		.input(z.object({ slug: z.string() }))
		.handler(async ({ input }) => {
			// Find warehouse user
			const warehouseUser = await db
				.select({ id: user.id })
				.from(user)
				.where(
					and(eq(user.warehouseSlug, input.slug), eq(user.role, "warehouse")),
				)
				.limit(1);

			if (warehouseUser.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
			}

			const warehouseId = warehouseUser[0]!.id;

			// Get all categories that have items in this warehouse's inventory
			const inventoryItems = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, warehouseId),
					sql`CAST(${inventory.availableQty} AS numeric) > 0`,
				),
				with: {
					variant: {
						with: {
							product: {
								with: {
									category: { columns: { id: true, name: true, slug: true } },
								},
							},
						},
					},
				},
			});

			// Extract unique categories
			const categoryMap = new Map<
				number,
				{ id: number; name: string; slug: string; productCount: number }
			>();
			for (const inv of inventoryItems) {
				const cat = inv.variant?.product?.category;
				if (!cat) continue;
				const existing = categoryMap.get(cat.id);
				if (existing) {
					existing.productCount++;
				} else {
					categoryMap.set(cat.id, {
						id: cat.id,
						name: cat.name,
						slug: cat.slug,
						productCount: 1,
					});
				}
			}

			return { categories: Array.from(categoryMap.values()) };
		}),
};

// ────────────────────────────────────────────────────────────────
// Store Connections (Store Requests & Connected Stores)
// ────────────────────────────────────────────────────────────────

const storeConnectionQueries = {
	/**
	 * Get store access requests (pending, rejected, disconnected)
	 */
	getStoreRequests: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/store-requests",
			tags: ["Warehouse"],
			summary: "Get store access requests",
		})
		.input(
			z.object({
				status: z
					.enum(["all", "pending", "active", "disconnected"])
					.default("all"),
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			try {
				const userId = context.session.user.id;
				const { status, search, page, limit } = input;
				const offset = (page - 1) * limit;

				const conditions: SQL[] = [
					eq(shopWarehouseConnection.warehouseId, userId),
				];

				if (status !== "all") {
					conditions.push(eq(shopWarehouseConnection.status, status));
				}

				// Filtering by search
				let whereClause = and(...conditions);
				if (search?.trim()) {
					const s = `%${search.toLowerCase()}%`;
					whereClause = and(
						...conditions,
						sql`(LOWER(${user.shopName}) LIKE ${s} OR LOWER(${user.name}) LIKE ${s} OR ${user.phoneNumber} LIKE ${s})`,
					);
				}

				// Build two independent queries (Drizzle builders are mutable, can't reuse)
				const [items, countResult] = await Promise.all([
					db
						.select({
							connectionId: shopWarehouseConnection.id,
							status: shopWarehouseConnection.status,
							connectedAt: shopWarehouseConnection.connectedAt,
							createdAt: shopWarehouseConnection.createdAt,
							shopId: user.id,
							shopName: user.shopName,
							name: user.name,
							phone: user.phoneNumber,
							address: user.shopAddress,
							shopLat: user.shopLat,
							shopLng: user.shopLng,
							image: user.image,
						})
						.from(shopWarehouseConnection)
						.innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
						.where(whereClause!)
						.orderBy(desc(shopWarehouseConnection.createdAt))
						.limit(limit)
						.offset(offset),
					db
						.select({ count: count() })
						.from(shopWarehouseConnection)
						.innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
						.where(whereClause!),
				]);

				const totalCount = Number(countResult[0]?.count || 0);

				return {
					items,
					pagination: {
						page,
						limit,
						totalCount,
						totalPages: Math.ceil(totalCount / limit),
					},
				};
			} catch (err) {
				console.error("[getStoreRequests] ERROR:", err);
				throw err;
			}
		}),

	/**
	 * Get KPI stats for store requests
	 */
	getStoreRequestStats: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/store-requests/stats",
			tags: ["Warehouse"],
			summary: "Get stats for store access requests",
		})
		.handler(async ({ context }) => {
			try {
				const userId = context.session.user.id;

				const [stats] = await db
					.select({
						total: count(),
						pending:
							sql<number>`COALESCE(SUM(CASE WHEN ${shopWarehouseConnection.status} = 'pending' THEN 1 ELSE 0 END), 0)`.mapWith(
								Number,
							),
						approved:
							sql<number>`COALESCE(SUM(CASE WHEN ${shopWarehouseConnection.status} = 'active' THEN 1 ELSE 0 END), 0)`.mapWith(
								Number,
							),
						rejected:
							sql<number>`COALESCE(SUM(CASE WHEN ${shopWarehouseConnection.status} = 'disconnected' THEN 1 ELSE 0 END), 0)`.mapWith(
								Number,
							),
					})
					.from(shopWarehouseConnection)
					.where(eq(shopWarehouseConnection.warehouseId, userId));

				return {
					total: stats?.total ?? 0,
					pending: stats?.pending ?? 0,
					approved: stats?.approved ?? 0,
					rejected: stats?.rejected ?? 0,
				};
			} catch (err) {
				console.error("[getStoreRequestStats] ERROR:", err);
				throw err;
			}
		}),

	/**
	 * Get details for a single store request
	 */
	getStoreRequestDetail: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/store-requests/{connectionId}",
			tags: ["Warehouse"],
			summary: "Get details for a store request",
		})
		.input(z.object({ connectionId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const conn = await db
				.select({
					connectionId: shopWarehouseConnection.id,
					status: shopWarehouseConnection.status,
					connectedAt: shopWarehouseConnection.connectedAt,
					createdAt: shopWarehouseConnection.createdAt,
					shopId: user.id,
					shopName: user.shopName,
					name: user.name,
					phone: user.phoneNumber,
					address: user.shopAddress,
					shopLat: user.shopLat,
					shopLng: user.shopLng,
					area: sql<string | null>`NULL`,
					image: user.image,
				})
				.from(shopWarehouseConnection)
				.innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
				.where(
					and(
						eq(shopWarehouseConnection.id, input.connectionId),
						eq(shopWarehouseConnection.warehouseId, userId),
					),
				)
				.limit(1);

			if (conn.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Request not found" });
			}

			const shopData = conn[0]!;

			// Get total orders and spent from this shop
			const [orderStats] = await db
				.select({
					totalOrders: count(order.id),
					totalSpent: sum(order.total),
				})
				.from(order)
				.where(
					and(
						eq(order.userId, shopData.shopId),
						eq(order.warehouseId, userId),
						inArray(order.status, ["confirmed", "processing", "delivered"]),
					),
				);

			return {
				...shopData,
				totalOrders: Number(orderStats?.totalOrders || 0),
				totalSpent: Number(orderStats?.totalSpent || 0),
			};
		}),

	/**
	 * Approve a store request
	 */
	approveStoreRequest: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/store-requests/{connectionId}/approve",
			tags: ["Warehouse"],
			summary: "Approve a store request",
		})
		.input(z.object({ connectionId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await db.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.id, input.connectionId),
					eq(shopWarehouseConnection.warehouseId, userId),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Request not found" });
			}

			await db
				.update(shopWarehouseConnection)
				.set({
					status: "active",
					connectedAt: new Date(),
				})
				.where(eq(shopWarehouseConnection.id, input.connectionId));

			return { success: true, message: "Store approved" };
		}),

	/**
	 * Reject a store request
	 */
	rejectStoreRequest: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/store-requests/{connectionId}/reject",
			tags: ["Warehouse"],
			summary: "Reject a store request",
		})
		.input(z.object({ connectionId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await db.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.id, input.connectionId),
					eq(shopWarehouseConnection.warehouseId, userId),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Request not found" });
			}

			await db
				.update(shopWarehouseConnection)
				.set({
					status: "disconnected",
				})
				.where(eq(shopWarehouseConnection.id, input.connectionId));

			return { success: true, message: "Store rejected" };
		}),

	/**
	 * Get all connected stores
	 */
	getConnectedStores: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/connected-stores",
			tags: ["Warehouse"],
			summary: "Get connected stores",
		})
		.input(
			z.object({
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { search, page, limit } = input;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [
				eq(shopWarehouseConnection.warehouseId, userId),
				eq(shopWarehouseConnection.status, "active"),
			];

			// Filtering by search
			let whereClause = and(...conditions);
			if (search?.trim()) {
				const s = `%${search.toLowerCase()}%`;
				whereClause = and(
					...conditions,
					sql`(LOWER(${user.shopName}) LIKE ${s} OR LOWER(${user.name}) LIKE ${s} OR ${user.phoneNumber} LIKE ${s})`,
				);
			}

			// Build two independent queries (Drizzle builders are mutable, can't reuse)
			const [items, countResult] = await Promise.all([
				db
					.select({
						connectionId: shopWarehouseConnection.id,
						connectedAt: shopWarehouseConnection.connectedAt,
						lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
						shopId: user.id,
						shopName: user.shopName,
						name: user.name,
						phone: user.phoneNumber,
						address: user.shopAddress,
						shopLat: user.shopLat,
						shopLng: user.shopLng,
						image: user.image,
					})
					.from(shopWarehouseConnection)
					.innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
					.where(whereClause!)
					.orderBy(
						desc(shopWarehouseConnection.lastOrderedAt),
						desc(shopWarehouseConnection.connectedAt),
					)
					.limit(limit)
					.offset(offset),
				db
					.select({ count: count() })
					.from(shopWarehouseConnection)
					.innerJoin(user, eq(shopWarehouseConnection.shopId, user.id))
					.where(whereClause!),
			]);

			// Enrich with order stats for each connected store
			const enrichedItems = await Promise.all(
				items.map(async (item) => {
					const [orderStats] = await db
						.select({
							totalOrders: count(order.id),
							totalRevenue: sum(order.total),
						})
						.from(order)
						.where(
							and(
								eq(order.userId, item.shopId),
								eq(order.warehouseId, userId),
								inArray(order.status, ["confirmed", "processing", "delivered"]),
							),
						);

					return {
						...item,
						totalOrders: Number(orderStats?.totalOrders || 0),
						totalRevenue: Number(orderStats?.totalRevenue || 0),
					};
				}),
			);

			const totalCount = Number(countResult[0]?.count || 0);

			return {
				items: enrichedItems,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Warehouse Supplier Connections (Warehouse ↔ Warehouse)
// ────────────────────────────────────────────────────────────────

async function getActiveSupplierWarehouseForBuyer(
	buyerWarehouseId: string,
	warehouseKey: string,
) {
	const key = warehouseKey.trim();
	const supplierWarehouse = await db
		.select({
			id: user.id,
			name: user.name,
			warehouseName: user.warehouseName,
			warehouseSlug: user.warehouseSlug,
			warehouseAddress: user.warehouseAddress,
			phone: user.phoneNumber,
			image: user.image,
			connectionId: warehouseWarehouseConnection.id,
		})
		.from(user)
		.innerJoin(
			warehouseWarehouseConnection,
			eq(warehouseWarehouseConnection.supplierWarehouseId, user.id),
		)
		.where(
			and(
				eq(user.role, "warehouse"),
				or(eq(user.warehouseSlug, key), eq(user.id, key))!,
				eq(warehouseWarehouseConnection.buyerWarehouseId, buyerWarehouseId),
				eq(warehouseWarehouseConnection.status, "active"),
			),
		)
		.limit(1);

	if (supplierWarehouse.length === 0) {
		throw new ORPCError("FORBIDDEN", {
			message: "You must be approved by this supplier warehouse first.",
		});
	}

	const supplier = supplierWarehouse[0]!;
	if (supplier.id === buyerWarehouseId) {
		throw new ORPCError("BAD_REQUEST", {
			message: "You cannot order from your own warehouse",
		});
	}

	return supplier;
}

const warehouseSupplierConnectionQueries = {
	lookupWarehouseSupplier: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/supplier-network/lookup",
			tags: ["Warehouse"],
			summary: "Lookup a supplier warehouse by slug or id",
		})
		.input(z.object({ warehouseKey: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const currentWarehouseId = context.session.user.id;
			const key = input.warehouseKey.trim();

			const supplierWarehouse = await db
				.select({
					id: user.id,
					name: user.name,
					warehouseName: user.warehouseName,
					warehouseSlug: user.warehouseSlug,
					warehouseAddress: user.warehouseAddress,
					warehouseLat: user.warehouseLat,
					warehouseLng: user.warehouseLng,
					phone: user.phoneNumber,
					image: user.image,
				})
				.from(user)
				.where(
					and(
						eq(user.role, "warehouse"),
						or(eq(user.warehouseSlug, key), eq(user.id, key))!,
					),
				)
				.limit(1);

			if (supplierWarehouse.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
			}

			const warehouse = supplierWarehouse[0]!;
			if (warehouse.id === currentWarehouseId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "You cannot request access to your own warehouse",
				});
			}

			const [productCount] = await db
				.select({ count: count() })
				.from(inventory)
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, warehouse.id),
						sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
					),
				);

			return {
				warehouse: {
					...warehouse,
					productCount: productCount?.count || 0,
				},
			};
		}),

	requestWarehouseSupplier: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/supplier-network/request",
			tags: ["Warehouse"],
			summary: "Request supplier access from another warehouse",
		})
		.input(z.object({ warehouseKey: z.string().min(1) }))
		.handler(async ({ context, input }) => {
			const buyerWarehouseId = context.session.user.id;
			const key = input.warehouseKey.trim();

			const supplierWarehouse = await db
				.select({
					id: user.id,
					name: user.name,
					warehouseName: user.warehouseName,
					warehouseSlug: user.warehouseSlug,
					warehouseAddress: user.warehouseAddress,
				})
				.from(user)
				.where(
					and(
						eq(user.role, "warehouse"),
						or(eq(user.warehouseSlug, key), eq(user.id, key))!,
					),
				)
				.limit(1);

			if (supplierWarehouse.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Warehouse not found" });
			}

			const supplierWarehouseId = supplierWarehouse[0]!.id;
			if (supplierWarehouseId === buyerWarehouseId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "You cannot request access to your own warehouse",
				});
			}

			const existing = await db.query.warehouseWarehouseConnection.findFirst({
				where: and(
					eq(warehouseWarehouseConnection.buyerWarehouseId, buyerWarehouseId),
					eq(
						warehouseWarehouseConnection.supplierWarehouseId,
						supplierWarehouseId,
					),
				),
			});

			if (existing?.status === "active") {
				return {
					status: "already_connected" as const,
					connectionId: existing.id,
					warehouse: supplierWarehouse[0]!,
					message: "You are already connected to this supplier warehouse.",
				};
			}

			if (existing?.status === "pending") {
				return {
					status: "already_pending" as const,
					connectionId: existing.id,
					warehouse: supplierWarehouse[0]!,
					message: "Your supplier request is already pending approval.",
				};
			}

			if (existing) {
				await db
					.update(warehouseWarehouseConnection)
					.set({
						status: "pending",
						connectedAt: null,
						lastOrderedAt: null,
					})
					.where(eq(warehouseWarehouseConnection.id, existing.id));

				return {
					status: "pending" as const,
					connectionId: existing.id,
					warehouse: supplierWarehouse[0]!,
					message: "Supplier request sent successfully.",
				};
			}

			const [created] = await db
				.insert(warehouseWarehouseConnection)
				.values({
					buyerWarehouseId,
					supplierWarehouseId,
					status: "pending",
				})
				.returning();

			return {
				status: "pending" as const,
				connectionId: created!.id,
				warehouse: supplierWarehouse[0]!,
				message: "Supplier request sent successfully.",
			};
		}),

	getMyWarehouseSuppliers: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/supplier-network/my-suppliers",
			tags: ["Warehouse"],
			summary: "Get supplier warehouse connections",
		})
		.input(
			z.object({
				status: z
					.enum(["all", "active", "pending", "disconnected"])
					.default("all"),
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(50),
			}),
		)
		.handler(async ({ context, input }) => {
			const buyerWarehouseId = context.session.user.id;
			const { status, search, page, limit } = input;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [
				eq(warehouseWarehouseConnection.buyerWarehouseId, buyerWarehouseId),
			];
			if (status !== "all") {
				conditions.push(eq(warehouseWarehouseConnection.status, status));
			}

			let whereClause = and(...conditions);
			if (search?.trim()) {
				const s = `%${search.trim().toLowerCase()}%`;
				whereClause = and(
					...conditions,
					sql`(LOWER(${user.warehouseName}) LIKE ${s} OR LOWER(${user.name}) LIKE ${s} OR ${user.phoneNumber} LIKE ${s} OR LOWER(${user.warehouseSlug}) LIKE ${s})`,
				);
			}

			const [items, countResult] = await Promise.all([
				db
					.select({
						connectionId: warehouseWarehouseConnection.id,
						status: warehouseWarehouseConnection.status,
						connectedAt: warehouseWarehouseConnection.connectedAt,
						createdAt: warehouseWarehouseConnection.createdAt,
						lastOrderedAt: warehouseWarehouseConnection.lastOrderedAt,
						warehouseId: user.id,
						warehouseName: user.warehouseName,
						warehouseSlug: user.warehouseSlug,
						warehouseAddress: user.warehouseAddress,
						phone: user.phoneNumber,
						name: user.name,
						image: user.image,
					})
					.from(warehouseWarehouseConnection)
					.innerJoin(
						user,
						eq(warehouseWarehouseConnection.supplierWarehouseId, user.id),
					)
					.where(whereClause!)
					.orderBy(
						desc(warehouseWarehouseConnection.lastOrderedAt),
						desc(warehouseWarehouseConnection.connectedAt),
						desc(warehouseWarehouseConnection.createdAt),
					)
					.limit(limit)
					.offset(offset),
				db
					.select({ count: count() })
					.from(warehouseWarehouseConnection)
					.innerJoin(
						user,
						eq(warehouseWarehouseConnection.supplierWarehouseId, user.id),
					)
					.where(whereClause!),
			]);

			const enriched = await Promise.all(
				items.map(async (item) => {
					if (item.status !== "active") return { ...item, productCount: 0 };

					const [productCount] = await db
						.select({ count: count() })
						.from(inventory)
						.where(
							and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, item.warehouseId),
								sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
							),
						);

					return {
						...item,
						productCount: productCount?.count || 0,
					};
				}),
			);

			const totalCount = Number(countResult[0]?.count || 0);

			return {
				items: enriched,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	getWarehouseSupplierProducts: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/supplier-network/products",
			tags: ["Warehouse"],
			summary: "Browse approved supplier warehouse catalog",
		})
		.input(
			z.object({
				warehouseKey: z.string().min(1),
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(100),
			}),
		)
		.handler(async ({ context, input }) => {
			const buyerWarehouseId = context.session.user.id;
			const supplier = await getActiveSupplierWarehouseForBuyer(
				buyerWarehouseId,
				input.warehouseKey,
			);

			const page = Math.max(1, input.page);
			const limit = Math.min(100, Math.max(1, input.limit));
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [
				eq(inventory.ownerType, "warehouse"),
				eq(inventory.ownerId, supplier.id),
				sql`CAST(${inventory.availableQty} AS numeric) > 0`,
			];

			if (input.search?.trim()) {
				const s = `%${input.search.trim()}%`;
				conditions.push(
					or(
						ilike(productTable.name, s),
						sql`COALESCE(${productVariant.sku}, '') ILIKE ${s}`,
					)!,
				);
			}

			const where = and(...conditions);

			const [items, countResult] = await Promise.all([
				db
					.select({
						inventoryId: inventory.id,
						variantId: inventory.variantId,
						availableQty: inventory.availableQty,
						inCartonQty: inventory.inCartonQty,
						retailPrice: inventory.retailPrice,
						productId: productTable.id,
						productName: productTable.name,
						productImage: productTable.image,
						productSize: productTable.size,
						categoryName: category.name,
						variantUnitLabel: productVariant.unitLabel,
						variantWeightKg: productVariant.weightKg,
						variantSku: productVariant.sku,
						variantPrice: productVariant.price,
						variantPackType: productVariant.packType,
					})
					.from(inventory)
					.innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
					.innerJoin(
						productTable,
						eq(productVariant.productId, productTable.id),
					)
					.leftJoin(category, eq(productTable.categoryId, category.id))
					.where(where)
					.orderBy(desc(inventory.updatedAt))
					.limit(limit)
					.offset(offset),
				db
					.select({ count: count() })
					.from(inventory)
					.innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
					.innerJoin(
						productTable,
						eq(productVariant.productId, productTable.id),
					)
					.where(where),
			]);

			const products = items.map((item) => {
				const rp = Number(item.retailPrice || 0);
				const vp = Number(item.variantPrice || 0);
				const price = rp > 0 ? String(rp) : vp > 0 ? String(vp) : "0";

				return {
					inventoryId: item.inventoryId,
					variantId: item.variantId,
					availableQty: item.availableQty,
					price,
					canOrder: true,
					product: {
						id: item.productId,
						name: item.productName,
						image: item.productImage,
						size: item.productSize,
						categoryName: item.categoryName || "Uncategorized",
					},
					variant: {
						unitLabel: item.variantUnitLabel,
						weightKg: item.variantWeightKg,
						sku: item.variantSku,
						price: item.variantPrice,
						packType: item.variantPackType,
					},
				};
			});

			const totalCount = Number(countResult[0]?.count || 0);

			return {
				supplier,
				products,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	placeWarehouseSupplierOrder: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/supplier-network/orders",
			tags: ["Warehouse"],
			summary: "Place a flat warehouse-to-warehouse supplier order",
		})
		.input(
			z.object({
				warehouseKey: z.string().min(1),
				items: z
					.array(
						z.object({
							variantId: z.number().int(),
							quantity: z.number().int().min(1),
						}),
					)
					.min(1),
				shippingName: z.string().min(1),
				shippingPhone: z.string().min(1),
				shippingAddress: z.string().min(1),
				shippingCity: z.string().min(1),
				shippingArea: z.string().optional(),
				customerNote: z.string().optional(),
				paymentMethod: z
					.enum(["cash_on_delivery", "bkash", "nagad", "bank_transfer", "card"])
					.default("cash_on_delivery"),
			}),
		)
		.handler(async ({ context, input }) => {
			const buyerWarehouseId = context.session.user.id;
			const supplier = await getActiveSupplierWarehouseForBuyer(
				buyerWarehouseId,
				input.warehouseKey,
			);

			const requestedQtyByVariant = new Map<number, number>();
			for (const item of input.items) {
				requestedQtyByVariant.set(
					item.variantId,
					(requestedQtyByVariant.get(item.variantId) ?? 0) + item.quantity,
				);
			}

			const validatedItems: {
				variantId: number;
				quantity: number;
				unitPrice: string;
				totalPrice: string;
				productName: string;
				productImage: string;
				productSize: string;
				productId: number;
			}[] = [];

			for (const [variantId, quantity] of requestedQtyByVariant) {
				const inv = await db.query.inventory.findFirst({
					where: and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, supplier.id),
						eq(inventory.variantId, variantId),
					),
					with: {
						variant: {
							with: {
								product: {
									columns: { id: true, name: true, image: true, size: true },
								},
							},
						},
					},
				});

				if (!inv) {
					throw new ORPCError("NOT_FOUND", {
						message: `Variant ${variantId} is not available in this supplier warehouse`,
					});
				}

				const availableQty = Number(inv.availableQty || 0);
				if (availableQty < quantity) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Insufficient stock for ${inv.variant?.product?.name || "product"}. Available: ${availableQty}, requested: ${quantity}`,
					});
				}

				const rp = Number(inv.retailPrice || 0);
				const vp = Number(inv.variant?.price || 0);
				const unitPrice =
					rp > 0 ? inv.retailPrice! : vp > 0 ? inv.variant!.price! : "0";
				const totalPrice = (Number(unitPrice) * quantity).toFixed(2);

				validatedItems.push({
					variantId,
					quantity,
					unitPrice,
					totalPrice,
					productName: inv.variant?.product?.name || "Unknown",
					productImage: inv.variant?.product?.image || "",
					productSize:
						inv.variant?.unitLabel || inv.variant?.product?.size || "",
					productId: inv.variant?.product?.id || 0,
				});
			}

			const subtotal = validatedItems.reduce(
				(sum, item) => sum + Number(item.totalPrice),
				0,
			);
			const orderNumber = `W2W-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

			const result = await db.transaction(async (tx) => {
				const [newOrder] = await tx
					.insert(order)
					.values({
						orderNumber,
						userId: buyerWarehouseId,
						orderType: "b2b",
						orderSource: "direct",
						warehouseId: supplier.id,
						subtotal: subtotal.toFixed(2),
						total: subtotal.toFixed(2),
						status: "pending",
						paymentStatus: "pending",
						paymentMethod: input.paymentMethod,
						shippingName: input.shippingName,
						shippingPhone: input.shippingPhone,
						shippingAddress: input.shippingAddress,
						shippingCity: input.shippingCity,
						shippingArea: input.shippingArea || null,
						customerNote: input.customerNote || null,
					})
					.returning();

				for (const item of validatedItems) {
					const target = await ensureWarehouseBuyerTargetVariant(tx, {
						warehouseId: buyerWarehouseId,
						sourceVariantId: item.variantId,
					});
					await tx.insert(orderItem).values({
						orderId: newOrder!.id,
						productId: item.productId,
						variantId: item.variantId,
						targetVariantId: target.targetVariantId,
						catalogVariantId: target.sourceCatalogVariantId,
						globalSkuSnapshot: target.sourceGlobalSku,
						sourceSkuSnapshot: target.sourceLocalSku,
						targetSkuSnapshot: target.targetLocalSku,
						productName: item.productName,
						productImage: item.productImage,
						productSize: item.productSize,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						totalPrice: item.totalPrice,
						conversionStatus: "pending",
					});
				}

				await tx
					.update(warehouseWarehouseConnection)
					.set({ lastOrderedAt: new Date() })
					.where(eq(warehouseWarehouseConnection.id, supplier.connectionId));

				return newOrder!;
			});

			return {
				success: true,
				order: result,
				message: `Order ${orderNumber} placed successfully to ${supplier.warehouseName || supplier.name}`,
			};
		}),

	cancelWarehouseSupplierRequest: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/supplier-network/{connectionId}/cancel",
			tags: ["Warehouse"],
			summary: "Cancel a pending supplier warehouse request",
		})
		.input(z.object({ connectionId: z.number() }))
		.handler(async ({ context, input }) => {
			const buyerWarehouseId = context.session.user.id;

			const existing = await db.query.warehouseWarehouseConnection.findFirst({
				where: and(
					eq(warehouseWarehouseConnection.id, input.connectionId),
					eq(warehouseWarehouseConnection.buyerWarehouseId, buyerWarehouseId),
					eq(warehouseWarehouseConnection.status, "pending"),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", {
					message: "Pending request not found",
				});
			}

			await db
				.delete(warehouseWarehouseConnection)
				.where(eq(warehouseWarehouseConnection.id, input.connectionId));

			return { success: true, message: "Supplier request cancelled" };
		}),

	disconnectWarehouseSupplier: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/supplier-network/{connectionId}/disconnect",
			tags: ["Warehouse"],
			summary: "Disconnect from an active supplier warehouse",
		})
		.input(z.object({ connectionId: z.number() }))
		.handler(async ({ context, input }) => {
			const buyerWarehouseId = context.session.user.id;

			const existing = await db.query.warehouseWarehouseConnection.findFirst({
				where: and(
					eq(warehouseWarehouseConnection.id, input.connectionId),
					eq(warehouseWarehouseConnection.buyerWarehouseId, buyerWarehouseId),
					eq(warehouseWarehouseConnection.status, "active"),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", {
					message: "Active supplier not found",
				});
			}

			await db
				.update(warehouseWarehouseConnection)
				.set({ status: "disconnected" })
				.where(eq(warehouseWarehouseConnection.id, input.connectionId));

			return { success: true, message: "Supplier disconnected" };
		}),

	getWarehouseSupplierRequests: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/supplier-network/requests",
			tags: ["Warehouse"],
			summary: "Get incoming warehouse supplier requests",
		})
		.input(
			z.object({
				status: z
					.enum(["all", "pending", "active", "disconnected"])
					.default("all"),
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(50),
			}),
		)
		.handler(async ({ context, input }) => {
			const supplierWarehouseId = context.session.user.id;
			const { status, search, page, limit } = input;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [
				eq(
					warehouseWarehouseConnection.supplierWarehouseId,
					supplierWarehouseId,
				),
			];
			if (status !== "all") {
				conditions.push(eq(warehouseWarehouseConnection.status, status));
			}

			let whereClause = and(...conditions);
			if (search?.trim()) {
				const s = `%${search.trim().toLowerCase()}%`;
				whereClause = and(
					...conditions,
					sql`(LOWER(${user.warehouseName}) LIKE ${s} OR LOWER(${user.name}) LIKE ${s} OR ${user.phoneNumber} LIKE ${s} OR LOWER(${user.warehouseSlug}) LIKE ${s})`,
				);
			}

			const [items, countResult] = await Promise.all([
				db
					.select({
						connectionId: warehouseWarehouseConnection.id,
						status: warehouseWarehouseConnection.status,
						connectedAt: warehouseWarehouseConnection.connectedAt,
						createdAt: warehouseWarehouseConnection.createdAt,
						buyerWarehouseId: user.id,
						buyerWarehouseName: user.warehouseName,
						buyerWarehouseSlug: user.warehouseSlug,
						buyerWarehouseAddress: user.warehouseAddress,
						buyerWarehouseLat: user.warehouseLat,
						buyerWarehouseLng: user.warehouseLng,
						buyerName: user.name,
						buyerPhone: user.phoneNumber,
						image: user.image,
					})
					.from(warehouseWarehouseConnection)
					.innerJoin(
						user,
						eq(warehouseWarehouseConnection.buyerWarehouseId, user.id),
					)
					.where(whereClause!)
					.orderBy(desc(warehouseWarehouseConnection.createdAt))
					.limit(limit)
					.offset(offset),
				db
					.select({ count: count() })
					.from(warehouseWarehouseConnection)
					.innerJoin(
						user,
						eq(warehouseWarehouseConnection.buyerWarehouseId, user.id),
					)
					.where(whereClause!),
			]);

			const totalCount = Number(countResult[0]?.count || 0);

			return {
				items,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	getWarehouseSupplierRequestStats: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/supplier-network/requests/stats",
			tags: ["Warehouse"],
			summary: "Get incoming warehouse supplier request stats",
		})
		.handler(async ({ context }) => {
			const supplierWarehouseId = context.session.user.id;

			const [stats] = await db
				.select({
					total: count(),
					pending:
						sql<number>`COALESCE(SUM(CASE WHEN ${warehouseWarehouseConnection.status} = 'pending' THEN 1 ELSE 0 END), 0)`.mapWith(
							Number,
						),
					approved:
						sql<number>`COALESCE(SUM(CASE WHEN ${warehouseWarehouseConnection.status} = 'active' THEN 1 ELSE 0 END), 0)`.mapWith(
							Number,
						),
					rejected:
						sql<number>`COALESCE(SUM(CASE WHEN ${warehouseWarehouseConnection.status} = 'disconnected' THEN 1 ELSE 0 END), 0)`.mapWith(
							Number,
						),
				})
				.from(warehouseWarehouseConnection)
				.where(
					eq(
						warehouseWarehouseConnection.supplierWarehouseId,
						supplierWarehouseId,
					),
				);

			return {
				total: stats?.total ?? 0,
				pending: stats?.pending ?? 0,
				approved: stats?.approved ?? 0,
				rejected: stats?.rejected ?? 0,
			};
		}),

	approveWarehouseSupplierRequest: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/supplier-network/requests/{connectionId}/approve",
			tags: ["Warehouse"],
			summary: "Approve a warehouse supplier request",
		})
		.input(z.object({ connectionId: z.number() }))
		.handler(async ({ context, input }) => {
			const supplierWarehouseId = context.session.user.id;

			const existing = await db.query.warehouseWarehouseConnection.findFirst({
				where: and(
					eq(warehouseWarehouseConnection.id, input.connectionId),
					eq(
						warehouseWarehouseConnection.supplierWarehouseId,
						supplierWarehouseId,
					),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Request not found" });
			}

			await db
				.update(warehouseWarehouseConnection)
				.set({ status: "active", connectedAt: new Date() })
				.where(eq(warehouseWarehouseConnection.id, input.connectionId));

			return { success: true, message: "Warehouse supplier approved" };
		}),

	rejectWarehouseSupplierRequest: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/supplier-network/requests/{connectionId}/reject",
			tags: ["Warehouse"],
			summary: "Reject a warehouse supplier request",
		})
		.input(z.object({ connectionId: z.number() }))
		.handler(async ({ context, input }) => {
			const supplierWarehouseId = context.session.user.id;

			const existing = await db.query.warehouseWarehouseConnection.findFirst({
				where: and(
					eq(warehouseWarehouseConnection.id, input.connectionId),
					eq(
						warehouseWarehouseConnection.supplierWarehouseId,
						supplierWarehouseId,
					),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Request not found" });
			}

			await db
				.update(warehouseWarehouseConnection)
				.set({ status: "disconnected" })
				.where(eq(warehouseWarehouseConnection.id, input.connectionId));

			return { success: true, message: "Warehouse supplier request rejected" };
		}),
};

// ────────────────────────────────────────────────────────────────
// Management Queries (warehouse role only)
// ────────────────────────────────────────────────────────────────

const managementQueries = {
	/**
	 * Get warehouse's own inventory.
	 */
	getMyInventory: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/inventory",
			tags: ["Warehouse"],
			summary: "Get warehouse inventory",
		})
		.input(
			z.object({
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { search, page, limit } = input;
			const offset = (page - 1) * limit;

			const items = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
				),
				with: {
					variant: {
						with: {
							brand: { columns: { id: true, name: true } },
							product: {
								with: {
									category: { columns: { name: true, slug: true } },
									images: { limit: 1 },
								},
							},
						},
					},
				},
			});

			// Filter by search if needed
			let filtered = items;
			if (search?.trim()) {
				const s = search.toLowerCase();
				filtered = items.filter(
					(inv) =>
						inv.variant?.product?.name?.toLowerCase().includes(s) ||
						inv.variant?.sku?.toLowerCase().includes(s),
				);
			}

			const total = filtered.length;
			const paginated = filtered.slice(offset, offset + limit);

			return {
				items: paginated,
				pagination: {
					page,
					limit,
					totalCount: total,
					totalPages: Math.ceil(total / limit),
				},
			};
		}),

	/**
	 * Get dashboard summary stats for the warehouse.
	 */
	getDashboardStats: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/dashboard-stats",
			tags: ["Warehouse"],
			summary: "Get warehouse dashboard stats",
		})
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			// Total outgoing orders (shop owners / warehouses buying from this warehouse)
			const [outgoingStats] = await db
				.select({
					totalOrders: count(order.id),
					totalRevenue: sum(order.total),
				})
				.from(order)
				.where(eq(order.warehouseId, userId));

			// Pending incoming orders
			const [pendingStats] = await db
				.select({ count: count(order.id) })
				.from(order)
				.where(and(eq(order.warehouseId, userId), eq(order.status, "pending")));

			// Delivered orders
			const [deliveredStats] = await db
				.select({ count: count(order.id) })
				.from(order)
				.where(
					and(eq(order.warehouseId, userId), eq(order.status, "delivered")),
				);

			// Inventory stats
			const [inventoryStats] = await db
				.select({
					totalProducts: count(inventory.id),
					totalStock: sum(inventory.availableQty),
				})
				.from(inventory)
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, userId),
					),
				);

			return {
				totalOrders: outgoingStats?.totalOrders || 0,
				totalRevenue: Number(outgoingStats?.totalRevenue || 0),
				pendingOrders: pendingStats?.count || 0,
				deliveredOrders: deliveredStats?.count || 0,
				totalProducts: inventoryStats?.totalProducts || 0,
				totalStock: Number(inventoryStats?.totalStock || 0),
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Order Queries (warehouse role only)
// ────────────────────────────────────────────────────────────────

const orderSourceInput = z
	.enum(["all", "direct", "salesman", "estimate", "pre_order"])
	.default("all");

const orderOverviewStatusInput = z
	.enum([
		"all",
		"pending",
		"approved",
		"accepted",
		"ready_for_dispatch",
		"partially_invoiced",
		"invoiced",
		"processing",
		"rejected",
	])
	.default("all");

const orderPaymentFilterInput = z
	.enum(["all", "paid", "due", "partial"])
	.default("all");

const orderDateFilterInput = z
	.enum(["today", "this_month", "custom", "all"])
	.default("all");

type OrderTrendSource = "direct" | "salesman" | "estimate" | "preOrder";
type OrderTrendBucket = Record<OrderTrendSource, number> & { all: number };

function createOrderTrendBucket(): OrderTrendBucket {
	return { all: 0, direct: 0, salesman: 0, estimate: 0, preOrder: 0 };
}

function normalizeOrderTrendSource(
	source: string | null,
): OrderTrendSource | null {
	if (source === "direct") return "direct";
	if (source === "salesman") return "salesman";
	if (source === "estimate") return "estimate";
	if (source === "pre_order") return "preOrder";
	return null;
}

function getOrderStatusCondition(
	status: z.infer<typeof orderOverviewStatusInput>,
) {
	switch (status) {
		case "pending":
			return eq(order.status, "pending");
		case "accepted":
			return eq(order.status, "confirmed");
		case "approved":
			return inArray(order.status, ["approved", "confirmed"]);
		case "ready_for_dispatch":
			return eq(order.status, "ready_for_dispatch");
		case "partially_invoiced":
			return eq(order.status, "partially_invoiced");
		case "invoiced":
			return eq(order.status, "invoiced");
		case "processing":
			return eq(order.status, "processing");
		case "rejected":
			return eq(order.status, "cancelled");
		default:
			return null;
	}
}

function getDateFilterRange(input: {
	dateRange: z.infer<typeof orderDateFilterInput>;
	dateFrom?: string;
	dateTo?: string;
}) {
	if (input.dateRange === "all") return null;

	const now = new Date();
	let start: Date | null = null;
	let end: Date | null = null;

	if (input.dateRange === "today") {
		start = new Date(now);
		start.setHours(0, 0, 0, 0);
		end = new Date(now);
		end.setHours(23, 59, 59, 999);
	}

	if (input.dateRange === "this_month") {
		start = new Date(now.getFullYear(), now.getMonth(), 1);
		end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
		end.setHours(23, 59, 59, 999);
	}

	if (input.dateRange === "custom") {
		start = input.dateFrom ? new Date(input.dateFrom) : null;
		end = input.dateTo ? new Date(input.dateTo) : null;
		if (start) start.setHours(0, 0, 0, 0);
		if (end) end.setHours(23, 59, 59, 999);
	}

	return { start, end };
}

function getEffectiveItemQty(item: {
	quantity: number;
	modifiedQty: number | null;
}) {
	return item.modifiedQty ?? item.quantity;
}

function getEffectiveItemPrice(item: {
	unitPrice: string;
	modifiedUnitPrice: string | null;
}) {
	return item.modifiedUnitPrice ?? item.unitPrice;
}

function toNumber(value: unknown) {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
	return Math.round(value * 100) / 100;
}

function formatMoneyValue(value: number) {
	return roundMoney(Math.max(0, value)).toFixed(2);
}

function getOrderDiscountPercent(
	orderData: {
		orderSource: string | null;
		subtotal: string;
		discount: string;
	},
	sourceEstimate?: { discountPercent: string | null } | null,
) {
	const estimateDiscountPercent = toNumber(sourceEstimate?.discountPercent);
	if (orderData.orderSource === "estimate" && estimateDiscountPercent > 0) {
		return estimateDiscountPercent;
	}

	const orderSubtotal = toNumber(orderData.subtotal);
	if (orderSubtotal <= 0) return 0;

	return (toNumber(orderData.discount) / orderSubtotal) * 100;
}

function buildOrderPricingSummary({
	orderData,
	approvedSubtotal,
	sourceEstimate,
}: {
	orderData: {
		orderSource: string | null;
		subtotal: string;
		discount: string;
		shippingCost: string;
	};
	approvedSubtotal: number;
	sourceEstimate?: { discountPercent: string | null } | null;
}) {
	const subtotal = roundMoney(Math.max(0, approvedSubtotal));
	const discountPercent = Math.max(
		0,
		getOrderDiscountPercent(orderData, sourceEstimate),
	);
	const discountAmount = Math.min(
		subtotal,
		roundMoney(subtotal * (discountPercent / 100)),
	);
	const shippingCost = roundMoney(
		Math.max(0, toNumber(orderData.shippingCost)),
	);
	const finalTotal = Math.max(
		0,
		roundMoney(subtotal - discountAmount + shippingCost),
	);

	return {
		approvedSubtotal: subtotal.toFixed(2),
		discountAmount: discountAmount.toFixed(2),
		discountPercent: discountPercent.toFixed(2),
		shippingCost: shippingCost.toFixed(2),
		finalTotal: formatMoneyValue(finalTotal),
		hasDiscount: discountAmount > 0,
	};
}

const deliveryManagementKpiInput = z
	.enum(["all", "pending", "in_delivery", "delivered"])
	.default("all");

const deliveryManagementTypeInput = z
	.enum(["all", "not_selected", "internal", "third_party"])
	.default("all");

const deliveryManagementStatusInput = z
	.enum(["all", "pending", "locked", "in_delivery", "delivered"])
	.default("all");

type DeliveryManagementType = "not_selected" | "internal" | "third_party";
type DeliveryManagementStatus =
	| "pending"
	| "locked"
	| "in_delivery"
	| "delivered";
type DeliveryManagementKpi = "pending" | "in_delivery" | "delivered";

type DeliveryManagementLink = {
	invoiceId: number;
	groupId: number;
	groupName: string;
	groupStatus: string;
	deliverymanId: string | null;
	deliverymanName: string | null;
	deliverymanPhone: string | null;
};

function getDeliveryManagementType(
	fulfillmentMode: string | null,
): DeliveryManagementType {
	if (fulfillmentMode === "internal_delivery") return "internal";
	if (fulfillmentMode === "third_party") return "third_party";
	return "not_selected";
}

function getDeliveryManagementDisplayStatus(input: {
	deliveryType: DeliveryManagementType;
	deliveryStatus: string | null;
	group: DeliveryManagementLink | null;
}): DeliveryManagementStatus {
	if (
		input.deliveryStatus === "delivered" ||
		input.group?.groupStatus === "completed"
	) {
		return "delivered";
	}

	if (input.deliveryType === "not_selected") return "pending";

	if (!input.group && input.deliveryStatus === "not_assigned") {
		return "locked";
	}

	return "in_delivery";
}

function getDeliveryManagementKpi(input: {
	deliveryType: DeliveryManagementType;
	displayStatus: DeliveryManagementStatus;
}): DeliveryManagementKpi {
	if (input.displayStatus === "delivered") return "delivered";
	if (input.deliveryType === "not_selected") return "pending";
	return "in_delivery";
}

function getDeliveryManagementDateFilterRange(input: {
	dateRange: "today" | "this_month" | "all";
}) {
	if (input.dateRange === "all") return null;

	const now = new Date();
	const start = new Date(now);
	const end = new Date(now);

	if (input.dateRange === "today") {
		start.setHours(0, 0, 0, 0);
		end.setHours(23, 59, 59, 999);
		return { start, end };
	}

	start.setDate(1);
	start.setHours(0, 0, 0, 0);
	end.setMonth(now.getMonth() + 1, 0);
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

const orderQueries = {
	/**
	 * Direct order overview for warehouse order management.
	 */
	getOrderOverview: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/order-management",
			tags: ["Warehouse"],
			summary: "Get order management overview",
		})
		.input(
			z.object({
				source: orderSourceInput,
				status: orderOverviewStatusInput,
				payment: orderPaymentFilterInput,
				dateRange: orderDateFilterInput,
				dateFrom: z.string().optional(),
				dateTo: z.string().optional(),
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const page = Math.max(1, input.page);
			const limit = Math.min(100, Math.max(1, input.limit));
			const offset = (page - 1) * limit;

			const warehouseUser = await db.query.user.findFirst({
				where: eq(user.id, userId),
				columns: { name: true, warehouseName: true },
			});

			const baseConditions: SQL[] = [
				eq(order.warehouseId, userId),
				eq(order.orderType, "b2b"),
			];
			const trendToday = new Date();
			trendToday.setHours(0, 0, 0, 0);
			const trendStart = new Date(trendToday);
			trendStart.setDate(trendToday.getDate() - 13);

			const sourceSummary = await db
				.select({
					direct:
						sql<number>`COUNT(*) FILTER (WHERE ${order.orderSource} = 'direct')`.mapWith(
							Number,
						),
					salesman:
						sql<number>`COUNT(*) FILTER (WHERE ${order.orderSource} = 'salesman')`.mapWith(
							Number,
						),
					estimate:
						sql<number>`COUNT(*) FILTER (WHERE ${order.orderSource} = 'estimate')`.mapWith(
							Number,
						),
					preOrder:
						sql<number>`COUNT(*) FILTER (WHERE ${order.orderSource} = 'pre_order')`.mapWith(
							Number,
						),
				})
				.from(order)
				.where(and(...baseConditions));

			const conditions: SQL[] = [...baseConditions];

			if (input.source !== "all") {
				conditions.push(eq(order.orderSource, input.source));
			}

			const statusCondition = getOrderStatusCondition(input.status);
			if (statusCondition) conditions.push(statusCondition);

			if (input.payment === "paid") {
				conditions.push(eq(order.paymentStatus, "paid"));
			} else if (input.payment === "due") {
				conditions.push(eq(order.paymentStatus, "pending"));
			} else if (input.payment === "partial") {
				conditions.push(sql`false`);
			}

			const dateRange = getDateFilterRange(input);
			if (dateRange?.start)
				conditions.push(gte(order.createdAt, dateRange.start));
			if (dateRange?.end) conditions.push(lte(order.createdAt, dateRange.end));

			if (input.search?.trim()) {
				const term = `%${input.search.trim()}%`;
				conditions.push(
					or(
						ilike(order.orderNumber, term),
						ilike(order.shippingName, term),
						ilike(order.shippingPhone, term),
						ilike(user.name, term),
						ilike(user.shopName, term),
						ilike(user.warehouseName, term),
					)!,
				);
			}

			const where = and(...conditions);

			const [orders, countResult, trendOrders] = await Promise.all([
				db
					.select({
						id: order.id,
						orderNumber: order.orderNumber,
						orderSource: order.orderSource,
						status: order.status,
						total: order.total,
						subtotal: order.subtotal,
						paymentMethod: order.paymentMethod,
						paymentStatus: order.paymentStatus,
						shippingName: order.shippingName,
						shippingPhone: order.shippingPhone,
						shippingCity: order.shippingCity,
						shippingArea: order.shippingArea,
						createdAt: order.createdAt,
						confirmedAt: order.confirmedAt,
						processingStartedAt: order.processingStartedAt,
						packingStartedAt: order.packingStartedAt,
						readyAt: order.readyAt,
						deliveredAt: order.deliveredAt,
						modifiedByWarehouseAt: order.modifiedByWarehouseAt,
						modificationAcceptedAt: order.modificationAcceptedAt,
						buyerId: order.userId,
						buyerName: user.name,
						buyerShopName: user.shopName,
						buyerWarehouseName: user.warehouseName,
					})
					.from(order)
					.leftJoin(user, eq(order.userId, user.id))
					.where(where)
					.orderBy(desc(order.createdAt))
					.limit(limit)
					.offset(offset),
				db
					.select({ count: count() })
					.from(order)
					.leftJoin(user, eq(order.userId, user.id))
					.where(where),
				db
					.select({
						createdAt: order.createdAt,
						orderSource: order.orderSource,
					})
					.from(order)
					.where(and(...baseConditions, gte(order.createdAt, trendStart))),
			]);

			const orderIds = orders.map((o) => o.id);
			const [items, orderInvoices] = orderIds.length
				? await Promise.all([
						db
							.select({
								orderId: orderItem.orderId,
								id: orderItem.id,
								productName: orderItem.productName,
							})
							.from(orderItem)
							.where(inArray(orderItem.orderId, orderIds)),
						db
							.select({
								id: invoice.id,
								orderId: invoice.orderId,
								invoiceNumber: invoice.invoiceNumber,
								deliveryStatus: invoice.deliveryStatus,
								paymentStatus: invoice.paymentStatus,
								fulfillmentMode: invoice.fulfillmentMode,
								completionOtpVerifiedAt: invoice.completionOtpVerifiedAt,
								deliverymanId: invoice.deliverymanId,
								createdAt: invoice.createdAt,
							})
							.from(invoice)
							.where(
								and(
									inArray(invoice.orderId, orderIds),
									eq(invoice.invoiceType, "main"),
								),
							),
					])
				: [[], []];

			const invoiceIds = orderInvoices.map((item) => item.id);
			const deliveryLinks = invoiceIds.length
				? await db
						.select({
							invoiceId: deliveryGroupInvoice.invoiceId,
							groupId: deliveryGroup.id,
							groupName: deliveryGroup.groupName,
							groupStatus: deliveryGroup.status,
							deliverymanId: deliveryGroup.deliverymanId,
						})
						.from(deliveryGroupInvoice)
						.innerJoin(
							deliveryGroup,
							eq(deliveryGroupInvoice.groupId, deliveryGroup.id),
						)
						.where(inArray(deliveryGroupInvoice.invoiceId, invoiceIds))
				: [];

			const itemCounts = new Map<number, number>();
			const firstItems = new Map<number, string>();
			for (const item of items) {
				itemCounts.set(item.orderId, (itemCounts.get(item.orderId) ?? 0) + 1);
				if (!firstItems.has(item.orderId))
					firstItems.set(item.orderId, item.productName);
			}

			const invoiceByOrderId = new Map(
				orderInvoices.map((item) => [item.orderId, item]),
			);
			const deliveryByInvoiceId = new Map(
				deliveryLinks.map((item) => [item.invoiceId, item]),
			);

			const totalCount = Number(countResult[0]?.count) || 0;
			const summary = sourceSummary[0] ?? {
				direct: 0,
				salesman: 0,
				estimate: 0,
				preOrder: 0,
			};
			const trendBuckets = new Map<string, OrderTrendBucket>();
			const trendDays = Array.from({ length: 14 }, (_, index) => {
				const date = new Date(trendStart);
				date.setDate(trendStart.getDate() + index);
				const key = localDateStamp(date);
				trendBuckets.set(key, createOrderTrendBucket());
				return {
					key,
					label: date.toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
					}),
				};
			});

			for (const trendOrder of trendOrders) {
				const sourceKey = normalizeOrderTrendSource(trendOrder.orderSource);
				if (!sourceKey) continue;
				const bucket = trendBuckets.get(localDateStamp(trendOrder.createdAt));
				if (!bucket) continue;
				bucket.all += 1;
				bucket[sourceKey] += 1;
			}

			const trendSummary = {
				current: createOrderTrendBucket(),
				previous: createOrderTrendBucket(),
			};
			for (const [index, day] of trendDays.entries()) {
				const bucket = trendBuckets.get(day.key) ?? createOrderTrendBucket();
				const target = index < 7 ? trendSummary.previous : trendSummary.current;
				target.all += bucket.all;
				target.direct += bucket.direct;
				target.salesman += bucket.salesman;
				target.estimate += bucket.estimate;
				target.preOrder += bucket.preOrder;
			}

			return {
				warehouse: {
					label:
						warehouseUser?.warehouseName || warehouseUser?.name || "Warehouse",
				},
				summary,
				trend: trendDays.slice(7).map((day) => ({
					date: day.key,
					label: day.label,
					...(trendBuckets.get(day.key) ?? createOrderTrendBucket()),
				})),
				trendSummary,
				orders: orders.map((o) => {
					const rowInvoice = invoiceByOrderId.get(o.id);
					const rowDelivery = rowInvoice
						? deliveryByInvoiceId.get(rowInvoice.id)
						: null;

					return {
						...o,
						customerName:
							o.buyerWarehouseName ||
							o.buyerShopName ||
							o.buyerName ||
							o.shippingName,
						itemCount: itemCounts.get(o.id) ?? 0,
						firstItemName: firstItems.get(o.id) ?? null,
						requiresBuyerAcceptance:
							!!o.modifiedByWarehouseAt &&
							!o.modificationAcceptedAt &&
							o.status !== "cancelled",
						invoicePrepared: !!rowInvoice,
						invoiceNumber: rowInvoice?.invoiceNumber ?? null,
						invoiceDeliveryStatus: rowInvoice?.deliveryStatus ?? null,
						invoicePaymentStatus: rowInvoice?.paymentStatus ?? null,
						invoiceFulfillmentMode: rowInvoice?.fulfillmentMode ?? null,
						deliveryGroupId: rowDelivery?.groupId ?? null,
						deliveryGroupName: rowDelivery?.groupName ?? null,
						deliveryGroupStatus: rowDelivery?.groupStatus ?? null,
						deliverymanId:
							rowDelivery?.deliverymanId ?? rowInvoice?.deliverymanId ?? null,
					};
				}),
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	/**
	 * Direct order detail for warehouse approval and dispatch preparation.
	 */
	getOrderDetail: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/order-management/{orderId}",
			tags: ["Warehouse"],
			summary: "Get order management detail",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const warehouseUser = await db.query.user.findFirst({
				where: eq(user.id, userId),
				columns: { name: true, warehouseName: true },
			});

			const orderData = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.warehouseId, userId),
					eq(order.orderType, "b2b"),
				),
				with: {
					user: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
							shopName: true,
							shopAddress: true,
							warehouseName: true,
							warehouseAddress: true,
						},
					},
					items: {
						with: {
							product: {
								columns: {
									id: true,
									name: true,
									image: true,
								},
							},
							variant: {
								columns: {
									id: true,
									sku: true,
									unitLabel: true,
									weightKg: true,
									packType: true,
								},
							},
						},
					},
				},
			});

			if (!orderData) {
				throw new ORPCError("NOT_FOUND", { message: "Order not found" });
			}

			const sourceEstimate =
				orderData.orderSource === "estimate"
					? await db.query.estimate.findFirst({
							where: and(
								eq(estimate.convertedOrderId, orderData.id),
								eq(estimate.warehouseId, userId),
							),
							columns: {
								id: true,
								estimateNumber: true,
								discountPercent: true,
							},
						})
					: null;

			const variantIds = orderData.items
				.map((item) => item.variantId)
				.filter((id): id is number => id !== null);

			const inventoryRows = variantIds.length
				? await db
						.select({
							id: inventory.id,
							variantId: inventory.variantId,
							availableQty: inventory.availableQty,
							reservedQty: inventory.reservedQty,
						})
						.from(inventory)
						.where(
							and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, userId),
								inArray(inventory.variantId, variantIds),
							),
						)
				: [];

			const inventoryByVariant = new Map(
				inventoryRows.map((row) => [row.variantId, row]),
			);

			const invoices = await db.query.invoice.findMany({
				where: eq(invoice.orderId, orderData.id),
				with: {
					items: true,
					deliveryman: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
						},
					},
				},
				orderBy: [desc(invoice.createdAt)],
			});

			const invoiceIds = invoices.map((item) => item.id);
			const deliveryLinks = invoiceIds.length
				? await db
						.select({
							invoiceId: deliveryGroupInvoice.invoiceId,
							groupId: deliveryGroup.id,
							groupName: deliveryGroup.groupName,
							groupStatus: deliveryGroup.status,
							deliverymanId: deliveryGroup.deliverymanId,
							assignedAt: deliveryGroup.assignedAt,
							startedAt: deliveryGroup.startedAt,
							invoiceStatus: deliveryGroupInvoice.status,
							deliveredAt: deliveryGroupInvoice.deliveredAt,
							deliverymanName: user.name,
							deliverymanPhone: user.phoneNumber,
						})
						.from(deliveryGroupInvoice)
						.innerJoin(
							deliveryGroup,
							eq(deliveryGroupInvoice.groupId, deliveryGroup.id),
						)
						.leftJoin(user, eq(deliveryGroup.deliverymanId, user.id))
						.where(inArray(deliveryGroupInvoice.invoiceId, invoiceIds))
				: [];

			const currentInvoice = invoices[0] ?? null;
			const currentDelivery = currentInvoice
				? (deliveryLinks.find((row) => row.invoiceId === currentInvoice.id) ??
					null)
				: null;

			const items = orderData.items.map((item) => {
				const stock = item.variantId
					? inventoryByVariant.get(item.variantId)
					: undefined;
				const approvedQty = getEffectiveItemQty(item);
				const effectivePrice = Number(getEffectiveItemPrice(item));

				return {
					...item,
					approvedQty,
					approvedTotal: (approvedQty * effectivePrice).toFixed(2),
					stock: {
						availableQty: stock?.availableQty ?? "0",
						reservedQty: stock?.reservedQty ?? "0",
					},
				};
			});

			const finalApprovedTotal = items.reduce(
				(sumValue, item) => sumValue + Number(item.approvedTotal),
				0,
			);
			const approvedQtyTotal = items.reduce(
				(sumValue, item) => sumValue + item.approvedQty,
				0,
			);
			const invoicedQty = invoices.reduce(
				(sumValue, invoiceData) =>
					sumValue +
					invoiceData.items.reduce(
						(itemSum, invoiceItem) => itemSum + Number(invoiceItem.quantity),
						0,
					),
				0,
			);
			const pricingSummary = buildOrderPricingSummary({
				orderData,
				approvedSubtotal: finalApprovedTotal,
				sourceEstimate,
			});
			const invoiceProgress = {
				approvedQty: approvedQtyTotal,
				invoicedQty,
				remainingQty: Math.max(0, approvedQtyTotal - invoicedQty),
			};

			const requiresBuyerAcceptance =
				!!orderData.modifiedByWarehouseAt &&
				!orderData.modificationAcceptedAt &&
				!orderData.modificationRejectedAt &&
				orderData.status !== "cancelled";

			const isLegacyDispatchReady =
				["approved", "confirmed"].includes(orderData.status) &&
				!requiresBuyerAcceptance;
			const canPrepareDispatch = isLegacyDispatchReady && !currentInvoice;
			const canOpenDispatch =
				canPrepareDispatch ||
				["ready_for_dispatch", "partially_invoiced", "invoiced"].includes(
					orderData.status,
				) ||
				!!currentInvoice;

			return {
				warehouse: {
					label:
						warehouseUser?.warehouseName || warehouseUser?.name || "Warehouse",
				},
				order: {
					...orderData,
					customerName:
						orderData.user?.warehouseName ||
						orderData.user?.shopName ||
						orderData.user?.name ||
						orderData.shippingName,
					customerPhone: orderData.user?.phoneNumber || orderData.shippingPhone,
					items,
					finalApprovedTotal: pricingSummary.finalTotal,
					pricingSummary,
					invoiceProgress,
					requiresBuyerAcceptance,
					canPrepareDispatch,
					canOpenDispatch,
				},
				pricingSummary,
				sourceEstimate: sourceEstimate
					? {
							id: sourceEstimate.id,
							estimateNumber: sourceEstimate.estimateNumber,
							discountPercent: sourceEstimate.discountPercent,
						}
					: null,
				invoice: currentInvoice
					? {
							id: currentInvoice.id,
							invoiceNumber: currentInvoice.invoiceNumber,
							deliveryStatus: currentInvoice.deliveryStatus,
							paymentStatus: currentInvoice.paymentStatus,
							fulfillmentMode: currentInvoice.fulfillmentMode,
							completionOtp: currentInvoice.completionOtp,
							completionOtpVerifiedAt: currentInvoice.completionOtpVerifiedAt,
							settledAt: currentInvoice.settledAt,
							deliveryman: currentInvoice.deliveryman,
						}
					: null,
				delivery: currentDelivery,
				flow: buildCanonicalOrderFlow({
					order: orderData,
					invoices,
					deliveryLinks,
				}),
			};
		}),

	/**
	 * Accept/modify or reject a pending direct order.
	 */
	reviewOrder: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/order-management/review",
			tags: ["Warehouse"],
			summary: "Review direct order",
		})
		.input(
			z.object({
				orderId: z.number(),
				decision: z.enum(["accept", "reject"]),
				items: z
					.array(
						z.object({
							itemId: z.number(),
							approvedQty: z.number().int().min(0),
						}),
					)
					.optional(),
				approvalNote: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.warehouseId, userId),
					inArray(order.orderSource, ["direct", "estimate"]),
				),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", { message: "Order not found" });
			}

			if (existingOrder.status !== "pending") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only pending orders can be reviewed",
				});
			}

			if (input.decision === "reject") {
				await db
					.update(order)
					.set({
						status: "cancelled",
						cancelledAt: new Date(),
						adminNote: input.approvalNote || existingOrder.adminNote,
					})
					.where(eq(order.id, existingOrder.id));

				return {
					success: true,
					message: `Order ${existingOrder.orderNumber} rejected`,
				};
			}

			const approvedQtyByItem = new Map(
				(input.items ?? []).map((item) => [item.itemId, item.approvedQty]),
			);

			const reviewItems = existingOrder.items.map((item) => {
				const approvedQty = approvedQtyByItem.get(item.id) ?? item.quantity;
				if (approvedQty > item.quantity) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Approved quantity cannot exceed ordered quantity for ${item.productName}`,
					});
				}
				return { item, approvedQty };
			});

			const approvedTotalQty = reviewItems.reduce(
				(sumValue, item) => sumValue + item.approvedQty,
				0,
			);

			if (approvedTotalQty <= 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "At least one item quantity must be approved",
				});
			}

			const variantIds = reviewItems
				.map(({ item }) => item.variantId)
				.filter((id): id is number => id !== null);

			const inventoryRows = variantIds.length
				? await db
						.select()
						.from(inventory)
						.where(
							and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, userId),
								inArray(inventory.variantId, variantIds),
							),
						)
				: [];

			const inventoryByVariant = new Map(
				inventoryRows.map((row) => [row.variantId, row]),
			);

			for (const { item, approvedQty } of reviewItems) {
				if (approvedQty <= 0) continue;
				if (!item.variantId) {
					throw new ORPCError("BAD_REQUEST", {
						message: `${item.productName} has no variant for stock reservation`,
					});
				}
				const stock = inventoryByVariant.get(item.variantId);
				if (!stock) {
					throw new ORPCError("BAD_REQUEST", {
						message: `No warehouse inventory exists for ${item.productName}`,
					});
				}
			}

			const hasModifications = reviewItems.some(
				({ item, approvedQty }) => approvedQty !== item.quantity,
			);
			const approvedSubtotal = reviewItems.reduce(
				(sumValue, { item, approvedQty }) =>
					sumValue + approvedQty * Number(getEffectiveItemPrice(item)),
				0,
			);
			const sourceEstimate =
				existingOrder.orderSource === "estimate"
					? await db.query.estimate.findFirst({
							where: and(
								eq(estimate.convertedOrderId, existingOrder.id),
								eq(estimate.warehouseId, userId),
							),
							columns: {
								discountPercent: true,
							},
						})
					: null;
			const pricingSummary = buildOrderPricingSummary({
				orderData: existingOrder,
				approvedSubtotal,
				sourceEstimate,
			});

			try {
				await db.transaction(async (tx) => {
					for (const { item, approvedQty } of reviewItems) {
						await tx
							.update(orderItem)
							.set({
								modifiedQty: approvedQty !== item.quantity ? approvedQty : null,
								modifiedUnitPrice: null,
							})
							.where(eq(orderItem.id, item.id));
					}

					await reserveB2bOrderItemsAtApproval(tx, {
						warehouseId: userId,
						lines: reviewItems,
					});

					const confirmed = await tx
						.update(order)
						.set({
							status: hasModifications ? "approved" : "ready_for_dispatch",
							subtotal: pricingSummary.approvedSubtotal,
							discount: pricingSummary.discountAmount,
							total: pricingSummary.finalTotal,
							confirmedSubtotal: pricingSummary.approvedSubtotal,
							confirmedTotal: pricingSummary.finalTotal,
							confirmedAt: new Date(),
							readyAt: hasModifications
								? existingOrder.readyAt
								: (existingOrder.readyAt ?? new Date()),
							modifiedByWarehouseAt: hasModifications ? new Date() : null,
							modificationAcceptedAt: null,
							modificationRejectedAt: null,
							adminNote: input.approvalNote || existingOrder.adminNote,
						})
						.where(
							and(eq(order.id, existingOrder.id), eq(order.status, "pending")),
						)
						.returning({ id: order.id });
					if (confirmed.length === 0) {
						throw new ORPCError("BAD_REQUEST", {
							message: "Order was already reviewed by another request",
						});
					}
				});
			} catch (error) {
				if (error instanceof ORPCError) throw error;
				throw new ORPCError("BAD_REQUEST", {
					message:
						error instanceof Error
							? error.message
							: "Unable to reserve warehouse inventory",
				});
			}

			return {
				success: true,
				modified: hasModifications,
				message: hasModifications
					? `Order ${existingOrder.orderNumber} accepted with quantity changes`
					: `Order ${existingOrder.orderNumber} is ready for dispatch`,
			};
		}),

	/**
	 * Compatibility endpoint for legacy approved/confirmed orders.
	 * Invoice creation belongs to the Dispatch board.
	 */
	prepareOrderForDispatch: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/order-management/prepare-dispatch",
			tags: ["Warehouse"],
			summary: "Prepare direct order for dispatch",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.warehouseId, userId),
					inArray(order.orderSource, ["direct", "estimate"]),
				),
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", { message: "Order not found" });
			}

			if (
				!["approved", "confirmed", "ready_for_dispatch"].includes(
					existingOrder.status,
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Only accepted orders can be prepared for dispatch",
				});
			}

			if (
				existingOrder.modifiedByWarehouseAt &&
				!existingOrder.modificationAcceptedAt &&
				!existingOrder.modificationRejectedAt
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Buyer must accept the modified quantities before dispatch",
				});
			}

			const [updatedOrder] = await db
				.update(order)
				.set({
					status: "ready_for_dispatch",
					readyAt: existingOrder.readyAt ?? new Date(),
				})
				.where(eq(order.id, input.orderId))
				.returning();

			return {
				success: true,
				order: updatedOrder,
				message: `Order ${existingOrder.orderNumber} is ready for dispatch`,
			};
		}),

	/**
	 * Get dispatch queues for fulfillment mode selection and self pickup.
	 */
	getDispatchDashboard: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/dispatch/dashboard",
			tags: ["Warehouse"],
			summary: "Get dispatch dashboard queues",
		})
		.handler(async ({ context }) => {
			const userId = context.session.user.id;
			const dispatchOrders = await db.query.order.findMany({
				where: and(
					eq(order.warehouseId, userId),
					eq(order.orderType, "b2b"),
					inArray(order.status, [
						"approved",
						"confirmed",
						"ready_for_dispatch",
						"partially_invoiced",
						"invoiced",
					]),
					or(
						sql`${order.modifiedByWarehouseAt} IS NULL`,
						sql`${order.modificationAcceptedAt} IS NOT NULL`,
					),
				),
				with: {
					user: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
							shopName: true,
							warehouseName: true,
						},
					},
					items: true,
				},
				orderBy: [desc(order.readyAt), desc(order.createdAt)],
			});

			const orderIds = dispatchOrders.map((row) => row.id);
			const orderInvoices = orderIds.length
				? await db.query.invoice.findMany({
						where: inArray(invoice.orderId, orderIds),
						with: { items: true },
						orderBy: [desc(invoice.createdAt)],
					})
				: [];
			const invoicesByOrderId = new Map<number, typeof orderInvoices>();
			for (const invoiceRow of orderInvoices) {
				const rows = invoicesByOrderId.get(invoiceRow.orderId) ?? [];
				rows.push(invoiceRow);
				invoicesByOrderId.set(invoiceRow.orderId, rows);
			}

			const cards = dispatchOrders.map((orderRow) => {
				const invoices = invoicesByOrderId.get(orderRow.id) ?? [];
				const progressItems = buildInvoiceProgress(orderRow.items, invoices);
				const progress = summarizeInvoiceProgress(progressItems);
				const normalizedStatus = deriveDispatchQueueStatus(
					progress,
					invoices.length,
				);

				return {
					id: orderRow.id,
					orderNumber: orderRow.orderNumber,
					status: normalizedStatus,
					createdAt: orderRow.createdAt,
					readyAt: orderRow.readyAt,
					customer: {
						id: orderRow.user?.id ?? orderRow.userId,
						name: orderRow.user?.name ?? orderRow.shippingName,
						phoneNumber: orderRow.user?.phoneNumber ?? orderRow.shippingPhone,
						shopName: orderRow.user?.shopName ?? null,
						warehouseName: orderRow.user?.warehouseName ?? null,
					},
					shipping: {
						name: orderRow.shippingName,
						phone: orderRow.shippingPhone,
						address: orderRow.shippingAddress,
						city: orderRow.shippingCity,
						area: orderRow.shippingArea,
					},
					progress: {
						...progress,
						approvedTotal: formatMoneyValue(progress.approvedTotal),
						invoicedTotal: formatMoneyValue(progress.invoicedTotal),
						remainingTotal: formatMoneyValue(progress.remainingTotal),
					},
					items: progressItems,
					invoices: invoices.map((invoiceRow) => ({
						id: invoiceRow.id,
						invoiceNumber: invoiceRow.invoiceNumber,
						invoiceType: invoiceRow.invoiceType,
						splitSequence: invoiceRow.splitSequence,
						grandTotal: invoiceRow.grandTotal,
						deliveryStatus: invoiceRow.deliveryStatus,
						fulfillmentMode: invoiceRow.fulfillmentMode,
						completionOtpVerifiedAt: invoiceRow.completionOtpVerifiedAt,
						needsFulfillmentConfig:
							!invoiceRow.fulfillmentMode &&
							invoiceRow.deliveryStatus !== "delivered",
						createdAt: invoiceRow.createdAt,
					})),
				};
			});

			return {
				readyOrders: cards.filter(
					(item) => item.status === "ready_for_dispatch",
				),
				partiallyInvoicedOrders: cards.filter(
					(item) => item.status === "partially_invoiced",
				),
				invoicedOrders: cards.filter((item) => item.status === "invoiced"),
			};
		}),

	/**
	 * Select dispatch fulfillment mode for an invoice.
	 */
	createFullDispatchInvoice: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/dispatch/orders/full-invoice",
			tags: ["Warehouse"],
			summary: "Create a full invoice for remaining dispatch quantities",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const result = await createDispatchInvoiceForOrder({
				userId: context.session.user.id,
				orderId: input.orderId,
			});
			return {
				success: true,
				...result,
				message: result.fullyInvoiced
					? "Order fully invoiced"
					: "Invoice created",
			};
		}),

	createPartialDispatchInvoice: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/dispatch/orders/partial-invoice",
			tags: ["Warehouse"],
			summary: "Create a partial invoice for selected dispatch quantities",
		})
		.input(
			z.object({
				orderId: z.number(),
				items: z
					.array(
						z.object({
							orderItemId: z.number(),
							quantity: z.number().int().min(1),
						}),
					)
					.min(1),
			}),
		)
		.handler(async ({ context, input }) => {
			const result = await createDispatchInvoiceForOrder({
				userId: context.session.user.id,
				orderId: input.orderId,
				items: input.items,
			});
			return {
				success: true,
				...result,
				message: result.fullyInvoiced
					? "Final invoice created"
					: "Partial invoice created",
			};
		}),

	configureDispatchFulfillment: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/dispatch/configure",
			tags: ["Warehouse"],
			summary: "Select dispatch fulfillment mode",
		})
		.input(
			z.object({
				invoiceId: z.number(),
				fulfillmentMode: z.enum(["self_pickup", "delivery"]),
			}),
		)
		.handler(async ({ context, input }) => {
			const result = await configureExistingInvoiceFulfillment({
				userId: context.session.user.id,
				invoiceId: input.invoiceId,
				fulfillmentMode: input.fulfillmentMode,
			});

			return {
				success: true,
				completionOtp: result.completionOtp,
				message:
					input.fulfillmentMode === "self_pickup"
						? "Self pickup is ready. Share the OTP at handover."
						: "Invoice moved to delivery management.",
			};
		}),

	confirmDispatch: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/dispatch/orders/confirm",
			tags: ["Warehouse"],
			summary: "Create or configure a dispatch invoice",
		})
		.input(
			z.discriminatedUnion("mode", [
				z.object({
					mode: z.literal("create"),
					orderId: z.number(),
					strategy: z.enum(["full", "partial"]),
					items: z
						.array(
							z.object({
								orderItemId: z.number(),
								quantity: z.number().int().min(1),
							}),
						)
						.optional(),
					fulfillmentMode: z.enum(["self_pickup", "delivery"]),
				}),
				z.object({
					mode: z.literal("configure"),
					invoiceId: z.number(),
					fulfillmentMode: z.enum(["self_pickup", "delivery"]),
				}),
			]),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			if (input.mode === "configure") {
				const result = await configureExistingInvoiceFulfillment({
					userId,
					invoiceId: input.invoiceId,
					fulfillmentMode: input.fulfillmentMode,
				});
				return {
					success: true,
					invoiceId: result.invoice.id,
					invoiceNumber: result.invoice.invoiceNumber,
					fulfillmentMode: input.fulfillmentMode,
					fullyInvoiced: null,
					orderStatus: null,
					message:
						input.fulfillmentMode === "self_pickup"
							? "Self pickup is ready. Ask the customer for their pickup code at handover."
							: "Invoice saved for delivery management.",
				};
			}

			if (
				input.strategy === "partial" &&
				(!input.items || input.items.length === 0)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Partial dispatch requires at least one item quantity",
				});
			}
			const result = await createDispatchInvoiceForOrder({
				userId,
				orderId: input.orderId,
				items: input.strategy === "partial" ? input.items : undefined,
				fulfillmentMode: input.fulfillmentMode,
			});
			return {
				success: true,
				invoiceId: result.invoice.id,
				invoiceNumber: result.invoice.invoiceNumber,
				fulfillmentMode: input.fulfillmentMode,
				fullyInvoiced: result.fullyInvoiced,
				orderStatus: result.status,
				message:
					input.fulfillmentMode === "self_pickup"
						? "Pickup invoice created. Ask the customer for their pickup code at handover."
						: result.fullyInvoiced
							? "Order fully invoiced and saved for delivery."
							: "Partial invoice created and saved for delivery.",
			};
		}),

	/**
	 * Get invoices waiting in delivery management before final delivery type selection.
	 */
	getDeliveryManagementDashboard: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/delivery-management/dashboard",
			tags: ["Warehouse"],
			summary: "Get delivery management dashboard queues",
		})
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			const warehouseScope = sql`EXISTS (
                SELECT 1 FROM "order" scoped_order
                WHERE scoped_order."id" = ${invoice.orderId}
                  AND scoped_order."warehouse_id" = ${userId}
            )`;

			const pendingDeliveryInvoices = await db.query.invoice.findMany({
				where: and(
					warehouseScope,
					eq(invoice.fulfillmentMode, "delivery"),
					eq(invoice.deliveryStatus, "not_assigned"),
				),
				with: {
					customer: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
							shopName: true,
						},
					},
					order: {
						columns: {
							id: true,
							orderNumber: true,
							shippingName: true,
							shippingPhone: true,
							shippingAddress: true,
							shippingCity: true,
							shippingArea: true,
						},
					},
					items: true,
				},
				orderBy: [desc(invoice.createdAt)],
			});

			return {
				pendingDeliveryInvoices,
				pendingDeliveryCount: pendingDeliveryInvoices.length,
			};
		}),

	/**
	 * Get delivery-stage invoices for the Delivery Management desk.
	 */
	getDeliveryManagementInvoices: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/delivery-management/invoices",
			tags: ["Warehouse"],
			summary: "Get delivery management invoices",
		})
		.input(
			z.object({
				search: z.string().optional(),
				kpi: deliveryManagementKpiInput,
				deliveryType: deliveryManagementTypeInput,
				status: deliveryManagementStatusInput,
				dateRange: z.enum(["today", "this_month", "all"]).default("all"),
				page: z.number().int().default(1),
				limit: z.number().int().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const page = Math.max(1, input.page);
			const limit = Math.min(100, Math.max(1, input.limit));
			const offset = (page - 1) * limit;

			const warehouseScope = sql`EXISTS (
                SELECT 1 FROM "order" scoped_order
                WHERE scoped_order."id" = ${invoice.orderId}
                  AND scoped_order."warehouse_id" = ${userId}
            )`;

			const conditions: SQL[] = [
				warehouseScope,
				inArray(invoice.fulfillmentMode, [
					"delivery",
					"internal_delivery",
					"third_party",
				]),
			];

			if (input.deliveryType === "not_selected") {
				conditions.push(eq(invoice.fulfillmentMode, "delivery"));
			} else if (input.deliveryType === "internal") {
				conditions.push(eq(invoice.fulfillmentMode, "internal_delivery"));
			} else if (input.deliveryType === "third_party") {
				conditions.push(eq(invoice.fulfillmentMode, "third_party"));
			}

			const dateRange = getDeliveryManagementDateFilterRange(input);
			if (dateRange?.start)
				conditions.push(gte(invoice.createdAt, dateRange.start));
			if (dateRange?.end)
				conditions.push(lte(invoice.createdAt, dateRange.end));

			if (input.search?.trim()) {
				const term = `%${input.search.trim()}%`;
				conditions.push(
					or(
						ilike(invoice.invoiceNumber, term),
						sql`EXISTS (
                            SELECT 1 FROM "order" search_order
                            WHERE search_order."id" = ${invoice.orderId}
                              AND (
                                search_order."order_number" ILIKE ${term}
                                OR search_order."shipping_name" ILIKE ${term}
                                OR search_order."shipping_phone" ILIKE ${term}
                                OR search_order."shipping_area" ILIKE ${term}
                                OR search_order."shipping_city" ILIKE ${term}
                              )
                        )`,
						sql`EXISTS (
                            SELECT 1 FROM "user" search_customer
                            WHERE search_customer."id" = ${invoice.customerId}
                              AND (
                                search_customer."name" ILIKE ${term}
                                OR search_customer."phone_number" ILIKE ${term}
                                OR search_customer."shop_name" ILIKE ${term}
                                OR search_customer."warehouse_name" ILIKE ${term}
                              )
                        )`,
					)!,
				);
			}

			const deliveryInvoices = await db.query.invoice.findMany({
				where: and(...conditions),
				with: {
					customer: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
							shopName: true,
							warehouseName: true,
						},
					},
					order: {
						columns: {
							id: true,
							orderNumber: true,
							shippingName: true,
							shippingPhone: true,
							shippingAddress: true,
							shippingCity: true,
							shippingArea: true,
						},
					},
				},
				orderBy: [desc(invoice.createdAt)],
			});

			const invoiceIds = deliveryInvoices.map((row) => row.id);
			const deliveryLinks: DeliveryManagementLink[] = invoiceIds.length
				? await db
						.select({
							invoiceId: deliveryGroupInvoice.invoiceId,
							groupId: deliveryGroup.id,
							groupName: deliveryGroup.groupName,
							groupStatus: deliveryGroup.status,
							deliverymanId: deliveryGroup.deliverymanId,
							deliverymanName: user.name,
							deliverymanPhone: user.phoneNumber,
						})
						.from(deliveryGroupInvoice)
						.innerJoin(
							deliveryGroup,
							eq(deliveryGroupInvoice.groupId, deliveryGroup.id),
						)
						.leftJoin(user, eq(deliveryGroup.deliverymanId, user.id))
						.where(inArray(deliveryGroupInvoice.invoiceId, invoiceIds))
				: [];

			const deliveryByInvoiceId = new Map(
				deliveryLinks.map((row) => [row.invoiceId, row]),
			);

			const rows = deliveryInvoices.map((row) => {
				const rowDelivery = deliveryByInvoiceId.get(row.id) ?? null;
				const deliveryType = getDeliveryManagementType(row.fulfillmentMode);
				const displayStatus = getDeliveryManagementDisplayStatus({
					deliveryType,
					deliveryStatus: row.deliveryStatus,
					group: rowDelivery,
				});
				const kpiBucket = getDeliveryManagementKpi({
					deliveryType,
					displayStatus,
				});

				return {
					...row,
					deliveryType,
					displayStatus,
					kpiBucket,
					isSelectable:
						deliveryType === "not_selected" ||
						(deliveryType === "internal" &&
							!rowDelivery &&
							row.deliveryStatus === "not_assigned"),
					group: rowDelivery
						? {
								id: rowDelivery.groupId,
								groupName: rowDelivery.groupName,
								status: rowDelivery.groupStatus,
								deliverymanId: rowDelivery.deliverymanId,
								deliverymanName: rowDelivery.deliverymanName,
								deliverymanPhone: rowDelivery.deliverymanPhone,
								hasRider: !!rowDelivery.deliverymanId,
							}
						: null,
					customer: {
						id: row.customer?.id ?? row.customerId,
						name: row.customer?.name ?? "",
						phoneNumber:
							row.customer?.phoneNumber ?? row.order?.shippingPhone ?? null,
						shopName: row.customer?.shopName ?? null,
						warehouseName: row.customer?.warehouseName ?? null,
						displayName:
							row.customer?.warehouseName ||
							row.customer?.shopName ||
							row.customer?.name ||
							row.order?.shippingName ||
							"—",
					},
					order: row.order,
				};
			});

			const statusFilteredRows =
				input.status === "all"
					? rows
					: rows.filter((row) => row.displayStatus === input.status);

			const filteredRows =
				input.kpi === "all"
					? statusFilteredRows
					: statusFilteredRows.filter((row) => row.kpiBucket === input.kpi);

			const total = filteredRows.length;
			const totalPages = Math.max(1, Math.ceil(total / limit));

			return {
				invoices: filteredRows.slice(offset, offset + limit),
				kpis: {
					total: statusFilteredRows.length,
					pending: statusFilteredRows.filter(
						(row) => row.kpiBucket === "pending",
					).length,
					inDelivery: statusFilteredRows.filter(
						(row) => row.kpiBucket === "in_delivery",
					).length,
					delivered: statusFilteredRows.filter(
						(row) => row.kpiBucket === "delivered",
					).length,
				},
				pagination: {
					page,
					limit,
					total,
					totalPages,
				},
			};
		}),

	/**
	 * Get a delivery-stage invoice detail for the drawer.
	 */
	getDeliveryInvoiceDetail: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/delivery-management/invoices/{invoiceId}",
			tags: ["Warehouse"],
			summary: "Get delivery invoice detail",
		})
		.input(z.object({ invoiceId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const row = await db.query.invoice.findFirst({
				where: and(
					eq(invoice.id, input.invoiceId),
					inArray(invoice.fulfillmentMode, [
						"delivery",
						"internal_delivery",
						"third_party",
					]),
					sql`EXISTS (
                        SELECT 1 FROM "order" scoped_order
                        WHERE scoped_order."id" = ${invoice.orderId}
                          AND scoped_order."warehouse_id" = ${userId}
                    )`,
				),
				with: {
					customer: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
							shopName: true,
							warehouseName: true,
						},
					},
					order: {
						columns: {
							id: true,
							orderNumber: true,
							shippingName: true,
							shippingPhone: true,
							shippingAddress: true,
							shippingCity: true,
							shippingArea: true,
						},
					},
					items: true,
				},
			});

			if (!row) {
				throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
			}

			const [rowDelivery] = await db
				.select({
					invoiceId: deliveryGroupInvoice.invoiceId,
					groupId: deliveryGroup.id,
					groupName: deliveryGroup.groupName,
					groupStatus: deliveryGroup.status,
					deliverymanId: deliveryGroup.deliverymanId,
					deliverymanName: user.name,
					deliverymanPhone: user.phoneNumber,
				})
				.from(deliveryGroupInvoice)
				.innerJoin(
					deliveryGroup,
					eq(deliveryGroupInvoice.groupId, deliveryGroup.id),
				)
				.leftJoin(user, eq(deliveryGroup.deliverymanId, user.id))
				.where(eq(deliveryGroupInvoice.invoiceId, row.id));

			const deliveryType = getDeliveryManagementType(row.fulfillmentMode);
			const displayStatus = getDeliveryManagementDisplayStatus({
				deliveryType,
				deliveryStatus: row.deliveryStatus,
				group: rowDelivery ?? null,
			});
			const kpiBucket = getDeliveryManagementKpi({
				deliveryType,
				displayStatus,
			});

			return {
				invoice: {
					...row,
					deliveryType,
					displayStatus,
					kpiBucket,
					isSelectable:
						deliveryType === "not_selected" ||
						(deliveryType === "internal" &&
							!rowDelivery &&
							row.deliveryStatus === "not_assigned"),
					group: rowDelivery
						? {
								id: rowDelivery.groupId,
								groupName: rowDelivery.groupName,
								status: rowDelivery.groupStatus,
								deliverymanId: rowDelivery.deliverymanId,
								deliverymanName: rowDelivery.deliverymanName,
								deliverymanPhone: rowDelivery.deliverymanPhone,
								hasRider: !!rowDelivery.deliverymanId,
							}
						: null,
					customer: {
						id: row.customer?.id ?? row.customerId,
						name: row.customer?.name ?? "",
						phoneNumber:
							row.customer?.phoneNumber ?? row.order?.shippingPhone ?? null,
						shopName: row.customer?.shopName ?? null,
						warehouseName: row.customer?.warehouseName ?? null,
						displayName:
							row.customer?.warehouseName ||
							row.customer?.shopName ||
							row.customer?.name ||
							row.order?.shippingName ||
							"—",
					},
					order: row.order,
				},
			};
		}),

	/**
	 * Get open internal delivery groups for adding invoices.
	 */
	getOpenDeliveryGroups: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/delivery-management/open-groups",
			tags: ["Warehouse"],
			summary: "Get open delivery groups",
		})
		.input(z.object({}).optional())
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			const groups = await db.query.deliveryGroup.findMany({
				where: and(
					eq(deliveryGroup.warehouseId, userId),
					inArray(deliveryGroup.status, ["pending_assignment", "assigned"]),
				),
				with: {
					deliveryman: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
						},
					},
				},
				orderBy: [desc(deliveryGroup.createdAt)],
			});

			return {
				groups: groups.map((group) => ({
					...group,
					hasRider: !!group.deliverymanId,
					deliverymanName: group.deliveryman?.name ?? null,
					deliverymanPhone: group.deliveryman?.phoneNumber ?? null,
				})),
			};
		}),

	getDeliveryTeamAssignments: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/delivery-team/assignments",
			tags: ["Warehouse"],
			summary: "List delivery groups for team assignment with KPIs",
		})
		.input(
			z.object({
				search: z.string().optional(),
				kpi: z
					.enum(["all", "pending_assignment", "assigned", "completed"])
					.default("all"),
				area: z.string().optional(),
				dateRange: z.enum(["all", "today", "this_month"]).default("all"),
				page: z.number().int().min(1).default(1),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const groupRows = await db.query.deliveryGroup.findMany({
				where: eq(deliveryGroup.warehouseId, warehouseId),
				with: {
					deliveryman: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
						},
					},
					invoices: {
						with: {
							invoice: {
								columns: {
									id: true,
									grandTotal: true,
									fulfillmentMode: true,
								},
								with: {
									order: {
										columns: {
											shippingArea: true,
											orderNumber: true,
										},
									},
								},
							},
						},
					},
				},
				orderBy: [desc(deliveryGroup.createdAt)],
			});

			const groups = groupRows
				.filter((group) =>
					group.invoices.some(
						(link) => link.invoice?.fulfillmentMode === "internal_delivery",
					),
				)
				.map((group) => {
					const internalInvoices = group.invoices.filter(
						(link) => link.invoice?.fulfillmentMode === "internal_delivery",
					);
					const totalAmount = internalInvoices.reduce((sum, link) => {
						const value = Number.parseFloat(link.invoice?.grandTotal ?? "0");
						return sum + (Number.isNaN(value) ? 0 : value);
					}, 0);

					return {
						id: group.id,
						groupName: group.groupName,
						status: group.status,
						kpiBucket: getDeliveryAssignmentKpiBucket(group.status),
						totalInvoices: group.totalInvoices,
						completedInvoices: group.completedInvoices,
						totalAmount: formatMoneyValue(totalAmount),
						areaLabel: rollUpDeliveryAreaLabel(
							internalInvoices.map((link) => link.invoice?.order?.shippingArea),
						),
						createdAt: group.createdAt,
						rider: group.deliveryman
							? {
									id: group.deliveryman.id,
									name: group.deliveryman.name,
									phoneNumber: group.deliveryman.phoneNumber,
								}
							: null,
						hasRider: !!group.deliverymanId,
					};
				});

			const kpis = {
				total: groups.length,
				pendingAssignment: groups.filter(
					(group) => group.kpiBucket === "pending_assignment",
				).length,
				assigned: groups.filter((group) => group.kpiBucket === "assigned")
					.length,
				completed: groups.filter((group) => group.kpiBucket === "completed")
					.length,
			};

			const now = new Date();
			const startOfToday = new Date(now);
			startOfToday.setHours(0, 0, 0, 0);
			const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
			const search = input.search?.trim().toLowerCase();

			const filteredGroups = groups.filter((group) => {
				if (input.kpi !== "all" && group.kpiBucket !== input.kpi) {
					return false;
				}
				if (
					input.area &&
					input.area !== "all" &&
					group.areaLabel !== input.area
				) {
					return false;
				}
				if (
					search &&
					!group.groupName.toLowerCase().includes(search) &&
					!String(group.id).includes(search) &&
					!(group.rider?.name ?? "").toLowerCase().includes(search) &&
					!group.areaLabel.toLowerCase().includes(search)
				) {
					return false;
				}
				if (input.dateRange === "today" && group.createdAt < startOfToday) {
					return false;
				}
				if (
					input.dateRange === "this_month" &&
					group.createdAt < startOfMonth
				) {
					return false;
				}
				return true;
			});

			const total = filteredGroups.length;
			const offset = (input.page - 1) * input.limit;
			const areaOptions = [
				...new Set(
					groups
						.map((group) => group.areaLabel)
						.filter((area) => area && area !== "—"),
				),
			].sort();

			return {
				groups: filteredGroups.slice(offset, offset + input.limit),
				kpis,
				areaOptions,
				pagination: {
					page: input.page,
					limit: input.limit,
					total,
					totalPages: Math.max(1, Math.ceil(total / input.limit)),
				},
			};
		}),

	getDeliveryTeamRidersOverview: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/delivery-team/riders-overview",
			tags: ["Warehouse"],
			summary: "Rider-centric delivery assignment overview",
		})
		.input(
			z.object({
				search: z.string().optional(),
				status: z.enum(["all", "active", "idle"]).default("all"),
				area: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const riders = await db.query.user.findMany({
				where: and(
					eq(user.warehouseId, warehouseId),
					eq(user.role, "deliveryman"),
				),
				columns: {
					id: true,
					name: true,
					phoneNumber: true,
					banned: true,
					serviceArea: true,
				},
				orderBy: [user.name],
			});

			const [activeGroups, pendingGroupRows] = await Promise.all([
				db.query.deliveryGroup.findMany({
					where: and(
						eq(deliveryGroup.warehouseId, warehouseId),
						inArray(deliveryGroup.status, [
							"assigned",
							"out_for_delivery",
							"partial",
						]),
					),
					with: {
						invoices: {
							with: {
								invoice: {
									columns: { fulfillmentMode: true },
									with: {
										order: { columns: { shippingArea: true } },
									},
								},
							},
						},
					},
					orderBy: [desc(deliveryGroup.createdAt)],
				}),
				db.query.deliveryGroup.findMany({
					where: and(
						eq(deliveryGroup.warehouseId, warehouseId),
						eq(deliveryGroup.status, "pending_assignment"),
					),
					with: {
						invoices: {
							with: {
								invoice: {
									columns: { fulfillmentMode: true },
									with: {
										order: { columns: { shippingArea: true } },
									},
								},
							},
						},
					},
					orderBy: [desc(deliveryGroup.createdAt)],
				}),
			]);

			const activeGroupByRiderId = new Map<
				string,
				(typeof activeGroups)[number]
			>();
			for (const group of activeGroups) {
				if (
					!group.deliverymanId ||
					activeGroupByRiderId.has(group.deliverymanId)
				) {
					continue;
				}
				activeGroupByRiderId.set(group.deliverymanId, group);
			}

			const pendingGroups = pendingGroupRows
				.filter((group) =>
					group.invoices.some(
						(link) => link.invoice?.fulfillmentMode === "internal_delivery",
					),
				)
				.map((group) => {
					const internalInvoices = group.invoices.filter(
						(link) => link.invoice?.fulfillmentMode === "internal_delivery",
					);
					return {
						id: group.id,
						groupName: group.groupName,
						areaLabel: rollUpDeliveryAreaLabel(
							internalInvoices.map((link) => link.invoice?.order?.shippingArea),
						),
						totalInvoices: group.totalInvoices,
					};
				});

			const mappedRiders = riders.map((rider) => {
				const group = activeGroupByRiderId.get(rider.id) ?? null;
				const internalInvoices =
					group?.invoices.filter(
						(link) => link.invoice?.fulfillmentMode === "internal_delivery",
					) ?? [];
				const groupArea = rollUpDeliveryAreaLabel(
					internalInvoices.map((link) => link.invoice?.order?.shippingArea),
				);
				const isActive =
					!!group && internalInvoices.length > 0 && !rider.banned;

				return {
					id: rider.id,
					name: rider.name,
					phoneNumber: rider.phoneNumber,
					banned: rider.banned ?? false,
					serviceArea: rider.serviceArea,
					status: isActive ? ("active" as const) : ("idle" as const),
					areaLabel: isActive ? groupArea : (rider.serviceArea ?? "—"),
					activeGroup: isActive
						? {
								id: group.id,
								groupName: group.groupName,
								areaLabel: groupArea,
								status: group.status,
							}
						: null,
					totalOrders: isActive ? group.totalInvoices : 0,
					completedOrders: isActive ? group.completedInvoices : 0,
					vehicleType: isActive ? group.vehicleType : null,
				};
			});

			const kpis = {
				totalRiders: riders.filter((rider) => !rider.banned).length,
				ridersAssigned: mappedRiders.filter(
					(rider) => rider.status === "active",
				).length,
				unassignedGroups: pendingGroups.length,
			};
			const search = input.search?.trim().toLowerCase();
			const filteredRiders = mappedRiders.filter((rider) => {
				if (input.status !== "all" && rider.status !== input.status) {
					return false;
				}
				if (
					input.area &&
					input.area !== "all" &&
					rider.areaLabel !== input.area
				) {
					return false;
				}
				if (
					search &&
					!rider.name.toLowerCase().includes(search) &&
					!(rider.phoneNumber ?? "").toLowerCase().includes(search) &&
					!rider.areaLabel.toLowerCase().includes(search) &&
					!(rider.activeGroup?.groupName ?? "").toLowerCase().includes(search)
				) {
					return false;
				}
				return true;
			});
			const areaOptions = [
				...new Set(
					mappedRiders
						.map((rider) => rider.areaLabel)
						.filter((area) => area && area !== "—"),
				),
			].sort();

			return {
				riders: filteredRiders,
				kpis,
				pendingGroups,
				areaOptions,
			};
		}),

	/**
	 * Select the final delivery type inside Delivery Management.
	 */
	selectDeliveryManagementType: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/delivery-management/select-type",
			tags: ["Warehouse"],
			summary: "Select delivery type from delivery management",
		})
		.input(
			z.object({
				invoiceIds: z.array(z.number()).min(1),
				deliveryType: z.enum(["internal_delivery"]),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const scopedInvoices = await db.query.invoice.findMany({
				where: and(
					inArray(invoice.id, input.invoiceIds),
					eq(invoice.fulfillmentMode, "delivery"),
					eq(invoice.deliveryStatus, "not_assigned"),
					sql`EXISTS (
                        SELECT 1 FROM "order" scoped_order
                        WHERE scoped_order."id" = ${invoice.orderId}
                          AND scoped_order."warehouse_id" = ${userId}
                    )`,
				),
				columns: {
					id: true,
				},
			});

			if (scopedInvoices.length !== input.invoiceIds.length) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Some selected invoices are not waiting in delivery management",
				});
			}

			await db
				.update(invoice)
				.set({
					fulfillmentMode: input.deliveryType,
					deliverymanId: null,
					vehicleType: null,
					expectedDeliveryAt: null,
				})
				.where(inArray(invoice.id, input.invoiceIds));

			return {
				success: true,
				movedCount: input.invoiceIds.length,
				message: "Invoices moved to the internal delivery queue.",
			};
		}),

	/**
	 * Complete a self pickup invoice by verifying the OTP at handover.
	 */
	verifySelfPickupOtp: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/dispatch/self-pickup/verify",
			tags: ["Warehouse"],
			summary: "Verify self pickup OTP",
		})
		.input(
			z.object({
				invoiceId: z.number(),
				otp: z.string().length(4),
			}),
		)
		.handler(async ({ context, input }) => {
			return completeSelfPickupInvoice({
				owner: { kind: "warehouse", id: context.session.user.id },
				invoiceId: input.invoiceId,
				otp: input.otp,
				paymentStatus: "settled",
				markOrderPaid: false,
			});
		}),

	/**
	 * Get incoming orders (shop owners / warehouses buying from this warehouse).
	 */
	getIncomingOrders: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/incoming-orders",
			tags: ["Warehouse"],
			summary: "Get incoming orders to this warehouse",
		})
		.input(
			z.object({
				status: z
					.enum([
						"all",
						"pending",
						"confirmed",
						"processing",
						"delivered",
						"returned",
						"cancelled",
					])
					.default("all"),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const page = input.page;
			const limit = input.limit;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [eq(order.warehouseId, userId)];

			if (input.status !== "all") {
				conditions.push(eq(order.status, input.status));
			}

			const where = and(...conditions);

			const [orders, countResult] = await Promise.all([
				db
					.select({
						id: order.id,
						orderNumber: order.orderNumber,
						status: order.status,
						total: order.total,
						paymentMethod: order.paymentMethod,
						paymentStatus: order.paymentStatus,
						shippingName: order.shippingName,
						shippingPhone: order.shippingPhone,
						shippingAddress: order.shippingAddress,
						shippingCity: order.shippingCity,
						shippingArea: order.shippingArea,
						customerNote: order.customerNote,
						createdAt: order.createdAt,
						buyerId: order.userId,
						buyerName: user.name,
						buyerShopName: user.shopName,
						buyerWarehouseName: user.warehouseName,
					})
					.from(order)
					.leftJoin(user, eq(order.userId, user.id))
					.where(where)
					.orderBy(desc(order.createdAt))
					.limit(limit)
					.offset(offset),
				db.select({ count: count() }).from(order).where(where),
			]);

			// Fetch items for each order
			const orderIds = orders.map((o) => o.id);
			const items =
				orderIds.length > 0
					? await db
							.select()
							.from(orderItem)
							.where(inArray(orderItem.orderId, orderIds))
					: [];

			const itemsByOrder = new Map<number, typeof items>();
			for (const item of items) {
				const existing = itemsByOrder.get(item.orderId) || [];
				existing.push(item);
				itemsByOrder.set(item.orderId, existing);
			}

			const totalCount = Number(countResult[0]?.count) || 0;

			return {
				orders: orders.map((o) => ({
					...o,
					items: itemsByOrder.get(o.id) || [],
				})),
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	/**
	 * Update status of an incoming order (confirm / cancel / deliver).
	 */
	updateIncomingOrderStatus: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/incoming-orders/update-status",
			tags: ["Warehouse"],
			summary: "Update status of an incoming order",
		})
		.input(
			z.object({
				orderId: z.number(),
				status: z.enum(["confirmed", "processing", "delivered", "cancelled"]),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(eq(order.id, input.orderId), eq(order.warehouseId, userId)),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", {
					message: "Order not found or not assigned to your warehouse",
				});
			}

			const validTransitions: Record<string, string[]> = {
				confirmed: ["pending"],
				processing: ["confirmed"],
				delivered: ["confirmed", "processing"],
				cancelled: ["pending", "approved", "confirmed", "ready_for_dispatch"],
			};
			if (!validTransitions[input.status]?.includes(existingOrder.status)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Cannot change an order from '${existingOrder.status}' to '${input.status}'`,
				});
			}

			const updateData: Record<string, any> = {
				status:
					input.status === "confirmed" ? "ready_for_dispatch" : input.status,
			};

			if (input.status === "confirmed") {
				updateData.confirmedAt = new Date();
				updateData.readyAt = new Date();
			}
			if (input.status === "delivered") updateData.deliveredAt = new Date();
			if (input.status === "cancelled") updateData.cancelledAt = new Date();

			try {
				await db.transaction(async (tx) => {
					if (input.status === "confirmed") {
						await reserveB2bOrderItemsAtApproval(tx, {
							warehouseId: userId,
							lines: existingOrder.items.map((item) => ({
								item,
								approvedQty: item.modifiedQty ?? item.quantity,
							})),
						});
					}

					if (
						input.status === "cancelled" &&
						existingOrder.status !== "pending"
					) {
						await releaseB2bOrderReservations(tx, {
							warehouseId: userId,
							items: existingOrder.items,
						});
					}

					if (["processing", "delivered"].includes(input.status)) {
						await markOrderCartonsDispatched(tx, [input.orderId]);
					}

					if (input.status === "delivered") {
						for (const item of existingOrder.items) {
							await tx
								.update(orderItem)
								.set({ deliveredQty: item.modifiedQty ?? item.quantity })
								.where(eq(orderItem.id, item.id));
						}
						await consumeB2bOrderReservations(tx, {
							warehouseId: userId,
							orderId: existingOrder.id,
						});
						await creditWarehouseExchangeOrder(tx, {
							warehouseId: userId,
							orderId: existingOrder.id,
							actorId: userId,
						});
					}

					const updated = await tx
						.update(order)
						.set(updateData)
						.where(
							and(
								eq(order.id, input.orderId),
								eq(order.status, existingOrder.status),
							),
						)
						.returning({ id: order.id });
					if (updated.length === 0) {
						throw new Error("Order status changed; refresh and try again");
					}
				});
			} catch (error) {
				if (error instanceof ORPCError) throw error;
				throw new ORPCError("BAD_REQUEST", {
					message:
						error instanceof Error
							? error.message
							: "Unable to update the order status",
				});
			}

			return {
				success: true,
				message: `Order ${existingOrder.orderNumber} updated to ${input.status}`,
			};
		}),

	/**
	 * Update item quantities on a pending incoming order.
	 * Warehouse can adjust quantities before confirming if stock is insufficient.
	 */
	updateIncomingOrderItems: warehouseProcedure
		.input(
			z.object({
				orderId: z.number(),
				items: z.array(
					z.object({
						itemId: z.number(),
						quantity: z.number().int().min(0),
					}),
				),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(eq(order.id, input.orderId), eq(order.warehouseId, userId)),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", {
					message: "Order not found or not assigned to your warehouse",
				});
			}

			if (existingOrder.status !== "pending") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Can only edit items on pending orders",
				});
			}

			await db.transaction(async (tx) => {
				for (const update of input.items) {
					const existingItem = existingOrder.items.find(
						(i) => i.id === update.itemId,
					);
					if (!existingItem) continue;

					if (update.quantity === 0) {
						// Remove item entirely
						await tx.delete(orderItem).where(eq(orderItem.id, update.itemId));
					} else if (update.quantity !== existingItem.quantity) {
						const unitPrice = Number(existingItem.unitPrice);
						const newTotal = (unitPrice * update.quantity).toFixed(2);

						await tx
							.update(orderItem)
							.set({
								quantity: update.quantity,
								totalPrice: newTotal,
							})
							.where(eq(orderItem.id, update.itemId));
					}
				}

				// Recalculate order totals
				const updatedItems = await tx.query.orderItem.findMany({
					where: eq(orderItem.orderId, input.orderId),
				});

				if (updatedItems.length === 0) {
					// All items removed → cancel order
					await tx
						.update(order)
						.set({ status: "cancelled", cancelledAt: new Date() })
						.where(eq(order.id, input.orderId));
				} else {
					const subtotal = updatedItems.reduce(
						(s, i) => s + Number(i.totalPrice),
						0,
					);
					await tx
						.update(order)
						.set({
							subtotal: subtotal.toFixed(2),
							total: subtotal.toFixed(2),
						})
						.where(eq(order.id, input.orderId));
				}
			});

			return {
				success: true,
				message: "Order items updated",
			};
		}),

	/**
	 * Record a partial delivery for an order.
	 * Warehouse records how many units were delivered per item in this batch.
	 */
	recordPartialDelivery: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/incoming-orders/partial-delivery",
			tags: ["Warehouse"],
			summary: "Record partial delivery for an order",
		})
		.input(
			z.object({
				orderId: z.number(),
				items: z.array(
					z.object({
						itemId: z.number(),
						deliveredQty: z.number().int().min(0),
					}),
				),
				riderName: z.string().optional(),
				riderPhone: z.string().optional(),
				trackingId: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(eq(order.id, input.orderId), eq(order.warehouseId, userId)),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", {
					message: "Order not found or not assigned to your warehouse",
				});
			}

			if (!["confirmed", "processing"].includes(existingOrder.status)) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Cannot record delivery for order with status '${existingOrder.status}'`,
				});
			}

			const deliveredByItem = new Map<number, number>();
			for (const delivery of input.items) {
				if (deliveredByItem.has(delivery.itemId)) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Order item ${delivery.itemId} is duplicated`,
					});
				}
				const existingItem = existingOrder.items.find(
					(item) => item.id === delivery.itemId,
				);
				if (!existingItem) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Order item ${delivery.itemId} does not belong to this order`,
					});
				}
				const nextDelivered =
					(existingItem.deliveredQty ?? 0) + delivery.deliveredQty;
				const approvedQty = existingItem.modifiedQty ?? existingItem.quantity;
				if (nextDelivered > approvedQty) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Delivered quantity for ${existingItem.productName} exceeds the approved quantity`,
					});
				}
				deliveredByItem.set(delivery.itemId, nextDelivered);
			}

			const allFullyDelivered = existingOrder.items.every((item) => {
				const delivered =
					deliveredByItem.get(item.id) ?? item.deliveredQty ?? 0;
				return delivered >= (item.modifiedQty ?? item.quantity);
			});

			await db.transaction(async (tx) => {
				for (const [itemId, deliveredQty] of deliveredByItem) {
					await tx
						.update(orderItem)
						.set({ deliveredQty })
						.where(eq(orderItem.id, itemId));
				}

				if (input.items.some((delivery) => delivery.deliveredQty > 0)) {
					await markOrderCartonsDispatched(tx, [input.orderId]);
				}

				// Update order: set processing if first delivery, or delivered if all items fully delivered
				const updateData: Record<string, any> = {
					status: "processing",
					processingStartedAt: existingOrder.processingStartedAt || new Date(),
				};

				// Update rider/tracking info if provided
				if (input.riderName) updateData.riderName = input.riderName;
				if (input.riderPhone) updateData.riderPhone = input.riderPhone;
				if (input.trackingId) updateData.trackingId = input.trackingId;

				if (allFullyDelivered) {
					updateData.status = "delivered";
					updateData.deliveredAt = new Date();
					await consumeB2bOrderReservations(tx, {
						warehouseId: userId,
						orderId: existingOrder.id,
					});
					await creditWarehouseExchangeOrder(tx, {
						warehouseId: userId,
						orderId: existingOrder.id,
						actorId: userId,
					});
				}

				await tx
					.update(order)
					.set(updateData)
					.where(eq(order.id, input.orderId));

				// Retail inventory is credited only when the buyer confirms receipt.
			});

			return {
				success: true,
				message: "Partial delivery recorded",
			};
		}),

	/**
	 * Get warehouse's own purchase orders (buying from other warehouses).
	 */
	getMyOrders: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/my-orders",
			tags: ["Warehouse"],
			summary: "Get warehouse's own purchase orders",
		})
		.input(
			z.object({
				status: z
					.enum([
						"pending",
						"approved",
						"confirmed",
						"ready_for_dispatch",
						"partially_invoiced",
						"invoiced",
						"processing",
						"delivered",
						"cancelled",
					])
					.optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
				supplierWarehouseId: z.string().optional(),
				timeframe: z.enum(["today", "this_month", "all"]).default("all"),
				search: z.string().optional(),
				deliveryLocation: z.enum(["all", "my_warehouse"]).default("all"),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const page = input.page;
			const limit = input.limit;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [
				eq(order.userId, userId),
				eq(order.orderType, "b2b"),
				sql`${order.warehouseId} IS NOT NULL`,
			];
			if (input.status) conditions.push(eq(order.status, input.status));
			if (input.supplierWarehouseId) {
				conditions.push(eq(order.warehouseId, input.supplierWarehouseId));
			}
			if (input.timeframe === "today") {
				conditions.push(sql`${order.createdAt} >= CURRENT_DATE`);
			} else if (input.timeframe === "this_month") {
				conditions.push(
					sql`${order.createdAt} >= date_trunc('month', CURRENT_DATE)`,
				);
			}
			if (input.deliveryLocation === "my_warehouse") {
				const buyer = await db
					.select({
						warehouseAddress: user.warehouseAddress,
						warehouseName: user.warehouseName,
						name: user.name,
					})
					.from(user)
					.where(eq(user.id, userId))
					.limit(1);
				const buyerRow = buyer[0];
				if (buyerRow?.warehouseAddress) {
					conditions.push(eq(order.shippingAddress, buyerRow.warehouseAddress));
				} else if (buyerRow?.warehouseName) {
					conditions.push(eq(order.shippingName, buyerRow.warehouseName));
				} else if (buyerRow?.name) {
					conditions.push(eq(order.shippingName, buyerRow.name));
				}
			}
			if (input.search?.trim()) {
				const q = `%${input.search.trim().toLowerCase()}%`;

				const [supplierMatches, itemMatches] = await Promise.all([
					db
						.select({ id: user.id })
						.from(user)
						.where(
							or(
								sql`LOWER(${user.warehouseName}) LIKE ${q}`,
								sql`LOWER(${user.name}) LIKE ${q}`,
							),
						),
					db
						.select({ orderId: orderItem.orderId })
						.from(orderItem)
						.where(sql`LOWER(${orderItem.productName}) LIKE ${q}`),
				]);

				const supplierIds = supplierMatches.map((s) => s.id);
				const orderIdsFromItems = [
					...new Set(itemMatches.map((i) => i.orderId)),
				];

				const searchConditions: SQL[] = [ilike(order.orderNumber, q)];
				if (supplierIds.length > 0) {
					searchConditions.push(inArray(order.warehouseId, supplierIds));
				}
				if (orderIdsFromItems.length > 0) {
					searchConditions.push(inArray(order.id, orderIdsFromItems));
				}

				conditions.push(or(...searchConditions)!);
			}

			const where = and(...conditions);

			const [orders, countResult] = await Promise.all([
				db.query.order.findMany({
					where,
					with: {
						items: {
							columns: {
								id: true,
								productName: true,
								productImage: true,
								quantity: true,
								unitPrice: true,
								totalPrice: true,
								modifiedQty: true,
								modifiedUnitPrice: true,
							},
						},
					},
					orderBy: [desc(order.createdAt)],
					limit,
					offset,
				}),
				db.select({ count: count() }).from(order).where(where),
			]);

			const totalCount = countResult[0]?.count || 0;
			const supplierIds = [
				...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean)),
			];
			const supplierMap = new Map<
				string,
				{ name: string; phone: string | null }
			>();

			if (supplierIds.length > 0) {
				const suppliers = await db
					.select({
						id: user.id,
						name: user.name,
						warehouseName: user.warehouseName,
						phone: user.phoneNumber,
					})
					.from(user)
					.where(inArray(user.id, supplierIds as string[]));

				for (const supplier of suppliers) {
					supplierMap.set(supplier.id, {
						name:
							supplier.warehouseName || supplier.name || "Unknown Warehouse",
						phone: supplier.phone ?? null,
					});
				}
			}

			return {
				orders: orders.map((o: any) => ({
					...o,
					supplierWarehouseName:
						supplierMap.get(o.warehouseId)?.name || "Unknown Warehouse",
					supplierWarehousePhone: supplierMap.get(o.warehouseId)?.phone || null,
					requiresBuyerAcceptance:
						!!o.modifiedByWarehouseAt &&
						!o.modificationAcceptedAt &&
						!o.modificationRejectedAt &&
						o.status !== "cancelled",
				})),
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	getMyOrderDetail: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/my-order-detail",
			tags: ["Warehouse"],
			summary: "Get warehouse buyer order detail",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const result = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.userId, userId),
					eq(order.orderType, "b2b"),
				),
				with: {
					items: {
						with: {
							product: {
								columns: { id: true, name: true, image: true },
							},
							variant: {
								columns: {
									id: true,
									sku: true,
									weightKg: true,
									unitLabel: true,
									packType: true,
								},
							},
						},
					},
				},
			});

			if (!result) {
				throw new ORPCError("NOT_FOUND", { message: "Order not found" });
			}

			let supplierInfo: {
				name: string;
				warehouseName: string | null;
				phone: string | null;
				address: string | null;
			} | null = null;

			if (result.warehouseId) {
				const supplier = await db
					.select({
						name: user.name,
						warehouseName: user.warehouseName,
						phone: user.phoneNumber,
						address: user.warehouseAddress,
					})
					.from(user)
					.where(eq(user.id, result.warehouseId))
					.limit(1);

				supplierInfo = supplier[0] ?? null;
			}

			const timeline = [
				{ step: "Placed", date: result.createdAt, completed: true },
				{
					step: "Confirmed",
					date: result.confirmedAt,
					completed: !!result.confirmedAt,
				},
				{
					step: "Modified",
					date: result.modifiedByWarehouseAt,
					completed: !!result.modifiedByWarehouseAt,
					isModification: true,
				},
				{
					step: "Processing",
					date: result.processingStartedAt,
					completed:
						!!result.processingStartedAt ||
						result.status === "processing" ||
						result.status === "delivered",
				},
				{
					step: "Ready",
					date: result.readyAt,
					completed: !!result.readyAt,
				},
				{
					step: "Delivered",
					date: result.deliveredAt,
					completed: !!result.deliveredAt || result.status === "delivered",
				},
				{
					step: "Received",
					date: result.receivedAt,
					completed: !!result.receivedAt,
				},
			].filter((t) => !t.isModification || t.completed);

			const hasModifications = result.items.some(
				(item: any) =>
					item.modifiedQty !== null || item.modifiedUnitPrice !== null,
			);

			return {
				order: {
					...result,
					supplierWarehouseName:
						supplierInfo?.warehouseName ||
						supplierInfo?.name ||
						"Unknown Warehouse",
					supplierWarehousePhone: supplierInfo?.phone || null,
					supplierWarehouseAddress: supplierInfo?.address || null,
					requiresBuyerAcceptance:
						!!result.modifiedByWarehouseAt &&
						!result.modificationAcceptedAt &&
						!result.modificationRejectedAt &&
						result.status !== "cancelled",
				},
				timeline,
				hasModifications,
				delivery: {
					trackingId: result.trackingId,
					riderName: result.riderName,
					riderPhone: result.riderPhone,
				},
			};
		}),

	receiveWarehouseSupplierOrder: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/my-orders/receive",
			tags: ["Warehouse"],
			summary: "Mark warehouse supplier order as received",
		})
		.input(
			z.object({
				orderId: z.number(),
				receivedItems: z
					.array(
						z.object({
							itemId: z.number(),
							receivedQty: z.number().int().min(0),
						}),
					)
					.optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.userId, userId),
					eq(order.orderType, "b2b"),
				),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", { message: "Order not found" });
			}

			if (existingOrder.status !== "delivered") {
				throw new ORPCError("BAD_REQUEST", {
					message: `Cannot receive an order with status '${existingOrder.status}'`,
				});
			}

			if (existingOrder.receivedAt) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Order has already been received",
				});
			}

			const suppliedReceipts = new Map<number, number>();
			for (const receipt of input.receivedItems ?? []) {
				if (suppliedReceipts.has(receipt.itemId)) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Order item ${receipt.itemId} is duplicated`,
					});
				}
				if (!existingOrder.items.some((item) => item.id === receipt.itemId)) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Order item ${receipt.itemId} does not belong to this order`,
					});
				}
				suppliedReceipts.set(receipt.itemId, receipt.receivedQty);
			}

			const receiptRows = existingOrder.items.map((item) => {
				const approvedQty = item.modifiedQty ?? item.quantity;
				const deliveredQty = item.deliveredQty ?? 0;
				const receivedQty = suppliedReceipts.get(item.id) ?? deliveredQty;
				if (deliveredQty < approvedQty) {
					throw new ORPCError("BAD_REQUEST", {
						message: `${item.productName} is not fully delivered yet`,
					});
				}
				if (
					receivedQty < 0 ||
					receivedQty > deliveredQty ||
					receivedQty > approvedQty
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Received quantity for ${item.productName} must be between 0 and ${Math.min(deliveredQty, approvedQty)}`,
					});
				}
				return { itemId: item.id, receivedQty };
			});

			await db.transaction(async (tx) => {
				const claimed = await tx
					.update(order)
					.set({ receivedAt: new Date() })
					.where(
						and(
							eq(order.id, input.orderId),
							eq(order.status, "delivered"),
							sql`${order.receivedAt} IS NULL`,
						),
					)
					.returning({ id: order.id });
				if (claimed.length === 0) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Order receipt was already completed or its status changed",
					});
				}

				for (const receipt of receiptRows) {
					await tx
						.update(orderItem)
						.set({ receivedQty: receipt.receivedQty })
						.where(eq(orderItem.id, receipt.itemId));
				}

				await convertB2bOrderToRetailInventory(tx, input.orderId);
			});

			return {
				success: true,
				message: `Order ${existingOrder.orderNumber} received successfully`,
			};
		}),

	cancelWarehouseSupplierOrder: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/my-orders/cancel",
			tags: ["Warehouse"],
			summary: "Cancel a warehouse supplier order",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.userId, userId),
					eq(order.orderType, "b2b"),
				),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", { message: "Order not found" });
			}

			if (
				!["pending", "approved", "confirmed", "ready_for_dispatch"].includes(
					existingOrder.status,
				)
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Cannot cancel an order with status '${existingOrder.status}'`,
				});
			}

			await db.transaction(async (tx) => {
				const cancelled = await tx
					.update(order)
					.set({
						status: "cancelled",
						cancelledAt: new Date(),
					})
					.where(
						and(
							eq(order.id, input.orderId),
							eq(order.status, existingOrder.status),
						),
					)
					.returning({ id: order.id });
				if (cancelled.length === 0) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Order was already updated by another request",
					});
				}

				if (existingOrder.warehouseId && existingOrder.status !== "pending") {
					await releaseB2bOrderReservations(tx, {
						warehouseId: existingOrder.warehouseId,
						items: existingOrder.items,
					});
				}
			});

			return {
				success: true,
				message: `Order ${existingOrder.orderNumber} cancelled`,
			};
		}),

	acceptWarehouseSupplierModification: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/my-orders/accept-modification",
			tags: ["Warehouse"],
			summary: "Accept supplier warehouse order modifications",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.userId, userId),
					eq(order.orderType, "b2b"),
				),
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", { message: "Order not found" });
			}

			if (!existingOrder.modifiedByWarehouseAt) {
				throw new ORPCError("BAD_REQUEST", {
					message: "This order has no modifications to accept",
				});
			}

			if (
				existingOrder.modificationAcceptedAt ||
				existingOrder.modificationRejectedAt
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Modification already resolved",
				});
			}

			await db
				.update(order)
				.set({
					modificationAcceptedAt: new Date(),
					confirmedAt: existingOrder.confirmedAt || new Date(),
					readyAt: existingOrder.readyAt || new Date(),
					status: "ready_for_dispatch",
				})
				.where(eq(order.id, input.orderId));

			return {
				success: true,
				message: `Modifications accepted for ${existingOrder.orderNumber}`,
			};
		}),

	rejectWarehouseSupplierModification: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/my-orders/reject-modification",
			tags: ["Warehouse"],
			summary: "Reject supplier warehouse order modifications",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.userId, userId),
					eq(order.orderType, "b2b"),
				),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", { message: "Order not found" });
			}

			if (!existingOrder.modifiedByWarehouseAt) {
				throw new ORPCError("BAD_REQUEST", {
					message: "This order has no modifications to reject",
				});
			}

			if (
				existingOrder.modificationAcceptedAt ||
				existingOrder.modificationRejectedAt
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Modification already resolved",
				});
			}

			await db.transaction(async (tx) => {
				const rejected = await tx
					.update(order)
					.set({
						modificationRejectedAt: new Date(),
						status: "cancelled",
						cancelledAt: new Date(),
					})
					.where(
						and(
							eq(order.id, input.orderId),
							inArray(order.status, ["approved", "confirmed"]),
							sql`${order.modificationAcceptedAt} IS NULL`,
							sql`${order.modificationRejectedAt} IS NULL`,
						),
					)
					.returning({ id: order.id });
				if (rejected.length === 0) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Modification was already resolved or dispatched",
					});
				}

				if (existingOrder.warehouseId) {
					await releaseB2bOrderReservations(tx, {
						warehouseId: existingOrder.warehouseId,
						items: existingOrder.items,
					});
				}
			});

			return {
				success: true,
				message: `Modifications rejected, order ${existingOrder.orderNumber} cancelled`,
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Supplier CRUD (warehouse role only)
// ────────────────────────────────────────────────────────────────

import {
	supplier,
	purchase,
	purchaseItem,
	product as productTable,
	productVariant,
	category,
} from "@bikalpo-project/db/schema";

/**
 * Canonical product scope for warehouse-owned, sellable product records.
 * Core identities and legacy template rows are configuration sources, not stock targets.
 */
function warehouseOwnedProductCondition(userId: string): SQL {
	return and(
		eq(productTable.creatorSource, "warehouse"),
		or(
			eq(productTable.createdById, userId),
			eq(productTable.createdByWarehouseId, userId),
		)!,
	)!;
}

function isWarehouseOwnedProduct(
	product: {
		creatorSource: string;
		createdById: string | null;
		createdByWarehouseId: string | null;
	},
	userId: string,
) {
	return (
		product.creatorSource === "warehouse" &&
		(product.createdById === userId || product.createdByWarehouseId === userId)
	);
}

// ────────────────────────────────────────────────────────────────
// Product Variant Search (for purchase form)
// ────────────────────────────────────────────────────────────────

const variantQueries = {
	// Search product variants for the purchase form dropdown
	// Optionally filter by supplier's category when supplierId is provided
	searchVariants: warehouseProcedure
		.input(
			z.object({
				search: z.string().optional(),
				supplierId: z.number().int().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const conditions: SQL[] = [eq(productTable.status, "active")];

			if (input.search) {
				conditions.push(sql`${productTable.name} ILIKE ${`%${input.search}%`}`);
			}

			// If supplierId provided, filter products to supplier's category
			let supplierCategoryName: string | null = null;
			if (input.supplierId) {
				const sup = await db.query.supplier.findFirst({
					where: and(
						eq(supplier.id, input.supplierId),
						eq(supplier.addedBy, context.session.user.id),
					),
					with: { category: { columns: { id: true, name: true } } },
				});
				if (sup?.categoryId) {
					conditions.push(eq(productTable.categoryId, sup.categoryId));
					supplierCategoryName = sup.category?.name ?? null;
				}
			}

			const results = await db
				.select({
					variantId: productVariant.id,
					productId: productTable.id,
					productName: productTable.name,
					unitLabel: productVariant.unitLabel,
					weightKg: productVariant.weightKg,
					price: productVariant.price,
					sku: productVariant.sku,
					packagingType: productVariant.packagingType,
				})
				.from(productVariant)
				.innerJoin(productTable, eq(productVariant.productId, productTable.id))
				.where(and(...conditions))
				.orderBy(productTable.name)
				.limit(50);

			return { variants: results, supplierCategoryName };
		}),
};

const supplierQueries = {
	// Get all suppliers for the current warehouse — enriched with category + purchase totals
	getSuppliers: warehouseProcedure
		.input(
			z.object({
				search: z.string().optional(),
				status: z.enum(["all", "active", "suspended"]).default("all"),
				categoryId: z.number().int().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const conditions: SQL[] = [eq(supplier.addedBy, userId)];

			if (input.search) {
				conditions.push(
					sql`(${supplier.name} ILIKE ${`%${input.search}%`} OR ${supplier.company} ILIKE ${`%${input.search}%`} OR ${supplier.phone} ILIKE ${`%${input.search}%`})`,
				);
			}

			if (input.status !== "all") {
				conditions.push(eq(supplier.status, input.status));
			}

			if (input.categoryId) {
				conditions.push(eq(supplier.categoryId, input.categoryId));
			}

			// Fetch suppliers with category relation
			const suppliers = await db.query.supplier.findMany({
				where: and(...conditions),
				with: {
					category: { columns: { id: true, name: true, slug: true } },
				},
				orderBy: [desc(supplier.createdAt)],
			});

			// Aggregate total purchase per supplier
			const supplierIds = suppliers.map((s) => s.id);
			const purchaseTotals: Record<number, number> = {};

			if (supplierIds.length > 0) {
				const totals = await db
					.select({
						supplierId: purchase.supplierId,
						totalPurchase: sql<string>`COALESCE(SUM(${purchase.total}::numeric), 0)`,
					})
					.from(purchase)
					.where(
						and(
							eq(purchase.warehouseId, userId),
							inArray(purchase.supplierId, supplierIds),
						),
					)
					.groupBy(purchase.supplierId);

				for (const t of totals) {
					purchaseTotals[t.supplierId] = parseFloat(t.totalPurchase) || 0;
				}
			}

			return {
				suppliers: suppliers.map((s) => ({
					...s,
					categoryName: s.category?.name ?? null,
					totalPurchase: purchaseTotals[s.id] ?? 0,
				})),
			};
		}),

	// Financial KPI summary for all suppliers
	getSupplierStats: warehouseProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		// Total payable across all active suppliers
		const allSuppliers = await db.query.supplier.findMany({
			where: eq(supplier.addedBy, userId),
			columns: { id: true, currentPayable: true, status: true, isActive: true },
		});

		const activeCount = allSuppliers.filter(
			(s) => s.status === "active",
		).length;
		const totalPayable = allSuppliers.reduce(
			(sum, s) => sum + parseFloat(s.currentPayable),
			0,
		);

		// Total purchases across all suppliers
		const [purchaseStats] = await db
			.select({
				totalPurchase: sql<string>`COALESCE(SUM(${purchase.total}::numeric), 0)`,
			})
			.from(purchase)
			.where(eq(purchase.warehouseId, userId));

		const totalPurchase = parseFloat(purchaseStats?.totalPurchase ?? "0");
		const totalPaid = totalPurchase - totalPayable;

		return {
			totalPurchase,
			totalPaid: Math.max(0, totalPaid),
			totalPayable,
			activeCount,
			totalCount: allSuppliers.length,
		};
	}),

	// Detailed view for a single supplier
	getSupplierDetail: warehouseProcedure
		.input(z.object({ id: z.number().int() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Fetch supplier with category
			const sup = await db.query.supplier.findFirst({
				where: and(eq(supplier.id, input.id), eq(supplier.addedBy, userId)),
				with: {
					category: { columns: { id: true, name: true, slug: true } },
				},
			});

			if (!sup) {
				throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
			}

			// ── Purchase History (all purchases with items count) ──
			const purchases = await db.query.purchase.findMany({
				where: and(
					eq(purchase.warehouseId, userId),
					eq(purchase.supplierId, input.id),
				),
				with: {
					items: {
						columns: {
							productName: true,
							quantity: true,
							totalCost: true,
						},
					},
				},
				orderBy: [desc(purchase.createdAt)],
			});

			// ── Total Purchase Value ──
			const totalPurchaseValue = purchases.reduce(
				(sum, p) => sum + parseFloat(p.total ?? "0"),
				0,
			);

			// ── Payment History from Ledger ──
			const { financialLedger } = await import("@bikalpo-project/db/schema");
			const payments = await db
				.select({
					id: financialLedger.id,
					amount: financialLedger.amount,
					description: financialLedger.description,
					createdAt: financialLedger.createdAt,
				})
				.from(financialLedger)
				.where(
					and(
						eq(financialLedger.ownerId, userId),
						eq(financialLedger.referenceType, "supplier_payment"),
						eq(financialLedger.referenceId, input.id),
					),
				)
				.orderBy(desc(financialLedger.createdAt));

			const totalPaid = payments.reduce(
				(sum, p) => sum + parseFloat(p.amount ?? "0"),
				0,
			);

			// Also sum cash purchases as "paid" (only credit purchases create payables)
			const cashPurchaseTotal = purchases
				.filter((p) => p.paymentType === "cash")
				.reduce((sum, p) => sum + parseFloat(p.total ?? "0"), 0);

			// ── Product Supply Breakdown ──
			const productMap = new Map<
				string,
				{ totalQty: number; totalValue: number }
			>();
			for (const p of purchases) {
				for (const item of p.items) {
					const name = item.productName;
					const existing = productMap.get(name) ?? {
						totalQty: 0,
						totalValue: 0,
					};
					existing.totalQty += parseFloat(item.quantity ?? "0");
					existing.totalValue += parseFloat(item.totalCost ?? "0");
					productMap.set(name, existing);
				}
			}
			const productBreakdown = Array.from(productMap.entries())
				.map(([name, data]) => ({
					productName: name,
					totalQty: data.totalQty,
					totalValue: data.totalValue,
				}))
				.sort((a, b) => b.totalValue - a.totalValue)
				.slice(0, 30);

			// ── Due Alert ──
			const currentPayable = parseFloat(sup.currentPayable ?? "0");

			// Build purchase history rows with paid/due
			const purchaseHistory = purchases.map((p) => {
				const total = parseFloat(p.total ?? "0");
				const isCash = p.paymentType === "cash";
				const paid = isCash ? total : 0;
				const due = isCash ? 0 : total;
				return {
					id: p.id,
					purchaseNumber: p.purchaseNumber,
					purchaseDate: p.purchaseDate,
					itemCount: p.items.length,
					total,
					paid,
					due,
					status: p.status,
					paymentType: p.paymentType,
					discount: p.discount,
					transportCost: p.transportCost,
					note: p.note,
					createdAt: p.createdAt,
					items: p.items.map((item) => ({
						productName: item.productName,
						quantity: item.quantity,
						totalCost: item.totalCost,
					})),
				};
			});

			return {
				supplier: {
					...sup,
					categoryName: sup.category?.name ?? null,
				},
				purchaseHistory,
				productBreakdown,
				payments,
				totalPurchaseValue,
				totalPaid: totalPaid + cashPurchaseTotal,
				currentPayable,
			};
		}),

	// Get all categories for supplier form dropdown
	getSupplierCategories: warehouseProcedure.handler(async () => {
		const categories = await db
			.select({ id: category.id, name: category.name, slug: category.slug })
			.from(category)
			.where(eq(category.isActive, true))
			.orderBy(category.name);

		return { categories };
	}),

	// Create a new supplier
	createSupplier: warehouseProcedure
		.input(
			z.object({
				name: z.string().min(1),
				company: z.string().optional(),
				contactPerson: z.string().optional(),
				phone: z.string().optional(),
				email: z.string().email().optional().or(z.literal("")),
				address: z.string().optional(),
				notes: z.string().optional(),
				creditLimit: z.string().optional(),
				returnPackAgreement: z.boolean().optional(),
				categoryId: z.number().int().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const [created] = await db
				.insert(supplier)
				.values({
					name: input.name,
					company: input.company || null,
					contactPerson: input.contactPerson || null,
					phone: input.phone || null,
					email: input.email || null,
					address: input.address || null,
					notes: input.notes || null,
					creditLimit: input.creditLimit || "0",
					returnPackAgreement: input.returnPackAgreement ?? false,
					categoryId: input.categoryId ?? null,
					addedBy: userId,
				})
				.returning();

			return { supplier: created };
		}),

	// Update a supplier
	updateSupplier: warehouseProcedure
		.input(
			z.object({
				id: z.number(),
				name: z.string().min(1),
				company: z.string().optional(),
				contactPerson: z.string().optional(),
				phone: z.string().optional(),
				email: z.string().email().optional().or(z.literal("")),
				address: z.string().optional(),
				notes: z.string().optional(),
				creditLimit: z.string().optional(),
				returnPackAgreement: z.boolean().optional(),
				categoryId: z.number().int().optional().nullable(),
				isActive: z.boolean().optional(),
				status: z.enum(["active", "suspended"]).optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Only include fields that were explicitly provided
			const updateData: Record<string, any> = { name: input.name };
			if (input.company !== undefined)
				updateData.company = input.company || null;
			if (input.contactPerson !== undefined)
				updateData.contactPerson = input.contactPerson || null;
			if (input.phone !== undefined) updateData.phone = input.phone || null;
			if (input.email !== undefined) updateData.email = input.email || null;
			if (input.address !== undefined)
				updateData.address = input.address || null;
			if (input.notes !== undefined) updateData.notes = input.notes || null;
			if (input.creditLimit !== undefined)
				updateData.creditLimit = input.creditLimit;
			if (input.returnPackAgreement !== undefined)
				updateData.returnPackAgreement = input.returnPackAgreement;
			if (input.categoryId !== undefined)
				updateData.categoryId = input.categoryId;
			if (input.isActive !== undefined) updateData.isActive = input.isActive;
			if (input.status !== undefined) updateData.status = input.status;

			const [updated] = await db
				.update(supplier)
				.set(updateData)
				.where(and(eq(supplier.id, input.id), eq(supplier.addedBy, userId)))
				.returning();

			if (!updated) {
				throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
			}

			return { supplier: updated };
		}),

	// Delete a supplier
	deleteSupplier: warehouseProcedure
		.input(z.object({ id: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			await db
				.delete(supplier)
				.where(and(eq(supplier.id, input.id), eq(supplier.addedBy, userId)));

			return { success: true };
		}),
};

// ────────────────────────────────────────────────────────────────
// Purchase CRUD + Receive Stock (warehouse role only)
// ────────────────────────────────────────────────────────────────

const purchaseQueries = {
	// List purchases for current warehouse
	getPurchases: warehouseProcedure
		.input(
			z.object({
				status: z
					.enum(["draft", "received", "partial", "cancelled"])
					.optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { page, limit, status } = input;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [eq(purchase.warehouseId, userId)];
			if (status) conditions.push(eq(purchase.status, status));

			const [purchases, countResult] = await Promise.all([
				db.query.purchase.findMany({
					where: and(...conditions),
					with: {
						supplier: true,
						items: true,
					},
					orderBy: [desc(purchase.createdAt)],
					limit,
					offset,
				}),
				db
					.select({ count: count() })
					.from(purchase)
					.where(and(...conditions)),
			]);

			return {
				purchases,
				pagination: {
					page,
					limit,
					totalCount: countResult[0]?.count || 0,
					totalPages: Math.ceil((countResult[0]?.count || 0) / limit),
				},
			};
		}),

	// Create a new purchase order
	createPurchase: warehouseProcedure
		.input(
			z.object({
				supplierId: z.number(),
				supplierInvoiceNo: z.string().optional(),
				purchaseDate: z.string().optional(),
				transportCost: z.string().optional(),
				paymentType: z.enum(["cash", "credit"]).optional(),
				note: z.string().optional(),
				items: z
					.array(
						z.object({
							variantId: z.number().optional(),
							productName: z.string(),
							quantity: z.string(),
							unitCost: z.string(),
							batchNo: z.string().optional(),
							expiryDate: z.string().optional(),
						}),
					)
					.min(1),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Verify supplier belongs to this warehouse
			const sup = await db.query.supplier.findFirst({
				where: and(
					eq(supplier.id, input.supplierId),
					eq(supplier.addedBy, userId),
				),
			});
			if (!sup) {
				throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
			}

			// Generate purchase number
			const now = new Date();
			const dateStr = localDateStamp(now);
			const randomSuffix = Math.floor(Math.random() * 1000)
				.toString()
				.padStart(3, "0");
			const purchaseNumber = `PO-${dateStr}-${randomSuffix}`;

			// Calculate totals
			let subtotal = 0;
			const itemsToInsert = input.items.map((item) => {
				const qty = parseFloat(item.quantity);
				const cost = parseFloat(item.unitCost);
				const totalCost = qty * cost;
				subtotal += totalCost;
				return {
					variantId: item.variantId || null,
					productName: item.productName,
					quantity: item.quantity,
					unitCost: item.unitCost,
					totalCost: totalCost.toFixed(2),
					batchNo: item.batchNo || null,
					expiryDate: item.expiryDate || null,
				};
			});

			const transportCost = parseFloat(input.transportCost || "0");
			const grandTotal = subtotal + transportCost;

			// Create purchase + items in transaction
			const result = await db.transaction(async (tx) => {
				const [created] = await tx
					.insert(purchase)
					.values({
						purchaseNumber,
						supplierId: input.supplierId,
						warehouseId: userId,
						supplierInvoiceNo: input.supplierInvoiceNo || null,
						purchaseDate: input.purchaseDate || null,
						subtotal: subtotal.toFixed(2),
						transportCost: transportCost.toFixed(2),
						total: grandTotal.toFixed(2),
						paymentType: input.paymentType || "cash",
						note: input.note || null,
						status: "draft",
					})
					.returning();

				if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR");

				await tx.insert(purchaseItem).values(
					itemsToInsert.map((item) => ({
						...item,
						purchaseId: created.id,
					})),
				);

				return created;
			});

			return { purchase: result };
		}),

	// Receive a purchase — adds stock to inventory + creates ledger entries
	receivePurchase: warehouseProcedure
		.input(z.object({ purchaseId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingPurchase = await db.query.purchase.findFirst({
				where: and(
					eq(purchase.id, input.purchaseId),
					eq(purchase.warehouseId, userId),
				),
				with: { items: true },
			});

			if (!existingPurchase) {
				throw new ORPCError("NOT_FOUND", { message: "Purchase not found" });
			}

			if (existingPurchase.status === "received") {
				throw new ORPCError("CONFLICT", {
					message: "Purchase already received",
				});
			}

			if (existingPurchase.status === "cancelled") {
				throw new ORPCError("CONFLICT", { message: "Purchase was cancelled" });
			}

			await db.transaction(async (tx) => {
				// For each item, update inventory and create ledger entry
				for (const item of existingPurchase.items) {
					const qty = parseFloat(item.quantity);

					// Only update inventory/ledger for items with a linked product variant
					if (item.variantId) {
						// Upsert inventory record
						const existingInv = await tx.query.inventory.findFirst({
							where: and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, userId),
								eq(inventory.variantId, item.variantId),
							),
						});

						if (existingInv) {
							const newQty = parseFloat(existingInv.availableQty) + qty;
							await tx
								.update(inventory)
								.set({ availableQty: newQty.toFixed(2) })
								.where(eq(inventory.id, existingInv.id));
						} else {
							await tx.insert(inventory).values({
								ownerType: "warehouse",
								ownerId: userId,
								variantId: item.variantId,
								availableQty: qty.toFixed(2),
							});
						}
					}

					// Update received qty on purchase item
					await tx
						.update(purchaseItem)
						.set({ receivedQty: item.quantity })
						.where(eq(purchaseItem.id, item.id));
				}

				// Mark purchase as received
				await tx
					.update(purchase)
					.set({
						status: "received",
						receivedAt: new Date(),
					})
					.where(eq(purchase.id, existingPurchase.id));

				// If payment type is credit, add to supplier's outstanding payable
				if (existingPurchase.paymentType === "credit") {
					const sup = await tx.query.supplier.findFirst({
						where: eq(supplier.id, existingPurchase.supplierId),
					});
					if (sup) {
						const newPayable =
							parseFloat(sup.currentPayable) +
							parseFloat(existingPurchase.total);
						await tx
							.update(supplier)
							.set({ currentPayable: newPayable.toFixed(2) })
							.where(eq(supplier.id, sup.id));
					}
				}
			});

			return { success: true };
		}),

	// Cancel a purchase
	cancelPurchase: warehouseProcedure
		.input(z.object({ purchaseId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const [updated] = await db
				.update(purchase)
				.set({ status: "cancelled" })
				.where(
					and(
						eq(purchase.id, input.purchaseId),
						eq(purchase.warehouseId, userId),
						eq(purchase.status, "draft"),
					),
				)
				.returning();

			if (!updated) {
				throw new ORPCError("NOT_FOUND", {
					message: "Purchase not found or cannot be cancelled",
				});
			}

			return { success: true };
		}),
};

// ────────────────────────────────────────────────────────────────
// Product Activation (Phase C) — browse assigned categories and
// add products to warehouse inventory
// ────────────────────────────────────────────────────────────────

import {
	warehouseCategoryAssignment,
	category as categoryTable,
} from "@bikalpo-project/db/schema";

const productActivation = {
	/**
	 * Get products from the warehouse's admin-assigned categories.
	 * Each variant is annotated with { inInventory: boolean }.
	 */
	getAssignedProducts: warehouseProcedure
		.input(
			z.object({
				search: z.string().optional(),
				categoryId: z.number().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Get assigned category IDs for this warehouse
			const assignments = await db.query.warehouseCategoryAssignment.findMany({
				where: eq(warehouseCategoryAssignment.warehouseId, userId),
				columns: { categoryId: true },
			});

			const assignedCategoryIds = [
				...new Set(assignments.map((a) => a.categoryId)),
			];
			if (assignedCategoryIds.length === 0) {
				return { products: [], assignedCategories: [] };
			}

			// 2. Get assigned categories with names
			const assignedCategories = await db
				.select({ id: categoryTable.id, name: categoryTable.name })
				.from(categoryTable)
				.where(inArray(categoryTable.id, assignedCategoryIds));

			// 3. Filter by categoryId if provided
			const catFilter = input.categoryId
				? [input.categoryId]
				: assignedCategoryIds;

			// 4. Get products from those categories with variants
			const products = await db.query.product.findMany({
				where: and(
					inArray(productTable.categoryId, catFilter),
					eq(productTable.status, "active"),
					input.search
						? sql`${productTable.name} ILIKE ${`%${input.search}%`}`
						: undefined,
				),
				with: {
					category: { columns: { name: true } },
					subCategory: { columns: { name: true } },
					images: { limit: 1 },
					variants: {
						where: eq(productVariant.isActive, true),
						columns: {
							id: true,
							sku: true,
							unitLabel: true,
							weightKg: true,
							price: true,
							packagingType: true,
							packType: true,
							innerPackSizeKg: true,
							packCountInside: true,
							brandId: true,
						},
						with: {
							brand: { columns: { id: true, name: true } },
							sourceVariantOption: true,
						},
					},
				},
				orderBy: [productTable.name],
			});

			// 5. Check which variants are already in this warehouse's inventory
			const existingInventory = await db
				.select({ variantId: inventory.variantId })
				.from(inventory)
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, userId),
					),
				);

			const inventoryVariantIds = new Set(
				existingInventory.map((i) => i.variantId),
			);

			// 6. Annotate each variant with inInventory flag
			const annotatedProducts = products.map((p) => ({
				...p,
				variants: p.variants.map((v) => ({
					...v,
					inInventory: inventoryVariantIds.has(v.id),
				})),
			}));

			return {
				products: annotatedProducts,
				assignedCategories,
			};
		}),

	/**
	 * Add a product variant to the warehouse's inventory.
	 */
	addToInventory: warehouseProcedure
		.input(
			z.object({
				variantId: z.number(),
				retailPrice: z.string().min(1),
				initialStock: z.string().default("0"),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Check if already in inventory
			const existing = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
					eq(inventory.variantId, input.variantId),
				),
			});

			if (existing) {
				throw new ORPCError("CONFLICT", {
					message: "This variant is already in your inventory",
				});
			}

			// Verify the variant exists and belongs to an assigned category
			const variant = await db.query.productVariant.findFirst({
				where: eq(productVariant.id, input.variantId),
				with: {
					product: { columns: { categoryId: true } },
				},
			});

			if (!variant) {
				throw new ORPCError("NOT_FOUND", { message: "Variant not found" });
			}

			// Check category assignment
			const assignment = await db.query.warehouseCategoryAssignment.findFirst({
				where: and(
					eq(warehouseCategoryAssignment.warehouseId, userId),
					eq(
						warehouseCategoryAssignment.categoryId,
						variant.product.categoryId,
					),
				),
			});

			if (!assignment) {
				throw new ORPCError("FORBIDDEN", {
					message: "Your warehouse is not assigned to this product's category",
				});
			}

			const [created] = await db
				.insert(inventory)
				.values({
					ownerType: "warehouse",
					ownerId: userId,
					variantId: input.variantId,
					availableQty: input.initialStock,
					retailPrice: input.retailPrice,
				})
				.returning();

			return { inventory: created };
		}),

	/**
	 * Update an existing inventory item (price, quantity).
	 */
	updateInventoryItem: warehouseProcedure
		.input(
			z.object({
				inventoryId: z.number(),
				retailPrice: z.string().optional(),
				availableQty: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.id, input.inventoryId),
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", {
					message: "Inventory item not found",
				});
			}

			const updateData: Record<string, any> = {};
			if (input.retailPrice !== undefined)
				updateData.retailPrice = input.retailPrice;
			if (input.availableQty !== undefined)
				updateData.availableQty = input.availableQty;

			const [updated] = await db
				.update(inventory)
				.set(updateData)
				.where(eq(inventory.id, input.inventoryId))
				.returning();

			return { inventory: updated };
		}),

	/**
	 * Remove a product variant from warehouse inventory.
	 */
	removeFromInventory: warehouseProcedure
		.input(z.object({ inventoryId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const [deleted] = await db
				.delete(inventory)
				.where(
					and(
						eq(inventory.id, input.inventoryId),
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, userId),
					),
				)
				.returning();

			if (!deleted) {
				throw new ORPCError("NOT_FOUND", {
					message: "Inventory item not found",
				});
			}

			return { success: true };
		}),
};

// ────────────────────────────────────────────────────────────────
// Catalog Hierarchy Browse (Phase C+) — Type→Category→SubCat→Core
// ────────────────────────────────────────────────────────────────

import {
	adminProductGenerationTemplate,
	coreProductIdentity,
	warehouseProductGenerationTemplate,
} from "@bikalpo-project/db/schema";

const catalogBrowse = {
	/**
	 * Get the FULL system catalog: Type → Category → SubCategory → Core Products.
	 * Shows ALL core products (not filtered by warehouse assignments).
	 * Annotates each variant with whether it's in the warehouse's inventory.
	 */
	getFullCatalog: warehouseProcedure
		.input(
			z.object({
				typeId: z.number().optional(),
				categoryId: z.number().optional(),
				subCategoryId: z.number().optional(),
				search: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const activeBrandIds = (
				await db.query.brand.findMany({
					where: eq(brandTable.isActive, true),
					columns: { id: true },
				})
			).map((row) => row.id);

			// 1. Build core product conditions
			const coreConditions: SQL[] = [
				eq(coreProductIdentity.creatorSource, "admin"),
			];
			if (input.categoryId) {
				coreConditions.push(
					eq(coreProductIdentity.categoryId, input.categoryId),
				);
			}
			if (input.subCategoryId) {
				coreConditions.push(
					eq(coreProductIdentity.subCategoryId, input.subCategoryId),
				);
			}
			if (input.search?.trim()) {
				coreConditions.push(
					sql`${coreProductIdentity.name} ILIKE ${`%${input.search.trim()}%`}`,
				);
			}

			// 2. Fetch all core products with category/type hierarchy
			const coreProducts = await db.query.coreProductIdentity.findMany({
				where: coreConditions.length > 0 ? and(...coreConditions) : undefined,
				orderBy: [coreProductIdentity.name],
				with: {
					category: {
						columns: { id: true, name: true, slug: true, typeId: true },
						with: {
							type: { columns: { id: true, name: true, slug: true } },
							subCategory: {
								columns: { id: true, name: true, slug: true },
							},
						},
					},
					subCategory: {
						columns: { id: true, name: true, slug: true },
					},
				},
			});

			// 3. Filter by typeId if provided (post-query since type is nested)
			const filteredCoreProducts = input.typeId
				? coreProducts.filter((cp) => cp.category?.typeId === input.typeId)
				: coreProducts;

			// 4. Get all linked products for these core identities
			const coreProductIds = filteredCoreProducts.map((cp) => cp.id);
			let linkedProducts: any[] = [];
			if (coreProductIds.length > 0) {
				linkedProducts = await db.query.product.findMany({
					where: and(
						inArray(productTable.coreProductId, coreProductIds),
						or(
							and(
								eq(productTable.creatorSource, "admin"),
								eq(productTable.status, "active"),
							),
							and(
								eq(productTable.creatorSource, "warehouse"),
								eq(productTable.createdById, userId),
							),
						)!,
					),
					columns: {
						id: true,
						name: true,
						coreProductId: true,
						brandId: true,
						creatorSource: true,
						createdById: true,
					},
					with: {
						brand: { columns: { id: true, name: true } },
						variants: {
							where: eq(productVariant.isActive, true),
							columns: {
								id: true,
								sku: true,
								unitLabel: true,
								weightKg: true,
								price: true,
								brandId: true,
							},
							with: {
								brand: { columns: { id: true, name: true } },
							},
						},
					},
				});
			}

			// 5. Get warehouse's current inventory variant IDs
			const existingInventory = await db
				.select({ variantId: inventory.variantId })
				.from(inventory)
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, userId),
					),
				);
			const inventoryVariantIds = new Set(
				existingInventory.map((i) => i.variantId),
			);

			// 6. Build Type → Category → SubCategory → CoreProduct hierarchy
			const typeMap = new Map<number, any>();

			for (const cp of filteredCoreProducts) {
				const cat = cp.category;
				if (!cat) continue;
				const typeData = cat.type || {
					id: 0,
					name: "Uncategorized",
					slug: "uncategorized",
				};
				const typeId = (typeData as any).id || 0;

				if (!typeMap.has(typeId)) {
					typeMap.set(typeId, {
						...typeData,
						categories: new Map<number, any>(),
					});
				}

				const typeEntry = typeMap.get(typeId);
				if (!typeEntry.categories.has(cat.id)) {
					typeEntry.categories.set(cat.id, {
						id: cat.id,
						name: cat.name,
						slug: cat.slug,
						subCategories: new Map<number, any>(),
						directCoreProducts: [],
					});
				}

				const catEntry = typeEntry.categories.get(cat.id);

				// Build core product data with products/variants
				const cpProducts = linkedProducts.filter(
					(p: any) => p.coreProductId === cp.id,
				);
				const configuredWarehouseBrandIds = [
					...new Set<number>(
						cpProducts
							.filter(
								(p: any) =>
									p.creatorSource === "warehouse" && p.createdById === userId,
							)
							.map((p: any) => p.brandId)
							.filter((brandId: unknown): brandId is number =>
								Number.isInteger(brandId),
							),
					),
				];
				const coreProductData = {
					id: cp.id,
					name: cp.name,
					slug: cp.slug,
					image: cp.image,
					brandCreationMode: cp.brandCreationMode,
					products: cpProducts.map((p: any) => ({
						...p,
						variants: p.variants.map((v: any) => ({
							...v,
							inInventory: inventoryVariantIds.has(v.id),
							brand: v.brand || p.brand || null,
							brandId: v.brandId || p.brandId || null,
						})),
					})),
					adminBrandCount: new Set(
						cpProducts
							.filter((p: any) => p.creatorSource === "admin")
							.map((p: any) => p.brandId)
							.filter(Boolean),
					).size,
					warehouseBrandCount: configuredWarehouseBrandIds.length,
					warehouseAddableBrandCount: countAddableBrands(
						activeBrandIds,
						configuredWarehouseBrandIds,
					),
				};

				if (cp.subCategoryId && cp.subCategory) {
					const sc = cp.subCategory;
					if (!catEntry.subCategories.has(sc.id)) {
						catEntry.subCategories.set(sc.id, {
							id: sc.id,
							name: sc.name,
							slug: sc.slug,
							coreProducts: [],
						});
					}
					catEntry.subCategories.get(sc.id).coreProducts.push(coreProductData);
				} else {
					catEntry.directCoreProducts.push(coreProductData);
				}
			}

			// 7. Convert Maps to arrays for response
			const types = Array.from(typeMap.values()).map((t) => ({
				id: t.id,
				name: t.name,
				slug: t.slug,
				categories: Array.from(t.categories.values()).map((c: any) => ({
					...c,
					subCategories: Array.from(c.subCategories.values()),
				})),
			}));

			return { types };
		}),

	/**
	 * Get hierarchical catalog: Type → Category → SubCategory → Core Products.
	 * Filters by warehouse's assigned categories.
	 */
	getCatalogHierarchy: warehouseProcedure
		.input(
			z.object({
				typeId: z.number().optional(),
				categoryId: z.number().optional(),
				subCategoryId: z.number().optional(),
				search: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Get assigned category IDs
			const assignments = await db.query.warehouseCategoryAssignment.findMany({
				where: eq(warehouseCategoryAssignment.warehouseId, userId),
				columns: { categoryId: true },
			});

			const assignedCategoryIds = [
				...new Set(assignments.map((a) => a.categoryId)),
			];
			if (assignedCategoryIds.length === 0) {
				return { types: [] };
			}

			// 2. Get categories with type info
			const categories = await db.query.category.findMany({
				where: inArray(categoryTable.id, assignedCategoryIds),
				with: {
					type: true,
					subCategory: {
						where: input.subCategoryId
							? eq(sql`id`, input.subCategoryId)
							: undefined,
					},
				},
			});

			// 3. Filter by typeId if provided
			const filteredCats = input.typeId
				? categories.filter((c) => c.typeId === input.typeId)
				: categories;

			// 4. Filter by categoryId if provided
			const finalCats = input.categoryId
				? filteredCats.filter((c) => c.id === input.categoryId)
				: filteredCats;

			// 5. Get all subcategory IDs from filtered categories
			// (allSubCatIds used implicitly via coreProducts query on categoryId)

			// Also get category IDs for core products without subcategory
			const allCatIds = finalCats.map((c) => c.id);

			// 6. Get core product identities in these categories/subcats
			const searchCondition = input.search
				? sql`${coreProductIdentity.name} ILIKE ${`%${input.search}%`}`
				: undefined;

			const coreProducts = await db.query.coreProductIdentity.findMany({
				where: and(
					inArray(coreProductIdentity.categoryId, allCatIds),
					searchCondition,
				),
				with: {},
				orderBy: [coreProductIdentity.name],
			});

			// 7. Get existing products linked to these core identities
			const coreProductIds = coreProducts.map((cp) => cp.id);
			let linkedProducts: any[] = [];
			if (coreProductIds.length > 0) {
				linkedProducts = await db.query.product.findMany({
					where: and(
						inArray(productTable.coreProductId, coreProductIds),
						eq(productTable.status, "active"),
					),
					columns: {
						id: true,
						name: true,
						coreProductId: true,
						brandId: true,
					},
					with: {
						brand: { columns: { id: true, name: true } },
						variants: {
							where: eq(productVariant.isActive, true),
							columns: {
								id: true,
								sku: true,
								unitLabel: true,
								weightKg: true,
								price: true,
								brandId: true,
							},
							with: {
								brand: { columns: { id: true, name: true } },
							},
						},
					},
				});
			}

			// 8. Get warehouse's current inventory variant IDs
			const existingInventory = await db
				.select({ variantId: inventory.variantId })
				.from(inventory)
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, userId),
					),
				);
			const inventoryVariantIds = new Set(
				existingInventory.map((i) => i.variantId),
			);

			// 9. Build hierarchy response
			const typeMap = new Map<number, any>();

			for (const cat of finalCats) {
				const typeData = cat.type || {
					id: 0,
					name: "Uncategorized",
					slug: "uncategorized",
				};
				const typeId = (typeData as any).id || 0;

				if (!typeMap.has(typeId)) {
					typeMap.set(typeId, {
						...typeData,
						categories: [],
					});
				}

				const subCats = (cat.subCategory || []).map((sc: any) => {
					const subCatCoreProducts = coreProducts
						.filter((cp) => cp.subCategoryId === sc.id)
						.map((cp) => {
							const cpProducts = linkedProducts.filter(
								(p) => p.coreProductId === cp.id,
							);
							return {
								...cp,
								products: cpProducts.map((p: any) => ({
									...p,
									variants: p.variants.map((v: any) => ({
										...v,
										inInventory: inventoryVariantIds.has(v.id),
										// Fall back to product-level brand if variant has no brand
										brand: v.brand || p.brand || null,
										brandId: v.brandId || p.brandId || null,
									})),
								})),
							};
						});

					return {
						...sc,
						coreProducts: subCatCoreProducts,
					};
				});

				// Also get core products directly under category (no subcategory)
				const directCoreProducts = coreProducts
					.filter((cp) => cp.categoryId === cat.id && !cp.subCategoryId)
					.map((cp) => {
						const cpProducts = linkedProducts.filter(
							(p) => p.coreProductId === cp.id,
						);
						return {
							...cp,
							products: cpProducts.map((p: any) => ({
								...p,
								variants: p.variants.map((v: any) => ({
									...v,
									inInventory: inventoryVariantIds.has(v.id),
									// Fall back to product-level brand if variant has no brand
									brand: v.brand || p.brand || null,
									brandId: v.brandId || p.brandId || null,
								})),
							})),
						};
					});

				typeMap.get(typeId).categories.push({
					id: cat.id,
					name: cat.name,
					slug: cat.slug,
					subCategories: subCats,
					directCoreProducts,
				});
			}

			return { types: Array.from(typeMap.values()) };
		}),
};

// ────────────────────────────────────────────────────────────────
// Product Identity Requests
// ────────────────────────────────────────────────────────────────

import { productIdentityRequest } from "@bikalpo-project/db/schema";

const productRequests = {
	/** Submit a product identity request */
	submitProductRequest: warehouseProcedure
		.input(
			z.object({
				typeName: z.string().optional(),
				categoryName: z.string().optional(),
				subCategoryName: z.string().optional(),
				productName: z.string().min(1),
				description: z.string().optional(),
				referenceImage: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const [created] = await db
				.insert(productIdentityRequest)
				.values({
					requestedBy: userId,
					typeName: input.typeName || null,
					categoryName: input.categoryName || null,
					subCategoryName: input.subCategoryName || null,
					productName: input.productName,
					description: input.description || null,
					referenceImage: input.referenceImage || null,
					status: "pending",
				})
				.returning();

			return { request: created };
		}),

	/** Get my product requests */
	getMyProductRequests: warehouseProcedure
		.input(
			z.object({
				status: z.enum(["pending", "approved", "rejected"]).optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const conditions: SQL[] = [
				eq(productIdentityRequest.requestedBy, userId),
			];
			if (input.status) {
				conditions.push(eq(productIdentityRequest.status, input.status));
			}

			const requests = await db.query.productIdentityRequest.findMany({
				where: and(...conditions),
				orderBy: [desc(productIdentityRequest.createdAt)],
			});

			return { requests };
		}),
};

// ────────────────────────────────────────────────────────────────
// Warehouse Product Creation (warehouse creates its own products)
// ────────────────────────────────────────────────────────────────

import {
	brand as brandTable,
	productBrand,
	productImage,
	productVariantPrice,
	variantOption,
	warehouseVariantAlias,
} from "@bikalpo-project/db/schema";

const warehouseConfiguredVariantSchema = z.object({
	variantOptionId: z.number().int().positive(),
	color: z.string().trim().min(1).max(50).optional().nullable(),
});

const warehouseTemplateDetailsSchema = z.object({
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

function assertWarehouseExpiryConfiguration(
	details: z.infer<typeof warehouseTemplateDetailsSchema>,
) {
	if (details.expiryEnabled && details.trackingType !== "batch") {
		throw new ORPCError("BAD_REQUEST", {
			message: "Expiry tracking requires batch tracking to be enabled",
		});
	}
}

function validateStockTrackingOrThrow(
	input: Parameters<typeof validateWarehouseStockTracking>[0],
) {
	try {
		return validateWarehouseStockTracking(input);
	} catch (error) {
		if (error instanceof WarehouseExpiryValidationError) {
			throw new ORPCError("BAD_REQUEST", { message: error.message });
		}
		throw error;
	}
}

const configureWarehouseCoreSchema = z.object({
	coreProductId: z.number().int().positive(),
	expectedVersion: z.number().int().positive().optional().nullable(),
	details: warehouseTemplateDetailsSchema,
	brands: z
		.array(
			z.object({
				brandId: z.number().int().positive(),
				variants: z.array(warehouseConfiguredVariantSchema).min(1),
			}),
		)
		.min(1),
	variantAliases: z
		.array(
			z.object({
				variantOptionId: z.number().int().positive(),
				alias: z.string().trim().min(1).max(100),
			}),
		)
		.default([]),
});

const updateWarehouseProductSchema = z.object({
	productId: z.number().int().positive(),
	details: warehouseTemplateDetailsSchema.extend({
		status: z.enum(["active", "draft", "inactive"]),
	}),
	variants: z.array(warehouseConfiguredVariantSchema).min(1),
});

function warehouseVariantKey(input: {
	variantOptionId: number;
	color?: string | null;
}) {
	return `${input.variantOptionId}:${String(input.color || "")
		.trim()
		.toLowerCase()}`;
}

function warehouseTemplateDetails(
	core: { name: string; slug: string },
	details: z.infer<typeof warehouseTemplateDetailsSchema>,
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

const warehouseProductCreation = {
	/** Load one warehouse-owned brand product for locked-structure editing. */
	getWarehouseProductForEdit: warehouseProcedure
		.input(z.object({ productId: z.number().int().positive() }))
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const found = await db.query.product.findFirst({
				where: and(
					eq(productTable.id, input.productId),
					eq(productTable.creatorSource, "warehouse"),
					or(
						eq(productTable.createdById, warehouseId),
						eq(productTable.createdByWarehouseId, warehouseId),
					)!,
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
					productBrands: {
						with: { brand: true },
					},
					variantPrices: {
						with: { variantOption: true },
					},
					variants: {
						with: { sourceVariantOption: true },
					},
				},
			});
			if (!found || !found.coreProductId || !found.brandId) {
				throw new ORPCError("NOT_FOUND", {
					message: "Warehouse product not found or is not configurable",
				});
			}

			const typeId = found.category?.typeId ?? null;
			const options = await db.query.variantOption.findMany({
				where: and(
					eq(variantOption.isActive, true),
					or(
						and(
							sql`${variantOption.typeId} IS NULL`,
							sql`${variantOption.categoryId} IS NULL`,
						),
						and(
							eq(variantOption.typeId, typeId!),
							sql`${variantOption.categoryId} IS NULL`,
						),
						and(
							eq(variantOption.typeId, typeId!),
							eq(variantOption.categoryId, found.categoryId),
						),
					)!,
				),
				orderBy: [variantOption.name],
			});

			return {
				product: found,
				options: {
					variantOptions: options.filter(isConcreteVariantOption),
				},
			};
		}),

	/** Update one warehouse-owned product without changing its core or brand. */
	updateWarehouseProduct: warehouseProcedure
		.input(updateWarehouseProductSchema)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			assertWarehouseExpiryConfiguration(input.details);
			const keys = input.variants.map(warehouseVariantKey);
			if (new Set(keys).size !== keys.length) {
				throw new ORPCError("BAD_REQUEST", {
					message: "A variant/color combination can only be selected once",
				});
			}

			return db.transaction(async (tx) => {
				const existing = await tx.query.product.findFirst({
					where: and(
						eq(productTable.id, input.productId),
						eq(productTable.creatorSource, "warehouse"),
						or(
							eq(productTable.createdById, warehouseId),
							eq(productTable.createdByWarehouseId, warehouseId),
						)!,
					),
					with: {
						brand: true,
						category: { columns: { typeId: true } },
						variants: true,
					},
				});
				if (!existing || !existing.coreProductId || !existing.brandId) {
					throw new ORPCError("NOT_FOUND", {
						message: "Warehouse product not found or is not configurable",
					});
				}

				const optionIds = input.variants.map((row) => row.variantOptionId);
				const optionRows = await tx.query.variantOption.findMany({
					where: inArray(variantOption.id, optionIds),
				});
				if (optionRows.length !== new Set(optionIds).size) {
					throw new ORPCError("BAD_REQUEST", {
						message: "One or more selected variants are invalid",
					});
				}
				const typeId = existing.category?.typeId ?? null;
				for (const option of optionRows) {
					const valid =
						option.isActive &&
						((option.typeId === null && option.categoryId === null) ||
							(option.typeId === typeId && option.categoryId === null) ||
							(option.typeId === typeId &&
								option.categoryId === existing.categoryId));
					if (!valid) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Variant "${option.name}" is not available for this product`,
						});
					}
					resolveConcreteVariantForConfig(option);
				}

				const desired = new Map(
					input.variants.map((row) => [warehouseVariantKey(row), row]),
				);
				const managedVariants = existing.variants.filter(
					(row) => row.sourceVariantOptionId !== null,
				);
				const current = new Map(
					managedVariants.map((row) => [
						warehouseVariantKey({
							variantOptionId: row.sourceVariantOptionId!,
							color: row.color,
						}),
						row,
					]),
				);
				const removed = managedVariants.filter(
					(row) =>
						!desired.has(
							warehouseVariantKey({
								variantOptionId: row.sourceVariantOptionId!,
								color: row.color,
							}),
						),
				);
				if (removed.length > 0) {
					const [live] = await tx
						.select({ count: count() })
						.from(inventory)
						.where(
							and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, warehouseId),
								inArray(
									inventory.variantId,
									removed.map((row) => row.id),
								),
								sql`(${inventory.availableQty}::numeric > 0 OR ${inventory.reservedQty}::numeric > 0 OR ${inventory.inCartonQty}::numeric > 0 OR ${inventory.activeCartonCount} > 0)`,
							),
						);
					if (Number(live?.count ?? 0) > 0) {
						throw new ORPCError("CONFLICT", {
							message:
								"A removed variant still has stock or active cartons. Resolve its inventory first.",
						});
					}
					await tx
						.update(productVariant)
						.set({ isActive: false })
						.where(
							inArray(
								productVariant.id,
								removed.map((row) => row.id),
							),
						);
					const removedPriceIds = removed.flatMap((row) =>
						row.sourceVariantPriceId ? [row.sourceVariantPriceId] : [],
					);
					if (removedPriceIds.length > 0) {
						await tx
							.update(productVariantPrice)
							.set({ isActive: false })
							.where(inArray(productVariantPrice.id, removedPriceIds));
					}
				}

				const optionMap = new Map(optionRows.map((row) => [row.id, row]));
				let sortOrder = existing.variants.length;
				for (const [key, row] of desired) {
					const currentRow = current.get(key);
					const option = optionMap.get(row.variantOptionId)!;
					const resolved = resolveConcreteVariantForConfig(option);
					if (currentRow) {
						await tx
							.update(productVariant)
							.set({
								isActive: true,
								unitLabel: resolved.label,
								quantitySelectorLabel: resolved.label,
								packagingType: resolved.packagingType,
								weightKg: resolved.weightKg,
								orderUnit: resolved.orderUnit,
								packType: resolved.packType,
								packWeightKg: resolved.weightKg || null,
								sellUnit: resolved.label,
							})
							.where(eq(productVariant.id, currentRow.id));
						if (currentRow.sourceVariantPriceId) {
							await tx
								.update(productVariantPrice)
								.set({ isActive: true })
								.where(
									eq(productVariantPrice.id, currentRow.sourceVariantPriceId),
								);
						}
						await tx
							.insert(inventory)
							.values({
								ownerType: "warehouse",
								ownerId: warehouseId,
								variantId: currentRow.id,
								availableQty: "0",
								retailPrice: null,
							})
							.onConflictDoNothing({
								target: [
									inventory.ownerType,
									inventory.ownerId,
									inventory.variantId,
								],
							});
						continue;
					}
					const [priceRow] = await tx
						.insert(productVariantPrice)
						.values({
							productId: existing.id,
							variantOptionId: option.id,
							brandId: existing.brandId,
							consumerPrice: "0",
							sortOrder,
						})
						.returning();
					const [variantRow] = await tx
						.insert(productVariant)
						.values({
							productId: existing.id,
							brandId: existing.brandId,
							color: row.color?.trim() || null,
							size: option.size ?? null,
							sku: `WH-${existing.id}-B${existing.brandId}-VO${option.id}-${sortOrder}`,
							unitLabel: resolved.label,
							quantitySelectorLabel: resolved.label,
							packagingType: resolved.packagingType,
							weightKg: resolved.weightKg,
							price: "0",
							orderMin: input.details.minimumOrderEnabled
								? input.details.minimumOrderQty
								: "1",
							orderUnit: resolved.orderUnit,
							packType: resolved.packType,
							packWeightKg: resolved.weightKg || null,
							sellUnit: resolved.label,
							variantType: "trade",
							orderType: "b2b",
							visibilityRole: "shop_owner",
							stockSource: "warehouse",
							sourceVariantPriceId: priceRow!.id,
							sourceVariantOptionId: option.id,
							stockQuantity: 0,
							reorderLevel: 0,
							sortOrder,
							isActive: true,
						})
						.returning();
					await tx.insert(inventory).values({
						ownerType: "warehouse",
						ownerId: warehouseId,
						variantId: variantRow!.id,
						availableQty: "0",
						retailPrice: null,
					});
					sortOrder++;
				}

				await tx
					.update(productTable)
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
						isReturnablePack: input.details.isReturnablePack,
						defaultPackDepositAmount: input.details.defaultPackDepositAmount,
						allowedPackBrands: input.details.allowedPackBrands,
						allowedPackSizes: input.details.allowedPackSizes,
						visibility: input.details.visibility,
						status: input.details.status,
					})
					.where(eq(productTable.id, existing.id));
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
				await linkProductVariantsToCatalog(tx, existing.id);
				return { productId: existing.id };
			});
		}),
	/** Load admin defaults and this warehouse's independent configuration. */
	getWarehouseCoreConfiguration: warehouseProcedure
		.input(z.object({ coreProductId: z.number().int().positive() }))
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const core = await db.query.coreProductIdentity.findFirst({
				where: and(
					eq(coreProductIdentity.id, input.coreProductId),
					eq(coreProductIdentity.creatorSource, "admin"),
				),
				with: {
					category: {
						with: { type: true },
					},
					subCategory: true,
				},
			});
			if (!core) {
				throw new ORPCError("NOT_FOUND", {
					message: "Admin core product identity not found",
				});
			}

			const [adminTemplate, warehouseTemplate, adminProducts, currentProducts] =
				await Promise.all([
					db.query.adminProductGenerationTemplate.findFirst({
						where: eq(adminProductGenerationTemplate.coreProductId, core.id),
					}),
					db.query.warehouseProductGenerationTemplate.findFirst({
						where: and(
							eq(warehouseProductGenerationTemplate.coreProductId, core.id),
							eq(warehouseProductGenerationTemplate.warehouseId, warehouseId),
						),
					}),
					db.query.product.findMany({
						where: and(
							eq(productTable.coreProductId, core.id),
							eq(productTable.creatorSource, "admin"),
							eq(productTable.status, "active"),
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
							eq(productTable.coreProductId, core.id),
							eq(productTable.creatorSource, "warehouse"),
							eq(productTable.createdById, warehouseId),
						),
						with: {
							brand: true,
							variants: { with: { sourceVariantOption: true } },
						},
					}),
				]);

			const [brands, allVariantOptions] = await Promise.all([
				db.query.brand.findMany({ orderBy: [brandTable.name] }),
				db.query.variantOption.findMany({
					where: eq(variantOption.isActive, true),
					orderBy: [variantOption.sortOrder, variantOption.name],
				}),
			]);
			const aliases = await db.query.warehouseVariantAlias.findMany({
				where: and(
					eq(warehouseVariantAlias.warehouseId, warehouseId),
					eq(warehouseVariantAlias.coreProductId, core.id),
				),
			});
			const typeId = core.category?.typeId ?? null;
			const variantOptions = allVariantOptions.filter((option) => {
				const global = option.typeId === null && option.categoryId === null;
				const typeWide =
					typeId !== null &&
					option.typeId === typeId &&
					option.categoryId === null;
				const categoryScoped =
					typeId !== null &&
					option.typeId === typeId &&
					option.categoryId === core.categoryId;
				return (
					(global || typeWide || categoryScoped) &&
					isConcreteVariantOption(option)
				);
			});

			return {
				core,
				version: warehouseTemplate?.version ?? null,
				sourceAdminTemplateVersion:
					warehouseTemplate?.sourceAdminTemplateVersion ??
					adminTemplate?.version ??
					null,
				defaults: warehouseTemplate?.details ??
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
						.filter((product) => product.brandId !== null)
						.map((product) => ({
							brandId: product.brandId!,
							brandName: product.brand?.name ?? "Unknown brand",
							sourceProductId: product.id,
							variants: product.variantPrices.map((price) => ({
								variantOptionId: price.variantOptionId,
								variantOptionName: price.variantOption?.name ?? null,
								color: null,
								size: price.variantOption?.size ?? null,
								definitionKind: price.variantOption?.definitionKind ?? null,
								definition: price.variantOption?.definition ?? null,
								needsReview: price.variantOption?.needsReview ?? true,
							})),
						})),
				},
				current: currentProducts.map((product) => ({
					productId: product.id,
					productName: product.name,
					productSlug: product.slug,
					productImage: product.image,
					brandId: product.brandId,
					brandName: product.brand?.name ?? null,
					status: product.status,
					variants: product.variants
						.filter((variant) => variant.sourceVariantOptionId !== null)
						.map((variant) => ({
							variantId: variant.id,
							variantOptionId: variant.sourceVariantOptionId!,
							variantOptionName: variant.sourceVariantOption?.name ?? null,
							color: variant.color,
							size: variant.size,
							isActive: variant.isActive,
							definitionKind:
								variant.sourceVariantOption?.definitionKind ?? null,
							definition: variant.sourceVariantOption?.definition ?? null,
							needsReview: variant.sourceVariantOption?.needsReview ?? true,
						})),
				})),
				options: { brands, variantOptions },
				variantAliases: aliases.map((row) => ({
					variantOptionId: row.variantOptionId,
					alias: row.alias,
				})),
			};
		}),

	/** Idempotently sync one warehouse-owned product per selected brand. */
	configureWarehouseCoreProducts: warehouseProcedure
		.input(configureWarehouseCoreSchema)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			assertWarehouseExpiryConfiguration(input.details);
			const brandIds = input.brands.map((brand) => brand.brandId);
			if (new Set(brandIds).size !== brandIds.length) {
				throw new ORPCError("BAD_REQUEST", {
					message: "A brand can only be selected once",
				});
			}

			return db.transaction(async (tx) => {
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

				const existingTemplate =
					await tx.query.warehouseProductGenerationTemplate.findFirst({
						where: and(
							eq(warehouseProductGenerationTemplate.coreProductId, core.id),
							eq(warehouseProductGenerationTemplate.warehouseId, warehouseId),
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
					where: and(
						inArray(brandTable.id, brandIds),
						eq(brandTable.isActive, true),
					),
				});
				if (brandRows.length !== brandIds.length) {
					throw new ORPCError("BAD_REQUEST", {
						message: "One or more selected brands are not approved",
					});
				}
				const brandMap = new Map(brandRows.map((brand) => [brand.id, brand]));
				const optionIds = [
					...new Set(
						input.brands.flatMap((brand) =>
							brand.variants.map((variant) => variant.variantOptionId),
						),
					),
				];
				const optionRows = await tx.query.variantOption.findMany({
					where: inArray(variantOption.id, optionIds),
				});
				if (optionRows.length !== optionIds.length) {
					throw new ORPCError("BAD_REQUEST", {
						message: "One or more selected variants are not approved",
					});
				}
				const optionMap = new Map(
					optionRows.map((option) => [option.id, option]),
				);
				const selectedOptionIds = new Set(optionIds);
				if (
					input.variantAliases.some(
						(entry) => !selectedOptionIds.has(entry.variantOptionId),
					)
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Aliases can only be assigned to selected variants",
					});
				}
				await tx
					.delete(warehouseVariantAlias)
					.where(
						and(
							eq(warehouseVariantAlias.warehouseId, warehouseId),
							eq(warehouseVariantAlias.coreProductId, core.id),
							shouldDeactivateOmittedBrands(core.brandCreationMode)
								? undefined
								: inArray(warehouseVariantAlias.variantOptionId, optionIds),
						),
					);
				if (input.variantAliases.length > 0) {
					await tx.insert(warehouseVariantAlias).values(
						input.variantAliases.map((entry) => ({
							warehouseId,
							coreProductId: core.id,
							variantOptionId: entry.variantOptionId,
							alias: entry.alias,
						})),
					);
				}
				const typeId = core.category?.typeId ?? null;
				for (const option of optionRows) {
					const valid =
						option.isActive &&
						((option.typeId === null && option.categoryId === null) ||
							(option.typeId === typeId && option.categoryId === null) ||
							(option.typeId === typeId &&
								option.categoryId === core.categoryId));
					if (!valid) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Variant "${option.name}" is not available for this core product`,
						});
					}
					resolveConcreteVariantForConfig(option);
				}
				for (const brand of input.brands) {
					const keys = brand.variants.map(warehouseVariantKey);
					if (new Set(keys).size !== keys.length) {
						throw new ORPCError("BAD_REQUEST", {
							message: "A variant/color combination can only be selected once",
						});
					}
				}

				const adminProducts = await tx.query.product.findMany({
					where: and(
						eq(productTable.coreProductId, core.id),
						eq(productTable.creatorSource, "admin"),
					),
				});
				const adminByBrand = new Map(
					adminProducts
						.filter((product) => product.brandId !== null)
						.map((product) => [product.brandId!, product]),
				);
				const existingProducts = await tx.query.product.findMany({
					where: and(
						eq(productTable.coreProductId, core.id),
						eq(productTable.creatorSource, "warehouse"),
						eq(productTable.createdById, warehouseId),
					),
					with: { variants: true },
				});
				const existingByBrand = new Map(
					existingProducts
						.filter((product) => product.brandId !== null)
						.map((product) => [product.brandId!, product]),
				);

				const assertNoLiveStock = async (
					variantIds: number[],
					label: string,
				) => {
					if (variantIds.length === 0) return;
					const [live] = await tx
						.select({ count: count() })
						.from(inventory)
						.where(
							and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, warehouseId),
								inArray(inventory.variantId, variantIds),
								sql`(${inventory.availableQty}::numeric > 0 OR ${inventory.reservedQty}::numeric > 0 OR ${inventory.inCartonQty}::numeric > 0 OR ${inventory.activeCartonCount} > 0)`,
							),
						);
					if (Number(live?.count ?? 0) > 0) {
						throw new ORPCError("CONFLICT", {
							message: `${label} still has live stock or cartons. Resolve stock before removing it.`,
						});
					}
				};

				const created: number[] = [];
				const updated: number[] = [];
				const deactivated: number[] = [];
				const templateDetails = warehouseTemplateDetails(core, input.details);
				for (const brandConfig of input.brands) {
					const brand = brandMap.get(brandConfig.brandId)!;
					let targetProduct = existingByBrand.get(brand.id);
					if (!targetProduct) {
						const baseSlug =
							`${brand.slug}-${core.slug}-${warehouseId.slice(0, 6)}`
								.toLowerCase()
								.replace(/[^a-z0-9]+/g, "-")
								.replace(/(^-|-$)/g, "")
								.slice(0, 140);
						let slug = baseSlug;
						let suffix = 2;
						while (
							await tx.query.product.findFirst({
								where: eq(productTable.slug, slug),
								columns: { id: true },
							})
						) {
							slug = `${baseSlug}-${suffix++}`;
						}
						const [inserted] = await tx
							.insert(productTable)
							.values({
								name: `${brand.name} ${input.details.name}`
									.trim()
									.slice(0, 150),
								slug,
								description: input.details.description ?? null,
								shortDescription: input.details.shortDescription ?? null,
								videoUrl: input.details.videoUrl ?? null,
								categoryId: core.categoryId,
								subCategoryId: core.subCategoryId,
								brandId: brand.id,
								coreProductId: core.id,
								size: "—",
								price: "0",
								sku: `WH-${warehouseId.slice(0, 6)}-${core.id}-${brand.id}`,
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
								creatorSource: "warehouse",
								createdById: warehouseId,
								createdByWarehouseId: warehouseId,
								derivedFromProductId: adminByBrand.get(brand.id)?.id ?? null,
							})
							.returning();
						if (!inserted) {
							throw new ORPCError("INTERNAL_SERVER_ERROR", {
								message: `Could not create ${brand.name} product`,
							});
						}
						targetProduct = { ...inserted, variants: [] };
						await tx.insert(productBrand).values({
							productId: inserted.id,
							brandId: brand.id,
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
								.update(productTable)
								.set({ status: "active" })
								.where(eq(productTable.id, targetProduct.id));
						}
						updated.push(targetProduct.id);
					}

					const desiredByKey = new Map(
						brandConfig.variants.map((variant) => [
							warehouseVariantKey(variant),
							variant,
						]),
					);
					const existingVariants = targetProduct.variants ?? [];
					const existingByKey = new Map(
						existingVariants
							.filter((variant) => variant.sourceVariantOptionId !== null)
							.map((variant) => [
								warehouseVariantKey({
									variantOptionId: variant.sourceVariantOptionId!,
									color: variant.color,
								}),
								variant,
							]),
					);
					const removedVariants = existingVariants.filter(
						(variant) =>
							variant.sourceVariantOptionId !== null &&
							!desiredByKey.has(
								warehouseVariantKey({
									variantOptionId: variant.sourceVariantOptionId,
									color: variant.color,
								}),
							),
					);
					await assertNoLiveStock(
						removedVariants.map((variant) => variant.id),
						brand.name,
					);
					if (removedVariants.length > 0) {
						await tx
							.update(productVariant)
							.set({ isActive: false })
							.where(
								inArray(
									productVariant.id,
									removedVariants.map((variant) => variant.id),
								),
							);
						const removedPriceIds = removedVariants.flatMap((variant) =>
							variant.sourceVariantPriceId
								? [variant.sourceVariantPriceId]
								: [],
						);
						if (removedPriceIds.length > 0) {
							await tx
								.update(productVariantPrice)
								.set({ isActive: false })
								.where(inArray(productVariantPrice.id, removedPriceIds));
						}
					}

					let sortOrder = existingVariants.length;
					for (const [key, desired] of desiredByKey) {
						const existingVariant = existingByKey.get(key);
						const desiredOption = optionMap.get(desired.variantOptionId)!;
						const desiredResolved =
							resolveConcreteVariantForConfig(desiredOption);
						if (existingVariant) {
							await tx
								.update(productVariant)
								.set({
									isActive: true,
									unitLabel: desiredResolved.label,
									quantitySelectorLabel: desiredResolved.label,
									packagingType: desiredResolved.packagingType,
									weightKg: desiredResolved.weightKg,
									orderUnit: desiredResolved.orderUnit,
									packType: desiredResolved.packType,
									packWeightKg: desiredResolved.weightKg || null,
									sellUnit: desiredResolved.label,
								})
								.where(eq(productVariant.id, existingVariant.id));
							if (existingVariant.sourceVariantPriceId) {
								await tx
									.update(productVariantPrice)
									.set({ isActive: true })
									.where(
										eq(
											productVariantPrice.id,
											existingVariant.sourceVariantPriceId,
										),
									);
							}
							await tx
								.insert(inventory)
								.values({
									ownerType: "warehouse",
									ownerId: warehouseId,
									variantId: existingVariant.id,
									availableQty: "0",
									retailPrice: null,
								})
								.onConflictDoNothing({
									target: [
										inventory.ownerType,
										inventory.ownerId,
										inventory.variantId,
									],
								});
							continue;
						}
						const option = desiredOption;
						const resolved = desiredResolved;
						const [priceRow] = await tx
							.insert(productVariantPrice)
							.values({
								productId: targetProduct.id,
								variantOptionId: option.id,
								brandId: brand.id,
								consumerPrice: "0",
								sortOrder,
							})
							.returning();
						const [variantRow] = await tx
							.insert(productVariant)
							.values({
								productId: targetProduct.id,
								brandId: brand.id,
								color: desired.color?.trim() || null,
								size: option.size ?? null,
								sku: `WH-${targetProduct.id}-B${brand.id}-VO${option.id}-${sortOrder}`,
								unitLabel: resolved.label,
								quantitySelectorLabel: resolved.label,
								packagingType: resolved.packagingType,
								weightKg: resolved.weightKg,
								price: "0",
								orderMin: input.details.minimumOrderEnabled
									? input.details.minimumOrderQty
									: "1",
								orderUnit: resolved.orderUnit,
								packType: resolved.packType,
								packWeightKg: resolved.weightKg || null,
								sellUnit: resolved.label,
								variantType: "trade",
								orderType: "b2b",
								visibilityRole: "shop_owner",
								stockSource: "warehouse",
								sourceVariantPriceId: priceRow!.id,
								sourceVariantOptionId: option.id,
								stockQuantity: 0,
								reorderLevel: 0,
								sortOrder,
								isActive: true,
							})
							.returning();
						await tx.insert(inventory).values({
							ownerType: "warehouse",
							ownerId: warehouseId,
							variantId: variantRow!.id,
							availableQty: "0",
							retailPrice: null,
						});
						sortOrder++;
					}
				}

				if (shouldDeactivateOmittedBrands(core.brandCreationMode)) {
					const selectedBrands = new Set(brandIds);
					for (const product of existingProducts) {
						if (
							product.brandId === null ||
							selectedBrands.has(product.brandId)
						) {
							continue;
						}
						await assertNoLiveStock(
							product.variants.map((variant) => variant.id),
							product.name,
						);
						await tx
							.update(productTable)
							.set({ status: "inactive" })
							.where(eq(productTable.id, product.id));
						await tx
							.update(productVariant)
							.set({ isActive: false })
							.where(eq(productVariant.productId, product.id));
						await tx
							.update(productVariantPrice)
							.set({ isActive: false })
							.where(eq(productVariantPrice.productId, product.id));
						deactivated.push(product.id);
					}
				}

				const adminTemplate =
					await tx.query.adminProductGenerationTemplate.findFirst({
						where: eq(adminProductGenerationTemplate.coreProductId, core.id),
					});
				await tx
					.insert(warehouseProductGenerationTemplate)
					.values({
						coreProductId: core.id,
						warehouseId,
						version: 1,
						sourceAdminTemplateVersion:
							existingTemplate?.sourceAdminTemplateVersion ??
							adminTemplate?.version ??
							null,
						details: templateDetails,
						createdById: warehouseId,
					})
					.onConflictDoUpdate({
						target: [
							warehouseProductGenerationTemplate.warehouseId,
							warehouseProductGenerationTemplate.coreProductId,
						],
						set: {
							version: sql`${warehouseProductGenerationTemplate.version} + 1`,
							sourceAdminTemplateVersion:
								existingTemplate?.sourceAdminTemplateVersion ??
								adminTemplate?.version ??
								null,
							details: templateDetails,
							createdById: warehouseId,
							updatedAt: new Date(),
						},
					});

				for (const productId of new Set([...created, ...updated])) {
					await linkProductVariantsToCatalog(tx, productId);
				}

				return { created, updated, deactivated };
			});
		}),
	/**
	 * List products created by this warehouse.
	 */
	getWarehouseProducts: warehouseProcedure
		.input(
			z.object({
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const offset = (input.page - 1) * input.limit;

			const conditions: SQL[] = [eq(productTable.createdByWarehouseId, userId)];

			if (input.search?.trim()) {
				conditions.push(
					sql`${productTable.name} ILIKE ${`%${input.search.trim()}%`}`,
				);
			}

			const products = await db.query.product.findMany({
				where: and(...conditions),
				orderBy: [desc(productTable.createdAt)],
				offset,
				limit: input.limit,
				with: {
					category: { columns: { name: true, slug: true } },
					subCategory: { columns: { name: true } },
					brand: { columns: { id: true, name: true } },
					coreProduct: { columns: { id: true, name: true, image: true } },
					productBrands: {
						with: { brand: { columns: { id: true, name: true } } },
					},
					variants: {
						where: eq(productVariant.isActive, true),
						columns: {
							id: true,
							unitLabel: true,
							weightKg: true,
							price: true,
							brandId: true,
						},
						with: { brand: { columns: { id: true, name: true } } },
					},
				},
			});

			const [countResult] = await db
				.select({ count: count() })
				.from(productTable)
				.where(and(...conditions));

			return {
				products,
				pagination: {
					page: input.page,
					limit: input.limit,
					totalCount: Number(countResult?.count || 0),
					totalPages: Math.ceil(Number(countResult?.count || 0) / input.limit),
				},
			};
		}),

	/**
	 * Activate or deactivate a product owned by this warehouse.
	 */
	updateWarehouseProductStatus: warehouseProcedure
		.input(
			z.object({
				productId: z.number().int(),
				status: z.enum(["active", "inactive"]),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await db.query.product.findFirst({
				where: and(
					eq(productTable.id, input.productId),
					eq(productTable.createdByWarehouseId, userId),
				),
				columns: { id: true },
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", { message: "Product not found" });
			}

			const [updated] = await db
				.update(productTable)
				.set({ status: input.status })
				.where(eq(productTable.id, input.productId))
				.returning({ id: productTable.id, status: productTable.status });

			return { product: updated };
		}),

	/**
	 * Get a single core product identity by ID (for the add product form).
	 */
	getCoreProductById: warehouseProcedure
		.input(z.object({ id: z.number().int() }))
		.handler(async ({ input }) => {
			const cp = await db.query.coreProductIdentity.findFirst({
				where: eq(coreProductIdentity.id, input.id),
				with: {
					category: {
						columns: { id: true, name: true, slug: true, typeId: true },
						with: {
							type: { columns: { id: true, name: true } },
						},
					},
					subCategory: {
						columns: { id: true, name: true, slug: true },
					},
				},
			});

			if (!cp) {
				throw new ORPCError("NOT_FOUND", {
					message: "Core product identity not found",
				});
			}

			return { coreProduct: cp };
		}),
};

// ────────────────────────────────────────────────────────────────
// Stock Entry (Add Stock) + Storage Areas
// ────────────────────────────────────────────────────────────────

import {
	stockEntry,
	stockReceipt,
	warehouseStorageArea,
	cartonConfig,
	carton,
} from "@bikalpo-project/db/schema";

const warehouseStockDateSchema = z
	.string()
	.regex(ISO_DATE_PATTERN, "Use a valid YYYY-MM-DD date");

const stockEntryQueries = {
	/**
	 * Search warehouse's own products with variants (for the Add Stock product picker).
	 */
	getWarehouseProductsForStock: warehouseProcedure
		.input(
			z.object({
				search: z.string().optional(),
				categoryId: z.number().int().optional(),
				subCategoryId: z.number().int().optional(),
				productId: z.number().int().optional(),
				limit: z.number().default(50),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const conditions: SQL[] = [
				warehouseOwnedProductCondition(userId),
				eq(productTable.status, "active"),
			];

			if (input.search?.trim()) {
				conditions.push(
					sql`${productTable.name} ILIKE ${`%${input.search.trim()}%`}`,
				);
			}

			if (input.categoryId) {
				conditions.push(eq(productTable.categoryId, input.categoryId));
			}

			if (input.subCategoryId) {
				conditions.push(eq(productTable.subCategoryId, input.subCategoryId));
			}

			if (input.productId) {
				conditions.push(eq(productTable.id, input.productId));
			}

			const products = await db.query.product.findMany({
				where: and(...conditions),
				limit: input.limit,
				orderBy: [desc(productTable.createdAt)],
				columns: {
					id: true,
					name: true,
					image: true,
					trackingType: true,
					expiryEnabled: true,
					categoryId: true,
					subCategoryId: true,
				},
				with: {
					brand: { columns: { id: true, name: true } },
					category: {
						columns: { id: true, name: true, typeId: true },
						with: {
							type: {
								columns: {
									id: true,
									name: true,
									slug: true,
									family: true,
									inventoryBehaviour: true,
								},
							},
						},
					},
					subCategory: { columns: { id: true, name: true } },
					coreProduct: {
						columns: {
							id: true,
							name: true,
							image: true,
						},
					},
					variants: {
						where: eq(productVariant.isActive, true),
						columns: {
							id: true,
							sku: true,
							unitLabel: true,
							weightKg: true,
							piecesPerUnit: true,
							orderUnit: true,
							price: true,
							brandId: true,
							packType: true,
							sourceVariantOptionId: true,
						},
						with: {
							brand: { columns: { id: true, name: true } },
							sourceVariantOption: true,
						},
					},
				},
			});

			// Attach available stock for each variant
			const allVariantIds = products.flatMap((p) =>
				p.variants.map((v) => v.id),
			);
			const inventoryRows =
				allVariantIds.length > 0
					? await db.query.inventory.findMany({
							where: and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, userId),
								inArray(inventory.variantId, allVariantIds),
							),
							columns: {
								variantId: true,
								availableQty: true,
								inCartonQty: true,
							},
						})
					: [];

			const stockMap = new Map(
				inventoryRows.map((inv) => [
					inv.variantId,
					{
						availableQty: parseFloat(inv.availableQty),
						inCartonQty: parseFloat(inv.inCartonQty),
						looseStock:
							parseFloat(inv.availableQty) - parseFloat(inv.inCartonQty),
					},
				]),
			);
			const coreProductIds = [
				...new Set(
					products.flatMap((p) =>
						p.coreProduct?.id ? [p.coreProduct.id] : [],
					),
				),
			];
			const aliases =
				coreProductIds.length > 0
					? await db.query.warehouseVariantAlias.findMany({
							where: and(
								eq(warehouseVariantAlias.warehouseId, userId),
								inArray(warehouseVariantAlias.coreProductId, coreProductIds),
							),
						})
					: [];
			const aliasMap = new Map(
				aliases.map((entry) => [
					`${entry.coreProductId}:${entry.variantOptionId}`,
					entry.alias,
				]),
			);

			const productsWithStock = products.map((p) => ({
				...p,
				variants: p.variants.flatMap((v) => {
					if (!v.sourceVariantOption || !p.coreProduct?.id) return [];
					try {
						const semantics = resolveVariantStockSemantics(
							v.sourceVariantOption,
						);
						const variantOperations = resolveVariantOperations(
							v.sourceVariantOption,
						);
						return [
							{
								...v,
								displayLabel:
									aliasMap.get(
										`${p.coreProduct.id}:${v.sourceVariantOption.id}`,
									) ?? semantics.displayLabel,
								stockSemantics: semantics,
								variantOperations,
								stock: stockMap.get(v.id) ?? {
									availableQty: 0,
									inCartonQty: 0,
									looseStock: 0,
								},
							},
						];
					} catch {
						return [];
					}
				}),
			}));

			return { products: productsWithStock };
		}),

	/**
	 * Receive one or more direct-count variants as one atomic transaction.
	 * Units and conversion values are derived exclusively from Admin Variant Setup.
	 */
	createStockReceipt: warehouseProcedure
		.input(
			z.object({
				idempotencyKey: z.string().trim().min(8).max(100),
				receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
				supplierId: z.number().int().optional().nullable(),
				paymentMethod: z.enum(["cash", "bank"]),
				reference: z.string().trim().max(150).optional(),
				storageAreaId: z.number().int().optional().nullable(),
				shelfRack: z.string().trim().max(100).optional(),
				note: z.string().trim().optional(),
				lines: z
					.array(
						z.object({
							variantId: z.number().int(),
							quantity: z.number().int().positive(),
							purchaseUnitCost: z
								.string()
								.refine(
									(value) =>
										Number.isFinite(Number(value)) && Number(value) > 0,
									"Purchase unit cost must be greater than 0",
								),
							batchNo: z.string().trim().max(100).optional(),
							manufactureDate: warehouseStockDateSchema.optional(),
							expiryDate: warehouseStockDateSchema.optional(),
						}),
					)
					.min(1),
			}),
		)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const existingReceipt = await db.query.stockReceipt.findFirst({
				where: and(
					eq(stockReceipt.warehouseId, warehouseId),
					eq(stockReceipt.idempotencyKey, input.idempotencyKey),
				),
			});
			if (existingReceipt) {
				return { receipt: existingReceipt, idempotent: true };
			}

			if (
				new Set(input.lines.map((line) => line.variantId)).size !==
				input.lines.length
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Add each variant only once per receipt",
				});
			}

			if (input.supplierId) {
				const ownedSupplier = await db.query.supplier.findFirst({
					where: and(
						eq(supplier.id, input.supplierId),
						eq(supplier.addedBy, warehouseId),
					),
					columns: { id: true },
				});
				if (!ownedSupplier) {
					throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
				}
			}

			if (input.storageAreaId) {
				const ownedArea = await db.query.warehouseStorageArea.findFirst({
					where: and(
						eq(warehouseStorageArea.id, input.storageAreaId),
						eq(warehouseStorageArea.warehouseId, warehouseId),
					),
					columns: { id: true },
				});
				if (!ownedArea) {
					throw new ORPCError("NOT_FOUND", {
						message: "Storage area not found",
					});
				}
			}

			type ValidatedLine = {
				variantId: number;
				quantity: number;
				purchaseUnitCost: number;
				operationalUnit: string;
				referenceMeasurement?: {
					unit: "kg" | "liter";
					perInventoryUnit: string;
				};
				batchNo?: string;
				manufactureDate?: string;
				expiryDate?: string;
			};
			const validatedLines: ValidatedLine[] = [];

			for (const line of input.lines) {
				const variant = await db.query.productVariant.findFirst({
					where: eq(productVariant.id, line.variantId),
					with: {
						sourceVariantOption: true,
						product: {
							columns: {
								id: true,
								name: true,
								creatorSource: true,
								createdById: true,
								createdByWarehouseId: true,
								trackingType: true,
								expiryEnabled: true,
							},
						},
					},
				});
				if (
					!variant?.product ||
					!isWarehouseOwnedProduct(variant.product, warehouseId)
				) {
					throw new ORPCError("FORBIDDEN", {
						message:
							"Stock can only be added to a warehouse-configured product",
					});
				}
				if (!variant.isActive || !variant.sourceVariantOption) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Stock can only be added to an active configured variant",
					});
				}
				if (variant.product.trackingType === "serial") {
					throw new ORPCError("BAD_REQUEST", {
						message: "Serial-tracked units require the asset receiving flow",
					});
				}
				const tracking = validateStockTrackingOrThrow({
					productName: variant.product.name,
					trackingType: variant.product.trackingType,
					expiryEnabled: variant.product.expiryEnabled,
					batchNo: line.batchNo,
					manufactureDate: line.manufactureDate,
					expiryDate: line.expiryDate,
				});

				const operations = resolveVariantOperations(
					variant.sourceVariantOption,
				);
				const stockSemantics = resolveVariantStockSemantics(
					variant.sourceVariantOption,
				);
				if (operations.receivingMode !== "direct") {
					throw new ORPCError("BAD_REQUEST", {
						message: `${stockSemantics.displayLabel} is not configured for direct receiving`,
					});
				}

				validatedLines.push({
					...line,
					batchNo: tracking.batchNo ?? undefined,
					manufactureDate: tracking.manufactureDate ?? undefined,
					expiryDate: tracking.expiryDate ?? undefined,
					purchaseUnitCost: Number(line.purchaseUnitCost),
					operationalUnit: operations.operationalUnit,
					...(operations.referenceMeasurement
						? { referenceMeasurement: operations.referenceMeasurement }
						: {}),
				});
			}

			const result = await db.transaction(async (tx) => {
				const [createdReceipt] = await tx
					.insert(stockReceipt)
					.values({
						warehouseId,
						idempotencyKey: input.idempotencyKey,
						receiptDate: input.receiptDate,
						paymentMethod: input.paymentMethod,
						supplierId: input.supplierId || null,
						reference: input.reference || null,
						storageAreaId: input.storageAreaId || null,
						shelfRack: input.shelfRack || null,
						note: input.note || null,
						lineCount: validatedLines.length,
					})
					.onConflictDoNothing({
						target: [stockReceipt.warehouseId, stockReceipt.idempotencyKey],
					})
					.returning();

				if (!createdReceipt) {
					const retryReceipt = await tx.query.stockReceipt.findFirst({
						where: and(
							eq(stockReceipt.warehouseId, warehouseId),
							eq(stockReceipt.idempotencyKey, input.idempotencyKey),
						),
					});
					if (!retryReceipt)
						throw new Error("Unable to resolve idempotent receipt");
					return { receipt: retryReceipt, idempotent: true };
				}

				for (const line of validatedLines) {
					const totalCost = line.quantity * line.purchaseUnitCost;
					const referenceAmount = line.referenceMeasurement
						? line.quantity * Number(line.referenceMeasurement.perInventoryUnit)
						: null;
					await tx.insert(stockEntry).values({
						receiptId: createdReceipt.id,
						warehouseId,
						variantId: line.variantId,
						entryType: "direct",
						quantity: line.quantity.toFixed(2),
						quantityUnit: line.operationalUnit,
						convertedQtyKg:
							line.referenceMeasurement?.unit === "kg"
								? (referenceAmount?.toFixed(2) ?? null)
								: null,
						convertedQtyPacks: null,
						inventoryDelta: line.quantity.toFixed(2),
						inventoryUnit: line.operationalUnit,
						supplierId: input.supplierId || null,
						costType: "per_unit",
						purchasePrice: line.purchaseUnitCost.toFixed(2),
						totalCost: totalCost.toFixed(2),
						reference: input.reference || null,
						batchNo: line.batchNo || null,
						expiryDate: line.expiryDate || null,
						manufactureDate: line.manufactureDate || null,
						storageAreaId: input.storageAreaId || null,
						shelfRack: input.shelfRack || null,
						note: input.note || null,
					});

					await tx
						.insert(inventory)
						.values({
							ownerType: "warehouse",
							ownerId: warehouseId,
							variantId: line.variantId,
							availableQty: line.quantity.toFixed(2),
						})
						.onConflictDoUpdate({
							target: [
								inventory.ownerType,
								inventory.ownerId,
								inventory.variantId,
							],
							set: {
								availableQty: sql`CAST(${inventory.availableQty} AS numeric) + ${line.quantity}`,
								updatedAt: new Date(),
							},
						});
				}

				return { receipt: createdReceipt, idempotent: false };
			});

			return result;
		}),

	/**
	 * Add a stock entry — creates audit row + upserts inventory.
	 */
	addStockEntry: warehouseProcedure
		.input(
			z.object({
				variantId: z.number().int(),
				entryType: z.enum(["loose", "pack", "carton"]),
				quantity: z.string().refine((v) => parseFloat(v) > 0, {
					message: "Quantity must be greater than 0",
				}),
				supplierId: z.number().int().optional().nullable(),
				costType: z.enum(["per_kg", "per_unit", "per_carton"]),
				purchasePrice: z.string().refine((v) => parseFloat(v) > 0, {
					message: "Purchase price must be greater than 0",
				}),
				reference: z.string().optional(),
				batchNo: z.string().optional(),
				expiryDate: warehouseStockDateSchema.optional(),
				manufactureDate: warehouseStockDateSchema.optional(),
				storageAreaId: z.number().int().optional(),
				shelfRack: z.string().optional(),
				note: z.string().optional(),
				// Carton-specific fields (legacy cartonConfigId still accepted but optional)
				cartonConfigId: z.number().int().optional(),
				cartonCount: z.number().int().optional(),
				// NEW: Inline carton definition (replaces cartonConfig)
				packsPerCarton: z.number().int().optional(),
				// Whether to create physical carton records during stock entry
				createCartonRecords: z.boolean().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const qty = parseFloat(input.quantity);
			const price = parseFloat(input.purchasePrice);

			// 1. Validate variant belongs to this warehouse's product
			const variant = await db.query.productVariant.findFirst({
				where: eq(productVariant.id, input.variantId),
				with: {
					sourceVariantOption: true,
					product: {
						columns: {
							id: true,
							name: true,
							creatorSource: true,
							createdById: true,
							createdByWarehouseId: true,
							trackingType: true,
							expiryEnabled: true,
						},
					},
				},
			});

			if (!variant) {
				throw new ORPCError("NOT_FOUND", { message: "Variant not found" });
			}
			if (
				!variant.product ||
				!isWarehouseOwnedProduct(variant.product, userId)
			) {
				throw new ORPCError("FORBIDDEN", {
					message:
						"Stock can only be added to an actual warehouse-created product",
				});
			}
			if (!variant.isActive || !variant.sourceVariantOption) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Stock can only be added to an active generated variant",
				});
			}
			if (variant.product.trackingType === "serial") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Serial-tracked units require the asset receiving flow",
				});
			}
			const tracking = validateStockTrackingOrThrow({
				productName: variant.product.name,
				trackingType: variant.product.trackingType,
				expiryEnabled: variant.product.expiryEnabled,
				batchNo: input.batchNo,
				manufactureDate: input.manufactureDate,
				expiryDate: input.expiryDate,
			});
			const operations = resolveVariantOperations(variant.sourceVariantOption);
			if (operations.receivingMode === "direct") {
				throw new ORPCError("BAD_REQUEST", {
					message: `${operations.operationalUnit} variants must be received through Direct Entry`,
				});
			}

			let stockSemantics;
			try {
				stockSemantics = resolveVariantStockSemantics(
					variant.sourceVariantOption,
				);
			} catch (error) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						error instanceof Error
							? error.message
							: "Variant definition is invalid",
				});
			}
			if (operations.receivingMode === "loose" && input.entryType !== "loose") {
				throw new ORPCError("BAD_REQUEST", {
					message: `Variant "${stockSemantics.displayLabel}" must be entered as loose ${stockSemantics.operationalUnit} stock`,
				});
			}
			if (operations.receivingMode !== "loose" && input.entryType === "loose") {
				throw new ORPCError("BAD_REQUEST", {
					message: `Variant "${stockSemantics.displayLabel}" is stocked by ${stockSemantics.operationalUnit}`,
				});
			}
			if (
				operations.receivingMode !== "pack" &&
				(input.entryType === "pack" || input.entryType === "carton")
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Variant "${stockSemantics.displayLabel}" is not configured for pack receiving`,
				});
			}

			// 2. Validate supplier belongs to this warehouse (only if provided)
			if (input.supplierId) {
				const sup = await db.query.supplier.findFirst({
					where: and(
						eq(supplier.id, input.supplierId),
						eq(supplier.addedBy, userId),
					),
					columns: { id: true },
				});
				if (!sup) {
					throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
				}
			}

			// 3. Compute inventory in the selected variant's canonical unit.
			const cartonCount =
				input.entryType === "carton"
					? (input.cartonCount ?? Math.floor(qty))
					: 0;
			let packsPerCartonForEntry: number | null = null;
			if (input.entryType === "carton") {
				if (cartonCount <= 0) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Carton entry requires at least one carton",
					});
				}

				if (input.packsPerCarton) {
					packsPerCartonForEntry = input.packsPerCarton;
				} else if (input.cartonConfigId) {
					const config = await db.query.cartonConfig.findFirst({
						where: and(
							eq(cartonConfig.id, input.cartonConfigId),
							eq(cartonConfig.variantId, input.variantId),
						),
					});
					if (!config) {
						throw new ORPCError("NOT_FOUND", {
							message: "Carton config not found for this variant",
						});
					}
					packsPerCartonForEntry = config.packsPerCarton;
				} else {
					throw new ORPCError("BAD_REQUEST", {
						message: "Carton entry requires packsPerCarton or cartonConfigId",
					});
				}
			}
			const inventoryQty =
				input.entryType === "carton"
					? cartonCount * (packsPerCartonForEntry ?? 0)
					: qty;
			const convertedQtyKg =
				stockSemantics.measurementDimension === "mass"
					? inventoryQty * stockSemantics.massKgPerUnit
					: null;
			const convertedQtyPacks =
				stockSemantics.entryType === "pack" ? inventoryQty : null;

			// 4. Compute total cost
			if (input.costType === "per_kg" && convertedQtyKg === null) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Per-KG cost is only valid for mass-based variants",
				});
			}
			if (input.costType === "per_carton" && input.entryType !== "carton") {
				throw new ORPCError("BAD_REQUEST", {
					message: "Per-carton cost requires a carton stock entry",
				});
			}
			const totalCost =
				input.costType === "per_kg"
					? price * (convertedQtyKg ?? 0)
					: input.costType === "per_carton"
						? price * cartonCount
						: price * inventoryQty;

			// 5. Transaction: insert stock_entry + upsert inventory + optionally create carton records
			const result = await db.transaction(async (tx) => {
				// Insert stock entry
				const [entry] = await tx
					.insert(stockEntry)
					.values({
						warehouseId: userId,
						variantId: input.variantId,
						entryType: input.entryType,
						quantity: qty.toFixed(2),
						quantityUnit:
							input.entryType === "carton"
								? "carton"
								: stockSemantics.operationalUnit,
						convertedQtyKg: convertedQtyKg?.toFixed(2) ?? null,
						convertedQtyPacks: convertedQtyPacks?.toFixed(2) ?? null,
						inventoryDelta: inventoryQty.toFixed(2),
						inventoryUnit: stockSemantics.operationalUnit,
						supplierId: input.supplierId || null,
						costType: input.costType,
						purchasePrice: price.toFixed(2),
						totalCost: totalCost.toFixed(2),
						reference: input.reference || null,
						batchNo: tracking.batchNo,
						expiryDate: tracking.expiryDate,
						manufactureDate: tracking.manufactureDate,
						storageAreaId: input.storageAreaId || null,
						shelfRack: input.shelfRack || null,
						note: input.note || null,
						// Carton fields
						cartonCount: input.entryType === "carton" ? cartonCount : null,
						cartonConfigId: input.cartonConfigId || null,
						convertedQtyCartons:
							input.entryType === "carton" ? String(cartonCount) : null,
					})
					.returning();

				// Purchase cost belongs to this stock-entry audit row only. Inventory
				// selling price is deliberately untouched; pricing is managed separately.
				// Upsert inventory — add to available quantity
				const shouldCreateStockInCartons =
					input.entryType === "carton" &&
					input.createCartonRecords &&
					cartonCount > 0;
				const packsPerSingleCarton = packsPerCartonForEntry || 1;
				const weightPerCarton =
					packsPerSingleCarton * stockSemantics.massKgPerUnit;
				const stockInCartonUnits = shouldCreateStockInCartons
					? cartonCount * packsPerSingleCarton
					: 0;
				const existingInv = await tx.query.inventory.findFirst({
					where: and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, userId),
						eq(inventory.variantId, input.variantId),
					),
				});

				if (existingInv) {
					const newQty = parseFloat(existingInv.availableQty) + inventoryQty;
					const currentInCarton = parseFloat(existingInv.inCartonQty || "0");
					await tx
						.update(inventory)
						.set({
							availableQty: newQty.toFixed(2),
							...(shouldCreateStockInCartons
								? {
										inCartonQty: (currentInCarton + stockInCartonUnits).toFixed(
											2,
										),
										activeCartonCount:
											(existingInv.activeCartonCount || 0) + cartonCount,
									}
								: {}),
						})
						.where(eq(inventory.id, existingInv.id));
				} else {
					await tx.insert(inventory).values({
						ownerType: "warehouse",
						ownerId: userId,
						variantId: input.variantId,
						availableQty: inventoryQty.toFixed(2),
						...(shouldCreateStockInCartons
							? {
									inCartonQty: stockInCartonUnits.toFixed(2),
									activeCartonCount: cartonCount,
								}
							: {}),
					});
				}

				// 6. Create physical carton records for carton entries
				if (shouldCreateStockInCartons) {
					// Generate carton IDs
					const year = new Date().getFullYear();
					const [lastCarton] = await tx
						.select({ cartonId: carton.cartonId })
						.from(carton)
						.where(sql`${carton.cartonId} LIKE ${"CTN-" + year + "-%"}`)
						.orderBy(desc(carton.id))
						.limit(1);

					let nextNum = 1;
					if (lastCarton?.cartonId) {
						const parts = lastCarton.cartonId.split("-");
						const lastNum = parseInt(parts[2] || "0", 10);
						nextNum = lastNum + 1;
					}

					// Create one carton record per carton
					for (let i = 0; i < cartonCount; i++) {
						const cartonIdStr = `CTN-${year}-${String(nextNum + i).padStart(6, "0")}`;
						await tx.insert(carton).values({
							cartonId: cartonIdStr,
							warehouseId: userId,
							cartonConfigId: null,
							variantId: input.variantId,
							totalPacks: packsPerSingleCarton,
							totalWeightKg: weightPerCarton.toFixed(2),
							status: "active",
							barcode: cartonIdStr,
							storageAreaId: input.storageAreaId || null,
							note: input.note || null,
							cartonPrice: null, // Selling price set later on pricing page
							deliveryCostPerUnit: null,
						});
					}
				}

				return entry;
			});

			return { entry: result, message: "Stock added successfully" };
		}),

	/**
	 * List stock entries for this warehouse (history).
	 */
	getStockEntries: warehouseProcedure
		.input(
			z.object({
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const offset = (input.page - 1) * input.limit;

			const entries = await db.query.stockEntry.findMany({
				where: eq(stockEntry.warehouseId, userId),
				orderBy: [desc(stockEntry.createdAt)],
				offset,
				limit: input.limit,
				with: {
					variant: {
						columns: {
							id: true,
							sku: true,
							unitLabel: true,
							weightKg: true,
						},
						with: {
							product: {
								columns: { id: true, name: true, image: true },
							},
							brand: { columns: { id: true, name: true } },
						},
					},
					supplier: {
						columns: { id: true, name: true },
					},
				},
			});

			const [countResult] = await db
				.select({ count: count() })
				.from(stockEntry)
				.where(eq(stockEntry.warehouseId, userId));

			return {
				entries,
				pagination: {
					page: input.page,
					limit: input.limit,
					totalCount: Number(countResult?.count || 0),
					totalPages: Math.ceil(Number(countResult?.count || 0) / input.limit),
				},
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Storage Area CRUD
// ────────────────────────────────────────────────────────────────

const storageAreaQueries = {
	/** List all storage areas for this warehouse */
	getStorageAreas: warehouseProcedure
		.input(z.object({ search: z.string().optional() }))
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			const areas = await db
				.select()
				.from(warehouseStorageArea)
				.where(
					and(
						eq(warehouseStorageArea.warehouseId, userId),
						eq(warehouseStorageArea.isActive, true),
					),
				)
				.orderBy(desc(warehouseStorageArea.createdAt));

			return { areas };
		}),

	/** Create a new storage area */
	createStorageArea: warehouseProcedure
		.input(
			z.object({
				name: z.string().min(1).max(150),
				description: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const [area] = await db
				.insert(warehouseStorageArea)
				.values({
					warehouseId: userId,
					name: input.name,
					description: input.description || null,
				})
				.returning();

			return { area };
		}),
};

// ────────────────────────────────────────────────────────────────
// Pricing Management (Wholesale Price for Retailers)
// ────────────────────────────────────────────────────────────────

import {
	category as catTable,
	productType as productTypeTable,
	subCategory as subCategoryTable,
} from "@bikalpo-project/db/schema";

const pricingQueries = {
	/** Paginated configured-variant rows for the warehouse Products screen. */
	getWarehouseProductList: warehouseProcedure
		.input(
			z.object({
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(100).default(25),
				search: z.string().trim().optional(),
				typeId: z.number().optional(),
				categoryId: z.number().optional(),
				subCategoryId: z.number().optional(),
				coreProductId: z.number().optional(),
				brandId: z.number().optional(),
				stockFilter: z
					.enum(["all", "in_stock", "low_stock", "out_of_stock"])
					.default("all"),
				sortBy: z
					.enum([
						"name_asc",
						"name_desc",
						"stock_desc",
						"stock_asc",
						"price_desc",
						"price_asc",
					])
					.default("name_asc"),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const conditions: SQL[] = [
				eq(productTable.status, "active"),
				eq(productVariant.isActive, true),
				warehouseOwnedProductCondition(userId),
			];
			const baseConditions = [...conditions];
			if (input.typeId) conditions.push(eq(productTypeTable.id, input.typeId));
			if (input.categoryId)
				conditions.push(eq(productTable.categoryId, input.categoryId));
			if (input.subCategoryId)
				conditions.push(eq(productTable.subCategoryId, input.subCategoryId));
			if (input.coreProductId)
				conditions.push(eq(productTable.coreProductId, input.coreProductId));
			if (input.brandId)
				conditions.push(
					sql`COALESCE(${productVariant.brandId}, ${productTable.brandId}) = ${input.brandId}`,
				);
			if (input.search) {
				const term = `%${input.search}%`;
				conditions.push(
					or(
						ilike(productTable.name, term),
						ilike(productTable.sku, term),
						ilike(coreProductIdentity.name, term),
						ilike(brandTable.name, term),
						ilike(productVariant.unitLabel, term),
					)!,
				);
			}
			const qty = sql<number>`COALESCE(${inventory.availableQty}, 0)::numeric`;
			const threshold = sql<number>`GREATEST(${productVariant.reorderLevel}, ${productTable.reorderLevel}, 10)`;
			if (input.stockFilter === "out_of_stock")
				conditions.push(sql`${qty} <= 0`);
			if (input.stockFilter === "low_stock")
				conditions.push(sql`${qty} > 0 AND ${qty} <= ${threshold}`);
			if (input.stockFilter === "in_stock")
				conditions.push(sql`${qty} > ${threshold}`);

			const fromJoins = (query: any) =>
				query
					.from(productVariant)
					.innerJoin(
						productTable,
						eq(productVariant.productId, productTable.id),
					)
					.leftJoin(
						inventory,
						and(
							eq(inventory.variantId, productVariant.id),
							eq(inventory.ownerType, "warehouse"),
							eq(inventory.ownerId, userId),
						),
					)
					.innerJoin(catTable, eq(productTable.categoryId, catTable.id))
					.leftJoin(
						subCategoryTable,
						eq(productTable.subCategoryId, subCategoryTable.id),
					)
					.leftJoin(
						coreProductIdentity,
						eq(productTable.coreProductId, coreProductIdentity.id),
					)
					.leftJoin(
						brandTable,
						sql`${brandTable.id} = COALESCE(${productVariant.brandId}, ${productTable.brandId})`,
					)
					.leftJoin(productTypeTable, eq(catTable.typeId, productTypeTable.id))
					.leftJoin(
						variantOption,
						eq(productVariant.sourceVariantOptionId, variantOption.id),
					);

			const orderBy =
				input.sortBy === "name_desc"
					? desc(productTable.name)
					: input.sortBy === "stock_desc"
						? desc(qty)
						: input.sortBy === "stock_asc"
							? qty
							: input.sortBy === "price_desc"
								? desc(inventory.retailPrice)
								: input.sortBy === "price_asc"
									? inventory.retailPrice
									: productTable.name;
			const offset = (input.page - 1) * input.pageSize;
			const rows = await fromJoins(
				db.select({
					inventoryId: inventory.id,
					variantId: productVariant.id,
					sku: productVariant.sku,
					variantSku: productVariant.sku,
					productId: productTable.id,
					productSku: productTable.sku,
					productName: productTable.name,
					productStatus: productTable.status,
					creatorSource: productTable.creatorSource,
					creatorId: productTable.createdById,
					creatorWarehouseId: productTable.createdByWarehouseId,
					coreProductId: productTable.coreProductId,
					coreProductName: coreProductIdentity.name,
					coreProductImage: coreProductIdentity.image,
					categoryId: catTable.id,
					categoryName: catTable.name,
					subCategoryId: subCategoryTable.id,
					subCategoryName: subCategoryTable.name,
					typeId: productTypeTable.id,
					typeName: productTypeTable.name,
					brandId: brandTable.id,
					brandName: brandTable.name,
					unitLabel: productVariant.unitLabel,
					packagingType: productVariant.packagingType,
					sourceVariantOptionId: variantOption.id,
					sourceOptionName: variantOption.name,
					sourceOptionUnit: variantOption.unit,
					sourceOptionSize: variantOption.size,
					sourceOptionVariantType: variantOption.variantType,
					sourceOptionDefinitionKind: variantOption.definitionKind,
					sourceOptionDefinition: variantOption.definition,
					sourceOptionDisplayAlias: variantOption.displayAlias,
					sourceOptionNeedsReview: variantOption.needsReview,
					color: productVariant.color,
					size: productVariant.size,
					weightKg: productVariant.weightKg,
					variantPrice: productVariant.price,
					retailPrice: inventory.retailPrice,
					isActive: productVariant.isActive,
					availableQty: inventory.availableQty,
					reservedQty: inventory.reservedQty,
					inCartonQty: inventory.inCartonQty,
					activeCartonCount: inventory.activeCartonCount,
					reorderLevel: productVariant.reorderLevel,
					updatedAt: inventory.updatedAt,
				}),
			)
				.where(and(...conditions))
				.orderBy(orderBy)
				.limit(input.pageSize)
				.offset(offset);
			const [totalRow] = await fromJoins(db.select({ count: count() })).where(
				and(...conditions),
			);
			const optionRows = await fromJoins(
				db.selectDistinct({
					typeId: productTypeTable.id,
					typeName: productTypeTable.name,
					categoryId: catTable.id,
					categoryName: catTable.name,
					subCategoryId: subCategoryTable.id,
					subCategoryName: subCategoryTable.name,
					coreProductId: coreProductIdentity.id,
					coreProductName: coreProductIdentity.name,
					brandId: brandTable.id,
					brandName: brandTable.name,
				}),
			).where(and(...baseConditions));
			const [summary] = await fromJoins(
				db.select({
					totalProducts: sql<number>`COUNT(DISTINCT ${productTable.id})`,
					inStock: sql<number>`COUNT(*) FILTER (WHERE ${qty} > ${threshold})`,
					lowStock: sql<number>`COUNT(*) FILTER (WHERE ${qty} > 0 AND ${qty} <= ${threshold})`,
					outOfStock: sql<number>`COUNT(*) FILTER (WHERE ${qty} <= 0)`,
				}),
			).where(and(...baseConditions));

			const items = rows.map((row: any) => {
				if (!row.sourceVariantOptionId) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"A warehouse variant is missing its Admin Variant definition",
					});
				}
				const variantOperations = resolveVariantOperations({
					name: row.sourceOptionName,
					unit: row.sourceOptionUnit,
					size: row.sourceOptionSize,
					variantType: row.sourceOptionVariantType,
					definitionKind: row.sourceOptionDefinitionKind,
					definition: row.sourceOptionDefinition,
					displayAlias: row.sourceOptionDisplayAlias,
					needsReview: row.sourceOptionNeedsReview,
				});
				const weight = Number(row.weightKg || 0);
				const label =
					[row.color, row.unitLabel ?? row.size].filter(Boolean).join(" ") ||
					(weight > 0 ? `${weight}KG` : "Variant");
				return {
					...row,
					isOwnedByWarehouse:
						row.creatorSource === "warehouse" &&
						(row.creatorId === userId || row.creatorWarehouseId === userId),
					coreProductName: row.coreProductName ?? row.productName,
					coreProductImage: row.coreProductImage ?? "",
					subCategoryName: row.subCategoryName ?? "—",
					typeName: row.typeName ?? "Other",
					brandName: row.brandName ?? "—",
					variantLabel: label,
					unitLabel: variantOperations.operationalUnit,
					packUnit: variantOperations.referenceMeasurement
						? `${variantOperations.referenceMeasurement.perInventoryUnit} ${variantOperations.referenceMeasurement.unit}`
						: variantOperations.operationalUnit,
					inventoryId: row.inventoryId ?? null,
					availableQty: row.availableQty ?? "0",
					reservedQty: row.reservedQty ?? "0",
					inCartonQty: row.inCartonQty ?? "0",
					activeCartonCount: row.activeCartonCount ?? 0,
					packPrice: row.retailPrice ?? row.variantPrice ?? "0",
					basePrice: row.variantPrice ?? "0",
					isLoose: variantOperations.receivingMode === "loose",
					weightKg: weight,
				};
			});
			const totalCount = Number(totalRow?.count ?? 0);
			const optionMap = (idKey: string, nameKey: string) =>
				Array.from(
					new Map(
						optionRows
							.filter((row: any) => row[idKey] && row[nameKey])
							.map((row: any) => [row[idKey], row[nameKey]]),
					).entries(),
				)
					.map(([id, name]) => ({ id, name }))
					.sort((a: any, b: any) =>
						String(a.name).localeCompare(String(b.name)),
					);
			return {
				items,
				pagination: {
					page: input.page,
					pageSize: input.pageSize,
					totalCount,
					totalPages: Math.ceil(totalCount / input.pageSize),
				},
				stats: {
					totalProducts: Number(summary?.totalProducts ?? 0),
					inStock: Number(summary?.inStock ?? 0),
					lowStock: Number(summary?.lowStock ?? 0),
					outOfStock: Number(summary?.outOfStock ?? 0),
				},
				filterOptions: {
					types: optionMap("typeId", "typeName"),
					categories: optionMap("categoryId", "categoryName"),
					subCategories: optionMap("subCategoryId", "subCategoryName"),
					coreProducts: optionMap("coreProductId", "coreProductName"),
					brands: optionMap("brandId", "brandName"),
				},
			};
		}),

	/**
	 * Get warehouse price list — all inventory items with full product hierarchy.
	 * Grouped by core product with brand/variant detail for the pricing page.
	 */
	getWarehousePriceList: warehouseProcedure
		.input(
			z.object({
				typeId: z.number().optional(),
				categoryId: z.number().optional(),
				subCategoryId: z.number().optional(),
				coreProductId: z.number().optional(),
				brandId: z.number().optional(),
				search: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Fetch all inventory items for this warehouse with deep relations
			const items = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
				),
				with: {
					variant: {
						with: {
							brand: { columns: { id: true, name: true } },
							sourceVariantOption: true,
							product: {
								with: {
									category: {
										columns: { id: true, name: true, slug: true, typeId: true },
									},
									subCategory: {
										columns: { id: true, name: true, slug: true },
									},
									brand: { columns: { id: true, name: true } },
									coreProduct: {
										columns: {
											id: true,
											name: true,
											slug: true,
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

			// 2. Get product type info for categories (needed for type filter)
			const categoryIds = [
				...new Set(
					items
						.map((i) => i.variant?.product?.category?.id)
						.filter((id): id is number => id != null),
				),
			];

			const categoryTypeMap = new Map<
				number,
				{ typeId: number; typeName: string }
			>();
			if (categoryIds.length > 0) {
				const catTypes = await db
					.select({
						catId: catTable.id,
						typeId: productTypeTable.id,
						typeName: productTypeTable.name,
					})
					.from(catTable)
					.leftJoin(productTypeTable, eq(catTable.typeId, productTypeTable.id))
					.where(inArray(catTable.id, categoryIds));

				for (const ct of catTypes) {
					if (ct.typeId && ct.typeName) {
						categoryTypeMap.set(ct.catId, {
							typeId: ct.typeId,
							typeName: ct.typeName,
						});
					}
				}
			}

			// 3. Build flat items with all needed data
			type PriceItem = {
				inventoryId: number;
				variantId: number;
				sku: string | null;
				variantSku: string | null;
				productId: number;
				productSku: string | null;
				productName: string;
				productStatus: string;
				creatorSource: "admin" | "warehouse" | "shop" | "unknown";
				creatorId: string | null;
				isOwnedByWarehouse: boolean;
				coreProductId: number | null;
				coreProductName: string;
				coreProductImage: string;
				categoryId: number;
				categoryName: string;
				subCategoryId: number | null;
				subCategoryName: string;
				typeId: number | null;
				typeName: string;
				brandId: number | null;
				brandName: string;
				variantLabel: string;
				unitLabel: string;
				packagingType: string;
				packUnit: string;
				packPrice: string;
				basePrice: string;
				isActive: boolean;
				availableQty: string;
				reservedQty: string;
				inCartonQty: string;
				activeCartonCount: number;
				reorderLevel: number;
				updatedAt: Date;
				isLoose: boolean;
				weightKg: number;
			};

			const priceItems: PriceItem[] = [];

			for (const item of items) {
				const v = item.variant;
				if (!v || !v.product) continue;
				if (!v.sourceVariantOption) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"A warehouse variant is missing its Admin Variant definition",
					});
				}
				const variantOperations = resolveVariantOperations(
					v.sourceVariantOption,
				);
				const p = v.product;
				const cat = p.category;
				if (!cat) continue;

				const typeInfo = categoryTypeMap.get(cat.id);
				const brandInfo = v.brand || p.brand;
				const core = p.coreProduct;

				// Build variant display label
				const labelParts: string[] = [];
				if ((v as any).color) labelParts.push((v as any).color);
				if ((v as any).size) labelParts.push((v as any).size);
				const weightKg = Number(v.weightKg || 0);
				if (weightKg > 0) labelParts.push(`${weightKg}KG`);
				if (v.packagingType && v.packagingType !== "loose") {
					labelParts.push(
						v.packagingType.charAt(0).toUpperCase() + v.packagingType.slice(1),
					);
				}
				const variantLabel =
					labelParts.length > 0
						? labelParts.join(" ")
						: v.unitLabel || v.sku || `Variant #${v.id}`;

				// Pack unit display — show just the weight/unit (e.g. "5 KG", "1 L", "1 Pc")
				const packUnit = variantOperations.referenceMeasurement
					? `${variantOperations.referenceMeasurement.perInventoryUnit} ${variantOperations.referenceMeasurement.unit}`
					: variantOperations.operationalUnit;

				priceItems.push({
					inventoryId: item.id,
					variantId: v.id,
					sku: v.sku || p.sku || null,
					variantSku: v.sku || null,
					productId: p.id,
					productSku: p.sku || null,
					productName: p.name,
					productStatus: p.status,
					creatorSource: p.creatorSource,
					creatorId: p.createdById,
					isOwnedByWarehouse:
						p.creatorSource === "warehouse" && p.createdById === userId,
					coreProductId: core?.id ?? null,
					coreProductName: core?.name ?? p.name,
					// Pricing belongs to the warehouse product, so its independently edited
					// image must win. The core identity image is only a template fallback.
					coreProductImage: (p as any).image ?? core?.image ?? "",
					categoryId: cat.id,
					categoryName: cat.name,
					subCategoryId: p.subCategory?.id ?? null,
					subCategoryName: p.subCategory?.name ?? "—",
					typeId: typeInfo?.typeId ?? null,
					typeName: typeInfo?.typeName ?? "Other",
					brandId: brandInfo?.id ?? null,
					brandName: brandInfo?.name ?? "—",
					variantLabel,
					unitLabel: variantOperations.operationalUnit,
					packagingType: v.packagingType || v.packType || "unit",
					packUnit,
					packPrice: item.retailPrice || v.price || "0",
					basePrice: v.price || "0",
					isActive: v.isActive,
					availableQty: item.availableQty || "0",
					reservedQty: item.reservedQty || "0",
					inCartonQty: item.inCartonQty || "0",
					activeCartonCount: item.activeCartonCount ?? 0,
					reorderLevel: v.reorderLevel ?? p.reorderLevel ?? 0,
					updatedAt: item.updatedAt,
					isLoose: variantOperations.receivingMode === "loose",
					weightKg,
				});
			}

			// 4. Apply filters
			let filtered = priceItems;

			if (input.typeId) {
				filtered = filtered.filter((i) => i.typeId === input.typeId);
			}
			if (input.categoryId) {
				filtered = filtered.filter((i) => i.categoryId === input.categoryId);
			}
			if (input.subCategoryId) {
				filtered = filtered.filter(
					(i) => i.subCategoryId === input.subCategoryId,
				);
			}
			if (input.coreProductId) {
				filtered = filtered.filter(
					(i) => i.coreProductId === input.coreProductId,
				);
			}
			if (input.brandId) {
				filtered = filtered.filter((i) => i.brandId === input.brandId);
			}
			if (input.search?.trim()) {
				const s = input.search.trim().toLowerCase();
				filtered = filtered.filter(
					(i) =>
						i.productName.toLowerCase().includes(s) ||
						i.coreProductName.toLowerCase().includes(s) ||
						i.brandName.toLowerCase().includes(s) ||
						i.variantLabel.toLowerCase().includes(s) ||
						(i.sku?.toLowerCase().includes(s) ?? false),
				);
			}

			// 5. Build filter options from ALL items (before filtering)
			const typeSet = new Map<number, string>();
			const catSet = new Map<number, string>();
			const subCatSet = new Map<number, string>();
			const coreSet = new Map<number, string>();
			const brandSet = new Map<number, string>();

			for (const item of priceItems) {
				if (item.typeId) typeSet.set(item.typeId, item.typeName);
				catSet.set(item.categoryId, item.categoryName);
				if (item.subCategoryId)
					subCatSet.set(item.subCategoryId, item.subCategoryName);
				if (item.coreProductId)
					coreSet.set(item.coreProductId, item.coreProductName);
				if (item.brandId) brandSet.set(item.brandId, item.brandName);
			}

			// 6. Stats
			const uniqueProducts = new Set(
				priceItems.map((i) => i.coreProductId ?? i.productId),
			);
			const lastUpdated =
				priceItems.length > 0
					? priceItems.reduce(
							(latest, i) => (i.updatedAt > latest ? i.updatedAt : latest),
							priceItems[0]!.updatedAt,
						)
					: null;

			return {
				items: filtered,
				stats: {
					totalProducts: uniqueProducts.size,
					totalVariants: priceItems.length,
					lastUpdated: lastUpdated?.toISOString() ?? null,
				},
				filterOptions: {
					types: Array.from(typeSet.entries())
						.map(([id, name]) => ({ id, name }))
						.sort((a, b) => a.name.localeCompare(b.name)),
					categories: Array.from(catSet.entries())
						.map(([id, name]) => ({ id, name }))
						.sort((a, b) => a.name.localeCompare(b.name)),
					subCategories: Array.from(subCatSet.entries())
						.map(([id, name]) => ({ id, name }))
						.sort((a, b) => a.name.localeCompare(b.name)),
					coreProducts: Array.from(coreSet.entries())
						.map(([id, name]) => ({ id, name }))
						.sort((a, b) => a.name.localeCompare(b.name)),
					brands: Array.from(brandSet.entries())
						.map(([id, name]) => ({ id, name }))
						.sort((a, b) => a.name.localeCompare(b.name)),
				},
			};
		}),

	/**
	 * Update the wholesale/supply price for a specific inventory item.
	 */
	updateWarehousePrice: warehouseProcedure
		.input(
			z.object({
				inventoryId: z.number(),
				retailPrice: z.string().min(1),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.id, input.inventoryId),
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
				),
			});

			if (!existing) {
				throw new ORPCError("NOT_FOUND", {
					message: "Inventory item not found",
				});
			}

			const [updated] = await db
				.update(inventory)
				.set({ retailPrice: input.retailPrice })
				.where(eq(inventory.id, input.inventoryId))
				.returning();

			return { inventory: updated };
		}),

};

// ────────────────────────────────────────────────────────────────
// Carton Management (Config + Physical Cartons)
// ────────────────────────────────────────────────────────────────

const cartonQueries = {
	// ── Carton Config CRUD ──

	/**
	 * Get all carton configs for a specific variant.
	 */
	getCartonConfigs: warehouseProcedure
		.input(
			z.object({
				variantId: z.number().int(),
				includeInactive: z.boolean().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const variant = await db.query.productVariant.findFirst({
				where: eq(productVariant.id, input.variantId),
				with: { product: { columns: { createdByWarehouseId: true } } },
			});
			if (
				!variant ||
				(variant.product as any)?.createdByWarehouseId !==
					context.session.user.id
			) {
				throw new ORPCError("FORBIDDEN", {
					message: "This variant does not belong to your warehouse",
				});
			}

			const configs = await db
				.select()
				.from(cartonConfig)
				.where(
					and(
						eq(cartonConfig.variantId, input.variantId),
						input.includeInactive ? undefined : eq(cartonConfig.isActive, true),
					),
				)
				.orderBy(cartonConfig.packsPerCarton);

			const usage =
				configs.length === 0
					? []
					: await db
							.select({ configId: carton.cartonConfigId, usageCount: count() })
							.from(carton)
							.where(
								inArray(
									carton.cartonConfigId,
									configs.map((config) => config.id),
								),
							)
							.groupBy(carton.cartonConfigId);
			const usageByConfig = new Map(
				usage.map((row) => [row.configId, Number(row.usageCount)]),
			);

			return {
				configs: configs.map((config) => ({
					...config,
					usageCount: usageByConfig.get(config.id) || 0,
				})),
			};
		}),

	/**
	 * Get all carton configs for multiple variants at once (batch).
	 * Useful when loading product detail page with multiple variants.
	 */
	getCartonConfigsBatch: warehouseProcedure
		.input(z.object({ variantIds: z.array(z.number().int()) }))
		.handler(async ({ context, input }) => {
			if (input.variantIds.length === 0) return { configs: [] };
			const variants = await db.query.productVariant.findMany({
				where: inArray(productVariant.id, input.variantIds),
				with: { product: { columns: { createdByWarehouseId: true } } },
			});
			const ownedVariantIds = variants
				.filter(
					(variant) =>
						(variant.product as any)?.createdByWarehouseId ===
						context.session.user.id,
				)
				.map((variant) => variant.id);
			if (ownedVariantIds.length === 0) return { configs: [] };

			const configs = await db
				.select()
				.from(cartonConfig)
				.where(
					and(
						inArray(cartonConfig.variantId, ownedVariantIds),
						eq(cartonConfig.isActive, true),
					),
				)
				.orderBy(cartonConfig.variantId, cartonConfig.packsPerCarton);

			return { configs };
		}),

	/**
	 * Get a summary of active physical cartons for multiple variants.
	 * Used by the pricing page to display carton info sourced from actual carton data.
	 * Returns the most recent active carton per variant with its weight, pack count, price, and delivery cost.
	 */
	getCartonSummaryBatch: warehouseProcedure
		.input(z.object({ variantIds: z.array(z.number().int()) }))
		.handler(async ({ context, input }) => {
			if (input.variantIds.length === 0) return { cartons: [] };

			const userId = context.session.user.id;

			// Fetch all active cartons for these variants belonging to this warehouse
			const activeCartons = await db.query.carton.findMany({
				where: and(
					eq(carton.warehouseId, userId),
					eq(carton.status, "active"),
					inArray(carton.variantId, input.variantIds),
				),
				orderBy: [desc(carton.createdAt)],
			});

			// Group by variantId — pick the most recent active carton as the representative
			const summaryMap = new Map<
				number,
				{
					variantId: number;
					totalPacks: number;
					totalWeightKg: string;
					cartonPrice: string | null;
					deliveryCostPerUnit: string | null;
					activeCartonCount: number;
					latestCartonId: string;
					latestCartonDbId: number;
				}
			>();

			for (const c of activeCartons) {
				if (!summaryMap.has(c.variantId)) {
					// First (most recent) carton for this variant becomes the representative
					summaryMap.set(c.variantId, {
						variantId: c.variantId,
						totalPacks: c.totalPacks,
						totalWeightKg: c.totalWeightKg,
						cartonPrice: c.cartonPrice,
						deliveryCostPerUnit: c.deliveryCostPerUnit,
						activeCartonCount: 1,
						latestCartonId: c.cartonId,
						latestCartonDbId: c.id,
					});
				} else {
					// Accumulate count, weight, and fill missing pricing from other cartons
					const existing = summaryMap.get(c.variantId)!;
					existing.activeCartonCount += 1;
					existing.totalPacks += c.totalPacks;
					existing.totalWeightKg = (
						parseFloat(existing.totalWeightKg) + parseFloat(c.totalWeightKg)
					).toFixed(2);
					// If the representative carton has no price, inherit from this carton
					if (!existing.cartonPrice && c.cartonPrice) {
						existing.cartonPrice = c.cartonPrice;
					}
					if (!existing.deliveryCostPerUnit && c.deliveryCostPerUnit) {
						existing.deliveryCostPerUnit = c.deliveryCostPerUnit;
					}
				}
			}

			return { cartons: Array.from(summaryMap.values()) };
		}),

	/**
	 * Create a new carton config for a variant.
	 */
	createCartonConfig: warehouseProcedure
		.input(
			z.object({
				variantId: z.number().int(),
				packsPerCarton: z.number().int().min(1),
				cartonPrice: z.string().refine((v) => parseFloat(v) >= 0),
				cartonCostPrice: z.string().optional(),
				deliveryCostPerCarton: z.string().optional(),
				label: z.string().optional(),
				isDefault: z.boolean().default(false),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Validate variant belongs to this warehouse
			const variant = await db.query.productVariant.findFirst({
				where: eq(productVariant.id, input.variantId),
				with: {
					product: { columns: { id: true, createdByWarehouseId: true } },
					sourceVariantOption: true,
				},
			});

			if (
				!variant ||
				(variant.product as any)?.createdByWarehouseId !== userId
			) {
				throw new ORPCError("FORBIDDEN", {
					message: "This variant does not belong to your warehouse",
				});
			}
			if (!variant.sourceVariantOption) {
				throw new ORPCError("BAD_REQUEST", {
					message: "This variant is missing its Admin Variant definition",
				});
			}
			if (
				resolveVariantOperations(variant.sourceVariantOption).receivingMode ===
				"loose"
			) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Raw loose inventory cannot be used in a carton configuration",
				});
			}

			const duplicate = await db.query.cartonConfig.findFirst({
				where: and(
					eq(cartonConfig.variantId, input.variantId),
					eq(cartonConfig.packsPerCarton, input.packsPerCarton),
					eq(cartonConfig.isActive, true),
				),
			});
			if (duplicate) {
				throw new ORPCError("CONFLICT", {
					message: `An active ${input.packsPerCarton}-unit carton configuration already exists`,
				});
			}

			// Auto-calculate carton weight
			const packWeightKg = parseFloat(variant.weightKg);
			const cartonWeightKg = input.packsPerCarton * packWeightKg;

			// Auto-generate label if not provided
			const label = input.label || `${input.packsPerCarton} Pack Carton`;

			// If this is set as default, unset any existing defaults
			if (input.isDefault) {
				await db
					.update(cartonConfig)
					.set({ isDefault: false })
					.where(eq(cartonConfig.variantId, input.variantId));
			}

			const [config] = await db
				.insert(cartonConfig)
				.values({
					variantId: input.variantId,
					packsPerCarton: input.packsPerCarton,
					cartonWeightKg: cartonWeightKg.toFixed(2),
					cartonPrice: input.cartonPrice,
					cartonCostPrice: input.cartonCostPrice || null,
					deliveryCostPerCarton: input.deliveryCostPerCarton || null,
					label,
					isDefault: input.isDefault,
				})
				.returning();

			return { config };
		}),

	/**
	 * Update an existing carton config.
	 */
	updateCartonConfig: warehouseProcedure
		.input(
			z.object({
				id: z.number().int(),
				packsPerCarton: z.number().int().min(1).optional(),
				cartonPrice: z.string().optional(),
				cartonCostPrice: z.string().optional(),
				deliveryCostPerCarton: z.string().optional(),
				label: z.string().optional(),
				isDefault: z.boolean().optional(),
				isActive: z.boolean().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Validate config exists and belongs to this warehouse
			const existing = await db.query.cartonConfig.findFirst({
				where: eq(cartonConfig.id, input.id),
				with: {
					variant: {
						with: {
							product: { columns: { createdByWarehouseId: true } },
						},
					},
				},
			});

			if (
				!existing ||
				(existing.variant?.product as any)?.createdByWarehouseId !== userId
			) {
				throw new ORPCError("FORBIDDEN", {
					message: "Config not found or not yours",
				});
			}

			const updateData: Record<string, any> = {};

			if (input.packsPerCarton !== undefined) {
				const usageRows = await db
					.select({ usageCount: count() })
					.from(carton)
					.where(eq(carton.cartonConfigId, existing.id));
				if (
					Number(usageRows[0]?.usageCount || 0) > 0 &&
					input.packsPerCarton !== existing.packsPerCarton
				) {
					throw new ORPCError("CONFLICT", {
						message:
							"Units per carton is locked after this configuration has been used. Clone it instead.",
					});
				}
				const duplicate = await db.query.cartonConfig.findFirst({
					where: and(
						eq(cartonConfig.variantId, existing.variantId),
						eq(cartonConfig.packsPerCarton, input.packsPerCarton),
						eq(cartonConfig.isActive, true),
						ne(cartonConfig.id, existing.id),
					),
				});
				if (duplicate) {
					throw new ORPCError("CONFLICT", {
						message:
							"An active configuration with this unit count already exists",
					});
				}
				updateData.packsPerCarton = input.packsPerCarton;
				// Recalculate weight
				const packWeightKg = parseFloat(existing.variant?.weightKg || "0");
				updateData.cartonWeightKg = (
					input.packsPerCarton * packWeightKg
				).toFixed(2);
			}
			if (input.cartonPrice !== undefined)
				updateData.cartonPrice = input.cartonPrice;
			if (input.cartonCostPrice !== undefined)
				updateData.cartonCostPrice = input.cartonCostPrice;
			if (input.deliveryCostPerCarton !== undefined)
				updateData.deliveryCostPerCarton = input.deliveryCostPerCarton;
			if (input.label !== undefined) updateData.label = input.label;
			if (input.isActive !== undefined) {
				if (input.isActive) {
					const duplicate = await db.query.cartonConfig.findFirst({
						where: and(
							eq(cartonConfig.variantId, existing.variantId),
							eq(
								cartonConfig.packsPerCarton,
								input.packsPerCarton ?? existing.packsPerCarton,
							),
							eq(cartonConfig.isActive, true),
							ne(cartonConfig.id, existing.id),
						),
					});
					if (duplicate)
						throw new ORPCError("CONFLICT", {
							message:
								"An active configuration with this unit count already exists",
						});
				}
				updateData.isActive = input.isActive;
				if (!input.isActive) updateData.isDefault = false;
			}

			if (input.isDefault === true) {
				// Unset other defaults first
				await db
					.update(cartonConfig)
					.set({ isDefault: false })
					.where(eq(cartonConfig.variantId, existing.variantId));
				updateData.isDefault = true;
			} else if (input.isDefault === false) {
				updateData.isDefault = false;
			}

			if (Object.keys(updateData).length > 0) {
				await db
					.update(cartonConfig)
					.set(updateData)
					.where(eq(cartonConfig.id, input.id));
			}

			return { success: true };
		}),

	/**
	 * Delete (soft) a carton config.
	 */
	deleteCartonConfig: warehouseProcedure
		.input(z.object({ id: z.number().int() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existing = await db.query.cartonConfig.findFirst({
				where: eq(cartonConfig.id, input.id),
				with: {
					variant: {
						with: {
							product: { columns: { createdByWarehouseId: true } },
						},
					},
				},
			});

			if (
				!existing ||
				(existing.variant?.product as any)?.createdByWarehouseId !== userId
			) {
				throw new ORPCError("FORBIDDEN", {
					message: "Config not found or not yours",
				});
			}

			await db
				.update(cartonConfig)
				.set({ isActive: false })
				.where(eq(cartonConfig.id, input.id));

			return { success: true };
		}),

	// ── Physical Carton Management ──

	/**
	 * Preview the next carton ID that will be assigned.
	 */
	getNextCartonIdPreview: warehouseProcedure.handler(async () => {
		const year = new Date().getFullYear();
		const [lastCarton] = await db
			.select({ cartonId: carton.cartonId })
			.from(carton)
			.where(sql`${carton.cartonId} LIKE ${"CTN-" + year + "-%"}`)
			.orderBy(desc(carton.id))
			.limit(1);

		let nextNum = 1;
		if (lastCarton?.cartonId) {
			const parts = lastCarton.cartonId.split("-");
			const lastNum = parseInt(parts[2] || "0", 10);
			nextNum = lastNum + 1;
		}

		return {
			nextCartonId: `CTN-${year}-${String(nextNum).padStart(6, "0")}`,
		};
	}),

	/**
	 * Create a physical carton from existing loose/pack stock.
	 * Deducts from available stock and marks as in-carton.
	 */
	createCarton: warehouseProcedure
		.input(
			z.object({
				// Existing callers may still use a saved template. The normal page
				// sends the physical carton composition directly.
				cartonConfigId: z.number().int().optional(),
				variantId: z.number().int().optional(),
				packsPerCarton: z.number().int().min(1).optional(),
				cartonPrice: z
					.string()
					.trim()
					.refine((value) => value !== "" && Number(value) >= 0)
					.optional(),
				deliveryCost: z
					.string()
					.trim()
					.refine((value) => value !== "" && Number(value) >= 0)
					.optional(),
				storageAreaId: z.number().int().optional(),
				note: z.string().optional(),
				overrideCartonPrice: z.string().optional(),
				overrideDeliveryCost: z.string().optional(),
				overrideReason: z.string().trim().min(3).max(500).optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const config = input.cartonConfigId
				? await db.query.cartonConfig.findFirst({
						where: and(
							eq(cartonConfig.id, input.cartonConfigId),
							eq(cartonConfig.isActive, true),
						),
						with: {
							variant: {
								with: {
									product: { columns: { createdByWarehouseId: true } },
									sourceVariantOption: true,
								},
							},
						},
					})
				: null;
			if (input.cartonConfigId && (!config || !config.variant)) {
				throw new ORPCError("NOT_FOUND", {
					message: "Active carton configuration not found",
				});
			}
			const variant =
				config?.variant ??
				(input.variantId
					? await db.query.productVariant.findFirst({
							where: eq(productVariant.id, input.variantId),
							with: {
								product: { columns: { createdByWarehouseId: true } },
								sourceVariantOption: true,
							},
						})
					: null);
			if (!variant) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Select a product variant for this carton",
				});
			}
			if ((variant.product as any)?.createdByWarehouseId !== userId) {
				throw new ORPCError("FORBIDDEN", {
					message: "This product variant does not belong to your warehouse",
				});
			}
			if (!variant.sourceVariantOption) {
				throw new ORPCError("BAD_REQUEST", {
					message: "This variant is missing its Admin Variant definition",
				});
			}
			if (
				resolveVariantOperations(variant.sourceVariantOption).receivingMode ===
				"loose"
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Loose inventory cannot be placed directly inside a carton",
				});
			}

			const hasPriceOverride = input.overrideCartonPrice !== undefined;
			const hasDeliveryOverride = input.overrideDeliveryCost !== undefined;
			if (
				config &&
				(hasPriceOverride || hasDeliveryOverride) &&
				!input.overrideReason
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "An override reason is required for pricing exceptions",
				});
			}
			const packCount = config?.packsPerCarton ?? input.packsPerCarton;
			if (!packCount || packCount <= 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Enter the number of units inside this carton",
				});
			}
			const resolvedCartonPrice = config
				? (input.overrideCartonPrice ?? config.cartonPrice)
				: input.cartonPrice;
			if (resolvedCartonPrice === undefined) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Enter the carton selling price",
				});
			}
			const resolvedDeliveryCost = config
				? (input.overrideDeliveryCost ?? config.deliveryCostPerCarton)
				: (input.deliveryCost ?? null);

			// Check inventory has enough unpacked stock.
			const inv = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
					eq(inventory.variantId, variant.id),
				),
			});

			if (!inv) {
				throw new ORPCError("NOT_FOUND", {
					message: "No inventory found for this variant",
				});
			}

			const available = parseFloat(inv.availableQty);
			const inCarton = parseFloat(inv.inCartonQty);
			const looseStock = available - inCarton;

			if (looseStock < packCount) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Not enough stock. Need ${packCount} units, only ${Math.floor(looseStock)} available.`,
				});
			}

			const totalWeightKg = (packCount * Number(variant.weightKg || 0)).toFixed(
				2,
			);

			// 5. Generate carton ID: CTN-YYYY-NNNNNN
			const year = new Date().getFullYear();
			const [lastCarton] = await db
				.select({ cartonId: carton.cartonId })
				.from(carton)
				.where(sql`${carton.cartonId} LIKE ${"CTN-" + year + "-%"}`)
				.orderBy(desc(carton.id))
				.limit(1);

			let nextNum = 1;
			if (lastCarton?.cartonId) {
				const parts = lastCarton.cartonId.split("-");
				const lastNum = parseInt(parts[2] || "0", 10);
				nextNum = lastNum + 1;
			}
			const cartonIdStr = `CTN-${year}-${String(nextNum).padStart(6, "0")}`;

			// 6. Transaction: create carton + update inventory
			const result = await db.transaction(async (tx) => {
				const currentInventory = await tx.query.inventory.findFirst({
					where: eq(inventory.id, inv.id),
				});
				if (!currentInventory) {
					throw new ORPCError("NOT_FOUND", {
						message: "Inventory is no longer available",
					});
				}
				const currentInCarton = parseFloat(currentInventory.inCartonQty);
				const currentUnpacked =
					parseFloat(currentInventory.availableQty) - currentInCarton;
				if (currentUnpacked < packCount) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Stock changed before creation. Need ${packCount} units, only ${Math.floor(currentUnpacked)} available.`,
					});
				}

				const [newCarton] = await tx
					.insert(carton)
					.values({
						cartonId: cartonIdStr,
						warehouseId: userId,
						cartonConfigId: config?.id ?? null,
						variantId: variant.id,
						totalPacks: packCount,
						totalWeightKg,
						status: "active",
						barcode: cartonIdStr,
						storageAreaId: input.storageAreaId || null,
						note: input.note || null,
						cartonPrice: resolvedCartonPrice,
						deliveryCostPerUnit: resolvedDeliveryCost,
						cartonPriceOverridden: !!config && hasPriceOverride,
						deliveryCostOverridden: !!config && hasDeliveryOverride,
						overrideReason: config ? input.overrideReason || null : null,
					})
					.returning();

				// Update inventory: move stock from available → in-carton
				const newInCartonQty = currentInCarton + packCount;
				const newActiveCount = (currentInventory.activeCartonCount || 0) + 1;

				await tx
					.update(inventory)
					.set({
						inCartonQty: newInCartonQty.toFixed(2),
						activeCartonCount: newActiveCount,
					})
					.where(eq(inventory.id, inv.id));

				return newCarton;
			});

			return { carton: result, cartonId: cartonIdStr };
		}),

	/**
	 * Break a carton — decompose back to loose/pack stock.
	 * Carton becomes immutable with status 'broken'.
	 */
	breakCarton: warehouseProcedure
		.input(z.object({ cartonId: z.number().int() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Validate carton exists and is active
			const existingCarton = await db.query.carton.findFirst({
				where: and(
					eq(carton.id, input.cartonId),
					eq(carton.warehouseId, userId),
					eq(carton.status, "active"),
				),
				with: {
					variant: {
						columns: {
							packType: true,
							packagingType: true,
						},
					},
				},
			});

			if (!existingCarton) {
				throw new ORPCError("NOT_FOUND", {
					message:
						"Active carton not found or doesn't belong to your warehouse",
				});
			}

			// 2. Get inventory
			const inv = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
					eq(inventory.variantId, existingCarton.variantId),
				),
			});

			if (!inv) {
				throw new ORPCError("NOT_FOUND", { message: "Inventory not found" });
			}

			// 3. Transaction: break carton + return stock
			await db.transaction(async (tx) => {
				const cartonUnits = getCartonInventoryUnits(
					existingCarton,
					existingCarton.variant,
				);

				// Mark carton as broken
				await tx
					.update(carton)
					.set({
						status: "broken",
						brokenAt: new Date(),
						brokenById: userId,
					})
					.where(eq(carton.id, input.cartonId));

				// Move packs from in-carton → loose
				const inCarton = parseFloat(inv.inCartonQty);
				const newInCartonQty = Math.max(0, inCarton - cartonUnits);
				const newActiveCount = Math.max(0, (inv.activeCartonCount || 0) - 1);

				await tx
					.update(inventory)
					.set({
						inCartonQty: newInCartonQty.toFixed(2),
						activeCartonCount: newActiveCount,
					})
					.where(eq(inventory.id, inv.id));
			});

			return { success: true, message: "Carton broken successfully" };
		}),

	/**
	 * List all cartons for this warehouse.
	 */
	getCartons: warehouseProcedure
		.input(
			z.object({
				status: z.enum(["active", "broken", "dispatched", "sold"]).optional(),
				variantId: z.number().int().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const offset = (input.page - 1) * input.limit;

			const scopeConditions: SQL[] = [eq(carton.warehouseId, userId)];
			const conditions: SQL[] = [...scopeConditions];

			if (input.status) {
				conditions.push(eq(carton.status, input.status));
			}
			if (input.variantId) {
				scopeConditions.push(eq(carton.variantId, input.variantId));
				conditions.push(eq(carton.variantId, input.variantId));
			}

			const cartons = await db.query.carton.findMany({
				where: and(...conditions),
				orderBy: [desc(carton.createdAt)],
				offset,
				limit: input.limit,
				with: {
					config: true,
					variant: {
						columns: {
							id: true,
							sku: true,
							unitLabel: true,
							weightKg: true,
						},
						with: {
							product: {
								columns: { id: true, name: true, image: true },
							},
							brand: { columns: { id: true, name: true } },
						},
					},
					storageArea: { columns: { id: true, name: true } },
				},
			});

			const [countResult] = await db
				.select({ count: count() })
				.from(carton)
				.where(and(...conditions));

			// Stats
			const [activeCount] = await db
				.select({ count: count() })
				.from(carton)
				.where(and(...scopeConditions, eq(carton.status, "active")));

			const [totalCartons] = await db
				.select({ count: count() })
				.from(carton)
				.where(and(...scopeConditions, ne(carton.status, "sold")));

			return {
				cartons,
				stats: {
					active: Number(activeCount?.count || 0),
					total: Number(totalCartons?.count || 0),
				},
				pagination: {
					page: input.page,
					limit: input.limit,
					totalCount: Number(countResult?.count || 0),
					totalPages: Math.ceil(Number(countResult?.count || 0) / input.limit),
				},
			};
		}),

	/**
	 * Get a single carton by ID with full details.
	 */
	getCartonById: warehouseProcedure
		.input(z.object({ id: z.number().int() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const result = await db.query.carton.findFirst({
				where: and(eq(carton.id, input.id), eq(carton.warehouseId, userId)),
				with: {
					config: true,
					variant: {
						with: {
							product: {
								columns: { id: true, name: true, image: true },
								with: { category: { columns: { name: true } } },
							},
							brand: { columns: { id: true, name: true } },
						},
					},
					storageArea: { columns: { id: true, name: true } },
				},
			});

			if (!result) {
				throw new ORPCError("NOT_FOUND", { message: "Carton not found" });
			}

			return { carton: result };
		}),

	// ── Carton Tracking System (New) ──

	/**
	 * Get products that have cartons — Level 1 of the carton tracking drill-down.
	 * Aggregates carton data grouped by product.
	 */
	getCartonTrackingProducts: warehouseProcedure
		.input(
			z.object({
				search: z.string().optional(),
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(100).default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Fetch all cartons for this warehouse with deep relations
			const allCartons = await db.query.carton.findMany({
				where: and(eq(carton.warehouseId, userId), eq(carton.status, "active")),
				with: {
					config: true,
					variant: {
						with: {
							product: {
								columns: { id: true, name: true, image: true },
							},
							brand: { columns: { id: true, name: true } },
						},
					},
					storageArea: { columns: { id: true, name: true } },
				},
			});

			// 2. Group by product
			const productMap = new Map<
				number,
				{
					productId: number;
					productName: string;
					productImage: string;
					variants: Set<string>;
					packType: string;
					totalCartons: number;
					activeCartons: number;
					totalPacks: number;
					totalWeightKg: number;
					locations: Set<string>;
				}
			>();

			for (const c of allCartons) {
				const v = c.variant;
				if (!v?.product) continue;
				const p = v.product as any;

				if (!productMap.has(p.id)) {
					productMap.set(p.id, {
						productId: p.id,
						productName: p.name,
						productImage: p.image || "",
						variants: new Set(),
						packType:
							(v as any).packType || (v as any).packagingType || "carton",
						totalCartons: 0,
						activeCartons: 0,
						totalPacks: 0,
						totalWeightKg: 0,
						locations: new Set(),
					});
				}

				const entry = productMap.get(p.id)!;
				const variantLabel = (v.brand as any)?.name
					? `${(v.brand as any).name} ${v.unitLabel}`
					: v.unitLabel;
				entry.variants.add(variantLabel);
				entry.totalCartons += 1;
				entry.activeCartons += 1;
				entry.totalPacks += c.totalPacks;
				entry.totalWeightKg += parseFloat(c.totalWeightKg);
				if (c.storageArea) {
					entry.locations.add((c.storageArea as any).name);
				}
			}

			// 3. Convert to array and apply search
			let products = Array.from(productMap.values()).map((p) => ({
				productId: p.productId,
				productName: p.productName,
				productImage: p.productImage,
				variantsAvailable: Array.from(p.variants).join(", "),
				packType: p.packType,
				totalCartons: p.totalCartons,
				activeCartons: p.activeCartons,
				totalPacks: p.totalPacks,
				totalWeightKg: Math.round(p.totalWeightKg * 100) / 100,
				locationCount: p.locations.size,
			}));

			if (input.search?.trim()) {
				const s = input.search.trim().toLowerCase();
				products = products.filter(
					(p) =>
						p.productName.toLowerCase().includes(s) ||
						p.variantsAvailable.toLowerCase().includes(s),
				);
			}

			// Sort by active cartons descending
			products.sort((a, b) => b.activeCartons - a.activeCartons);

			// 4. KPI stats
			const allLocations = new Set(
				allCartons.map((c) => (c.storageArea as any)?.name).filter(Boolean),
			);

			const kpi = {
				totalProducts: productMap.size,
				totalCartons: allCartons.length,
				totalUnits: allCartons.reduce((s, c) => s + c.totalPacks, 0),
				activeLocations: allLocations.size,
			};

			// 5. Paginate
			const totalCount = products.length;
			const totalPages = Math.ceil(totalCount / input.pageSize);
			const offset = (input.page - 1) * input.pageSize;
			const paginatedProducts = products.slice(offset, offset + input.pageSize);

			return {
				products: paginatedProducts,
				kpi,
				pagination: {
					page: input.page,
					pageSize: input.pageSize,
					totalCount,
					totalPages,
				},
			};
		}),

	/**
	 * Get variant breakdown for a specific product — Level 2 of the carton tracking drill-down.
	 */
	getCartonTrackingVariants: warehouseProcedure
		.input(
			z.object({
				productId: z.number().int(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Get all cartons for this warehouse with variant relations
			const allCartons = await db.query.carton.findMany({
				where: and(eq(carton.warehouseId, userId), eq(carton.status, "active")),
				with: {
					config: true,
					variant: {
						with: {
							product: { columns: { id: true, name: true, image: true } },
							brand: { columns: { id: true, name: true } },
						},
					},
					storageArea: { columns: { id: true, name: true } },
				},
			});

			// Filter to the specific product
			const productCartons = allCartons.filter(
				(c) => (c.variant?.product as any)?.id === input.productId,
			);

			// Get product info from the first carton
			const firstCarton = productCartons[0];
			const productInfo = firstCarton
				? {
						productId: (firstCarton.variant?.product as any)?.id,
						productName:
							(firstCarton.variant?.product as any)?.name || "Unknown",
						productImage: (firstCarton.variant?.product as any)?.image || "",
					}
				: {
						productId: input.productId,
						productName: "Unknown",
						productImage: "",
					};

			// Group by variant
			const variantMap = new Map<
				number,
				{
					variantId: number;
					variantLabel: string;
					brandName: string;
					sku: string;
					weightKg: string;
					packType: string;
					totalCartons: number;
					activeCartons: number;
					totalPacks: number;
				}
			>();

			for (const c of productCartons) {
				const v = c.variant;
				if (!v) continue;

				if (!variantMap.has(v.id)) {
					variantMap.set(v.id, {
						variantId: v.id,
						variantLabel: v.unitLabel || `Variant #${v.id}`,
						brandName: (v.brand as any)?.name || "—",
						sku: v.sku || "—",
						weightKg: v.weightKg,
						packType:
							(v as any).packType || (v as any).packagingType || "other",
						totalCartons: 0,
						activeCartons: 0,
						totalPacks: 0,
					});
				}

				const entry = variantMap.get(v.id)!;
				entry.totalCartons += 1;
				entry.activeCartons += 1;
				entry.totalPacks += c.totalPacks;
			}

			return {
				product: productInfo,
				variants: Array.from(variantMap.values()).sort(
					(a, b) => b.activeCartons - a.activeCartons,
				),
			};
		}),

	/**
	 * Transfer a carton to a different storage area.
	 */
	transferCarton: warehouseProcedure
		.input(
			z.object({
				cartonId: z.number().int(),
				newStorageAreaId: z.number().int(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Validate carton exists, is active, and belongs to this warehouse
			const existingCarton = await db.query.carton.findFirst({
				where: and(
					eq(carton.id, input.cartonId),
					eq(carton.warehouseId, userId),
					eq(carton.status, "active"),
				),
			});

			if (!existingCarton) {
				throw new ORPCError("NOT_FOUND", {
					message:
						"Active carton not found or doesn't belong to your warehouse",
				});
			}

			// Validate storage area belongs to this warehouse
			const area = await db.query.warehouseStorageArea.findFirst({
				where: and(
					eq(warehouseStorageArea.id, input.newStorageAreaId),
					eq(warehouseStorageArea.warehouseId, userId),
				),
			});

			if (!area) {
				throw new ORPCError("NOT_FOUND", { message: "Storage area not found" });
			}

			await db
				.update(carton)
				.set({ storageAreaId: input.newStorageAreaId })
				.where(eq(carton.id, input.cartonId));

			return { success: true, message: `Carton transferred to ${area.name}` };
		}),

	/**
	 * Mark a carton as empty — removes it from active inventory.
	 */
	markCartonEmpty: warehouseProcedure
		.input(z.object({ cartonId: z.number().int() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Validate carton
			const existingCarton = await db.query.carton.findFirst({
				where: and(
					eq(carton.id, input.cartonId),
					eq(carton.warehouseId, userId),
					eq(carton.status, "active"),
				),
				with: {
					variant: {
						columns: {
							packType: true,
							packagingType: true,
						},
					},
				},
			});

			if (!existingCarton) {
				throw new ORPCError("NOT_FOUND", {
					message: "Active carton not found",
				});
			}

			// Get inventory
			const inv = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
					eq(inventory.variantId, existingCarton.variantId),
				),
			});

			if (!inv) {
				throw new ORPCError("NOT_FOUND", { message: "Inventory not found" });
			}

			// Transaction: mark carton sold/empty + adjust inventory
			await db.transaction(async (tx) => {
				const cartonUnits = getCartonInventoryUnits(
					existingCarton,
					existingCarton.variant,
				);

				await tx
					.update(carton)
					.set({ status: "sold" })
					.where(eq(carton.id, input.cartonId));

				// Remove packs from in-carton count
				const inCartonQty = parseFloat(inv.inCartonQty);
				const newInCartonQty = Math.max(0, inCartonQty - cartonUnits);
				const newActiveCount = Math.max(0, (inv.activeCartonCount || 0) - 1);

				// Also reduce available qty since items are consumed
				const availableQty = parseFloat(inv.availableQty);
				const newAvailableQty = Math.max(0, availableQty - cartonUnits);

				await tx
					.update(inventory)
					.set({
						inCartonQty: newInCartonQty.toFixed(2),
						activeCartonCount: newActiveCount,
						availableQty: newAvailableQty.toFixed(2),
					})
					.where(eq(inventory.id, inv.id));
			});

			return { success: true, message: "Carton marked as empty" };
		}),

	/**
	 * Update carton price and delivery cost for an existing active carton.
	 */
	updateCartonPrice: warehouseProcedure
		.input(
			z.object({
				cartonId: z.number().int(),
				cartonPrice: z.string().optional(),
				deliveryCostPerUnit: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingCarton = await db.query.carton.findFirst({
				where: and(
					eq(carton.id, input.cartonId),
					eq(carton.warehouseId, userId),
				),
			});

			if (!existingCarton) {
				throw new ORPCError("NOT_FOUND", {
					message: "Carton not found or doesn't belong to your warehouse",
				});
			}

			const updateData: Record<string, any> = {};
			if (input.cartonPrice !== undefined)
				updateData.cartonPrice = input.cartonPrice;
			if (input.deliveryCostPerUnit !== undefined)
				updateData.deliveryCostPerUnit = input.deliveryCostPerUnit;

			if (Object.keys(updateData).length === 0) {
				return { success: true, message: "Nothing to update" };
			}

			// Update the target carton
			await db
				.update(carton)
				.set(updateData)
				.where(eq(carton.id, input.cartonId));

			// Also propagate to sibling active cartons of the same variant
			// that currently have no price set (batch-created cartons start with null)
			const siblingUpdateData: Record<string, any> = {};
			if (input.cartonPrice !== undefined) {
				siblingUpdateData.cartonPrice = input.cartonPrice;
			}
			if (input.deliveryCostPerUnit !== undefined) {
				siblingUpdateData.deliveryCostPerUnit = input.deliveryCostPerUnit;
			}

			if (Object.keys(siblingUpdateData).length > 0) {
				const conditions = [
					eq(carton.warehouseId, userId),
					eq(carton.variantId, existingCarton.variantId),
					eq(carton.status, "active"),
					sql`${carton.id} != ${input.cartonId}`,
				];

				// Only update siblings that have null for the fields being set
				if (input.cartonPrice !== undefined) {
					conditions.push(sql`${carton.cartonPrice} IS NULL`);
				}

				await db
					.update(carton)
					.set(siblingUpdateData)
					.where(and(...conditions));
			}

			return { success: true, message: "Carton price updated" };
		}),

	/**
	 * Unit/Carton Inventory — product-level view showing unit stock
	 * split between loose and in-carton, with carton breakdown per config.
	 */
	getUnitCartonInventory: warehouseProcedure
		.input(
			z.object({
				search: z.string().optional(),
				categoryId: z.number().int().optional(),
				viewMode: z
					.enum(["all", "loose", "in_carton"])
					.optional()
					.default("all"),
				page: z.number().int().min(1).optional().default(1),
				pageSize: z.number().int().min(1).max(100).optional().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Fetch all inventory items with deep relations
			const items = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "warehouse"),
					eq(inventory.ownerId, userId),
				),
				with: {
					variant: {
						with: {
							brand: { columns: { id: true, name: true } },
							sourceVariantOption: true,
							product: {
								with: {
									category: { columns: { id: true, name: true } },
									coreProduct: {
										columns: { id: true, name: true, image: true },
									},
									brand: { columns: { id: true, name: true } },
								},
							},
						},
					},
				},
			});

			// 2. Fetch carton configs for all variants to compute in-carton allocation
			//    (matches the stock list page logic — don't rely solely on inCartonQty)
			const allVariantIds = items
				.map((i) => i.variant?.id)
				.filter((id): id is number => id !== undefined);

			const cartonConfigLookup = new Map<number, { packsPerCarton: number }>();
			if (allVariantIds.length > 0) {
				const configs = await db
					.select({
						variantId: cartonConfig.variantId,
						packsPerCarton: cartonConfig.packsPerCarton,
						isDefault: cartonConfig.isDefault,
					})
					.from(cartonConfig)
					.where(
						and(
							inArray(cartonConfig.variantId, allVariantIds),
							eq(cartonConfig.isActive, true),
						),
					);
				for (const c of configs) {
					// Prefer default config, otherwise first one
					if (!cartonConfigLookup.has(c.variantId) || c.isDefault) {
						cartonConfigLookup.set(c.variantId, {
							packsPerCarton: c.packsPerCarton,
						});
					}
				}
			}

			// 3. Build flat list with carton tracking data
			type UnitItem = {
				inventoryId: number;
				variantId: number;
				productId: number;
				productName: string;
				productImage: string;
				coreProductId: number | null;
				coreProductName: string;
				categoryId: number | null;
				categoryName: string;
				brandName: string;
				variantLabel: string;
				unitLabel: string;
				sku: string;
				color: string;
				size: string;
				packType: string;
				receivingMode: "direct" | "pack" | "loose";
				weightKg: number;
				totalUnits: number;
				looseUnits: number;
				inCartonUnits: number;
				reservedUnits: number;
				availableUnits: number;
				activeCartonCount: number;
			};

			const unitItems: UnitItem[] = [];

			for (const item of items) {
				const v = item.variant;
				if (!v || !v.product) continue;
				if (!v.sourceVariantOption) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"A warehouse variant is missing its Admin Variant definition",
					});
				}
				const variantOperations = resolveVariantOperations(
					v.sourceVariantOption,
				);
				const p = v.product;
				const brandInfo = v.brand || (p as any).brand;
				const core = p.coreProduct;
				const cat = p.category;

				const totalUnits = parseFloat(item.availableQty || "0");
				const dbInCartonQty = parseFloat(item.inCartonQty || "0");
				const reservedUnits = parseFloat(item.reservedQty || "0");
				const availableUnits = Math.max(0, totalUnits - reservedUnits);

				// Compute in-carton vs loose (matching stock list page logic):
				// Priority: 1) physical carton tracking (inCartonQty)
				//           2) carton config computation
				//           3) Admin Variant Option operational classification
				const isLoose = variantOperations.receivingMode === "loose";
				const cfg = cartonConfigLookup.get(v.id);
				let inCartonUnits: number;
				let looseUnits: number;

				if (dbInCartonQty > 0) {
					// Physical cartons tracked in DB — use actual data
					inCartonUnits = dbInCartonQty;
					looseUnits = Math.max(0, totalUnits - inCartonUnits);
				} else if (
					cfg &&
					cfg.packsPerCarton > 0 &&
					!isLoose &&
					totalUnits > 0
				) {
					// Has carton config — compute carton allocation
					const cartonCount = Math.floor(totalUnits / cfg.packsPerCarton);
					inCartonUnits = cartonCount * cfg.packsPerCarton;
					looseUnits = totalUnits - inCartonUnits;
				} else if (isLoose) {
					// Loose variant — all stock is loose
					inCartonUnits = 0;
					looseUnits = totalUnits;
				} else {
					// Packed variant (packet, sack, etc.) without carton config
					// Not loose, but not in carton either
					inCartonUnits = 0;
					looseUnits = 0;
				}

				// Build variant label: "Brand + VariantOptionName"
				// Uses the admin-managed variant option name (e.g. "12KG Cylinder")
				const wKg = parseFloat(v.weightKg || "0");
				const optionName = (v as any).sourceVariantOption?.name as
					| string
					| undefined;
				const parts: string[] = [];
				if (brandInfo?.name) parts.push(brandInfo.name);
				if (v.color) parts.push(v.color);
				if (v.size) parts.push(v.size);
				if (optionName) {
					parts.push(optionName);
				} else if (wKg > 0) {
					// Fallback for variants without a linked variant option
					parts.push(`${wKg}${wKg >= 1 ? "KG" : "g"}`);
				}

				const variantLabel =
					parts.length > 0
						? parts.join(" + ")
						: v.quantitySelectorLabel || v.sku || `Variant #${v.id}`;

				unitItems.push({
					inventoryId: item.id,
					variantId: v.id,
					productId: p.id,
					productName: core?.name ?? p.name,
					productImage: core?.image ?? (p as any).image ?? "",
					coreProductId: core?.id ?? null,
					coreProductName: core?.name ?? p.name,
					categoryId: cat?.id ?? null,
					categoryName: cat?.name ?? "—",
					brandName: brandInfo?.name ?? "—",
					variantLabel,
					unitLabel: variantOperations.operationalUnit,
					sku: v.sku || "",
					color: v.color || "",
					size: v.size || "",
					packType: v.packType || v.packagingType || "other",
					receivingMode: variantOperations.receivingMode,
					weightKg: wKg,
					totalUnits,
					looseUnits,
					inCartonUnits,
					reservedUnits,
					availableUnits,
					activeCartonCount: item.activeCartonCount || 0,
				});
			}

			// 4. Apply filters
			let filtered = unitItems;

			if (input.categoryId) {
				filtered = filtered.filter((i) => i.categoryId === input.categoryId);
			}
			if (input.viewMode === "loose") {
				filtered = filtered.filter((i) => i.looseUnits > 0);
			} else if (input.viewMode === "in_carton") {
				filtered = filtered.filter((i) => i.inCartonUnits > 0);
			}
			if (input.search?.trim()) {
				const s = input.search.trim().toLowerCase();
				filtered = filtered.filter(
					(i) =>
						i.productName.toLowerCase().includes(s) ||
						i.brandName.toLowerCase().includes(s) ||
						i.variantLabel.toLowerCase().includes(s),
				);
			}

			// 5. Compute summary from filtered items
			const summary = {
				totalUnits: filtered.reduce((s, i) => s + i.totalUnits, 0),
				looseUnits: filtered.reduce((s, i) => s + i.looseUnits, 0),
				inCartonUnits: filtered.reduce((s, i) => s + i.inCartonUnits, 0),
			};

			// 6. Sort and paginate
			filtered.sort((a, b) => a.productName.localeCompare(b.productName));
			const totalCount = filtered.length;
			const totalPages = Math.ceil(totalCount / input.pageSize);
			const paginated = filtered.slice(
				(input.page - 1) * input.pageSize,
				input.page * input.pageSize,
			);

			// 7. Get carton breakdown for paginated variant IDs
			//    Shows BOTH physical cartons AND computed allocation from carton config
			const paginatedVariantIds = paginated.map((i) => i.variantId);
			const cartonBreakdownMap = new Map<
				number,
				Array<{
					configLabel: string;
					unitsPerCarton: number;
					cartonCount: number;
					totalUnits: number;
				}>
			>();

			if (paginatedVariantIds.length > 0) {
				// Get active physical cartons grouped by variant + config
				const cartonRows = await db
					.select({
						variantId: carton.variantId,
						configId: carton.cartonConfigId,
						configLabel: cartonConfig.label,
						packsPerCarton: cartonConfig.packsPerCarton,
						cartonCount: count(),
						totalPacks: sql<string>`SUM(${carton.totalPacks})`,
					})
					.from(carton)
					.leftJoin(cartonConfig, eq(carton.cartonConfigId, cartonConfig.id))
					.where(
						and(
							eq(carton.warehouseId, userId),
							eq(carton.status, "active"),
							inArray(carton.variantId, paginatedVariantIds),
						),
					)
					.groupBy(
						carton.variantId,
						carton.cartonConfigId,
						cartonConfig.label,
						cartonConfig.packsPerCarton,
					);

				for (const row of cartonRows) {
					if (!cartonBreakdownMap.has(row.variantId)) {
						cartonBreakdownMap.set(row.variantId, []);
					}
					cartonBreakdownMap.get(row.variantId)!.push({
						configLabel: row.configLabel || `${row.packsPerCarton} Pack Carton`,
						unitsPerCarton: row.packsPerCarton || 0,
						cartonCount: Number(row.cartonCount),
						totalUnits: parseFloat(row.totalPacks || "0"),
					});
				}

				// For variants with carton config but NO physical cartons,
				// compute theoretical carton allocation so the breakdown still shows
				for (const item of paginated) {
					if (cartonBreakdownMap.has(item.variantId)) continue; // already has physical cartons
					const cfg = cartonConfigLookup.get(item.variantId);
					if (!cfg || cfg.packsPerCarton <= 0 || item.totalUnits <= 0) continue;
					if (item.receivingMode === "loose") continue;

					const cartonCount = Math.floor(item.totalUnits / cfg.packsPerCarton);
					if (cartonCount > 0) {
						cartonBreakdownMap.set(item.variantId, [
							{
								configLabel: `${cfg.packsPerCarton} Pack Carton`,
								unitsPerCarton: cfg.packsPerCarton,
								cartonCount,
								totalUnits: cartonCount * cfg.packsPerCarton,
							},
						]);
					}
				}
			}

			// 8. Return items with carton breakdown
			const responseItems = paginated.map((item) => ({
				...item,
				cartonBreakdown: cartonBreakdownMap.get(item.variantId) || [],
			}));

			return {
				items: responseItems,
				summary,
				totalCount,
				page: input.page,
				pageSize: input.pageSize,
				totalPages,
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Expiry Tracking
// ────────────────────────────────────────────────────────────────

const expiryQueries = {
	/**
	 * Get expired / near-expiry stock batches for this warehouse.
	 * Only includes products where expiryEnabled = true.
	 */
	getExpiredProducts: warehouseProcedure
		.input(
			z.object({
				status: z
					.enum(["all", "expired", "nearExpiry", "tracked"])
					.default("all"),
				categoryId: z.number().optional(),
				supplierId: z.number().optional(),
				search: z.string().optional(),
				nearExpiryDays: z.number().default(30),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const today = new Date();
			const nearExpiryThreshold = new Date();
			nearExpiryThreshold.setDate(today.getDate() + input.nearExpiryDays);

			const entries = await db.query.stockEntry.findMany({
				where: and(
					eq(stockEntry.warehouseId, userId),
					sql`${stockEntry.expiryDate} IS NOT NULL`,
				),
				orderBy: [stockEntry.expiryDate],
				with: {
					variant: {
						with: {
							brand: { columns: { id: true, name: true } },
							product: {
								columns: {
									id: true,
									name: true,
									image: true,
									expiryEnabled: true,
									categoryId: true,
								},
								with: {
									category: { columns: { id: true, name: true, slug: true } },
									coreProduct: {
										columns: { id: true, name: true, image: true },
									},
								},
							},
						},
					},
					supplier: {
						columns: { id: true, name: true, company: true },
					},
					storageArea: {
						columns: { id: true, name: true },
					},
				},
			});

			const expiryEntries = entries.filter((entry) => {
				const product = entry.variant?.product;
				return product && product.expiryEnabled === true;
			});
			const expiryVariantIds = Array.from(
				new Set(expiryEntries.map((entry) => entry.variantId)),
			);
			const [inventoryRows, allReceiptRows] = expiryVariantIds.length
				? await Promise.all([
						db.query.inventory.findMany({
							where: and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, userId),
								inArray(inventory.variantId, expiryVariantIds),
							),
							columns: { variantId: true, availableQty: true },
						}),
						db
							.select()
							.from(stockEntry)
							.where(
								and(
									eq(stockEntry.warehouseId, userId),
									inArray(stockEntry.variantId, expiryVariantIds),
								),
							)
							.orderBy(desc(stockEntry.createdAt), desc(stockEntry.id)),
					])
				: [[], []];
			const { availableByStockEntry } = allocateCurrentStockLots(
				allReceiptRows,
				new Map(
					inventoryRows.map((row) => [row.variantId, Number(row.availableQty)]),
				),
			);

			type ExpiryStatus = "expired" | "nearExpiry" | "safe";

			type ExpiryItem = {
				stockEntryId: number;
				batchNo: string;
				expiryDate: string;
				manufactureDate: string | null;
				quantity: string;
				quantityUnit: string;
				convertedQtyPacks: string | null;
				purchasePrice: string;
				totalCost: string;
				entryType: string;
				reference: string | null;
				note: string | null;
				shelfRack: string | null;
				createdAt: Date;
				productId: number;
				productName: string;
				productImage: string;
				coreProductName: string;
				coreProductImage: string;
				categoryId: number;
				categoryName: string;
				variantId: number;
				variantLabel: string;
				brandName: string;
				supplierId: number | null;
				supplierName: string;
				storageAreaName: string | null;
				expiryStatus: ExpiryStatus;
				daysUntilExpiry: number;
				lossValue: string;
			};

			const items: ExpiryItem[] = [];

			for (const entry of expiryEntries) {
				const variant = entry.variant;
				if (!variant || !variant.product) continue;
				const remainingQuantity = availableByStockEntry.get(entry.id) ?? 0;
				if (remainingQuantity <= 0) continue;
				const remainingValue =
					remainingQuantity * unitCostFromStockEntry(entry);

				const product = variant.product;
				const expiryDate = new Date(entry.expiryDate!);
				const diffMs = expiryDate.getTime() - today.getTime();
				const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

				let expiryStatus: ExpiryStatus;
				if (daysUntilExpiry < 0) {
					expiryStatus = "expired";
				} else if (expiryDate <= nearExpiryThreshold) {
					expiryStatus = "nearExpiry";
				} else {
					expiryStatus = "safe";
				}

				const labelParts: string[] = [];
				const brandName = variant.brand?.name || "";
				if (brandName) labelParts.push(brandName);
				const weightKg = Number(variant.weightKg || 0);
				if (weightKg > 0) labelParts.push(`${weightKg}KG`);
				if (variant.packagingType && variant.packagingType !== "loose") {
					labelParts.push(
						variant.packagingType.charAt(0).toUpperCase() +
							variant.packagingType.slice(1),
					);
				}
				const variantLabel =
					labelParts.length > 0
						? labelParts.join(" + ")
						: variant.unitLabel || `Variant #${variant.id}`;

				const coreProduct = (product as any).coreProduct;

				items.push({
					stockEntryId: entry.id,
					batchNo: entry.batchNo || `B-${entry.id}`,
					expiryDate: entry.expiryDate!,
					manufactureDate: entry.manufactureDate || null,
					quantity: remainingQuantity.toFixed(2),
					quantityUnit: entry.inventoryUnit,
					convertedQtyPacks: entry.convertedQtyPacks,
					purchasePrice: unitCostFromStockEntry(entry).toFixed(2),
					totalCost: remainingValue.toFixed(2),
					entryType: entry.entryType,
					reference: entry.reference || null,
					note: entry.note || null,
					shelfRack: entry.shelfRack || null,
					createdAt: entry.createdAt,
					productId: product.id,
					productName: product.name,
					productImage: product.image || "",
					coreProductName: coreProduct?.name || product.name,
					coreProductImage: coreProduct?.image || product.image || "",
					categoryId: product.categoryId,
					categoryName: product.category?.name || "—",
					variantId: variant.id,
					variantLabel,
					brandName,
					supplierId: entry.supplierId,
					supplierName: entry.supplier?.name || entry.supplier?.company || "—",
					storageAreaName: entry.storageArea?.name || null,
					expiryStatus,
					daysUntilExpiry,
					lossValue:
						expiryStatus === "expired" ? remainingValue.toFixed(2) : "0",
				});
			}

			let filtered = items;

			if (input.status === "expired") {
				filtered = filtered.filter((item) => item.expiryStatus === "expired");
			} else if (input.status === "nearExpiry") {
				filtered = filtered.filter(
					(item) => item.expiryStatus === "nearExpiry",
				);
			} else if (input.status === "all") {
				filtered = filtered.filter((item) => item.expiryStatus !== "safe");
			}

			if (input.categoryId) {
				filtered = filtered.filter(
					(item) => item.categoryId === input.categoryId,
				);
			}
			if (input.supplierId) {
				filtered = filtered.filter(
					(item) => item.supplierId === input.supplierId,
				);
			}
			if (input.search?.trim()) {
				const searchTerm = input.search.trim().toLowerCase();
				filtered = filtered.filter(
					(item) =>
						item.productName.toLowerCase().includes(searchTerm) ||
						item.coreProductName.toLowerCase().includes(searchTerm) ||
						item.brandName.toLowerCase().includes(searchTerm) ||
						item.batchNo.toLowerCase().includes(searchTerm) ||
						item.variantLabel.toLowerCase().includes(searchTerm),
				);
			}

			filtered.sort((left, right) => {
				if (left.expiryStatus === "expired" && right.expiryStatus !== "expired")
					return -1;
				if (left.expiryStatus !== "expired" && right.expiryStatus === "expired")
					return 1;
				return left.daysUntilExpiry - right.daysUntilExpiry;
			});

			const totalExpiredBatches = filtered.filter(
				(item) => item.expiryStatus === "expired",
			).length;
			const totalNearExpiryBatches = filtered.filter(
				(item) => item.expiryStatus === "nearExpiry",
			).length;
			const totalExpiredQty = filtered
				.filter((item) => item.expiryStatus === "expired")
				.reduce((sumValue, item) => sumValue + Number(item.quantity), 0);
			const totalLossValue = filtered
				.filter((item) => item.expiryStatus === "expired")
				.reduce((sumValue, item) => sumValue + Number(item.totalCost), 0);
			const totalNearExpiryQty = filtered
				.filter((item) => item.expiryStatus === "nearExpiry")
				.reduce((sumValue, item) => sumValue + Number(item.quantity), 0);

			const categoryMap = new Map<
				string,
				{
					name: string;
					expiredQty: number;
					nearExpiryQty: number;
					lossValue: number;
				}
			>();
			for (const item of filtered) {
				const existing = categoryMap.get(item.categoryName) || {
					name: item.categoryName,
					expiredQty: 0,
					nearExpiryQty: 0,
					lossValue: 0,
				};

				if (item.expiryStatus === "expired") {
					existing.expiredQty += Number(item.quantity);
					existing.lossValue += Number(item.totalCost);
				} else if (item.expiryStatus === "nearExpiry") {
					existing.nearExpiryQty += Number(item.quantity);
				}

				categoryMap.set(item.categoryName, existing);
			}

			const categoryOptions = new Map<number, string>();
			const supplierOptions = new Map<number, string>();
			for (const item of items) {
				categoryOptions.set(item.categoryId, item.categoryName);
				if (item.supplierId !== null) {
					supplierOptions.set(item.supplierId, item.supplierName);
				}
			}

			const alerts = filtered
				.filter(
					(item) =>
						item.expiryStatus === "expired" && Number(item.quantity) > 0,
				)
				.slice(0, 5)
				.map((item) => ({
					productName: item.coreProductName,
					variantLabel: item.variantLabel,
					quantity: item.quantity,
					quantityUnit: item.quantityUnit,
					daysExpired: Math.abs(item.daysUntilExpiry),
					lossValue: item.totalCost,
				}));

			const urgentNearExpiry = filtered
				.filter(
					(item) =>
						item.expiryStatus === "nearExpiry" && item.daysUntilExpiry <= 7,
				)
				.slice(0, 5)
				.map((item) => ({
					productName: item.coreProductName,
					variantLabel: item.variantLabel,
					quantity: item.quantity,
					quantityUnit: item.quantityUnit,
					daysUntilExpiry: item.daysUntilExpiry,
				}));

			return {
				items: filtered,
				stats: {
					totalTrackedBatches: filtered.length,
					totalExpiredBatches,
					totalNearExpiryBatches,
					totalExpiredQty,
					totalNearExpiryQty,
					totalLossValue,
				},
				categoryAnalytics: Array.from(categoryMap.values()).sort(
					(left, right) =>
						right.expiredQty +
						right.nearExpiryQty -
						(left.expiredQty + left.nearExpiryQty),
				),
				alerts: {
					expired: alerts,
					nearExpiry: urgentNearExpiry,
				},
				filterOptions: {
					categories: Array.from(categoryOptions.entries())
						.map(([id, name]) => ({ id, name }))
						.sort((left, right) => left.name.localeCompare(right.name)),
					suppliers: Array.from(supplierOptions.entries())
						.map(([id, name]) => ({ id, name }))
						.sort((left, right) => left.name.localeCompare(right.name)),
				},
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Export combined router
// ────────────────────────────────────────────────────────────────

export const warehouseRouter = {
	...storefrontQueries,
	...storeConnectionQueries,
	...warehouseSupplierConnectionQueries,
	...managementQueries,
	...orderQueries,
	...variantQueries,
	...supplierQueries,
	...purchaseQueries,
	...productActivation,
	...catalogBrowse,
	...productRequests,
	...warehouseProductCreation,
	...stockEntryQueries,
	...storageAreaQueries,
	...pricingQueries,
	...cartonQueries,
	...expiryQueries,
};
