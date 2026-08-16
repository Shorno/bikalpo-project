import { db } from "@bikalpo-project/db";
import {
	invoice,
	invoiceItem,
	order,
	user,
	type orderItem,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { markOrderItemCartonsDispatched } from "./b2b-inventory-movement";
import {
	fulfillmentInvoiceOwnerCondition,
	persistedInvoiceFulfillmentMode,
	type FulfillmentOwner,
} from "./fulfillment-owner";

export type DispatchFulfillmentMode = "self_pickup" | "delivery";
export type DispatchQueueStatus =
	| "ready_for_dispatch"
	| "partially_invoiced"
	| "invoiced";
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type InvoiceProgressItem = {
	orderItemId: number;
	productId: number;
	variantId: number | null;
	productName: string;
	productSku: string;
	productImage: string;
	approvedQty: number;
	invoicedQty: number;
	remainingQty: number;
	unitPrice: string;
	lineTotal: string;
	quantityUnit: string | null;
	inventoryUnit: string | null;
	conversionFactor: string | null;
	inventoryQty: string | null;
};

function money(value: number) {
	return (Math.round(Math.max(0, value) * 100) / 100).toFixed(2);
}

export function buildInvoiceProgress(
	items: Array<typeof orderItem.$inferSelect>,
	invoices: Array<{
		items: Array<typeof invoiceItem.$inferSelect>;
	}>,
): InvoiceProgressItem[] {
	const invoicedByItemId = new Map<number, number>();

	for (const invoiceRow of invoices) {
		for (const invoiceLine of invoiceRow.items) {
			const exactItem = invoiceLine.orderItemId
				? items.find((item) => item.id === invoiceLine.orderItemId)
				: null;
			const variantMatches = invoiceLine.variantId
				? items.filter((item) => item.variantId === invoiceLine.variantId)
				: [];
			const matchedItem =
				exactItem ?? (variantMatches.length === 1 ? variantMatches[0] : null);
			if (!matchedItem) {
				throw new Error(
					`Invoice item ${invoiceLine.id} cannot be matched to one exact order variant`,
				);
			}
			invoicedByItemId.set(
				matchedItem.id,
				(invoicedByItemId.get(matchedItem.id) ?? 0) + invoiceLine.quantity,
			);
		}
	}

	return items.map((item) => {
		const approvedQty = item.modifiedQty ?? item.quantity;
		const invoicedQty = invoicedByItemId.get(item.id) ?? 0;
		const remainingQty = Math.max(0, approvedQty - invoicedQty);
		const unitPrice = item.modifiedUnitPrice ?? item.unitPrice;

		return {
			orderItemId: item.id,
			productId: item.productId,
			variantId: item.variantId,
			productName: item.productName,
			productSku: item.productSize,
			productImage: item.productImage,
			approvedQty,
			invoicedQty,
			remainingQty,
			unitPrice,
			lineTotal: money(approvedQty * Number(unitPrice)),
			quantityUnit: item.quantityUnit,
			inventoryUnit: item.inventoryUnit,
			conversionFactor: item.conversionFactor,
			inventoryQty: item.inventoryQty,
		};
	});
}

export function summarizeInvoiceProgress(items: InvoiceProgressItem[]) {
	return items.reduce(
		(summary, item) => {
			const unitPrice = Number(item.unitPrice);
			summary.approvedQty += item.approvedQty;
			summary.invoicedQty += item.invoicedQty;
			summary.remainingQty += item.remainingQty;
			summary.approvedTotal += item.approvedQty * unitPrice;
			summary.invoicedTotal += item.invoicedQty * unitPrice;
			summary.remainingTotal += item.remainingQty * unitPrice;
			return summary;
		},
		{
			approvedQty: 0,
			invoicedQty: 0,
			remainingQty: 0,
			approvedTotal: 0,
			invoicedTotal: 0,
			remainingTotal: 0,
		},
	);
}

export function deriveDispatchQueueStatus(
	progress: ReturnType<typeof summarizeInvoiceProgress>,
	invoiceCount: number,
): DispatchQueueStatus {
	if (invoiceCount > 0 && progress.remainingQty === 0) return "invoiced";
	if (progress.invoicedQty > 0) return "partially_invoiced";
	return "ready_for_dispatch";
}

export function calculateDispatchInvoiceCharges(input: {
	subtotal: number;
	approvedSubtotal: number;
	approvedDiscount: number;
	allocatedDiscount: number;
	shippingCost: number;
	hasExistingInvoices: boolean;
	fullyInvoiced: boolean;
	fulfillmentMode?: DispatchFulfillmentMode;
}) {
	const remainingDiscount = Math.max(
		0,
		input.approvedDiscount - input.allocatedDiscount,
	);
	const discountAmount = input.fullyInvoiced
		? remainingDiscount
		: Math.min(
				remainingDiscount,
				input.approvedSubtotal > 0
					? Math.round(
							input.approvedDiscount *
								(input.subtotal / input.approvedSubtotal) *
								100,
						) / 100
					: 0,
			);
	const deliveryCharge =
		input.fulfillmentMode === "self_pickup"
			? 0
			: input.hasExistingInvoices
				? 0
				: input.shippingCost;
	return {
		discountAmount,
		deliveryCharge,
		grandTotal: input.subtotal - discountAmount + deliveryCharge,
	};
}

export function calculateDispatchInvoiceSnapshot(input: {
	subtotal: number;
	approvedSubtotal: number;
	fullyInvoiced: boolean;
	hasExistingInvoices: boolean;
	fulfillmentMode?: DispatchFulfillmentMode;
	orderTotals: {
		discount: number;
		productDiscount: number;
		couponDiscount: number;
		rewardDiscount: number;
		taxAmount: number;
		deliveryFee: number;
		shippingFee: number;
		paidAmount: number;
		returnAmount: number;
	};
	allocated: {
		discount: number;
		productDiscount: number;
		couponDiscount: number;
		rewardDiscount: number;
		taxAmount: number;
		paidAmount: number;
		returnAmount: number;
	};
}) {
	const allocateProportionally = (total: number, allocated: number) => {
		const remaining = Math.max(0, total - allocated);
		if (input.fullyInvoiced) return remaining;
		if (input.approvedSubtotal <= 0) return 0;
		return Math.min(
			remaining,
			Math.round((total * input.subtotal * 100) / input.approvedSubtotal) /
				100,
		);
	};
	const discountAmount = allocateProportionally(
		input.orderTotals.discount,
		input.allocated.discount,
	);
	const productDiscount = allocateProportionally(
		input.orderTotals.productDiscount,
		input.allocated.productDiscount,
	);
	const couponDiscount = allocateProportionally(
		input.orderTotals.couponDiscount,
		input.allocated.couponDiscount,
	);
	const rewardDiscount = allocateProportionally(
		input.orderTotals.rewardDiscount,
		input.allocated.rewardDiscount,
	);
	const taxAmount = allocateProportionally(
		input.orderTotals.taxAmount,
		input.allocated.taxAmount,
	);
	const deliveryCharge =
		input.fulfillmentMode === "self_pickup" || input.hasExistingInvoices
			? 0
			: input.orderTotals.deliveryFee;
	const shippingCharge =
		input.fulfillmentMode === "self_pickup" || input.hasExistingInvoices
			? 0
			: input.orderTotals.shippingFee;
	const grandTotal = Math.max(
		0,
		input.subtotal -
			discountAmount +
			taxAmount +
			deliveryCharge +
			shippingCharge,
	);
	const paidAmount = Math.min(
		grandTotal,
		Math.max(0, input.orderTotals.paidAmount - input.allocated.paidAmount),
	);
	const returnAmount = Math.min(
		Math.max(0, grandTotal - paidAmount),
		Math.max(0, input.orderTotals.returnAmount - input.allocated.returnAmount),
	);

	return {
		discountAmount,
		productDiscount,
		couponDiscount,
		rewardDiscount,
		taxAmount,
		deliveryCharge,
		shippingCharge,
		grandTotal,
		paidAmount,
		returnAmount,
		dueAmount: Math.max(0, grandTotal - paidAmount - returnAmount),
	};
}

async function generateInvoiceNumber(tx: DbTransaction) {
	await tx.execute(sql`SELECT pg_advisory_xact_lock(872401)`);
	const year = new Date().getFullYear();
	const prefix = `INV-${year}-`;
	const latestInvoice = await tx.query.invoice.findFirst({
		where: sql`${invoice.invoiceNumber} LIKE ${`${prefix}%`}`,
		orderBy: [desc(invoice.invoiceNumber)],
	});
	const latestSequence = latestInvoice
		? Number.parseInt(latestInvoice.invoiceNumber.split("-")[2] ?? "0", 10)
		: 0;
	return `${prefix}${(latestSequence + 1).toString().padStart(4, "0")}`;
}

export async function applyFulfillmentMode(
	tx: DbTransaction,
	input: {
		invoiceId: number;
		orderId: number;
		orderReadyAt: Date | null;
		fulfillmentMode: DispatchFulfillmentMode;
		persistedMode?: "delivery" | "internal_delivery" | "self_pickup";
		existingFulfillmentMode?: string | null;
		existingCompletionOtp?: string | null;
		deliveryStatus?: string | null;
	},
) {
	if (input.deliveryStatus === "delivered") {
		throw new ORPCError("BAD_REQUEST", {
			message: "This invoice has already been completed",
		});
	}
	if (
		input.existingFulfillmentMode &&
		input.existingFulfillmentMode !==
			(input.persistedMode ?? input.fulfillmentMode)
	) {
		throw new ORPCError("BAD_REQUEST", {
			message: "Fulfillment mode has already been selected",
		});
	}

	const persistedMode = input.persistedMode ?? input.fulfillmentMode;
	const completionOtp =
		input.fulfillmentMode === "self_pickup"
			? input.existingFulfillmentMode === persistedMode &&
				input.existingCompletionOtp
				? input.existingCompletionOtp
				: Math.floor(1000 + Math.random() * 9000).toString()
			: null;

	await tx
		.update(invoice)
		.set({
			fulfillmentMode: persistedMode,
			completionOtp,
			completionOtpGeneratedAt:
				input.fulfillmentMode === "self_pickup" ? new Date() : null,
			completionOtpVerifiedAt: null,
			deliveryStatus:
				input.fulfillmentMode === "self_pickup" ? "pending" : "not_assigned",
			deliverymanId: null,
			vehicleType: null,
			expectedDeliveryAt: null,
		})
		.where(eq(invoice.id, input.invoiceId));

	if (!input.orderReadyAt) {
		await tx
			.update(order)
			.set({ readyAt: new Date() })
			.where(eq(order.id, input.orderId));
	}

	return { completionOtp };
}

export async function createDispatchInvoiceForOrder(input: {
	userId: string;
	orderId: number;
	items?: Array<{ orderItemId: number; quantity: number }>;
	fulfillmentMode?: DispatchFulfillmentMode;
}) {
	return db.transaction(async (tx) => {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.orderId})`);

		const existingOrder = await tx.query.order.findFirst({
			where: and(
				eq(order.id, input.orderId),
				eq(order.warehouseId, input.userId),
				eq(order.orderType, "b2b"),
			),
			with: { items: true },
		});
		if (!existingOrder) {
			throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		}
		if (
			![
				"approved",
				"confirmed",
				"ready_for_dispatch",
				"partially_invoiced",
			].includes(existingOrder.status)
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only dispatch-ready orders can be invoiced",
			});
		}
		if (
			existingOrder.modifiedByWarehouseAt &&
			!existingOrder.modificationAcceptedAt
		) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Buyer must accept the modified quantities before invoicing",
			});
		}

		const existingInvoices = await tx.query.invoice.findMany({
			where: eq(invoice.orderId, input.orderId),
			with: { items: true },
			orderBy: [desc(invoice.createdAt)],
		});
		const progressItems = buildInvoiceProgress(
			existingOrder.items,
			existingInvoices,
		);
		const progressByItemId = new Map(
			progressItems.map((item) => [item.orderItemId, item]),
		);
		const requestedItems =
			input.items && input.items.length > 0
				? input.items
				: progressItems
						.filter((item) => item.remainingQty > 0)
						.map((item) => ({
							orderItemId: item.orderItemId,
							quantity: item.remainingQty,
						}));
		const normalizedItems = Array.from(
			requestedItems
				.reduce((byItemId, item) => {
					byItemId.set(
						item.orderItemId,
						(byItemId.get(item.orderItemId) ?? 0) + item.quantity,
					);
					return byItemId;
				}, new Map<number, number>())
				.entries(),
		).map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

		const invoiceLines = normalizedItems.map((requestedItem) => {
			const progressItem = progressByItemId.get(requestedItem.orderItemId);
			if (!progressItem) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Order item ${requestedItem.orderItemId} was not found`,
				});
			}
			if (
				!Number.isInteger(requestedItem.quantity) ||
				requestedItem.quantity < 1
			) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Invoice quantity must be a positive whole number",
				});
			}
			if (requestedItem.quantity > progressItem.remainingQty) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Requested quantity exceeds remaining quantity for ${progressItem.productName}`,
				});
			}
			return {
				...progressItem,
				quantity: requestedItem.quantity,
				selectedInventoryQty:
					progressItem.inventoryQty && progressItem.approvedQty > 0
						? (Number(progressItem.inventoryQty) * requestedItem.quantity) /
							progressItem.approvedQty
						: null,
				selectedTotal: requestedItem.quantity * Number(progressItem.unitPrice),
			};
		});
		if (invoiceLines.length === 0) {
			throw new ORPCError("BAD_REQUEST", {
				message: "There are no remaining quantities to invoice",
			});
		}

		const selectedByItemId = new Map(
			invoiceLines.map((item) => [item.orderItemId, item.quantity]),
		);
		const fullyInvoiced = progressItems.every(
			(item) =>
				item.remainingQty - (selectedByItemId.get(item.orderItemId) ?? 0) <= 0,
		);
		const subtotal = invoiceLines.reduce(
			(total, item) => total + item.selectedTotal,
			0,
		);
		const approvedSubtotal = Number(existingOrder.subtotal);
		const deliveryFee = Number(existingOrder.deliveryFee);
		let shippingFee = Number(existingOrder.shippingFee);
		if (deliveryFee === 0 && shippingFee === 0) {
			shippingFee = Number(existingOrder.shippingCost);
		}
		const invoiceSnapshot = calculateDispatchInvoiceSnapshot({
			subtotal,
			approvedSubtotal,
			fullyInvoiced,
			hasExistingInvoices: existingInvoices.length > 0,
			fulfillmentMode: input.fulfillmentMode,
			orderTotals: {
				discount: Number(existingOrder.discount),
				productDiscount: Number(existingOrder.productDiscount),
				couponDiscount: Number(existingOrder.couponDiscount),
				rewardDiscount: Number(existingOrder.rewardDiscount),
				taxAmount: Number(existingOrder.taxAmount),
				deliveryFee,
				shippingFee,
				paidAmount: Number(existingOrder.paidAmount),
				returnAmount: Number(existingOrder.returnAmount),
			},
			allocated: existingInvoices.reduce(
				(totals, row) => ({
					discount: totals.discount + Number(row.discountAmount),
					productDiscount:
						totals.productDiscount + Number(row.productDiscount),
					couponDiscount: totals.couponDiscount + Number(row.couponDiscount),
					rewardDiscount: totals.rewardDiscount + Number(row.rewardDiscount),
					taxAmount: totals.taxAmount + Number(row.taxAmount),
					paidAmount: totals.paidAmount + Number(row.paidAmount),
					returnAmount: totals.returnAmount + Number(row.returnAmount),
				}),
				{
					discount: 0,
					productDiscount: 0,
					couponDiscount: 0,
					rewardDiscount: 0,
					taxAmount: 0,
					paidAmount: 0,
					returnAmount: 0,
				},
			),
		});
		const mainInvoice = existingInvoices.find(
			(row) => row.invoiceType === "main",
		);
		const invoiceType = existingInvoices.length === 0 ? "main" : "split";
		const splitSequence =
			invoiceType === "split"
				? existingInvoices.filter((row) => row.invoiceType === "split").length +
					1
				: null;
		const invoiceNumber = await generateInvoiceNumber(tx);

		const [createdInvoice] = await tx
			.insert(invoice)
			.values({
				invoiceNumber,
				orderId: existingOrder.id,
				customerId: existingOrder.userId,
				parentInvoiceId:
					invoiceType === "split" ? (mainInvoice?.id ?? null) : null,
				splitSequence,
				invoiceType,
				paymentStatus:
					invoiceSnapshot.dueAmount <= 0 ? "collected" : "unpaid",
				deliveryStatus: "not_assigned",
				subtotal: money(subtotal),
				discountAmount: money(invoiceSnapshot.discountAmount),
				productDiscount: money(invoiceSnapshot.productDiscount),
				couponDiscount: money(invoiceSnapshot.couponDiscount),
				rewardDiscount: money(invoiceSnapshot.rewardDiscount),
				deliveryCharge: money(invoiceSnapshot.deliveryCharge),
				shippingCharge: money(invoiceSnapshot.shippingCharge),
				taxAmount: money(invoiceSnapshot.taxAmount),
				grandTotal: money(invoiceSnapshot.grandTotal),
				paidAmount: money(invoiceSnapshot.paidAmount),
				dueAmount: money(invoiceSnapshot.dueAmount),
				returnAmount: money(invoiceSnapshot.returnAmount),
				promotionCode: existingOrder.promotionCode,
				paymentPlan: existingOrder.paymentPlan,
				paymentDueAt: existingOrder.paymentDueAt,
				billedName: existingOrder.invoiceName ?? existingOrder.shippingName,
				billedPhone: existingOrder.invoicePhone ?? existingOrder.shippingPhone,
				billedEmail: existingOrder.invoiceEmail ?? existingOrder.shippingEmail,
				customerNotes: existingOrder.customerNote,
				adminNotes: existingOrder.adminNote,
			})
			.returning();
		if (!createdInvoice) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create invoice",
			});
		}

		await tx.insert(invoiceItem).values(
			invoiceLines.map((item) => ({
				invoiceId: createdInvoice.id,
				orderItemId: item.orderItemId,
				productId: item.productId,
				variantId: item.variantId,
				productName: item.productName,
				productSku: item.productSku,
				productImage: item.productImage,
				quantity: item.quantity,
				quantityUnit: item.quantityUnit,
				inventoryUnit: item.inventoryUnit,
				conversionFactor: item.conversionFactor,
				inventoryQty:
					item.selectedInventoryQty === null
						? null
						: item.selectedInventoryQty.toFixed(2),
				unitPrice: item.unitPrice,
				lineTotal: money(item.selectedTotal),
			})),
		);

		await markOrderItemCartonsDispatched(
			tx,
			invoiceLines.map((item) => ({
				orderItemId: item.orderItemId,
				quantity: item.quantity,
			})),
		);

		const nextStatus = fullyInvoiced ? "invoiced" : "partially_invoiced";
		await tx
			.update(order)
			.set({
				status: nextStatus,
				readyAt: existingOrder.readyAt ?? new Date(),
			})
			.where(eq(order.id, existingOrder.id));

		let completionOtp: string | null = null;
		if (input.fulfillmentMode) {
			const fulfillment = await applyFulfillmentMode(tx, {
				invoiceId: createdInvoice.id,
				orderId: existingOrder.id,
				orderReadyAt: existingOrder.readyAt,
				fulfillmentMode: input.fulfillmentMode,
			});
			completionOtp = fulfillment.completionOtp;
		}

		return {
			invoice: createdInvoice,
			status: nextStatus,
			fullyInvoiced,
			completionOtp,
		};
	});
}

export async function configureExistingInvoiceFulfillment(input: {
	userId: string;
	invoiceId: number;
	fulfillmentMode: DispatchFulfillmentMode;
}) {
	return configureExistingInvoiceFulfillmentForOwner({
		owner: { kind: "warehouse", id: input.userId },
		invoiceId: input.invoiceId,
		fulfillmentMode: input.fulfillmentMode,
	});
}

export async function configureExistingInvoiceFulfillmentForOwner(input: {
	owner: FulfillmentOwner;
	invoiceId: number;
	fulfillmentMode: DispatchFulfillmentMode;
}) {
	return db.transaction(async (tx) => {
		const existingInvoice = await tx.query.invoice.findFirst({
			where: and(
				eq(invoice.id, input.invoiceId),
				fulfillmentInvoiceOwnerCondition(input.owner),
			),
			with: {
				order: {
					columns: {
						id: true,
						readyAt: true,
						subtotal: true,
						discount: true,
						shippingCost: true,
						total: true,
					},
				},
			},
		});
		if (!existingInvoice?.order) {
			throw new ORPCError("NOT_FOUND", { message: "Invoice not found" });
		}
		const persistedMode = persistedInvoiceFulfillmentMode(
			input.owner,
			input.fulfillmentMode,
		);
		if (existingInvoice.fulfillmentMode) {
			if (existingInvoice.fulfillmentMode !== persistedMode) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Fulfillment mode has already been selected",
				});
			}
			if (existingInvoice.deliveryStatus === "delivered") {
				throw new ORPCError("BAD_REQUEST", {
					message: "This invoice has already been completed",
				});
			}
			return {
				invoice: existingInvoice,
				completionOtp:
					existingInvoice.fulfillmentMode === "self_pickup"
						? existingInvoice.completionOtp
						: null,
			};
		}
		if (input.owner.kind === "shop" && input.fulfillmentMode === "self_pickup") {
			const shop = await tx.query.user.findFirst({
				where: eq(user.id, input.owner.id),
				columns: { shopAddress: true },
			});
			if (!shop?.shopAddress?.trim()) {
				throw new ORPCError("BAD_REQUEST", {
					message:
						"Add a shop address before offering self pickup to consumers",
				});
			}
		}

		const fulfillment = await applyFulfillmentMode(tx, {
			invoiceId: existingInvoice.id,
			orderId: existingInvoice.order.id,
			orderReadyAt: existingInvoice.order.readyAt,
			fulfillmentMode: input.fulfillmentMode,
			persistedMode,
			existingFulfillmentMode: existingInvoice.fulfillmentMode,
			existingCompletionOtp: existingInvoice.completionOtp,
			deliveryStatus: existingInvoice.deliveryStatus,
		});

		if (input.owner.kind === "shop" && input.fulfillmentMode === "self_pickup") {
			await tx
				.update(order)
				.set({
					shippingCost: "0.00",
					total: (
						Math.round(
							(Math.max(
								0,
								Number(existingInvoice.order.subtotal) -
									Number(existingInvoice.order.discount),
							) +
								Number.EPSILON) *
								100,
						) / 100
					).toFixed(2),
				})
				.where(eq(order.id, existingInvoice.order.id));
		}

		return { invoice: existingInvoice, ...fulfillment };
	});
}
