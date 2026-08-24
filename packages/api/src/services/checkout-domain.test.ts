import assert from "node:assert/strict";
import test from "node:test";

import {
	assertCheckoutPaymentPlanAllowed,
	assertCheckoutPaymentSelectionAllowed,
	calculateCheckoutTotals,
	calculatePromotionDiscount,
	deriveCheckoutPaymentStatus,
	resolveInitialPayment,
} from "./checkout-domain";

test("checkout totals reconcile the client invoice example", () => {
	const totals = calculateCheckoutTotals({
		itemsTotal: 2_084,
		deliveryFee: 195,
		shippingFee: 5,
	});

	assert.equal(totals.grandTotal, 2_284);
	assert.equal(totals.paidAmount, 0);
	assert.equal(totals.dueAmount, 2_284);
	assert.equal(totals.paymentStatus, "pending");
});

test("discounts apply before tax and delivery charges", () => {
	const totals = calculateCheckoutTotals({
		itemsTotal: 1_000,
		productDiscount: 50,
		couponDiscount: 100,
		rewardDiscount: 25,
		taxAmount: 41.25,
		deliveryFee: 60,
		shippingFee: 5,
		paidAmount: 931.25,
	});

	assert.deepEqual(
		{
			totalDiscount: totals.totalDiscount,
			taxableAmount: totals.taxableAmount,
			grandTotal: totals.grandTotal,
			dueAmount: totals.dueAmount,
			status: totals.paymentStatus,
		},
		{
			totalDiscount: 175,
			taxableAmount: 825,
			grandTotal: 931.25,
			dueAmount: 0,
			status: "paid",
		},
	);
});

test("returns reduce the net payable without corrupting the grand total", () => {
	const totals = calculateCheckoutTotals({
		itemsTotal: 1_000,
		returnAmount: 200,
		paidAmount: 500,
	});

	assert.equal(totals.grandTotal, 1_000);
	assert.equal(totals.netPayable, 800);
	assert.equal(totals.dueAmount, 300);
	assert.equal(totals.paymentStatus, "partial");
});

test("promotion discounts honor minimum orders and percentage caps", () => {
	assert.equal(
		calculatePromotionDiscount(1_000, {
			type: "percentage",
			value: 20,
			maximumDiscount: 125,
			minimumSubtotal: 500,
		}),
		125,
	);
	assert.equal(
		calculatePromotionDiscount(400, {
			type: "fixed",
			value: 100,
			minimumSubtotal: 500,
		}),
		0,
	);
});

test("payment plans resolve full, partial, and later settlement", () => {
	assert.equal(
		resolveInitialPayment({ grandTotal: 2_284, paymentPlan: "pay_now" }),
		2_284,
	);
	assert.equal(
		resolveInitialPayment({
			grandTotal: 2_284,
			paymentPlan: "partial",
			partialAmount: 1_142,
		}),
		1_142,
	);
	assert.equal(
		resolveInitialPayment({ grandTotal: 2_284, paymentPlan: "pay_later" }),
		0,
	);
});

test("payment method selection supports COD, online, bank, and true unpaid cases", () => {
	assert.doesNotThrow(() =>
		assertCheckoutPaymentSelectionAllowed({
			paymentMethod: "cash_on_delivery",
			paymentPlan: "pay_later",
		}),
	);
	assert.doesNotThrow(() =>
		assertCheckoutPaymentSelectionAllowed({
			paymentMethod: null,
			paymentPlan: "pay_later",
		}),
	);
	assert.doesNotThrow(() =>
		assertCheckoutPaymentSelectionAllowed({
			paymentMethod: "bkash",
			paymentPlan: "pay_now",
		}),
	);
	assert.doesNotThrow(() =>
		assertCheckoutPaymentSelectionAllowed({
			paymentMethod: "bank_transfer",
			paymentPlan: "pay_now",
		}),
	);
	assert.throws(
		() =>
			assertCheckoutPaymentSelectionAllowed({
				paymentMethod: null,
				paymentPlan: "pay_now",
			}),
		/must remain unpaid/i,
	);
	assert.throws(
		() =>
			assertCheckoutPaymentSelectionAllowed({
				paymentMethod: "cash_on_delivery",
				paymentPlan: "pay_now",
			}),
		/only be used with pay later/i,
	);
});

test("invalid discounts, refunds, and deposits are rejected", () => {
	assert.throws(
		() =>
			calculateCheckoutTotals({
				itemsTotal: 100,
				couponDiscount: 101,
			}),
		/discount cannot exceed/i,
	);
	assert.throws(
		() =>
			calculateCheckoutTotals({
				itemsTotal: 100,
				paidAmount: 50,
				refundedAmount: 51,
			}),
		/refunded amount cannot exceed/i,
	);
	assert.throws(
		() =>
			resolveInitialPayment({
				grandTotal: 100,
				paymentPlan: "partial",
				partialAmount: 100,
			}),
		/less than the grand total/i,
	);
});

test("retail deposits require an explicit retailer setting", () => {
	assert.throws(
		() =>
			assertCheckoutPaymentPlanAllowed({
				audience: "retail",
				paymentPlan: "partial",
			}),
		/not enabled/i,
	);
	assert.doesNotThrow(() =>
		assertCheckoutPaymentPlanAllowed({
			audience: "wholesale",
			paymentPlan: "partial",
		}),
	);
});

test("refund status is derived independently from payment completion", () => {
	assert.equal(
		deriveCheckoutPaymentStatus({
			netPayable: 1_000,
			paidAmount: 1_000,
			refundedAmount: 250,
		}),
		"partially_refunded",
	);
	assert.equal(
		deriveCheckoutPaymentStatus({
			netPayable: 1_000,
			paidAmount: 1_000,
			refundedAmount: 1_000,
		}),
		"refunded",
	);
});
