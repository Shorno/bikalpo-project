import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

/**
 * Create Product "Variant Attribute" choices (Type, Size,
 * Colour...) and the options each one offers. Seeded from the client's
 * layout; Admin can add more.
 */
export const variantAttribute = pgTable("variant_attribute", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  options: jsonb("options").$type<string[]>().default([]).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

export type VariantAttribute = typeof variantAttribute.$inferSelect;
