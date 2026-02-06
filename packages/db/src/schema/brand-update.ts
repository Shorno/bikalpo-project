import { boolean, pgTable, serial, text } from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

export const brandUpdate = pgTable("brand_update", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").default("info"), // info, warning, new, offer
    active: boolean("active").default(true),
    ...timestamps,
});

export type BrandUpdate = typeof brandUpdate.$inferSelect;
export type NewBrandUpdate = typeof brandUpdate.$inferInsert;
