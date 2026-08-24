import { ensureDefaultFinancePaymentAccounts } from "@bikalpo-project/db/accounting-seed";
import { order, payment } from "@bikalpo-project/db/schema";
import { eq } from "drizzle-orm";
import { localDateString } from "../utils/date";
import { postPurchaseJournal } from "./purchase-accounting";
import { appendOrderPurchaseEvent } from "./purchase-history";
import { money } from "./purchase-lifecycle";

export async function recordPurchaseSettlement(
  tx: any,
  input: {
    actorId: string;
    amount?: number;
    completedAt: Date;
    idempotencyKey: string;
    orderId: number;
    ownerId: string;
    ownerType: "shop" | "warehouse";
    paymentMethod?: string;
    reference?: string | null;
  },
) {
  const purchaseOrder = await tx.query.order.findFirst({
    where: eq(order.id, input.orderId),
  });
  if (
    !purchaseOrder ||
    purchaseOrder.userId !== input.ownerId ||
    purchaseOrder.orderType !== "b2b"
  ) {
    throw new Error("Purchase order was not found for settlement");
  }

  const dueBefore = money(Number(purchaseOrder.dueAmount));
  const amount = money(Math.min(dueBefore, input.amount ?? dueBefore));
  if (amount <= 0) return null;

  const accounts = await ensureDefaultFinancePaymentAccounts({
    database: tx,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });
  const paymentAccountId = accounts.idsByCode.get("1001-cash-on-hand");
  if (!paymentAccountId) throw new Error("Cash on Hand is not configured");

  const existing = await tx.query.payment.findFirst({
    where: eq(payment.idempotencyKey, input.idempotencyKey),
  });
  if (existing) return existing;

  const [created] = await tx
    .insert(payment)
    .values({
      amount: amount.toFixed(2),
      completedAt: input.completedAt,
      idempotencyKey: input.idempotencyKey,
      orderId: input.orderId,
      paymentAccountId,
      paymentMethod: input.paymentMethod ?? "cash",
      paymentProvider: "manual",
      purchasePurpose: "payable_settlement",
      purchaseTiming: "at_receipt",
      referenceNo: input.reference ?? purchaseOrder.orderNumber,
      status: "completed",
      verifiedAt: input.completedAt,
    })
    .returning();
  if (!created) throw new Error("Purchase settlement could not be recorded");

  await postPurchaseJournal(tx, {
    actorId: input.actorId,
    amount,
    idempotencyKey: `purchase-payment:${created.id}:completed`,
    memo: `COD purchase payment for ${purchaseOrder.orderNumber}`,
    ownerId: input.ownerId,
    ownerType: input.ownerType,
    paymentAccountId,
    sourceId: String(created.id),
    sourceType: "payment",
    transactionDate: localDateString(input.completedAt),
    transactionType: "supplier_payment",
  });

  const paidAmount = money(Number(purchaseOrder.paidAmount) + amount);
  const dueAmount = money(Math.max(0, dueBefore - amount));
  const paymentStatus = dueAmount <= 0 ? "paid" : "partial";
  await tx
    .update(order)
    .set({
      dueAmount: dueAmount.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      paymentStatus,
      updatedAt: input.completedAt,
    })
    .where(eq(order.id, input.orderId));

  await appendOrderPurchaseEvent(tx, {
    actorId: input.actorId,
    amount,
    category: "payment",
    description: "COD payment collected when products were received",
    eventType: "payment_completed",
    fromState: String(purchaseOrder.paymentStatus),
    idempotencyKey: `${input.idempotencyKey}:event`,
    metadata: {
      dueAfter: dueAmount,
      paymentMethod: input.paymentMethod ?? "cash",
      purpose: "payable_settlement",
      timing: "at_receipt",
    },
    orderId: input.orderId,
    ownerId: input.ownerId,
    reference: input.reference ?? purchaseOrder.orderNumber,
    toState: paymentStatus,
  });
  await appendOrderPurchaseEvent(tx, {
    actorId: input.actorId,
    amount,
    category: "accounting",
    description: "Cash credited and Accounts Payable debited",
    eventType: "payment_settled",
    idempotencyKey: `${input.idempotencyKey}:accounting`,
    orderId: input.orderId,
    ownerId: input.ownerId,
    reference: input.reference ?? purchaseOrder.orderNumber,
  });

  return created;
}
