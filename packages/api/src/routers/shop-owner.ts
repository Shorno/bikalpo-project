/**
 * Shop Owner ORPC Router
 *
 * Contains queries for the shop owner's B2B view (buying wholesale from Admin)
 * and B2C management view (managing their retail catalog).
 *
 * - TRADE variants only for product browsing (B2B buying)
 * - RETAIL variants for shop management (what they sell to consumers)
 * - Inventory and pricing management
 */

import { auth, setCredentialPassword } from "@bikalpo-project/auth";
import { db } from "@bikalpo-project/db";
import { countAddableBrands } from "@bikalpo-project/db/brand-creation";
import {
	buildProductTypeFulfillmentProfile,
	FULFILLMENT_MODE_LABELS,
	FULFILLMENT_MODES,
} from "@bikalpo-project/db/fulfillment";
import {
	area,
	brand,
	carton,
	cartonConfig,
	category,
	complaint,
	checkoutPromotion,
	checkoutPromotionRedemption,
	coreProductIdentity,
	customerAssignment,
	damageEntry,
	damageEntryItem,
	deliveryArea,
	deliveryGroup,
	deliveryGroupInvoice,
	deliverySchedule,
	emptyPack,
	financialLedger,
	inventory,
	invoice,
	openOrderBid,
	openOrderBidItem,
	order,
	orderItem,
	payment,
	product,
	productIdentityRequest,
	productPackRule,
	productReview,
	productType,
	productVariant,
	purchase,
	sellerAreaMapping,
	shopCategoryAssignment,
	shopWarehouseConnection,
	stockAdjustment,
	stockAdjustmentItem,
	subCategory,
	supplier,
	user,
	variantOption,
	warehouseApplication,
} from "@bikalpo-project/db/schema";
import {
	formatVariantStockQuantity,
	resolveVariantOperations,
	resolveVariantStockSemantics,
} from "@bikalpo-project/db/variant-definition";
import { ORPCError } from "@orpc/server";
import {
	and,
	asc,
	avg,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lte,
	min,
	or,
	type SQL,
	sql,
	sum,
} from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, shopOwnerProcedure } from "../index";
import { assertCheckoutPaymentSelectionAllowed } from "../services/checkout-domain";
import { assertCheckoutQuoteMatches } from "../services/checkout-quote";
import { resolveRetailerOfferLinePrice } from "../services/open-order-domain";
import {
	appendOrderPurchaseEvent,
	recordPurchaseSubmission,
} from "../services/purchase-history";
import { recognizePlatformPurchaseReceipt } from "../services/purchase-receipt";
import {
	buildWholesaleCheckoutQuote,
	getWholesalePaymentDueAt,
	wholesaleCheckoutSubmissionSchema,
} from "../services/wholesale-checkout";
import {
	recalculateOffersForInventory,
	reconcileOpenOrder,
	submitRetailerOffer,
	withdrawRetailerOffer,
} from "../services/open-order-matching";
import { ensureShopBuyerTargetVariant } from "./helpers/b2b-buyer-target";
import { convertB2bOrderToRetailInventory } from "./helpers/b2b-conversion";
import {
	prepareB2bMovementForApproval,
	releaseB2bOrderReservations,
} from "./helpers/b2b-inventory-movement";
import { configureExistingInvoiceFulfillmentForOwner } from "./helpers/order-dispatch";
import { buildCanonicalOrderFlow } from "./helpers/order-lifecycle";
import {
	getRetailerDispatchQueryStatuses,
	getRetailerDispatchQueueStatus,
	getRetailerOrderTransition,
} from "./helpers/retailer-consumer-flow";
import {
	getRetailerHandoffOtps,
	getRetailerOrderDisplayStatus,
} from "./helpers/retailer-delivery-handoff";
import { createRetailerDispatchInvoiceForOrder } from "./helpers/retailer-dispatch";
import {
	createRetailerOrderStockWriter,
	RetailerOrderStockError,
	restoreRetailerOrderStock,
} from "./helpers/retailer-order-stock";
import { completeSelfPickupInvoice } from "./helpers/self-pickup";
import { loadStructuredBrandStockRows } from "./helpers/structured-stock-data";
import {
	buildStructuredStockDetail,
	buildStructuredStockOverview,
	type StructuredBrandStockSourceRow,
	type StructuredStockVariant,
} from "./helpers/structured-stock-overview";
import { resolveWarehouseOrderMode } from "./helpers/warehouse-order-fulfillment";
import { shopProductConfigEndpoints } from "./shop-product-config";

const purchaseOrderStatusValues = [
	"pending",
	"approved",
	"ready_for_dispatch",
	"partially_invoiced",
	"invoiced",
	"confirmed",
	"processing",
	"delivered",
	"returned",
	"cancelled",
] as const;

function getPurchaseOrderStatusCondition(
	status: (typeof purchaseOrderStatusValues)[number],
): SQL {
	if (status === "approved") {
		return inArray(order.status, ["approved", "confirmed"]);
	}

	return eq(order.status, status);
}

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

const PAID_INVOICE_STATUSES = new Set(["collected", "settled"]);
const NON_PURCHASE_ORDER_STATUSES = new Set(["cancelled", "returned"]);
const PAYABLE_ORDER_STATUSES = new Set([
	"confirmed",
	"processing",
	"delivered",
]);
const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

const warehouseOrderModeSchema = z.enum(FULFILLMENT_MODES);

function toSafeNumber(value: string | number | null | undefined) {
	return Number(value || 0);
}

function isOrderPaid(
	orderPaymentStatus: string | null | undefined,
	invoicePaymentStatus: string | null | undefined,
) {
	return (
		orderPaymentStatus === "paid" ||
		PAID_INVOICE_STATUSES.has(invoicePaymentStatus || "")
	);
}

function isPurchaseOrderStatus(status: string | null | undefined) {
	return !NON_PURCHASE_ORDER_STATUSES.has(status || "");
}

function getFulfillmentModeLabel(mode?: string | null) {
	return (
		(mode &&
			mode in FULFILLMENT_MODE_LABELS &&
			FULFILLMENT_MODE_LABELS[mode as keyof typeof FULFILLMENT_MODE_LABELS]) ||
		"Legacy"
	);
}

function enrichPurchaseOrderItemsFulfillment<
	TItem extends { supplyMode?: string | null },
>(items: TItem[] | null | undefined) {
	return (items || []).map((item) => ({
		...item,
		supplyModeLabel: getFulfillmentModeLabel(item.supplyMode),
	}));
}

function isPayableOrder(
	status: string | null | undefined,
	orderPaymentStatus: string | null | undefined,
	invoicePaymentStatus: string | null | undefined,
) {
	return (
		PAYABLE_ORDER_STATUSES.has(status || "") &&
		!isOrderPaid(orderPaymentStatus, invoicePaymentStatus)
	);
}

function normalizeDeliveryText(value: string | null | undefined) {
	return (value || "")
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function findNextDeliveryDate(days: number[], today = new Date()) {
	if (days.length === 0) return null;

	const currentDay = today.getDay();
	const uniqueDays = [...new Set(days)].sort((a, b) => a - b);
	const offsets = uniqueDays.map((dayOfWeek) => {
		let offset = (dayOfWeek - currentDay + 7) % 7;
		if (offset === 0) offset = 7;
		return { dayOfWeek, offset };
	});
	const next = offsets.sort((a, b) => a.offset - b.offset)[0];
	if (!next) return null;

	const nextDate = new Date(today);
	nextDate.setDate(today.getDate() + next.offset);

	return {
		dayOfWeek: next.dayOfWeek,
		dayName: DAY_NAMES[next.dayOfWeek] || "Unknown",
		date: nextDate.toISOString(),
		offsetDays: next.offset,
	};
}

const CONNECTED_SUPPLIER_ACTIVE_WINDOW_DAYS = 45;

function getConnectedSupplierActivityStatus(
	lastOrderDate: Date | null | undefined,
	connectedAt: Date | null | undefined,
	pendingOrders = 0,
) {
	if (pendingOrders > 0) {
		return "active" as const;
	}

	const referenceDate = lastOrderDate || connectedAt;
	if (!referenceDate) {
		return "inactive" as const;
	}

	const diffMs = Date.now() - referenceDate.getTime();
	const activeWindowMs =
		CONNECTED_SUPPLIER_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

	return diffMs <= activeWindowMs ? ("active" as const) : ("inactive" as const);
}

// ────────────────────────────────────────────────────────────────
// B2B Queries (Shop Owner as Buyer — TRADE variants)
// ────────────────────────────────────────────────────────────────

const b2bQueries = {
	/**
	 * Get products for shop owner wholesale browsing.
	 * Same as customer.getCustomerProducts but products only shown
	 * if they have TRADE variants visible to shop_owner.
	 */
	getProducts: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/products",
			tags: ["Shop Owner"],
			summary: "Get wholesale products for shop owner (TRADE variants)",
		})
		.input(productFiltersSchema)
		.handler(async ({ input }) => {
			const {
				category: categorySlug,
				subcategory,
				brand: brandSlug,
				minPrice,
				maxPrice,
				inStock: inStockStr,
				search,
				sort = "newest",
				page: pageStr = "1",
				limit: limitStr = "12",
			} = input;

			const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
			const limit = Math.min(
				50,
				Math.max(1, parseInt(limitStr ?? "12", 10) || 12),
			);
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [eq(product.status, "active")];

			// Category filter
			if (categorySlug) {
				const cat = await db.query.category.findFirst({
					where: eq(category.slug, categorySlug),
				});
				if (cat) {
					conditions.push(eq(product.categoryId, cat.id));
				} else {
					return {
						products: [],
						pagination: {
							page,
							limit,
							totalCount: 0,
							totalPages: 0,
						},
					};
				}
			}

			// Subcategory filter
			if (subcategory) {
				const slugs = subcategory.split(",").filter(Boolean);
				const subs = await db.query.subCategory.findMany({
					where: inArray(subCategory.slug, slugs),
				});
				if (subs.length > 0) {
					conditions.push(
						inArray(
							product.subCategoryId,
							subs.map((s) => s.id),
						),
					);
				}
			}

			// Brand filter — product-level brand
			if (brandSlug) {
				const b = await db.query.brand.findFirst({
					where: eq(brand.slug, brandSlug),
				});
				if (b) {
					conditions.push(eq(product.brandId, b.id));
				} else {
					return {
						products: [],
						pagination: {
							page,
							limit,
							totalCount: 0,
							totalPages: 0,
						},
					};
				}
			}

			// Price filter (on product base price)
			if (minPrice) conditions.push(gte(product.price, minPrice));
			if (maxPrice) conditions.push(lte(product.price, maxPrice));

			// In stock filter
			const inStock = inStockStr === "true";
			if (inStock) conditions.push(eq(product.inStock, true));

			// Search
			if (search) conditions.push(ilike(product.name, `%${search}%`));

			const whereClause =
				conditions.length > 0 ? and(...conditions) : undefined;

			// Sort
			const getOrderBy = () => {
				switch (sort) {
					case "price_asc":
						return [asc(product.price)];
					case "price_desc":
						return [desc(product.price)];
					case "oldest":
						return [asc(product.createdAt)];
					case "popular":
						return [desc(product.createdAt)];
					case "newest":
					default:
						return [desc(product.createdAt)];
				}
			};

			const [products, countResult] = await Promise.all([
				db.query.product.findMany({
					where: whereClause,
					with: {
						category: { columns: { slug: true, name: true } },
						subCategory: { columns: { name: true } },
						images: true,
					},
					orderBy: getOrderBy(),
					limit,
					offset,
				}),
				db.select({ count: count() }).from(product).where(whereClause),
			]);

			const totalCount = countResult[0]?.count || 0;
			const productIds = products.map((item) => item.id);

			const startingPriceMap: Record<number, number> = {};
			if (productIds.length > 0) {
				const priceRows = await db
					.select({
						productId: productVariant.productId,
						minPrice: min(productVariant.price),
					})
					.from(productVariant)
					.where(
						and(
							inArray(productVariant.productId, productIds),
							eq(productVariant.isActive, true),
							or(
								eq(productVariant.variantType, "trade"),
								and(
									sql`${productVariant.variantType} IS NULL`,
									or(
										eq(productVariant.visibilityRole, "shop_owner"),
										eq(productVariant.visibilityRole, "all"),
										sql`${productVariant.visibilityRole} IS NULL`,
									),
								),
							),
						),
					)
					.groupBy(productVariant.productId);

				for (const row of priceRows) {
					startingPriceMap[row.productId] = row.minPrice
						? parseFloat(row.minPrice)
						: 0;
				}
			}

			const serializedProducts = products.map((item) => {
				const basePrice = Number(item.price);
				const variantPrice = startingPriceMap[item.id] ?? 0;

				return {
					...item,
					price:
						variantPrice > 0
							? variantPrice
							: Number.isFinite(basePrice)
								? basePrice
								: 0,
				};
			});

			return {
				products: serializedProducts,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(Number(totalCount) / limit),
				},
			};
		}),

	/**
	 * Get product details with TRADE variants only (for shop owner B2B buying).
	 */
	getProductDetails: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/products/{slug}",
			tags: ["Shop Owner"],
			summary: "Get product details with TRADE variants only",
		})
		.input(z.object({ slug: z.string() }))
		.handler(async ({ input }) => {
			const found = await db.query.product.findFirst({
				where: eq(product.slug, input.slug),
				with: {
					category: { columns: { name: true, slug: true } },
					subCategory: { columns: { name: true } },
					images: true,
				},
			});
			if (!found)
				throw new ORPCError("NOT_FOUND", {
					message: "Product not found",
				});

			// Get only TRADE variants visible to shop_owner
			const variants = await db.query.productVariant.findMany({
				where: and(
					eq(productVariant.productId, found.id),
					eq(productVariant.isActive, true),
					or(
						eq(productVariant.variantType, "trade"),
						// Include variants without type set (legacy) if visible to shop_owner
						and(
							sql`${productVariant.variantType} IS NULL`,
							or(
								eq(productVariant.visibilityRole, "shop_owner"),
								eq(productVariant.visibilityRole, "all"),
								sql`${productVariant.visibilityRole} IS NULL`,
							),
						),
					),
				),
				orderBy: [asc(productVariant.sortOrder)],
			});

			// Get review stats
			const reviewStats = await db
				.select({
					averageRating: avg(productReview.rating),
					totalReviews: count(productReview.id),
				})
				.from(productReview)
				.where(eq(productReview.productId, found.id));

			return {
				product: found,
				variants,
				reviewStats: {
					averageRating: reviewStats[0]?.averageRating
						? parseFloat(reviewStats[0].averageRating)
						: 0,
					totalReviews: reviewStats[0]?.totalReviews || 0,
				},
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Management Queries (Shop Owner as Seller — RETAIL variants)
// ────────────────────────────────────────────────────────────────

const managementQueries = {
	/**
	 * Aggregated Stock Overview KPIs for the shop dashboard.
	 * Returns all metrics in a single call to avoid multiple round-trips.
	 */
	getStockOverview: shopOwnerProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		// 1. Fetch all inventory for this shop with variant + product + category + brand
		const shopInventory = await db.query.inventory.findMany({
			where: and(
				eq(inventory.ownerType, "shop"),
				eq(inventory.ownerId, userId),
			),
			with: {
				variant: {
					with: {
						catalogVariant: {
							columns: { id: true, globalSku: true },
						},
						product: {
							with: {
								category: { columns: { id: true, name: true } },
							},
						},
						brand: { columns: { id: true, name: true } },
						sourceVariantOption: true,
					},
				},
			},
		});

		// 2. Aggregate metrics
		const LOW_STOCK_THRESHOLD = 5;
		const AT_RISK_THRESHOLD = 2;

		let totalSKUs = 0;
		let inStockCount = 0;
		let lowStockCount = 0;
		let outOfStockCount = 0;
		let totalStockValue = 0;
		let atRiskCount = 0;

		const productSet = new Set<number>();
		const categoryMap = new Map<string, { variantCount: number }>();
		const productStockMap = new Map<
			number,
			{
				name: string;
				totalQty: number;
				stockLines: string[];
				image: string | null;
			}
		>();

		for (const inv of shopInventory) {
			if (!inv.variant?.product || !inv.variant.sourceVariantOption) continue;
			let semantics;
			try {
				semantics = resolveVariantStockSemantics(
					inv.variant.sourceVariantOption,
				);
			} catch {
				continue;
			}

			totalSKUs++;
			const qty = parseFloat(inv.availableQty || "0");
			const retailPrice = parseFloat(inv.retailPrice || "0");
			const variantPrice = parseFloat(inv.variant.price || "0");
			const effectivePrice = retailPrice > 0 ? retailPrice : variantPrice;

			totalStockValue += qty * effectivePrice;
			productSet.add(inv.variant.product.id);

			// Stock status
			if (qty <= 0) outOfStockCount++;
			else if (qty <= LOW_STOCK_THRESHOLD) lowStockCount++;
			else inStockCount++;

			// At risk
			if (qty > 0 && qty <= AT_RISK_THRESHOLD) atRiskCount++;

			// Category snapshot
			const catName = inv.variant.product.category?.name || "Uncategorized";
			const existing = categoryMap.get(catName);
			if (existing) {
				existing.variantCount += 1;
			} else {
				categoryMap.set(catName, { variantCount: 1 });
			}

			// Product stock aggregation for top products
			const pid = inv.variant.product.id;
			const pEntry = productStockMap.get(pid);
			if (pEntry) {
				pEntry.totalQty += qty;
				pEntry.stockLines.push(formatVariantStockQuantity(semantics, qty));
			} else {
				productStockMap.set(pid, {
					name: inv.variant.product.name,
					totalQty: qty,
					stockLines: [formatVariantStockQuantity(semantics, qty)],
					image: inv.variant.product.image,
				});
			}
		}

		// 3. Category snapshot — top 6 categories
		const categorySnapshot = Array.from(categoryMap.entries())
			.map(([name, data]) => ({
				categoryName: name,
				totalQty: data.variantCount,
				unit: "variant SKUs",
			}))
			.sort((a, b) => b.totalQty - a.totalQty)
			.slice(0, 6);

		// 4. Top products — top 5 by stock qty
		const topProducts = Array.from(productStockMap.values())
			.sort((a, b) => b.totalQty - a.totalQty)
			.slice(0, 5)
			.map((p) => ({
				productName: p.name,
				totalQty: Math.round(p.totalQty * 100) / 100,
				unit: "",
				stockDisplay: p.stockLines.join(" + "),
				image: p.image,
				status:
					p.totalQty > 20
						? ("high" as const)
						: p.totalQty > 5
							? ("available" as const)
							: ("low" as const),
			}));

		// 5. Damage alert — count active damage entries in last 30 days
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const [damageResult] = await db
			.select({ count: count() })
			.from(damageEntry)
			.where(
				and(
					eq(damageEntry.shopId, userId),
					eq(damageEntry.status, "active"),
					gte(damageEntry.createdAt, thirtyDaysAgo),
				),
			);

		return {
			// Main KPIs
			totalProducts: productSet.size,
			totalSKUs,
			totalStockValue: Math.round(totalStockValue * 100) / 100,

			// Stock Status
			inStockCount,
			lowStockCount,
			outOfStockCount,

			// Category Snapshot
			categorySnapshot,

			// Alert Summary
			alerts: {
				lowStock: lowStockCount,
				expiringSoon: 0, // No expiry field yet
				damaged: damageResult?.count ?? 0,
			},

			// Top Products
			topProducts,

			// Insights
			insights: {
				fastMoving: null as string | null, // Needs sales data
				slowMoving: null as string | null, // Needs sales data
				atRiskCount,
			},
		};
	}),

	/**
	 * Real-time stock view grouped by product.
	 * Shows pack (carton-packed) vs loose breakdown at product level,
	 * with variant-level detail for the expanded view.
	 */
	getRealtimeStock: shopOwnerProcedure
		.input(
			z.object({
				search: z.string().optional(),
				categoryId: z.number().int().optional(),
				status: z
					.enum(["all", "in_stock", "low", "out_of_stock"])
					.default("all"),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Fetch all inventory for this shop
			const shopInventory = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
				),
				with: {
					variant: {
						with: {
							product: {
								with: {
									category: {
										columns: { id: true, name: true },
									},
								},
							},
							brand: { columns: { id: true, name: true } },
							sourceVariantOption: true,
						},
					},
				},
			});

			// 2. Group by product
			const LOW_STOCK_THRESHOLD = 5;

			type VariantDetail = {
				variantId: number;
				inventoryId: number;
				sku: string | null;
				brandName: string | null;
				unitLabel: string;
				operationalUnit: string;
				stockDisplay: string;
				packType: string | null;
				pcsPerPack: number;
				availableQty: number;
				inCartonQty: number;
				looseQty: number;
				retailPrice: number;
				measurementDimension: "mass" | "volume" | "count";
				measurementUnit: "KG" | "L" | null;
				massKgPerUnit: number;
				volumeLPerUnit: number;
			};

			type ProductGroup = {
				productId: number;
				productName: string;
				productImage: string | null;
				sku: string | null;
				categoryId: number | null;
				categoryName: string | null;
				variants: VariantDetail[];
			};

			const productMap = new Map<number, ProductGroup>();

			for (const inv of shopInventory) {
				if (!inv.variant?.product || !inv.variant.sourceVariantOption) continue;
				let semantics;
				try {
					semantics = resolveVariantStockSemantics(
						inv.variant.sourceVariantOption,
					);
				} catch {
					continue;
				}

				const prod = inv.variant.product;
				const pid = prod.id;
				const qty = parseFloat(inv.availableQty || "0");
				const cartonQty = parseFloat(inv.inCartonQty || "0");
				const isLoose = semantics.entryType === "loose";
				const retailPrice =
					parseFloat(inv.retailPrice || "0") ||
					parseFloat(inv.variant.price || "0");

				if (!productMap.has(pid)) {
					productMap.set(pid, {
						productId: pid,
						productName: prod.name,
						productImage: prod.image,
						sku: prod.sku,
						categoryId: prod.category?.id ?? null,
						categoryName: prod.category?.name ?? null,
						variants: [],
					});
				}

				const group = productMap.get(pid)!;
				group.variants.push({
					variantId: inv.variant.id,
					inventoryId: inv.id,
					sku: inv.variant.sku,
					brandName: inv.variant.brand?.name ?? null,
					unitLabel: semantics.displayLabel,
					packType: semantics.packType,
					pcsPerPack: Number(inv.variant.packCountInside || 0),
					availableQty: qty,
					inCartonQty: cartonQty,
					looseQty: isLoose ? qty : Math.max(0, qty - cartonQty),
					retailPrice,
					stockDisplay: formatVariantStockQuantity(semantics, qty),
					operationalUnit: semantics.operationalUnit,
					measurementDimension: semantics.measurementDimension,
					measurementUnit: semantics.measurementUnit,
					massKgPerUnit: semantics.massKgPerUnit,
					volumeLPerUnit: semantics.volumeLPerUnit,
				});
			}

			// 3. Convert to array, apply filters
			let products = Array.from(productMap.values());

			// Search filter
			if (input.search?.trim()) {
				const s = input.search.toLowerCase();
				products = products.filter(
					(p) =>
						p.productName.toLowerCase().includes(s) ||
						(p.sku && p.sku.toLowerCase().includes(s)) ||
						p.variants.some((v) => v.sku?.toLowerCase().includes(s)) ||
						p.variants.some((v) => v.brandName?.toLowerCase().includes(s)),
				);
			}

			// Category filter
			if (input.categoryId) {
				products = products.filter((p) => p.categoryId === input.categoryId);
			}

			// Status filter
			const withStatus = products.map((p) => {
				const quantities = p.variants.map((variant) => variant.availableQty);
				const status: "in_stock" | "low" | "out_of_stock" = quantities.every(
					(quantity) => quantity <= 0,
				)
					? "out_of_stock"
					: quantities.some((quantity) => quantity <= LOW_STOCK_THRESHOLD)
						? "low"
						: "in_stock";
				return { ...p, status };
			});

			const filtered =
				input.status === "all"
					? withStatus
					: withStatus.filter((p) => p.status === input.status);

			// 4. Derive unique categories for filter dropdown
			const categorySet = new Map<number, string>();
			for (const p of Array.from(productMap.values())) {
				if (p.categoryId && p.categoryName) {
					categorySet.set(p.categoryId, p.categoryName);
				}
			}

			return {
				products: filtered.sort((a, b) =>
					a.productName.localeCompare(b.productName),
				),
				categories: Array.from(categorySet.entries()).map(([id, name]) => ({
					id,
					name,
				})),
				totalCount: filtered.length,
			};
		}),

	/**
	 * Low stock products — only products with variants below their reorderLevel.
	 * Classifies as "low" or "critical" (≤ 50% of threshold).
	 */
	getLowStockProducts: shopOwnerProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const DEFAULT_THRESHOLD = 5;

		// Fetch inventory with variant + product + brand
		const shopInventory = await db.query.inventory.findMany({
			where: and(
				eq(inventory.ownerType, "shop"),
				eq(inventory.ownerId, userId),
			),
			with: {
				variant: {
					with: {
						product: {
							with: {
								category: { columns: { id: true, name: true } },
							},
						},
						brand: { columns: { id: true, name: true } },
						sourceVariantOption: true,
					},
				},
			},
		});

		// Classify each variant
		type VariantInfo = {
			variantId: number;
			brandName: string | null;
			unitLabel: string;
			operationalUnit: string;
			stockDisplay: string;
			availableQty: number;
			inCartonQty: number;
			looseQty: number;
			reorderLevel: number;
			status: "ok" | "low" | "critical" | "out_of_stock";
		};

		type ProductLow = {
			productId: number;
			productName: string;
			productImage: string | null;
			sku: string | null;
			issueLabel: string;
			status: "low" | "critical";
			variants: VariantInfo[];
			minimumLevels: { label: string; minimum: number; unit: string }[];
			alertReasons: string[];
		};

		const productMap = new Map<number, ProductLow>();
		let criticalItems = 0;
		let shortageVariants = 0;

		for (const inv of shopInventory) {
			if (
				!inv.variant?.product ||
				!inv.variant.sourceVariantOption ||
				!inv.variant.isActive
			)
				continue;
			let semantics;
			try {
				semantics = resolveVariantStockSemantics(
					inv.variant.sourceVariantOption,
				);
			} catch {
				continue;
			}

			const prod = inv.variant.product;
			const pid = prod.id;
			const qty = parseFloat(inv.availableQty || "0");
			const cartonQty = parseFloat(inv.inCartonQty || "0");
			const threshold =
				inv.variant.reorderLevel > 0
					? inv.variant.reorderLevel
					: prod.reorderLevel > 0
						? prod.reorderLevel
						: DEFAULT_THRESHOLD;

			// Classify variant
			let variantStatus: "ok" | "low" | "critical" | "out_of_stock";
			if (qty <= 0) variantStatus = "out_of_stock";
			else if (qty <= threshold * 0.5) variantStatus = "critical";
			else if (qty <= threshold) variantStatus = "low";
			else variantStatus = "ok";

			// Skip healthy variants for the low stock page aggregation
			const isLow = variantStatus !== "ok";

			const variantInfo: VariantInfo = {
				variantId: inv.variant.id,
				brandName: inv.variant.brand?.name ?? null,
				unitLabel: semantics.displayLabel,
				operationalUnit: semantics.operationalUnit,
				stockDisplay: formatVariantStockQuantity(semantics, qty),
				availableQty: qty,
				inCartonQty: cartonQty,
				looseQty: Math.max(0, qty - cartonQty),
				reorderLevel: threshold,
				status: variantStatus,
			};

			// Track KPI metrics for low/critical variants
			if (isLow) {
				if (variantStatus === "critical") criticalItems++;
				shortageVariants++;
			}

			// Group by product — include all variants for expanded detail
			if (!productMap.has(pid)) {
				productMap.set(pid, {
					productId: pid,
					productName: prod.name,
					productImage: prod.image,
					sku: prod.sku,
					issueLabel: "",
					status: "low",
					variants: [],
					minimumLevels: [],
					alertReasons: [],
				});
			}

			const group = productMap.get(pid)!;
			group.variants.push(variantInfo);

			// Build minimum level config
			group.minimumLevels.push({
				label: semantics.displayLabel,
				minimum: threshold,
				unit: semantics.operationalUnit,
			});

			// Track alert reasons for low variants
			if (isLow) {
				const reason = `${semantics.displayLabel} ${variantStatus === "critical" ? "Critical" : "Low"}`;
				group.alertReasons.push(reason);
			}
		}

		// Filter to only products that have at least 1 low/critical variant
		const lowProducts: ProductLow[] = [];

		for (const group of productMap.values()) {
			const hasLowVariant = group.variants.some(
				(v) =>
					v.status === "low" ||
					v.status === "critical" ||
					v.status === "out_of_stock",
			);
			if (!hasLowVariant) continue;

			// Determine product-level status and issue label
			const hasCritical = group.variants.some(
				(v) => v.status === "critical" || v.status === "out_of_stock",
			);
			group.status = hasCritical ? "critical" : "low";

			// Build issue label from the most urgent variant
			const worstVariant = group.variants
				.filter((v) => v.status !== "ok")
				.sort((a, b) => {
					const order = {
						out_of_stock: 0,
						critical: 1,
						low: 2,
						ok: 3,
					};
					return order[a.status] - order[b.status];
				})[0];

			if (worstVariant) {
				group.issueLabel = `${worstVariant.unitLabel} ${worstVariant.status === "critical" ? "Critical" : "Low"}`;
			}

			lowProducts.push(group);
		}

		// Sort: critical first, then low
		lowProducts.sort((a, b) => {
			if (a.status === "critical" && b.status !== "critical") return -1;
			if (a.status !== "critical" && b.status === "critical") return 1;
			return a.productName.localeCompare(b.productName);
		});

		return {
			summary: {
				lowProducts: lowProducts.length,
				criticalItems,
				shortageVariants,
			},
			products: lowProducts,
		};
	}),

	/**
	 * Expired products — damage entries with type 'expired',
	 * plus expiry-enabled products as a watchlist.
	 */
	getExpiredProducts: shopOwnerProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		// 1. Get all expired damage entries for this shop
		const expiredEntries = await db.query.damageEntry.findMany({
			where: and(
				eq(damageEntry.shopId, userId),
				eq(damageEntry.damageType, "expired"),
				eq(damageEntry.status, "active"),
			),
			with: {
				items: {
					with: {
						variant: {
							with: {
								sourceVariantOption: true,
								product: {
									columns: {
										id: true,
										name: true,
										image: true,
										sku: true,
									},
								},
								brand: { columns: { id: true, name: true } },
							},
						},
					},
				},
			},
			orderBy: [desc(damageEntry.entryDate)],
		});

		// 2. Group expired items by product
		type ExpiredVariant = {
			variantId: number;
			brandName: string | null;
			unitLabel: string;
			operationalUnit: string;
			stockDisplay: string;
			qty: number;
			unitPrice: number;
			totalValue: number;
			entryDate: string;
		};

		type ExpiredProduct = {
			productId: number;
			productName: string;
			productImage: string | null;
			lastExpiryDate: string;
			status: "expired";
			lossValue: number;
			variants: ExpiredVariant[];
		};

		const productMap = new Map<number, ExpiredProduct>();
		let totalLoss = 0;

		for (const entry of expiredEntries) {
			for (const item of entry.items) {
				if (!item.variant?.product || !item.variant.sourceVariantOption)
					continue;
				let semantics;
				try {
					semantics = resolveVariantStockSemantics(
						item.variant.sourceVariantOption,
					);
				} catch {
					continue;
				}

				const prod = item.variant.product;
				const pid = prod.id;
				const qty = item.qty;
				const unitPrice = parseFloat(item.unitPrice || "0");
				const totalValue = parseFloat(item.totalValue || "0");

				totalLoss += totalValue;

				if (!productMap.has(pid)) {
					productMap.set(pid, {
						productId: pid,
						productName: prod.name,
						productImage: prod.image,
						lastExpiryDate: entry.entryDate,
						status: "expired",
						lossValue: 0,
						variants: [],
					});
				}

				const group = productMap.get(pid)!;
				group.lossValue += totalValue;

				// Keep the most recent entry date
				if (entry.entryDate > group.lastExpiryDate) {
					group.lastExpiryDate = entry.entryDate;
				}

				group.variants.push({
					variantId: item.variant.id,
					brandName: item.variant.brand?.name ?? null,
					unitLabel: semantics.displayLabel,
					operationalUnit: semantics.operationalUnit,
					stockDisplay: formatVariantStockQuantity(semantics, qty),
					qty,
					unitPrice,
					totalValue,
					entryDate: entry.entryDate,
				});
			}
		}

		const expiredProducts = Array.from(productMap.values()).sort((a, b) =>
			b.lastExpiryDate.localeCompare(a.lastExpiryDate),
		);

		// 3. Get expiry-enabled products in shop inventory (watchlist)
		const shopInventory = await db.query.inventory.findMany({
			where: and(
				eq(inventory.ownerType, "shop"),
				eq(inventory.ownerId, userId),
			),
			with: {
				variant: {
					with: {
						product: {
							columns: {
								id: true,
								name: true,
								image: true,
								expiryEnabled: true,
							},
						},
						sourceVariantOption: true,
					},
				},
			},
		});

		const watchlistMap = new Map<
			number,
			{
				productId: number;
				productName: string;
				productImage: string | null;
				configuredVariants: number;
				expiryEnabled: boolean;
				shelfLife: string | null;
			}
		>();

		for (const inv of shopInventory) {
			if (
				!inv.variant?.product?.expiryEnabled ||
				!inv.variant.sourceVariantOption ||
				!inv.variant.isActive
			)
				continue;
			try {
				resolveVariantStockSemantics(inv.variant.sourceVariantOption);
			} catch {
				continue;
			}

			const prod = inv.variant.product;
			const pid = prod.id;
			const qty = parseFloat(inv.availableQty || "0");

			if (qty <= 0) continue;

			if (!watchlistMap.has(pid)) {
				watchlistMap.set(pid, {
					productId: pid,
					productName: prod.name,
					productImage: prod.image,
					configuredVariants: 0,
					expiryEnabled: true,
					shelfLife: inv.variant.shelfLife,
				});
			}

			const w = watchlistMap.get(pid)!;
			w.configuredVariants++;
		}

		const expiryEnabledProducts = Array.from(watchlistMap.values());

		return {
			summary: {
				expiredProducts: expiredProducts.length,
				expiringSoon: expiryEnabledProducts.length,
				lossValue: Math.round(totalLoss * 100) / 100,
			},
			expiredProducts,
			expiryEnabledProducts,
		};
	}),

	/**
	 * Empty pack management — aggregates empty pack collections,
	 * condition breakdown, and return tracking.
	 */
	getEmptyPackSummary: shopOwnerProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		// 1. Get all empty pack records linked to this shop's deliveries
		// empty_pack is delivery-scoped, so we need to find packs
		// from deliveries belonging to this shop owner
		const allPacks = await db.query.emptyPack.findMany({
			where: eq(emptyPack.shopId, userId),
			with: {
				variant: {
					with: {
						product: {
							columns: { id: true, name: true, image: true },
						},
						brand: { columns: { id: true, name: true } },
					},
				},
				brand: { columns: { id: true, name: true } },
			},
		});

		// 2. Get pack rules for this shop
		const packRules = await db.query.productPackRule.findMany({
			where: and(
				eq(productPackRule.ownerType, "shop"),
				eq(productPackRule.ownerId, userId),
				eq(productPackRule.isActive, true),
			),
		});
		const ruleMap = new Map(packRules.map((r) => [r.productId, r]));

		// 3. Get return pack quantities from purchases
		const shopPurchases = await db.query.purchase.findMany({
			where: eq(purchase.warehouseId, userId),
			with: {
				items: {
					columns: {
						variantId: true,
						returnPackQty: true,
						productName: true,
					},
				},
				supplier: {
					columns: {
						id: true,
						name: true,
						returnPackAgreement: true,
					},
				},
			},
		});

		// Build return tracking from purchases
		const returnedByVariant = new Map<number, number>();
		const supplierByProduct = new Map<
			number,
			{ name: string; hasAgreement: boolean }
		>();

		for (const p of shopPurchases) {
			for (const item of p.items) {
				if (item.variantId && parseFloat(item.returnPackQty || "0") > 0) {
					const prev = returnedByVariant.get(item.variantId) || 0;
					returnedByVariant.set(
						item.variantId,
						prev + parseFloat(item.returnPackQty),
					);
				}
			}
			if (p.supplier) {
				// We don't have productId directly, but we can track supplier info
				for (const item of p.items) {
					if (item.variantId) {
						supplierByProduct.set(item.variantId, {
							name: p.supplier.name,
							hasAgreement: p.supplier.returnPackAgreement,
						});
					}
				}
			}
		}

		// 4. Group empty packs by product
		type PackVariant = {
			variantId: number | null;
			brandName: string | null;
			packDescription: string;
			collected: number;
			verified: number;
			rejected: number;
			condition: "reusable" | "damaged" | "pending";
		};

		type PackProduct = {
			productId: number;
			productName: string;
			productImage: string | null;
			emptyQty: number;
			packType: string;
			isReturnable: boolean;
			status: "reusable" | "return_pending";
			variants: PackVariant[];
			totalCollected: number;
			totalVerified: number;
			totalRejected: number;
			totalReturned: number;
		};

		const productMap = new Map<number, PackProduct>();
		let totalPacks = 0;
		let returnPending = 0;
		let reusable = 0;

		for (const pack of allPacks) {
			const prod = pack.variant?.product;
			if (!prod) continue;

			const pid = prod.id;
			const qty = pack.quantityCollected;
			totalPacks += qty;

			if (pack.status === "verified") reusable += qty;
			else if (pack.status === "collected" || pack.status === "submitted")
				returnPending += qty;

			if (!productMap.has(pid)) {
				const rule = ruleMap.get(pid);
				productMap.set(pid, {
					productId: pid,
					productName: prod.name,
					productImage: prod.image,
					emptyQty: 0,
					packType: pack.packDescription || "Pack",
					isReturnable:
						rule?.isEmptyPackReturnable ??
						pack.variant?.isPackReturnRequired ??
						false,
					status: "reusable",
					variants: [],
					totalCollected: 0,
					totalVerified: 0,
					totalRejected: 0,
					totalReturned: 0,
				});
			}

			const group = productMap.get(pid)!;
			group.emptyQty += qty;
			group.totalCollected += qty;

			if (pack.status === "verified") group.totalVerified += qty;
			if (pack.status === "rejected") group.totalRejected += qty;

			// Add returned qty from purchases
			if (pack.variantId) {
				group.totalReturned = returnedByVariant.get(pack.variantId) || 0;
			}

			const brandName = pack.brand?.name ?? pack.variant?.brand?.name ?? null;

			group.variants.push({
				variantId: pack.variantId,
				brandName,
				packDescription: pack.packDescription || "Pack",
				collected: qty,
				verified: pack.status === "verified" ? qty : 0,
				rejected: pack.status === "rejected" ? qty : 0,
				condition:
					pack.status === "rejected"
						? "damaged"
						: pack.status === "verified"
							? "reusable"
							: "pending",
			});
		}

		// Determine product-level status
		for (const group of productMap.values()) {
			const hasPending = group.variants.some((v) => v.condition === "pending");
			group.status = hasPending ? "return_pending" : "reusable";
		}

		const products = Array.from(productMap.values()).sort(
			(a, b) => b.emptyQty - a.emptyQty,
		);

		// 5. Build return tracking list
		const returnTracking = products
			.filter((p) => p.isReturnable && p.status === "return_pending")
			.map((p) => {
				const firstVariant = p.variants[0];
				const supplierInfo = firstVariant?.variantId
					? supplierByProduct.get(firstVariant.variantId)
					: null;

				return {
					productId: p.productId,
					productName: p.productName,
					pendingReturn: p.totalCollected - p.totalReturned,
					supplierName: supplierInfo?.name ?? null,
					hasReturnAgreement: supplierInfo?.hasAgreement ?? false,
				};
			})
			.filter((r) => r.pendingReturn > 0);

		return {
			summary: {
				totalEmptyPacks: totalPacks,
				returnPending,
				reusableStock: reusable,
			},
			products,
			returnTracking,
		};
	}),

	/** B2B → B2C conversion history for the shop owner */
	getConversionHistory: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/conversion-history",
			tags: ["Shop Owner"],
			summary: "Get B2B to B2C stock conversion history",
		})
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			// Get all B2B orders for this shop
			const b2bOrders = await db.query.order.findMany({
				where: and(eq(order.userId, userId), eq(order.orderType, "b2b")),
				columns: {
					id: true,
					orderNumber: true,
					status: true,
					createdAt: true,
					deliveredAt: true,
				},
				with: {
					items: {
						columns: {
							id: true,
							productId: true,
							variantId: true,
							productName: true,
							productImage: true,
							productSize: true,
							quantity: true,
							unitPrice: true,
							totalPrice: true,
							supplyMode: true,
							targetVariantId: true,
							quantityUnit: true,
							inventoryUnit: true,
							conversionFactor: true,
							inventoryQty: true,
							conversionStatus: true,
							convertedQty: true,
						},
					},
				},
				orderBy: [desc(order.createdAt)],
			});

			// Build flat list of conversion items
			const conversionItems: {
				orderItemId: number;
				orderNumber: string;
				orderStatus: string;
				orderedAt: Date;
				deliveredAt: Date | null;
				productName: string;
				productImage: string;
				productSize: string;
				quantity: number;
				unitPrice: string;
				supplyMode: string | null;
				supplyModeLabel: string;
				targetVariantId: number | null;
				quantityUnit: string | null;
				inventoryUnit: string | null;
				conversionFactor: string | null;
				inventoryQty: string | null;
				conversionStatus: string | null;
				convertedQty: string | null;
			}[] = [];

			let totalConverted = 0;
			let totalPending = 0;
			let totalFailed = 0;

			for (const o of b2bOrders) {
				for (const item of o.items) {
					const status =
						item.conversionStatus ??
						(o.status === "delivered" ? "converted" : "pending");
					if (status === "converted") totalConverted++;
					else if (status === "failed") totalFailed++;
					else totalPending++;

					const modeLabel =
						item.supplyMode && item.supplyMode in FULFILLMENT_MODE_LABELS
							? FULFILLMENT_MODE_LABELS[
									item.supplyMode as keyof typeof FULFILLMENT_MODE_LABELS
								]
							: "Legacy";

					conversionItems.push({
						orderItemId: item.id,
						orderNumber: o.orderNumber,
						orderStatus: o.status,
						orderedAt: o.createdAt,
						deliveredAt: o.deliveredAt,
						productName: item.productName,
						productImage: item.productImage,
						productSize: item.productSize,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						supplyMode: item.supplyMode,
						supplyModeLabel: modeLabel,
						targetVariantId: item.targetVariantId,
						quantityUnit: item.quantityUnit,
						inventoryUnit: item.inventoryUnit,
						conversionFactor: item.conversionFactor,
						inventoryQty: item.inventoryQty,
						conversionStatus: status,
						convertedQty: item.convertedQty,
					});
				}
			}

			return {
				summary: {
					totalItems: conversionItems.length,
					converted: totalConverted,
					pending: totalPending,
					failed: totalFailed,
				},
				items: conversionItems,
			};
		}),

	/**
	 * Get shop owner's retail products (what they sell to consumers).
	 * Shows RETAIL variants with inventory info.
	 */
	getMyRetailProducts: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/retail-products",
			tags: ["Shop Owner"],
			summary: "Get shop owner retail product catalog",
		})
		.input(
			z.object({
				search: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;
			const { search, page, limit } = input;
			const offset = (page - 1) * limit;

			// Get inventory records for this shop owner
			const shopInventory = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
				),
				// Always start from a deterministic database order. The final
				// taxonomy sort below is applied before pagination, but this ID
				// tie-breaker also keeps otherwise identical records stable.
				orderBy: [asc(inventory.id)],
				with: {
					variant: {
						with: {
							catalogVariant: {
								columns: { id: true, globalSku: true },
							},
							product: {
								with: {
									category: {
										columns: { name: true, slug: true },
									},
									images: { limit: 1 },
									brand: {
										columns: { id: true, name: true },
									},
									productBrands: {
										with: {
											brand: {
												columns: {
													id: true,
													name: true,
												},
											},
										},
									},
								},
							},
							brand: { columns: { id: true, name: true } },
						},
					},
				},
			});

			// Filter by search if needed
			let filtered = shopInventory;
			if (search?.trim()) {
				const s = search.toLowerCase();
				filtered = shopInventory.filter(
					(inv) =>
						inv.variant?.product?.name?.toLowerCase().includes(s) ||
						inv.variant?.sku?.toLowerCase().includes(s) ||
						inv.variant?.preferredLocalSku?.toLowerCase().includes(s) ||
						inv.variant?.catalogVariant?.globalSku?.toLowerCase().includes(s),
				);
			}

			// Match the stable hierarchy used by the admin and warehouse price
			// lists. Price and updatedAt are deliberately excluded so editing a
			// price cannot move its row after the query is refreshed.
			const compareLabels = (
				left: string | null | undefined,
				right: string | null | undefined,
			) =>
				(left ?? "").localeCompare(right ?? "", "en", {
					numeric: true,
					sensitivity: "base",
				});
			const getBrandName = (item: (typeof shopInventory)[number]) =>
				item.variant?.brand?.name ??
				item.variant?.product?.brand?.name ??
				item.variant?.product?.productBrands?.[0]?.brand?.name ??
				"";
			const getVariantLabel = (item: (typeof shopInventory)[number]) =>
				item.variant?.quantitySelectorLabel ??
				item.variant?.unitLabel ??
				item.variant?.sku ??
				"";

			filtered = [...filtered].sort(
				(left, right) =>
					compareLabels(
						left.variant?.product?.category?.name,
						right.variant?.product?.category?.name,
					) ||
					compareLabels(
						left.variant?.product?.name,
						right.variant?.product?.name,
					) ||
					compareLabels(getBrandName(left), getBrandName(right)) ||
					(left.variant?.sortOrder ?? 0) - (right.variant?.sortOrder ?? 0) ||
					compareLabels(getVariantLabel(left), getVariantLabel(right)) ||
					compareLabels(left.variant?.sku, right.variant?.sku) ||
					left.id - right.id,
			);

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
	 * Get shop owner's inventory summary.
	 */
	getMyInventory: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/inventory",
			tags: ["Shop Owner"],
			summary: "Get shop owner inventory",
		})
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			const items = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
				),
				with: {
					variant: {
						with: {
							product: {
								with: {
									category: { columns: { name: true } },
									images: { limit: 1 },
								},
							},
							brand: { columns: { id: true, name: true } },
							sourceVariantOption: true,
						},
					},
				},
			});

			return {
				items: items.map((item) => {
					if (!item.variant?.sourceVariantOption) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"An inventory variant is missing its Admin Variant definition",
						});
					}

					return {
						...item,
						variant: {
							...item.variant,
							variantOperations: resolveVariantOperations(
								item.variant.sourceVariantOption,
							),
						},
					};
				}),
			};
		}),

	/**
	 * Get areas assigned to this shop owner.
	 */
	getMyAssignedAreas: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/my-areas",
			tags: ["Shop Owner"],
			summary: "Get areas assigned to this shop owner",
		})
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			const mappings = await db
				.select({
					id: sellerAreaMapping.id,
					areaId: sellerAreaMapping.areaId,
					isActive: sellerAreaMapping.isActive,
					overrideRadiusKm: sellerAreaMapping.overrideRadiusKm,
					areaName: area.name,
					areaSlug: area.slug,
					areaDescription: area.description,
					areaCenterLat: area.centerLat,
					areaCenterLng: area.centerLng,
					areaRadiusKm: area.radiusKm,
				})
				.from(sellerAreaMapping)
				.innerJoin(area, eq(sellerAreaMapping.areaId, area.id))
				.where(
					and(
						eq(sellerAreaMapping.sellerId, userId),
						eq(sellerAreaMapping.isActive, true),
						eq(area.isActive, true),
					),
				);

			return { areas: mappings };
		}),
};

// ────────────────────────────────────────────────────────────────
// Mutations (Shop Owner management actions)
// ────────────────────────────────────────────────────────────────

const mutations = {
	/**
	 * Update retail selling price for a product in the shop owner's inventory.
	 * Validates that the price meets the minimum margin requirement.
	 */
	updateRetailPrice: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/update-price",
			tags: ["Shop Owner"],
			summary: "Update retail selling price for an inventory item",
		})
		.input(
			z.object({
				inventoryId: z.number(),
				retailPrice: z
					.string()
					.refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
						message: "Price must be a positive number",
					}),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;
			const newPrice = Number(input.retailPrice);

			// 1. Get the inventory record and verify ownership
			const invRecord = await db.query.inventory.findFirst({
				where: and(
					eq(inventory.id, input.inventoryId),
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
				),
				with: {
					variant: {
						columns: {
							id: true,
							price: true, // base cost price
							minMarginPercent: true,
							minMarginAmount: true,
							productId: true,
						},
					},
				},
			});

			if (!invRecord) {
				throw new ORPCError("NOT_FOUND", {
					message: "Inventory record not found or not owned by you",
				});
			}

			// 2. Validate minimum margin
			const basePrice = Number(invRecord.variant?.price || 0);
			const minMarginPercent = Number(invRecord.variant?.minMarginPercent || 0);
			const minMarginAmount = Number(invRecord.variant?.minMarginAmount || 0);

			let minimumPrice = basePrice;
			if (minMarginPercent > 0) {
				minimumPrice = basePrice * (1 + minMarginPercent / 100);
			}
			if (minMarginAmount > 0) {
				minimumPrice = Math.max(minimumPrice, basePrice + minMarginAmount);
			}

			if (newPrice < minimumPrice) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Price must be at least ৳${minimumPrice.toFixed(2)} (base ৳${basePrice.toFixed(2)} + required margin)`,
				});
			}

			// 3. Update price and recalculate active offers in one transaction.
			// Invalidating an offer's discount rolls the price update back.
			let recalculatedOrderIds: number[];
			try {
				recalculatedOrderIds = await recalculateOffersForInventory(
					input.inventoryId,
					userId,
					newPrice,
				);
			} catch (error) {
				throw new ORPCError("CONFLICT", {
					message:
						error instanceof Error
							? error.message
							: "The price could not be applied to active offers.",
				});
			}
			for (const orderId of recalculatedOrderIds) {
				context.realtime.emitToOrder(orderId, "open-order:offer-updated", {
					orderId,
					reason: "retailer_price_changed",
				});
			}

			return {
				success: true,
				inventoryId: input.inventoryId,
				retailPrice: input.retailPrice,
				recalculatedOpenOrders: recalculatedOrderIds.length,
			};
		}),

	/** Update shop location coordinates */
	updateShopLocation: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/update-location",
			tags: ["Shop Owner"],
			summary: "Update shop location (lat/lng)",
		})
		.input(
			z.object({
				lat: z.string().refine((v) => !isNaN(Number(v)), {
					message: "Latitude must be a number",
				}),
				lng: z.string().refine((v) => !isNaN(Number(v)), {
					message: "Longitude must be a number",
				}),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;

			await db
				.update(user)
				.set({
					shopLat: input.lat,
					shopLng: input.lng,
				})
				.where(eq(user.id, userId));

			return {
				success: true,
				message: "Shop location updated",
				location: { lat: input.lat, lng: input.lng },
			};
		}),

	// ── Purchase Order Actions ───────────────────────────────

	/**
	 * Mark a purchase order as received by the shop owner.
	 * Optionally adjust received quantities per item.
	 * Triggers B2B → Retail inventory conversion.
	 */
	markPurchaseReceived: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-orders/receive",
			tags: ["Shop Owner"],
			summary: "Mark a purchase order as received",
		})
		.input(
			z.object({
				orderId: z.number(),
				/** Optional per-item received quantities (null = accept all as ordered) */
				receivedItems: z
					.array(
						z.object({
							itemId: z.number(),
							receivedQty: z.number().min(0),
						}),
					)
					.optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", {
					message: "Order not found",
				});
			}

			// Receiving is the inventory ownership boundary; the full order must
			// first be factually delivered by the warehouse/delivery flow.
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
				const priorReceivedQty = Number(item.receivedQty ?? 0);
				if (
					receivedQty < priorReceivedQty ||
					receivedQty > deliveredQty ||
					receivedQty > approvedQty
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Received quantity for ${item.productName} must be between ${priorReceivedQty} and ${Math.min(deliveredQty, approvedQty)}`,
					});
				}
				return { itemId: item.id, receivedQty };
			});
			const hasNewReceipt = receiptRows.some((receipt) => {
				const item = existingOrder.items.find((row) => row.id === receipt.itemId);
				return receipt.receivedQty > Number(item?.receivedQty ?? 0);
			});
			if (!hasNewReceipt) {
				throw new ORPCError("BAD_REQUEST", {
					message: "At least one received quantity must increase",
				});
			}
			const fullyReceived = receiptRows.every((receipt) => {
				const item = existingOrder.items.find((row) => row.id === receipt.itemId);
				return receipt.receivedQty >= Number(item?.modifiedQty ?? item?.quantity ?? 0);
			});

			const receivedAt = new Date();
			await db.transaction(async (tx) => {
				const claimed = await tx
					.update(order)
					.set({
						receivedAt: fullyReceived ? receivedAt : null,
						updatedAt: receivedAt,
					})
					.where(
						and(
							eq(order.id, input.orderId),
							eq(order.status, "delivered"),
						),
					)
					.returning({ id: order.id });
				if (claimed.length === 0) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							"Order receipt status changed while it was being updated",
					});
				}

				for (const receipt of receiptRows) {
					await tx
						.update(orderItem)
						.set({ receivedQty: receipt.receivedQty })
						.where(eq(orderItem.id, receipt.itemId));
				}

				// Inventory transfer and delivery status are one atomic movement.
				await convertB2bOrderToRetailInventory(tx, input.orderId);
				await recognizePlatformPurchaseReceipt(tx, {
					actorId: userId,
					orderId: input.orderId,
					ownerId: userId,
					ownerType: "shop",
					receivedAt,
				});
			});

			return {
				success: true,
				message: fullyReceived
					? `Order ${existingOrder.orderNumber} received successfully`
					: `Partial receipt saved for ${existingOrder.orderNumber}`,
				purchaseStatus: fullyReceived ? "received" : "partially_received",
			};
		}),

	/**
	 * Cancel a pending/confirmed purchase order.
	 * Restores warehouse inventory for deducted items.
	 */
	cancelPurchaseOrder: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-orders/cancel",
			tags: ["Shop Owner"],
			summary: "Cancel a purchase order",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", {
					message: "Order not found",
				});
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

				await appendOrderPurchaseEvent(tx, {
					actorId: userId,
					category: "purchase",
					description: "Purchase cancelled before product receipt",
					eventType: "cancelled",
					fromState: existingOrder.status,
					idempotencyKey: `order:${input.orderId}:cancelled`,
					orderId: input.orderId,
					ownerId: userId,
					reference: existingOrder.orderNumber,
					toState: "cancelled",
				});
				const refundablePayments = await tx.query.payment.findMany({
					where: and(
						eq(payment.orderId, input.orderId),
						eq(payment.status, "completed"),
					),
				});
				for (const paid of refundablePayments) {
					await tx
						.update(payment)
						.set({ status: "refund_pending" })
						.where(eq(payment.id, paid.id));
					await appendOrderPurchaseEvent(tx, {
						actorId: userId,
						amount: Number(paid.amount) - Number(paid.refundedAmount),
						category: "payment",
						description: "Refund initiated after purchase cancellation",
						eventType: "refund_requested",
						idempotencyKey: `payment:${paid.id}:refund-requested`,
						orderId: input.orderId,
						ownerId: userId,
						reference: existingOrder.orderNumber,
						toState: "refund_pending",
					});
				}
			});

			return {
				success: true,
				message: `Order ${existingOrder.orderNumber} cancelled`,
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Order & Dashboard Queries
// ────────────────────────────────────────────────────────────────

const orderQueries = {
	/**
	 * Get shop owner's own orders (B2B purchases from admin).
	 */
	getMyOrders: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/my-orders",
			tags: ["Shop Owner"],
			summary: "Get shop owner's B2B purchase orders",
		})
		.input(
			z.object({
				status: z.enum(purchaseOrderStatusValues).optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const page = input.page;
			const limit = input.limit;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [eq(order.userId, userId)];
			if (input.status) {
				conditions.push(getPurchaseOrderStatusCondition(input.status));
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
								supplyMode: true,
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

			return {
				orders,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	/**
	 * Get dashboard summary stats for the shop owner.
	 */

	// ── Purchase Orders (enhanced) ──────────────────────────────

	/**
	 * Get shop owner's purchase orders with search, filters, and warehouse info.
	 */
	getPurchaseOrders: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-orders",
			tags: ["Shop Owner"],
			summary: "Get purchase orders with search/filter/pagination",
		})
		.input(
			z.object({
				search: z.string().optional(),
				status: z.enum(purchaseOrderStatusValues).optional(),
				dateFrom: z.string().optional(),
				dateTo: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { page, limit, search, status, dateFrom, dateTo } = input;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [eq(order.userId, userId)];

			if (status) {
				conditions.push(getPurchaseOrderStatusCondition(status));
			}

			if (dateFrom) {
				conditions.push(gte(order.createdAt, new Date(dateFrom)));
			}
			if (dateTo) {
				const toDate = new Date(dateTo);
				toDate.setHours(23, 59, 59, 999);
				conditions.push(lte(order.createdAt, toDate));
			}

			// Search by order number or product name
			if (search) {
				const s = `%${search}%`;
				// Get order IDs that match product name search
				const matchingOrderIds = await db
					.select({ orderId: orderItem.orderId })
					.from(orderItem)
					.where(ilike(orderItem.productName, s));
				const orderIds = matchingOrderIds.map((r) => r.orderId);

				if (orderIds.length > 0) {
					conditions.push(
						or(ilike(order.orderNumber, s), inArray(order.id, orderIds))!,
					);
				} else {
					conditions.push(ilike(order.orderNumber, s));
				}
			}

			const where = and(...conditions);

			const [orders, countResult, kpiResult] = await Promise.all([
				db.query.order.findMany({
					where,
					with: {
						items: {
							columns: {
								id: true,
								productName: true,
								productImage: true,
								productSize: true,
								quantity: true,
								unitPrice: true,
								totalPrice: true,
								modifiedQty: true,
								modifiedUnitPrice: true,
								supplyMode: true,
							},
						},
					},
					orderBy: [desc(order.createdAt)],
					limit,
					offset,
				}),
				db.select({ count: count() }).from(order).where(where),
				// KPI aggregation
				db
					.select({
						totalOrders: count(),
						pendingCount:
							sql<number>`count(*) filter (where ${order.status} = 'pending')`.as(
								"pending_count",
							),
						approvedCount:
							sql<number>`count(*) filter (where ${order.status} in ('approved', 'confirmed'))`.as(
								"approved_count",
							),
						readyForDispatchCount:
							sql<number>`count(*) filter (where ${order.status} = 'ready_for_dispatch')`.as(
								"ready_for_dispatch_count",
							),
						partiallyInvoicedCount:
							sql<number>`count(*) filter (where ${order.status} = 'partially_invoiced')`.as(
								"partially_invoiced_count",
							),
						invoicedCount:
							sql<number>`count(*) filter (where ${order.status} = 'invoiced')`.as(
								"invoiced_count",
							),
						confirmedCount:
							sql<number>`count(*) filter (where ${order.status} in ('approved', 'confirmed'))`.as(
								"confirmed_count",
							),
						processingCount:
							sql<number>`count(*) filter (where ${order.status} = 'processing')`.as(
								"processing_count",
							),
						deliveredCount:
							sql<number>`count(*) filter (where ${order.status} = 'delivered')`.as(
								"delivered_count",
							),
						cancelledCount:
							sql<number>`count(*) filter (where ${order.status} = 'cancelled')`.as(
								"cancelled_count",
							),
						totalAmount: sql<string>`coalesce(sum(${order.total}), 0)`.as(
							"total_amount",
						),
						pendingAmount:
							sql<string>`coalesce(sum(case when ${order.status} in ('pending','approved','ready_for_dispatch','partially_invoiced','invoiced','confirmed','processing') then ${order.total} else 0 end), 0)`.as(
								"pending_amount",
							),
					})
					.from(order)
					.where(eq(order.userId, userId)),
			]);

			const totalCount = countResult[0]?.count || 0;
			const kpi = kpiResult[0];

			// Resolve warehouse names for orders that have warehouseId
			const warehouseIds = [
				...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean)),
			];
			const warehouseMap: Record<string, string> = {};
			if (warehouseIds.length > 0) {
				const warehouses = await db
					.select({
						id: user.id,
						name: user.name,
						shopName: user.shopName,
					})
					.from(user)
					.where(inArray(user.id, warehouseIds));
				for (const w of warehouses) {
					warehouseMap[w.id] = w.shopName || w.name;
				}
			}

			const enrichedOrders = orders.map((o: any) => ({
				...o,
				items: enrichPurchaseOrderItemsFulfillment(o.items),
				warehouseName: o.warehouseId
					? warehouseMap[o.warehouseId] || "Unknown"
					: "Admin",
			}));

			return {
				orders: enrichedOrders,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
				kpi: {
					totalOrders: kpi?.totalOrders || 0,
					pendingCount: Number(kpi?.pendingCount) || 0,
					approvedCount: Number(kpi?.approvedCount) || 0,
					readyForDispatchCount: Number(kpi?.readyForDispatchCount) || 0,
					partiallyInvoicedCount: Number(kpi?.partiallyInvoicedCount) || 0,
					invoicedCount: Number(kpi?.invoicedCount) || 0,
					confirmedCount: Number(kpi?.confirmedCount) || 0,
					processingCount: Number(kpi?.processingCount) || 0,
					deliveredCount: Number(kpi?.deliveredCount) || 0,
					cancelledCount: Number(kpi?.cancelledCount) || 0,
					totalAmount: kpi?.totalAmount || "0",
					pendingAmount: kpi?.pendingAmount || "0",
				},
			};
		}),

	/**
	 * Get purchases recognized when stock was received.
	 * This keeps the purchase report aligned with inventory and payable posting.
	 */
	getPurchaseReport: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-report",
			tags: ["Shop Owner"],
			summary: "Get received purchases for the purchase report",
		})
		.input(
			z.object({
				dateFrom: z.string(),
				dateTo: z.string(),
				warehouseId: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const dateFrom = new Date(`${input.dateFrom}T00:00:00.000Z`);
			const dateTo = new Date(`${input.dateTo}T23:59:59.999Z`);

			if (
				Number.isNaN(dateFrom.getTime()) ||
				Number.isNaN(dateTo.getTime()) ||
				dateFrom > dateTo
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Select a valid purchase report date range",
				});
			}

			const reportOrders = await db
				.select({
					discount: order.discount,
					id: order.id,
					orderNumber: order.orderNumber,
					receivedAt: order.receivedAt,
					returnAmount: order.returnAmount,
					subtotal: order.subtotal,
					total: order.total,
					warehouseId: order.warehouseId,
				})
				.from(order)
				.where(
					and(
						eq(order.userId, userId),
						eq(order.orderType, "b2b"),
						inArray(order.status, ["delivered", "returned"]),
						isNotNull(order.receivedAt),
						gte(order.receivedAt, dateFrom),
						lte(order.receivedAt, dateTo),
					),
				)
				.orderBy(desc(order.receivedAt));

			const warehouseIds = [
				...new Set(
					reportOrders
						.map((purchaseOrder) => purchaseOrder.warehouseId)
						.filter((id): id is string => Boolean(id)),
				),
			];
			const warehouseNames = new Map<string, string>();

			if (warehouseIds.length > 0) {
				const warehouses = await db
					.select({
						id: user.id,
						name: user.name,
						shopName: user.shopName,
						warehouseName: user.warehouseName,
					})
					.from(user)
					.where(inArray(user.id, warehouseIds));

				for (const warehouse of warehouses) {
					warehouseNames.set(
						warehouse.id,
						warehouse.warehouseName ||
							warehouse.shopName ||
							warehouse.name ||
							"Unknown supplier",
					);
				}
			}

			const suppliers = warehouseIds.map((warehouseId) => ({
				id: warehouseId,
				name: warehouseNames.get(warehouseId) ?? "Unknown supplier",
			}));
			const rows = reportOrders
				.filter(
					(purchaseOrder) =>
						!input.warehouseId ||
						purchaseOrder.warehouseId === input.warehouseId,
				)
				.map((purchaseOrder) => {
					const amount = Number(purchaseOrder.subtotal);
					const discount = Number(purchaseOrder.discount);
					const returnAmount = Number(purchaseOrder.returnAmount);

					return {
						amount,
						date: purchaseOrder.receivedAt!,
						discount,
						id: purchaseOrder.id,
						net: Math.max(0, Number(purchaseOrder.total) - returnAmount),
						poNo: purchaseOrder.orderNumber,
						returnAmount,
						supplier:
							(purchaseOrder.warehouseId
								? warehouseNames.get(purchaseOrder.warehouseId)
								: null) ?? "Admin",
						warehouseId: purchaseOrder.warehouseId,
					};
				});

			return {
				rows,
				summary: rows.reduce(
					(summary, row) => ({
						discount: summary.discount + row.discount,
						netPurchase: summary.netPurchase + row.net,
						returnAmount: summary.returnAmount + row.returnAmount,
						totalOrders: summary.totalOrders + 1,
						totalPurchase: summary.totalPurchase + row.amount,
					}),
					{
						discount: 0,
						netPurchase: 0,
						returnAmount: 0,
						totalOrders: 0,
						totalPurchase: 0,
					},
				),
				suppliers: suppliers.sort((left, right) =>
					left.name.localeCompare(right.name),
				),
			};
		}),

	/** Get supplier invoices recognized after B2B purchases are received. */
	getAccountsPayableReport: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/accounts-payable-report",
			tags: ["Shop Owner"],
			summary: "Get received supplier bills for accounts payable",
		})
		.input(
			z.object({
				dateFrom: z.string(),
				dateTo: z.string(),
				supplierKey: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const dateFrom = new Date(`${input.dateFrom}T00:00:00.000Z`);
			const dateTo = new Date(`${input.dateTo}T23:59:59.999Z`);

			if (
				Number.isNaN(dateFrom.getTime()) ||
				Number.isNaN(dateTo.getTime()) ||
				dateFrom > dateTo
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Select a valid accounts payable date range",
				});
			}

			const bills = await db
				.select({
					dueAmount: invoice.dueAmount,
					grandTotal: invoice.grandTotal,
					id: invoice.id,
					invoiceNumber: invoice.invoiceNumber,
					invoicePaymentDueAt: invoice.paymentDueAt,
					orderId: order.id,
					orderNumber: order.orderNumber,
					orderPaymentDueAt: order.paymentDueAt,
					paidAmount: invoice.paidAmount,
					paymentMethod: order.paymentMethod,
					receivedAt: order.receivedAt,
					returnAmount: invoice.returnAmount,
					warehouseId: order.warehouseId,
				})
				.from(invoice)
				.innerJoin(order, eq(order.id, invoice.orderId))
				.where(
					and(
						eq(order.userId, userId),
						eq(order.orderType, "b2b"),
						inArray(order.status, ["delivered", "returned"]),
						isNotNull(order.receivedAt),
						gte(order.receivedAt, dateFrom),
						lte(order.receivedAt, dateTo),
					),
				)
				.orderBy(desc(order.receivedAt), desc(invoice.id));
			const manualBills = await db
				.select({
					amount: financialLedger.amount,
					createdAt: financialLedger.createdAt,
					description: financialLedger.description,
					id: financialLedger.id,
				})
				.from(financialLedger)
				.where(
					and(
						eq(financialLedger.ownerId, userId),
						eq(financialLedger.ownerType, "shop"),
						gte(financialLedger.createdAt, dateFrom),
						lte(financialLedger.createdAt, dateTo),
						or(
							and(
								eq(financialLedger.entryType, "purchase_credit"),
								eq(financialLedger.direction, "debit"),
							),
							and(
								eq(financialLedger.entryType, "adjustment"),
								eq(financialLedger.direction, "credit"),
								or(
									ilike(financialLedger.description, "Bill due%"),
									ilike(
										financialLedger.description,
										"Supplier bill tracker%",
									),
								),
							),
						),
					),
				)
				.orderBy(desc(financialLedger.createdAt));

			const warehouseIds = [
				...new Set(
					bills
						.map((bill) => bill.warehouseId)
						.filter((id): id is string => Boolean(id)),
				),
			];
			const warehouseNames = new Map<string, string>();

			if (warehouseIds.length > 0) {
				const warehouses = await db
					.select({
						id: user.id,
						name: user.name,
						shopName: user.shopName,
						warehouseName: user.warehouseName,
					})
					.from(user)
					.where(inArray(user.id, warehouseIds));

				for (const warehouse of warehouses) {
					warehouseNames.set(
						warehouse.id,
						warehouse.warehouseName ||
							warehouse.shopName ||
							warehouse.name ||
							"Unknown supplier",
					);
				}
			}

			const now = new Date();
			const platformRows = bills.map((bill) => {
					const due = Math.max(0, Number(bill.dueAmount));
					const dueDate = bill.invoicePaymentDueAt ?? bill.orderPaymentDueAt;
					const isOverdue = due > 0 && dueDate !== null && dueDate < now;
					const status: "Overdue" | "Paid" | "Unpaid" =
						due <= 0 ? "Paid" : isOverdue ? "Overdue" : "Unpaid";
					const supplier =
						(bill.warehouseId
							? warehouseNames.get(bill.warehouseId)
							: null) ?? "Admin";

					return {
						billNo: bill.invoiceNumber,
						date: bill.receivedAt!,
						due,
						dueDate,
						id: `invoice:${bill.id}`,
						orderId: bill.orderId,
						orderNo: bill.orderNumber,
						paid: Math.max(0, Number(bill.paidAmount)),
						paymentMethod: bill.paymentMethod,
						status,
						supplier,
						supplierKey: bill.warehouseId
							? `warehouse:${bill.warehouseId}`
							: "admin",
						totalBill: Math.max(
							0,
							Number(bill.grandTotal) - Number(bill.returnAmount),
						),
					};
				});
			const descriptionValue = (
				description: string | null,
				label: string,
			) => {
				const prefix = `${label}:`;
				const segment = description
					?.split("|")
					.map((part) => part.trim())
					.find((part) => part.startsWith(prefix));

				return segment?.slice(prefix.length).trim() || null;
			};
			const ledgerRows = manualBills.map((bill) => {
				const amount = Math.max(0, Number(bill.amount));
				const supplier =
					descriptionValue(bill.description, "Supplier") ?? "External supplier";
				const billNo =
					descriptionValue(bill.description, "Bill") ??
					`DUE-${String(bill.id).padStart(6, "0")}`;
				const reference =
					descriptionValue(bill.description, "Reference") ?? `LEDGER-${bill.id}`;

				return {
					billNo,
					date: bill.createdAt,
					due: amount,
					dueDate: null,
					id: `ledger:${bill.id}`,
					orderId: null,
					orderNo: reference,
					paid: 0,
					paymentMethod: null,
					status: "Unpaid" as const,
					supplier,
					supplierKey: `manual:${supplier.toLocaleLowerCase()}`,
					totalBill: amount,
				};
			});
			const allRows = [...platformRows, ...ledgerRows].sort(
				(left, right) => right.date.getTime() - left.date.getTime(),
			);
			const rows = allRows.filter(
				(row) => !input.supplierKey || row.supplierKey === input.supplierKey,
			);
			const suppliers = Array.from(
				new Map(
					allRows.map((row) => [
						row.supplierKey,
						{ id: row.supplierKey, name: row.supplier },
					]),
				).values(),
			);

			return {
				rows,
				summary: rows.reduce(
					(summary, row) => ({
						outstanding: summary.outstanding + row.due,
						overdue:
							summary.overdue + (row.status === "Overdue" ? row.due : 0),
						paid: summary.paid + row.paid,
						totalBills: summary.totalBills + 1,
					}),
					{ outstanding: 0, overdue: 0, paid: 0, totalBills: 0 },
				),
				suppliers: suppliers.sort((left, right) =>
					left.name.localeCompare(right.name),
				),
			};
		}),

	/**
	 * Get full details for a single purchase order.
	 */
	getPurchaseOrderDetail: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-order-detail",
			tags: ["Shop Owner"],
			summary: "Get full detail for a single purchase order",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const result = await db.query.order.findFirst({
				where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
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
				throw new ORPCError("NOT_FOUND", {
					message: "Purchase order not found",
				});
			}

			// Resolve warehouse info
			let warehouseInfo: {
				name: string;
				phone: string | null;
				shopName: string | null;
				warehouseName: string | null;
			} | null = null;
			if (result.warehouseId) {
				const wh = await db
					.select({
						name: user.name,
						phone: user.phoneNumber,
						shopName: user.shopName,
						warehouseName: user.warehouseName,
					})
					.from(user)
					.where(eq(user.id, result.warehouseId))
					.limit(1);
				if (wh[0]) warehouseInfo = wh[0];
			}

			const invoices = await db.query.invoice.findMany({
				where: eq(invoice.orderId, result.id),
				columns: {
					id: true,
					invoiceNumber: true,
					createdAt: true,
					approvedAt: true,
					deliveredAt: true,
					receivedAt: true,
					deliveryStatus: true,
					fulfillmentMode: true,
					completionOtp: true,
					completionOtpVerifiedAt: true,
					deliverymanId: true,
				},
				orderBy: [asc(invoice.createdAt)],
			});

			const invoiceIds = invoices.map((invoiceData) => invoiceData.id);
			const deliveryLinks = invoiceIds.length
				? await db
						.select({
							invoiceId: deliveryGroupInvoice.invoiceId,
							groupStatus: deliveryGroup.status,
							deliverymanId: deliveryGroup.deliverymanId,
							assignedAt: deliveryGroup.assignedAt,
							startedAt: deliveryGroup.startedAt,
							invoiceStatus: deliveryGroupInvoice.status,
							deliveredAt: deliveryGroupInvoice.deliveredAt,
							deliveryOtp: deliveryGroupInvoice.deliveryOtp,
						})
						.from(deliveryGroupInvoice)
						.innerJoin(
							deliveryGroup,
							eq(deliveryGroupInvoice.groupId, deliveryGroup.id),
						)
						.where(inArray(deliveryGroupInvoice.invoiceId, invoiceIds))
				: [];

			const flow = buildCanonicalOrderFlow({
				order: result,
				invoices,
				deliveryLinks,
			});
			const handoffOtps = getRetailerHandoffOtps(invoices, deliveryLinks);
			const displayStatus = getRetailerOrderDisplayStatus(
				result.status,
				deliveryLinks,
			);

			const approvedStatuses = [
				"approved",
				"ready_for_dispatch",
				"partially_invoiced",
				"invoiced",
				"confirmed",
				"processing",
				"delivered",
			];
			const readyStatuses = [
				"ready_for_dispatch",
				"partially_invoiced",
				"invoiced",
				"processing",
				"delivered",
			];

			// Build status timeline
			const timeline = [
				{ step: "Placed", date: result.createdAt, completed: true },
				{
					step: "Modified",
					date: result.modifiedByWarehouseAt,
					completed: !!result.modifiedByWarehouseAt,
					isModification: true,
				},
				{
					step: "Approved",
					date: result.modificationAcceptedAt || result.confirmedAt,
					completed:
						!!result.confirmedAt ||
						!!result.modificationAcceptedAt ||
						approvedStatuses.includes(result.status),
				},
				{
					step: "Ready",
					date: result.readyAt,
					completed: !!result.readyAt || readyStatuses.includes(result.status),
				},
				{
					step: "Partially Invoiced",
					date: null,
					completed:
						result.status === "partially_invoiced" ||
						result.status === "invoiced",
				},
				{
					step: "Invoiced",
					date: null,
					completed: result.status === "invoiced",
				},
				{
					step: "Delivered",
					date: result.deliveredAt,
					completed: !!result.deliveredAt,
				},
				{
					step: "Received",
					date: result.receivedAt,
					completed: !!result.receivedAt,
				},
			].filter((t) => !t.isModification || t.completed); // Only show "Modified" if it actually happened

			// Check if any items were modified
			const hasModifications = result.items.some(
				(item: any) =>
					item.modifiedQty !== null || item.modifiedUnitPrice !== null,
			);

			return {
				order: {
					...result,
					displayStatus,
					items: enrichPurchaseOrderItemsFulfillment(result.items),
					warehouseName:
						warehouseInfo?.warehouseName ||
						warehouseInfo?.shopName ||
						warehouseInfo?.name ||
						"Admin",
					warehousePhone: warehouseInfo?.phone || null,
				},
				flow,
				timeline,
				hasModifications,
				delivery: {
					trackingId: result.trackingId,
					riderName: result.riderName,
					riderPhone: result.riderPhone,
					handoffOtps,
				},
			};
		}),

	// ── Purchase Order Tracking ──────────────────────────────

	/**
	 * Get purchase orders with tracking-focused data:
	 * ordered vs received quantities, modification flags, 8-step timeline, alerts.
	 */
	getPurchaseTracking: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-tracking",
			tags: ["Shop Owner"],
			summary: "Get purchase orders with tracking data",
		})
		.input(
			z.object({
				search: z.string().optional(),
				status: z.enum(purchaseOrderStatusValues).optional(),
				dateFrom: z.string().optional(),
				dateTo: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { page, limit, search, status, dateFrom, dateTo } = input;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [eq(order.userId, userId)];

			if (status) {
				conditions.push(getPurchaseOrderStatusCondition(status));
			}
			if (dateFrom) conditions.push(gte(order.createdAt, new Date(dateFrom)));
			if (dateTo) {
				const toDate = new Date(dateTo);
				toDate.setHours(23, 59, 59, 999);
				conditions.push(lte(order.createdAt, toDate));
			}

			if (search) {
				const s = `%${search}%`;
				const matchingOrderIds = await db
					.select({ orderId: orderItem.orderId })
					.from(orderItem)
					.where(ilike(orderItem.productName, s));
				const orderIds = matchingOrderIds.map((r) => r.orderId);
				if (orderIds.length > 0) {
					conditions.push(
						or(ilike(order.orderNumber, s), inArray(order.id, orderIds))!,
					);
				} else {
					conditions.push(ilike(order.orderNumber, s));
				}
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
								productSize: true,
								quantity: true,
								unitPrice: true,
								totalPrice: true,
								modifiedQty: true,
								modifiedUnitPrice: true,
								deliveredQty: true,
								supplyMode: true,
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

			// Resolve warehouse names
			const warehouseIds = [
				...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean)),
			];
			const warehouseMap: Record<string, string> = {};
			if (warehouseIds.length > 0) {
				const warehouses = await db
					.select({
						id: user.id,
						name: user.name,
						shopName: user.shopName,
					})
					.from(user)
					.where(inArray(user.id, warehouseIds));
				for (const w of warehouses) {
					warehouseMap[w.id] = w.shopName || w.name;
				}
			}

			// Build tracking data for each order
			const trackingOrders = orders.map((o: any) => {
				const totalOrdered = o.items.reduce(
					(s: number, i: any) => s + (i.modifiedQty ?? i.quantity),
					0,
				);
				const totalDelivered = o.items.reduce(
					(s: number, i: any) => s + (i.deliveredQty || 0),
					0,
				);
				const isModified = !!o.modifiedByWarehouseAt;
				const needsApproval =
					isModified &&
					!o.modificationAcceptedAt &&
					!o.modificationRejectedAt &&
					o.status !== "cancelled";

				const approvedStatuses = [
					"approved",
					"ready_for_dispatch",
					"partially_invoiced",
					"invoiced",
					"confirmed",
					"processing",
					"delivered",
				];
				const readyStatuses = [
					"ready_for_dispatch",
					"partially_invoiced",
					"invoiced",
					"processing",
					"delivered",
				];

				const timeline = [
					{ step: "Placed", date: o.createdAt, completed: true },
					{
						step: "Modified",
						date: o.modifiedByWarehouseAt,
						completed: !!o.modifiedByWarehouseAt,
						isModification: true,
					},
					{
						step: "Approved",
						date: o.modificationAcceptedAt || o.confirmedAt,
						completed:
							!!o.confirmedAt ||
							!!o.modificationAcceptedAt ||
							approvedStatuses.includes(o.status),
					},
					{
						step: "Ready",
						date: o.readyAt,
						completed: !!o.readyAt || readyStatuses.includes(o.status),
					},
					{
						step: "Partially Invoiced",
						date: null,
						completed:
							o.status === "partially_invoiced" || o.status === "invoiced",
					},
					{
						step: "Invoiced",
						date: null,
						completed: o.status === "invoiced",
					},
					{
						step: "Processing",
						date: o.processingStartedAt,
						completed:
							!!o.processingStartedAt ||
							o.status === "processing" ||
							o.status === "delivered",
					},
					{
						step: "Packing",
						date: o.packingStartedAt,
						completed: !!o.packingStartedAt,
					},
					{
						step: "Delivered",
						date: o.deliveredAt,
						completed: !!o.deliveredAt || o.status === "delivered",
					},
					{
						step: "Received",
						date: o.receivedAt,
						completed: !!o.receivedAt,
					},
				].filter((t) => !t.isModification || t.completed);

				return {
					...o,
					items: enrichPurchaseOrderItemsFulfillment(o.items),
					warehouseName: o.warehouseId
						? warehouseMap[o.warehouseId] || "Unknown"
						: "Admin",
					tracking: {
						totalOrdered,
						totalDelivered,
						remaining: totalOrdered - totalDelivered,
						deliveryProgress:
							totalOrdered > 0
								? Math.round((totalDelivered / totalOrdered) * 100)
								: 0,
						isPartialDelivery:
							totalDelivered > 0 && totalDelivered < totalOrdered,
					},
					modification: {
						isModified,
						needsApproval,
						acceptedAt: o.modificationAcceptedAt,
						rejectedAt: o.modificationRejectedAt,
					},
					timeline,
				};
			});

			// Alerts / Insights
			const allUserOrders = await db
				.select({
					modifiedCount:
						sql<number>`count(*) filter (where ${order.modifiedByWarehouseAt} is not null and ${order.modificationAcceptedAt} is null and ${order.modificationRejectedAt} is null and ${order.status} != 'cancelled')`.as(
							"mc",
						),
					pendingApprovals:
						sql<number>`count(*) filter (where ${order.status} = 'pending')`.as(
							"pa",
						),
					totalActive:
						sql<number>`count(*) filter (where ${order.status} not in ('delivered', 'cancelled'))`.as(
							"ta",
						),
				})
				.from(order)
				.where(eq(order.userId, userId));

			const alerts = {
				modifiedOrders: Number(allUserOrders[0]?.modifiedCount) || 0,
				pendingApprovals: Number(allUserOrders[0]?.pendingApprovals) || 0,
				totalActive: Number(allUserOrders[0]?.totalActive) || 0,
			};

			return {
				orders: trackingOrders,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
				alerts,
			};
		}),

	/**
	 * Retailer accepts wholesaler's quantity modifications.
	 */
	acceptPurchaseModification: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-orders/accept-modification",
			tags: ["Shop Owner"],
			summary: "Accept wholesaler modifications",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", {
					message: "Order not found",
				});
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

	/**
	 * Retailer rejects wholesaler's modifications → order cancelled, inventory restored.
	 */
	rejectPurchaseModification: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-orders/reject-modification",
			tags: ["Shop Owner"],
			summary: "Reject wholesaler modifications and cancel order",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const existingOrder = await db.query.order.findFirst({
				where: and(eq(order.id, input.orderId), eq(order.userId, userId)),
				with: { items: true },
			});

			if (!existingOrder) {
				throw new ORPCError("NOT_FOUND", {
					message: "Order not found",
				});
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

			if (!["approved", "confirmed"].includes(existingOrder.status)) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Modifications can only be rejected before dispatch",
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

				// Release the approved reservation created by warehouse review.
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

	// ── Purchase History ─────────────────────────────────────

	/**
	 * Get completed/past purchase orders with stock impact, payment info,
	 * invoice data, and 7-day trend.
	 */
	getPurchaseHistory: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/purchase-history",
			tags: ["Shop Owner"],
			summary: "Get purchase history with stock impact and trends",
		})
		.input(
			z.object({
				search: z.string().optional(),
				status: z.enum(["delivered", "cancelled", "returned"]).optional(),
				warehouseId: z.string().optional(),
				dateFrom: z.string().optional(),
				dateTo: z.string().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { page, limit, search, status, warehouseId, dateFrom, dateTo } =
				input;
			const offset = (page - 1) * limit;

			// Only completed statuses
			const conditions: SQL[] = [
				eq(order.userId, userId),
				inArray(order.status, ["delivered", "cancelled", "returned"]),
			];

			if (status) conditions.push(eq(order.status, status));
			if (warehouseId) conditions.push(eq(order.warehouseId, warehouseId));
			if (dateFrom) conditions.push(gte(order.createdAt, new Date(dateFrom)));
			if (dateTo) {
				const d = new Date(dateTo);
				d.setHours(23, 59, 59, 999);
				conditions.push(lte(order.createdAt, d));
			}

			if (search) {
				const s = `%${search}%`;
				const matchingIds = await db
					.select({ orderId: orderItem.orderId })
					.from(orderItem)
					.where(ilike(orderItem.productName, s));
				const ids = matchingIds.map((r) => r.orderId);
				if (ids.length > 0) {
					conditions.push(
						or(ilike(order.orderNumber, s), inArray(order.id, ids))!,
					);
				} else {
					conditions.push(ilike(order.orderNumber, s));
				}
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
								productSize: true,
								quantity: true,
								unitPrice: true,
								totalPrice: true,
								modifiedQty: true,
								modifiedUnitPrice: true,
								deliveredQty: true,
								convertedQty: true,
								supplyMode: true,
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

			// Resolve warehouse names
			const whIds = [
				...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean)),
			];
			const whMap: Record<string, string> = {};
			if (whIds.length > 0) {
				const whs = await db
					.select({
						id: user.id,
						name: user.name,
						shopName: user.shopName,
					})
					.from(user)
					.where(inArray(user.id, whIds));
				for (const w of whs) whMap[w.id] = w.shopName || w.name;
			}

			// Fetch invoices for these orders
			const orderIds = orders.map((o: any) => o.id);
			const invoiceMap: Record<number, string> = {};
			if (orderIds.length > 0) {
				const invoices = await db
					.select({
						orderId: invoice.orderId,
						invoiceNumber: invoice.invoiceNumber,
					})
					.from(invoice)
					.where(inArray(invoice.orderId, orderIds));
				for (const inv of invoices) invoiceMap[inv.orderId] = inv.invoiceNumber;
			}

			// Build history records
			const historyOrders = orders.map((o: any) => {
				const totalQty = o.items.reduce(
					(s: number, i: any) => s + (i.modifiedQty ?? i.quantity),
					0,
				);
				const totalAmount = o.items.reduce((s: number, i: any) => {
					const qty = i.modifiedQty ?? i.quantity;
					const price = i.modifiedUnitPrice ?? i.unitPrice;
					return s + qty * Number(price);
				}, 0);

				// Stock impact
				const stockImpact = o.items.map((item: any) => {
					const qty = item.modifiedQty ?? item.quantity;
					if (o.status === "delivered") {
						return {
							product: item.productName,
							change: `+${qty}`,
							type: "added",
						};
					} else if (o.status === "cancelled") {
						return {
							product: item.productName,
							change: "0",
							type: "no_impact",
						};
					} else {
						return {
							product: item.productName,
							change: `-${qty}`,
							type: "returned",
						};
					}
				});

				return {
					id: o.id,
					orderNumber: o.orderNumber,
					status: o.status,
					createdAt: o.createdAt,
					deliveredAt: o.deliveredAt,
					receivedAt: o.receivedAt,
					cancelledAt: o.cancelledAt,
					paymentMethod: o.paymentMethod,
					paymentStatus: o.paymentStatus,
					total: o.total,
					subtotal: o.subtotal,
					warehouseName: o.warehouseId
						? whMap[o.warehouseId] || "Unknown"
						: "Admin",
					invoiceNumber: invoiceMap[o.id] || null,
					items: enrichPurchaseOrderItemsFulfillment(o.items),
					totalQty,
					totalAmount,
					stockImpact,
				};
			});

			// 7-day purchase trend
			const sevenDaysAgo = new Date();
			sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
			sevenDaysAgo.setHours(0, 0, 0, 0);

			const trendData = await db
				.select({
					day: sql<string>`TO_CHAR(${order.createdAt}, 'YYYY-MM-DD')`.as("day"),
					orderCount: count(),
					totalAmount:
						sql<number>`COALESCE(SUM(CAST(${order.total} AS numeric)), 0)`.as(
							"total_amount",
						),
				})
				.from(order)
				.where(
					and(
						eq(order.userId, userId),
						inArray(order.status, ["delivered", "cancelled", "returned"]),
						gte(order.createdAt, sevenDaysAgo),
					),
				)
				.groupBy(sql`TO_CHAR(${order.createdAt}, 'YYYY-MM-DD')`)
				.orderBy(sql`TO_CHAR(${order.createdAt}, 'YYYY-MM-DD')`);

			// Fill missing days
			const trend: {
				day: string;
				label: string;
				orders: number;
				amount: number;
			}[] = [];
			for (let i = 0; i < 7; i++) {
				const d = new Date(sevenDaysAgo);
				d.setDate(d.getDate() + i);
				const key = d.toISOString().split("T")[0]!;
				const match = trendData.find((t) => t.day === key);
				trend.push({
					day: key,
					label: d.toLocaleDateString("en-BD", { weekday: "short" }),
					orders: match ? Number(match.orderCount) : 0,
					amount: match ? Number(match.totalAmount) : 0,
				});
			}

			// Distinct wholesalers for filter dropdown
			const wholesalers = Object.entries(whMap).map(([id, name]) => ({
				id,
				name,
			}));

			return {
				orders: historyOrders,
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
				trend,
				wholesalers,
			};
		}),

	// ── Supplier Management ──────────────────────────────────

	/**
	 * List active platform-connected suppliers with network insights.
	 */
	getConnectedSuppliers: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/connected-suppliers",
			tags: ["Shop Owner"],
			summary: "List connected suppliers from the platform network",
		})
		.input(
			z.object({
				search: z.string().optional(),
				status: z.enum(["all", "active", "inactive"]).default("all"),
				category: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;

			const connections = await db
				.select({
					connectionId: shopWarehouseConnection.id,
					warehouseId: user.id,
					warehouseName: user.warehouseName,
					warehouseSlug: user.warehouseSlug,
					warehouseAddress: user.warehouseAddress,
					name: user.name,
					phone: user.phoneNumber,
					email: user.email,
					image: user.image,
					connectedAt: shopWarehouseConnection.connectedAt,
					lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
				})
				.from(shopWarehouseConnection)
				.innerJoin(user, eq(shopWarehouseConnection.warehouseId, user.id))
				.where(
					and(
						eq(shopWarehouseConnection.shopId, shopId),
						eq(shopWarehouseConnection.status, "active"),
					),
				)
				.orderBy(
					desc(shopWarehouseConnection.lastOrderedAt),
					desc(shopWarehouseConnection.connectedAt),
				);

			if (connections.length === 0) {
				return {
					summary: {
						connectedSuppliers: 0,
						activeSuppliers: 0,
						totalPurchase: 0,
					},
					categories: [],
					suppliers: [],
				};
			}

			const warehouseIds = connections.map(
				(connection) => connection.warehouseId,
			);

			const orderRows = await db
				.select({
					warehouseId: order.warehouseId,
					status: order.status,
					paymentStatus: order.paymentStatus,
					total: order.total,
					createdAt: order.createdAt,
					invoicePaymentStatus: invoice.paymentStatus,
				})
				.from(order)
				.leftJoin(
					invoice,
					and(eq(invoice.orderId, order.id), eq(invoice.invoiceType, "main")),
				)
				.where(
					and(
						eq(order.userId, shopId),
						inArray(order.warehouseId, warehouseIds),
					),
				);

			const supplierOrderMap = new Map<
				string,
				{
					totalOrders: number;
					totalPurchase: number;
					totalPaid: number;
					totalDue: number;
					pendingOrders: number;
					lastPurchaseDate: Date | null;
				}
			>();

			for (const warehouseId of warehouseIds) {
				supplierOrderMap.set(warehouseId, {
					totalOrders: 0,
					totalPurchase: 0,
					totalPaid: 0,
					totalDue: 0,
					pendingOrders: 0,
					lastPurchaseDate: null,
				});
			}

			for (const row of orderRows) {
				const warehouseId = row.warehouseId;
				if (!warehouseId) continue;

				const current = supplierOrderMap.get(warehouseId);
				if (!current) continue;

				const total = toSafeNumber(row.total);
				current.totalOrders += 1;

				if (
					!current.lastPurchaseDate ||
					(row.createdAt && row.createdAt > current.lastPurchaseDate)
				) {
					current.lastPurchaseDate = row.createdAt;
				}

				if (["pending", "confirmed", "processing"].includes(row.status)) {
					current.pendingOrders += 1;
				}

				if (isPurchaseOrderStatus(row.status)) {
					current.totalPurchase += total;
				}

				if (isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)) {
					current.totalPaid += total;
				}

				if (
					isPayableOrder(
						row.status,
						row.paymentStatus,
						row.invoicePaymentStatus,
					)
				) {
					current.totalDue += total;
				}
			}

			const inventoryCategoryRows = await db
				.select({
					warehouseId: inventory.ownerId,
					categoryName: category.name,
					itemCount: count(),
				})
				.from(inventory)
				.innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
				.innerJoin(product, eq(productVariant.productId, product.id))
				.innerJoin(category, eq(product.categoryId, category.id))
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						inArray(inventory.ownerId, warehouseIds),
						sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
					),
				)
				.groupBy(inventory.ownerId, category.name);

			const orderedCategoryRows = await db
				.select({
					warehouseId: order.warehouseId,
					categoryName: category.name,
					itemCount: count(),
				})
				.from(orderItem)
				.innerJoin(order, eq(orderItem.orderId, order.id))
				.innerJoin(product, eq(orderItem.productId, product.id))
				.innerJoin(category, eq(product.categoryId, category.id))
				.where(
					and(
						eq(order.userId, shopId),
						inArray(order.warehouseId, warehouseIds),
					),
				)
				.groupBy(order.warehouseId, category.name);

			const inventoryCategoryMap = new Map<
				string,
				{ categoryName: string; itemCount: number }
			>();
			for (const row of inventoryCategoryRows) {
				const current = inventoryCategoryMap.get(row.warehouseId);
				const nextCount = Number(row.itemCount || 0);
				if (!current || nextCount > current.itemCount) {
					inventoryCategoryMap.set(row.warehouseId, {
						categoryName: row.categoryName,
						itemCount: nextCount,
					});
				}
			}

			const orderedCategoryMap = new Map<
				string,
				{ categoryName: string; itemCount: number }
			>();
			for (const row of orderedCategoryRows) {
				if (!row.warehouseId) continue;

				const current = orderedCategoryMap.get(row.warehouseId);
				const nextCount = Number(row.itemCount || 0);
				if (!current || nextCount > current.itemCount) {
					orderedCategoryMap.set(row.warehouseId, {
						categoryName: row.categoryName,
						itemCount: nextCount,
					});
				}
			}

			const allSuppliers = connections.map((connection) => {
				const orderSummary = supplierOrderMap.get(connection.warehouseId) ?? {
					totalOrders: 0,
					totalPurchase: 0,
					totalPaid: 0,
					totalDue: 0,
					pendingOrders: 0,
					lastPurchaseDate: null,
				};
				const primaryCategory =
					inventoryCategoryMap.get(connection.warehouseId)?.categoryName ||
					orderedCategoryMap.get(connection.warehouseId)?.categoryName ||
					null;
				const activityStatus = getConnectedSupplierActivityStatus(
					orderSummary.lastPurchaseDate,
					connection.connectedAt,
					orderSummary.pendingOrders,
				);

				return {
					connectionId: connection.connectionId,
					warehouseId: connection.warehouseId,
					warehouseSlug: connection.warehouseSlug,
					name:
						connection.warehouseName || connection.name || "Connected Supplier",
					phone: connection.phone,
					email: connection.email,
					address: connection.warehouseAddress,
					image: connection.image,
					primaryCategory,
					activityStatus,
					totalOrders: orderSummary.totalOrders,
					totalPurchase: orderSummary.totalPurchase,
					totalPaid: orderSummary.totalPaid,
					totalDue: orderSummary.totalDue,
					pendingOrders: orderSummary.pendingOrders,
					lastPurchaseDate: orderSummary.lastPurchaseDate,
					connectedAt: connection.connectedAt,
					lastOrderedAt: connection.lastOrderedAt,
				};
			});

			const summary = {
				connectedSuppliers: allSuppliers.length,
				activeSuppliers: allSuppliers.filter(
					(supplier) => supplier.activityStatus === "active",
				).length,
				totalPurchase: allSuppliers.reduce(
					(total, supplier) => total + supplier.totalPurchase,
					0,
				),
			};

			const categories = [
				...new Set(
					allSuppliers
						.map((supplier) => supplier.primaryCategory)
						.filter((value): value is string => Boolean(value)),
				),
			].sort((a, b) => a.localeCompare(b));

			let suppliers = allSuppliers;

			if (input.search?.trim()) {
				const search = input.search.trim().toLowerCase();
				suppliers = suppliers.filter((supplier) =>
					[
						supplier.name,
						supplier.phone,
						supplier.email,
						supplier.address,
						supplier.primaryCategory,
					]
						.filter(Boolean)
						.some((value) => value!.toLowerCase().includes(search)),
				);
			}

			if (input.status !== "all") {
				suppliers = suppliers.filter(
					(supplier) => supplier.activityStatus === input.status,
				);
			}

			if (input.category?.trim()) {
				const categoryFilter = input.category.trim().toLowerCase();
				suppliers = suppliers.filter(
					(supplier) =>
						supplier.primaryCategory?.toLowerCase() === categoryFilter,
				);
			}

			suppliers = suppliers.sort((a, b) => {
				if (a.activityStatus !== b.activityStatus) {
					return a.activityStatus === "active" ? -1 : 1;
				}

				if (b.totalPurchase !== a.totalPurchase) {
					return b.totalPurchase - a.totalPurchase;
				}

				return (
					(b.lastPurchaseDate?.getTime() ||
						b.lastOrderedAt?.getTime() ||
						b.connectedAt?.getTime() ||
						0) -
					(a.lastPurchaseDate?.getTime() ||
						a.lastOrderedAt?.getTime() ||
						a.connectedAt?.getTime() ||
						0)
				);
			});

			return {
				summary,
				categories,
				suppliers,
			};
		}),

	/**
	 * Full detail for a platform-connected supplier.
	 */
	getConnectedSupplierDetail: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/connected-supplier-detail",
			tags: ["Shop Owner"],
			summary: "Get a connected supplier network profile",
		})
		.input(z.object({ warehouseId: z.string() }))
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			const warehouseId = input.warehouseId;

			const [shopUser] = await db
				.select({
					id: user.id,
					name: user.name,
					shopName: user.shopName,
					shopAddress: user.shopAddress,
					serviceArea: user.serviceArea,
				})
				.from(user)
				.where(eq(user.id, shopId))
				.limit(1);

			const [warehouseUser] = await db
				.select({
					id: user.id,
					name: user.name,
					warehouseName: user.warehouseName,
					warehouseSlug: user.warehouseSlug,
					phoneNumber: user.phoneNumber,
					email: user.email,
					image: user.image,
					address: user.warehouseAddress,
				})
				.from(user)
				.where(eq(user.id, warehouseId))
				.limit(1);

			const [connection] = await db
				.select({
					status: shopWarehouseConnection.status,
					connectedAt: shopWarehouseConnection.connectedAt,
					lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
				})
				.from(shopWarehouseConnection)
				.where(
					and(
						eq(shopWarehouseConnection.shopId, shopId),
						eq(shopWarehouseConnection.warehouseId, warehouseId),
						eq(shopWarehouseConnection.status, "active"),
					),
				)
				.limit(1);

			if (!warehouseUser || !connection) {
				throw new ORPCError("NOT_FOUND", {
					message: "Connected supplier not found",
				});
			}

			const [warehouseProfile] = await db
				.select({
					status: warehouseApplication.status,
					tradeLicenseNumber: warehouseApplication.tradeLicenseNumber,
					businessCategory: warehouseApplication.businessCategory,
					yearsInBusiness: warehouseApplication.yearsInBusiness,
					area: warehouseApplication.area,
					district: warehouseApplication.district,
					division: warehouseApplication.division,
					documents: warehouseApplication.documents,
					updatedAt: warehouseApplication.updatedAt,
				})
				.from(warehouseApplication)
				.where(eq(warehouseApplication.userId, warehouseId))
				.orderBy(desc(warehouseApplication.updatedAt))
				.limit(1);

			const supplierOrders = await db
				.select({
					id: order.id,
					orderNumber: order.orderNumber,
					status: order.status,
					paymentStatus: order.paymentStatus,
					total: order.total,
					createdAt: order.createdAt,
					deliveredAt: order.deliveredAt,
					modifiedByWarehouseAt: order.modifiedByWarehouseAt,
					shippingAddress: order.shippingAddress,
					shippingCity: order.shippingCity,
					shippingArea: order.shippingArea,
					invoicePaymentStatus: invoice.paymentStatus,
					invoiceDeliveryStatus: invoice.deliveryStatus,
					expectedDeliveryAt: invoice.expectedDeliveryAt,
				})
				.from(order)
				.leftJoin(
					invoice,
					and(eq(invoice.orderId, order.id), eq(invoice.invoiceType, "main")),
				)
				.where(
					and(eq(order.userId, shopId), eq(order.warehouseId, warehouseId)),
				)
				.orderBy(desc(order.createdAt));

			const orderStats = {
				total: supplierOrders.length,
				pending: 0,
				confirmed: 0,
				processing: 0,
				delivered: 0,
				returned: 0,
				cancelled: 0,
				outForDelivery: 0,
			};

			let totalPurchase = 0;
			let totalPaid = 0;
			let totalDue = 0;
			let overdueAmount = 0;
			let payableOrders = 0;

			for (const row of supplierOrders) {
				const total = toSafeNumber(row.total);

				if (row.status === "pending") orderStats.pending += 1;
				if (row.status === "confirmed") orderStats.confirmed += 1;
				if (row.status === "processing") orderStats.processing += 1;
				if (row.status === "delivered") orderStats.delivered += 1;
				if (row.status === "returned") orderStats.returned += 1;
				if (row.status === "cancelled") orderStats.cancelled += 1;
				if (row.invoiceDeliveryStatus === "out_for_delivery") {
					orderStats.outForDelivery += 1;
				}

				if (isPurchaseOrderStatus(row.status)) {
					totalPurchase += total;
				}

				if (
					isPurchaseOrderStatus(row.status) &&
					isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
				) {
					totalPaid += total;
				}

				if (
					isPayableOrder(
						row.status,
						row.paymentStatus,
						row.invoicePaymentStatus,
					)
				) {
					totalDue += total;
					payableOrders += 1;
					if (row.status === "delivered") {
						overdueAmount += total;
					}
				}
			}

			const latestOrder = supplierOrders[0] || null;
			const lastPayment =
				supplierOrders.find(
					(row) =>
						isPurchaseOrderStatus(row.status) &&
						isOrderPaid(row.paymentStatus, row.invoicePaymentStatus),
				) || null;

			const pendingOrders = await db.query.order.findMany({
				where: and(
					eq(order.userId, shopId),
					eq(order.warehouseId, warehouseId),
					inArray(order.status, ["pending", "confirmed", "processing"]),
				),
				with: {
					items: {
						columns: {
							id: true,
							productName: true,
							productImage: true,
							quantity: true,
							modifiedQty: true,
						},
					},
				},
				orderBy: [desc(order.createdAt)],
				limit: 5,
			});

			const pendingOrderIds = pendingOrders.map((row) => row.id);
			const pendingInvoices =
				pendingOrderIds.length > 0
					? await db
							.select({
								orderId: invoice.orderId,
								deliveryStatus: invoice.deliveryStatus,
								expectedDeliveryAt: invoice.expectedDeliveryAt,
							})
							.from(invoice)
							.where(
								and(
									eq(invoice.invoiceType, "main"),
									inArray(invoice.orderId, pendingOrderIds),
								),
							)
					: [];

			const pendingInvoiceMap = new Map(
				pendingInvoices.map((row) => [row.orderId, row]),
			);

			const historyOrderRows = supplierOrders.slice(0, 5);
			const historyOrderIds = historyOrderRows.map((row) => row.id);
			const historyItems =
				historyOrderIds.length > 0
					? await db
							.select({
								orderId: orderItem.orderId,
								productName: orderItem.productName,
							})
							.from(orderItem)
							.where(inArray(orderItem.orderId, historyOrderIds))
					: [];

			const historyItemMap = new Map<number, string[]>();
			for (const item of historyItems) {
				const current = historyItemMap.get(item.orderId) ?? [];
				current.push(item.productName);
				historyItemMap.set(item.orderId, current);
			}

			const purchaseHistory = historyOrderRows.map((row) => {
				const total = toSafeNumber(row.total);
				const productNames = historyItemMap.get(row.id) ?? [];
				const productSummary =
					productNames.length <= 2
						? productNames.join(", ")
						: `${productNames[0]}, ${productNames[1]} +${productNames.length - 2} more`;
				const paid = isOrderPaid(row.paymentStatus, row.invoicePaymentStatus);
				const dueAmount = isPayableOrder(
					row.status,
					row.paymentStatus,
					row.invoicePaymentStatus,
				)
					? total
					: 0;

				return {
					id: row.id,
					orderNumber: row.orderNumber,
					date: row.createdAt,
					productSummary: productSummary || "Multiple products",
					amount: total,
					orderStatus: row.status,
					paymentStatus: paid ? "paid" : dueAmount > 0 ? "due" : "pending",
					dueAmount,
				};
			});

			const topProducts = await db
				.select({
					productName: orderItem.productName,
					productImage: orderItem.productImage,
					totalQty:
						sql<number>`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity}))`.as(
							"tq",
						),
					orderCount: count(),
				})
				.from(orderItem)
				.innerJoin(order, eq(orderItem.orderId, order.id))
				.where(
					and(eq(order.userId, shopId), eq(order.warehouseId, warehouseId)),
				)
				.groupBy(orderItem.productName, orderItem.productImage)
				.orderBy(
					sql`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity})) DESC`,
				)
				.limit(5);

			const topCategories = await db
				.select({
					categoryName: category.name,
					totalQty:
						sql<number>`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity}))`.as(
							"tq",
						),
					orderCount: count(),
				})
				.from(orderItem)
				.innerJoin(order, eq(orderItem.orderId, order.id))
				.innerJoin(product, eq(orderItem.productId, product.id))
				.innerJoin(category, eq(product.categoryId, category.id))
				.where(
					and(eq(order.userId, shopId), eq(order.warehouseId, warehouseId)),
				)
				.groupBy(category.name)
				.orderBy(
					sql`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity})) DESC`,
				)
				.limit(3);

			const [skuSummary] = await db
				.select({
					totalSkuPurchased:
						sql<number>`COUNT(DISTINCT ${orderItem.productId})`.as(
							"total_sku_purchased",
						),
				})
				.from(orderItem)
				.innerJoin(order, eq(orderItem.orderId, order.id))
				.where(
					and(eq(order.userId, shopId), eq(order.warehouseId, warehouseId)),
				);

			const perfData = await db
				.select({
					avgDays:
						sql<number>`AVG(EXTRACT(EPOCH FROM (${order.deliveredAt} - ${order.createdAt})) / 86400)`.as(
							"ad",
						),
					modifiedCount:
						sql<number>`count(*) filter (where ${order.modifiedByWarehouseAt} is not null)`.as(
							"mc",
						),
					deliveredTotal:
						sql<number>`count(*) filter (where ${order.status} = 'delivered')`.as(
							"dt",
						),
				})
				.from(order)
				.where(
					and(
						eq(order.userId, shopId),
						eq(order.warehouseId, warehouseId),
						eq(order.status, "delivered"),
					),
				);

			const avgDeliveryDays = Math.round(Number(perfData[0]?.avgDays) || 0);
			const deliveredTotal = Number(perfData[0]?.deliveredTotal) || 0;
			const modifiedRate =
				deliveredTotal > 0
					? Math.round(
							((Number(perfData[0]?.modifiedCount) || 0) / deliveredTotal) *
								100,
						)
					: 0;

			const complaintRows = await db
				.select({
					id: complaint.id,
					type: complaint.type,
					status: complaint.status,
					description: complaint.description,
					delayReason: complaint.delayReason,
					createdAt: complaint.createdAt,
				})
				.from(complaint)
				.innerJoin(order, eq(complaint.orderId, order.id))
				.where(
					and(
						eq(complaint.userId, shopId),
						eq(order.userId, shopId),
						eq(order.warehouseId, warehouseId),
					),
				)
				.orderBy(desc(complaint.createdAt));

			const totalIssues = complaintRows.length;
			const resolvedIssues = complaintRows.filter((row) =>
				["resolved", "closed"].includes(row.status),
			).length;
			const latestIssue = complaintRows[0] || null;
			const issueRate =
				orderStats.total > 0
					? Math.round((totalIssues / orderStats.total) * 100)
					: 0;

			const assignment = await db.query.customerAssignment.findFirst({
				where: eq(customerAssignment.customerId, shopId),
				with: {
					salesman: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
							role: true,
							warehouseId: true,
							banned: true,
						},
					},
				},
			});

			const assignedSalesman =
				assignment?.salesman &&
				assignment.salesman.role === "salesman" &&
				assignment.salesman.warehouseId === warehouseId
					? {
							id: assignment.salesman.id,
							name: assignment.salesman.name,
							phone: assignment.salesman.phoneNumber,
							status: assignment.salesman.banned ? "inactive" : "active",
						}
					: null;

			const warehouseAreas = await db.query.deliveryArea.findMany({
				where: and(
					eq(deliveryArea.warehouseId, warehouseId),
					eq(deliveryArea.status, "active"),
				),
				with: {
					schedules: {
						where: eq(deliverySchedule.isActive, true),
						with: {
							defaultRider: {
								columns: {
									name: true,
									phoneNumber: true,
								},
							},
						},
						orderBy: [asc(deliverySchedule.dayOfWeek)],
					},
				},
				orderBy: [asc(deliveryArea.sortOrder), asc(deliveryArea.name)],
			});

			const deliveryHints = [
				{
					source: "shipping_area",
					value: latestOrder?.shippingArea || null,
				},
				{
					source: "shipping_city",
					value: latestOrder?.shippingCity || null,
				},
				{
					source: "service_area",
					value: shopUser?.serviceArea || null,
				},
				{
					source: "shop_address",
					value: shopUser?.shopAddress || latestOrder?.shippingAddress || null,
				},
			].filter((hint) => normalizeDeliveryText(hint.value).length > 0);

			let matchedArea: (typeof warehouseAreas)[number] | null = null;
			let matchSource: string | null = null;

			for (const areaRow of warehouseAreas) {
				const areaTerms = [areaRow.name, areaRow.slug, areaRow.description]
					.map((value) => normalizeDeliveryText(value))
					.filter(Boolean);

				const matchedHint = deliveryHints.find((hint) => {
					const normalizedHint = normalizeDeliveryText(hint.value);
					return areaTerms.some(
						(term) =>
							normalizedHint.includes(term) || term.includes(normalizedHint),
					);
				});

				if (matchedHint) {
					matchedArea = areaRow;
					matchSource = matchedHint.source;
					break;
				}
			}

			const warehouseScheduleMap = new Map<
				number,
				{
					dayOfWeek: number;
					dayName: string;
					areaNames: string[];
					riderName: string | null;
					riderPhone: string | null;
				}
			>();

			for (const areaRow of warehouseAreas) {
				for (const schedule of areaRow.schedules) {
					const current = warehouseScheduleMap.get(schedule.dayOfWeek) ?? {
						dayOfWeek: schedule.dayOfWeek,
						dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
						areaNames: [],
						riderName: schedule.defaultRider?.name ?? null,
						riderPhone: schedule.defaultRider?.phoneNumber ?? null,
					};

					if (!current.areaNames.includes(areaRow.name)) {
						current.areaNames.push(areaRow.name);
					}

					if (!current.riderName && schedule.defaultRider?.name) {
						current.riderName = schedule.defaultRider.name;
					}

					if (!current.riderPhone && schedule.defaultRider?.phoneNumber) {
						current.riderPhone = schedule.defaultRider.phoneNumber;
					}

					warehouseScheduleMap.set(schedule.dayOfWeek, current);
				}
			}

			const warehouseWeeklyDays = Array.from(
				warehouseScheduleMap.values(),
			).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
			const matchedWeeklyDays = matchedArea
				? matchedArea.schedules.map((schedule) => ({
						dayOfWeek: schedule.dayOfWeek,
						dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
						areaNames: [matchedArea!.name],
						riderName: schedule.defaultRider?.name ?? null,
						riderPhone: schedule.defaultRider?.phoneNumber ?? null,
					}))
				: [];
			const deliveryScope =
				matchedWeeklyDays.length > 0
					? "matched_area"
					: warehouseWeeklyDays.length > 0
						? "warehouse"
						: "none";
			const effectiveWeeklyDays =
				deliveryScope === "matched_area"
					? matchedWeeklyDays
					: warehouseWeeklyDays;
			const today = new Date();
			const todayDayOfWeek = today.getDay();
			const hasDeliveryToday = effectiveWeeklyDays.some(
				(day) => day.dayOfWeek === todayDayOfWeek,
			);
			const nextDelivery = findNextDeliveryDate(
				effectiveWeeklyDays.map((day) => day.dayOfWeek),
				today,
			);

			const uploadedDocuments = Array.isArray(warehouseProfile?.documents)
				? warehouseProfile.documents
				: [];
			const locationParts = [
				warehouseProfile?.area,
				warehouseProfile?.district,
				warehouseProfile?.division,
			].filter(Boolean);
			const businessType = warehouseProfile?.businessCategory
				? warehouseProfile.businessCategory
				: "warehouse_supplier";
			const bestCategory = topCategories[0]?.categoryName || null;

			let reliability: "Excellent" | "Good" | "Stable" | "Needs attention" =
				"Stable";
			if (issueRate === 0 && modifiedRate <= 5) {
				reliability = "Excellent";
			} else if (issueRate <= 2 && modifiedRate <= 10) {
				reliability = "Good";
			} else if (issueRate > 10 || modifiedRate > 25) {
				reliability = "Needs attention";
			}

			return {
				identity: {
					warehouseId: warehouseUser.id,
					warehouseSlug: warehouseUser.warehouseSlug,
					name: warehouseUser.warehouseName || warehouseUser.name,
					type: businessType,
					location: locationParts.join(", ") || warehouseUser.address || null,
					phone: warehouseUser.phoneNumber,
					email: warehouseUser.email,
					image: warehouseUser.image,
					connectionStatus: connection.status,
					connectedAt: connection.connectedAt,
					lastOrderedAt: connection.lastOrderedAt,
				},
				business: {
					name: warehouseUser.warehouseName || warehouseUser.name,
					category: warehouseProfile?.businessCategory || null,
					yearsInBusiness: warehouseProfile?.yearsInBusiness || null,
					yourStoreName: shopUser?.shopName || shopUser?.name || null,
					yourAddress:
						shopUser?.shopAddress || latestOrder?.shippingAddress || null,
				},
				documents: {
					applicationStatus: warehouseProfile?.status || null,
					tradeLicenseNumber: warehouseProfile?.tradeLicenseNumber || null,
					uploadedDocumentCount: uploadedDocuments.length,
					uploadedDocuments,
					hasTradeLicense: Boolean(warehouseProfile?.tradeLicenseNumber),
					hasVatBin: false,
					hasAgreement: false,
					hasProductAuthorization: uploadedDocuments.length > 0,
				},
				financialSummary: {
					totalPurchase,
					totalPaid,
					totalDue,
					creditLimit: null,
					availableCredit: null,
					health: totalDue > 0 ? "attention" : "safe",
				},
				orderStatus: {
					totalOrders: orderStats.total,
					pendingOrders:
						orderStats.pending + orderStats.confirmed + orderStats.processing,
					processingOrders: orderStats.processing,
					outForDeliveryOrders: orderStats.outForDelivery,
					deliveredOrders: orderStats.delivered,
				},
				pendingOrders: pendingOrders.map((row: any) => {
					const invoiceData = pendingInvoiceMap.get(row.id);
					return {
						id: row.id,
						orderNumber: row.orderNumber,
						status: row.status,
						createdAt: row.createdAt,
						total: toSafeNumber(row.total),
						deliveryStatus: invoiceData?.deliveryStatus || null,
						expectedDeliveryAt: invoiceData?.expectedDeliveryAt || null,
						items: row.items.map((item: any) => ({
							id: item.id,
							productName: item.productName,
							quantity: Number(item.modifiedQty || item.quantity || 0),
							rawQuantity: Number(item.quantity || 0),
						})),
					};
				}),
				dueStatus: {
					totalPayable: totalDue,
					overdueAmount,
					payableOrders,
					lastPayment: lastPayment
						? {
								orderNumber: lastPayment.orderNumber,
								amount: toSafeNumber(lastPayment.total),
								date: lastPayment.createdAt,
							}
						: null,
					alert:
						totalDue > 0
							? overdueAmount > 0
								? "Delivered dues are waiting to be settled."
								: "Pending purchase dues need follow-up."
							: "No pending payable balance.",
				},
				purchaseHistory,
				productRelation: {
					topProducts: topProducts.map((row) => ({
						name: row.productName,
						image: row.productImage,
						totalQty: Number(row.totalQty),
						orderCount: Number(row.orderCount),
					})),
					totalSkuPurchased: Number(skuSummary?.totalSkuPurchased || 0),
					topCategories: topCategories.map((row) => ({
						name: row.categoryName,
						totalQty: Number(row.totalQty),
						orderCount: Number(row.orderCount),
					})),
				},
				performance: {
					avgDeliveryDays,
					deliverySpeed:
						avgDeliveryDays <= 1
							? "Fast"
							: avgDeliveryDays <= 3
								? "Normal"
								: avgDeliveryDays > 0
									? "Slow"
									: "No delivery data",
					orderAccuracy: deliveredTotal > 0 ? 100 - modifiedRate : 100,
					reliability,
					issueRate,
				},
				issues: {
					totalIssues,
					resolvedIssues,
					unresolvedIssues: totalIssues - resolvedIssues,
					lastIssue: latestIssue
						? {
								type: latestIssue.type,
								status: latestIssue.status,
								description: latestIssue.description,
								delayReason: latestIssue.delayReason,
								createdAt: latestIssue.createdAt,
							}
						: null,
				},
				salesman: assignedSalesman,
				delivery: {
					scope: deliveryScope,
					matchSource,
					yourAddress:
						shopUser?.shopAddress || latestOrder?.shippingAddress || null,
					areaHint:
						latestOrder?.shippingArea ||
						latestOrder?.shippingCity ||
						shopUser?.serviceArea ||
						null,
					matchedArea: matchedArea
						? {
								id: matchedArea.id,
								name: matchedArea.name,
								description: matchedArea.description,
							}
						: null,
					availableAreas: warehouseAreas.map((areaRow) => areaRow.name),
					weeklyDays: effectiveWeeklyDays,
					hasDeliveryToday,
					todayDayName: DAY_NAMES[todayDayOfWeek],
					nextDelivery,
					cutoffTime: null,
				},
				smartInsight: {
					headline: bestCategory
						? `This supplier performs strongest in ${bestCategory}.`
						: orderStats.total > 0
							? "This supplier already has purchase activity."
							: "Connection is active, but no transactions have been recorded yet.",
					warning:
						totalDue > 0
							? `Outstanding payable balance: Tk ${totalDue.toLocaleString("en-BD")}`
							: latestIssue
								? `Latest issue: ${latestIssue.type.replace(/_/g, " ")}`
								: null,
					suggestion:
						totalDue > 0
							? "Settle pending dues before scaling order volume."
							: orderStats.pending +
										orderStats.confirmed +
										orderStats.processing >
									0
								? "Track active orders closely against the delivery schedule."
								: "Use this connection to expand repeat purchasing in strong categories.",
					compareCategory: bestCategory,
				},
				emptyState: {
					hasTransactions: supplierOrders.length > 0,
				},
			};
		}),

	/**
	 * List all warehouses this shop has ordered from (= suppliers).
	 */
	getMySuppliers: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/my-suppliers",
			tags: ["Shop Owner"],
			summary: "List suppliers (warehouses ordered from)",
		})
		.input(
			z.object({
				search: z.string().optional(),
				status: z.enum(["all", "with_due", "no_due"]).default("all"),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const supplierOrders = await db
				.select({
					warehouseId: order.warehouseId,
					orderId: order.id,
					status: order.status,
					paymentStatus: order.paymentStatus,
					total: order.total,
					createdAt: order.createdAt,
					invoicePaymentStatus: invoice.paymentStatus,
				})
				.from(order)
				.leftJoin(
					invoice,
					and(eq(invoice.orderId, order.id), eq(invoice.invoiceType, "main")),
				)
				.where(
					and(eq(order.userId, userId), sql`${order.warehouseId} is not null`),
				);

			if (supplierOrders.length === 0) {
				return {
					summary: {
						totalSuppliers: 0,
						payableSuppliers: 0,
						totalPayable: 0,
					},
					suppliers: [],
				};
			}

			const supplierMap = new Map<
				string,
				{
					warehouseId: string;
					totalOrders: number;
					totalPurchased: number;
					totalPaid: number;
					totalPayable: number;
					payableOrders: number;
					pendingCount: number;
					lastOrderDate: Date | null;
					lastPurchaseAmount: number;
				}
			>();

			for (const row of supplierOrders) {
				const warehouseId = row.warehouseId;
				if (!warehouseId) continue;

				const total = toSafeNumber(row.total);
				const existing = supplierMap.get(warehouseId) ?? {
					warehouseId,
					totalOrders: 0,
					totalPurchased: 0,
					totalPaid: 0,
					totalPayable: 0,
					payableOrders: 0,
					pendingCount: 0,
					lastOrderDate: null,
					lastPurchaseAmount: 0,
				};

				existing.totalOrders += 1;

				if (
					!existing.lastOrderDate ||
					(row.createdAt && row.createdAt > existing.lastOrderDate)
				) {
					existing.lastOrderDate = row.createdAt;
					existing.lastPurchaseAmount = total;
				}

				if (["pending", "confirmed", "processing"].includes(row.status)) {
					existing.pendingCount += 1;
				}

				if (isPurchaseOrderStatus(row.status)) {
					existing.totalPurchased += total;
				}

				if (isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)) {
					existing.totalPaid += total;
				}

				if (
					isPayableOrder(
						row.status,
						row.paymentStatus,
						row.invoicePaymentStatus,
					)
				) {
					existing.totalPayable += total;
					existing.payableOrders += 1;
				}

				supplierMap.set(warehouseId, existing);
			}

			const allSuppliers = Array.from(supplierMap.values());
			const baseSummary = {
				totalSuppliers: allSuppliers.length,
				payableSuppliers: allSuppliers.filter(
					(supplier) => supplier.totalPayable > 0,
				).length,
				totalPayable: allSuppliers.reduce(
					(total, supplier) => total + supplier.totalPayable,
					0,
				),
			};

			const whIds = Array.from(supplierMap.keys());
			const warehouseUsers = await db
				.select({
					id: user.id,
					name: user.name,
					shopName: user.shopName,
					warehouseName: user.warehouseName,
					phoneNumber: user.phoneNumber,
					email: user.email,
				})
				.from(user)
				.where(inArray(user.id, whIds));

			const connections = await db
				.select({
					warehouseId: shopWarehouseConnection.warehouseId,
					connectedAt: shopWarehouseConnection.connectedAt,
					lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
					status: shopWarehouseConnection.status,
				})
				.from(shopWarehouseConnection)
				.where(
					and(
						eq(shopWarehouseConnection.shopId, userId),
						inArray(shopWarehouseConnection.warehouseId, whIds),
					),
				);

			const userMap = new Map(warehouseUsers.map((u) => [u.id, u]));
			const connectionMap = new Map(
				connections.map((connection) => [connection.warehouseId, connection]),
			);

			let suppliers = Array.from(supplierMap.values()).map((supplier) => {
				const u = userMap.get(supplier.warehouseId);
				const connection = connectionMap.get(supplier.warehouseId);
				return {
					warehouseId: supplier.warehouseId,
					name: u?.warehouseName || u?.shopName || u?.name || "Unknown",
					phone: u?.phoneNumber || null,
					email: u?.email || null,
					totalOrders: supplier.totalOrders,
					totalPurchased: supplier.totalPurchased,
					totalPaid: supplier.totalPaid,
					totalPayable: supplier.totalPayable,
					payableOrders: supplier.payableOrders,
					pendingCount: supplier.pendingCount,
					lastOrderDate: supplier.lastOrderDate,
					lastPurchaseAmount: supplier.lastPurchaseAmount,
					hasDue: supplier.totalPayable > 0,
					connectionStatus: connection?.status || null,
					connectedAt: connection?.connectedAt || null,
					lastOrderedAt: connection?.lastOrderedAt || null,
				};
			});

			if (input.search) {
				const s = input.search.toLowerCase();
				suppliers = suppliers.filter((sup) =>
					[sup.name, sup.phone, sup.email]
						.filter(Boolean)
						.some((value) => value!.toLowerCase().includes(s)),
				);
			}

			if (input.status === "with_due") {
				suppliers = suppliers.filter((sup) => sup.hasDue);
			} else if (input.status === "no_due") {
				suppliers = suppliers.filter((sup) => !sup.hasDue);
			}

			suppliers.sort((a, b) => {
				if (Number(b.hasDue) !== Number(a.hasDue)) {
					return Number(b.hasDue) - Number(a.hasDue);
				}

				if (b.totalPayable !== a.totalPayable) {
					return b.totalPayable - a.totalPayable;
				}

				if (b.totalPurchased !== a.totalPurchased) {
					return b.totalPurchased - a.totalPurchased;
				}

				return (
					(b.lastOrderDate?.getTime() || 0) - (a.lastOrderDate?.getTime() || 0)
				);
			});

			return {
				summary: baseSummary,
				suppliers,
			};
		}),

	/**
	 * Full supplier detail: financial summary, order stats, pending orders,
	 * recent history, top products, performance metrics.
	 */
	getSupplierDetail: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/supplier-detail",
			tags: ["Shop Owner"],
			summary: "Get full supplier profile",
		})
		.input(z.object({ warehouseId: z.string() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const whId = input.warehouseId;

			const [shopUser] = await db
				.select({
					id: user.id,
					name: user.name,
					shopName: user.shopName,
					shopAddress: user.shopAddress,
					serviceArea: user.serviceArea,
				})
				.from(user)
				.where(eq(user.id, userId))
				.limit(1);

			const [whUser] = await db
				.select({
					id: user.id,
					name: user.name,
					shopName: user.shopName,
					warehouseName: user.warehouseName,
					phoneNumber: user.phoneNumber,
					email: user.email,
					address: user.warehouseAddress,
				})
				.from(user)
				.where(eq(user.id, whId))
				.limit(1);

			if (!whUser) {
				throw new ORPCError("NOT_FOUND", {
					message: "Supplier not found",
				});
			}

			const [connection] = await db
				.select({
					status: shopWarehouseConnection.status,
					connectedAt: shopWarehouseConnection.connectedAt,
					lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
				})
				.from(shopWarehouseConnection)
				.where(
					and(
						eq(shopWarehouseConnection.shopId, userId),
						eq(shopWarehouseConnection.warehouseId, whId),
					),
				)
				.limit(1);

			const supplierOrders = await db
				.select({
					id: order.id,
					orderNumber: order.orderNumber,
					status: order.status,
					paymentStatus: order.paymentStatus,
					total: order.total,
					createdAt: order.createdAt,
					deliveredAt: order.deliveredAt,
					modifiedByWarehouseAt: order.modifiedByWarehouseAt,
					shippingAddress: order.shippingAddress,
					shippingCity: order.shippingCity,
					shippingArea: order.shippingArea,
					invoicePaymentStatus: invoice.paymentStatus,
				})
				.from(order)
				.leftJoin(
					invoice,
					and(eq(invoice.orderId, order.id), eq(invoice.invoiceType, "main")),
				)
				.where(and(eq(order.userId, userId), eq(order.warehouseId, whId)))
				.orderBy(desc(order.createdAt));

			const orderStats = {
				total: supplierOrders.length,
				pending: 0,
				confirmed: 0,
				processing: 0,
				delivered: 0,
				returned: 0,
				cancelled: 0,
			};

			let totalPurchased = 0;
			let totalPaid = 0;
			let totalDue = 0;
			let payableOrders = 0;

			for (const row of supplierOrders) {
				const total = toSafeNumber(row.total);

				if (row.status === "pending") orderStats.pending += 1;
				if (row.status === "confirmed") orderStats.confirmed += 1;
				if (row.status === "processing") orderStats.processing += 1;
				if (row.status === "delivered") orderStats.delivered += 1;
				if (row.status === "returned") orderStats.returned += 1;
				if (row.status === "cancelled") orderStats.cancelled += 1;

				if (isPurchaseOrderStatus(row.status)) {
					totalPurchased += total;
				}

				if (
					isPurchaseOrderStatus(row.status) &&
					isOrderPaid(row.paymentStatus, row.invoicePaymentStatus)
				) {
					totalPaid += total;
				}

				if (
					isPayableOrder(
						row.status,
						row.paymentStatus,
						row.invoicePaymentStatus,
					)
				) {
					totalDue += total;
					payableOrders += 1;
				}
			}

			const latestOrder = supplierOrders[0] || null;

			const pendingOrders = await db.query.order.findMany({
				where: and(
					eq(order.userId, userId),
					eq(order.warehouseId, whId),
					inArray(order.status, ["pending", "confirmed", "processing"]),
				),
				with: {
					items: {
						columns: {
							id: true,
							productName: true,
							productImage: true,
							quantity: true,
							modifiedQty: true,
						},
					},
				},
				orderBy: [desc(order.createdAt)],
				limit: 5,
			});

			const historyOrderRows = supplierOrders.slice(0, 8);
			const historyOrderIds = historyOrderRows.map((row) => row.id);
			const historyItems = historyOrderIds.length
				? await db
						.select({
							orderId: orderItem.orderId,
							productName: orderItem.productName,
						})
						.from(orderItem)
						.where(inArray(orderItem.orderId, historyOrderIds))
				: [];

			const historyItemMap = new Map<number, string[]>();
			for (const item of historyItems) {
				const existing = historyItemMap.get(item.orderId) ?? [];
				existing.push(item.productName);
				historyItemMap.set(item.orderId, existing);
			}

			const purchaseHistory = historyOrderRows.map((row) => {
				const total = toSafeNumber(row.total);
				const productNames = historyItemMap.get(row.id) ?? [];
				const productSummary =
					productNames.length <= 2
						? productNames.join(", ")
						: `${productNames[0]}, ${productNames[1]} +${productNames.length - 2} more`;
				const paid = isOrderPaid(row.paymentStatus, row.invoicePaymentStatus);
				const dueAmount = isPayableOrder(
					row.status,
					row.paymentStatus,
					row.invoicePaymentStatus,
				)
					? total
					: 0;

				return {
					id: row.id,
					orderNumber: row.orderNumber,
					date: row.createdAt,
					productSummary: productSummary || "Multiple products",
					amount: total,
					orderStatus: row.status,
					paymentStatus: paid ? "paid" : dueAmount > 0 ? "due" : "pending",
					dueAmount,
				};
			});

			const recentHistory = supplierOrders
				.filter((row) =>
					["delivered", "cancelled", "returned"].includes(row.status),
				)
				.slice(0, 5)
				.map((row) => ({
					id: row.id,
					orderNumber: row.orderNumber,
					status: row.status,
					createdAt: row.createdAt,
					total: row.total,
				}));

			const topProducts = await db
				.select({
					productName: orderItem.productName,
					productImage: orderItem.productImage,
					totalQty:
						sql<number>`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity}))`.as(
							"tq",
						),
					orderCount: count(),
				})
				.from(orderItem)
				.innerJoin(order, eq(orderItem.orderId, order.id))
				.where(and(eq(order.userId, userId), eq(order.warehouseId, whId)))
				.groupBy(orderItem.productName, orderItem.productImage)
				.orderBy(
					sql`SUM(COALESCE(${orderItem.modifiedQty}, ${orderItem.quantity})) DESC`,
				)
				.limit(10);

			const perfData = await db
				.select({
					avgDays:
						sql<number>`AVG(EXTRACT(EPOCH FROM (${order.deliveredAt} - ${order.createdAt})) / 86400)`.as(
							"ad",
						),
					modifiedCount:
						sql<number>`count(*) filter (where ${order.modifiedByWarehouseAt} is not null)`.as(
							"mc",
						),
					deliveredTotal:
						sql<number>`count(*) filter (where ${order.status} = 'delivered')`.as(
							"dt",
						),
				})
				.from(order)
				.where(
					and(
						eq(order.userId, userId),
						eq(order.warehouseId, whId),
						eq(order.status, "delivered"),
					),
				);

			const avgDeliveryDays = Math.round(Number(perfData[0]?.avgDays) || 0);
			const deliveredTotal = Number(perfData[0]?.deliveredTotal) || 1;
			const modifiedRate = Math.round(
				((Number(perfData[0]?.modifiedCount) || 0) / deliveredTotal) * 100,
			);

			const assignment = await db.query.customerAssignment.findFirst({
				where: eq(customerAssignment.customerId, userId),
				with: {
					salesman: {
						columns: {
							id: true,
							name: true,
							phoneNumber: true,
							role: true,
							warehouseId: true,
							banned: true,
						},
					},
				},
			});

			const assignedSalesman =
				assignment?.salesman &&
				assignment.salesman.role === "salesman" &&
				assignment.salesman.warehouseId === whId
					? {
							id: assignment.salesman.id,
							name: assignment.salesman.name,
							phone: assignment.salesman.phoneNumber,
							status: assignment.salesman.banned ? "inactive" : "active",
						}
					: null;

			const warehouseAreas = await db.query.deliveryArea.findMany({
				where: and(
					eq(deliveryArea.warehouseId, whId),
					eq(deliveryArea.status, "active"),
				),
				with: {
					schedules: {
						where: eq(deliverySchedule.isActive, true),
						with: {
							defaultRider: {
								columns: {
									name: true,
									phoneNumber: true,
								},
							},
						},
						orderBy: [asc(deliverySchedule.dayOfWeek)],
					},
				},
				orderBy: [asc(deliveryArea.sortOrder), asc(deliveryArea.name)],
			});

			const deliveryHints = [
				{
					source: "shipping_area",
					value: latestOrder?.shippingArea || null,
				},
				{
					source: "shipping_city",
					value: latestOrder?.shippingCity || null,
				},
				{
					source: "service_area",
					value: shopUser?.serviceArea || null,
				},
				{
					source: "shop_address",
					value: shopUser?.shopAddress || latestOrder?.shippingAddress || null,
				},
			].filter((hint) => normalizeDeliveryText(hint.value).length > 0);

			let matchedArea: (typeof warehouseAreas)[number] | null = null;
			let matchSource: string | null = null;

			for (const areaRow of warehouseAreas) {
				const areaTerms = [areaRow.name, areaRow.slug, areaRow.description]
					.map((value) => normalizeDeliveryText(value))
					.filter(Boolean);

				const matchedHint = deliveryHints.find((hint) => {
					const normalizedHint = normalizeDeliveryText(hint.value);
					return areaTerms.some(
						(term) =>
							normalizedHint.includes(term) || term.includes(normalizedHint),
					);
				});

				if (matchedHint) {
					matchedArea = areaRow;
					matchSource = matchedHint.source;
					break;
				}
			}

			const warehouseScheduleMap = new Map<
				number,
				{
					dayOfWeek: number;
					dayName: string;
					areaNames: string[];
					riderName: string | null;
					riderPhone: string | null;
				}
			>();

			for (const areaRow of warehouseAreas) {
				for (const schedule of areaRow.schedules) {
					const existing = warehouseScheduleMap.get(schedule.dayOfWeek) ?? {
						dayOfWeek: schedule.dayOfWeek,
						dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
						areaNames: [],
						riderName: schedule.defaultRider?.name ?? null,
						riderPhone: schedule.defaultRider?.phoneNumber ?? null,
					};

					if (!existing.areaNames.includes(areaRow.name)) {
						existing.areaNames.push(areaRow.name);
					}

					if (!existing.riderName && schedule.defaultRider?.name) {
						existing.riderName = schedule.defaultRider.name;
					}

					if (!existing.riderPhone && schedule.defaultRider?.phoneNumber) {
						existing.riderPhone = schedule.defaultRider.phoneNumber;
					}

					warehouseScheduleMap.set(schedule.dayOfWeek, existing);
				}
			}

			const warehouseWeeklyDays = Array.from(
				warehouseScheduleMap.values(),
			).sort((a, b) => a.dayOfWeek - b.dayOfWeek);
			const matchedWeeklyDays = matchedArea
				? matchedArea.schedules.map((schedule) => ({
						dayOfWeek: schedule.dayOfWeek,
						dayName: DAY_NAMES[schedule.dayOfWeek] || "Unknown",
						areaNames: [matchedArea!.name],
						riderName: schedule.defaultRider?.name ?? null,
						riderPhone: schedule.defaultRider?.phoneNumber ?? null,
					}))
				: [];
			const deliveryScope =
				matchedWeeklyDays.length > 0
					? "matched_area"
					: warehouseWeeklyDays.length > 0
						? "warehouse"
						: "none";
			const effectiveWeeklyDays =
				deliveryScope === "matched_area"
					? matchedWeeklyDays
					: warehouseWeeklyDays;
			const today = new Date();
			const todayDayOfWeek = today.getDay();
			const hasDeliveryToday = effectiveWeeklyDays.some(
				(day) => day.dayOfWeek === todayDayOfWeek,
			);
			const nextDelivery = findNextDeliveryDate(
				effectiveWeeklyDays.map((day) => day.dayOfWeek),
				today,
			);

			return {
				identity: {
					warehouseId: whUser.id,
					name: whUser.warehouseName || whUser.shopName || whUser.name,
					phone: whUser.phoneNumber,
					email: whUser.email,
					address: whUser.address,
					connectionStatus: connection?.status || null,
					connectedAt: connection?.connectedAt || null,
					lastOrderedAt: connection?.lastOrderedAt || null,
				},
				financial: {
					totalPurchased,
					totalPaid,
					totalDue,
					payableOrders,
				},
				business: {
					name: whUser.warehouseName || whUser.shopName || whUser.name,
					phone: whUser.phoneNumber,
					email: whUser.email,
					location: whUser.address,
					yourShopName: shopUser?.shopName || shopUser?.name || null,
					yourAddress:
						shopUser?.shopAddress || latestOrder?.shippingAddress || null,
				},
				orderStats,
				salesman: assignedSalesman,
				delivery: {
					scope: deliveryScope,
					matchSource,
					yourAddress:
						shopUser?.shopAddress || latestOrder?.shippingAddress || null,
					areaHint:
						latestOrder?.shippingArea ||
						latestOrder?.shippingCity ||
						shopUser?.serviceArea ||
						null,
					matchedArea: matchedArea
						? {
								id: matchedArea.id,
								name: matchedArea.name,
								description: matchedArea.description,
							}
						: null,
					availableAreas: warehouseAreas.map((areaRow) => areaRow.name),
					weeklyDays: effectiveWeeklyDays,
					hasDeliveryToday,
					todayDayName: DAY_NAMES[todayDayOfWeek],
					nextDelivery,
					cutoffTime: null,
				},
				accountSummary: {
					totalPurchase: totalPurchased,
					paid: totalPaid,
					payable: totalDue,
					payableOrders,
				},
				purchaseHistory,
				quickInfo: {
					lastOrderNumber: latestOrder?.orderNumber || null,
					lastOrderStatus: latestOrder?.status || null,
					pendingOrders:
						orderStats.pending + orderStats.confirmed + orderStats.processing,
					activeOrders:
						orderStats.pending + orderStats.confirmed + orderStats.processing,
					payableOrders,
					lastDeliveredAt:
						supplierOrders.find((row) => row.status === "delivered")
							?.deliveredAt || null,
				},
				pendingOrders: pendingOrders.map((o: any) => ({
					id: o.id,
					orderNumber: o.orderNumber,
					status: o.status,
					createdAt: o.createdAt,
					total: o.total,
					items: o.items,
				})),
				recentHistory: recentHistory.map((o: any) => ({
					id: o.id,
					orderNumber: o.orderNumber,
					status: o.status,
					createdAt: o.createdAt,
					total: o.total,
				})),
				topProducts: topProducts.map((p) => ({
					name: p.productName,
					image: p.productImage,
					totalQty: Number(p.totalQty),
					orderCount: Number(p.orderCount),
				})),
				performance: {
					avgDeliveryDays,
					modificationRate: modifiedRate,
					orderAccuracy: 100 - modifiedRate,
					deliverySpeed:
						avgDeliveryDays <= 1
							? "Fast"
							: avgDeliveryDays <= 3
								? "Normal"
								: "Slow",
				},
			};
		}),

	/**
	 * Get dashboard summary stats for the shop owner.
	 */
	getDashboardStats: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/dashboard-stats",
			tags: ["Shop Owner"],
			summary: "Get shop owner dashboard summary stats",
		})
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			// Total B2B orders placed
			const [orderStats] = await db
				.select({
					totalOrders: count(order.id),
					totalSpent: sum(order.total),
				})
				.from(order)
				.where(eq(order.userId, userId));

			// Pending orders
			const [pendingStats] = await db
				.select({ count: count(order.id) })
				.from(order)
				.where(and(eq(order.userId, userId), eq(order.status, "pending")));

			// Delivered orders
			const [deliveredStats] = await db
				.select({ count: count(order.id) })
				.from(order)
				.where(and(eq(order.userId, userId), eq(order.status, "delivered")));

			// Retail catalog size (inventory items)
			const [inventoryStats] = await db
				.select({
					totalProducts: count(inventory.id),
					totalStock: sum(inventory.availableQty),
				})
				.from(inventory)
				.where(
					and(eq(inventory.ownerType, "shop"), eq(inventory.ownerId, userId)),
				);

			return {
				totalOrders: orderStats?.totalOrders || 0,
				totalSpent: Number(orderStats?.totalSpent || 0),
				pendingOrders: pendingStats?.count || 0,
				deliveredOrders: deliveredStats?.count || 0,
				retailProducts: inventoryStats?.totalProducts || 0,
				totalStock: Number(inventoryStats?.totalStock || 0),
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Retailer Supplier Management
// ────────────────────────────────────────────────────────────────

const supplierFormSchema = z.object({
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
});

const retailerSupplierQueries = {
	getSuppliers: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/suppliers",
			tags: ["Shop Owner"],
			summary: "List retailer external suppliers",
		})
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

			const suppliers = await db.query.supplier.findMany({
				where: and(...conditions),
				with: {
					category: { columns: { id: true, name: true, slug: true } },
				},
				orderBy: [desc(supplier.createdAt)],
			});

			const supplierIds = suppliers.map((item) => item.id);
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

				for (const total of totals) {
					purchaseTotals[total.supplierId] =
						parseFloat(total.totalPurchase) || 0;
				}
			}

			return {
				suppliers: suppliers.map((item) => ({
					...item,
					categoryName: item.category?.name ?? null,
					totalPurchase: purchaseTotals[item.id] ?? 0,
				})),
			};
		}),

	getSupplierStats: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/suppliers/stats",
			tags: ["Shop Owner"],
			summary: "Get retailer external supplier stats",
		})
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			const allSuppliers = await db.query.supplier.findMany({
				where: eq(supplier.addedBy, userId),
				columns: {
					id: true,
					currentPayable: true,
					status: true,
					isActive: true,
				},
			});

			const activeCount = allSuppliers.filter(
				(item) => item.status === "active",
			).length;
			const totalPayable = allSuppliers.reduce(
				(sum, item) => sum + parseFloat(item.currentPayable),
				0,
			);

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

	getExternalSupplierDetail: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/suppliers/detail",
			tags: ["Shop Owner"],
			summary: "Get retailer external supplier detail",
		})
		.input(z.object({ id: z.number().int() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const sup = await db.query.supplier.findFirst({
				where: and(eq(supplier.id, input.id), eq(supplier.addedBy, userId)),
				with: {
					category: { columns: { id: true, name: true, slug: true } },
				},
			});

			if (!sup) {
				throw new ORPCError("NOT_FOUND", {
					message: "Supplier not found",
				});
			}

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

			const totalPurchaseValue = purchases.reduce(
				(sum, item) => sum + parseFloat(item.total ?? "0"),
				0,
			);

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
						eq(financialLedger.ownerType, "shop"),
						eq(financialLedger.referenceType, "supplier_payment"),
						eq(financialLedger.referenceId, input.id),
					),
				)
				.orderBy(desc(financialLedger.createdAt));

			const billHistory = await db
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
						eq(financialLedger.ownerType, "shop"),
						eq(financialLedger.entryType, "adjustment"),
						eq(financialLedger.referenceType, "adjustment"),
						eq(financialLedger.referenceId, input.id),
						ilike(financialLedger.description, "Supplier bill%"),
					),
				)
				.orderBy(desc(financialLedger.createdAt));

			const supplierAdvances = await db
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
						eq(financialLedger.ownerType, "shop"),
						eq(financialLedger.entryType, "adjustment"),
						ilike(financialLedger.description, "%Supplier advance payment%"),
						ilike(financialLedger.description, `%Supplier: ${sup.name}%`),
					),
				)
				.orderBy(desc(financialLedger.createdAt));

			const totalPaid = payments.reduce(
				(sum, item) => sum + parseFloat(item.amount ?? "0"),
				0,
			);
			const totalBillValue = billHistory.reduce(
				(sum, item) => sum + parseFloat(item.amount ?? "0"),
				0,
			);
			const totalSupplierAdvance = supplierAdvances.reduce(
				(sum, item) => sum + parseFloat(item.amount ?? "0"),
				0,
			);

			const cashPurchaseTotal = purchases
				.filter((item) => item.paymentType === "cash")
				.reduce((sum, item) => sum + parseFloat(item.total ?? "0"), 0);

			const productMap = new Map<
				string,
				{ totalQty: number; totalValue: number }
			>();
			for (const purchaseRow of purchases) {
				for (const item of purchaseRow.items) {
					const existing = productMap.get(item.productName) ?? {
						totalQty: 0,
						totalValue: 0,
					};
					existing.totalQty += parseFloat(item.quantity ?? "0");
					existing.totalValue += parseFloat(item.totalCost ?? "0");
					productMap.set(item.productName, existing);
				}
			}

			const productBreakdown = Array.from(productMap.entries())
				.map(([productName, data]) => ({
					productName,
					totalQty: data.totalQty,
					totalValue: data.totalValue,
				}))
				.sort((a, b) => b.totalValue - a.totalValue)
				.slice(0, 30);

			const currentPayable = parseFloat(sup.currentPayable ?? "0");
			const purchaseHistory = purchases.map((purchaseRow) => {
				const total = parseFloat(purchaseRow.total ?? "0");
				const isCash = purchaseRow.paymentType === "cash";

				return {
					id: purchaseRow.id,
					purchaseNumber: purchaseRow.purchaseNumber,
					purchaseDate: purchaseRow.purchaseDate,
					itemCount: purchaseRow.items.length,
					total,
					paid: isCash ? total : 0,
					due: isCash ? 0 : total,
					status: purchaseRow.status,
					paymentType: purchaseRow.paymentType,
					discount: purchaseRow.discount,
					transportCost: purchaseRow.transportCost,
					note: purchaseRow.note,
					createdAt: purchaseRow.createdAt,
					items: purchaseRow.items.map((item) => ({
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
				billHistory,
				payments,
				supplierAdvances,
				totalPurchaseValue,
				totalBillValue,
				totalPaid: totalPaid + cashPurchaseTotal,
				totalSupplierAdvance,
				currentPayable,
			};
		}),

	getSupplierCategories: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/suppliers/categories",
			tags: ["Shop Owner"],
			summary: "Get retailer supplier categories",
		})
		.handler(async () => {
			const categories = await db
				.select({
					id: category.id,
					name: category.name,
					slug: category.slug,
				})
				.from(category)
				.where(eq(category.isActive, true))
				.orderBy(category.name);

			return { categories };
		}),

	createSupplier: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/suppliers/create",
			tags: ["Shop Owner"],
			summary: "Create retailer external supplier",
		})
		.input(supplierFormSchema)
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

	recordSupplierBill: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/suppliers/record-bill",
			tags: ["Shop Owner"],
			summary: "Record retailer supplier bill payable",
		})
		.input(
			z.object({
				amount: z.number().positive(),
				billNo: z.string().max(120).optional().nullable(),
				referenceNo: z.string().max(120).optional().nullable(),
				supplierId: z.number().int(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const sup = await db.query.supplier.findFirst({
				where: and(
					eq(supplier.id, input.supplierId),
					eq(supplier.addedBy, userId),
				),
			});

			if (!sup) {
				throw new ORPCError("NOT_FOUND", { message: "Supplier not found" });
			}

			const nextPayable = parseFloat(sup.currentPayable ?? "0") + input.amount;

			await db.transaction(async (tx) => {
				await tx
					.update(supplier)
					.set({
						currentPayable: nextPayable.toFixed(2),
						updatedAt: new Date(),
					})
					.where(eq(supplier.id, input.supplierId));

				await tx.insert(financialLedger).values({
					amount: input.amount.toFixed(2),
					description: [
						"Supplier bill tracker",
						`Supplier: ${sup.name}`,
						input.billNo?.trim() ? `Bill: ${input.billNo.trim()}` : null,
						input.referenceNo?.trim()
							? `Reference: ${input.referenceNo.trim()}`
							: null,
					]
						.filter(Boolean)
						.join(" | "),
					direction: "credit",
					entryType: "adjustment",
					ownerId: userId,
					ownerType: "shop",
					referenceId: 0,
					referenceType: "adjustment",
				});
			});

			return {
				message: "Supplier bill recorded",
				payable: nextPayable.toFixed(2),
			};
		}),

	updateSupplier: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/suppliers/update",
			tags: ["Shop Owner"],
			summary: "Update retailer external supplier",
		})
		.input(
			supplierFormSchema.extend({
				id: z.number().int(),
				isActive: z.boolean().optional(),
				status: z.enum(["active", "suspended"]).optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
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
				throw new ORPCError("NOT_FOUND", {
					message: "Supplier not found",
				});
			}

			return { supplier: updated };
		}),

	deleteSupplier: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/suppliers/delete",
			tags: ["Shop Owner"],
			summary: "Delete retailer external supplier",
		})
		.input(z.object({ id: z.number().int() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			await db
				.delete(supplier)
				.where(and(eq(supplier.id, input.id), eq(supplier.addedBy, userId)));

			return { success: true };
		}),
};

// Incoming B2C Orders (consumers buying from this shop)
async function approveRetailerOrder(shopId: string, orderId: number) {
	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${orderId})`);
		const existingOrder = await tx.query.order.findFirst({
			where: and(
				eq(order.id, orderId),
				eq(order.shopId, shopId),
				eq(order.orderType, "b2c"),
			),
		});
		if (!existingOrder) {
			throw new ORPCError("NOT_FOUND", {
				message: "Order not found or not owned by your shop",
			});
		}
		const transition = getRetailerOrderTransition(
			existingOrder.status,
			"confirm",
		);
		if (!transition) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Order cannot be approved from '${existingOrder.status}'`,
			});
		}

		const now = new Date();
		const updated = await tx
			.update(order)
			.set({
				status: transition.nextStatus,
				confirmedAt: now,
				readyAt: now,
			})
			.where(
				and(
					eq(order.id, orderId),
					eq(order.shopId, shopId),
					eq(order.orderType, "b2c"),
					eq(order.status, existingOrder.status),
				),
			)
			.returning({ id: order.id });
		if (updated.length !== 1) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Order was already updated by another request",
			});
		}
		return {
			success: true,
			status: transition.nextStatus,
			message: `Order ${existingOrder.orderNumber} is ready for invoicing`,
		};
	});
}

const incomingOrderQueries = {
	/** List B2C consumer orders placed to this shop */
	getIncomingOrders: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/incoming-orders",
			tags: ["Shop Owner"],
			summary: "Get incoming B2C consumer orders for this shop",
		})
		.input(
			z.object({
				status: z
					.enum([
						"all",
						"pending",
						"confirmed",
						"ready_for_dispatch",
						"invoiced",
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

			const conditions: SQL[] = [
				eq(order.shopId, userId),
				eq(order.orderType, "b2c"),
			];

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
						locationLat: order.locationLat,
						locationLng: order.locationLng,
						consumerAreaId: order.consumerAreaId,
						createdAt: order.createdAt,
						customerId: order.userId,
						customerName: user.name,
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

			const fulfillmentRows =
				orderIds.length > 0
					? await db
							.select({
								orderId: invoice.orderId,
								invoiceId: invoice.id,
								invoiceNumber: invoice.invoiceNumber,
								fulfillmentMode: invoice.fulfillmentMode,
								deliveryStatus: invoice.deliveryStatus,
								groupId: deliveryGroup.id,
								groupStatus: deliveryGroup.status,
								linkStatus: deliveryGroupInvoice.status,
								deliverymanId: deliveryGroup.deliverymanId,
								assignedAt: deliveryGroup.assignedAt,
								startedAt: deliveryGroup.startedAt,
							})
							.from(invoice)
							.leftJoin(
								deliveryGroupInvoice,
								eq(deliveryGroupInvoice.invoiceId, invoice.id),
							)
							.leftJoin(
								deliveryGroup,
								eq(deliveryGroup.id, deliveryGroupInvoice.groupId),
							)
							.where(inArray(invoice.orderId, orderIds))
					: [];
			const fulfillmentByOrder = new Map<
				number,
				(typeof fulfillmentRows)[number]
			>();
			const groupPriority = (row: (typeof fulfillmentRows)[number]) => {
				if (
					row.linkStatus === "pending" &&
					["pending_assignment", "assigned", "out_for_delivery"].includes(
						row.groupStatus ?? "",
					)
				) {
					return 2;
				}
				return row.groupId ? 1 : 0;
			};
			for (const row of fulfillmentRows) {
				const current = row.orderId
					? fulfillmentByOrder.get(row.orderId)
					: undefined;
				if (
					row.orderId &&
					(!current || groupPriority(row) > groupPriority(current))
				) {
					fulfillmentByOrder.set(row.orderId, row);
				}
			}

			const totalCount = Number(countResult[0]?.count) || 0;

			return {
				orders: orders.map((o) => {
					const fulfillment = fulfillmentByOrder.get(o.id) ?? null;
					return {
						...o,
						items: itemsByOrder.get(o.id) || [],
						fulfillment:
							fulfillment?.deliveryStatus === "not_assigned"
								? {
										...fulfillment,
										groupId: null,
										groupStatus: null,
										linkStatus: null,
										deliverymanId: null,
										assignedAt: null,
										startedAt: null,
									}
								: fulfillment,
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

	/** Full owner-scoped detail for retailer order review. */
	getIncomingOrderById: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/incoming-orders/{orderId}",
			tags: ["Shop Owner"],
			summary: "Get incoming retailer order detail",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			const detail = await db.query.order.findFirst({
				where: and(
					eq(order.id, input.orderId),
					eq(order.shopId, shopId),
					eq(order.orderType, "b2c"),
				),
				with: { items: true },
			});
			if (!detail) {
				throw new ORPCError("NOT_FOUND", {
					message: "Order not found",
				});
			}
			const [customer, orderInvoices] = await Promise.all([
				db.query.user.findFirst({
					where: eq(user.id, detail.userId),
					columns: {
						id: true,
						name: true,
						email: true,
						phoneNumber: true,
					},
				}),
				db.query.invoice.findMany({
					where: eq(invoice.orderId, detail.id),
					with: { items: true, deliveryman: true },
					orderBy: [desc(invoice.createdAt)],
				}),
			]);
			const invoiceIds = orderInvoices.map((entry) => entry.id);
			const links =
				invoiceIds.length > 0
					? await db.query.deliveryGroupInvoice.findMany({
							where: inArray(deliveryGroupInvoice.invoiceId, invoiceIds),
							with: { group: { with: { deliveryman: true } } },
						})
					: [];
			return {
				order: {
					...detail,
					customer,
					invoices: orderInvoices,
					deliveryLinks: links,
				},
			};
		}),

	/** Canonical operational approval. Consumer tracking still projects this as Store confirmed. */
	approveIncomingOrder: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/incoming-orders/{orderId}/approve",
			tags: ["Shop Owner"],
			summary: "Approve an incoming B2C consumer order",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(({ context, input }) =>
			approveRetailerOrder(context.session.user.id, input.orderId),
		),

	/** Compatibility wrapper for clients that still call confirmation. */
	confirmIncomingOrder: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/incoming-orders/{orderId}/confirm",
			tags: ["Shop Owner"],
			summary: "Confirm an incoming B2C consumer order",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(({ context, input }) =>
			approveRetailerOrder(context.session.user.id, input.orderId),
		),

	/** Cancel a retailer order before invoicing and restore reserved stock. */
	cancelIncomingOrder: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/incoming-orders/{orderId}/cancel",
			tags: ["Shop Owner"],
			summary: "Cancel an incoming B2C consumer order",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;

			return db.transaction(async (tx) => {
				await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.orderId})`);
				const existingOrder = await tx.query.order.findFirst({
					where: and(
						eq(order.id, input.orderId),
						eq(order.shopId, shopId),
						eq(order.orderType, "b2c"),
					),
					with: { items: true },
				});
				if (!existingOrder) {
					throw new ORPCError("NOT_FOUND", {
						message: "Order not found or not owned by your shop",
					});
				}
				const transition = getRetailerOrderTransition(
					existingOrder.status,
					"cancel",
				);
				if (!transition) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Only orders that have not been invoiced can be cancelled",
					});
				}

				try {
					await restoreRetailerOrderStock(
						createRetailerOrderStockWriter(tx),
						shopId,
						existingOrder.items,
					);
				} catch (error) {
					if (error instanceof RetailerOrderStockError) {
						throw new ORPCError("BAD_REQUEST", {
							message: error.message,
						});
					}
					throw error;
				}

				const cancelled = await tx
					.update(order)
					.set({ status: "cancelled", cancelledAt: new Date() })
					.where(
						and(
							eq(order.id, input.orderId),
							eq(order.shopId, shopId),
							eq(order.status, existingOrder.status),
						),
					)
					.returning({ id: order.id });
				if (cancelled.length !== 1) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Order was already updated by another request",
					});
				}

				return { success: true, status: "cancelled" as const };
			});
		}),

	/** Create the one full invoice for a retailer order. */
	createIncomingOrderInvoice: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/incoming-orders/{orderId}/invoice",
			tags: ["Shop Owner"],
			summary: "Create a full invoice for an incoming B2C order",
		})
		.input(
			z.object({
				orderId: z.number(),
				fulfillmentMode: z
					.enum(["delivery", "self_pickup"])
					.default("delivery"),
			}),
		)
		.handler(async ({ context, input }) => {
			return createRetailerDispatchInvoiceForOrder({
				shopId: context.session.user.id,
				orderId: input.orderId,
				fulfillmentMode: input.fulfillmentMode,
			});
		}),

	configureIncomingOrderFulfillment: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/incoming-orders/fulfillment",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Configure retailer invoice fulfillment",
		})
		.input(
			z.object({
				invoiceId: z.number(),
				fulfillmentMode: z.enum(["delivery", "self_pickup"]),
			}),
		)
		.handler(async ({ context, input }) => {
			const result = await configureExistingInvoiceFulfillmentForOwner({
				owner: { kind: "shop", id: context.session.user.id },
				invoiceId: input.invoiceId,
				fulfillmentMode: input.fulfillmentMode,
			});
			return {
				success: true,
				invoiceId: result.invoice.id,
				invoiceNumber: result.invoice.invoiceNumber,
				fulfillmentMode: input.fulfillmentMode,
				completionOtp: result.completionOtp,
				message:
					input.fulfillmentMode === "self_pickup"
						? "Self pickup is ready. Ask the consumer for their pickup code at handover."
						: "Invoice saved for delivery management.",
			};
		}),

	verifyIncomingSelfPickup: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/incoming-orders/self-pickup/verify",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Verify a retailer self-pickup OTP",
		})
		.input(
			z.object({
				invoiceId: z.number(),
				otp: z.string().length(4),
				acceptedReturns: z
					.array(
						z.object({
							orderItemId: z.number().int().positive(),
							quantity: z.number().int().min(0),
						}),
					)
					.default([]),
				handoffBalancePaid: z.boolean().default(false),
				handoffPaymentMethod: z.string().trim().max(30).optional(),
				handoffPaymentReference: z.string().trim().max(150).optional(),
			}),
		)
		.handler(async ({ context, input }) =>
			completeSelfPickupInvoice({
				owner: { kind: "shop", id: context.session.user.id },
				invoiceId: input.invoiceId,
				otp: input.otp,
				paymentStatus: "collected",
				markOrderPaid: true,
				acceptedReturns: input.acceptedReturns,
				handoffBalancePaid: input.handoffBalancePaid,
				handoffPaymentMethod: input.handoffPaymentMethod,
				handoffPaymentReference: input.handoffPaymentReference,
			}),
		),

	/** Orders shown at the retailer dispatch desk. */
	getRetailDispatchOrders: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/dispatch-orders",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Get retailer dispatch orders",
		})
		.input(
			z.object({
				view: z
					.enum(["ready_for_dispatch", "invoiced"])
					.default("ready_for_dispatch"),
				search: z.string().trim().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopProfile = await db.query.user.findFirst({
				where: eq(user.id, context.session.user.id),
				columns: {
					shopName: true,
					name: true,
					phoneNumber: true,
					shopAddress: true,
				},
			});
			const conditions: SQL[] = [
				eq(order.shopId, context.session.user.id),
				eq(order.orderType, "b2c"),
				inArray(order.status, getRetailerDispatchQueryStatuses(input.view)),
			];
			if (input.search) {
				conditions.push(
					or(
						ilike(order.orderNumber, `%${input.search}%`),
						ilike(order.shippingName, `%${input.search}%`),
						ilike(order.shippingPhone, `%${input.search}%`),
					) as SQL,
				);
			}
			const orders = await db.query.order.findMany({
				where: and(...conditions),
				with: { items: true },
				orderBy: [desc(order.createdAt)],
			});
			const ids = orders.map((entry) => entry.id);
			const invoices =
				ids.length > 0
					? await db.query.invoice.findMany({
							where: inArray(invoice.orderId, ids),
							with: { items: true },
						})
					: [];
			const invoiceByOrder = new Map(
				invoices.map((entry) => [entry.orderId, entry]),
			);
			return {
				pickupAvailable: Boolean(shopProfile?.shopAddress?.trim()),
				pickupLocation: shopProfile?.shopAddress
					? {
							name: shopProfile.shopName || shopProfile.name,
							address: shopProfile.shopAddress,
							phone: shopProfile.phoneNumber,
						}
					: null,
				orders: orders.map((entry) => ({
					...entry,
					status: getRetailerDispatchQueueStatus(entry.status),
					invoice: invoiceByOrder.get(entry.id) ?? null,
				})),
			};
		}),

	/** Full invoices used by retailer Delivery Management. */
	getRetailDeliveryInvoices: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/delivery-management/invoices",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Get retailer delivery-management invoices",
		})
		.input(
			z.object({
				status: z
					.enum([
						"all",
						"not_assigned",
						"pending",
						"out_for_delivery",
						"delivered",
						"failed",
						"returned",
					])
					.default("all"),
			}),
		)
		.handler(async ({ context, input }) => {
			const conditions: SQL[] = [
				eq(invoice.fulfillmentMode, "internal_delivery"),
				sql`EXISTS (
                    SELECT 1 FROM "order" scoped_order
                    WHERE scoped_order."id" = ${invoice.orderId}
                      AND scoped_order."shop_id" = ${context.session.user.id}
                      AND scoped_order."order_type" = 'b2c'
                )`,
			];
			if (input.status !== "all") {
				conditions.push(eq(invoice.deliveryStatus, input.status));
			}
			const invoices = await db.query.invoice.findMany({
				where: and(...conditions),
				with: {
					order: true,
					customer: {
						columns: { id: true, name: true, phoneNumber: true },
					},
					items: true,
					deliveryman: {
						columns: { id: true, name: true, phoneNumber: true },
					},
				},
				orderBy: [desc(invoice.createdAt)],
			});
			const ids = invoices.map((entry) => entry.id);
			const links =
				ids.length > 0
					? await db.query.deliveryGroupInvoice.findMany({
							where: inArray(deliveryGroupInvoice.invoiceId, ids),
							with: { group: { with: { deliveryman: true } } },
						})
					: [];
			const linkByInvoice = new Map(
				links.map((entry) => [entry.invoiceId, entry]),
			);
			return {
				invoices: invoices.map((entry) => ({
					...entry,
					deliveryGroupLink: linkByInvoice.get(entry.id) ?? null,
				})),
			};
		}),

	/** Owner-scoped groups and rider KPIs shared by both assignment lenses. */
	getRetailAssignmentOverview: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/delivery-team/assignments",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Get retailer assignment overview",
		})
		.handler(async ({ context }) => {
			const shopId = context.session.user.id;
			const [groups, riders] = await Promise.all([
				db.query.deliveryGroup.findMany({
					where: eq(deliveryGroup.shopId, shopId),
					with: {
						deliveryman: true,
						invoices: {
							with: {
								invoice: {
									with: { order: true, customer: true },
								},
							},
							orderBy: [deliveryGroupInvoice.sequence],
						},
					},
					orderBy: [desc(deliveryGroup.createdAt)],
				}),
				db.query.user.findMany({
					where: and(eq(user.shopId, shopId), eq(user.role, "deliveryman")),
					orderBy: [asc(user.name)],
				}),
			]);
			const activeStatuses = new Set([
				"assigned",
				"out_for_delivery",
				"partial",
			]);
			const busyIds = new Set(
				groups
					.filter((entry) => activeStatuses.has(entry.status))
					.map((entry) => entry.deliverymanId)
					.filter((id): id is string => Boolean(id)),
			);
			return {
				groups,
				deliverymen: riders.map((entry) => ({
					...entry,
					hasActiveGroup: busyIds.has(entry.id),
				})),
				stats: {
					pendingGroups: groups.filter(
						(entry) => entry.status === "pending_assignment",
					).length,
					assignedGroups: groups.filter((entry) => entry.status === "assigned")
						.length,
					activeGroups: groups.filter(
						(entry) => entry.status === "out_for_delivery",
					).length,
					availableRiders: riders.filter(
						(entry) => !entry.banned && !busyIds.has(entry.id),
					).length,
				},
			};
		}),

	/** List riders employed by this retailer store. */
	getRetailDeliverymen: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/delivery-team",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Get retailer delivery team",
		})
		.handler(async ({ context }) => {
			const shopId = context.session.user.id;
			const deliverymen = await db
				.select({
					id: user.id,
					name: user.name,
					email: user.email,
					phoneNumber: user.phoneNumber,
					serviceArea: user.serviceArea,
					banned: user.banned,
					createdAt: user.createdAt,
				})
				.from(user)
				.where(and(eq(user.shopId, shopId), eq(user.role, "deliveryman")))
				.orderBy(user.name);

			const activeGroups =
				deliverymen.length > 0
					? await db
							.select({
								deliverymanId: deliveryGroup.deliverymanId,
								groupId: deliveryGroup.id,
							})
							.from(deliveryGroup)
							.where(
								and(
									eq(deliveryGroup.shopId, shopId),
									inArray(deliveryGroup.status, [
										"assigned",
										"out_for_delivery",
									]),
								),
							)
					: [];
			const activeByRider = new Map(
				activeGroups.map((entry) => [entry.deliverymanId, entry.groupId]),
			);

			return {
				deliverymen: deliverymen.map((entry) => ({
					...entry,
					banned: entry.banned ?? false,
					activeGroupId: activeByRider.get(entry.id) ?? null,
				})),
			};
		}),

	getRetailDeliverymanById: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/delivery-team/{deliverymanId}",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Get retailer rider detail",
		})
		.input(z.object({ deliverymanId: z.string() }))
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			const rider = await db.query.user.findFirst({
				where: and(
					eq(user.id, input.deliverymanId),
					eq(user.shopId, shopId),
					eq(user.role, "deliveryman"),
				),
			});
			if (!rider)
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery rider not found",
				});
			const groups = await db.query.deliveryGroup.findMany({
				where: and(
					eq(deliveryGroup.shopId, shopId),
					eq(deliveryGroup.deliverymanId, rider.id),
				),
				with: { invoices: true },
				orderBy: [desc(deliveryGroup.createdAt)],
			});
			return { rider, groups };
		}),

	updateRetailDeliveryman: shopOwnerProcedure
		.route({
			method: "PATCH",
			path: "/shop-owner/delivery-team/{deliverymanId}",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Update retailer delivery rider",
		})
		.input(
			z.object({
				deliverymanId: z.string(),
				name: z.string().trim().min(2).max(100),
				phoneNumber: z.string().trim().max(20).nullable().optional(),
				serviceArea: z.string().trim().max(200).nullable().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const [updated] = await db
				.update(user)
				.set({
					name: input.name,
					phoneNumber: input.phoneNumber ?? null,
					serviceArea: input.serviceArea ?? null,
				})
				.where(
					and(
						eq(user.id, input.deliverymanId),
						eq(user.shopId, context.session.user.id),
						eq(user.role, "deliveryman"),
					),
				)
				.returning({ id: user.id });
			if (!updated)
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery rider not found",
				});
			return { success: true };
		}),

	resetRetailDeliverymanPassword: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/delivery-team/{deliverymanId}/reset-password",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Reset retailer delivery rider password",
		})
		.input(
			z.object({
				deliverymanId: z.string(),
				newPassword: z.string().min(8).max(100),
			}),
		)
		.handler(async ({ context, input }) => {
			const rider = await db.query.user.findFirst({
				where: and(
					eq(user.id, input.deliverymanId),
					eq(user.shopId, context.session.user.id),
					eq(user.role, "deliveryman"),
				),
				columns: { id: true },
			});
			if (!rider)
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery rider not found",
				});
			await setCredentialPassword(rider.id, input.newPassword);
			return { success: true };
		}),

	toggleRetailDeliverymanBan: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/delivery-team/{deliverymanId}/ban",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Ban or restore retailer delivery rider",
		})
		.input(
			z.object({
				deliverymanId: z.string(),
				banned: z.boolean(),
				reason: z.string().max(200).optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const rider = await db.query.user.findFirst({
				where: and(
					eq(user.id, input.deliverymanId),
					eq(user.shopId, context.session.user.id),
					eq(user.role, "deliveryman"),
				),
				columns: { id: true },
			});
			if (!rider)
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery rider not found",
				});
			const headers = new Headers({
				Authorization: `Bearer ${context.session.session.token}`,
			});
			if (input.banned) {
				await auth.api.banUser({
					body: {
						userId: rider.id,
						banReason: input.reason || "Banned by retailer",
					},
					headers,
				});
			} else {
				await auth.api.unbanUser({
					body: { userId: rider.id },
					headers,
				});
			}
			return { success: true };
		}),

	deleteRetailDeliveryman: shopOwnerProcedure
		.route({
			method: "DELETE",
			path: "/shop-owner/delivery-team/{deliverymanId}",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Delete retailer delivery rider",
		})
		.input(z.object({ deliverymanId: z.string() }))
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			const rider = await db.query.user.findFirst({
				where: and(
					eq(user.id, input.deliverymanId),
					eq(user.shopId, shopId),
					eq(user.role, "deliveryman"),
				),
				columns: { id: true },
			});
			if (!rider)
				throw new ORPCError("NOT_FOUND", {
					message: "Delivery rider not found",
				});
			const activeGroup = await db.query.deliveryGroup.findFirst({
				where: and(
					eq(deliveryGroup.shopId, shopId),
					eq(deliveryGroup.deliverymanId, rider.id),
					inArray(deliveryGroup.status, [
						"assigned",
						"out_for_delivery",
						"partial",
					]),
				),
				columns: { id: true },
			});
			if (activeGroup) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Complete or reassign the rider's active group before deleting them",
				});
			}
			await auth.api.removeUser({
				body: { userId: rider.id },
				headers: new Headers({
					Authorization: `Bearer ${context.session.session.token}`,
				}),
			});
			return { success: true };
		}),

	/** Create a rider account owned by this retailer store. */
	createRetailDeliveryman: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/delivery-team",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Create a retailer delivery rider",
		})
		.input(
			z.object({
				name: z.string().trim().min(2).max(100),
				email: z.string().trim().email(),
				password: z.string().min(8).max(100),
				phoneNumber: z.string().trim().max(20).optional(),
				serviceArea: z.string().trim().max(200).optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			const newUser = await auth.api.createUser({
				body: {
					email: input.email,
					password: input.password,
					name: input.name,
					role: "deliveryman",
					data: { phoneNumber: input.phoneNumber || null },
				},
			});
			if (!newUser?.user) {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to create delivery rider",
				});
			}

			await db
				.update(user)
				.set({
					shopId,
					warehouseId: null,
					serviceArea: input.serviceArea || null,
				})
				.where(eq(user.id, newUser.user.id));

			return {
				success: true,
				deliveryman: {
					id: newUser.user.id,
					name: newUser.user.name,
					email: newUser.user.email,
					phoneNumber: input.phoneNumber ?? null,
				},
			};
		}),

	/** Put an invoiced consumer order into a retailer-owned delivery group. */
	createIncomingDeliveryGroup: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/incoming-orders/{orderId}/delivery-group",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Create a retailer delivery group",
		})
		.input(
			z.object({
				orderId: z.number(),
				groupName: z.string().trim().min(1).max(120),
				vehicleType: z.enum(["bike", "car", "van", "truck"]).optional(),
				expectedDeliveryAt: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			return db.transaction(async (tx) => {
				await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.orderId})`);
				const existingInvoice = await tx.query.invoice.findFirst({
					where: and(
						eq(invoice.orderId, input.orderId),
						eq(invoice.invoiceType, "main"),
						sql`EXISTS (
                            SELECT 1 FROM "order" scoped_order
                            WHERE scoped_order."id" = ${invoice.orderId}
                              AND scoped_order."shop_id" = ${shopId}
                              AND scoped_order."order_type" = 'b2c'
                        )`,
					),
					with: { order: true },
				});
				if (!existingInvoice?.order) {
					throw new ORPCError("NOT_FOUND", {
						message: "Invoiced retailer order not found",
					});
				}
				if (
					existingInvoice.fulfillmentMode !== "internal_delivery" ||
					existingInvoice.deliveryStatus !== "not_assigned"
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: "This invoice is not ready for delivery grouping",
					});
				}
				const existingLink = await tx.query.deliveryGroupInvoice.findFirst({
					where: and(
						eq(deliveryGroupInvoice.invoiceId, existingInvoice.id),
						eq(deliveryGroupInvoice.status, "pending"),
					),
				});
				if (existingLink) {
					throw new ORPCError("BAD_REQUEST", {
						message: "This invoice already belongs to a delivery group",
					});
				}

				const [group] = await tx
					.insert(deliveryGroup)
					.values({
						groupName: input.groupName,
						shopId,
						warehouseId: null,
						deliverymanId: null,
						status: "pending_assignment",
						totalInvoices: 1,
						completedInvoices: 0,
						vehicleType: input.vehicleType ?? null,
						expectedDeliveryAt: input.expectedDeliveryAt
							? new Date(input.expectedDeliveryAt)
							: null,
						assignedAt: null,
					})
					.returning();
				if (!group) {
					throw new ORPCError("INTERNAL_SERVER_ERROR", {
						message: "Failed to create delivery group",
					});
				}

				await tx.insert(deliveryGroupInvoice).values({
					groupId: group.id,
					invoiceId: existingInvoice.id,
					sequence: 0,
					status: "pending",
				});
				await tx
					.update(invoice)
					.set({
						deliveryStatus: "pending",
						deliverymanId: null,
						vehicleType: input.vehicleType ?? null,
						expectedDeliveryAt: input.expectedDeliveryAt
							? new Date(input.expectedDeliveryAt)
							: null,
					})
					.where(eq(invoice.id, existingInvoice.id));

				return { success: true, group };
			});
		}),

	/** Assign or reassign a store rider before the trip starts. */
	assignIncomingDeliveryman: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/delivery-groups/{groupId}/assign",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Assign a retailer rider to a delivery group",
		})
		.input(
			z.object({
				groupId: z.number(),
				deliverymanId: z.string(),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			return db.transaction(async (tx) => {
				await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.groupId})`);
				const group = await tx.query.deliveryGroup.findFirst({
					where: and(
						eq(deliveryGroup.id, input.groupId),
						eq(deliveryGroup.shopId, shopId),
					),
				});
				if (!group) {
					throw new ORPCError("NOT_FOUND", {
						message: "Delivery group not found",
					});
				}
				if (!["pending_assignment", "assigned"].includes(group.status)) {
					throw new ORPCError("BAD_REQUEST", {
						message: "A rider cannot be changed after the trip starts",
					});
				}

				const rider = await tx.query.user.findFirst({
					where: and(
						eq(user.id, input.deliverymanId),
						eq(user.shopId, shopId),
						eq(user.role, "deliveryman"),
						sql`COALESCE(${user.banned}, false) = false`,
					),
				});
				if (!rider) {
					throw new ORPCError("NOT_FOUND", {
						message: "Delivery rider not found for this store",
					});
				}
				const activeGroup = await tx.query.deliveryGroup.findFirst({
					where: and(
						eq(deliveryGroup.shopId, shopId),
						eq(deliveryGroup.deliverymanId, rider.id),
						sql`${deliveryGroup.id} <> ${group.id}`,
						inArray(deliveryGroup.status, ["assigned", "out_for_delivery"]),
					),
				});
				if (activeGroup) {
					throw new ORPCError("BAD_REQUEST", {
						message: "This rider already has an active delivery group",
					});
				}

				await tx
					.update(deliveryGroup)
					.set({
						deliverymanId: rider.id,
						status: "assigned",
						assignedAt: new Date(),
					})
					.where(eq(deliveryGroup.id, group.id));
				const links = await tx.query.deliveryGroupInvoice.findMany({
					where: eq(deliveryGroupInvoice.groupId, group.id),
					with: { invoice: true },
				});
				const invoiceIds = links.map((entry) => entry.invoiceId);
				if (invoiceIds.length > 0) {
					await tx
						.update(invoice)
						.set({ deliverymanId: rider.id })
						.where(inArray(invoice.id, invoiceIds));
					const orderIds = [
						...new Set(
							links
								.map((entry) => entry.invoice?.orderId)
								.filter((id): id is number => typeof id === "number"),
						),
					];
					if (orderIds.length > 0) {
						await tx
							.update(order)
							.set({
								riderName: rider.name,
								riderPhone: rider.phoneNumber,
							})
							.where(inArray(order.id, orderIds));
					}
				}

				return { success: true, status: "assigned" as const };
			});
		}),

	/** Return a failed consumer delivery to the retailer assignment queue. */
	retryIncomingDelivery: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/incoming-orders/{orderId}/retry-delivery",
			tags: ["Shop Owner", "Delivery Management"],
			summary: "Retry a failed retailer delivery",
		})
		.input(z.object({ orderId: z.number() }))
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			return db.transaction(async (tx) => {
				await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.orderId})`);
				const failedInvoice = await tx.query.invoice.findFirst({
					where: and(
						eq(invoice.orderId, input.orderId),
						eq(invoice.deliveryStatus, "failed"),
						sql`EXISTS (
                            SELECT 1 FROM "order" scoped_order
                            WHERE scoped_order."id" = ${invoice.orderId}
                              AND scoped_order."shop_id" = ${shopId}
                              AND scoped_order."order_type" = 'b2c'
                        )`,
					),
				});
				if (!failedInvoice) {
					throw new ORPCError("BAD_REQUEST", {
						message: "No failed delivery is available to retry",
					});
				}

				await tx
					.update(invoice)
					.set({
						deliveryStatus: "not_assigned",
						deliverymanId: null,
					})
					.where(eq(invoice.id, failedInvoice.id));
				await tx
					.update(order)
					.set({
						status: "invoiced",
						riderName: null,
						riderPhone: null,
					})
					.where(eq(order.id, input.orderId));

				return { success: true, status: "invoiced" as const };
			});
		}),
};

// ────────────────────────────────────────────────────────────────
// Warehouse Order Queries (Shop ordering from Warehouses)
// ────────────────────────────────────────────────────────────────

const warehouseOrderQueries = {
	/**
	 * Place an order to a warehouse.
	 * Creates order + items. Warehouse inventory is reserved during approval.
	 */
	placeWarehouseOrder: shopOwnerProcedure
		.input(
			z.object({
				warehouseSlug: z.string(),
				items: z
					.array(
						z.object({
							variantId: z.number(),
							quantity: z.number().int().min(1),
							supplyMode: warehouseOrderModeSchema.optional(),
							fulfillmentMode: warehouseOrderModeSchema.optional(),
							targetVariantId: z.number().optional().nullable(),
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
					.nullable()
					.default("cash_on_delivery"),
				checkout: wholesaleCheckoutSubmissionSchema.optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			if (input.checkout?.idempotencyKey) {
				const existingOrder = await db.query.order.findFirst({
					where: and(
						eq(order.userId, userId),
						eq(order.checkoutIdempotencyKey, input.checkout.idempotencyKey),
					),
				});
				if (existingOrder) {
					return {
						success: true,
						order: existingOrder,
						message: `Order ${existingOrder.orderNumber} was already placed`,
					};
				}
			}

			// 1. Find warehouse
			const warehouseUser = await db
				.select({
					id: user.id,
					name: user.name,
					warehouseName: user.warehouseName,
				})
				.from(user)
				.where(
					and(
						eq(user.warehouseSlug, input.warehouseSlug),
						eq(user.role, "warehouse"),
					),
				)
				.limit(1);

			if (warehouseUser.length === 0) {
				throw new ORPCError("NOT_FOUND", {
					message: "Warehouse not found",
				});
			}

			const warehouseId = warehouseUser[0]!.id;

			// 1.5 Enforce explicit approval: check for an active connection
			const connection = await db.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.shopId, userId),
					eq(shopWarehouseConnection.warehouseId, warehouseId),
					eq(shopWarehouseConnection.status, "active"),
				),
			});

			if (!connection) {
				throw new ORPCError("FORBIDDEN", {
					message: "You must be approved by this warehouse to place an order.",
				});
			}

			// 2. Validate each item: check inventory + get prices
			const validatedItems: {
				variantId: number;
				quantity: number;
				unitPrice: string;
				totalPrice: string;
				productName: string;
				productImage: string;
				productSize: string;
				productId: number;
				inventoryId: number;
				currentQty: string;
				supplyMode: string;
				targetVariantId: number | null;
				quantityUnit: string | null;
				inventoryUnit: string | null;
				conversionFactor: string | null;
				inventoryQty: string | null;
			}[] = [];

			for (const item of input.items) {
				// Find inventory record
				const inv = await db.query.inventory.findFirst({
					where: and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, warehouseId),
						eq(inventory.variantId, item.variantId),
					),
					with: {
						variant: {
							with: {
								sourceVariantOption: true,
								product: {
									columns: {
										id: true,
										name: true,
										image: true,
										size: true,
										trackingType: true,
										isReturnablePack: true,
									},
									with: {
										category: {
											columns: {
												id: true,
												name: true,
												slug: true,
											},
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
									},
								},
							},
						},
					},
				});

				if (!inv) {
					throw new ORPCError("NOT_FOUND", {
						message: `Variant ${item.variantId} is not available in this warehouse`,
					});
				}

				const availableQty = Number(inv.availableQty);
				const [cartonCountResult] = await db
					.select({ cnt: count() })
					.from(carton)
					.where(
						and(
							eq(carton.warehouseId, warehouseId),
							eq(carton.variantId, item.variantId),
							eq(carton.status, "active"),
						),
					);
				const activeCartonCount = cartonCountResult?.cnt ?? 0;
				if (!inv.variant?.sourceVariantOption) {
					throw new ORPCError("BAD_REQUEST", {
						message: "This variant is missing its Admin Variant definition",
					});
				}
				const variantOperations = resolveVariantOperations(
					inv.variant.sourceVariantOption,
				);
				const requestedMode = item.fulfillmentMode ?? item.supplyMode ?? null;
				const resolvedMode = resolveWarehouseOrderMode({
					requestedMode,
					activeCartonCount,
					productType: {
						inventoryBehaviour:
							inv.variant?.product?.category?.type?.inventoryBehaviour,
					},
					variantOperations,
				});

				if (requestedMode && !resolvedMode.supportsRequestedMode) {
					throw new ORPCError("BAD_REQUEST", {
						message: `${requestedMode} mode is not supported for ${inv.variant?.product?.name || "this variant"}. Supported modes: ${resolvedMode.availableModes.join(", ")}`,
					});
				}
				if (
					!variantOperations.allowsDecimal &&
					!Number.isInteger(item.quantity)
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: `${variantOperations.operationalUnit} orders must use whole quantities`,
					});
				}

				// Stock validation depends on the resolved fulfillment strategy:
				// - container_count: quantity is the number of cartons/boxes/bundles/drums
				// - direct_quantity: quantity is the number of direct units or loose units
				if (resolvedMode.stockStrategy === "container_count") {
					if (activeCartonCount < item.quantity) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Not enough ${resolvedMode.mode}s for ${inv.variant?.product?.name || "product"}. Available containers: ${activeCartonCount}, requested: ${item.quantity}`,
						});
					}
				} else {
					if (availableQty < item.quantity) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Insufficient ${resolvedMode.mode} stock for ${inv.variant?.product?.name || "product"}. Available: ${availableQty}, requested: ${item.quantity}`,
						});
					}
				}

				const rp = Number(inv.retailPrice || 0);
				const vp = Number(inv.variant?.price || 0);
				let unitPrice =
					rp > 0 ? inv.retailPrice! : vp > 0 ? inv.variant!.price! : "0";

				const isLooseVariant = variantOperations.receivingMode === "loose";
				const isLooseOrder = resolvedMode.mode === "loose";
				const usesContainerPricing =
					resolvedMode.stockStrategy === "container_count";

				if (isLooseOrder) {
					// ═══ LOOSE ORDER: Use variant's base price directly — no carton calculation ═══
					console.log(
						`[ORDER-PRICE] variant=${item.variantId}: Loose order — using base variant price: ${unitPrice}`,
					);
				} else if (usesContainerPricing) {
					// ═══ PACK/CARTON ORDER: Resolve per-carton price ═══

					// Look up carton and config for carton pricing
					const activeCarton = await db.query.carton.findFirst({
						where: and(
							eq(carton.warehouseId, warehouseId),
							eq(carton.variantId, item.variantId),
							eq(carton.status, "active"),
						),
						with: {
							config: {
								columns: {
									cartonPrice: true,
									deliveryCostPerCarton: true,
								},
							},
						},
					});

					// Also look up cartonConfig directly as fallback
					const variantConfig = await db.query.cartonConfig.findFirst({
						where: and(
							eq(cartonConfig.variantId, item.variantId),
							eq(cartonConfig.isActive, true),
						),
						orderBy: [desc(cartonConfig.isDefault)],
					});

					// Price resolution: carton.cartonPrice → carton.config.cartonPrice → cartonConfig.cartonPrice → calculated
					const cartonRecordPrice = Number(activeCarton?.cartonPrice || 0);
					const linkedConfigPrice = Number(
						(activeCarton as any)?.config?.cartonPrice || 0,
					);
					const directConfigPrice = Number(variantConfig?.cartonPrice || 0);

					if (cartonRecordPrice > 0) {
						unitPrice = activeCarton!.cartonPrice!;
						console.log(
							`[ORDER-PRICE] variant=${item.variantId}: Using carton record price: ${unitPrice}`,
						);
					} else if (linkedConfigPrice > 0) {
						unitPrice = (activeCarton as any).config.cartonPrice;
						console.log(
							`[ORDER-PRICE] variant=${item.variantId}: Using linked config price: ${unitPrice}`,
						);
					} else if (directConfigPrice > 0) {
						unitPrice = variantConfig!.cartonPrice;
						console.log(
							`[ORDER-PRICE] variant=${item.variantId}: Using direct config price: ${unitPrice}`,
						);
					} else if (isLooseVariant && activeCarton) {
						// Loose fallback: calculate from per-KG price × carton weight
						const variantWeightKg = Number(inv.variant?.weightKg || 0);
						const rawUnitPrice = Number(unitPrice);
						const cartonWeightKg = Number(activeCarton.totalWeightKg) || 0;
						const perKg =
							variantWeightKg > 0
								? rawUnitPrice / variantWeightKg
								: rawUnitPrice;
						unitPrice = (perKg * cartonWeightKg).toFixed(2);
						console.log(
							`[ORDER-PRICE] variant=${item.variantId}: Loose calc: perKg=${perKg}, cartonKg=${cartonWeightKg}, price=${unitPrice}`,
						);
					} else if (!isLooseVariant && activeCarton) {
						// Pack fallback: multiply per-pack price by packs per carton
						const packsPerCarton = activeCarton.totalPacks || 0;
						if (packsPerCarton > 0) {
							unitPrice = (Number(unitPrice) * packsPerCarton).toFixed(2);
							console.log(
								`[ORDER-PRICE] variant=${item.variantId}: Pack calc: packPrice=${inv.retailPrice || inv.variant?.price} × ${packsPerCarton} = ${unitPrice}`,
							);
						}
					} else {
						console.log(
							`[ORDER-PRICE] variant=${item.variantId}: No carton found, using raw pack price: ${unitPrice}`,
						);
					}
				} else {
					console.log(
						`[ORDER-PRICE] variant=${item.variantId}: Direct ${resolvedMode.mode} order — using base variant price: ${unitPrice}`,
					);
				}

				const totalPrice = (Number(unitPrice) * item.quantity).toFixed(2);

				// Validate targetVariantId only when the fulfillment strategy needs it.
				const canCarryOptionalTargetVariant =
					resolvedMode.inventoryBehaviour === "loose_convert" &&
					(resolvedMode.mode === "drum" ||
						resolvedMode.mode === "loose" ||
						resolvedMode.stockStrategy === "container_count");
				const shouldPersistTargetVariant =
					resolvedMode.requiresTargetVariant ||
					(canCarryOptionalTargetVariant && !!item.targetVariantId);

				if (resolvedMode.requiresTargetVariant && !item.targetVariantId) {
					throw new ORPCError("BAD_REQUEST", {
						message: `${resolvedMode.mode} orders for ${inv.variant?.product?.name || "this product"} require a target variant for conversion.`,
					});
				}

				const resolvedTargetVariantId: number | null =
					shouldPersistTargetVariant ? (item.targetVariantId ?? null) : null;

				if (resolvedTargetVariantId) {
					const targetVar = await db.query.productVariant.findFirst({
						where: and(
							eq(productVariant.id, resolvedTargetVariantId),
							eq(productVariant.productId, inv.variant?.product?.id || 0),
						),
					});
					if (!targetVar) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Target variant ${resolvedTargetVariantId} not found for product ${inv.variant?.product?.name}`,
						});
					}
				}

				const preparedMovement = await prepareB2bMovementForApproval(db, {
					warehouseId,
					item: {
						id: 0,
						productId: inv.variant?.product?.id || 0,
						variantId: item.variantId,
						targetVariantId: resolvedTargetVariantId,
						supplyMode: resolvedMode.mode,
					},
					approvedQty: item.quantity,
				});

				validatedItems.push({
					variantId: item.variantId,
					quantity: item.quantity,
					unitPrice,
					totalPrice,
					productName: inv.variant?.product?.name || "Unknown",
					productImage: inv.variant?.product?.image || "",
					productSize:
						inv.variant?.unitLabel || inv.variant?.product?.size || "",
					productId: inv.variant?.product?.id || 0,
					inventoryId: inv.id,
					currentQty: inv.availableQty,
					supplyMode: preparedMovement.mode,
					targetVariantId:
						preparedMovement.targetVariantId ===
						preparedMovement.sourceVariantId
							? null
							: preparedMovement.targetVariantId,
					quantityUnit: preparedMovement.movement.quantityUnit,
					inventoryUnit: preparedMovement.movement.inventoryUnit,
					conversionFactor:
						preparedMovement.movement.conversionFactor.toFixed(4),
					inventoryQty: preparedMovement.movement.sourceInventoryQty.toFixed(2),
				});
			}

			// 3. Calculate totals
			const subtotal = validatedItems.reduce(
				(sum, item) => sum + Number(item.totalPrice),
				0,
			);
			const checkoutSelection = input.checkout ?? {
				deliveryMode: "courier" as const,
				paymentPlan:
					input.paymentMethod === null ||
					input.paymentMethod === "cash_on_delivery"
						? ("pay_later" as const)
						: ("pay_now" as const),
			};
			try {
				assertCheckoutPaymentSelectionAllowed({
					paymentMethod: input.paymentMethod,
					paymentPlan: checkoutSelection.paymentPlan,
				});
			} catch (error) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						error instanceof Error
							? error.message
							: "The payment selection is invalid",
				});
			}
			let checkoutResult: Awaited<ReturnType<typeof buildWholesaleCheckoutQuote>>;
			try {
				checkoutResult = await buildWholesaleCheckoutQuote({
					sellerId: warehouseId,
					lines: validatedItems.map((item) => ({
						key: `${item.variantId}:${item.supplyMode}:${item.targetVariantId ?? "none"}`,
						quantity: item.quantity,
						unitPrice: Number(item.unitPrice),
					})),
					selection: checkoutSelection,
				});
				assertCheckoutQuoteMatches({
					expectedVersion: input.checkout?.quoteVersion,
					expectedExpiresAt: input.checkout?.quoteExpiresAt,
					quote: checkoutResult.quote,
				});
			} catch (error) {
				throw new ORPCError("CONFLICT", {
					message:
						error instanceof Error
							? error.message
							: "Checkout totals could not be confirmed",
				});
			}
			const { quote, configuration, promotion } = checkoutResult;
			const paymentDueAt = getWholesalePaymentDueAt({
				paymentPlan: quote.paymentPlan,
				creditDays: configuration.wholesaleCreditDays,
			});

			// 4. Generate order number
			const orderNumber = `WO-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

			// 5. Create order + items + deduct inventory in a transaction
			const result = await db.transaction(async (tx) => {
				// Create order
				const [newOrder] = await tx
					.insert(order)
					.values({
						orderNumber,
						userId,
						orderType: "b2b",
						orderSource: "direct",
						warehouseId,
						subtotal: subtotal.toFixed(2),
						shippingCost: (
							quote.totals.deliveryFee + quote.totals.shippingFee
						).toFixed(2),
						discount: quote.totals.totalDiscount.toFixed(2),
						productDiscount: quote.totals.productDiscount.toFixed(2),
						couponDiscount: quote.totals.couponDiscount.toFixed(2),
						rewardDiscount: quote.totals.rewardDiscount.toFixed(2),
						taxAmount: quote.totals.taxAmount.toFixed(2),
						deliveryFee: quote.totals.deliveryFee.toFixed(2),
						shippingFee: quote.totals.shippingFee.toFixed(2),
						total: quote.totals.grandTotal.toFixed(2),
						paidAmount: "0.00",
						dueAmount: quote.totals.grandTotal.toFixed(2),
						promotionCode: quote.promotionCode,
						status: "pending",
						paymentStatus: "pending",
						paymentMethod: input.paymentMethod,
						paymentPlan: quote.paymentPlan,
						paymentDueAt,
						creditDays: configuration.wholesaleCreditDays,
						deliveryMode: quote.deliveryMode,
						checkoutQuoteVersion: quote.version,
						checkoutQuoteExpiresAt: new Date(quote.expiresAt),
						checkoutIdempotencyKey: input.checkout?.idempotencyKey,
						shippingName: input.shippingName,
						shippingPhone: input.shippingPhone,
						shippingAddress: input.shippingAddress,
						shippingCity: input.shippingCity,
						shippingArea: input.shippingArea || null,
						invoiceName:
							input.checkout?.invoiceContact?.name ?? input.shippingName,
						invoicePhone:
							input.checkout?.invoiceContact?.phone ?? input.shippingPhone,
						invoiceEmail: input.checkout?.invoiceContact?.email || null,
						customerNote: input.customerNote || null,
					})
					.returning();

				await recordPurchaseSubmission(tx, {
					actorId: userId,
					idempotencyPrefix:
						input.checkout?.idempotencyKey ?? `order:${newOrder!.id}`,
					orderId: newOrder!.id,
					orderNumber,
					ownerId: userId,
				});

				if (promotion && quote.promotionCode) {
					const consumed = await tx
						.update(checkoutPromotion)
						.set({
							usedCount: sql`${checkoutPromotion.usedCount} + 1`,
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(checkoutPromotion.id, promotion.id),
								eq(checkoutPromotion.isActive, true),
								or(
									isNull(checkoutPromotion.usageLimit),
									sql`${checkoutPromotion.usedCount} < ${checkoutPromotion.usageLimit}`,
								),
							),
						)
						.returning({ id: checkoutPromotion.id });
					if (consumed.length !== 1) {
						throw new ORPCError("CONFLICT", {
							message: "The promotion is no longer available",
						});
					}
					await tx.insert(checkoutPromotionRedemption).values({
						promotionId: promotion.id,
						orderId: newOrder!.id,
						userId,
						codeSnapshot: quote.promotionCode,
						discountAmount: quote.totals.couponDiscount.toFixed(2),
						metadata: JSON.stringify({ audience: "wholesale" }),
					});
				}

				if (quote.initialPaymentAmount > 0) {
					if (!input.paymentMethod) {
						throw new ORPCError("BAD_REQUEST", {
							message: "Select a method before making a payment",
						});
					}
					const [pendingPayment] = await tx.insert(payment).values({
						orderId: newOrder!.id,
						idempotencyKey: input.checkout?.idempotencyKey
							? `${input.checkout.idempotencyKey}:initial`
							: undefined,
						paymentMethod: input.paymentMethod,
						paymentProvider:
							input.paymentMethod === "bank_transfer"
								? "manual_bank"
								: "sslcommerz",
						status: "pending",
						amount: quote.initialPaymentAmount.toFixed(2),
						purchasePurpose: "supplier_advance",
						purchaseTiming: "before_receipt",
					}).returning({ id: payment.id });

					await appendOrderPurchaseEvent(tx, {
						actorId: userId,
						amount: quote.initialPaymentAmount,
						category: "payment",
						description: "Initial purchase payment started",
						eventType: "payment_initiated",
						idempotencyKey: `${input.checkout?.idempotencyKey ?? `order:${newOrder!.id}`}:payment:${pendingPayment!.id}:initiated`,
						orderId: newOrder!.id,
						ownerId: userId,
						reference: orderNumber,
						toState: "pending",
					});
				}

				// Create order items
				for (const item of validatedItems) {
					const buyerTarget = await ensureShopBuyerTargetVariant(tx, {
						shopId: userId,
						sourceVariantId: item.variantId,
						requestedTargetVariantId: item.targetVariantId,
					});
					await tx.insert(orderItem).values({
						orderId: newOrder!.id,
						productId: item.productId,
						variantId: item.variantId,
						productName: item.productName,
						productImage: item.productImage,
						productSize: item.productSize,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						totalPrice: item.totalPrice,
						supplyMode: item.supplyMode,
						targetVariantId: buyerTarget.targetVariantId,
						conversionStatus: "pending",
						quantityUnit: item.quantityUnit,
						inventoryUnit: item.inventoryUnit,
						conversionFactor: item.conversionFactor,
						inventoryQty: item.inventoryQty,
						catalogVariantId: buyerTarget.sourceCatalogVariantId,
						globalSkuSnapshot: buyerTarget.sourceGlobalSku,
						sourceSkuSnapshot: buyerTarget.sourceLocalSku,
						targetSkuSnapshot: buyerTarget.targetLocalSku,
					});
				}

				return newOrder!;
			});

			// 6. Upsert shop↔warehouse connection (smart memory)
			const existing = await db.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.shopId, userId),
					eq(shopWarehouseConnection.warehouseId, warehouseId),
				),
			});
			if (existing) {
				await db
					.update(shopWarehouseConnection)
					.set({ lastOrderedAt: new Date() })
					.where(eq(shopWarehouseConnection.id, existing.id));
			} else {
				await db.insert(shopWarehouseConnection).values({
					shopId: userId,
					warehouseId,
					status: "active",
					connectedAt: new Date(),
					lastOrderedAt: new Date(),
				});
			}

			return {
				success: true,
				order: result,
				quoteVersion: quote.version,
				grandTotal: quote.totals.grandTotal,
				amountToPay: quote.initialPaymentAmount,
				projectedDueAfterPayment: quote.projectedDueAfterPayment,
				paymentRequired: quote.initialPaymentAmount > 0,
				message: `Order ${orderNumber} placed successfully to ${warehouseUser[0]!.warehouseName || warehouseUser[0]!.name}`,
			};
		}),

	/**
	 * Get orders the shop placed to warehouses.
	 */
	getMyWarehouseOrders: shopOwnerProcedure
		.input(
			z.object({
				status: z
					.enum([
						"pending",
						"confirmed",
						"processing",
						"delivered",
						"cancelled",
					])
					.optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const { page, limit } = input;
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [
				eq(order.userId, userId),
				sql`${order.warehouseId} IS NOT NULL`,
			];
			if (input.status) conditions.push(eq(order.status, input.status));

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
							},
						},
					},
					orderBy: [desc(order.createdAt)],
					limit,
					offset,
				}),
				db.select({ count: count() }).from(order).where(where),
			]);

			// Get warehouse names
			const warehouseIds = [
				...new Set(orders.map((o: any) => o.warehouseId).filter(Boolean)),
			];
			const warehouseMap = new Map<string, string>();
			if (warehouseIds.length > 0) {
				const warehouses = await db
					.select({
						id: user.id,
						warehouseName: user.warehouseName,
						name: user.name,
					})
					.from(user)
					.where(inArray(user.id, warehouseIds as string[]));
				for (const w of warehouses) {
					warehouseMap.set(w.id, w.warehouseName || w.name || "Unknown");
				}
			}

			const totalCount = countResult[0]?.count || 0;

			return {
				orders: orders.map((o: any) => ({
					...o,
					items: (o.items || []).map((item: any) => ({
						...item,
						supplyModeLabel:
							item.supplyMode && item.supplyMode in FULFILLMENT_MODE_LABELS
								? FULFILLMENT_MODE_LABELS[
										item.supplyMode as keyof typeof FULFILLMENT_MODE_LABELS
									]
								: "Legacy",
					})),
					warehouseName: warehouseMap.get(o.warehouseId) || "Unknown Warehouse",
				})),
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(Number(totalCount) / limit),
				},
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Open Order Endpoints (Shop Owner bidding)
// ────────────────────────────────────────────────────────────────

const openOrderEndpoints = {
	/** Active requests and submitted offers, with no customer PII before acceptance. */
	getOpenOrderPool: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/open-orders/pool",
			tags: ["Shop Owner", "Open Order"],
			summary: "List active open-order offers",
		})
		.handler(async ({ context }) => {
			const shopId = context.session.user.id;
			const candidates = await db
				.select({ orderId: openOrderBid.subOrderId })
				.from(openOrderBid)
				.innerJoin(order, eq(order.id, openOrderBid.subOrderId))
				.where(
					and(
						eq(openOrderBid.shopId, shopId),
						inArray(order.status, ["matching_shop", "negotiating"]),
					),
				);
			for (const orderId of [
				...new Set(candidates.map((row) => row.orderId)),
			]) {
				await reconcileOpenOrder(orderId);
			}

			const offers = await db
				.select({
					bidId: openOrderBid.id,
					orderId: openOrderBid.subOrderId,
					status: openOrderBid.status,
					distanceKm: openOrderBid.distanceKm,
					itemSubtotal: openOrderBid.itemSubtotal,
					discountType: openOrderBid.discountType,
					discountValue: openOrderBid.discountValue,
					discountAmount: openOrderBid.discountAmount,
					deliveryCharge: openOrderBid.deliveryCharge,
					finalTotal: openOrderBid.totalBid,
					priceFrozenAt: openOrderBid.priceFrozenAt,
					reservationState: openOrderBid.reservationState,
					submittedAt: openOrderBid.submittedAt,
					createdAt: openOrderBid.createdAt,
					orderNumber: order.orderNumber,
					referenceSubtotal: order.subtotal,
					offerDeadline: order.broadcastExpiresAt,
					selectionDeadline: order.selectionExpiresAt,
					shippingCity: order.shippingCity,
					shippingArea: order.shippingArea,
				})
				.from(openOrderBid)
				.innerJoin(order, eq(order.id, openOrderBid.subOrderId))
				.where(
					and(
						eq(openOrderBid.shopId, shopId),
						inArray(openOrderBid.status, ["available", "submitted"]),
						inArray(order.status, ["matching_shop", "negotiating"]),
					),
				)
				.orderBy(asc(order.broadcastExpiresAt), asc(openOrderBid.createdAt));

			const pool = await Promise.all(
				offers.map(async (offer) => {
					const items = await db
						.select({
							id: orderItem.id,
							productName: orderItem.productName,
							productImage: orderItem.productImage,
							productSize: orderItem.productSize,
							quantity: orderItem.quantity,
							referencePrice: openOrderBidItem.platformPrice,
							currentStorePrice: inventory.retailPrice,
							offerUnitPrice: openOrderBidItem.sellerPrice,
							inventoryId: inventory.id,
						})
						.from(openOrderBidItem)
						.innerJoin(
							orderItem,
							eq(orderItem.id, openOrderBidItem.orderItemId),
						)
						.innerJoin(
							inventory,
							eq(inventory.id, openOrderBidItem.inventoryId),
						)
						.where(eq(openOrderBidItem.bidId, offer.bidId));
					return {
						...offer,
						distanceKm: Number(offer.distanceKm ?? 0),
						referenceSubtotal: Number(offer.referenceSubtotal),
						itemSubtotal:
							offer.itemSubtotal == null ? null : Number(offer.itemSubtotal),
						discountValue: Number(offer.discountValue ?? 0),
						discountAmount: Number(offer.discountAmount ?? 0),
						deliveryCharge: Number(offer.deliveryCharge ?? 0),
						finalTotal:
							offer.finalTotal == null ? null : Number(offer.finalTotal),
						offerDeadline: offer.offerDeadline?.toISOString() ?? null,
						selectionDeadline: offer.selectionDeadline?.toISOString() ?? null,
						priceFrozenAt: offer.priceFrozenAt?.toISOString() ?? null,
						submittedAt: offer.submittedAt?.toISOString() ?? null,
						customerArea: offer.shippingArea ?? offer.shippingCity,
						items: items.map((item) => {
							const currentStorePrice = Number(item.currentStorePrice ?? 0);
							const offerUnitPrice =
								item.offerUnitPrice == null
									? null
									: Number(item.offerUnitPrice);
							const resolvedPrice = resolveRetailerOfferLinePrice({
								currentStorePrice,
								offerUnitPrice,
								offerDeadline: offer.offerDeadline ?? new Date(0),
								priceFrozenAt: offer.priceFrozenAt,
							});
							return {
								...item,
								referencePrice: Number(item.referencePrice),
								currentStorePrice,
								offerUnitPrice,
								retailerPrice: resolvedPrice.displayPrice,
								priceSource: resolvedPrice.source,
								pricingUrl: `/shop/dashboard/pricing?inventoryId=${item.inventoryId}`,
							};
						}),
					};
				}),
			);
			return { pool, activeCount: pool.length };
		}),

	getOpenOrderHistory: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/open-orders/history",
			tags: ["Shop Owner", "Open Order"],
			summary: "List completed open-order offer outcomes",
		})
		.handler(async ({ context }) => {
			const shopId = context.session.user.id;
			const history = await db
				.select({
					offerId: openOrderBid.id,
					orderId: openOrderBid.subOrderId,
					orderNumber: order.orderNumber,
					status: openOrderBid.status,
					isWinner: openOrderBid.isWinner,
					finalTotal: openOrderBid.totalBid,
					createdAt: openOrderBid.createdAt,
					confirmedAt: order.confirmedAt,
					cancelledAt: order.cancelledAt,
				})
				.from(openOrderBid)
				.innerJoin(order, eq(order.id, openOrderBid.subOrderId))
				.where(
					and(
						eq(openOrderBid.shopId, shopId),
						or(
							inArray(openOrderBid.status, ["released", "lost", "expired"]),
							eq(openOrderBid.isWinner, true),
						),
					),
				)
				.orderBy(desc(openOrderBid.createdAt));
			return {
				history: history.map((entry) => ({
					...entry,
					finalTotal:
						entry.finalTotal == null ? null : Number(entry.finalTotal),
					outcome: entry.isWinner
						? "accepted"
						: entry.status === "released"
							? "withdrawn"
							: entry.status === "expired"
								? "expired"
								: "not_selected",
				})),
			};
		}),

	/** Submit or revise discount and delivery; line prices always come from inventory. */
	submitOffer: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/open-orders/submit",
			tags: ["Shop Owner", "Open Order"],
			summary: "Submit or revise an open-order offer",
		})
		.input(
			z.object({
				bidId: z.number(),
				discountType: z.enum(["fixed", "percentage"]),
				discountValue: z.coerce.number().min(0),
				deliveryCharge: z.coerce.number().min(0),
			}),
		)
		.handler(async ({ context, input }) => {
			try {
				const offer = await submitRetailerOffer({
					...input,
					shopId: context.session.user.id,
				});
				context.realtime.emitToOrder(
					offer.subOrderId,
					offer.wasRevision
						? "open-order:offer-updated"
						: "open-order:offer-received",
					{
						orderId: offer.subOrderId,
						offerCountChanged: !offer.wasRevision,
					},
				);
				return {
					success: true,
					offer: {
						id: offer.id,
						status: offer.status,
						itemSubtotal: Number(offer.itemSubtotal),
						discountAmount: Number(offer.discountAmount),
						deliveryCharge: Number(offer.deliveryCharge),
						finalTotal: Number(offer.totalBid),
						submittedAt: offer.submittedAt?.toISOString() ?? null,
					},
				};
			} catch (error) {
				throw new ORPCError("CONFLICT", {
					message:
						error instanceof Error
							? error.message
							: "Offer could not be submitted.",
				});
			}
		}),

	withdrawOpenOrder: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/open-orders/withdraw",
			tags: ["Shop Owner", "Open Order"],
			summary: "Withdraw an open-order offer before the deadline",
		})
		.input(z.object({ bidId: z.number() }))
		.handler(async ({ context, input }) => {
			try {
				const result = await withdrawRetailerOffer({
					bidId: input.bidId,
					shopId: context.session.user.id,
				});
				context.realtime.emitToOrder(
					result.orderId,
					"open-order:offer-withdrawn",
					{
						orderId: result.orderId,
					},
				);
				return { success: true };
			} catch (error) {
				throw new ORPCError("CONFLICT", {
					message:
						error instanceof Error
							? error.message
							: "Offer could not be withdrawn.",
				});
			}
		}),
};

// ────────────────────────────────────────────────────────────────
// Warehouse Connection & Category Matching (Steps 2-7)
// ────────────────────────────────────────────────────────────────

const warehouseConnectionEndpoints = {
	/**
	 * Preview warehouse details before connecting
	 */
	lookupWarehouseByCode: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/lookup-warehouse",
			tags: ["Shop Owner"],
			summary: "Lookup warehouse by code/slug without connecting",
		})
		.input(
			z.object({
				warehouseSlug: z.string().min(1),
			}),
		)
		.handler(async ({ input }) => {
			const warehouseUser = await db
				.select({
					id: user.id,
					name: user.name,
					warehouseName: user.warehouseName,
					warehouseAddress: user.warehouseAddress,
					warehouseSlug: user.warehouseSlug,
					image: user.image,
				})
				.from(user)
				.where(
					and(
						eq(user.warehouseSlug, input.warehouseSlug),
						eq(user.role, "warehouse"),
					),
				)
				.limit(1);

			if (warehouseUser.length === 0) {
				throw new ORPCError("NOT_FOUND", {
					message: "Warehouse not found",
				});
			}

			const wh = warehouseUser[0]!;

			// Get product count
			const [countResult] = await db
				.select({ count: count() })
				.from(inventory)
				.where(
					and(
						eq(inventory.ownerType, "warehouse"),
						eq(inventory.ownerId, wh.id),
						sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
					),
				);

			return {
				warehouse: {
					...wh,
					productCount: countResult?.count || 0,
				},
			};
		}),

	/**
	 * Connect to a warehouse (Request Access).
	 * Always creates a pending request requiring manual approval.
	 */
	connectToWarehouse: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/connect-to-warehouse",
			tags: ["Shop Owner"],
			summary: "Request access to a warehouse",
		})
		.input(
			z.object({
				warehouseSlug: z.string().min(1),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;

			// 1. Validate warehouse exists
			const warehouseUser = await db
				.select({
					id: user.id,
					name: user.name,
					warehouseName: user.warehouseName,
					warehouseAddress: user.warehouseAddress,
					warehouseSlug: user.warehouseSlug,
				})
				.from(user)
				.where(
					and(
						eq(user.warehouseSlug, input.warehouseSlug),
						eq(user.role, "warehouse"),
					),
				)
				.limit(1);

			if (warehouseUser.length === 0) {
				throw new ORPCError("NOT_FOUND", {
					message: "Invalid Warehouse — warehouse not found",
				});
			}

			const warehouseId = warehouseUser[0]!.id;

			// 2. Check existing connection status
			const existingConn = await db.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.shopId, shopId),
					eq(shopWarehouseConnection.warehouseId, warehouseId),
				),
			});

			if (existingConn) {
				if (existingConn.status === "active") {
					return {
						status: "already_connected" as const,
						connectionId: existingConn.id,
						warehouse: warehouseUser[0]!,
						message: "You are already connected to this warehouse.",
					};
				}

				if (existingConn.status === "pending") {
					return {
						status: "already_pending" as const,
						connectionId: existingConn.id,
						warehouse: warehouseUser[0]!,
						message: "Your request is already pending approval.",
					};
				}

				// If disconnected, reactivate as pending
				await db
					.update(shopWarehouseConnection)
					.set({ status: "pending", connectedAt: null })
					.where(eq(shopWarehouseConnection.id, existingConn.id));

				return {
					status: "pending" as const,
					warehouse: warehouseUser[0]!,
					message: "Connection request sent successfully.",
				};
			}

			// 3. Create new pending connection request
			await db.insert(shopWarehouseConnection).values({
				shopId,
				warehouseId,
				status: "pending",
			});

			return {
				status: "pending" as const,
				warehouse: warehouseUser[0]!,
				message: "Connection request sent successfully.",
			};
		}),

	/**
	 * Get all connected/pending warehouses for this shop
	 */
	getMyWarehouses: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/my-warehouses",
			tags: ["Shop Owner"],
			summary: "Get all warehouse connections (active/pending/rejected)",
		})
		.input(
			z
				.object({
					status: z
						.enum(["all", "active", "pending", "disconnected"])
						.default("all"),
				})
				.optional(),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;
			const statusFilter = input?.status || "all";

			const conditions: SQL[] = [eq(shopWarehouseConnection.shopId, shopId)];
			if (statusFilter !== "all") {
				conditions.push(eq(shopWarehouseConnection.status, statusFilter));
			}

			const connections = await db
				.select({
					connectionId: shopWarehouseConnection.id,
					status: shopWarehouseConnection.status,
					connectedAt: shopWarehouseConnection.connectedAt,
					lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
					warehouseId: user.id,
					warehouseName: user.warehouseName,
					warehouseSlug: user.warehouseSlug,
					warehouseAddress: user.warehouseAddress,
					name: user.name,
					image: user.image,
				})
				.from(shopWarehouseConnection)
				.innerJoin(user, eq(shopWarehouseConnection.warehouseId, user.id))
				.where(and(...conditions))
				.orderBy(
					desc(shopWarehouseConnection.lastOrderedAt),
					desc(shopWarehouseConnection.connectedAt),
				);

			// Get product counts for active warehouses
			const result = await Promise.all(
				connections.map(async (conn) => {
					if (conn.status !== "active") {
						return { ...conn, productCount: 0 };
					}

					const [countResult] = await db
						.select({ count: count() })
						.from(inventory)
						.where(
							and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, conn.warehouseId),
								sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
							),
						);

					return {
						...conn,
						productCount: countResult?.count || 0,
					};
				}),
			);

			return { warehouses: result };
		}),

	/**
	 * Cancel a pending warehouse connection request
	 */
	cancelWarehouseRequest: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/cancel-warehouse-request",
			tags: ["Shop Owner"],
			summary: "Cancel a pending warehouse request",
		})
		.input(
			z.object({
				connectionId: z.number(),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;

			const existingConn = await db.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.id, input.connectionId),
					eq(shopWarehouseConnection.shopId, shopId),
					eq(shopWarehouseConnection.status, "pending"),
				),
			});

			if (!existingConn) {
				throw new ORPCError("NOT_FOUND", {
					message: "Pending request not found",
				});
			}

			await db
				.delete(shopWarehouseConnection)
				.where(eq(shopWarehouseConnection.id, input.connectionId));

			return { success: true, message: "Request cancelled" };
		}),

	/**
	 * Disconnect from an active warehouse
	 */
	disconnectWarehouse: shopOwnerProcedure
		.route({
			method: "POST",
			path: "/shop-owner/disconnect-warehouse",
			tags: ["Shop Owner"],
			summary: "Disconnect from an active warehouse",
		})
		.input(
			z.object({
				connectionId: z.number(),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;

			const existingConn = await db.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.id, input.connectionId),
					eq(shopWarehouseConnection.shopId, shopId),
					eq(shopWarehouseConnection.status, "active"),
				),
			});

			if (!existingConn) {
				throw new ORPCError("NOT_FOUND", {
					message: "Active connection not found",
				});
			}

			await db
				.update(shopWarehouseConnection)
				.set({ status: "disconnected" })
				.where(eq(shopWarehouseConnection.id, input.connectionId));

			return { success: true, message: "Disconnected successfully" };
		}),

	/**
	 * Step 7: Get recently connected warehouses (smart memory).
	 * Sorted by lastOrderedAt descending. (Alias for backwards compatibility)
	 */
	getConnectedWarehouses: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/connected-warehouses",
			tags: ["Shop Owner"],
			summary: "Get recently connected warehouses (smart memory)",
		})
		.handler(async ({ context }) => {
			const shopId = context.session.user.id;

			const connections = await db
				.select({
					connectionId: shopWarehouseConnection.id,
					status: shopWarehouseConnection.status,
					connectedAt: shopWarehouseConnection.connectedAt,
					lastOrderedAt: shopWarehouseConnection.lastOrderedAt,
					warehouseId: user.id,
					warehouseName: user.warehouseName,
					warehouseSlug: user.warehouseSlug,
					warehouseAddress: user.warehouseAddress,
					name: user.name,
				})
				.from(shopWarehouseConnection)
				.innerJoin(user, eq(shopWarehouseConnection.warehouseId, user.id))
				.where(
					and(
						eq(shopWarehouseConnection.shopId, shopId),
						eq(shopWarehouseConnection.status, "active"),
					),
				)
				.orderBy(desc(shopWarehouseConnection.lastOrderedAt));

			// Get product counts for each warehouse
			const result = await Promise.all(
				connections.map(async (conn) => {
					const [countResult] = await db
						.select({ count: count() })
						.from(inventory)
						.where(
							and(
								eq(inventory.ownerType, "warehouse"),
								eq(inventory.ownerId, conn.warehouseId),
								sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
							),
						);

					return {
						...conn,
						productCount: countResult?.count || 0,
					};
				}),
			);

			return { warehouses: result };
		}),

	/**
	 * Step 4: Get warehouse products filtered by shop's allowed categories.
	 * Products in shop's allowed categories → canOrder: true
	 * Products outside → canOrder: false ("Request Access")
	 */
	getWarehouseProductsFiltered: shopOwnerProcedure
		.route({
			method: "GET",
			path: "/shop-owner/warehouse-products-filtered",
			tags: ["Shop Owner"],
			summary: "Get warehouse products filtered by shop allowed categories",
		})
		.input(
			z.object({
				warehouseSlug: z.string().min(1),
				search: z.string().optional(),
				page: z.string().default("1"),
				limit: z.string().default("50"),
			}),
		)
		.handler(async ({ context, input }) => {
			const shopId = context.session.user.id;

			// Find warehouse
			const warehouseUser = await db
				.select({ id: user.id })
				.from(user)
				.where(
					and(
						eq(user.warehouseSlug, input.warehouseSlug),
						eq(user.role, "warehouse"),
					),
				)
				.limit(1);

			if (warehouseUser.length === 0) {
				throw new ORPCError("NOT_FOUND", {
					message: "Warehouse not found",
				});
			}

			const warehouseId = warehouseUser[0]!.id;

			// Enforce explicit approval: check for an active connection
			const connection = await db.query.shopWarehouseConnection.findFirst({
				where: and(
					eq(shopWarehouseConnection.shopId, shopId),
					eq(shopWarehouseConnection.warehouseId, warehouseId),
					eq(shopWarehouseConnection.status, "active"),
				),
			});

			if (!connection) {
				throw new ORPCError("FORBIDDEN", {
					message: "You must be approved by this warehouse to view its catalog",
				});
			}

			// Get shop's allowed subcategory IDs and category IDs
			const shopAssignments = await db
				.select({
					categoryId: shopCategoryAssignment.categoryId,
					subcategoryId: shopCategoryAssignment.subcategoryId,
				})
				.from(shopCategoryAssignment)
				.where(eq(shopCategoryAssignment.shopId, shopId));

			const allowedSubcatIds = new Set(
				shopAssignments.map((a) => a.subcategoryId).filter(Boolean) as number[],
			);
			const allowedCatIds = new Set(shopAssignments.map((a) => a.categoryId));
			const hasAssignments = shopAssignments.length > 0;

			// Get warehouse inventory with product info
			const page = Math.max(1, Number(input.page) || 1);
			const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
			const offset = (page - 1) * limit;

			const conditions: SQL[] = [
				eq(inventory.ownerType, "warehouse"),
				eq(inventory.ownerId, warehouseId),
				sql`CAST(${inventory.availableQty} AS NUMERIC) > 0`,
				sql`CAST(${inventory.retailPrice} AS NUMERIC) > 0`,
				eq(product.status, "active"),
				eq(product.visibility, "public"),
				inArray(product.creatorSource, ["admin", "warehouse"]),
				sql`${product.brandId} IS NOT NULL`,
				eq(productVariant.isActive, true),
			];

			if (input.search) {
				const s = `%${input.search}%`;
				conditions.push(
					or(ilike(product.name, s), ilike(productVariant.sku ?? "", s))!,
				);
			}

			const pageProducts = await db
				.selectDistinct({ productId: product.id })
				.from(inventory)
				.innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
				.innerJoin(product, eq(productVariant.productId, product.id))
				.where(and(...conditions))
				.orderBy(asc(product.id))
				.limit(limit)
				.offset(offset);
			const pageProductIds = pageProducts.map((row) => row.productId);
			if (pageProductIds.length === 0) return { products: [] };

			const items = await db
				.select({
					inventoryId: inventory.id,
					variantId: inventory.variantId,
					availableQty: inventory.availableQty,
					inCartonQty: inventory.inCartonQty,
					retailPrice: inventory.retailPrice,
					productId: product.id,
					productName: product.name,
					productImage: product.image,
					productSize: product.size,
					productCategoryId: product.categoryId,
					productSubCategoryId: product.subCategoryId,
					productTrackingType: product.trackingType,
					productIsReturnablePack: product.isReturnablePack,
					categoryName: category.name,
					productTypeName: productType.name,
					productTypeSlug: productType.slug,
					productTypeFamily: productType.family,
					productTypeInventoryBehaviour: productType.inventoryBehaviour,
					variantUnitLabel: productVariant.unitLabel,
					variantWeightKg: productVariant.weightKg,
					variantSku: productVariant.sku,
					variantPrice: productVariant.price,
					packType: productVariant.packType,
					orderUnit: productVariant.orderUnit,
					variantPackType: productVariant.packType,
					variantInnerPackSizeKg: productVariant.innerPackSizeKg,
					variantPackCountInside: productVariant.packCountInside,
					sourceVariantOptionId: productVariant.sourceVariantOptionId,
					sourceOptionName: variantOption.name,
					sourceOptionUnit: variantOption.unit,
					sourceOptionSize: variantOption.size,
					sourceOptionVariantType: variantOption.variantType,
					sourceOptionDefinitionKind: variantOption.definitionKind,
					sourceOptionDefinition: variantOption.definition,
					sourceOptionDisplayAlias: variantOption.displayAlias,
					sourceOptionNeedsReview: variantOption.needsReview,
					productUnitSize: product.size,
					productBrandId: product.brandId,
					productCreatorSource: product.creatorSource,
					productCreatedById: product.createdById,
					variantBrandId: productVariant.brandId,
					variantColor: productVariant.color,
					variantSize: productVariant.size,
					brandName: brand.name,
				})
				.from(inventory)
				.innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
				.innerJoin(product, eq(productVariant.productId, product.id))
				.leftJoin(category, eq(product.categoryId, category.id))
				.leftJoin(productType, eq(category.typeId, productType.id))
				.leftJoin(
					variantOption,
					eq(productVariant.sourceVariantOptionId, variantOption.id),
				)
				// Prefer variant-level brand, fall back to product-level brand
				.leftJoin(
					brand,
					eq(
						brand.id,
						sql`COALESCE(${productVariant.brandId}, ${product.brandId})`,
					),
				)
				.where(and(...conditions, inArray(product.id, pageProductIds)))
				.orderBy(
					asc(category.name),
					asc(product.name),
					asc(productVariant.sortOrder),
				);

			// Annotate each product with canOrder flag
			const products = items.flatMap((item) => {
				if (item.sourceVariantOptionId === null) return [];
				let variantOperations;
				try {
					variantOperations = resolveVariantOperations({
						name: item.sourceOptionName,
						unit: item.sourceOptionUnit,
						size: item.sourceOptionSize,
						variantType: item.sourceOptionVariantType,
						definitionKind: item.sourceOptionDefinitionKind,
						definition: item.sourceOptionDefinition,
						displayAlias: item.sourceOptionDisplayAlias,
						needsReview: item.sourceOptionNeedsReview,
					});
				} catch {
					return [];
				}
				let canOrder = true;
				if (hasAssignments) {
					const subCatMatch = item.productSubCategoryId
						? allowedSubcatIds.has(item.productSubCategoryId)
						: false;
					const catMatch = allowedCatIds.has(item.productCategoryId);
					canOrder = subCatMatch || catMatch;
				}

				const rp = Number(item.retailPrice || 0);
				const price = rp > 0 ? String(rp) : "0";

				// Track both total pack stock and loose (non-carton) stock
				const rawQty = Number(item.availableQty || 0);
				const inCarton = Number(item.inCartonQty || 0);
				const effectiveQty = Math.max(0, rawQty - inCarton);
				const fulfillmentProfile = buildProductTypeFulfillmentProfile({
					family: item.productTypeFamily,
					name: item.productTypeName,
					slug: item.productTypeSlug,
					inventoryBehaviour:
						item.productTypeInventoryBehaviour ?? "fixed_pack",
					trackingType: item.productTrackingType,
					isReturnablePack: item.productIsReturnablePack,
				});

				return [
					{
						inventoryId: item.inventoryId,
						variantId: item.variantId,
						availableQty: effectiveQty.toFixed(2),
						totalPackStock: rawQty.toFixed(2),
						price,
						canOrder,
						product: {
							id: item.productId,
							name: item.productName,
							image: item.productImage,
							size: item.productSize,
							unitSize: item.productUnitSize,
							categoryName: item.categoryName || "Uncategorized",
							type: {
								family: item.productTypeFamily,
								name: item.productTypeName ?? "Generic",
								slug: item.productTypeSlug,
								inventoryBehaviour:
									item.productTypeInventoryBehaviour ?? "fixed_pack",
								trackingType: item.productTrackingType,
								isReturnablePack: item.productIsReturnablePack,
							},
							fulfillmentProfile,
							creator: {
								source: item.productCreatorSource,
								creatorId: item.productCreatedById,
								warehouseId:
									item.productCreatorSource === "warehouse"
										? item.productCreatedById
										: null,
							},
						},
						variant: {
							unitLabel: item.variantUnitLabel,
							weightKg: item.variantWeightKg,
							sku: item.variantSku,
							price: item.variantPrice,
							packType: item.variantPackType,
							innerPackSizeKg: item.variantInnerPackSizeKg,
							packCountInside: item.variantPackCountInside,
							brandId: item.variantBrandId ?? item.productBrandId,
							brandName: item.brandName,
							color: item.variantColor,
							size: item.variantSize,
							variantOperations,
						},
					},
				];
			});

			// Enrich with carton data per variant (single query)
			const allVariantIds = products.map((p) => p.variantId);
			const cartonMap = new Map<
				number,
				{ cartonCount: number; totalWeightKg: number }
			>();
			const cartonOptionsByVariant = new Map<
				number,
				{
					weightKg: number;
					count: number;
					totalKg: number;
					packsPerCarton: number;
					cartonPrice: string | null;
					deliveryCost: string | null;
				}[]
			>();

			if (allVariantIds.length > 0) {
				const activeCartons = await db.query.carton.findMany({
					where: and(
						eq(carton.warehouseId, warehouseId),
						eq(carton.status, "active"),
						inArray(carton.variantId, allVariantIds),
					),
					with: {
						config: {
							columns: {
								cartonPrice: true,
								deliveryCostPerCarton: true,
							},
						},
					},
				});

				// Also query cartonConfig directly for variants without linked config
				const configs = await db.query.cartonConfig.findMany({
					where: and(
						inArray(cartonConfig.variantId, allVariantIds),
						eq(cartonConfig.isActive, true),
					),
				});
				const configPriceMap = new Map<number, string>();
				const configDeliveryCostMap = new Map<number, string>();
				for (const cfg of configs) {
					if (!configPriceMap.has(cfg.variantId) || cfg.isDefault) {
						configPriceMap.set(cfg.variantId, cfg.cartonPrice);
						if (cfg.deliveryCostPerCarton) {
							configDeliveryCostMap.set(
								cfg.variantId,
								cfg.deliveryCostPerCarton,
							);
						}
					}
				}

				for (const c of activeCartons) {
					// Build cartonMap (totals per variant)
					if (!cartonMap.has(c.variantId)) {
						cartonMap.set(c.variantId, {
							cartonCount: 0,
							totalWeightKg: 0,
						});
					}
					const entry = cartonMap.get(c.variantId)!;
					entry.cartonCount += 1;
					entry.totalWeightKg += parseFloat(c.totalWeightKg);

					// Build cartonOptions (grouped by weight per variant)
					if (!cartonOptionsByVariant.has(c.variantId)) {
						cartonOptionsByVariant.set(c.variantId, []);
					}
					const list = cartonOptionsByVariant.get(c.variantId)!;
					const wt = parseFloat(c.totalWeightKg);
					const existing = list.find((o) => o.totalKg === wt);
					if (existing) {
						existing.count += 1;
					} else {
						// Price priority: carton record → linked config → config by variantId → null
						const linkedConfigPrice = (c as any).config?.cartonPrice || null;
						const linkedConfigDelivery =
							(c as any).config?.deliveryCostPerCarton || null;
						const resolvedPrice =
							c.cartonPrice ||
							linkedConfigPrice ||
							configPriceMap.get(c.variantId) ||
							null;
						const resolvedDelivery =
							c.deliveryCostPerUnit ||
							linkedConfigDelivery ||
							configDeliveryCostMap.get(c.variantId) ||
							null;

						console.log(
							`[CARTON PRICE DEBUG] variant=${c.variantId} carton.cartonPrice=${c.cartonPrice} linkedConfig=${linkedConfigPrice} configMap=${configPriceMap.get(c.variantId)} → resolved=${resolvedPrice}`,
						);

						list.push({
							weightKg: wt,
							totalKg: wt,
							count: 1,
							packsPerCarton: c.totalPacks || 0,
							cartonPrice: resolvedPrice,
							deliveryCost: resolvedDelivery,
						});
					}
				}
			}

			const enrichedProducts = products.map((p) => {
				const cd = cartonMap.get(p.variantId);
				const opts = cartonOptionsByVariant.get(p.variantId) || [];
				return {
					...p,
					variant: {
						...p.variant,
						cartonCount: cd?.cartonCount ?? 0,
						totalCartonCount: cd?.cartonCount ?? 0,
						cartonWeightKg: (cd?.totalWeightKg ?? 0).toFixed(1),
						cartonOptions: opts,
					},
				};
			});

			return { products: enrichedProducts };
		}),
};

// ────────────────────────────────────────────────────────────────
// Public Shop Storefront Queries (accessible by anyone with the shopSlug)
// ────────────────────────────────────────────────────────────────

const shopStorefrontEndpoints = {
	/**
	 * Get shop info by slug (public).
	 */
	getShopStorefrontBySlug: publicProcedure
		.route({
			method: "GET",
			path: "/shopOwner/storefront/{slug}",
			tags: ["Shop Storefront"],
			summary: "Get shop storefront info by slug",
		})
		.input(z.object({ slug: z.string() }))
		.handler(async ({ input }) => {
			const shopUser = await db
				.select({
					id: user.id,
					name: user.name,
					shopName: user.shopName,
					shopSlug: user.shopSlug,
					shopAddress: user.shopAddress,
					image: user.image,
				})
				.from(user)
				.where(and(eq(user.shopSlug, input.slug), eq(user.isSeller, true)))
				.limit(1);

			if (shopUser.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Shop not found" });
			}

			const shop = shopUser[0]!;

			// Count products in this shop's inventory
			const [productCount] = await db
				.select({ count: count() })
				.from(inventory)
				.where(
					and(
						eq(inventory.ownerType, "shop"),
						eq(inventory.ownerId, shop.id),
						sql`CAST(${inventory.availableQty} AS numeric) > 0`,
					),
				);

			return {
				...shop,
				productCount: productCount?.count || 0,
			};
		}),

	/**
	 * Get categories available in a shop storefront (public).
	 */
	getShopStorefrontCategories: publicProcedure
		.route({
			method: "GET",
			path: "/shopOwner/storefront/{slug}/categories",
			tags: ["Shop Storefront"],
			summary: "Get shop storefront categories",
		})
		.input(z.object({ slug: z.string() }))
		.handler(async ({ input }) => {
			const shopUser = await db
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.shopSlug, input.slug), eq(user.isSeller, true)))
				.limit(1);

			if (shopUser.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Shop not found" });
			}

			const shopId = shopUser[0]!.id;

			// Get all inventory with product/category info
			const inventoryItems = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, shopId),
					sql`CAST(${inventory.availableQty} AS numeric) > 0`,
				),
				with: {
					variant: {
						with: {
							product: {
								with: {
									category: {
										columns: {
											id: true,
											name: true,
											slug: true,
										},
									},
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

	/**
	 * Get products available in a shop storefront (public).
	 * Returns products from the shop's inventory with retail prices.
	 */
	getShopStorefrontProducts: publicProcedure
		.route({
			method: "GET",
			path: "/shopOwner/storefront/{slug}/products",
			tags: ["Shop Storefront"],
			summary: "Get shop storefront products",
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
				search,
				sort = "newest",
				page: pageStr = "1",
				limit: limitStr = "12",
			} = input;

			// Find shop user
			const shopUser = await db
				.select({ id: user.id })
				.from(user)
				.where(and(eq(user.shopSlug, slug), eq(user.isSeller, true)))
				.limit(1);

			if (shopUser.length === 0) {
				throw new ORPCError("NOT_FOUND", { message: "Shop not found" });
			}

			const shopId = shopUser[0]!.id;
			const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
			const limit = Math.min(
				50,
				Math.max(1, parseInt(limitStr ?? "12", 10) || 12),
			);
			const offset = (page - 1) * limit;

			// Get shop inventory with variant + product info
			const shopInventory = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, shopId),
					sql`CAST(${inventory.availableQty} AS numeric) > 0`,
				),
				with: {
					variant: {
						with: {
							product: {
								with: {
									category: {
										columns: {
											id: true,
											name: true,
											slug: true,
										},
									},
									images: { limit: 1 },
									brand: {
										columns: {
											id: true,
											name: true,
											slug: true,
										},
									},
								},
							},
						},
					},
				},
			});

			// Group inventory items by product
			const productMap = new Map<
				number,
				{
					product: any;
					variants: Array<{
						variantId: number;
						unitLabel: string;
						weightKg: string;
						packType: string | null;
						price: number;
						retailPrice: number | null;
						availableQty: string;
						sku: string | null;
					}>;
					minPrice: number;
				}
			>();

			for (const inv of shopInventory) {
				const variant = inv.variant;
				const prod = variant?.product;
				if (!prod || !variant) continue;

				// Apply category filter
				if (categorySlug && prod.category?.slug !== categorySlug) continue;

				// Apply search filter
				if (search && !prod.name.toLowerCase().includes(search.toLowerCase()))
					continue;

				const variantPrice = Number(variant.price) || 0;
				const retailPrice = inv.retailPrice ? Number(inv.retailPrice) : null;
				const effectivePrice = retailPrice ?? variantPrice;

				const existing = productMap.get(prod.id);
				const variantData = {
					variantId: variant.id,
					unitLabel: variant.unitLabel || "",
					weightKg: variant.weightKg || "0",
					packType: variant.packType,
					price: variantPrice,
					retailPrice,
					availableQty: inv.availableQty,
					sku: variant.sku,
				};

				if (existing) {
					existing.variants.push(variantData);
					if (effectivePrice < existing.minPrice) {
						existing.minPrice = effectivePrice;
					}
				} else {
					productMap.set(prod.id, {
						product: {
							id: prod.id,
							name: prod.name,
							slug: prod.slug,
							image: prod.image,
							categoryName: prod.category?.name || "",
							categorySlug: prod.category?.slug || "",
							brandName: (prod as any).brand?.name || null,
						},
						variants: [variantData],
						minPrice: effectivePrice,
					});
				}
			}

			// Convert to array and sort
			const products = Array.from(productMap.values());

			products.sort((a, b) => {
				switch (sort) {
					case "price_asc":
					case "price-asc":
						return a.minPrice - b.minPrice;
					case "price_desc":
					case "price-desc":
						return b.minPrice - a.minPrice;
					default:
						return 0; // newest: rely on insertion order
				}
			});

			const totalCount = products.length;
			const paginated = products.slice(offset, offset + limit);

			return {
				products: paginated.map((p) => ({
					...p.product,
					price: p.minPrice,
					variants: p.variants,
				})),
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
// Public Product Catalog (Browse-Only)
// ────────────────────────────────────────────────────────────────

const publicCatalogEndpoints = {
	/**
	 * Get the full product hierarchy: Type → Category → SubCategory → Core Identity.
	 * Public-facing, no auth required. Used for the catalog browse page.
	 */
	getShopCatalogHierarchy: shopOwnerProcedure
		.input(
			z.object({
				typeId: z.number().nullish(),
				categoryId: z.number().nullish(),
				subCategoryId: z.number().nullish(),
				search: z.string().nullish(),
				page: z.number().optional().default(1),
				limit: z.number().optional().default(50),
			}),
		)
		.handler(async ({ input, context }) => {
			const page = input.page ?? 1;
			const limit = input.limit ?? 50;
			const offset = (page - 1) * limit;
			const shopId = context.session.user.id;

			// 1. Build conditions for core products
			const conditions: SQL[] = [
				eq(coreProductIdentity.creatorSource, "admin"),
			];

			if (input.search?.trim()) {
				conditions.push(
					ilike(coreProductIdentity.name, `%${input.search.trim()}%`),
				);
			}

			// 2. If filters provided, narrow by category/subcategory
			if (input.subCategoryId) {
				conditions.push(
					eq(coreProductIdentity.subCategoryId, input.subCategoryId),
				);
			} else if (input.categoryId) {
				conditions.push(eq(coreProductIdentity.categoryId, input.categoryId));
			} else if (input.typeId) {
				// Get all category IDs under this type
				const typeCats = await db
					.select({ id: category.id })
					.from(category)
					.where(eq(category.typeId, input.typeId));
				const catIds = typeCats.map((c) => c.id);
				if (catIds.length > 0) {
					conditions.push(inArray(coreProductIdentity.categoryId, catIds));
				} else {
					return {
						items: [],
						pagination: {
							page,
							limit,
							totalCount: 0,
							totalPages: 0,
						},
					};
				}
			}

			const where = conditions.length > 0 ? and(...conditions) : undefined;

			// 3. Fetch core products with relations
			const [coreProducts, countResult] = await Promise.all([
				db.query.coreProductIdentity.findMany({
					where,
					orderBy: [coreProductIdentity.name],
					limit,
					offset,
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
								type: {
									columns: {
										id: true,
										name: true,
										slug: true,
										skuCode: true,
									},
								},
							},
						},
						subCategory: {
							columns: {
								id: true,
								name: true,
								slug: true,
								skuCode: true,
							},
						},
					},
				}),
				db.select({ count: count() }).from(coreProductIdentity).where(where),
			]);

			const coreProductIds = coreProducts.map((cp) => cp.id);
			const [shopProducts, activeBrands] = await Promise.all([
				coreProductIds.length > 0
					? db.query.product.findMany({
							where: and(
								eq(product.creatorSource, "shop"),
								eq(product.createdById, shopId),
								inArray(product.coreProductId, coreProductIds),
							),
							columns: { coreProductId: true, brandId: true },
						})
					: Promise.resolve([]),
				db.query.brand.findMany({
					where: eq(brand.isActive, true),
					columns: { id: true },
				}),
			]);
			const activeBrandIds = activeBrands.map((row) => row.id);
			const shopBrandsByCore = new Map<number, Set<number>>();
			for (const row of shopProducts) {
				if (row.coreProductId == null || row.brandId == null) continue;
				const brands =
					shopBrandsByCore.get(row.coreProductId) ?? new Set<number>();
				brands.add(row.brandId);
				shopBrandsByCore.set(row.coreProductId, brands);
			}

			// 4. Compose hierarchical SKU and retailer configuration state
			const items = coreProducts.map((cp) => {
				const typeCode = cp.category?.type?.skuCode || "??";
				const catCode = cp.category?.skuCode || "???";
				const subCatCode = cp.subCategory?.skuCode || "???";
				const coreCode = cp.sku || "???";
				const composedSku = `${typeCode}-${catCode}-${subCatCode}-${coreCode}`;

				return {
					id: cp.id,
					name: cp.name,
					slug: cp.slug,
					sku: composedSku,
					image: cp.image,
					description: cp.description,
					brandCreationMode: cp.brandCreationMode,
					type: cp.category?.type
						? {
								id: cp.category.type.id,
								name: cp.category.type.name,
								slug: cp.category.type.slug,
							}
						: null,
					category: cp.category
						? {
								id: cp.category.id,
								name: cp.category.name,
								slug: cp.category.slug,
							}
						: null,
					subCategory: cp.subCategory
						? {
								id: cp.subCategory.id,
								name: cp.subCategory.name,
								slug: cp.subCategory.slug,
							}
						: null,
					shopBrandCount: shopBrandsByCore.get(cp.id)?.size ?? 0,
					shopAddableBrandCount: countAddableBrands(activeBrandIds, [
						...(shopBrandsByCore.get(cp.id) ?? new Set<number>()),
					]),
				};
			});

			const totalCount = Number(countResult[0]?.count) || 0;

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

	/**
	 * Get detailed view of a core product identity.
	 * Returns the core product info + all linked products with their variants,
	 * brands, and seller count.
	 */
	getCoreProductDetail: publicProcedure
		.input(z.object({ coreProductId: z.number() }))
		.handler(async ({ input }) => {
			// 1. Get core product
			const coreProduct = await db.query.coreProductIdentity.findFirst({
				where: eq(coreProductIdentity.id, input.coreProductId),
				with: {
					category: {
						columns: {
							id: true,
							name: true,
							slug: true,
							typeId: true,
						},
						with: {
							type: {
								columns: { id: true, name: true, slug: true },
							},
						},
					},
					subCategory: {
						columns: { id: true, name: true, slug: true },
					},
				},
			});

			if (!coreProduct) {
				throw new ORPCError("NOT_FOUND", {
					message: "Core product identity not found",
				});
			}

			// 2. Get all linked products (active ones created by warehouses)
			const linkedProducts = await db.query.product.findMany({
				where: and(
					eq(product.coreProductId, input.coreProductId),
					eq(product.status, "active"),
				),
				with: {
					brand: { columns: { id: true, name: true, slug: true } },
					images: { limit: 5 },
					variants: {
						where: eq(productVariant.isActive, true),
						columns: {
							id: true,
							sku: true,
							unitLabel: true,
							weightKg: true,
							price: true,
							packType: true,
							packWeightKg: true,
							innerPackSizeKg: true,
							packCountInside: true,
							sellUnit: true,
							color: true,
							size: true,
							brandId: true,
							variantType: true,
							isPackReturnRequired: true,
							packDepositAmount: true,
							sortOrder: true,
						},
						with: {
							brand: { columns: { id: true, name: true } },
						},
						orderBy: [productVariant.sortOrder],
					},
				},
			});

			// 3. Count sellers (shops with stock > 0 for any variant of these products)
			const allVariantIds = linkedProducts.flatMap((p) =>
				p.variants.map((v) => v.id),
			);
			let sellerCount = 0;
			if (allVariantIds.length > 0) {
				const sellerResult = await db
					.select({
						distinctShops: sql<number>`COUNT(DISTINCT ${inventory.ownerId})`,
					})
					.from(inventory)
					.where(
						and(
							eq(inventory.ownerType, "shop"),
							inArray(inventory.variantId, allVariantIds),
							sql`CAST(${inventory.availableQty} AS numeric) > 0`,
						),
					);
				sellerCount = Number(sellerResult[0]?.distinctShops) || 0;
			}

			// 4. Get review stats for linked products
			const productIds = linkedProducts.map((p) => p.id);
			let reviewStats = { avgRating: 0, reviewCount: 0 };
			if (productIds.length > 0) {
				const [stats] = await db
					.select({
						avgRating: avg(productReview.rating),
						reviewCount: count(),
					})
					.from(productReview)
					.where(inArray(productReview.productId, productIds));
				reviewStats = {
					avgRating: Number(stats?.avgRating) || 0,
					reviewCount: Number(stats?.reviewCount) || 0,
				};
			}

			// 5. Extract unique brands across all linked products
			const brandMap = new Map<number, { id: number; name: string }>();
			for (const p of linkedProducts) {
				if (p.brand) {
					brandMap.set(p.brand.id, {
						id: p.brand.id,
						name: p.brand.name,
					});
				}
				for (const v of p.variants) {
					if (v.brand) {
						brandMap.set(v.brand.id, {
							id: v.brand.id,
							name: v.brand.name,
						});
					}
				}
			}

			// 6. Flatten all variants with brand info
			const allVariants = linkedProducts.flatMap((p) =>
				p.variants.map((v) => ({
					...v,
					productId: p.id,
					productName: p.name,
					productImage: p.image,
					brand: v.brand || p.brand || null,
				})),
			);

			return {
				coreProduct: {
					id: coreProduct.id,
					name: coreProduct.name,
					slug: coreProduct.slug,
					sku: coreProduct.sku,
					image: coreProduct.image,
					description: coreProduct.description,
					type: coreProduct.category?.type || null,
					category: coreProduct.category
						? {
								id: coreProduct.category.id,
								name: coreProduct.category.name,
								slug: coreProduct.category.slug,
							}
						: null,
					subCategory: coreProduct.subCategory || null,
				},
				products: linkedProducts.map((p) => ({
					id: p.id,
					name: p.name,
					slug: p.slug,
					image: p.image,
					images: p.images,
					brand: p.brand,
					variantCount: p.variants.length,
				})),
				variants: allVariants,
				brands: Array.from(brandMap.values()),
				sellerCount,
				reviewStats,
			};
		}),

	/**
	 * Get filter options for the catalog: active types, categories, subcategories.
	 */
	getPublicFilterOptions: publicProcedure.handler(async () => {
		const [types, categories, subCategories, brands] = await Promise.all([
			db.query.productType.findMany({
				where: eq(productType.isActive, true),
				orderBy: [productType.displayOrder, productType.name],
				columns: { id: true, name: true, slug: true },
			}),
			db.query.category.findMany({
				where: eq(category.isActive, true),
				orderBy: [category.displayOrder, category.name],
				columns: { id: true, name: true, slug: true, typeId: true },
			}),
			db.query.subCategory.findMany({
				where: eq(subCategory.isActive, true),
				orderBy: [subCategory.displayOrder, subCategory.name],
				columns: { id: true, name: true, slug: true, categoryId: true },
			}),
			db.query.brand.findMany({
				orderBy: [brand.name],
				columns: { id: true, name: true },
			}),
		]);

		return { types, categories, subCategories, brands };
	}),

	/**
	 * Submit a product identity request (shop owner only).
	 * Used when a shop owner can't find a product in the catalog.
	 */
	submitProductIdentityRequest: shopOwnerProcedure
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

			return {
				success: true,
				request: created,
				message: "Product identity request submitted. Admin will review it.",
			};
		}),

	/**
	 * Get my product identity requests (shop owner only).
	 */
	getMyProductRequests: shopOwnerProcedure
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
// Shop Product Management (Retail Control Panel)
// ────────────────────────────────────────────────────────────────

type RetailerProductStockStatus =
	| "in_stock"
	| "attention"
	| "out_of_stock"
	| "setup_required";

function resolveRetailerProductStockStatus(
	variants: StructuredStockVariant[],
): RetailerProductStockStatus {
	if (
		variants.some(
			(variant) => variant.configurationState === "needs_admin_variant_setup",
		)
	) {
		return "setup_required";
	}
	if (
		variants.length === 0 ||
		variants.every((variant) => variant.status === "out_of_stock")
	) {
		return "out_of_stock";
	}
	if (variants.some((variant) => variant.status !== "in_stock")) {
		return "attention";
	}
	return "in_stock";
}

function buildRetailerProductGroups(rows: StructuredBrandStockSourceRow[]) {
	const rowsByProduct = new Map<number, StructuredBrandStockSourceRow[]>();
	for (const row of rows) {
		const productRows = rowsByProduct.get(row.productId) ?? [];
		productRows.push(row);
		rowsByProduct.set(row.productId, productRows);
	}

	return Array.from(rowsByProduct.entries())
		.flatMap(([productId, productRows]) => {
			const first = productRows[0];
			if (!first) return [];
			const detail = buildStructuredStockDetail(
				{ kind: "product", id: productId },
				productRows,
			);
			if (!detail) return [];

			return [
				{
					productId,
					name: first.productName,
					image: first.productImage || first.coreProductImage,
					category: {
						id: first.categoryId,
						name: first.categoryName,
					},
					brand: {
						id: first.brandId,
						name: first.brandName,
						logo: first.brandLogo,
						slug: first.brandSlug,
					},
					coreProduct: first.coreProductId
						? {
								id: first.coreProductId,
								name: first.coreProductName || first.productName,
								sku: first.coreProductSku,
							}
						: null,
					productTypeName: first.productTypeName,
					variantCount: detail.identity.variantCount,
					quantityGroups: detail.quantityGroups,
					stockStatus: detail.stockStatus,
					aggregateStatus: resolveRetailerProductStockStatus(detail.variants),
					configurationIssueCount: detail.configurationIssueCount,
					variants: detail.variants,
				},
			];
		})
		.sort(
			(a, b) =>
				a.name.localeCompare(b.name) ||
				a.brand.name.localeCompare(b.brand.name),
		);
}

async function loadRetailerProductStockSnapshot(ownerId: string) {
	const rows = await loadStructuredBrandStockRows(
		{ ownerType: "shop" },
		ownerId,
	);
	const structured = buildStructuredStockOverview(rows);
	const products = buildRetailerProductGroups(rows);

	const categories = Array.from(
		new Map(products.map((item) => [item.category.id, item.category])).values(),
	).sort((a, b) => a.name.localeCompare(b.name));
	const brands = Array.from(
		new Map(products.map((item) => [item.brand.id, item.brand])).values(),
	).sort((a, b) => a.name.localeCompare(b.name));

	return {
		products,
		categories,
		brands,
		dashboard: structured.dashboard,
	};
}

const shopProductEndpoints = {
	getShopInventoryIntegrity: shopOwnerProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const rows = await db
			.select({
				inventoryId: inventory.id,
				variantId: inventory.variantId,
				sku: productVariant.sku,
				productName: product.name,
				creatorSource: product.creatorSource,
				createdById: product.createdById,
				availableQty: inventory.availableQty,
				reservedQty: inventory.reservedQty,
			})
			.from(inventory)
			.innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
			.innerJoin(product, eq(productVariant.productId, product.id))
			.where(
				and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
					or(
						sql`${product.creatorSource} <> 'shop'`,
						sql`${product.createdById} IS DISTINCT FROM ${userId}`,
					),
				),
			);

		return { count: rows.length, violations: rows };
	}),

	/**
	 * Get the retailer's brand products with unit-safe structured stock.
	 */
	getShopProducts: shopOwnerProcedure
		.input(
			z.object({
				search: z.string().optional(),
				categoryId: z.number().optional(),
				stockStatus: z
					.enum([
						"all",
						"in_stock",
						"attention",
						"out_of_stock",
						"setup_required",
						"low",
					])
					.default("all"),
				brandId: z.number().optional(),
				page: z.number().default(1),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;
			const { search, categoryId, stockStatus, brandId, page, limit } = input;
			const offset = (page - 1) * limit;
			const snapshot = await loadRetailerProductStockSnapshot(userId);
			let items = snapshot.products;

			if (search?.trim()) {
				const s = search.toLowerCase();
				items = items.filter(
					(item) =>
						item.name.toLowerCase().includes(s) ||
						item.brand.name.toLowerCase().includes(s) ||
						item.coreProduct?.name.toLowerCase().includes(s) ||
						item.coreProduct?.sku?.toLowerCase().includes(s) ||
						item.variants.some(
							(variant) =>
								variant.sku?.toLowerCase().includes(s) ||
								variant.canonicalLabel?.toLowerCase().includes(s),
						),
				);
			}
			if (categoryId) {
				items = items.filter((item) => item.category.id === categoryId);
			}
			if (brandId) {
				items = items.filter((item) => item.brand.id === brandId);
			}
			if (stockStatus !== "all") {
				const normalizedStatus =
					stockStatus === "low" ? "attention" : stockStatus;
				items = items.filter(
					(item) => item.aggregateStatus === normalizedStatus,
				);
			}

			const totalCount = items.length;
			const paginated = items.slice(offset, offset + limit);

			return {
				items: paginated.map(({ variants: _variants, ...item }) => item),
				filterOptions: {
					categories: snapshot.categories,
					brands: snapshot.brands,
				},
				pagination: {
					page,
					limit,
					totalCount,
					totalPages: Math.ceil(totalCount / limit),
				},
			};
		}),

	/**
	 * Product and variant summary derived from the same structured snapshot.
	 */
	getShopProductKPIs: shopOwnerProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;
		const snapshot = await loadRetailerProductStockSnapshot(userId);
		return {
			activeProducts: snapshot.products.length,
			activeVariants: snapshot.dashboard.summary.activeVariants,
			lowStockVariants: snapshot.dashboard.stockStatus.lowStock,
			outOfStockVariants: snapshot.dashboard.stockStatus.outOfStock,
			configurationIssueCount: snapshot.dashboard.configurationIssueCount,
		};
	}),

	/**
	 * Detailed view of a retailer brand product using canonical variants.
	 */
	getShopProductDetail: shopOwnerProcedure
		.input(z.object({ productId: z.number() }))
		.handler(async ({ input, context }) => {
			const userId = context.session.user.id;
			const snapshot = await loadRetailerProductStockSnapshot(userId);
			const productGroup = snapshot.products.find(
				(item) => item.productId === input.productId,
			);
			if (!productGroup) {
				throw new ORPCError("NOT_FOUND", {
					message: "Product not found",
				});
			}

			const prod = await db.query.product.findFirst({
				where: eq(product.id, input.productId),
				with: {
					category: { columns: { id: true, name: true, slug: true } },
					subCategory: { columns: { id: true, name: true } },
					coreProduct: {
						columns: {
							id: true,
							name: true,
							sku: true,
							image: true,
						},
					},
					images: true,
					variants: {
						columns: {
							id: true,
							exchangeEnabled: true,
							exchangeCreditAmount: true,
						},
					},
				},
			});

			if (!prod)
				throw new ORPCError("NOT_FOUND", {
					message: "Product not found",
				});

			const cylinderSaleByVariant = new Map(
				prod.variants.map((variant) => [variant.id, variant]),
			);

			return {
				product: {
					id: prod.id,
					name: prod.name,
					slug: prod.slug,
					image: prod.image,
					description: prod.description,
					status: prod.status,
					visibility: prod.visibility,
					expiryEnabled: prod.expiryEnabled,
					damageControlEnabled: prod.damageControlEnabled,
					trackingType: prod.trackingType,
					isReturnablePack: prod.isReturnablePack,
					reorderLevel: prod.reorderLevel,
					category: prod.category,
					subCategory: prod.subCategory,
					coreProduct: prod.coreProduct,
					images: prod.images,
					brand: productGroup.brand,
					productTypeName: productGroup.productTypeName,
					isRetailerOwned:
						prod.creatorSource === "shop" && prod.createdById === userId,
				},
				summary: {
					variantCount: productGroup.variantCount,
					quantityGroups: productGroup.quantityGroups,
					stockStatus: productGroup.stockStatus,
					aggregateStatus: productGroup.aggregateStatus,
					configurationIssueCount: productGroup.configurationIssueCount,
				},
				variants: productGroup.variants.map(
					({ warehouseSellingPrice, ...variant }) => ({
						...variant,
						retailPrice: warehouseSellingPrice,
						exchangeEnabled:
							cylinderSaleByVariant.get(variant.variantId)?.exchangeEnabled ??
							false,
						exchangeCreditAmount: Number(
							cylinderSaleByVariant.get(variant.variantId)
								?.exchangeCreditAmount ?? 0,
						),
					}),
				),
			};
		}),

	/**
	 * Get options for the Create Product form (cascading selects).
	 * Returns types, categories, subcategories, core products, brands, variant options.
	 */
	getCreateProductOptions: shopOwnerProcedure
		.input(
			z.object({
				typeId: z.number().optional(),
				categoryId: z.number().optional(),
				subCategoryId: z.number().optional(),
			}),
		)
		.handler(async ({ input }) => {
			// Types
			const types = await db.query.productType.findMany({
				where: eq(productType.isActive, true),
				orderBy: [productType.displayOrder, productType.name],
				columns: { id: true, name: true, slug: true },
			});

			// Categories filtered by type
			const catFilter = input.typeId
				? and(eq(category.isActive, true), eq(category.typeId, input.typeId))
				: eq(category.isActive, true);
			const categories = await db.query.category.findMany({
				where: catFilter,
				orderBy: [category.displayOrder, category.name],
				columns: { id: true, name: true, slug: true, typeId: true },
			});

			// SubCategories filtered by category
			const subCatFilter = input.categoryId
				? and(
						eq(subCategory.isActive, true),
						eq(subCategory.categoryId, input.categoryId),
					)
				: eq(subCategory.isActive, true);
			const subCategories = await db.query.subCategory.findMany({
				where: subCatFilter,
				orderBy: [subCategory.displayOrder, subCategory.name],
				columns: { id: true, name: true, slug: true, categoryId: true },
			});

			// Core products filtered by category+subcategory
			const cpConditions: SQL[] = [];
			if (input.categoryId)
				cpConditions.push(eq(coreProductIdentity.categoryId, input.categoryId));
			if (input.subCategoryId)
				cpConditions.push(
					eq(coreProductIdentity.subCategoryId, input.subCategoryId),
				);
			const coreProducts = await db.query.coreProductIdentity.findMany({
				where: cpConditions.length > 0 ? and(...cpConditions) : undefined,
				columns: {
					id: true,
					name: true,
					sku: true,
					image: true,
					categoryId: true,
					subCategoryId: true,
				},
				orderBy: [coreProductIdentity.name],
			});

			// Brands
			const brands = await db.query.brand.findMany({
				orderBy: [brand.displayOrder, brand.name],
				columns: { id: true, name: true, slug: true, logo: true },
			});

			// Variant options — filtered by type+category scope
			const voConditions: SQL[] = [eq(variantOption.isActive, true)];
			if (input.typeId) {
				// Include global options (typeId=null) + type-specific + category-specific
				voConditions.push(
					or(
						sql`${variantOption.typeId} IS NULL`,
						eq(variantOption.typeId, input.typeId),
					)!,
				);
			}
			if (input.categoryId) {
				voConditions.push(
					or(
						sql`${variantOption.categoryId} IS NULL`,
						eq(variantOption.categoryId, input.categoryId),
					)!,
				);
			}
			const variantOptions = await db.query.variantOption.findMany({
				where: and(...voConditions),
				orderBy: [variantOption.sortOrder, variantOption.name],
				columns: {
					id: true,
					name: true,
					unit: true,
					size: true,
					variantType: true,
				},
			});

			return {
				types,
				categories,
				subCategories,
				coreProducts,
				brands,
				variantOptions,
			};
		}),

	/**
	 * Create a new shop product — full 8-step data.
	 * Creates product, product_brand links, product_variants, and initial inventory.
	 */
	createShopProduct: shopOwnerProcedure.input(z.unknown()).handler(async () => {
		throw new ORPCError("BAD_REQUEST", {
			message: "Retailer products must be configured from Product Catalog",
		});
	}),

	getMyStorePreview: shopOwnerProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		// 1. Get store identity from user row
		const storeUser = await db.query.user.findFirst({
			where: eq(user.id, userId),
			columns: {
				id: true,
				name: true,
				shopName: true,
				shopSlug: true,
				shopAddress: true,
				shopLat: true,
				shopLng: true,
				phoneNumber: true,
				ownerName: true,
				image: true,
			},
		});

		if (!storeUser)
			throw new ORPCError("NOT_FOUND", { message: "User not found" });

		// 2. Get all inventory for this shop owner with full product+variant+brand info
		const shopInventory = await db.query.inventory.findMany({
			where: and(
				eq(inventory.ownerType, "shop"),
				eq(inventory.ownerId, userId),
			),
			with: {
				variant: {
					columns: {
						id: true,
						productId: true,
						sku: true,
						unitLabel: true,
						weightKg: true,
						price: true,
						packType: true,
						brandId: true,
						color: true,
						size: true,
						isActive: true,
						isPackReturnRequired: true,
						packDepositAmount: true,
						sourceVariantOptionId: true,
					},
					with: {
						product: {
							columns: {
								id: true,
								name: true,
								slug: true,
								image: true,
								categoryId: true,
								coreProductId: true,
								status: true,
								reorderLevel: true,
								shortDescription: true,
								isReturnablePack: true,
							},
							with: {
								category: {
									columns: {
										id: true,
										name: true,
										slug: true,
									},
								},
							},
						},
						brand: {
							columns: { id: true, name: true, logo: true },
						},
					},
				},
			},
		});

		// 3. Group by product
		type VariantInfo = {
			variantId: number;
			sku: string | null;
			unitLabel: string;
			weightKg: string;
			packType: string | null;
			brandId: number | null;
			brandName: string | null;
			brandLogo: string | null;
			retailPrice: string | null;
			availableQty: number;
			isPackReturnRequired: boolean | null;
			packDepositAmount: string | null;
		};

		const productMap = new Map<
			number,
			{
				product: (typeof shopInventory)[0]["variant"]["product"];
				variants: VariantInfo[];
				totalStock: number;
				brands: Map<number, { id: number; name: string; logo: string | null }>;
			}
		>();

		for (const inv of shopInventory) {
			if (!inv.variant?.product) continue;
			const pid = inv.variant.product.id;

			if (!productMap.has(pid)) {
				productMap.set(pid, {
					product: inv.variant.product,
					variants: [],
					totalStock: 0,
					brands: new Map(),
				});
			}

			const entry = productMap.get(pid)!;
			const qty = Number(inv.availableQty);
			entry.totalStock += qty;

			entry.variants.push({
				variantId: inv.variant.id,
				sku: inv.variant.sku,
				unitLabel: inv.variant.unitLabel,
				weightKg: inv.variant.weightKg,
				packType: inv.variant.packType,
				brandId: inv.variant.brandId,
				brandName: inv.variant.brand?.name ?? null,
				brandLogo: inv.variant.brand?.logo ?? null,
				retailPrice: inv.retailPrice,
				availableQty: qty,
				isPackReturnRequired: inv.variant.isPackReturnRequired,
				packDepositAmount: inv.variant.packDepositAmount,
			});

			if (inv.variant.brand) {
				entry.brands.set(inv.variant.brand.id, {
					id: inv.variant.brand.id,
					name: inv.variant.brand.name,
					logo: inv.variant.brand.logo,
				});
			}
		}

		// 4. Derive categories
		const categoryMap = new Map<
			number,
			{ id: number; name: string; slug: string; productCount: number }
		>();
		for (const entry of productMap.values()) {
			const cat = entry.product.category;
			if (cat) {
				const existing = categoryMap.get(cat.id);
				if (existing) {
					existing.productCount++;
				} else {
					categoryMap.set(cat.id, { ...cat, productCount: 1 });
				}
			}
		}

		// 5. Build product list
		const REORDER_THRESHOLD = 10;
		const products = Array.from(productMap.values())
			.sort((a, b) => a.product.name.localeCompare(b.product.name))
			.map((entry) => {
				const reorderLevel = entry.product.reorderLevel || REORDER_THRESHOLD;
				let stockStatus: "in_stock" | "low" | "out_of_stock";
				if (entry.totalStock <= 0) stockStatus = "out_of_stock";
				else if (entry.totalStock <= reorderLevel) stockStatus = "low";
				else stockStatus = "in_stock";

				// Lowest retail price across variants
				const prices = entry.variants
					.map((v) => Number(v.retailPrice))
					.filter((p) => p > 0);
				const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;

				return {
					productId: entry.product.id,
					name: entry.product.name,
					slug: entry.product.slug,
					image: entry.product.image,
					shortDescription: entry.product.shortDescription,
					isReturnablePack: entry.product.isReturnablePack,
					category: entry.product.category,
					brands: Array.from(entry.brands.values()),
					variants: entry.variants,
					totalStock: entry.totalStock,
					stockStatus,
					lowestPrice,
					variantCount: entry.variants.length,
				};
			});

		return {
			store: {
				name: storeUser.shopName || storeUser.name,
				slug: storeUser.shopSlug,
				address: storeUser.shopAddress,
				lat: storeUser.shopLat,
				lng: storeUser.shopLng,
				phoneNumber: storeUser.phoneNumber,
				ownerName: storeUser.ownerName,
				image: storeUser.image,
			},
			categories: Array.from(categoryMap.values()),
			products,
			totalProducts: products.length,
		};
	}),

	/**
	 * Get store KPI stats: total orders, customers, avg rating.
	 */
	getMyStoreStats: shopOwnerProcedure.handler(async ({ context }) => {
		const userId = context.session.user.id;

		// Count B2C orders for this shop
		const [orderStats] = await db
			.select({
				totalOrders: count(),
				totalCustomers: sql<number>`COUNT(DISTINCT ${order.userId})`,
			})
			.from(order)
			.where(and(eq(order.shopId, userId), eq(order.orderType, "b2c")));

		// Get average product rating from reviews on shop's products
		const shopVariantIds = await db.query.inventory.findMany({
			where: and(
				eq(inventory.ownerType, "shop"),
				eq(inventory.ownerId, userId),
			),
			columns: { variantId: true },
		});

		const variantIds = shopVariantIds.map((i) => i.variantId);
		let avgRating = 0;
		let reviewCount = 0;

		if (variantIds.length > 0) {
			// Get product IDs from variant IDs
			const variants = await db.query.productVariant.findMany({
				where: inArray(productVariant.id, variantIds),
				columns: { productId: true },
			});
			const productIds = [...new Set(variants.map((v) => v.productId))];

			if (productIds.length > 0) {
				const [stats] = await db
					.select({
						avgRating: avg(productReview.rating),
						reviewCount: count(),
					})
					.from(productReview)
					.where(inArray(productReview.productId, productIds));

				avgRating = Number(stats?.avgRating) || 0;
				reviewCount = Number(stats?.reviewCount) || 0;
			}
		}

		return {
			totalOrders: Number(orderStats?.totalOrders) || 0,
			totalCustomers: Number(orderStats?.totalCustomers) || 0,
			avgRating: Math.round(avgRating * 10) / 10,
			reviewCount,
		};
	}),

	/**
	 * Search shop products for stock entry — returns products with their variants
	 * and current inventory quantities for the logged-in shop owner.
	 */
	getShopProductsForStock: shopOwnerProcedure
		.input(
			z.object({
				search: z.string().optional(),
				limit: z.number().default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Get all inventory for this shop, grouped by product
			const shopInventory = await db.query.inventory.findMany({
				where: and(
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
				),
				with: {
					variant: {
						with: {
							sourceVariantOption: true,
							product: {
								columns: {
									id: true,
									name: true,
									slug: true,
									image: true,
									categoryId: true,
								},
								with: {
									category: {
										columns: { id: true, name: true },
									},
									productBrands: {
										with: {
											brand: {
												columns: {
													id: true,
													name: true,
												},
											},
										},
									},
								},
							},
							brand: { columns: { id: true, name: true } },
						},
					},
				},
			});

			// Group by product
			const productMap = new Map<
				number,
				{
					id: number;
					name: string;
					image: string | null;
					category: { id: number; name: string } | null;
					variants: {
						variantId: number;
						inventoryId: number;
						unitLabel: string;
						weightKg: string;
						brandName: string | null;
						currentStock: number;
						retailPrice: string | null;
						operationalUnit: string;
						stockDisplay: string;
					}[];
				}
			>();

			for (const inv of shopInventory) {
				if (
					!inv.variant?.product ||
					!inv.variant.sourceVariantOption ||
					!inv.variant.isActive
				)
					continue;
				let semantics;
				try {
					semantics = resolveVariantStockSemantics(
						inv.variant.sourceVariantOption,
					);
				} catch {
					continue;
				}
				const prod = inv.variant.product;
				const pid = prod.id;

				if (!productMap.has(pid)) {
					productMap.set(pid, {
						id: pid,
						name: prod.name,
						image: prod.image,
						category: prod.category,
						variants: [],
					});
				}

				// Resolve brand
				const brandName =
					inv.variant.brand?.name ||
					(prod as any).productBrands?.[0]?.brand?.name ||
					null;

				productMap.get(pid)!.variants.push({
					variantId: inv.variant.id,
					inventoryId: inv.id,
					unitLabel: semantics.displayLabel,
					weightKg: inv.variant.weightKg,
					brandName,
					currentStock: Number(inv.availableQty),
					retailPrice: inv.retailPrice,
					operationalUnit: semantics.operationalUnit,
					stockDisplay: formatVariantStockQuantity(
						semantics,
						Number(inv.availableQty),
					),
				});
			}

			// Filter by search
			let products = Array.from(productMap.values());
			if (input.search?.trim()) {
				const s = input.search.toLowerCase();
				products = products.filter(
					(p) =>
						p.name.toLowerCase().includes(s) ||
						p.variants.some((v) => v.brandName?.toLowerCase().includes(s)),
				);
			}

			return {
				products: products.slice(0, input.limit),
				total: products.length,
			};
		}),

	/**
	 * Add stock to shop inventory — supports adding to multiple variants at once.
	 */
	addShopStock: shopOwnerProcedure
		.input(
			z.object({
				entries: z
					.array(
						z.object({
							inventoryId: z.number().int(),
							addQuantity: z.number().min(0),
						}),
					)
					.min(1, "At least one entry is required"),
				stockType: z
					.enum(["purchase", "return", "adjustment", "opening"])
					.default("purchase"),
				note: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// Validate all inventory rows belong to this shop
			const inventoryIds = input.entries.map((e) => e.inventoryId);
			if (new Set(inventoryIds).size !== inventoryIds.length) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Duplicate inventory entries are not allowed",
				});
			}
			const ownedInventory = await db.query.inventory.findMany({
				where: and(
					inArray(inventory.id, inventoryIds),
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
				),
				with: { variant: { with: { sourceVariantOption: true } } },
			});

			if (ownedInventory.length !== inventoryIds.length) {
				throw new ORPCError("FORBIDDEN", {
					message: "Some inventory items do not belong to your shop",
				});
			}
			for (const row of ownedInventory) {
				if (!row.variant?.isActive || !row.variant.sourceVariantOption) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Stock can only be added to an active generated variant",
					});
				}
				try {
					resolveVariantStockSemantics(row.variant.sourceVariantOption);
				} catch (error) {
					throw new ORPCError("BAD_REQUEST", {
						message:
							error instanceof Error
								? error.message
								: "Variant definition is invalid",
					});
				}
			}

			// Build a lookup
			const invLookup = new Map(ownedInventory.map((inv) => [inv.id, inv]));

			// Update quantities in a transaction
			const results = await db.transaction(async (tx) => {
				const updated: {
					inventoryId: number;
					oldQty: number;
					newQty: number;
				}[] = [];

				for (const entry of input.entries) {
					if (entry.addQuantity <= 0) continue;

					const existing = invLookup.get(entry.inventoryId)!;
					const oldQty = Number(existing.availableQty);
					const newQty = oldQty + entry.addQuantity;

					await tx
						.update(inventory)
						.set({ availableQty: String(newQty) })
						.where(eq(inventory.id, entry.inventoryId));

					updated.push({
						inventoryId: entry.inventoryId,
						oldQty,
						newQty,
					});
				}

				return updated;
			});

			return {
				updated: results,
				stockType: input.stockType,
				note: input.note || null,
				message: `Stock updated for ${results.length} variant(s)`,
			};
		}),

	// ────────────────────────────────────────────────────────────────
	// STOCK ADJUSTMENT ENDPOINTS
	// ────────────────────────────────────────────────────────────────

	/**
	 * Search shop inventory variants for the adjustment product picker.
	 * Returns variant-level results with current stock.
	 */
	searchShopVariantsForAdjustment: shopOwnerProcedure
		.input(
			z.object({
				search: z.string().optional(),
				limit: z.number().int().min(1).max(50).default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const baseConditions = and(
				eq(inventory.ownerType, "shop"),
				eq(inventory.ownerId, userId),
			);

			let searchCondition;
			if (input.search?.trim()) {
				const term = `%${input.search.trim()}%`;
				searchCondition = or(
					ilike(product.name, term),
					ilike(productVariant.sku ?? "", term),
					ilike(brand.name ?? "", term),
				);
			}

			const rows = await db
				.select({
					variantId: productVariant.id,
					inventoryId: inventory.id,
					sku: productVariant.sku,
					unitLabel: productVariant.unitLabel,
					weightKg: productVariant.weightKg,
					packType: productVariant.packType,
					orderUnit: productVariant.orderUnit,
					productId: product.id,
					productName: product.name,
					productImage: product.image,
					brandName: brand.name,
					availableQty: inventory.availableQty,
					retailPrice: inventory.retailPrice,
					variantPrice: productVariant.price,
				})
				.from(inventory)
				.innerJoin(productVariant, eq(inventory.variantId, productVariant.id))
				.innerJoin(product, eq(productVariant.productId, product.id))
				.leftJoin(brand, eq(productVariant.brandId, brand.id))
				.where(
					searchCondition
						? and(baseConditions, searchCondition)
						: baseConditions,
				)
				.orderBy(product.name)
				.limit(input.limit);

			return {
				variants: rows.map((r) => ({
					variantId: r.variantId,
					inventoryId: r.inventoryId,
					sku: r.sku,
					unitLabel: r.unitLabel,
					quantityUnit:
						r.packType === "cylinder" || r.orderUnit === "cylinder"
							? "cylinder"
							: r.orderUnit || r.packType || "unit",
					weightKg: r.weightKg,
					productId: r.productId,
					productName: r.productName,
					productImage: r.productImage,
					brandName: r.brandName,
					availableQty: parseFloat(r.availableQty || "0"),
					retailPrice:
						parseFloat(r.retailPrice || "0") ||
						parseFloat(r.variantPrice || "0"),
				})),
			};
		}),

	/**
	 * Create a stock adjustment for the shop — auto-submitted, applies to inventory.
	 * Uses "actual stock" input: adjustQty = actualQty - currentQty.
	 */
	createShopAdjustment: shopOwnerProcedure
		.input(
			z.object({
				adjustmentType: z.enum([
					"increase",
					"decrease",
					"damage",
					"loss",
					"correction",
				]),
				reason: z.enum([
					"physical_count",
					"damage",
					"expired",
					"theft",
					"system_error",
					"other",
				]),
				referenceNote: z.string().optional(),
				adjustmentDate: z.string(),
				items: z
					.array(
						z.object({
							inventoryId: z.number().int(),
							actualQty: z.number().min(0),
							note: z.string().optional(),
						}),
					)
					.min(1, "At least one item is required"),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Validate all inventory rows belong to this shop
			const inventoryIds = input.items.map((i) => i.inventoryId);
			const ownedInventory = await db.query.inventory.findMany({
				where: and(
					inArray(inventory.id, inventoryIds),
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
				),
				with: {
					variant: {
						columns: { id: true },
						with: {
							sourceVariantOption: true,
						},
					},
				},
			});

			if (ownedInventory.length !== inventoryIds.length) {
				throw new ORPCError("FORBIDDEN", {
					message: "Some inventory items do not belong to your shop",
				});
			}

			const invLookup = new Map(ownedInventory.map((inv) => [inv.id, inv]));

			// 2. Generate adjustment number (ADJ-S-xxxx for shop)
			const [maxResult] = await db
				.select({
					maxNo: sql<string>`MAX(${stockAdjustment.adjustmentNo})`,
				})
				.from(stockAdjustment)
				.where(eq(stockAdjustment.warehouseId, userId));

			const lastNum = maxResult?.maxNo
				? parseInt(maxResult.maxNo.replace(/^ADJ-S?-?/, ""), 10) || 0
				: 0;
			const adjustmentNo = `ADJ-S-${String(lastNum + 1).padStart(4, "0")}`;

			// 3. Build line items with auto-calculated adjustQty
			const lineItems = input.items.map((item) => {
				const inv = invLookup.get(item.inventoryId)!;
				const currentQty = parseFloat(inv.availableQty || "0");
				const adjustQty = item.actualQty - currentQty;
				const operations = inv.variant?.sourceVariantOption
					? resolveVariantOperations(inv.variant.sourceVariantOption)
					: null;
				if (
					operations &&
					!operations.allowsDecimal &&
					(!Number.isInteger(currentQty) || !Number.isInteger(item.actualQty))
				) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Variant ${inv.variantId}: adjustments require whole ${operations.operationalUnit} quantities`,
					});
				}
				return {
					variantId: inv.variantId,
					currentQty: String(currentQty),
					adjustQty: String(adjustQty),
					afterQty: String(item.actualQty),
					quantityUnit: operations?.operationalUnit ?? null,
					note: item.note || null,
					inventoryId: inv.id,
					actualQty: item.actualQty,
				};
			});

			// Filter out items with zero change
			const changedItems = lineItems.filter(
				(li) => parseFloat(li.adjustQty) !== 0,
			);

			if (changedItems.length === 0) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"No stock changes detected — all actual quantities match current stock",
				});
			}

			const totalQtyChange = changedItems.reduce(
				(sum, li) => sum + parseFloat(li.adjustQty),
				0,
			);

			// 4. Transaction: insert adjustment + items + update inventory
			const result = await db.transaction(async (tx) => {
				// Insert header
				const [header] = await tx
					.insert(stockAdjustment)
					.values({
						adjustmentNo,
						warehouseId: userId,
						adjustmentType: input.adjustmentType,
						reason: input.reason,
						referenceNote: input.referenceNote || null,
						adjustmentDate: input.adjustmentDate,
						status: "submitted",
						totalItems: changedItems.length,
						totalQtyChange: String(totalQtyChange),
						createdById: userId,
					})
					.returning();

				// Insert line items
				await tx.insert(stockAdjustmentItem).values(
					changedItems.map((li) => ({
						adjustmentId: header!.id,
						variantId: li.variantId,
						currentQty: li.currentQty,
						adjustQty: li.adjustQty,
						afterQty: li.afterQty,
						quantityUnit: li.quantityUnit,
						note: li.note,
					})),
				);

				// Update inventory quantities
				for (const li of changedItems) {
					const updated = await tx
						.update(inventory)
						.set({ availableQty: li.afterQty })
						.where(
							and(
								eq(inventory.id, li.inventoryId),
								sql`${inventory.availableQty}::numeric = ${Number(li.currentQty)}`,
							),
						)
						.returning({ id: inventory.id });
					if (updated.length === 0) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Variant ${li.variantId}: stock changed while the adjustment was being applied`,
						});
					}
				}

				return header!;
			});

			return {
				success: true,
				adjustmentId: result.id,
				adjustmentNo: result.adjustmentNo,
				totalItems: changedItems.length,
				totalQtyChange,
				message: `Adjustment ${result.adjustmentNo} applied — ${changedItems.length} item(s) updated`,
			};
		}),

	/**
	 * List shop adjustment history (paginated).
	 */
	getShopAdjustments: shopOwnerProcedure
		.input(
			z.object({
				search: z.string().optional(),
				adjustmentType: z
					.enum(["increase", "decrease", "damage", "loss", "correction"])
					.optional(),
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(100).default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const offset = (input.page - 1) * input.pageSize;

			const conditions: SQL[] = [eq(stockAdjustment.warehouseId, userId)];

			if (input.adjustmentType) {
				conditions.push(
					eq(stockAdjustment.adjustmentType, input.adjustmentType),
				);
			}
			if (input.search?.trim()) {
				const term = `%${input.search.trim()}%`;
				conditions.push(ilike(stockAdjustment.adjustmentNo, term));
			}

			const where = and(...conditions);

			const [rows, countResult] = await Promise.all([
				db
					.select({
						id: stockAdjustment.id,
						adjustmentNo: stockAdjustment.adjustmentNo,
						adjustmentType: stockAdjustment.adjustmentType,
						reason: stockAdjustment.reason,
						status: stockAdjustment.status,
						adjustmentDate: stockAdjustment.adjustmentDate,
						totalItems: stockAdjustment.totalItems,
						totalQtyChange: stockAdjustment.totalQtyChange,
						referenceNote: stockAdjustment.referenceNote,
						createdAt: stockAdjustment.createdAt,
					})
					.from(stockAdjustment)
					.where(where)
					.orderBy(desc(stockAdjustment.createdAt))
					.limit(input.pageSize)
					.offset(offset),
				db
					.select({ count: sql<number>`COUNT(*)::int` })
					.from(stockAdjustment)
					.where(where),
			]);

			const totalCount = countResult[0]?.count ?? 0;

			return {
				items: rows,
				totalCount,
				page: input.page,
				pageSize: input.pageSize,
				totalPages: Math.ceil(totalCount / input.pageSize),
			};
		}),

	// ────────────────────────────────────────────────────────────────
	// DAMAGE MANAGEMENT ENDPOINTS
	// ────────────────────────────────────────────────────────────────

	/**
	 * Create a damage entry — deducts inventory, calculates financial loss.
	 */
	createDamageEntry: shopOwnerProcedure
		.input(
			z.object({
				damageType: z.enum(["physical", "expired", "lost"]),
				description: z.string().optional(),
				proofImages: z.array(z.string()).default([]),
				enteredByName: z.string().optional(),
				entryDate: z.string(),
				items: z
					.array(
						z.object({
							inventoryId: z.number().int(),
							qty: z.number().int().min(1),
							unitPrice: z.number().min(0).optional(),
							note: z.string().optional(),
						}),
					)
					.min(1, "At least one item is required"),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			// 1. Validate all inventory rows belong to this shop
			const inventoryIds = input.items.map((i) => i.inventoryId);
			const ownedInventory = await db.query.inventory.findMany({
				where: and(
					inArray(inventory.id, inventoryIds),
					eq(inventory.ownerType, "shop"),
					eq(inventory.ownerId, userId),
				),
			});

			if (ownedInventory.length !== inventoryIds.length) {
				throw new ORPCError("FORBIDDEN", {
					message: "Some inventory items do not belong to your shop",
				});
			}

			const invLookup = new Map(ownedInventory.map((inv) => [inv.id, inv]));

			// 2. Validate stock is sufficient
			for (const item of input.items) {
				const inv = invLookup.get(item.inventoryId)!;
				const available = parseFloat(inv.availableQty || "0");
				if (item.qty > available) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Insufficient stock for inventory ${item.inventoryId}: available=${available}, requested=${item.qty}`,
					});
				}
			}

			// 2b. Fetch variant base prices as fallback
			const variantIds = ownedInventory.map((inv) => inv.variantId);
			const variantRows = await db
				.select({ id: productVariant.id, price: productVariant.price })
				.from(productVariant)
				.where(inArray(productVariant.id, variantIds));
			const variantPriceLookup = new Map(
				variantRows.map((v) => [v.id, parseFloat(v.price || "0")]),
			);

			// 3. Generate entry number (DMG-0001)
			const [maxResult] = await db
				.select({
					maxNo: sql<string>`MAX(${damageEntry.entryNo})`,
				})
				.from(damageEntry)
				.where(eq(damageEntry.shopId, userId));

			const lastNum = maxResult?.maxNo
				? parseInt(maxResult.maxNo.replace(/^DMG-/, ""), 10) || 0
				: 0;
			const entryNo = `DMG-${String(lastNum + 1).padStart(4, "0")}`;

			// 4. Build line items
			const lineItems = input.items.map((item) => {
				const inv = invLookup.get(item.inventoryId)!;
				const retailPrice = parseFloat(inv.retailPrice || "0");
				const variantBasePrice = variantPriceLookup.get(inv.variantId) ?? 0;
				const unitPrice =
					item.unitPrice ?? (retailPrice > 0 ? retailPrice : variantBasePrice);
				return {
					inventoryId: inv.id,
					variantId: inv.variantId,
					qty: item.qty,
					unitPrice: String(unitPrice),
					totalValue: String(item.qty * unitPrice),
					note: item.note || null,
				};
			});

			const totalQty = lineItems.reduce((s, li) => s + li.qty, 0);
			const totalLossValue = lineItems.reduce(
				(s, li) => s + parseFloat(li.totalValue),
				0,
			);

			// 5. Transaction: insert entry + items + deduct inventory
			const result = await db.transaction(async (tx) => {
				const [header] = await tx
					.insert(damageEntry)
					.values({
						entryNo,
						shopId: userId,
						damageType: input.damageType,
						description: input.description || null,
						proofImages: input.proofImages,
						totalQty,
						totalLossValue: String(totalLossValue),
						enteredByName: input.enteredByName || null,
						entryDate: input.entryDate,
						status: "active",
						createdById: userId,
					})
					.returning();

				await tx.insert(damageEntryItem).values(
					lineItems.map((li) => ({
						damageEntryId: header!.id,
						inventoryId: li.inventoryId,
						variantId: li.variantId,
						qty: li.qty,
						unitPrice: li.unitPrice,
						totalValue: li.totalValue,
						note: li.note,
					})),
				);

				// Deduct inventory
				for (const li of lineItems) {
					await tx
						.update(inventory)
						.set({
							availableQty: sql`CAST(${inventory.availableQty} AS numeric) - ${li.qty}`,
						})
						.where(eq(inventory.id, li.inventoryId));
				}

				return header!;
			});

			return {
				success: true,
				entryId: result.id,
				entryNo: result.entryNo,
				totalQty,
				totalLossValue,
				message: `Damage entry ${result.entryNo} recorded — ${totalQty} item(s), ৳${totalLossValue} loss`,
			};
		}),

	/**
	 * List damage entries (paginated, filterable).
	 */
	getDamageEntries: shopOwnerProcedure
		.input(
			z.object({
				search: z.string().optional(),
				damageType: z.enum(["physical", "expired", "lost"]).optional(),
				page: z.number().int().min(1).default(1),
				pageSize: z.number().int().min(1).max(100).default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			const offset = (input.page - 1) * input.pageSize;

			const conditions: SQL[] = [
				eq(damageEntry.shopId, userId),
				eq(damageEntry.status, "active"),
			];

			if (input.damageType) {
				conditions.push(eq(damageEntry.damageType, input.damageType));
			}
			if (input.search?.trim()) {
				const term = `%${input.search.trim()}%`;
				conditions.push(ilike(damageEntry.entryNo, term));
			}

			const where = and(...conditions);

			const [rows, countResult] = await Promise.all([
				db
					.select({
						id: damageEntry.id,
						entryNo: damageEntry.entryNo,
						damageType: damageEntry.damageType,
						totalQty: damageEntry.totalQty,
						totalLossValue: damageEntry.totalLossValue,
						enteredByName: damageEntry.enteredByName,
						entryDate: damageEntry.entryDate,
						createdAt: damageEntry.createdAt,
					})
					.from(damageEntry)
					.where(where)
					.orderBy(desc(damageEntry.createdAt))
					.limit(input.pageSize)
					.offset(offset),
				db
					.select({ count: sql<number>`COUNT(*)::int` })
					.from(damageEntry)
					.where(where),
			]);

			const totalCount = countResult[0]?.count ?? 0;

			return {
				items: rows,
				totalCount,
				page: input.page,
				pageSize: input.pageSize,
				totalPages: Math.ceil(totalCount / input.pageSize),
			};
		}),

	/**
	 * Get single damage entry detail with line items.
	 */
	getDamageEntryDetail: shopOwnerProcedure
		.input(z.object({ id: z.number().int() }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;

			const entry = await db
				.select()
				.from(damageEntry)
				.where(
					and(eq(damageEntry.id, input.id), eq(damageEntry.shopId, userId)),
				)
				.limit(1);

			if (!entry[0]) {
				throw new ORPCError("NOT_FOUND", {
					message: "Damage entry not found",
				});
			}

			const items = await db
				.select({
					id: damageEntryItem.id,
					variantId: damageEntryItem.variantId,
					qty: damageEntryItem.qty,
					unitPrice: damageEntryItem.unitPrice,
					totalValue: damageEntryItem.totalValue,
					note: damageEntryItem.note,
					sku: productVariant.sku,
					unitLabel: productVariant.unitLabel,
					weightKg: productVariant.weightKg,
					productName: product.name,
					productImage: product.image,
					brandName: brand.name,
					categoryName: category.name,
				})
				.from(damageEntryItem)
				.innerJoin(
					productVariant,
					eq(damageEntryItem.variantId, productVariant.id),
				)
				.innerJoin(product, eq(productVariant.productId, product.id))
				.leftJoin(brand, eq(productVariant.brandId, brand.id))
				.leftJoin(category, eq(product.categoryId, category.id))
				.where(eq(damageEntryItem.damageEntryId, input.id))
				.orderBy(damageEntryItem.id);

			return { ...entry[0], items };
		}),

	/**
	 * KPI summary for damage management.
	 */
	getDamageSummary: shopOwnerProcedure
		.input(z.void())
		.handler(async ({ context }) => {
			const userId = context.session.user.id;

			const [result] = await db
				.select({
					totalEntries: sql<number>`COUNT(*)::int`,
					totalDamageQty: sql<number>`COALESCE(SUM(${damageEntry.totalQty}), 0)::int`,
					totalLossValue: sql<string>`COALESCE(SUM(${damageEntry.totalLossValue}::numeric), 0)::text`,
				})
				.from(damageEntry)
				.where(
					and(eq(damageEntry.shopId, userId), eq(damageEntry.status, "active")),
				);

			return {
				totalEntries: result?.totalEntries ?? 0,
				totalDamageQty: result?.totalDamageQty ?? 0,
				totalLossValue: parseFloat(result?.totalLossValue ?? "0"),
			};
		}),
};

// ────────────────────────────────────────────────────────────────
// Export combined router
// ────────────────────────────────────────────────────────────────

export const shopOwnerRouter = {
	...b2bQueries,
	...managementQueries,
	...mutations,
	...orderQueries,
	...retailerSupplierQueries,
	...incomingOrderQueries,
	...warehouseOrderQueries,
	...openOrderEndpoints,
	...warehouseConnectionEndpoints,
	...shopStorefrontEndpoints,
	...publicCatalogEndpoints,
	...shopProductEndpoints,
	...shopProductConfigEndpoints,
};
