import {
  financePaymentAccount,
  inventory,
  purchase,
  purchaseItem,
  supplier,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { localDateStamp, localDateString } from "../utils/date";
import {
  type ManualPurchaseLine,
  verifyManualPurchaseInput,
} from "./manual-purchase-domain";
import { appendManualPurchaseEvent } from "./purchase-history";

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
