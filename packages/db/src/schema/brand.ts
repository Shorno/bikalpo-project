import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { timestamps } from "./columns.helpers";

/** Owner of a store-only catalog row (brand or variant option). */
export type CatalogOwnerType = "shop" | "warehouse";

export const brand = pgTable("brand", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  /** Unique among global brands and within each store (partial indexes). */
  slug: varchar("slug", { length: 100 }).notNull(),
  logo: varchar("logo", { length: 255 }),

  /** Auto-generated 2-digit SKU code (e.g. "01", "02"). Immutable after creation. */
  skuCode: varchar("sku_code", { length: 2 }).unique(),

  /** Short letter code used in sellable SKUs (e.g. "OMR"). Locked once a SKU uses it. */
  shortCode: varchar("short_code", { length: 8 }).unique(),

  /** Disabled brands remain visible on existing products but cannot be newly associated. */
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),

  /**
   * Store-only brand: created by a shop or warehouse and visible only to it.
   * Both null for global (admin) brands. Store brands take no skuCode.
   */
  ownerType: varchar("owner_type", { length: 20 }).$type<CatalogOwnerType>(),
  ownerId: text("owner_id").references(() => user.id, { onDelete: "cascade" }),
  ...timestamps,
});

export type Brand = typeof brand.$inferSelect;
export type NewBrand = typeof brand.$inferInsert;
