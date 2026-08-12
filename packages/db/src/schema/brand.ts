import {
  boolean,
  integer,
  pgTable,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

export const brand = pgTable("brand", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  logo: varchar("logo", { length: 255 }),

  /** Auto-generated 2-digit SKU code (e.g. "01", "02"). Immutable after creation. */
  skuCode: varchar("sku_code", { length: 2 }).unique(),

  /** Disabled brands remain visible on existing products but cannot be newly associated. */
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  ...timestamps,
});

export type Brand = typeof brand.$inferSelect;
export type NewBrand = typeof brand.$inferInsert;
