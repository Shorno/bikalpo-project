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

export type PosSplitPaymentStatus = "paid" | "partial" | "due";

export type PosSplitPaymentCalculation = {
	receivedTotal: number;
	appliedTotal: number;
	change: number;
	due: number;
	paymentStatus: PosSplitPaymentStatus;
	rows: Array<{
		accountId: number;
		receivedAmount: number;
		appliedAmount: number;
	}>;
};

export type PosPaymentTotals = Omit<PosSplitPaymentCalculation, "rows">;

function money(value: number) {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculatePosPaymentTotals(input: {
	payableTotal: number;
	receivedAmounts: number[];
}): PosPaymentTotals {
	if (!Number.isFinite(input.payableTotal) || input.payableTotal < 0) {
		throw new Error("Payable total must be a non-negative number");
	}
	for (const receivedAmount of input.receivedAmounts) {
		if (!Number.isFinite(receivedAmount) || receivedAmount < 0) {
			throw new Error("Received amount must be a non-negative number");
		}
	}
	const receivedTotal = money(
		input.receivedAmounts.reduce((sum, amount) => sum + amount, 0),
	);
	const appliedTotal = money(Math.min(input.payableTotal, receivedTotal));
	const due = money(Math.max(0, input.payableTotal - appliedTotal));
	const change = money(Math.max(0, receivedTotal - appliedTotal));
	return {
		receivedTotal,
		appliedTotal,
		change,
		due,
		paymentStatus: due === 0 ? "paid" : appliedTotal > 0 ? "partial" : "due",
	};
}

export function calculatePosSplitPayments(input: {
	payableTotal: number;
	payments: Array<{
		accountId: number;
		accountType: "cash" | "bank";
		receivedAmount: number;
	}>;
}): PosSplitPaymentCalculation {
	if (!Number.isFinite(input.payableTotal) || input.payableTotal < 0) {
		throw new Error("Payable total must be a non-negative number");
	}

	const seenAccounts = new Set<number>();
	let remaining = money(input.payableTotal);
	const rows = input.payments.map((payment) => {
		if (!Number.isInteger(payment.accountId) || payment.accountId <= 0) {
			throw new Error("Select a valid payment account");
		}
		if (seenAccounts.has(payment.accountId)) {
			throw new Error("Each split payment must use a different account");
		}
		seenAccounts.add(payment.accountId);
		if (
			!Number.isFinite(payment.receivedAmount) ||
			payment.receivedAmount < 0
		) {
			throw new Error("Received amount must be a non-negative number");
		}

		const receivedAmount = money(payment.receivedAmount);
		const appliedAmount = money(Math.min(receivedAmount, remaining));
		if (receivedAmount > appliedAmount && payment.accountType !== "cash") {
			throw new Error(
				"Only a cash account can receive an amount that returns change",
			);
		}
		remaining = money(Math.max(0, remaining - appliedAmount));

		return {
			accountId: payment.accountId,
			receivedAmount,
			appliedAmount,
		};
	});

	return {
		...calculatePosPaymentTotals({
			payableTotal: input.payableTotal,
			receivedAmounts: rows.map((payment) => payment.receivedAmount),
		}),
		rows,
	};
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
