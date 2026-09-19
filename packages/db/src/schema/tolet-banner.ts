import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const toletBanner = pgTable("tolet_banner", {
  id: text("id").primaryKey(),
  slides: jsonb("slides").$type<{ title: string; imageUrl: string; link: string }[]>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
