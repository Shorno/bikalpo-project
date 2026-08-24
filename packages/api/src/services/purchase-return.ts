import {
  inventory,
  inventoryMovement,
  order,
  payment,
} from "@bikalpo-project/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { localDateString } from "../utils/date";
import { postPurchaseJournal } from "./purchase-accounting";
import {
  appendOrderPurchaseEvent,
  appendPurchaseInventoryMovement,
} from "./purchase-history";
import { money } from "./purchase-lifecycle";

export function calculatePurchaseReturnSplit(input: {
  dueAmount: number;
  paidAmount: number;
  returnValue: number;
}) {
  const returnValue = money(Math.max(0, input.returnValue));
  const payableReversal = money(
    Math.min(returnValue, Math.max(0, input.dueAmount)),
  );
  const refundReceivable = money(
    Math.min(
      Math.max(0, input.paidAmount),
      Math.max(0, returnValue - payableReversal),
    ),
  );
  return { payableReversal, refundReceivable, returnValue };
}

export async function returnReceivedPurchase(
  tx: any,
  input: {
    actorId: string;
    orderId: number;
    ownerId: string;
    ownerType: "shop" | "warehouse";
    reason?: string | null;
    returnedAt: Date;
  },
) {
  const purchaseOrder = await tx.query.order.findFirst({
    where: and(eq(order.id, input.orderId), eq(order.userId, input.ownerId)),
    with: { items: true },
  });
  if (!purchaseOrder || purchaseOrder.orderType !== "b2b") {
    throw new Error("Purchase order was not found for return");
  }
  if (["cancelled", "returned"].includes(purchaseOrder.status)) {
    throw new Error("Purchase order is already closed");
  }

  const movements = await tx.query.inventoryMovement.findMany({
    where: and(
      eq(inventoryMovement.orderId, input.orderId),
      eq(inventoryMovement.ownerId, input.ownerId),
      inArray(inventoryMovement.reason, ["purchase_receipt", "purchase_return"]),
    ),
  });
  const returnLines = purchaseOrder.items
    .map((item: any) => {
      const itemMovements = movements.filter(
        (movement: any) => movement.orderItemId === item.id,
      );
      const receipts = itemMovements.filter(
        (movement: any) => movement.reason === "purchase_receipt",
      );
      const returns = itemMovements.filter(
        (movement: any) => movement.reason === "purchase_return",
      );
      return {
        item,
        quantity:
          receipts.reduce(
            (sum: number, movement: any) => sum + Number(movement.quantity),
            0,
          ) -
          returns.reduce(
            (sum: number, movement: any) => sum + Number(movement.quantity),
            0,
          ),
        receiptMovementId: receipts[0]?.id ?? null,
        value: money(
          receipts.reduce(
            (sum: number, movement: any) => sum + Number(movement.totalCost),
            0,
          ) -
            returns.reduce(
              (sum: number, movement: any) => sum + Number(movement.totalCost),
              0,
            ),
        ),
      };
    })
    .filter((line: any) => line.quantity > 0 && line.value > 0);
  if (returnLines.length === 0) {
    throw new Error("This purchase has no received stock to return");
  }

  for (const line of returnLines) {
    const variantId = line.item.targetVariantId ?? line.item.variantId;
    const buyerInventory = await tx.query.inventory.findFirst({
      where: and(
        eq(inventory.ownerId, input.ownerId),
        eq(inventory.ownerType, input.ownerType),
        eq(inventory.variantId, variantId),
      ),
    });
    if (!buyerInventory || Number(buyerInventory.availableQty) < line.quantity) {
      throw new Error(`${line.item.productName} does not have enough stock to return`);
    }
    const quantityAfter = Number(buyerInventory.availableQty) - line.quantity;
    await tx
      .update(inventory)
      .set({
        availableQty: quantityAfter.toFixed(4),
        updatedAt: input.returnedAt,
      })
      .where(
        and(
          eq(inventory.id, buyerInventory.id),
          sql`${inventory.availableQty}::numeric >= ${line.quantity}`,
        ),
      );
    await appendPurchaseInventoryMovement(tx, {
      createdById: input.actorId,
      idempotencyKey: `order:${input.orderId}:item:${line.item.id}:return`,
      orderId: input.orderId,
      orderItemId: line.item.id,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      quantity: line.quantity,
      quantityAfter,
      reason: "purchase_return",
      reference: purchaseOrder.orderNumber,
      reversesMovementId: line.receiptMovementId,
      totalCost: line.value,
      unit: line.item.inventoryUnit ?? line.item.quantityUnit ?? "unit",
      unitCost: line.value / line.quantity,
      variantId,
    });

    if (purchaseOrder.warehouseId && line.item.variantId) {
      const approvedQty = Number(line.item.modifiedQty ?? line.item.quantity);
      const receivedQty = Number(line.item.receivedQty ?? approvedQty);
      const sourceReturnQty =
        Number(line.item.inventoryQty ?? approvedQty) *
        (receivedQty / approvedQty);
      await tx
        .update(inventory)
        .set({
          availableQty: sql`${inventory.availableQty}::numeric + ${sourceReturnQty}`,
          updatedAt: input.returnedAt,
        })
        .where(
          and(
            eq(inventory.ownerId, purchaseOrder.warehouseId),
            eq(inventory.ownerType, "warehouse"),
            eq(inventory.variantId, line.item.variantId),
          ),
        );
    }
  }

  const returnValue = money(
    returnLines.reduce((sum: number, line: any) => sum + line.value, 0),
  );
  const split = calculatePurchaseReturnSplit({
    dueAmount: Number(purchaseOrder.dueAmount),
    paidAmount: Number(purchaseOrder.paidAmount),
    returnValue,
  });
  if (split.payableReversal > 0) {
    await postPurchaseJournal(tx, {
      actorId: input.actorId,
      amount: split.payableReversal,
      idempotencyKey: `order:${input.orderId}:return:payable`,
      memo: `Purchase return payable reversal for ${purchaseOrder.orderNumber}`,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      sourceId: String(input.orderId),
      sourceType: "purchase_return",
      transactionDate: localDateString(input.returnedAt),
      transactionType: "purchase_return_due",
    });
  }
  if (split.refundReceivable > 0) {
    await postPurchaseJournal(tx, {
      actorId: input.actorId,
      amount: split.refundReceivable,
      idempotencyKey: `order:${input.orderId}:return:paid`,
      memo: `Purchase return refund due for ${purchaseOrder.orderNumber}`,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      sourceId: String(input.orderId),
      sourceType: "purchase_return",
      transactionDate: localDateString(input.returnedAt),
      transactionType: "purchase_return_paid",
    });
    await tx
      .update(payment)
      .set({ status: "refund_pending", updatedAt: input.returnedAt })
      .where(
        and(
          eq(payment.orderId, input.orderId),
          eq(payment.entryType, "payment"),
          eq(payment.status, "completed"),
        ),
      );
  }

  await tx
    .update(order)
    .set({
      dueAmount: Math.max(0, Number(purchaseOrder.dueAmount) - split.payableReversal).toFixed(2),
      returnAmount: returnValue.toFixed(2),
      status: "returned",
      updatedAt: input.returnedAt,
    })
    .where(eq(order.id, input.orderId));
  await appendOrderPurchaseEvent(tx, {
    actorId: input.actorId,
    amount: returnValue,
    category: "purchase",
    description: input.reason
      ? `Received purchase returned: ${input.reason}`
      : "Received purchase returned",
    eventType: "return_processed",
    fromState: "received",
    idempotencyKey: `order:${input.orderId}:return:processed`,
    metadata: split,
    orderId: input.orderId,
    ownerId: input.ownerId,
    reference: purchaseOrder.orderNumber,
    toState: "returned",
  });
  if (split.refundReceivable > 0) {
    await appendOrderPurchaseEvent(tx, {
      actorId: input.actorId,
      amount: split.refundReceivable,
      category: "payment",
      description: "Supplier refund requested for returned products",
      eventType: "refund_requested",
      fromState: "completed",
      idempotencyKey: `order:${input.orderId}:return:refund-requested`,
      orderId: input.orderId,
      ownerId: input.ownerId,
      reference: purchaseOrder.orderNumber,
      toState: "refund_pending",
    });
  }

  return split;
}
