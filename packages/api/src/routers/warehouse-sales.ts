import { db } from "@bikalpo-project/db";
import {
	deliveryGroupInvoice,
	estimate,
	invoice,
	invoiceItem,
	order,
	user,
	warehouseDueCollection,
	warehousePosPayment,
	warehousePosSale,
	warehousePosSaleItem,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { warehouseProcedure } from "../index";

const saleTypeInput = z
	.enum(["all", "pos", "order", "salesman", "pre_order"])
	.default("all");

const saleStatusInput = z
	.enum(["all", "completed", "due", "cancelled"])
	.default("all");

const salePaymentInput = z
	.enum(["all", "cash", "bkash", "nagad", "bank", "due"])
	.default("all");

const saleDateInput = z
	.enum(["today", "this_week", "this_month", "custom", "all"])
	.default("all");

type SaleType = z.infer<typeof saleTypeInput>;
type SaleStatus = Exclude<z.infer<typeof saleStatusInput>, "all">;
type SalePayment = z.infer<typeof salePaymentInput>;

type PaymentHistoryRow = {
	date: Date;
	method: string;
	amount: number;
	reference: string | null;
};

type NormalizedSaleRow = {
	key: string;
	kind: "pos" | "invoice";
	id: number;
	invoiceNumber: string;
	date: Date;
	customerName: string;
	customerPhone: string | null;
	type: Exclude<SaleType, "all">;
	typeLabel: string;
	typeDetail: string | null;
	total: number;
	paid: number;
	due: number;
	paymentMethod: string | null;
	paymentMethodLabel: string;
	status: SaleStatus;
	statusLabel: string;
	sourceId: string | null;
	orderId: number | null;
	orderNumber: string | null;
	estimateRef: string | null;
	salesmanId: string | null;
	salesmanName: string | null;
	itemCount: number;
	firstItemName: string | null;
};

function toNumber(value: string | number | null | undefined) {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (!value) return 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function toMoney(value: string | number | null | undefined) {
	return toNumber(value).toFixed(2);
}

function formatMethod(method: string | null | undefined) {
	if (!method) return "Not recorded";
	const normalized = method.replace(/_/g, " ");
	if (normalized === "cash on delivery") return "Cash";
	if (normalized === "bank transfer") return "Bank";
	if (normalized === "bkash") return "bKash";
	if (normalized === "nagad") return "Nagad";
	if (normalized === "due") return "Due";
	if (normalized === "cash") return "Cash";
	if (normalized === "bank") return "Bank";
	return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizePaymentMethod(
	method: string | null | undefined,
): SalePayment {
	if (!method) return "all";
	if (method === "bank_transfer") return "bank";
	if (method === "cash_on_delivery") return "cash";
	if (method === "bank") return "bank";
	if (method === "cash") return "cash";
	if (method === "bkash") return "bkash";
	if (method === "nagad") return "nagad";
	if (method === "due") return "due";
	return "all";
}

function getDateRange(input: {
	dateRange: z.infer<typeof saleDateInput>;
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

	if (input.dateRange === "this_week") {
		start = new Date(now);
		start.setDate(now.getDate() - now.getDay());
		start.setHours(0, 0, 0, 0);
		end = new Date(start);
		end.setDate(start.getDate() + 6);
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
		if (start && !Number.isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
		if (end && !Number.isNaN(end.getTime())) end.setHours(23, 59, 59, 999);
	}

	return { start, end };
}

function getOrderSourceLabel(source: string) {
	if (source === "direct") return "Order";
	if (source === "estimate") return "Order";
	if (source === "salesman") return "Salesman";
	if (source === "pre_order") return "Pre-order";
	return "Order";
}

function getOrderSaleType(source: string): Exclude<SaleType, "all" | "pos"> {
	if (source === "salesman") return "salesman";
	if (source === "pre_order") return "pre_order";
	return "order";
}

function getSaleStatus(
	status: string,
	due: number,
): {
	status: SaleStatus;
	label: string;
} {
	if (status === "cancelled") {
		return { status: "cancelled", label: "Cancelled" };
	}
	if (due > 0) {
		return { status: "due", label: "Due" };
	}
	return { status: "completed", label: "Completed" };
}

function passesSearch(row: NormalizedSaleRow, search?: string) {
	const term = search?.trim().toLowerCase();
	if (!term) return true;

	return [
		row.invoiceNumber,
		row.customerName,
		row.customerPhone,
		row.orderNumber,
		row.estimateRef,
		row.salesmanName,
	]
		.filter(Boolean)
		.some((value) => String(value).toLowerCase().includes(term));
}

function passesPayment(row: NormalizedSaleRow, payment: SalePayment) {
	if (payment === "all") return true;
	if (payment === "due") return row.due > 0;
	return normalizePaymentMethod(row.paymentMethod) === payment;
}

function getPeakWindow(rows: NormalizedSaleRow[]) {
	if (rows.length === 0) return "No sales";

	const buckets = new Map<number, number>();
	for (const row of rows) {
		const hour = new Date(row.date).getHours();
		const start = Math.floor(hour / 2) * 2;
		buckets.set(start, (buckets.get(start) ?? 0) + 1);
	}

	const [peakStart] = [...buckets.entries()].sort((left, right) => {
		if (right[1] !== left[1]) return right[1] - left[1];
		return left[0] - right[0];
	})[0] ?? [0, 0];

	return `${formatHour(peakStart)} - ${formatHour((peakStart + 2) % 24)}`;
}

function formatHour(hour: number) {
	const suffix = hour >= 12 ? "PM" : "AM";
	const normalized = hour % 12 || 12;
	return `${normalized}${suffix}`;
}

function buildInsights(rows: NormalizedSaleRow[]) {
	const highestSale = rows.reduce<NormalizedSaleRow | null>((highest, row) => {
		if (!highest || row.total > highest.total) return row;
		return highest;
	}, null);

	const typeCounts = new Map<string, number>();
	for (const row of rows) {
		typeCounts.set(row.typeLabel, (typeCounts.get(row.typeLabel) ?? 0) + 1);
	}

	const mostCommonType =
		[...typeCounts.entries()].sort((left, right) => {
			if (right[1] !== left[1]) return right[1] - left[1];
			return left[0].localeCompare(right[0]);
		})[0]?.[0] ?? "No sales";

	return {
		highestSale: highestSale
			? {
					amount: highestSale.total,
					invoiceNumber: highestSale.invoiceNumber,
				}
			: null,
		mostCommonType,
		dueTransactions: rows.filter((row) => row.due > 0).length,
		peakSalesTime: getPeakWindow(rows),
	};
}

export const warehouseSalesRouter = {
	listSales: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/sales",
			tags: ["Warehouse Sales"],
			summary: "List warehouse sales",
		})
		.input(
			z.object({
				search: z.string().optional(),
				dateRange: saleDateInput,
				dateFrom: z.string().optional(),
				dateTo: z.string().optional(),
				type: saleTypeInput,
				status: saleStatusInput,
				payment: salePaymentInput,
				salesmanId: z.string().optional(),
				page: z.number().int().min(1).default(1),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;
			const dateRange = getDateRange(input);

			const [warehouseUser, salesmen] = await Promise.all([
				db.query.user.findFirst({
					where: eq(user.id, warehouseId),
					columns: { name: true, warehouseName: true },
				}),
				db
					.select({
						id: user.id,
						name: user.name,
					})
					.from(user)
					.where(
						and(eq(user.role, "salesman"), eq(user.warehouseId, warehouseId)),
					)
					.orderBy(user.name),
			]);

			const posConditions: SQL[] = [
				eq(warehousePosSale.warehouseId, warehouseId),
			];
			if (dateRange?.start)
				posConditions.push(gte(warehousePosSale.createdAt, dateRange.start));
			if (dateRange?.end)
				posConditions.push(lte(warehousePosSale.createdAt, dateRange.end));

			const invoiceConditions: SQL[] = [
				eq(order.warehouseId, warehouseId),
				eq(order.orderType, "b2b"),
				eq(invoice.invoiceType, "main"),
			];
			if (dateRange?.start)
				invoiceConditions.push(gte(invoice.createdAt, dateRange.start));
			if (dateRange?.end)
				invoiceConditions.push(lte(invoice.createdAt, dateRange.end));

			const [posSales, invoiceRows] = await Promise.all([
				db.query.warehousePosSale.findMany({
					where: and(...posConditions),
					with: {
						items: {
							columns: {
								id: true,
								productName: true,
								variantLabel: true,
							},
						},
						payments: {
							columns: {
								amount: true,
								paymentMethod: true,
								paidAt: true,
								transactionRef: true,
							},
							orderBy: [desc(warehousePosPayment.paidAt)],
						},
					},
					orderBy: [desc(warehousePosSale.createdAt)],
				}),
				db
					.select({
						id: invoice.id,
						invoiceNumber: invoice.invoiceNumber,
						orderId: invoice.orderId,
						customerId: invoice.customerId,
						paymentStatus: invoice.paymentStatus,
						deliveryStatus: invoice.deliveryStatus,
						subtotal: invoice.subtotal,
						discountAmount: invoice.discountAmount,
						deliveryCharge: invoice.deliveryCharge,
						taxAmount: invoice.taxAmount,
						grandTotal: invoice.grandTotal,
						createdAt: invoice.createdAt,
						deliveredAt: invoice.deliveredAt,
						updatedAt: invoice.updatedAt,
						orderNumber: order.orderNumber,
						orderSource: order.orderSource,
						orderStatus: order.status,
						orderPaymentMethod: order.paymentMethod,
						shippingName: order.shippingName,
						shippingPhone: order.shippingPhone,
						customerName: user.name,
						customerPhone: user.phoneNumber,
						shopName: user.shopName,
					})
					.from(invoice)
					.innerJoin(order, eq(invoice.orderId, order.id))
					.leftJoin(user, eq(invoice.customerId, user.id))
					.where(and(...invoiceConditions))
					.orderBy(desc(invoice.createdAt)),
			]);

			const invoiceIds = invoiceRows.map((row) => row.id);
			const orderIds = invoiceRows.map((row) => row.orderId);

			const [invoiceItems, invoicePayments, estimateRows, dueCollectionRows] = await Promise.all([
				invoiceIds.length
					? db
							.select({
								invoiceId: invoiceItem.invoiceId,
								productName: invoiceItem.productName,
							})
							.from(invoiceItem)
							.where(inArray(invoiceItem.invoiceId, invoiceIds))
					: Promise.resolve([]),
				invoiceIds.length
					? db
							.select({
								invoiceId: deliveryGroupInvoice.invoiceId,
								method: deliveryGroupInvoice.paymentMethod,
								amount: deliveryGroupInvoice.amountCollected,
								transactionId: deliveryGroupInvoice.transactionId,
								paidAt: deliveryGroupInvoice.deliveredAt,
								createdAt: deliveryGroupInvoice.createdAt,
							})
							.from(deliveryGroupInvoice)
							.where(inArray(deliveryGroupInvoice.invoiceId, invoiceIds))
					: Promise.resolve([]),
				orderIds.length
					? db
							.select({
								orderId: estimate.convertedOrderId,
								estimateNumber: estimate.estimateNumber,
								salesmanId: estimate.salesmanId,
								salesmanName: user.name,
							})
							.from(estimate)
							.leftJoin(user, eq(estimate.salesmanId, user.id))
							.where(inArray(estimate.convertedOrderId, orderIds))
					: Promise.resolve([]),
				invoiceIds.length
					? db
							.select({
								invoiceId: warehouseDueCollection.invoiceId,
								amount: warehouseDueCollection.amount,
							})
							.from(warehouseDueCollection)
							.where(inArray(warehouseDueCollection.invoiceId, invoiceIds))
					: Promise.resolve([]),
			]);

			const itemCounts = new Map<number, number>();
			const firstItemNames = new Map<number, string>();
			for (const item of invoiceItems) {
				itemCounts.set(
					item.invoiceId,
					(itemCounts.get(item.invoiceId) ?? 0) + 1,
				);
				if (!firstItemNames.has(item.invoiceId)) {
					firstItemNames.set(item.invoiceId, item.productName);
				}
			}

			const invoicePaymentsById = new Map<number, PaymentHistoryRow[]>();
			for (const payment of invoicePayments) {
				const amount = toNumber(payment.amount);
				if (amount <= 0) continue;
				const rows = invoicePaymentsById.get(payment.invoiceId) ?? [];
				rows.push({
					date: payment.paidAt ?? payment.createdAt,
					method: payment.method ?? "cash",
					amount,
					reference: payment.transactionId,
				});
				invoicePaymentsById.set(payment.invoiceId, rows);
			}

			// Aggregate due-collection amounts per invoice
			const dueCollectionsByInvoice = new Map<number, number>();
			for (const dc of dueCollectionRows) {
				const amount = toNumber(dc.amount);
				if (amount > 0) {
					dueCollectionsByInvoice.set(
						dc.invoiceId,
						(dueCollectionsByInvoice.get(dc.invoiceId) ?? 0) + amount,
					);
				}
			}

			const estimateByOrderId = new Map(
				estimateRows
					.filter((row) => row.orderId !== null)
					.map((row) => [row.orderId as number, row]),
			);

			const posRows: NormalizedSaleRow[] = posSales.map((sale) => {
				const total = toNumber(sale.total);
				const paid = toNumber(sale.paid);
				const due = toNumber(sale.due);
				const status = getSaleStatus(sale.status, due);
				const firstPayment = sale.payments[0];
				const method = firstPayment?.paymentMethod ?? sale.paymentMethod;

				return {
					key: `pos-${sale.id}`,
					kind: "pos",
					id: sale.id,
					invoiceNumber: sale.invoiceNo,
					date: sale.createdAt,
					customerName: sale.customerName,
					customerPhone: sale.customerPhone,
					type: "pos",
					typeLabel: "POS",
					typeDetail: sale.saleType,
					total,
					paid,
					due,
					paymentMethod: method,
					paymentMethodLabel: formatMethod(method),
					status: status.status,
					statusLabel: status.label,
					sourceId: `POS-${sale.id}`,
					orderId: null,
					orderNumber: null,
					estimateRef: null,
					salesmanId: null,
					salesmanName: null,
					itemCount: sale.items.length,
					firstItemName: sale.items[0]?.productName ?? null,
				};
			});

			const orderInvoiceRows: NormalizedSaleRow[] = invoiceRows.map((row) => {
				const total = toNumber(row.grandTotal);
				const paymentRows = invoicePaymentsById.get(row.id) ?? [];
				let paid = paymentRows.reduce(
					(sumValue, payment) => sumValue + payment.amount,
					0,
				);
				// Add due-collection amounts
				paid += dueCollectionsByInvoice.get(row.id) ?? 0;
				if (paid <= 0 && ["collected", "settled"].includes(row.paymentStatus)) {
					paid = total;
				}
				const due = Math.max(0, total - paid);
				const status = getSaleStatus(row.orderStatus, due);
				const source = getOrderSaleType(row.orderSource);
				const estimateInfo = estimateByOrderId.get(row.orderId);
				const method = paymentRows[0]?.method ?? row.orderPaymentMethod;

				return {
					key: `invoice-${row.id}`,
					kind: "invoice",
					id: row.id,
					invoiceNumber: row.invoiceNumber,
					date: row.createdAt,
					customerName: row.shopName || row.customerName || row.shippingName,
					customerPhone: row.customerPhone || row.shippingPhone,
					type: source,
					typeLabel: getOrderSourceLabel(row.orderSource),
					typeDetail: row.orderSource,
					total,
					paid,
					due,
					paymentMethod: method,
					paymentMethodLabel: formatMethod(method),
					status: status.status,
					statusLabel: status.label,
					sourceId: row.orderNumber,
					orderId: row.orderId,
					orderNumber: row.orderNumber,
					estimateRef: estimateInfo?.estimateNumber ?? null,
					salesmanId: estimateInfo?.salesmanId ?? null,
					salesmanName: estimateInfo?.salesmanName ?? null,
					itemCount: itemCounts.get(row.id) ?? 0,
					firstItemName: firstItemNames.get(row.id) ?? null,
				};
			});

			const scopedRows = [...posRows, ...orderInvoiceRows]
				.filter((row) => input.status === "all" || row.status === input.status)
				.filter((row) => passesPayment(row, input.payment))
				.filter(
					(row) => !input.salesmanId || row.salesmanId === input.salesmanId,
				)
				.filter((row) => passesSearch(row, input.search))
				.sort(
					(left, right) =>
						new Date(right.date).getTime() - new Date(left.date).getTime(),
				);

			const sourceCounts = scopedRows.reduce(
				(counts, row) => {
					counts[row.type] = (counts[row.type] ?? 0) + 1;
					return counts;
				},
				{
					pos: 0,
					order: 0,
					salesman: 0,
					pre_order: 0,
				} as Record<Exclude<SaleType, "all">, number>,
			);

			const allRows = scopedRows.filter(
				(row) => input.type === "all" || row.type === input.type,
			);

			const offset = (input.page - 1) * input.limit;
			const rows = allRows.slice(offset, offset + input.limit);

			return {
				warehouse: {
					label:
						warehouseUser?.warehouseName || warehouseUser?.name || "Warehouse",
				},
				summary: {
					counts: sourceCounts,
					totalSales: allRows.reduce(
						(sumValue, row) => sumValue + row.total,
						0,
					),
					totalPaid: allRows.reduce((sumValue, row) => sumValue + row.paid, 0),
					totalDue: allRows.reduce((sumValue, row) => sumValue + row.due, 0),
				},
				insights: buildInsights(allRows),
				filterOptions: { salesmen },
				rows,
				exportRows: allRows,
				pagination: {
					page: input.page,
					limit: input.limit,
					totalCount: allRows.length,
					totalPages: Math.ceil(allRows.length / input.limit),
				},
			};
		}),

	getSaleDetail: warehouseProcedure
		.route({
			method: "GET",
			path: "/warehouse/sales/{kind}/{id}",
			tags: ["Warehouse Sales"],
			summary: "Get warehouse sale detail",
		})
		.input(
			z.object({
				kind: z.enum(["pos", "invoice"]),
				id: z.number().int().positive(),
			}),
		)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;

			if (input.kind === "pos") {
				const sale = await db.query.warehousePosSale.findFirst({
					where: and(
						eq(warehousePosSale.id, input.id),
						eq(warehousePosSale.warehouseId, warehouseId),
					),
					with: {
						items: {
							orderBy: [warehousePosSaleItem.id],
						},
						payments: {
							orderBy: [desc(warehousePosPayment.paidAt)],
						},
					},
				});

				if (!sale) {
					throw new ORPCError("NOT_FOUND", { message: "Sale not found" });
				}

				const due = toNumber(sale.due);
				const status = getSaleStatus(sale.status, due);

				return {
					kind: "pos" as const,
					basic: {
						invoiceNumber: sale.invoiceNo,
						customerName: sale.customerName,
						phone: sale.customerPhone,
						salesType: "POS",
						salesman: null,
						date: sale.createdAt,
					},
					items: sale.items.map((item) => ({
						product: item.productName,
						variant: item.variantLabel,
						quantity: `${toNumber(item.quantity).toLocaleString("en-BD")} ${item.unitLabel}`,
						price: toMoney(item.unitPrice),
						total: toMoney(item.lineTotal),
					})),
					payment: {
						subtotal: toMoney(sale.subtotal),
						discount: toMoney(sale.discount),
						total: toMoney(sale.total),
						paid: toMoney(sale.paid),
						due: toMoney(sale.due),
					},
					paymentHistory: sale.payments.map((payment) => ({
						date: payment.paidAt,
						method: formatMethod(payment.paymentMethod),
						amount: toMoney(payment.amount),
						reference: payment.transactionRef,
					})),
					source: {
						source: "POS",
						sourceId: `POS-${sale.id}`,
						orderId: null,
						estimateRef: null,
					},
					status: status.label,
					statusKey: status.status,
				};
			}

			const invoiceData = await db.query.invoice.findFirst({
				where: eq(invoice.id, input.id),
				with: {
					items: {
						orderBy: [invoiceItem.id],
					},
					order: true,
					customer: {
						columns: {
							name: true,
							phoneNumber: true,
							shopName: true,
						},
					},
				},
			});

			if (
				!invoiceData ||
				!invoiceData.order ||
				invoiceData.order.warehouseId !== warehouseId
			) {
				throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
			}

			const orderData = invoiceData.order;

			const [payments, estimateData, dueCollections] = await Promise.all([
				db
					.select({
						method: deliveryGroupInvoice.paymentMethod,
						amount: deliveryGroupInvoice.amountCollected,
						transactionId: deliveryGroupInvoice.transactionId,
						paidAt: deliveryGroupInvoice.deliveredAt,
						createdAt: deliveryGroupInvoice.createdAt,
					})
					.from(deliveryGroupInvoice)
					.where(eq(deliveryGroupInvoice.invoiceId, invoiceData.id)),
				db
					.select({
						estimateNumber: estimate.estimateNumber,
						salesmanName: user.name,
					})
					.from(estimate)
					.leftJoin(user, eq(estimate.salesmanId, user.id))
					.where(eq(estimate.convertedOrderId, invoiceData.orderId))
					.limit(1),
				db
					.select({
						amount: warehouseDueCollection.amount,
						paymentMethod: warehouseDueCollection.paymentMethod,
						transactionRef: warehouseDueCollection.transactionRef,
						collectedAt: warehouseDueCollection.collectedAt,
					})
					.from(warehouseDueCollection)
					.where(eq(warehouseDueCollection.invoiceId, invoiceData.id)),
			]);

			const paymentHistory = payments
				.filter((payment) => toNumber(payment.amount) > 0)
				.map((payment) => ({
					date: payment.paidAt ?? payment.createdAt,
					method: formatMethod(payment.method),
					amount: toMoney(payment.amount),
					reference: payment.transactionId,
				}));

			// Merge due-collection records into payment history
			for (const collection of dueCollections) {
				if (toNumber(collection.amount) > 0) {
					paymentHistory.push({
						date: collection.collectedAt,
						method: formatMethod(collection.paymentMethod),
						amount: toMoney(collection.amount),
						reference: collection.transactionRef,
					});
				}
			}

			const total = toNumber(invoiceData.grandTotal);
			let paid = paymentHistory.reduce(
				(sumValue, payment) => sumValue + toNumber(payment.amount),
				0,
			);

			if (
				paid <= 0 &&
				["collected", "settled"].includes(invoiceData.paymentStatus)
			) {
				paid = total;
				paymentHistory.push({
					date:
						invoiceData.deliveredAt ??
						invoiceData.updatedAt ??
						invoiceData.createdAt,
					method: formatMethod(orderData.paymentMethod),
					amount: toMoney(total),
					reference: null,
				});
			}

			const due = Math.max(0, total - paid);
			const status = getSaleStatus(orderData.status, due);
			const estimateInfo = estimateData[0];

			return {
				kind: "invoice" as const,
				basic: {
					invoiceNumber: invoiceData.invoiceNumber,
					customerName:
						invoiceData.customer?.shopName ||
						invoiceData.customer?.name ||
						orderData.shippingName,
					phone: invoiceData.customer?.phoneNumber || orderData.shippingPhone,
					salesType: getOrderSourceLabel(orderData.orderSource),
					salesman: estimateInfo?.salesmanName ?? null,
					date: invoiceData.createdAt,
				},
				items: invoiceData.items.map((item) => ({
					product: item.productName,
					variant: item.productSku || "N/A",
					quantity: item.quantity.toLocaleString("en-BD"),
					price: toMoney(item.unitPrice),
					total: toMoney(item.lineTotal),
				})),
				payment: {
					subtotal: toMoney(invoiceData.subtotal),
					discount: toMoney(invoiceData.discountAmount),
					total: toMoney(invoiceData.grandTotal),
					paid: toMoney(paid),
					due: toMoney(due),
				},
				paymentHistory,
				source: {
					source: getOrderSourceLabel(orderData.orderSource),
					sourceId: orderData.orderNumber,
					orderId: orderData.orderNumber,
					estimateRef: estimateInfo?.estimateNumber ?? null,
				},
				status: status.label,
				statusKey: status.status,
			};
		}),

	collectDue: warehouseProcedure
		.route({
			method: "POST",
			path: "/warehouse/sales/collect-due",
			tags: ["Warehouse Sales"],
			summary: "Collect due payment for a sale",
		})
		.input(
			z.object({
				kind: z.enum(["pos", "invoice"]),
				id: z.number().int().positive(),
				amount: z.number().positive(),
				paymentMethod: z.enum(["cash", "bkash", "nagad", "bank"]),
				transactionRef: z.string().optional(),
				note: z.string().optional(),
			}),
		)
		.handler(async ({ context, input }) => {
			const warehouseId = context.session.user.id;

			if (input.kind === "pos") {
				const sale = await db.query.warehousePosSale.findFirst({
					where: and(
						eq(warehousePosSale.id, input.id),
						eq(warehousePosSale.warehouseId, warehouseId),
					),
				});

				if (!sale) {
					throw new ORPCError("NOT_FOUND", { message: "Sale not found" });
				}

				const currentDue = toNumber(sale.due);
				if (currentDue <= 0) {
					throw new ORPCError("BAD_REQUEST", {
						message: "This sale has no outstanding due",
					});
				}

				if (input.amount > currentDue) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Amount exceeds outstanding due of ${toMoney(currentDue)}`,
					});
				}

				const newPaid = toNumber(sale.paid) + input.amount;
				const newDue = Math.max(0, currentDue - input.amount);

				await db.transaction(async (tx) => {
					await tx.insert(warehousePosPayment).values({
						saleId: sale.id,
						paymentMethod: input.paymentMethod,
						amount: toMoney(input.amount),
						transactionRef: input.transactionRef || null,
						note: input.note || null,
						createdById: warehouseId,
					});

					await tx
						.update(warehousePosSale)
						.set({
							paid: toMoney(newPaid),
							due: toMoney(newDue),
						})
						.where(eq(warehousePosSale.id, sale.id));
				});

				return {
					success: true,
					paid: toMoney(newPaid),
					due: toMoney(newDue),
				};
			}

			// Invoice-based due collection
			const invoiceData = await db.query.invoice.findFirst({
				where: eq(invoice.id, input.id),
				with: {
					order: true,
				},
			});

			if (
				!invoiceData ||
				!invoiceData.order ||
				invoiceData.order.warehouseId !== warehouseId
			) {
				throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
			}

			// Calculate current paid/due from existing payments
			const existingPayments = await db
				.select({
					amount: deliveryGroupInvoice.amountCollected,
				})
				.from(deliveryGroupInvoice)
				.where(eq(deliveryGroupInvoice.invoiceId, invoiceData.id));

			const existingDueCollections = await db
				.select({
					amount: warehouseDueCollection.amount,
				})
				.from(warehouseDueCollection)
				.where(eq(warehouseDueCollection.invoiceId, invoiceData.id));

			const total = toNumber(invoiceData.grandTotal);
			let paid = existingPayments.reduce(
				(sum, p) => sum + toNumber(p.amount),
				0,
			);
			paid += existingDueCollections.reduce(
				(sum, p) => sum + toNumber(p.amount),
				0,
			);

			if (
				paid <= 0 &&
				["collected", "settled"].includes(invoiceData.paymentStatus)
			) {
				paid = total;
			}

			const currentDue = Math.max(0, total - paid);

			if (currentDue <= 0) {
				throw new ORPCError("BAD_REQUEST", {
					message: "This invoice has no outstanding due",
				});
			}

			if (input.amount > currentDue) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Amount exceeds outstanding due of ${toMoney(currentDue)}`,
				});
			}

			const newPaid = paid + input.amount;
			const newDue = Math.max(0, currentDue - input.amount);

			await db.transaction(async (tx) => {
				await tx.insert(warehouseDueCollection).values({
					warehouseId,
					invoiceId: invoiceData.id,
					paymentMethod: input.paymentMethod,
					amount: toMoney(input.amount),
					transactionRef: input.transactionRef || null,
					note: input.note || null,
					collectedById: warehouseId,
				});

				// If fully paid, update invoice payment status
				if (newDue <= 0) {
					await tx
						.update(invoice)
						.set({ paymentStatus: "collected" })
						.where(eq(invoice.id, invoiceData.id));
				}
			});

			return {
				success: true,
				paid: toMoney(newPaid),
				due: toMoney(newDue),
			};
		}),
};
