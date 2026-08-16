export type CheckoutDeliveryMode = "self_pickup" | "courier";

export type CheckoutPaymentPlan = "pay_now" | "partial" | "pay_later";

export type CheckoutPaymentStatus =
	| "pending"
	| "partial"
	| "paid"
	| "partially_refunded"
	| "refunded";

export type CheckoutAudience = "retail" | "wholesale";

export type CheckoutPromotion = {
	type: "fixed" | "percentage";
	value: number;
	maximumDiscount?: number | null;
	minimumSubtotal?: number;
};

export type CheckoutTotals = {
	itemsTotal: number;
	productDiscount: number;
	couponDiscount: number;
	rewardDiscount: number;
	totalDiscount: number;
	taxableAmount: number;
	taxAmount: number;
	deliveryFee: number;
	shippingFee: number;
	grandTotal: number;
	returnAmount: number;
	netPayable: number;
	paidAmount: number;
	dueAmount: number;
	changeAmount: number;
	refundedAmount: number;
	paymentStatus: CheckoutPaymentStatus;
};

const MONEY_EPSILON = 0.005;

export function roundMoney(value: number) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nonNegativeMoney(value: number | undefined, label: string) {
	const resolved = roundMoney(value ?? 0);
	if (!Number.isFinite(resolved) || resolved < 0) {
		throw new Error(`${label} must be a non-negative amount`);
	}
	return resolved;
}

export function calculatePromotionDiscount(
	subtotal: number,
	promotion?: CheckoutPromotion | null,
) {
	const safeSubtotal = nonNegativeMoney(subtotal, "Subtotal");
	if (!promotion) return 0;

	const minimumSubtotal = nonNegativeMoney(
		promotion.minimumSubtotal,
		"Minimum subtotal",
	);
	if (safeSubtotal < minimumSubtotal) return 0;

	const value = nonNegativeMoney(promotion.value, "Promotion value");
	let discount =
		promotion.type === "percentage"
			? roundMoney(safeSubtotal * (value / 100))
			: value;
	if (promotion.type === "percentage" && value > 100) {
		throw new Error("Promotion percentage cannot exceed 100");
	}

	if (promotion.maximumDiscount != null) {
		discount = Math.min(
			discount,
			nonNegativeMoney(promotion.maximumDiscount, "Maximum discount"),
		);
	}

	return roundMoney(Math.min(safeSubtotal, discount));
}

export function deriveCheckoutPaymentStatus(input: {
	netPayable: number;
	paidAmount: number;
	refundedAmount?: number;
}): CheckoutPaymentStatus {
	const netPayable = nonNegativeMoney(input.netPayable, "Net payable");
	const paidAmount = nonNegativeMoney(input.paidAmount, "Paid amount");
	const refundedAmount = nonNegativeMoney(
		input.refundedAmount,
		"Refunded amount",
	);

	if (refundedAmount > 0) {
		return refundedAmount + MONEY_EPSILON >= paidAmount
			? "refunded"
			: "partially_refunded";
	}
	if (paidAmount <= 0) return "pending";
	if (paidAmount + MONEY_EPSILON < netPayable) return "partial";
	return "paid";
}

export function calculateCheckoutTotals(input: {
	itemsTotal: number;
	productDiscount?: number;
	couponDiscount?: number;
	rewardDiscount?: number;
	taxAmount?: number;
	deliveryFee?: number;
	shippingFee?: number;
	paidAmount?: number;
	returnAmount?: number;
	refundedAmount?: number;
}): CheckoutTotals {
	const itemsTotal = nonNegativeMoney(input.itemsTotal, "Items total");
	const productDiscount = nonNegativeMoney(
		input.productDiscount,
		"Product discount",
	);
	const couponDiscount = nonNegativeMoney(
		input.couponDiscount,
		"Coupon discount",
	);
	const rewardDiscount = nonNegativeMoney(
		input.rewardDiscount,
		"Reward discount",
	);
	const totalDiscount = roundMoney(
		productDiscount + couponDiscount + rewardDiscount,
	);
	if (totalDiscount > itemsTotal) {
		throw new Error("Total discount cannot exceed the items total");
	}

	const taxableAmount = roundMoney(itemsTotal - totalDiscount);
	const taxAmount = nonNegativeMoney(input.taxAmount, "Tax amount");
	const deliveryFee = nonNegativeMoney(input.deliveryFee, "Delivery fee");
	const shippingFee = nonNegativeMoney(input.shippingFee, "Shipping fee");
	const grandTotal = roundMoney(
		taxableAmount + taxAmount + deliveryFee + shippingFee,
	);
	const returnAmount = nonNegativeMoney(input.returnAmount, "Return amount");
	if (returnAmount > grandTotal) {
		throw new Error("Return amount cannot exceed the grand total");
	}
	const netPayable = roundMoney(grandTotal - returnAmount);
	const paidAmount = nonNegativeMoney(input.paidAmount, "Paid amount");
	const refundedAmount = nonNegativeMoney(
		input.refundedAmount,
		"Refunded amount",
	);
	if (refundedAmount > paidAmount) {
		throw new Error("Refunded amount cannot exceed the paid amount");
	}
	const effectivePaidAmount = roundMoney(paidAmount - refundedAmount);
	const dueAmount = roundMoney(Math.max(0, netPayable - effectivePaidAmount));
	const changeAmount = roundMoney(Math.max(0, effectivePaidAmount - netPayable));

	return {
		itemsTotal,
		productDiscount,
		couponDiscount,
		rewardDiscount,
		totalDiscount,
		taxableAmount,
		taxAmount,
		deliveryFee,
		shippingFee,
		grandTotal,
		returnAmount,
		netPayable,
		paidAmount,
		dueAmount,
		changeAmount,
		refundedAmount,
		paymentStatus: deriveCheckoutPaymentStatus({
			netPayable,
			paidAmount,
			refundedAmount,
		}),
	};
}

export function resolveInitialPayment(input: {
	grandTotal: number;
	paymentPlan: CheckoutPaymentPlan;
	partialAmount?: number;
}) {
	const grandTotal = nonNegativeMoney(input.grandTotal, "Grand total");
	if (input.paymentPlan === "pay_later") return 0;
	if (input.paymentPlan === "pay_now") return grandTotal;

	const partialAmount = nonNegativeMoney(
		input.partialAmount,
		"Partial payment",
	);
	if (partialAmount <= 0 || partialAmount + MONEY_EPSILON >= grandTotal) {
		throw new Error(
			"Partial payment must be greater than zero and less than the grand total",
		);
	}
	return partialAmount;
}

export function assertCheckoutPaymentPlanAllowed(input: {
	audience: CheckoutAudience;
	paymentPlan: CheckoutPaymentPlan;
	allowRetailDeposits?: boolean;
}) {
	if (
		input.audience === "retail" &&
		input.paymentPlan === "partial" &&
		!input.allowRetailDeposits
	) {
		throw new Error("Partial payment is not enabled for this retailer");
	}
}
