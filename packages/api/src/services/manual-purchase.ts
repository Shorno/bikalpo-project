import {
  financePaymentAccount,
  inventory,
  payment,
  purchase,
  purchaseItem,
  supplier,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { localDateStamp, localDateString } from "../utils/date";
import {
  type ManualPurchaseLine,
  verifyManualPurchaseInput,
} from "./manual-purchase-domain";
import { postPurchaseJournal } from "./purchase-accounting";
import {
  appendManualPurchaseEvent,
  appendPurchaseInventoryMovement,
} from "./purchase-history";

export type ManualPurchaseItemInput = ManualPurchaseLine & {
  batchNo?: string | null;
  expiryDate?: string | null;
};

export type ManualPurchaseInput = {
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  discount?: number;
  entryMode: "exchange" | "new";
  idempotencyKey: string;
  items: ManualPurchaseItemInput[];
  note?: string | null;
  paidAmount?: number;
  paymentAccountId?: number | null;
  paymentMethod?: string | null;
  purchaseDate?: string | null;
  supplierId: number;
  supplierInvoiceNo?: string | null;
  vatAmount?: number;
};

export type ManualPurchaseScope = {
  actorId: string;
  ownerId: string;
  ownerType: "shop" | "warehouse";
};

function manualPurchaseNumber(scope: ManualPurchaseScope, input: ManualPurchaseInput) {
  const owner = scope.ownerId.replace(/[^a-zA-Z0-9]/g, "").slice(-4);
  const token = input.idempotencyKey.replace(/[^a-zA-Z0-9]/g, "").slice(-8);
  return `MP-${localDateStamp(new Date())}-${owner}-${token}`.toUpperCase();
}

export async function persistManualPurchaseDraft(
  tx: any,
  scope: ManualPurchaseScope,
  input: ManualPurchaseInput,
) {
  const existing = await tx.query.purchase.findFirst({
    where: and(
      eq(purchase.warehouseId, scope.ownerId),
      eq(purchase.idempotencyKey, input.idempotencyKey),
    ),
    with: { items: true },
  });
  if (existing) return { created: false, purchase: existing };

  const [supplierRecord, inventoryRows, paymentAccount] = await Promise.all([
    tx.query.supplier.findFirst({
      where: and(
        eq(supplier.id, input.supplierId),
        eq(supplier.addedBy, scope.ownerId),
        eq(supplier.status, "active"),
      ),
    }),
    input.items.length
      ? tx.query.inventory.findMany({
          where: and(
            eq(inventory.ownerId, scope.ownerId),
            eq(inventory.ownerType, scope.ownerType),
            inArray(
              inventory.id,
              input.items.map((item) => item.inventoryId),
            ),
          ),
          with: {
            variant: {
              with: { brand: true, product: true },
            },
          },
        })
      : [],
    input.paymentAccountId
      ? tx.query.financePaymentAccount.findFirst({
          where: and(
            eq(financePaymentAccount.id, input.paymentAccountId),
            eq(financePaymentAccount.ownerId, scope.ownerId),
            eq(financePaymentAccount.ownerType, scope.ownerType),
            eq(financePaymentAccount.isActive, true),
          ),
        })
      : null,
  ]);

  const verification = verifyManualPurchaseInput(input);
  const errors = [...verification.errors];
  if (!supplierRecord) errors.push("Supplier does not belong to this business");
  if (inventoryRows.length !== new Set(input.items.map((item) => item.inventoryId)).size) {
    errors.push("One or more product variants do not belong to this inventory");
  }
  if (input.paymentAccountId && !paymentAccount) {
    errors.push("Payment account does not belong to this business");
  }

  const verificationStatus = errors.length === 0 ? "verified" : "on_hold";
  const purchaseDate = input.purchaseDate || localDateString();
  const [created] = await tx
    .insert(purchase)
    .values({
      attachmentName: input.attachmentName ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      createdById: scope.actorId,
      discount: verification.totals.discount.toFixed(2),
      dueAmount: verification.totals.total.toFixed(2),
      entryMode: input.entryMode,
      idempotencyKey: input.idempotencyKey,
      note: input.note ?? null,
      ownerType: scope.ownerType,
      paidAmount: "0.00",
      paymentAccountId: input.paymentAccountId ?? null,
      paymentMethod: input.paymentMethod ?? null,
      paymentStatus: "unpaid",
      paymentType: verification.totals.paidAmount > 0 ? "cash" : "credit",
      purchaseDate,
      purchaseNumber: manualPurchaseNumber(scope, input),
      status: "draft",
      subtotal: verification.totals.subtotal.toFixed(2),
      supplierId: input.supplierId,
      supplierInvoiceNo: input.supplierInvoiceNo ?? null,
      total: verification.totals.total.toFixed(2),
      transportCost: "0.00",
      vatAmount: verification.totals.vatAmount.toFixed(2),
      verificationMessage: errors.join("; ") || null,
      verificationStatus,
      warehouseId: scope.ownerId,
    })
    .returning();
  if (!created) throw new Error("Failed to create manual purchase draft");

  const inventoryById = new Map<number, any>(
    inventoryRows.map((row: any) => [row.id, row]),
  );
  const itemValues = input.items.flatMap((line) => {
    const inventoryRow = inventoryById.get(line.inventoryId);
    if (!inventoryRow?.variant) return [];
    const variant = inventoryRow.variant;
    return [{
      batchNo: line.batchNo ?? null,
      brandName: variant.brand?.name ?? null,
      exchangeQty: String(line.exchangeQty ?? 0),
      expiryDate: line.expiryDate ?? null,
      productName: variant.product?.name ?? "Product",
      purchaseId: created.id,
      quantity: line.quantity.toFixed(2),
      quantityUnit: variant.orderUnit || variant.packType || "unit",
      receivedQty: "0.00",
      sizeLabel: variant.unitLabel ?? null,
      sku: variant.sku ?? null,
      totalCost: (line.quantity * line.unitCost).toFixed(2),
      unitCost: line.unitCost.toFixed(2),
      variantId: variant.id,
    }];
  });
  if (itemValues.length > 0) await tx.insert(purchaseItem).values(itemValues);

  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    category: "purchase",
    description: "Manual purchase draft created",
    eventType: "draft_created",
    idempotencyKey: `manual-purchase:${created.id}:draft`,
    ownerId: scope.ownerId,
    purchaseId: created.id,
    reference: created.purchaseNumber,
    toState: "draft",
  });
  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    category: "purchase",
    description:
      verificationStatus === "verified"
        ? "Manual purchase verified"
        : errors.join("; "),
    eventType:
      verificationStatus === "verified"
        ? "verification_passed"
        : "verification_on_hold",
    idempotencyKey: `manual-purchase:${created.id}:verification`,
    metadata: { errors },
    ownerId: scope.ownerId,
    purchaseId: created.id,
    reference: created.purchaseNumber,
    toState: verificationStatus,
  });

  return {
    created: true,
    purchase: { ...created, items: itemValues },
  };
}

export async function confirmManualPurchaseReceipt(
  tx: any,
  scope: ManualPurchaseScope,
  purchaseId: number,
) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${purchaseId})`);
  const purchaseRecord = await tx.query.purchase.findFirst({
    where: and(
      eq(purchase.id, purchaseId),
      eq(purchase.warehouseId, scope.ownerId),
      eq(purchase.ownerType, scope.ownerType),
    ),
    with: { items: true },
  });
  if (!purchaseRecord) throw new Error("Manual purchase was not found");
  if (purchaseRecord.status === "received") return purchaseRecord;
  if (purchaseRecord.status !== "draft") {
    throw new Error("Only a draft manual purchase can be confirmed");
  }
  if (purchaseRecord.verificationStatus !== "verified") {
    throw new Error(
      purchaseRecord.verificationMessage || "Manual purchase is on hold",
    );
  }
  if (purchaseRecord.items.length === 0) {
    throw new Error("Manual purchase has no verified items");
  }

  const variantIds = purchaseRecord.items
    .map((item: any) => item.variantId)
    .filter((id: number | null): id is number => Boolean(id));
  const inventoryRows = await tx.query.inventory.findMany({
    where: and(
      eq(inventory.ownerId, scope.ownerId),
      eq(inventory.ownerType, scope.ownerType),
      inArray(inventory.variantId, variantIds),
    ),
  });
  const inventoryByVariant = new Map<number, any>(
    inventoryRows.map((row: any) => [row.variantId, row]),
  );
  if (inventoryByVariant.size !== new Set(variantIds).size) {
    throw new Error("A purchase item is no longer available in this inventory");
  }

  const receivedAt = new Date();
  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    category: "purchase",
    description: "Manual purchase accepted",
    eventType: "accepted",
    fromState: "draft",
    idempotencyKey: `manual-purchase:${purchaseId}:accepted`,
    ownerId: scope.ownerId,
    purchaseId,
    reference: purchaseRecord.purchaseNumber,
    toState: "accepted",
  });

  for (const item of purchaseRecord.items) {
    if (!item.variantId) continue;
    const inventoryRow = inventoryByVariant.get(item.variantId);
    if (!inventoryRow) continue;
    const quantity = Number(item.quantity);
    const quantityBefore = Number(inventoryRow.availableQty);
    const quantityAfter = quantityBefore + quantity;

    await tx
      .update(inventory)
      .set({ availableQty: quantityAfter.toFixed(4), updatedAt: receivedAt })
      .where(eq(inventory.id, inventoryRow.id));
    await tx
      .update(purchaseItem)
      .set({ receivedQty: item.quantity, updatedAt: receivedAt })
      .where(eq(purchaseItem.id, item.id));
    await appendPurchaseInventoryMovement(tx, {
      createdById: scope.actorId,
      idempotencyKey: `manual-purchase:${purchaseId}:item:${item.id}:receipt`,
      ownerId: scope.ownerId,
      ownerType: scope.ownerType,
      purchaseId,
      purchaseItemId: item.id,
      quantity,
      quantityAfter,
      reason: "purchase_receipt",
      reference: purchaseRecord.purchaseNumber,
      totalCost: Number(item.totalCost),
      unit: item.quantityUnit,
      unitCost: Number(item.unitCost),
      variantId: item.variantId,
    });
  }

  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    amount: Number(purchaseRecord.total),
    category: "inventory",
    description: "All manual purchase items received into inventory",
    eventType: "inventory_recognized",
    fromState: "accepted",
    idempotencyKey: `manual-purchase:${purchaseId}:inventory`,
    metadata: {
      itemCount: purchaseRecord.items.length,
      receivedAt: receivedAt.toISOString(),
    },
    ownerId: scope.ownerId,
    purchaseId,
    reference: purchaseRecord.purchaseNumber,
    toState: "received",
  });
  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    amount: Number(purchaseRecord.total),
    category: "purchase",
    description: "Manual purchase received",
    eventType: "received",
    fromState: "accepted",
    idempotencyKey: `manual-purchase:${purchaseId}:received`,
    ownerId: scope.ownerId,
    purchaseId,
    reference: purchaseRecord.purchaseNumber,
    toState: "received",
  });

  await postPurchaseJournal(tx, {
    actorId: scope.actorId,
    amount: Number(purchaseRecord.total),
    idempotencyKey: `manual-purchase:${purchaseId}:receipt-journal`,
    memo: `Inventory received for ${purchaseRecord.purchaseNumber}`,
    ownerId: scope.ownerId,
    ownerType: scope.ownerType,
    sourceId: String(purchaseId),
    sourceType: "purchase",
    transactionDate: purchaseRecord.purchaseDate || localDateString(receivedAt),
    transactionType: "purchase_receipt",
  });
  await tx
    .update(supplier)
    .set({
      currentPayable: sql`${supplier.currentPayable}::numeric + ${Number(purchaseRecord.total)}`,
      updatedAt: receivedAt,
    })
    .where(eq(supplier.id, purchaseRecord.supplierId));
  const advancePayments = await tx.query.payment.findMany({
    where: and(
      eq(payment.purchaseId, purchaseId),
      eq(payment.purchasePurpose, "supplier_advance"),
      eq(payment.status, "completed"),
    ),
  });
  const advanceApplied = Math.min(
    Number(purchaseRecord.total),
    advancePayments.reduce(
      (sum: number, row: any) =>
        sum + Math.max(0, Number(row.amount) - Number(row.refundedAmount)),
      0,
    ),
  );
  if (advanceApplied > 0) {
    await postPurchaseJournal(tx, {
      actorId: scope.actorId,
      amount: advanceApplied,
      idempotencyKey: `manual-purchase:${purchaseId}:advance-applied-journal`,
      memo: `Supplier advance applied to ${purchaseRecord.purchaseNumber}`,
      ownerId: scope.ownerId,
      ownerType: scope.ownerType,
      sourceId: String(purchaseId),
      sourceType: "purchase_event",
      transactionDate: purchaseRecord.purchaseDate || localDateString(receivedAt),
      transactionType: "supplier_advance_applied",
    });
    await tx
      .update(supplier)
      .set({
        currentPayable: sql`greatest(0, ${supplier.currentPayable}::numeric - ${advanceApplied})`,
        updatedAt: receivedAt,
      })
      .where(eq(supplier.id, purchaseRecord.supplierId));
    await appendManualPurchaseEvent(tx, {
      actorId: scope.actorId,
      amount: advanceApplied,
      category: "accounting",
      description: "Supplier advance applied against Accounts Payable",
      eventType: "advance_applied",
      idempotencyKey: `manual-purchase:${purchaseId}:advance-applied`,
      ownerId: scope.ownerId,
      purchaseId,
      reference: purchaseRecord.purchaseNumber,
      toState: "applied",
    });
  }
  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    amount: Number(purchaseRecord.total),
    category: "accounting",
    description: "Inventory debited and Accounts Payable credited",
    eventType: "payable_created",
    idempotencyKey: `manual-purchase:${purchaseId}:payable`,
    ownerId: scope.ownerId,
    purchaseId,
    reference: purchaseRecord.purchaseNumber,
    toState: "posted",
  });
  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    amount: Number(purchaseRecord.total),
    category: "accounting",
    description: "Manual purchase receipt journal posted",
    eventType: "accounting_posted",
    idempotencyKey: `manual-purchase:${purchaseId}:accounting`,
    metadata: {
      credit: "Accounts Payable",
      debit: "Inventory",
      profitAndLossImpact: 0,
    },
    ownerId: scope.ownerId,
    purchaseId,
    reference: purchaseRecord.purchaseNumber,
    toState: "posted",
  });

  const [updated] = await tx
    .update(purchase)
    .set({
      acceptedAt: receivedAt,
      receivedAt,
      status: "received",
      updatedAt: receivedAt,
    })
    .where(eq(purchase.id, purchaseId))
    .returning();
  return updated!;
}

export async function recordManualPurchasePayment(
  tx: any,
  scope: ManualPurchaseScope,
  input: {
    amount: number;
    idempotencyKey: string;
    paymentAccountId: number;
    paymentMethod: string;
    purchaseId: number;
    referenceNo?: string | null;
    transactionId?: string | null;
  },
) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }
  const existingPayment = await tx.query.payment.findFirst({
    where: eq(payment.idempotencyKey, input.idempotencyKey),
  });
  if (existingPayment?.status === "completed") return existingPayment;

  await tx.execute(sql`SELECT pg_advisory_xact_lock(${input.purchaseId})`);
  const purchaseRecord = await tx.query.purchase.findFirst({
    where: and(
      eq(purchase.id, input.purchaseId),
      eq(purchase.warehouseId, scope.ownerId),
      eq(purchase.ownerType, scope.ownerType),
    ),
  });
  if (!purchaseRecord) throw new Error("Manual purchase was not found");
  if (purchaseRecord.status === "cancelled") {
    throw new Error("A cancelled purchase cannot receive payments");
  }
  const currentPaid = Number(purchaseRecord.paidAmount);
  const total = Number(purchaseRecord.total);
  const outstanding = Math.max(0, total - currentPaid);
  if (input.amount > outstanding + 0.001) {
    throw new Error(
      `Payment exceeds the outstanding amount of Tk${outstanding.toFixed(2)}`,
    );
  }

  const account = await tx.query.financePaymentAccount.findFirst({
    where: and(
      eq(financePaymentAccount.id, input.paymentAccountId),
      eq(financePaymentAccount.ownerId, scope.ownerId),
      eq(financePaymentAccount.ownerType, scope.ownerType),
      eq(financePaymentAccount.isActive, true),
    ),
  });
  if (!account) throw new Error("Payment account was not found");

  const completedAt = new Date();
  const isAdvance = purchaseRecord.status === "draft";
  const paidAmount = Math.min(total, currentPaid + input.amount);
  const dueAmount = Math.max(0, total - paidAmount);
  const paymentStatus = dueAmount <= 0 ? "paid" : "partial";
  const [created] = await tx
    .insert(payment)
    .values({
      amount: input.amount.toFixed(2),
      completedAt,
      idempotencyKey: input.idempotencyKey,
      orderId: null,
      paymentAccountId: input.paymentAccountId,
      paymentMethod: input.paymentMethod,
      paymentProvider: "manual",
      purchaseId: input.purchaseId,
      purchasePurpose: isAdvance ? "supplier_advance" : "payable_settlement",
      purchaseTiming: isAdvance ? "before_receipt" : "after_receipt",
      referenceNo: input.referenceNo ?? purchaseRecord.supplierInvoiceNo,
      status: "completed",
      transactionId: input.transactionId ?? null,
      verifiedAt: completedAt,
    })
    .returning();
  if (!created) throw new Error("Failed to record manual purchase payment");

  await postPurchaseJournal(tx, {
    actorId: scope.actorId,
    amount: input.amount,
    idempotencyKey: `manual-purchase-payment:${created.id}:journal`,
    memo: `${isAdvance ? "Supplier advance" : "Purchase payment"} for ${purchaseRecord.purchaseNumber}`,
    ownerId: scope.ownerId,
    ownerType: scope.ownerType,
    paymentAccountId: input.paymentAccountId,
    sourceId: String(created.id),
    sourceType: "payment",
    transactionDate: localDateString(completedAt),
    transactionType: isAdvance
      ? "supplier_advance_payment"
      : "supplier_payment",
  });

  if (!isAdvance) {
    await tx
      .update(supplier)
      .set({
        currentPayable: sql`greatest(0, ${supplier.currentPayable}::numeric - ${input.amount})`,
        updatedAt: completedAt,
      })
      .where(eq(supplier.id, purchaseRecord.supplierId));
  }
  await tx
    .update(purchase)
    .set({
      dueAmount: dueAmount.toFixed(2),
      paidAmount: paidAmount.toFixed(2),
      paymentAccountId: input.paymentAccountId,
      paymentMethod: input.paymentMethod,
      paymentStatus,
      paymentType: dueAmount <= 0 ? "cash" : "credit",
      updatedAt: completedAt,
    })
    .where(eq(purchase.id, input.purchaseId));

  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    amount: input.amount,
    category: "payment",
    description: isAdvance
      ? "Supplier advance payment completed"
      : "Purchase due payment completed",
    eventType: "payment_completed",
    fromState: currentPaid <= 0 ? "unpaid" : "partial",
    idempotencyKey: `manual-purchase-payment:${created.id}:completed`,
    metadata: {
      dueAmount,
      paymentAccountId: input.paymentAccountId,
      paymentMethod: input.paymentMethod,
      purpose: created.purchasePurpose,
    },
    ownerId: scope.ownerId,
    purchaseId: input.purchaseId,
    reference: input.referenceNo ?? purchaseRecord.purchaseNumber,
    toState: paymentStatus,
  });
  await appendManualPurchaseEvent(tx, {
    actorId: scope.actorId,
    amount: input.amount,
    category: "accounting",
    description: isAdvance
      ? "Supplier Advance debited and Cash/Bank credited"
      : "Accounts Payable debited and Cash/Bank credited",
    eventType: isAdvance ? "advance_recorded" : "payment_settled",
    idempotencyKey: `manual-purchase-payment:${created.id}:accounting`,
    ownerId: scope.ownerId,
    purchaseId: input.purchaseId,
    reference: purchaseRecord.purchaseNumber,
    toState: "posted",
  });

  return created;
}
