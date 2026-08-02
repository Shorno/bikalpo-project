export type PosAdjustment = {
	mode: "fixed" | "percentage";
	value: number;
};

export type PosCheckoutCalculation = {
	subtotal: number;
	discount: number;
	taxableAmount: number;
	tax: number;
	total: number;
	paid: number;
	due: number;
	change: number;
};

export type PosOwner = {
	kind: "warehouse" | "shop";
	id: string;
};

function money(value: number) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function adjustmentAmount(
	base: number,
	adjustment: PosAdjustment | undefined,
	label: string,
) {
	if (!adjustment) return 0;
	if (!Number.isFinite(adjustment.value) || adjustment.value < 0) {
		throw new Error(`${label} must be a non-negative number`);
	}
	if (adjustment.mode === "percentage") {
		if (adjustment.value > 100) {
			throw new Error(`${label} percentage cannot exceed 100`);
		}
		return money(base * (adjustment.value / 100));
	}
	if (adjustment.value > base) {
		throw new Error(`${label} cannot exceed its base amount`);
	}
	return money(adjustment.value);
}

export function calculatePosCheckout(input: {
	lines: Array<{ quantity: number; unitPrice: number }>;
	discount?: PosAdjustment;
	tax?: PosAdjustment;
	tenderedAmount?: number;
}): PosCheckoutCalculation {
	if (input.lines.length === 0) {
		throw new Error("A POS sale requires at least one item");
	}

	const subtotal = money(
		input.lines.reduce((sum, line) => {
			if (
				!Number.isFinite(line.quantity) ||
				line.quantity <= 0 ||
				!Number.isFinite(line.unitPrice) ||
				line.unitPrice < 0
			) {
				throw new Error("POS line quantities and prices must be valid");
			}
			return sum + line.quantity * line.unitPrice;
		}, 0),
	);
	const discount = adjustmentAmount(subtotal, input.discount, "Discount");
	const taxableAmount = money(subtotal - discount);
	const tax = adjustmentAmount(taxableAmount, input.tax, "VAT");
	const total = money(taxableAmount + tax);
	const tendered = money(Math.max(0, input.tenderedAmount ?? total));
	const paid = money(Math.min(total, tendered));

	return {
		subtotal,
		discount,
		taxableAmount,
		tax,
		total,
		paid,
		due: money(Math.max(0, total - paid)),
		change: money(Math.max(0, tendered - total)),
	};
}

export function validatePosDueCustomer(
	customer: { name?: string | null; phone?: string | null },
	calculation: PosCheckoutCalculation,
) {
	if (
		calculation.due > 0 &&
		(!customer.name?.trim() || !customer.phone?.trim())
	) {
		throw new Error(
			"A named customer with a phone number is required for Due sales",
		);
	}
}

export function normalizePosPhone(value?: string | null) {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	const leadingPlus = trimmed.startsWith("+") ? "+" : "";
	const digits = trimmed.replace(/\D/g, "");
	return digits ? `${leadingPlus}${digits}` : null;
}
