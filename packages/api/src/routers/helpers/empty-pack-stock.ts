import type { db } from "@bikalpo-project/db";
import {
  emptyPackMovement,
  emptyPackStock,
  orderItem,
} from "@bikalpo-project/db/schema";
import { and, eq, sql } from "drizzle-orm";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type EmptyPackOwnerType = "shop" | "warehouse";

export function warehouseExchangeEmptyCreditQty(line: {
  cylinderSaleMode?: string | null;
  modifiedQty?: number | null;
  quantity: number;
}) {
  if (line.cylinderSaleMode !== "exchange") return 0;
  return line.modifiedQty ?? line.quantity;
}

/**
 * Adds the empty cylinder received for an Exchange exactly once per order line.
 * The filled cylinder is handled by the normal inventory reservation/consume flow.
 */
export async function creditExchangeEmptyPack(
  tx: DbTransaction,
  input: {
    ownerType: EmptyPackOwnerType;
    ownerId: string;
    orderId: number;
    orderItemId: number;
    variantId: number | null;
    quantity: number;
    actorId?: string | null;
    notes?: string;
  },
) {
  if (!input.variantId || input.quantity <= 0) return false;
  const sourceKey = `exchange:${input.ownerType}:${input.ownerId}:${input.orderItemId}`;
  const inserted = await tx
    .insert(emptyPackMovement)
    .values({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      variantId: input.variantId,
      movementType: "exchange_in",
      quantity: input.quantity,
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      sourceKey,
      notes: input.notes ?? "Empty cylinder received through Exchange sale",
      createdBy: input.actorId ?? null,
    })
    .onConflictDoNothing({ target: emptyPackMovement.sourceKey })
    .returning({ id: emptyPackMovement.id });

  if (inserted.length === 0) return false;

  await tx
    .insert(emptyPackStock)
    .values({
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      variantId: input.variantId,
      availableQty: input.quantity,
    })
    .onConflictDoUpdate({
      target: [
        emptyPackStock.ownerType,
        emptyPackStock.ownerId,
        emptyPackStock.variantId,
      ],
      set: {
        availableQty: sql`${emptyPackStock.availableQty} + ${input.quantity}`,
        updatedAt: new Date(),
      },
    });
  return true;
}

/** Credits every Exchange line once after a B2B order is completely delivered. */
export async function creditWarehouseExchangeOrder(
  tx: DbTransaction,
  input: { warehouseId: string; orderId: number; actorId?: string | null },
) {
  await creditOwnerExchangeOrder(tx, {
    ownerType: "warehouse",
    ownerId: input.warehouseId,
    orderId: input.orderId,
    actorId: input.actorId,
  });
}

/** Credits every Exchange line once after a B2C order is completely delivered. */
export async function creditRetailerExchangeOrder(
  tx: DbTransaction,
  input: { shopId: string; orderId: number; actorId?: string | null },
) {
  await creditOwnerExchangeOrder(tx, {
    ownerType: "shop",
    ownerId: input.shopId,
    orderId: input.orderId,
    actorId: input.actorId,
  });
}

async function creditOwnerExchangeOrder(
  tx: DbTransaction,
  input: {
    ownerType: EmptyPackOwnerType;
    ownerId: string;
    orderId: number;
    actorId?: string | null;
  },
) {
  const lines = await tx.query.orderItem.findMany({
    where: and(
      eq(orderItem.orderId, input.orderId),
      eq(orderItem.cylinderSaleMode, "exchange"),
    ),
  });
  for (const line of lines) {
    await creditExchangeEmptyPack(tx, {
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      orderId: input.orderId,
      orderItemId: line.id,
      variantId: line.variantId,
      quantity: warehouseExchangeEmptyCreditQty(line),
      actorId: input.actorId,
    });
  }
}
