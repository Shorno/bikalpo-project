import {
  inventoryMovement,
  purchaseEvent,
  type purchaseEventCategoryEnum,
  type purchaseEventTypeEnum,
} from "@bikalpo-project/db/schema";

type PurchaseEventCategory =
  (typeof purchaseEventCategoryEnum.enumValues)[number];
type PurchaseEventType = (typeof purchaseEventTypeEnum.enumValues)[number];

export async function appendOrderPurchaseEvent(
  tx: any,
  input: {
    actorId?: string | null;
    amount?: number | null;
    category: PurchaseEventCategory;
    description?: string | null;
    eventType: PurchaseEventType;
    fromState?: string | null;
    idempotencyKey: string;
    metadata?: Record<string, unknown> | null;
    occurredAt?: Date;
    orderId: number;
    ownerId: string;
    reference?: string | null;
    toState?: string | null;
  },
) {
  const [created] = await tx
    .insert(purchaseEvent)
    .values({
      actorId: input.actorId ?? null,
      amount:
        input.amount === null || input.amount === undefined
          ? null
          : input.amount.toFixed(2),
      category: input.category,
      description: input.description ?? null,
      eventType: input.eventType,
      fromState: input.fromState ?? null,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      orderId: input.orderId,
      ownerId: input.ownerId,
      purchaseId: null,
      reference: input.reference ?? null,
      sourceType: "platform_order",
      toState: input.toState ?? null,
    })
    .onConflictDoNothing({
      target: [purchaseEvent.ownerId, purchaseEvent.idempotencyKey],
    })
    .returning();

  return created ?? null;
}

export async function recordPurchaseSubmission(
  tx: any,
  input: {
    actorId: string;
    idempotencyPrefix: string;
    orderId: number;
    orderNumber: string;
    ownerId: string;
    occurredAt?: Date;
  },
) {
  const common = {
    actorId: input.actorId,
    category: "purchase" as const,
    occurredAt: input.occurredAt,
    orderId: input.orderId,
    ownerId: input.ownerId,
    reference: input.orderNumber,
  };

  await appendOrderPurchaseEvent(tx, {
    ...common,
    eventType: "draft_created",
    idempotencyKey: `${input.idempotencyPrefix}:draft`,
    toState: "draft",
  });
  await appendOrderPurchaseEvent(tx, {
    ...common,
    eventType: "checkout_confirmed",
    fromState: "draft",
    idempotencyKey: `${input.idempotencyPrefix}:checkout`,
    toState: "checkout",
  });
  await appendOrderPurchaseEvent(tx, {
    ...common,
    eventType: "submitted",
    fromState: "checkout",
    idempotencyKey: `${input.idempotencyPrefix}:submitted`,
    toState: "submitted",
  });
}

export async function appendPurchaseInventoryMovement(
  tx: any,
  input: {
    createdById?: string | null;
    idempotencyKey: string;
    orderId: number;
    orderItemId: number;
    ownerId: string;
    ownerType: "shop" | "warehouse";
    quantity: number;
    quantityAfter?: number | null;
    reason?: "purchase_receipt" | "purchase_return" | "purchase_reversal";
    reference?: string | null;
    totalCost: number;
    unit: string;
    unitCost: number;
    variantId: number;
  },
) {
  if (input.quantity <= 0) return null;

  const quantityAfter = input.quantityAfter ?? null;
  const quantityBefore =
    quantityAfter === null ? null : Math.max(0, quantityAfter - input.quantity);
  const direction = input.reason === "purchase_receipt" || !input.reason
    ? "in"
    : "out";

  const [created] = await tx
    .insert(inventoryMovement)
    .values({
      createdById: input.createdById ?? null,
      direction,
      idempotencyKey: input.idempotencyKey,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      quantity: input.quantity.toFixed(4),
      quantityAfter: quantityAfter?.toFixed(4) ?? null,
      quantityBefore: quantityBefore?.toFixed(4) ?? null,
      reason: input.reason ?? "purchase_receipt",
      reference: input.reference ?? null,
      totalCost: input.totalCost.toFixed(2),
      unit: input.unit,
      unitCost: input.unitCost.toFixed(4),
      variantId: input.variantId,
    })
    .onConflictDoNothing({
      target: [inventoryMovement.ownerId, inventoryMovement.idempotencyKey],
    })
    .returning();

  return created ?? null;
}
