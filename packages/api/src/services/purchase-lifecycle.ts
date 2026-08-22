export type NormalizedPurchaseStatus =
  | "submitted"
  | "accepted"
  | "partially_received"
  | "received"
  | "cancelled"
  | "returned";

export type PurchaseInventoryStatus =
  | "not_recognized"
  | "partially_received"
  | "recognized"
  | "reversed";

export type PurchaseFinancialStatus =
  | "not_posted"
  | "advance_recorded"
  | "payable_open"
  | "partially_settled"
  | "settled"
  | "refund_pending"
  | "refunded";

export type PurchasePaymentAggregateStatus =
  | "unpaid"
  | "partial"
  | "paid"
  | "refund_pending"
  | "partially_refunded"
  | "refunded";

export type PurchasePaymentClassification = {
  purpose: "supplier_advance" | "payable_settlement";
  timing: "before_receipt" | "at_receipt" | "after_receipt";
};

const MONEY_SCALE = 100;

export function money(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Money value must be finite");
  }

  return Math.round((value + Number.EPSILON) * MONEY_SCALE) / MONEY_SCALE;
}

export function classifyPurchasePayment(input: {
  completedAt: Date;
  receivedAt?: Date | null;
}): PurchasePaymentClassification {
  if (!input.receivedAt || input.completedAt < input.receivedAt) {
    return { purpose: "supplier_advance", timing: "before_receipt" };
  }

  if (input.completedAt.getTime() === input.receivedAt.getTime()) {
    return { purpose: "payable_settlement", timing: "at_receipt" };
  }

  return { purpose: "payable_settlement", timing: "after_receipt" };
}

export function derivePurchaseStatus(input: {
  orderStatus: string;
  receivedAt?: Date | null;
  receivedQty: number;
  expectedQty: number;
}): NormalizedPurchaseStatus {
  if (input.orderStatus === "cancelled") return "cancelled";
  if (input.orderStatus === "returned") return "returned";
  if (input.receivedAt || input.receivedQty >= input.expectedQty) {
    return "received";
  }
  if (input.receivedQty > 0) return "partially_received";

  if (
    [
      "approved",
      "confirmed",
      "processing",
      "ready_for_dispatch",
      "partially_invoiced",
      "invoiced",
      "delivered",
    ].includes(input.orderStatus)
  ) {
    return "accepted";
  }

  return "submitted";
}

export function derivePaymentAggregateStatus(input: {
  paidAmount: number;
  purchaseTotal: number;
  refundedAmount: number;
  refundPending?: boolean;
}): PurchasePaymentAggregateStatus {
  const paid = money(Math.max(0, input.paidAmount));
  const total = money(Math.max(0, input.purchaseTotal));
  const refunded = money(Math.max(0, input.refundedAmount));

  if (input.refundPending) return "refund_pending";
  if (refunded > 0 && refunded < paid) return "partially_refunded";
  if (paid > 0 && refunded >= paid) return "refunded";
  if (paid <= 0) return "unpaid";
  if (paid < total) return "partial";
  return "paid";
}

export function deriveFinancialStatus(input: {
  advanceBalance: number;
  payableBalance: number;
  recognizedAmount: number;
  refundedAmount: number;
  refundPending?: boolean;
}): PurchaseFinancialStatus {
  if (input.refundPending) return "refund_pending";
  if (input.refundedAmount > 0 && input.payableBalance <= 0) return "refunded";
  if (input.recognizedAmount <= 0 && input.advanceBalance > 0) {
    return "advance_recorded";
  }
  if (input.recognizedAmount <= 0) return "not_posted";
  if (input.payableBalance >= input.recognizedAmount) return "payable_open";
  if (input.payableBalance > 0) return "partially_settled";
  return "settled";
}

export function calculateReceiptPosting(input: {
  advanceAvailable: number;
  receiptValue: number;
  settlementAmount?: number;
}) {
  const receiptValue = money(Math.max(0, input.receiptValue));
  const advanceApplied = money(
    Math.min(receiptValue, Math.max(0, input.advanceAvailable)),
  );
  const payableAfterAdvance = money(receiptValue - advanceApplied);
  const settlementApplied = money(
    Math.min(payableAfterAdvance, Math.max(0, input.settlementAmount ?? 0)),
  );

  return {
    advanceApplied,
    payableCreated: receiptValue,
    payableRemaining: money(payableAfterAdvance - settlementApplied),
    receiptValue,
    settlementApplied,
  };
}

export type PurchaseReceiptLine = {
  id: number;
  lineTotal: number;
  orderedQty: number;
  receivedQty: number;
};

export function allocateReceiptLandedCost(input: {
  grandTotal: number;
  lines: PurchaseReceiptLine[];
  subtotal: number;
}) {
  const subtotal = money(input.subtotal);
  const grandTotal = money(input.grandTotal);
  if (subtotal <= 0 || grandTotal < 0) {
    throw new Error("Purchase totals must be positive");
  }

  return input.lines.map((line) => {
    if (
      line.orderedQty <= 0 ||
      line.receivedQty < 0 ||
      line.receivedQty > line.orderedQty
    ) {
      throw new Error(`Invalid received quantity for purchase line ${line.id}`);
    }

    const allocatedLineTotal = grandTotal * (line.lineTotal / subtotal);
    const recognizedTotal = money(
      allocatedLineTotal * (line.receivedQty / line.orderedQty),
    );

    return {
      id: line.id,
      recognizedTotal,
      unitCost:
        line.receivedQty > 0 ? money(recognizedTotal / line.receivedQty) : 0,
    };
  });
}
