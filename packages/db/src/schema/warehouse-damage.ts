import { relations } from "drizzle-orm";
import {
  date,
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
import { carton } from "./carton";
import { inventory } from "./inventory";
import { productVariant } from "./product-variant";
import { stockEntry } from "./stock-entry";

export const warehouseDamageTypeEnum = pgEnum("warehouse_damage_type", [
  "physical",
  "expired",
  "lost",
]);

export const warehouseDamageModeEnum = pgEnum("warehouse_damage_mode", [
  "loose",
  "pack",
  "carton",
  "direct",
]);

export const warehouseDamageStatusEnum = pgEnum("warehouse_damage_status", [
  "draft",
  "posted",
  "reversed",
]);

export type WarehouseDamageDraftPayload = {
  damageType: "physical" | "expired" | "lost";
  damageMode: "loose" | "pack" | "carton" | "direct";
  description?: string;
  proofImages: string[];
  entryDate: string;
  items: Array<{
    inventoryId: number;
    cartonId?: number;
    stockEntryId?: number;
    quantity?: number;
    note?: string;
  }>;
};

/**
 * A warehouse stock write-off record. Drafts have no stock effect; posted
 * quantities are immutable, and reversal restores inventory atomically.
 */
export const warehouseDamageEntry = pgTable(
  "warehouse_damage_entry",
  {
    id: serial("id").primaryKey(),
    entryNo: varchar("entry_no", { length: 30 }).notNull(),
    requestKey: varchar("request_key", { length: 64 }).notNull(),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    damageType: warehouseDamageTypeEnum("damage_type").notNull(),
    damageMode: warehouseDamageModeEnum("damage_mode").notNull(),
    description: text("description"),
    proofImages: text("proof_images").array().default([]).notNull(),
    draftPayload: jsonb(
      "draft_payload",
    ).$type<WarehouseDamageDraftPayload | null>(),
    totalLossValue: decimal("total_loss_value", {
      precision: 14,
      scale: 2,
    })
      .default("0")
      .notNull(),
    entryDate: date("entry_date").notNull(),
    status: warehouseDamageStatusEnum("status").default("posted").notNull(),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdByName: text("created_by_name").notNull(),
    reversedAt: timestamp("reversed_at"),
    reversedById: text("reversed_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    reversalReason: text("reversal_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("warehouseDamage_entryNo_uq").on(table.entryNo),
    uniqueIndex("warehouseDamage_requestKey_uq").on(table.requestKey),
    index("warehouseDamage_warehouseDate_idx").on(
      table.warehouseId,
      table.entryDate,
    ),
    index("warehouseDamage_type_idx").on(table.damageType),
    index("warehouseDamage_mode_idx").on(table.damageMode),
    index("warehouseDamage_status_idx").on(table.status),
  ],
);

/** Immutable operational and acquisition-cost snapshot for one damaged source. */
export const warehouseDamageItem = pgTable(
  "warehouse_damage_item",
  {
    id: serial("id").primaryKey(),
    damageEntryId: integer("damage_entry_id")
      .notNull()
      .references(() => warehouseDamageEntry.id, { onDelete: "cascade" }),
    inventoryId: integer("inventory_id")
      .notNull()
      .references(() => inventory.id, { onDelete: "restrict" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => productVariant.id, { onDelete: "restrict" }),
    stockEntryId: integer("stock_entry_id").references(() => stockEntry.id, {
      onDelete: "set null",
    }),
    cartonId: integer("carton_id").references(() => carton.id, {
      onDelete: "restrict",
    }),
    quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
    quantityUnit: varchar("quantity_unit", { length: 30 }).notNull(),
    cartonCount: integer("carton_count").default(0).notNull(),
    sourceTotalWeightKg: decimal("source_total_weight_kg", {
      precision: 12,
      scale: 2,
    }),
    unitCost: decimal("unit_cost", { precision: 14, scale: 4 }).notNull(),
    totalValue: decimal("total_value", { precision: 14, scale: 2 }).notNull(),
    costingMethod: varchar("costing_method", { length: 40 })
      .default("batch_acquisition_cost")
      .notNull(),
    currency: varchar("currency", { length: 3 }).default("BDT").notNull(),
    skuSnapshot: varchar("sku_snapshot", { length: 100 }),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    brandNameSnapshot: text("brand_name_snapshot"),
    variantLabelSnapshot: text("variant_label_snapshot").notNull(),
    sourceLabelSnapshot: text("source_label_snapshot"),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("warehouseDamageItem_entry_idx").on(table.damageEntryId),
    index("warehouseDamageItem_variant_idx").on(table.variantId),
    index("warehouseDamageItem_stockEntry_idx").on(table.stockEntryId),
    index("warehouseDamageItem_carton_idx").on(table.cartonId),
  ],
);

export const warehouseDamageEntryRelations = relations(
  warehouseDamageEntry,
  ({ one, many }) => ({
    warehouse: one(user, {
      fields: [warehouseDamageEntry.warehouseId],
      references: [user.id],
      relationName: "warehouseDamageOwner",
    }),
    createdBy: one(user, {
      fields: [warehouseDamageEntry.createdById],
      references: [user.id],
      relationName: "warehouseDamageCreator",
    }),
    reversedBy: one(user, {
      fields: [warehouseDamageEntry.reversedById],
      references: [user.id],
      relationName: "warehouseDamageReverser",
    }),
    items: many(warehouseDamageItem),
    movements: many(warehouseDamageMovement),
  }),
);

export const warehouseDamageItemRelations = relations(
  warehouseDamageItem,
  ({ one, many }) => ({
    damageEntry: one(warehouseDamageEntry, {
      fields: [warehouseDamageItem.damageEntryId],
      references: [warehouseDamageEntry.id],
    }),
    inventory: one(inventory, {
      fields: [warehouseDamageItem.inventoryId],
      references: [inventory.id],
    }),
    variant: one(productVariant, {
      fields: [warehouseDamageItem.variantId],
      references: [productVariant.id],
    }),
    stockEntry: one(stockEntry, {
      fields: [warehouseDamageItem.stockEntryId],
      references: [stockEntry.id],
    }),
    carton: one(carton, {
      fields: [warehouseDamageItem.cartonId],
      references: [carton.id],
    }),
    movements: many(warehouseDamageMovement),
  }),
);

/** Append-only audit of the stock movement created by posting or reversing damage. */
export const warehouseDamageMovement = pgTable(
  "warehouse_damage_movement",
  {
    id: serial("id").primaryKey(),
    damageEntryId: integer("damage_entry_id")
      .notNull()
      .references(() => warehouseDamageEntry.id, { onDelete: "restrict" }),
    damageItemId: integer("damage_item_id")
      .notNull()
      .references(() => warehouseDamageItem.id, { onDelete: "restrict" }),
    warehouseId: text("warehouse_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    inventoryId: integer("inventory_id")
      .notNull()
      .references(() => inventory.id, { onDelete: "restrict" }),
    cartonId: integer("carton_id").references(() => carton.id, {
      onDelete: "restrict",
    }),
    movementKind: varchar("movement_kind", { length: 20 })
      .$type<"damage" | "reversal">()
      .notNull(),
    quantityDelta: decimal("quantity_delta", {
      precision: 12,
      scale: 2,
    }).notNull(),
    quantityUnit: varchar("quantity_unit", { length: 30 }).notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorName: text("actor_name").notNull(),
    approvedById: text("approved_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at").defaultNow().notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("warehouseDamageMovement_entryItemKind_uq").on(
      table.damageEntryId,
      table.damageItemId,
      table.movementKind,
    ),
    index("warehouseDamageMovement_warehouse_idx").on(table.warehouseId),
    index("warehouseDamageMovement_inventory_idx").on(table.inventoryId),
  ],
);

export const warehouseDamageMovementRelations = relations(
  warehouseDamageMovement,
  ({ one }) => ({
    damageEntry: one(warehouseDamageEntry, {
      fields: [warehouseDamageMovement.damageEntryId],
      references: [warehouseDamageEntry.id],
    }),
    damageItem: one(warehouseDamageItem, {
      fields: [warehouseDamageMovement.damageItemId],
      references: [warehouseDamageItem.id],
    }),
    inventory: one(inventory, {
      fields: [warehouseDamageMovement.inventoryId],
      references: [inventory.id],
    }),
    carton: one(carton, {
      fields: [warehouseDamageMovement.cartonId],
      references: [carton.id],
    }),
  }),
);

export type WarehouseDamageEntry = typeof warehouseDamageEntry.$inferSelect;
export type WarehouseDamageItem = typeof warehouseDamageItem.$inferSelect;
export type WarehouseDamageMovement =
  typeof warehouseDamageMovement.$inferSelect;
