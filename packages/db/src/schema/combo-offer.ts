import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const comboOffer = pgTable("combo_offer", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).default("Weekly Offers"), // Weekly Offers, Combo Deals, Brand Campaigns, More Offers
  bannerImage: text("banner_image"),
  discountPercentage: integer("discount_percentage").notNull(),
  originalPrice: integer("original_price"), // Store price in cents/smallest unit
  comboPrice: integer("combo_price").notNull(),
  products: text("products").notNull(), // JSON array of product IDs with quantities
  active: boolean("active").default(true),
  startDate: varchar("start_date", { length: 20 }),
  endDate: varchar("end_date", { length: 20 }),
  priority: integer("priority").default(0),
  badge: varchar("badge", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ComboOffer = typeof comboOffer.$inferSelect;
export type NewComboOffer = typeof comboOffer.$inferInsert;
