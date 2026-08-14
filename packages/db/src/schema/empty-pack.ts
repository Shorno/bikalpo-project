import { relations, sql } from "drizzle-orm";
import {
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { brand } from "./brand";
import { deliveryGroupInvoice } from "./delivery";
import { inventoryOwnerTypeEnum } from "./inventory";
import { invoice } from "./invoice";
import { order, orderItem } from "./order";
import { productVariant } from "./product-variant";

// Empty pack status enum
export const emptyPackStatusEnum = pgEnum("empty_pack_status", [
  "collected", // Deliveryman collected from customer
  "submitted", // Deliveryman submitted to godown/supervisor
  "verified", // Supervisor verified count
  "rejected", // Supervisor found discrepancy
]);

export const emptyPackMovementTypeEnum = pgEnum("empty_pack_movement_type", [
  "exchange_in",
  "damage",
  "supplier_return",
  "sale_application",
]);

/** Live empty-container balance. Full/sellable stock always stays in inventory. */
export const emptyPackStock = pgTable(
  "empty_pack_stock",
  {
    id: serial("id").primaryKey(),
    ownerType: inventoryOwnerTypeEnum("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    availableQty: integer("available_qty").default(0).notNull(),
    damagedQty: integer("damaged_qty").default(0).notNull(),
    returnedQty: integer("returned_qty").default(0).notNull(),
    appliedToSalesQty: integer("applied_to_sales_qty").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("emptyPackStock_ownerVariant_unique").on(
      table.ownerType,
      table.ownerId,
      table.variantId,
    ),
    index("emptyPackStock_owner_idx").on(table.ownerType, table.ownerId),
  ],
);

/** Immutable audit trail for every empty-container balance change. */
export const emptyPackMovement = pgTable(
  "empty_pack_movement",
  {
    id: serial("id").primaryKey(),
    ownerType: inventoryOwnerTypeEnum("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "cascade" }),
    movementType: emptyPackMovementTypeEnum("movement_type").notNull(),
    quantity: integer("quantity").notNull(),
    orderId: integer("order_id").references(() => order.id, {
      onDelete: "set null",
    }),
    orderItemId: integer("order_item_id").references(() => orderItem.id, {
      onDelete: "set null",
    }),
    sourceKey: text("source_key"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("emptyPackMovement_owner_idx").on(table.ownerType, table.ownerId),
    index("emptyPackMovement_variant_idx").on(table.variantId),
    uniqueIndex("emptyPackMovement_sourceKey_unique").on(table.sourceKey),
  ],
);

/**
 * Tracks empty pack (bottle/jar/can/sack) returns collected during delivery.
 * Each row = one type of pack collected from one delivery stop.
 */
export const emptyPack = pgTable(
  "empty_pack",
  {
    id: serial("id").primaryKey(),

    /** Which delivery stop this pack was collected from */
    deliveryGroupInvoiceId: integer("delivery_group_invoice_id").references(
      () => deliveryGroupInvoice.id,
      { onDelete: "cascade" },
    ),

    /** Retailer that owns this empty-pack stock. */
    shopId: text("shop_id").references(() => user.id, {
      onDelete: "cascade",
    }),

    /** Retailer invoice completed by delivery or self-pickup. */
    invoiceId: integer("invoice_id").references(() => invoice.id, {
      onDelete: "cascade",
    }),

    /** Source cylinder order line; one settlement record per line. */
    orderItemId: integer("order_item_id").references(() => orderItem.id, {
      onDelete: "set null",
    }),

    /** Product variant the pack belongs to (e.g., IFAD 5L Jar) */
    variantId: integer("variant_id").references(() => productVariant.id, {
      onDelete: "set null",
    }),

    /** Brand of the empty pack */
    brandId: integer("brand_id").references(() => brand.id, {
      onDelete: "set null",
    }),

    /** Pack type description (e.g., "5L Jar", "1L Bottle") */
    packDescription: text("pack_description"),

    /** How many empty packs collected */
    quantityCollected: integer("quantity_collected").notNull().default(0),

    /** Photo proof of collected packs */
    photoProof: text("photo_proof"),

    /** Current status */
    status: emptyPackStatusEnum("status").default("collected").notNull(),

    /** Supervisor who received the packs */
    submittedTo: text("submitted_to").references(() => user.id, {
      onDelete: "set null",
    }),

    /** Supervisor who verified the count */
    verifiedBy: text("verified_by").references(() => user.id, {
      onDelete: "set null",
    }),

    /** Deposit amount charged if pack not returned */
    depositAmount: decimal("deposit_amount", {
      precision: 10,
      scale: 2,
    })
      .default("0")
      .notNull(),

    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    submittedAt: timestamp("submitted_at"),
    verifiedAt: timestamp("verified_at"),
  },
  (table) => [
    index("emptyPack_dgiId_idx").on(table.deliveryGroupInvoiceId),
    index("emptyPack_shopId_idx").on(table.shopId),
    index("emptyPack_invoiceId_idx").on(table.invoiceId),
    index("emptyPack_orderItemId_idx").on(table.orderItemId),
    uniqueIndex("emptyPack_invoiceOrderItem_unique")
      .on(table.invoiceId, table.orderItemId)
      .where(sql`${table.orderItemId} IS NOT NULL`),
    index("emptyPack_status_idx").on(table.status),
  ],
);

// Relations
export const emptyPackRelations = relations(emptyPack, ({ one }) => ({
  deliveryGroupInvoice: one(deliveryGroupInvoice, {
    fields: [emptyPack.deliveryGroupInvoiceId],
    references: [deliveryGroupInvoice.id],
  }),
  shop: one(user, {
    fields: [emptyPack.shopId],
    references: [user.id],
  }),
  invoice: one(invoice, {
    fields: [emptyPack.invoiceId],
    references: [invoice.id],
  }),
  orderItem: one(orderItem, {
    fields: [emptyPack.orderItemId],
    references: [orderItem.id],
  }),
  variant: one(productVariant, {
    fields: [emptyPack.variantId],
    references: [productVariant.id],
  }),
  brand: one(brand, {
    fields: [emptyPack.brandId],
    references: [brand.id],
  }),
}));

// Types
export type EmptyPack = typeof emptyPack.$inferSelect;
export type NewEmptyPack = typeof emptyPack.$inferInsert;
export type EmptyPackStatus = (typeof emptyPackStatusEnum.enumValues)[number];
export type EmptyPackStock = typeof emptyPackStock.$inferSelect;
export type EmptyPackMovement = typeof emptyPackMovement.$inferSelect;
export type EmptyPackMovementType =
  (typeof emptyPackMovementTypeEnum.enumValues)[number];
