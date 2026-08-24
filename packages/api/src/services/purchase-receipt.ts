import {
  inventory,
  inventoryMovement,
  order,
  payment,
  purchaseEvent,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { localDateString } from "../utils/date";
import { postPurchaseJournal } from "./purchase-accounting";
import {
  appendOrderPurchaseEvent,
  appendPurchaseInventoryMovement,
} from "./purchase-history";
import {
  allocateReceiptLandedCost,
  calculateIncrementalReceipt,
  calculateReceiptPosting,
} from "./purchase-lifecycle";

export async function recognizePlatformPurchaseReceipt(
  tx: any,
  input: {
    actorId: string;
    orderId: number;
    ownerId: string;
    ownerType: "shop" | "warehouse";
    receivedAt: Date;
  },
) {
  const purchaseOrder = await tx.query.order.findFirst({
    where: and(eq(order.id, input.orderId), eq(order.userId, input.ownerId)),
    with: { items: true },
  });
  if (!purchaseOrder)
    throw new Error("Purchase order was not found for receipt");

  const landedCosts = allocateReceiptLandedCost({
    grandTotal: Number(purchaseOrder.total),
    subtotal: Number(purchaseOrder.subtotal),
    lines: purchaseOrder.items.map((item: any) => ({
      id: item.id,
      lineTotal:
        Number(item.modifiedUnitPrice ?? item.unitPrice) *
        Number(item.modifiedQty ?? item.quantity),
      orderedQty: Number(item.modifiedQty ?? item.quantity),
      receivedQty: Number(item.receivedQty ?? 0),
    })),
  });
  const landedCostByItem = new Map(landedCosts.map((line) => [line.id, line]));
  const priorMovements = await tx.query.inventoryMovement.findMany({
    where: and(
      eq(inventoryMovement.orderId, input.orderId),
      eq(inventoryMovement.ownerId, input.ownerId),
      eq(inventoryMovement.reason, "purchase_receipt"),
    ),
  });
  const priorQuantityByItem = new Map<number, number>();
  const priorValueByItem = new Map<number, number>();
  for (const movement of priorMovements) {
    if (!movement.orderItemId) continue;
    priorQuantityByItem.set(
      movement.orderItemId,
      (priorQuantityByItem.get(movement.orderItemId) ?? 0) +
        Number(movement.quantity),
    );
    priorValueByItem.set(
      movement.orderItemId,
      (priorValueByItem.get(movement.orderItemId) ?? 0) +
        Number(movement.totalCost),
    );
  }
  const receiptSequence = priorMovements.length + 1;
  const receiptDeltas = purchaseOrder.items.map((item: any) => {
    const cumulativeQuantity = Number(
      item.convertedQty ?? item.receivedQty ?? 0,
    );
    const cumulativeValue = landedCostByItem.get(item.id)?.recognizedTotal ?? 0;
    return {
      id: item.id,
      ...calculateIncrementalReceipt({
        cumulativeQuantity,
        cumulativeValue,
        priorQuantity: priorQuantityByItem.get(item.id) ?? 0,
        priorValue: priorValueByItem.get(item.id) ?? 0,
      }),
    };
  });
  const receiptValue = receiptDeltas.reduce(
    (total, line) => total + line.value,
    0,
  );

  const completedAdvances = await tx.query.payment.findMany({
    where: and(
      eq(payment.orderId, input.orderId),
      eq(payment.status, "completed"),
      eq(payment.purchasePurpose, "supplier_advance"),
    ),
  });
  const advanceAvailable = completedAdvances.reduce(
    (total: number, row: any) =>
      total + Math.max(0, Number(row.amount) - Number(row.refundedAmount)),
    0,
  );
  const appliedAdvanceEvents = await tx.query.purchaseEvent.findMany({
    where: and(
      eq(purchaseEvent.orderId, input.orderId),
      eq(purchaseEvent.ownerId, input.ownerId),
      eq(purchaseEvent.eventType, "advance_applied"),
    ),
  });
  const advanceAlreadyApplied = appliedAdvanceEvents.reduce(
    (total: number, event: any) => total + Number(event.amount ?? 0),
    0,
  );
  const receiptPosting = calculateReceiptPosting({
    advanceAvailable: Math.max(0, advanceAvailable - advanceAlreadyApplied),
    receiptValue,
  });

  const targetVariantIds = purchaseOrder.items
    .map((item: any) => item.targetVariantId ?? item.variantId)
    .filter((value: number | null): value is number => Number.isFinite(value));
  const inventoryRows = targetVariantIds.length
    ? await tx.query.inventory.findMany({
        where: and(
          eq(inventory.ownerType, input.ownerType),
          eq(inventory.ownerId, input.ownerId),
          inArray(inventory.variantId, targetVariantIds),
        ),
      })
    : [];
  const inventoryByVariant = new Map<number, any>(
    inventoryRows.map((row: any) => [row.variantId, row]),
  );

  for (const item of purchaseOrder.items) {
    const delta = receiptDeltas.find((line) => line.id === item.id);
    const movementQty = delta?.quantity ?? 0;
    const targetVariantId = item.targetVariantId ?? item.variantId;
    const cost = landedCostByItem.get(item.id);
    if (!targetVariantId || movementQty <= 0 || !cost || !delta) continue;

    await appendPurchaseInventoryMovement(tx, {
      createdById: input.actorId,
      idempotencyKey: `order:${input.orderId}:item:${item.id}:receipt:${receiptSequence}`,
      orderId: input.orderId,
      orderItemId: item.id,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      quantity: movementQty,
      quantityAfter: Number(
        inventoryByVariant.get(targetVariantId)?.availableQty ?? movementQty,
      ),
      reason: "purchase_receipt",
      reference: purchaseOrder.orderNumber,
      totalCost: delta.value,
      unit: item.inventoryUnit ?? item.quantityUnit ?? "unit",
      unitCost: delta.value / movementQty,
      variantId: targetVariantId,
    });
  }

  if (receiptPosting.receiptValue > 0) {
    await postPurchaseJournal(tx, {
      actorId: input.actorId,
      amount: receiptPosting.receiptValue,
      idempotencyKey: `order:${input.orderId}:purchase-receipt:${receiptSequence}`,
      memo: `Products received for ${purchaseOrder.orderNumber}`,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      sourceId: String(input.orderId),
      sourceType: "purchase_event",
      transactionDate: localDateString(input.receivedAt),
      transactionType: "purchase_receipt",
    });
  }
  if (receiptPosting.advanceApplied > 0) {
    await postPurchaseJournal(tx, {
      actorId: input.actorId,
      amount: receiptPosting.advanceApplied,
      idempotencyKey: `order:${input.orderId}:advance-applied:${receiptSequence}`,
      memo: `Supplier advance applied to ${purchaseOrder.orderNumber}`,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      sourceId: String(input.orderId),
      sourceType: "purchase_event",
      transactionDate: localDateString(input.receivedAt),
      transactionType: "supplier_advance_applied",
    });
  }

  const fullyReceived = purchaseOrder.items.every(
    (item: any) =>
      Number(item.receivedQty ?? 0) >= Number(item.modifiedQty ?? item.quantity),
  );
  await appendOrderPurchaseEvent(tx, {
    actorId: input.actorId,
    category: "purchase",
    description: fullyReceived
      ? "Purchase accepted and products received"
      : "Part of the purchase was received",
    eventType: fullyReceived ? "received" : "partially_received",
    fromState: "accepted",
    idempotencyKey: `order:${input.orderId}:receipt:${receiptSequence}`,
    orderId: input.orderId,
    ownerId: input.ownerId,
    reference: purchaseOrder.orderNumber,
    toState: fullyReceived ? "received" : "partially_received",
  });
  await appendOrderPurchaseEvent(tx, {
    actorId: input.actorId,
    amount: receiptPosting.receiptValue,
    category: "inventory",
    description: "Received product cost recognized as inventory",
    eventType: "inventory_recognized",
    idempotencyKey: `order:${input.orderId}:inventory-recognized:${receiptSequence}`,
    orderId: input.orderId,
    ownerId: input.ownerId,
    reference: purchaseOrder.orderNumber,
    toState: "recognized",
  });
  await appendOrderPurchaseEvent(tx, {
    actorId: input.actorId,
    amount: receiptPosting.payableCreated,
    category: "accounting",
    description: "Inventory debited and Accounts Payable credited",
    eventType: "payable_created",
    idempotencyKey: `order:${input.orderId}:payable-created:${receiptSequence}`,
    metadata: { payableRemaining: receiptPosting.payableRemaining },
    orderId: input.orderId,
    ownerId: input.ownerId,
    reference: purchaseOrder.orderNumber,
  });
  if (receiptPosting.advanceApplied > 0) {
    await appendOrderPurchaseEvent(tx, {
      actorId: input.actorId,
      amount: receiptPosting.advanceApplied,
      category: "accounting",
      description: "Supplier advance applied against Accounts Payable",
      eventType: "advance_applied",
      idempotencyKey: `order:${input.orderId}:advance-applied:event:${receiptSequence}`,
      orderId: input.orderId,
      ownerId: input.ownerId,
      reference: purchaseOrder.orderNumber,
    });
  }

  return receiptPosting;
}
