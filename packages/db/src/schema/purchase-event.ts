import { relations } from "drizzle-orm";
import {
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { order } from "./order";
import { purchase } from "./purchase";

export const purchaseEventSourceEnum = pgEnum("purchase_event_source", [
  "platform_order",
  "manual_purchase",
]);

export const purchaseEventCategoryEnum = pgEnum("purchase_event_category", [
  "purchase",
  "payment",
  "inventory",
  "accounting",
  "communication",
]);

export const purchaseEventTypeEnum = pgEnum("purchase_event_type", [
  "draft_created",
  "verification_passed",
  "verification_on_hold",
  "checkout_confirmed",
  "submitted",
  "otp_verified",
  "accepted",
  "payment_initiated",
  "payment_completed",
  "payment_failed",
  "advance_recorded",
  "partially_received",
  "received",
  "inventory_recognized",
  "payable_created",
  "advance_applied",
  "payment_settled",
  "cancelled",
  "refund_requested",
  "refund_verified",
  "refund_approved",
  "refund_processed",
  "refund_completed",
  "return_processed",
  "accounting_posted",
  "communication_recorded",
]);

/** Immutable audit event for either a platform or manually entered purchase. */
export const purchaseEvent = pgTable(
  "purchase_event",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceType: purchaseEventSourceEnum("source_type").notNull(),
    orderId: integer("order_id").references(() => order.id, {
      onDelete: "cascade",
    }),
    purchaseId: integer("purchase_id").references(() => purchase.id, {
      onDelete: "cascade",
    }),
    category: purchaseEventCategoryEnum("category").notNull(),
    eventType: purchaseEventTypeEnum("event_type").notNull(),
    fromState: varchar("from_state", { length: 50 }),
    toState: varchar("to_state", { length: 50 }),
    amount: decimal("amount", { precision: 14, scale: 2 }),
    reference: varchar("reference", { length: 180 }),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    idempotencyKey: varchar("idempotency_key", { length: 180 }).notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("purchaseEvent_owner_idempotency_unique").on(
      table.ownerId,
      table.idempotencyKey,
    ),
    index("purchaseEvent_order_idx").on(table.orderId, table.occurredAt),
    index("purchaseEvent_purchase_idx").on(
      table.purchaseId,
      table.occurredAt,
    ),
    index("purchaseEvent_owner_idx").on(table.ownerId, table.occurredAt),
    index("purchaseEvent_category_idx").on(table.category, table.eventType),
  ],
);

export const purchaseEventRelations = relations(purchaseEvent, ({ one }) => ({
  actor: one(user, {
    fields: [purchaseEvent.actorId],
    references: [user.id],
    relationName: "purchaseEventActor",
  }),
  order: one(order, {
    fields: [purchaseEvent.orderId],
    references: [order.id],
  }),
  owner: one(user, {
    fields: [purchaseEvent.ownerId],
    references: [user.id],
    relationName: "purchaseEventOwner",
  }),
  purchase: one(purchase, {
    fields: [purchaseEvent.purchaseId],
    references: [purchase.id],
  }),
}));

export type PurchaseEvent = typeof purchaseEvent.$inferSelect;
export type NewPurchaseEvent = typeof purchaseEvent.$inferInsert;
