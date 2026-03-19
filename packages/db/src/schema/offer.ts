import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const offer = pgTable("offer", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 100 }).default("Weekly Offers").notNull(), // Weekly Offers, Combo Deals, Brand Campaigns, More Offers
  discountPercentage: integer("discount_percentage").notNull(),
  originalPrice: integer("original_price"), // Store price in cents/smallest unit
  comboPrice: integer("combo_price"), // Final combo price
  imageUrl: text("image_url"), // Legacy image column kept for backwards compatibility
  bannerImage: text("banner_image"),
  products: text("products"), // JSON array of product names/IDs
  targetProducts: text("target_products"), // Kept for backwards compatibility
  active: boolean("active").default(true),
  startDate: varchar("start_date", { length: 20 }),
  endDate: varchar("end_date", { length: 20 }),
  priority: integer("priority").default(0),
  badge: varchar("badge", { length: 100 }),
  /** Area IDs this offer targets (null = all areas) */
  targetAreaIds: jsonb("target_area_ids").$type<number[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Offer = typeof offer.$inferSelect;
export type NewOffer = typeof offer.$inferInsert;
