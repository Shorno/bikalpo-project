import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

export const customerHomeTab = pgTable("customer_home_tab", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  slug: varchar("slug", { length: 150 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  ...timestamps,
});

export const customerHomeTabProduct = pgTable("customer_home_tab_product", {
  id: serial("id").primaryKey(),
  tabId: integer("tab_id")
    .notNull()
    .references(() => customerHomeTab.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  image: varchar("image", { length: 255 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  ...timestamps,
});

export const customerHomeTabRelations = relations(
  customerHomeTab,
  ({ many }) => ({
    products: many(customerHomeTabProduct),
  }),
);

export const customerHomeTabProductRelations = relations(
  customerHomeTabProduct,
  ({ one }) => ({
    tab: one(customerHomeTab, {
      fields: [customerHomeTabProduct.tabId],
      references: [customerHomeTab.id],
    }),
  }),
);

export type CustomerHomeTab = typeof customerHomeTab.$inferSelect;
export type NewCustomerHomeTab = typeof customerHomeTab.$inferInsert;
export type CustomerHomeTabProduct = typeof customerHomeTabProduct.$inferSelect;
export type NewCustomerHomeTabProduct =
  typeof customerHomeTabProduct.$inferInsert;
