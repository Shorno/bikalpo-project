import { createHash } from "node:crypto";

import {
	assertCheckoutPaymentPlanAllowed,
	calculateCheckoutTotals,
	calculatePromotionDiscount,
	resolveInitialPayment,
	roundMoney,
	type CheckoutAudience,
	type CheckoutDeliveryMode,
	type CheckoutPaymentPlan,
	type CheckoutPromotion,
	type CheckoutTotals,
} from "./checkout-domain";

export const CHECKOUT_QUOTE_TTL_MS = 10 * 60 * 1_000;

export type CheckoutQuoteLine = {
	key: string;
	quantity: number;
	unitPrice: number;
	productDiscount?: number;
};

export type CheckoutQuote = {
	version: string;
	expiresAt: string;
	audience: CheckoutAudience;
	sellerId: string;
	deliveryMode: CheckoutDeliveryMode;
	paymentPlan: CheckoutPaymentPlan;
	promotionCode: string | null;
	initialPaymentAmount: number;
	projectedDueAfterPayment: number;
	totals: CheckoutTotals;
};

export type CheckoutPromotionRecord = CheckoutPromotion & {
	id: number;
	ownerId: string;
	code: string;
	audience: CheckoutAudience | "all";
	isActive: boolean;
	startsAt?: Date | null;
	endsAt?: Date | null;
	usageLimit?: number | null;
	usedCount?: number;
};

export function normalizePromotionCode(code?: string | null) {
	return code?.trim().toUpperCase() || null;
}

export function validateCheckoutPromotion(input: {
	promotion: CheckoutPromotionRecord;
	sellerId: string;
	audience: CheckoutAudience;
	now?: Date;
}) {
	const now = input.now ?? new Date();
	const promotion = input.promotion;
	if (promotion.ownerId !== input.sellerId) {
		throw new Error("This promotion does not belong to the selected seller");
	}
	if (!promotion.isActive) {
		throw new Error("This promotion is inactive");
	}
	if (
		promotion.audience !== "all" &&
		promotion.audience !== input.audience
	) {
		throw new Error("This promotion is not available for this checkout");
	}
	if (promotion.startsAt && promotion.startsAt > now) {
		throw new Error("This promotion has not started yet");
	}
	if (promotion.endsAt && promotion.endsAt < now) {
		throw new Error("This promotion has expired");
	}
	if (
		promotion.usageLimit != null &&
		(promotion.usedCount ?? 0) >= promotion.usageLimit
	) {
		throw new Error("This promotion has reached its usage limit");
	}
	return promotion;
}

function quoteVersion(value: object) {
	return createHash("sha256")
		.update(JSON.stringify(value))
		.digest("hex")
		.slice(0, 40);
}

export function buildCheckoutQuote(input: {
	audience: CheckoutAudience;
	sellerId: string;
	lines: CheckoutQuoteLine[];
	deliveryMode: CheckoutDeliveryMode;
	paymentPlan: CheckoutPaymentPlan;
	partialAmount?: number;
	allowRetailDeposits?: boolean;
	deliveryFee?: number;
	shippingFee?: number;
	taxAmount?: number;
	taxPercentage?: number;
	rewardDiscount?: number;
	promotion?: CheckoutPromotionRecord | null;
	now?: Date;
}): CheckoutQuote {
	if (!input.sellerId.trim()) throw new Error("A checkout seller is required");
	if (input.lines.length === 0) {
		throw new Error("A checkout quote requires at least one item");
	}
	assertCheckoutPaymentPlanAllowed({
		audience: input.audience,
		paymentPlan: input.paymentPlan,
		allowRetailDeposits: input.allowRetailDeposits,
	});

	let itemsTotal = 0;
	let productDiscount = 0;
	for (const line of input.lines) {
		if (
			!line.key.trim() ||
			!Number.isFinite(line.quantity) ||
			line.quantity <= 0 ||
			!Number.isFinite(line.unitPrice) ||
			line.unitPrice < 0
		) {
			throw new Error("Checkout item quantities and prices must be valid");
		}
		itemsTotal += line.quantity * line.unitPrice;
		productDiscount += line.productDiscount ?? 0;
	}

	const now = input.now ?? new Date();
	const promotion = input.promotion
		? validateCheckoutPromotion({
				promotion: input.promotion,
				sellerId: input.sellerId,
				audience: input.audience,
				now,
			})
		: null;
	const couponDiscount = calculatePromotionDiscount(
		itemsTotal - productDiscount,
		promotion,
	);
	if (promotion && promotion.value > 0 && couponDiscount === 0) {
		throw new Error(
			`This promotion requires a minimum order of ${promotion.minimumSubtotal ?? 0}`,
		);
	}
	const deliveryFee =
		input.deliveryMode === "self_pickup" ? 0 : (input.deliveryFee ?? 0);
	const shippingFee =
		input.deliveryMode === "self_pickup" ? 0 : (input.shippingFee ?? 0);
	const taxBase = Math.max(
		0,
		itemsTotal -
			productDiscount -
			couponDiscount -
			(input.rewardDiscount ?? 0),
	);
	const taxAmount =
		input.taxAmount ??
		roundMoney(taxBase * Math.max(0, input.taxPercentage ?? 0) / 100);
	const totals = calculateCheckoutTotals({
		itemsTotal,
		productDiscount,
		couponDiscount,
		rewardDiscount: input.rewardDiscount,
		taxAmount,
		deliveryFee,
		shippingFee,
	});
	const initialPaymentAmount = resolveInitialPayment({
		grandTotal: totals.grandTotal,
		paymentPlan: input.paymentPlan,
		partialAmount: input.partialAmount,
	});
	const expiresAt = new Date(now.getTime() + CHECKOUT_QUOTE_TTL_MS);
	const versionPayload = {
		audience: input.audience,
		sellerId: input.sellerId,
		lines: [...input.lines]
			.map((line) => ({
				key: line.key,
				quantity: line.quantity,
				unitPrice: line.unitPrice,
				productDiscount: line.productDiscount ?? 0,
			}))
			.sort((a, b) => a.key.localeCompare(b.key)),
		deliveryMode: input.deliveryMode,
		paymentPlan: input.paymentPlan,
		promotionCode: normalizePromotionCode(promotion?.code),
		initialPaymentAmount,
		totals,
	};

	return {
		version: quoteVersion(versionPayload),
		expiresAt: expiresAt.toISOString(),
		audience: input.audience,
		sellerId: input.sellerId,
		deliveryMode: input.deliveryMode,
		paymentPlan: input.paymentPlan,
		promotionCode: normalizePromotionCode(promotion?.code),
		initialPaymentAmount,
		projectedDueAfterPayment: Math.max(
			0,
			totals.grandTotal - initialPaymentAmount,
		),
		totals,
	};
}

export function assertCheckoutQuoteMatches(input: {
	expectedVersion?: string | null;
	expectedExpiresAt?: string | Date | null;
	quote: CheckoutQuote;
	now?: Date;
}) {
	if (!input.expectedVersion) return;
	const now = input.now ?? new Date();
	const expectedExpiry = input.expectedExpiresAt
		? new Date(input.expectedExpiresAt)
		: new Date(input.quote.expiresAt);
	if (Number.isNaN(expectedExpiry.getTime()) || expectedExpiry <= now) {
		throw new Error("Checkout quote expired. Refresh the order summary.");
	}
	if (input.expectedVersion !== input.quote.version) {
		throw new Error("Checkout totals changed. Review the refreshed summary.");
	}
}
