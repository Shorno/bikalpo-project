export type ManualPurchaseLine = {
  inventoryId: number;
  quantity: number;
  unitCost: number;
  exchangeQty?: number;
};

export type ManualPurchaseTotals = {
  amountDue: number;
  discount: number;
  paidAmount: number;
  paymentStatus: "paid" | "partial" | "unpaid";
  subtotal: number;
  total: number;
  vatAmount: number;
};

export function roundPurchaseMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateManualPurchaseTotals(input: {
  discount?: number;
  items: ManualPurchaseLine[];
  paidAmount?: number;
  vatAmount?: number;
}): ManualPurchaseTotals {
  const subtotal = roundPurchaseMoney(
    input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0,
    ),
  );
  const discount = roundPurchaseMoney(input.discount ?? 0);
  const vatAmount = roundPurchaseMoney(input.vatAmount ?? 0);
  const total = roundPurchaseMoney(subtotal - discount + vatAmount);
  const paidAmount = roundPurchaseMoney(input.paidAmount ?? 0);
  const amountDue = roundPurchaseMoney(Math.max(0, total - paidAmount));

  return {
    amountDue,
    discount,
    paidAmount,
    paymentStatus:
      paidAmount <= 0 ? "unpaid" : amountDue > 0 ? "partial" : "paid",
    subtotal,
    total,
    vatAmount,
  };
}

export function verifyManualPurchaseInput(input: {
  discount?: number;
  items: ManualPurchaseLine[];
  paidAmount?: number;
  paymentAccountId?: number | null;
  paymentMethod?: string | null;
  supplierId?: number | null;
  vatAmount?: number;
}) {
  const errors: string[] = [];
  if (!input.supplierId || input.supplierId <= 0) {
    errors.push("Select a valid supplier");
  }
  if (input.items.length === 0) errors.push("Add at least one purchase item");

  const inventoryIds = new Set<number>();
  for (const [index, item] of input.items.entries()) {
    if (!Number.isInteger(item.inventoryId) || item.inventoryId <= 0) {
      errors.push(`Line ${index + 1} has an invalid product variant`);
    }
    if (inventoryIds.has(item.inventoryId)) {
      errors.push(`Line ${index + 1} duplicates another product variant`);
    }
    inventoryIds.add(item.inventoryId);
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push(`Line ${index + 1} quantity must be greater than zero`);
    }
    if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
      errors.push(`Line ${index + 1} price cannot be negative`);
    }
    if ((item.exchangeQty ?? 0) < 0) {
      errors.push(`Line ${index + 1} exchange quantity cannot be negative`);
    }
  }

  const totals = calculateManualPurchaseTotals(input);
  if (totals.discount < 0) errors.push("Discount cannot be negative");
  if (totals.vatAmount < 0) errors.push("VAT / Tax cannot be negative");
  if (totals.total <= 0) errors.push("Purchase total must be greater than zero");
  if (totals.paidAmount < 0) errors.push("Paid amount cannot be negative");
  if (totals.paidAmount > totals.total) {
    errors.push("Paid amount cannot exceed the purchase total");
  }
  if (
    totals.paidAmount > 0 &&
    (!input.paymentMethod || !input.paymentAccountId)
  ) {
    errors.push("Select a payment method and cash or bank account");
  }

  return {
    errors,
    isValid: errors.length === 0,
    totals,
  };
}
