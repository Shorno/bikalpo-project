import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

export const toletListing = pgTable("tolet_listing", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 255 }).notNull(),
  rent: numeric("rent", { precision: 12, scale: 2 }).default("0").notNull(),
  area: varchar("area", { length: 100 }),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  contactInfo: varchar("contact_info", { length: 255 }).notNull(),
  imageUrl: varchar("image_url", { length: 1024 }),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export type ToletListing = typeof toletListing.$inferSelect;
export type NewToletListing = typeof toletListing.$inferInsert;
