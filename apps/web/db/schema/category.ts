import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "@/db/schema/columns.helpers";

export const category = pgTable("category", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  image: varchar("image", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  ...timestamps,
});

export const subCategory = pgTable("sub_category", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => category.id, { onDelete: "cascade" }),
  image: varchar("image", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  ...timestamps,
});

export const categoryRelations = relations(category, ({ many }) => ({
  subCategory: many(subCategory),
}));

export const subCategoryRelations = relations(subCategory, ({ one }) => ({
  category: one(category, {
    fields: [subCategory.categoryId],
    references: [category.id],
  }),
}));

export type Category = typeof category.$inferSelect;
export type SubCategory = typeof subCategory.$inferSelect;
