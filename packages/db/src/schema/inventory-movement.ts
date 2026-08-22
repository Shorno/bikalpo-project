import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { inventoryOwnerTypeEnum } from "./inventory";
import { order, orderItem } from "./order";
import { productVariant } from "./product-variant";
import { purchase, purchaseItem } from "./purchase";

export const inventoryMovementDirectionEnum = pgEnum(
  "inventory_movement_direction",
  ["in", "out"],
);

export const inventoryMovementReasonEnum = pgEnum(
  "inventory_movement_reason",
  [
    "purchase_receipt",
    "purchase_return",
    "purchase_reversal",
    "sale_fulfillment",
    "sale_return",
    "manual_adjustment",
  ],
);

/** Immutable quantity and valuation audit trail for inventory changes. */
export const inventoryMovement = pgTable(
  "inventory_movement",
  {
    id: serial("id").primaryKey(),
    ownerType: inventoryOwnerTypeEnum("owner_type").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "restrict" }),
    direction: inventoryMovementDirectionEnum("direction").notNull(),
    reason: inventoryMovementReasonEnum("reason").notNull(),
    quantity: decimal("quantity", { precision: 14, scale: 4 }).notNull(),
    unit: varchar("unit", { length: 30 }).notNull(),
    unitCost: decimal("unit_cost", { precision: 14, scale: 4 }),
    totalCost: decimal("total_cost", { precision: 14, scale: 2 }),
    quantityBefore: decimal("quantity_before", { precision: 14, scale: 4 }),
    quantityAfter: decimal("quantity_after", { precision: 14, scale: 4 }),
    orderId: integer("order_id").references(() => order.id, {
      onDelete: "set null",
    }),
    orderItemId: integer("order_item_id").references(() => orderItem.id, {
      onDelete: "set null",
    }),
    purchaseId: integer("purchase_id").references(() => purchase.id, {
      onDelete: "set null",
    }),
    purchaseItemId: integer("purchase_item_id").references(
      () => purchaseItem.id,
      { onDelete: "set null" },
    ),
    reversesMovementId: integer("reverses_movement_id").references(
      (): AnyPgColumn => inventoryMovement.id,
      { onDelete: "set null" },
    ),
    reference: varchar("reference", { length: 180 }),
    note: text("note"),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("inventoryMovement_owner_idempotency_unique").on(
      table.ownerId,
      table.idempotencyKey,
    ),
    index("inventoryMovement_owner_variant_idx").on(
      table.ownerType,
      table.ownerId,
      table.variantId,
      table.occurredAt,
    ),
    index("inventoryMovement_order_idx").on(table.orderId, table.occurredAt),
    index("inventoryMovement_purchase_idx").on(
      table.purchaseId,
      table.occurredAt,
    ),
  ],
);

export const inventoryMovementRelations = relations(
  inventoryMovement,
  ({ one }) => ({
    creator: one(user, {
      fields: [inventoryMovement.createdById],
      references: [user.id],
    }),
    order: one(order, {
      fields: [inventoryMovement.orderId],
      references: [order.id],
    }),
    orderItem: one(orderItem, {
      fields: [inventoryMovement.orderItemId],
      references: [orderItem.id],
    }),
    owner: one(user, {
      fields: [inventoryMovement.ownerId],
      references: [user.id],
    }),
    purchase: one(purchase, {
      fields: [inventoryMovement.purchaseId],
      references: [purchase.id],
    }),
    purchaseItem: one(purchaseItem, {
      fields: [inventoryMovement.purchaseItemId],
      references: [purchaseItem.id],
    }),
    reversedMovement: one(inventoryMovement, {
      fields: [inventoryMovement.reversesMovementId],
      references: [inventoryMovement.id],
    }),
    variant: one(productVariant, {
      fields: [inventoryMovement.variantId],
      references: [productVariant.id],
    }),
  }),
);

export type InventoryMovement = typeof inventoryMovement.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovement.$inferInsert;
