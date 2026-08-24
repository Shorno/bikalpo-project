import assert from "node:assert/strict";
import test from "node:test";

import {
	assertCheckoutQuoteMatches,
	buildCheckoutQuote,
	normalizePromotionCode,
	type CheckoutPromotionRecord,
} from "./checkout-quote";

const now = new Date("2026-08-16T10:00:00.000Z");

test("quotes are stable when line ordering changes", () => {
	const base = {
		audience: "wholesale" as const,
		sellerId: "warehouse-1",
		deliveryMode: "courier" as const,
		paymentPlan: "pay_later" as const,
		deliveryFee: 100,
		now,
	};
	const first = buildCheckoutQuote({
		...base,
		lines: [
			{ key: "B", quantity: 1, unitPrice: 200 },
			{ key: "A", quantity: 2, unitPrice: 100 },
		],
	});
	const second = buildCheckoutQuote({
		...base,
		lines: [
			{ key: "A", quantity: 2, unitPrice: 100 },
			{ key: "B", quantity: 1, unitPrice: 200 },
		],
	});

	assert.equal(first.version, second.version);
	assert.equal(first.totals.grandTotal, 500);
});

test("self pickup removes courier and shipping fees", () => {
	const quote = buildCheckoutQuote({
		audience: "retail",
		sellerId: "shop-1",
		lines: [{ key: "1", quantity: 1, unitPrice: 1_000 }],
		deliveryMode: "self_pickup",
		paymentPlan: "pay_later",
		deliveryFee: 195,
		shippingFee: 5,
		now,
	});

	assert.equal(quote.totals.deliveryFee, 0);
	assert.equal(quote.totals.shippingFee, 0);
	assert.equal(quote.totals.grandTotal, 1_000);
});

test("seller promotions produce coupon snapshots", () => {
	const quote = buildCheckoutQuote({
		audience: "retail",
		sellerId: "shop-1",
		lines: [{ key: "1", quantity: 2, unitPrice: 500 }],
		deliveryMode: "courier",
		paymentPlan: "pay_now",
		promotion: {
			id: 1,
			ownerId: "shop-1",
			code: " save10 ",
			audience: "retail",
			isActive: true,
			type: "percentage",
			value: 10,
			maximumDiscount: 75,
		},
		now,
	});

	assert.equal(quote.promotionCode, "SAVE10");
	assert.equal(quote.totals.couponDiscount, 75);
	assert.equal(quote.initialPaymentAmount, 925);
	assert.equal(quote.projectedDueAfterPayment, 0);
});

test("expired, exhausted, and foreign promotions are rejected", () => {
	const promotion: CheckoutPromotionRecord = {
		id: 1,
		ownerId: "shop-1",
		code: "SAVE10",
		audience: "retail" as const,
		isActive: true,
		type: "fixed" as const,
		value: 10,
	};
	const build = (overrides: Partial<CheckoutPromotionRecord>) =>
		buildCheckoutQuote({
			audience: "retail",
			sellerId: "shop-1",
			lines: [{ key: "1", quantity: 1, unitPrice: 100 }],
			deliveryMode: "courier",
			paymentPlan: "pay_later",
			promotion: { ...promotion, ...overrides },
			now,
		});

	assert.throws(
		() => build({ endsAt: new Date("2026-08-15T00:00:00.000Z") }),
		/expired/i,
	);
	assert.throws(
		() => build({ usageLimit: 2, usedCount: 2 }),
		/usage limit/i,
	);
	assert.throws(() => build({ ownerId: "shop-2" }), /selected seller/i);
});

test("quote matching detects stale totals and expiration", () => {
	const quote = buildCheckoutQuote({
		audience: "wholesale",
		sellerId: "warehouse-1",
		lines: [{ key: "1", quantity: 1, unitPrice: 100 }],
		deliveryMode: "courier",
		paymentPlan: "pay_later",
		now,
	});

	assert.doesNotThrow(() =>
		assertCheckoutQuoteMatches({
			expectedVersion: quote.version,
			expectedExpiresAt: quote.expiresAt,
			quote,
			now: new Date("2026-08-16T10:05:00.000Z"),
		}),
	);
	assert.throws(
		() =>
			assertCheckoutQuoteMatches({
				expectedVersion: "old-version",
				expectedExpiresAt: quote.expiresAt,
				quote,
				now: new Date("2026-08-16T10:05:00.000Z"),
			}),
		/totals changed/i,
	);
	assert.throws(
		() =>
			assertCheckoutQuoteMatches({
				expectedVersion: quote.version,
				expectedExpiresAt: quote.expiresAt,
				quote,
				now: new Date("2026-08-16T10:11:00.000Z"),
			}),
		/expired/i,
	);
});

test("promotion codes normalize consistently", () => {
	assert.equal(normalizePromotionCode("  save-20 "), "SAVE-20");
	assert.equal(normalizePromotionCode("  "), null);
	assert.equal(normalizePromotionCode(), null);
});
