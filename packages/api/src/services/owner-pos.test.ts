import assert from "node:assert/strict";
import test from "node:test";

import {
	calculatePosCheckout,
	calculatePosPaymentTotals,
	calculatePosSplitPayments,
	normalizePosPhone,
	validatePosDueCustomer,
} from "./owner-pos";

test("POS payment totals can preview incomplete account selections", () => {
	assert.deepEqual(
		calculatePosPaymentTotals({
			payableTotal: 250,
			receivedAmounts: [100, 200],
		}),
		{
			appliedTotal: 250,
			change: 50,
			due: 0,
			paymentStatus: "paid",
			receivedTotal: 300,
		},
	);
});

test("POS split payments apply only the payable amount and return cash change", () => {
	assert.deepEqual(
		calculatePosSplitPayments({
			payableTotal: 250,
			payments: [
				{ accountId: 7, accountType: "bank", receivedAmount: 100 },
				{ accountId: 3, accountType: "cash", receivedAmount: 200 },
			],
		}),
		{
			appliedTotal: 250,
			change: 50,
			due: 0,
			paymentStatus: "paid",
			receivedTotal: 300,
			rows: [
				{ accountId: 7, appliedAmount: 100, receivedAmount: 100 },
				{ accountId: 3, appliedAmount: 150, receivedAmount: 200 },
			],
		},
	);
});

test("POS split payments derive partial and due states", () => {
	assert.equal(
		calculatePosSplitPayments({
			payableTotal: 250,
			payments: [{ accountId: 7, accountType: "bank", receivedAmount: 100 }],
		}).paymentStatus,
		"partial",
	);
	assert.equal(
		calculatePosSplitPayments({
			payableTotal: 250,
			payments: [],
		}).paymentStatus,
		"due",
	);
});

test("POS over-tender is accepted only on a cash account", () => {
	assert.throws(
		() =>
			calculatePosSplitPayments({
				payableTotal: 100,
				payments: [{ accountId: 7, accountType: "bank", receivedAmount: 110 }],
			}),
		/cash account/i,
	);
});

test("POS checkout applies percentage discount before VAT and returns cash change", () => {
	const result = calculatePosCheckout({
		lines: [
			{ quantity: 2, unitPrice: 100 },
			{ quantity: 1, unitPrice: 50 },
		],
		discount: { mode: "percentage", value: 10 },
		tax: { mode: "percentage", value: 5 },
		tenderedAmount: 250,
	});

	assert.deepEqual(result, {
		subtotal: 250,
		discount: 25,
		taxableAmount: 225,
		tax: 11.25,
		total: 236.25,
		paid: 236.25,
		due: 0,
		change: 13.75,
	});
});

test("POS checkout requires a named customer with phone when money remains due", () => {
	assert.throws(
		() =>
			validatePosDueCustomer(
				{ name: "", phone: "" },
				calculatePosCheckout({
					lines: [{ quantity: 1, unitPrice: 100 }],
					tenderedAmount: 40,
				}),
			),
		/named customer with a phone number/i,
	);

	assert.doesNotThrow(() =>
		validatePosDueCustomer(
			{ name: "Mrs Rahima", phone: "+8801815151827" },
			calculatePosCheckout({
				lines: [{ quantity: 1, unitPrice: 100 }],
				tenderedAmount: 40,
			}),
		),
	);
});

test("POS checkout rejects adjustments that exceed their base", () => {
	assert.throws(
		() =>
			calculatePosCheckout({
				lines: [{ quantity: 1, unitPrice: 100 }],
				discount: { mode: "fixed", value: 100.01 },
			}),
		/discount cannot exceed/i,
	);
	assert.throws(
		() =>
			calculatePosCheckout({
				lines: [{ quantity: 1, unitPrice: 100 }],
				tax: { mode: "percentage", value: 101 },
			}),
		/VAT percentage cannot exceed 100/i,
	);
});

test("POS phone normalization creates a stable shop-local deduplication value", () => {
	assert.equal(normalizePosPhone("+880 1815-151827"), "+8801815151827");
	assert.equal(normalizePosPhone("  "), null);
});
