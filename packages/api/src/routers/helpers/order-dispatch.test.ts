import assert from "node:assert/strict";
import test from "node:test";
import type { invoiceItem, orderItem } from "@bikalpo-project/db/schema";
import {
	buildInvoiceProgress,
	calculateDispatchInvoiceCharges,
	calculateDispatchInvoiceSnapshot,
	deriveDispatchQueueStatus,
	summarizeInvoiceProgress,
} from "./order-dispatch";

function item(input: {
	id: number;
	variantId: number;
	quantity: number;
	modifiedQty?: number | null;
	unitPrice?: string;
}): typeof orderItem.$inferSelect {
	return {
		id: input.id,
		orderId: 1,
		productId: 1,
		variantId: input.variantId,
		productName: `Product ${input.id}`,
		productImage: "image.png",
		productSize: `SKU-${input.variantId}`,
		quantity: input.quantity,
		unitPrice: input.unitPrice ?? "100.00",
		totalPrice: "100.00",
		cylinderSaleMode: "new",
		newUnitPrice: null,
		exchangeCreditAmount: "0.00",
		expectedEmptyPackQty: 0,
		collectedEmptyPackQty: 0,
		convertedToNewQty: 0,
		modifiedQty: input.modifiedQty ?? null,
		modifiedUnitPrice: null,
		deliveredQty: 0,
		receivedQty: null,
		supplyMode: "unit",
		targetVariantId: null,
		conversionStatus: "pending",
		convertedQty: null,
		quantityUnit: "unit",
		inventoryUnit: "unit",
		conversionFactor: "1.0000",
		inventoryQty: input.quantity.toFixed(2),
		catalogVariantId: null,
		globalSkuSnapshot: null,
		sourceSkuSnapshot: null,
		targetSkuSnapshot: null,
		createdAt: new Date(),
	};
}

function invoiceLine(input: {
	id: number;
	orderItemId: number | null;
	variantId: number | null;
	quantity: number;
}): typeof invoiceItem.$inferSelect {
	return {
		id: input.id,
		invoiceId: 1,
		orderItemId: input.orderItemId,
		productId: 1,
		variantId: input.variantId,
		productName: "Product",
		productSku: null,
		productImage: null,
		quantity: input.quantity,
		quantityUnit: "unit",
		inventoryUnit: "unit",
		conversionFactor: "1.0000",
		inventoryQty: input.quantity.toFixed(2),
		unitPrice: "100.00",
		lineTotal: (input.quantity * 100).toFixed(2),
		createdAt: new Date(),
	};
}

test("invoice progress uses the exact order item across same-product variants", () => {
	const progress = buildInvoiceProgress(
		[
			item({ id: 1, variantId: 9, quantity: 2 }),
			item({ id: 2, variantId: 10, quantity: 3 }),
		],
		[
			{
				items: [
					invoiceLine({
						id: 1,
						orderItemId: 2,
						variantId: 10,
						quantity: 1,
					}),
				],
			},
		],
	);

	assert.equal(progress[0]?.invoicedQty, 0);
	assert.equal(progress[1]?.invoicedQty, 1);
	assert.equal(progress[1]?.remainingQty, 2);
	assert.deepEqual(summarizeInvoiceProgress(progress), {
		approvedQty: 5,
		invoicedQty: 1,
		remainingQty: 4,
		approvedTotal: 500,
		invoicedTotal: 100,
		remainingTotal: 400,
	});
});

test("legacy invoice fallback rejects an ambiguous repeated variant", () => {
	assert.throws(
		() =>
			buildInvoiceProgress(
				[
					item({ id: 1, variantId: 9, quantity: 1 }),
					item({ id: 2, variantId: 9, quantity: 1 }),
				],
				[
					{
						items: [
							invoiceLine({
								id: 1,
								orderItemId: null,
								variantId: 9,
								quantity: 1,
							}),
						],
					},
				],
			),
		/cannot be matched to one exact order variant/,
	);
});

test("partial invoices allocate discount proportionally and shipping once", () => {
	const first = calculateDispatchInvoiceCharges({
		subtotal: 400,
		approvedSubtotal: 1000,
		approvedDiscount: 100,
		allocatedDiscount: 0,
		shippingCost: 50,
		hasExistingInvoices: false,
		fullyInvoiced: false,
	});
	const final = calculateDispatchInvoiceCharges({
		subtotal: 600,
		approvedSubtotal: 1000,
		approvedDiscount: 100,
		allocatedDiscount: first.discountAmount,
		shippingCost: 50,
		hasExistingInvoices: true,
		fullyInvoiced: true,
	});

	assert.deepEqual(first, {
		discountAmount: 40,
		deliveryCharge: 50,
		grandTotal: 410,
	});
	assert.deepEqual(final, {
		discountAmount: 60,
		deliveryCharge: 0,
		grandTotal: 540,
	});
	assert.equal(first.grandTotal + final.grandTotal, 950);
});

test("self pickup never carries a delivery charge", () => {
	const result = calculateDispatchInvoiceCharges({
		subtotal: 1000,
		approvedSubtotal: 1000,
		approvedDiscount: 100,
		allocatedDiscount: 0,
		shippingCost: 80,
		hasExistingInvoices: false,
		fullyInvoiced: true,
		fulfillmentMode: "self_pickup",
	});

	assert.deepEqual(result, {
		discountAmount: 100,
		deliveryCharge: 0,
		grandTotal: 900,
	});
});

test("full invoice snapshots reconcile checkout totals and outstanding due", () => {
	const snapshot = calculateDispatchInvoiceSnapshot({
		subtotal: 1_000,
		approvedSubtotal: 1_000,
		fullyInvoiced: true,
		hasExistingInvoices: false,
		fulfillmentMode: "delivery",
		orderTotals: {
			discount: 100,
			productDiscount: 60,
			couponDiscount: 40,
			rewardDiscount: 0,
			taxAmount: 45,
			deliveryFee: 20,
			shippingFee: 10,
			paidAmount: 500,
			returnAmount: 0,
		},
		allocated: {
			discount: 0,
			productDiscount: 0,
			couponDiscount: 0,
			rewardDiscount: 0,
			taxAmount: 0,
			paidAmount: 0,
			returnAmount: 0,
		},
	});

	assert.deepEqual(snapshot, {
		discountAmount: 100,
		productDiscount: 60,
		couponDiscount: 40,
		rewardDiscount: 0,
		taxAmount: 45,
		deliveryCharge: 20,
		shippingCharge: 10,
		grandTotal: 975,
		paidAmount: 500,
		returnAmount: 0,
		dueAmount: 475,
	});
});

test("split invoices allocate checkout values without double counting", () => {
	const orderTotals = {
		discount: 100,
		productDiscount: 60,
		couponDiscount: 40,
		rewardDiscount: 0,
		taxAmount: 45,
		deliveryFee: 20,
		shippingFee: 10,
		paidAmount: 500,
		returnAmount: 0,
	};
	const emptyAllocation = {
		discount: 0,
		productDiscount: 0,
		couponDiscount: 0,
		rewardDiscount: 0,
		taxAmount: 0,
		paidAmount: 0,
		returnAmount: 0,
	};
	const first = calculateDispatchInvoiceSnapshot({
		subtotal: 400,
		approvedSubtotal: 1_000,
		fullyInvoiced: false,
		hasExistingInvoices: false,
		fulfillmentMode: "delivery",
		orderTotals,
		allocated: emptyAllocation,
	});
	const final = calculateDispatchInvoiceSnapshot({
		subtotal: 600,
		approvedSubtotal: 1_000,
		fullyInvoiced: true,
		hasExistingInvoices: true,
		fulfillmentMode: "delivery",
		orderTotals,
		allocated: {
			discount: first.discountAmount,
			productDiscount: first.productDiscount,
			couponDiscount: first.couponDiscount,
			rewardDiscount: first.rewardDiscount,
			taxAmount: first.taxAmount,
			paidAmount: first.paidAmount,
			returnAmount: first.returnAmount,
		},
	});

	assert.equal(first.grandTotal, 408);
	assert.equal(final.grandTotal, 567);
	assert.equal(first.grandTotal + final.grandTotal, 975);
	assert.equal(first.paidAmount + final.paidAmount, 500);
	assert.equal(first.dueAmount + final.dueAmount, 475);
	assert.equal(first.deliveryCharge + final.deliveryCharge, 20);
	assert.equal(first.shippingCharge + final.shippingCharge, 10);
});

test("legacy confirmed orders without invoices normalize to ready for dispatch", () => {
	const progress = summarizeInvoiceProgress(
		buildInvoiceProgress([item({ id: 1, variantId: 9, quantity: 1 })], []),
	);
	assert.equal(deriveDispatchQueueStatus(progress, 0), "ready_for_dispatch");
});
