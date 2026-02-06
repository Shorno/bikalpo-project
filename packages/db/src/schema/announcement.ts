import { boolean, pgTable, serial, text } from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";

export const announcement = pgTable("announcement", {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    type: text("type").default("info"), // info, warning, success, alert
    active: boolean("active").default(true),
    ...timestamps,
});

export type Announcement = typeof announcement.$inferSelect;
export type NewAnnouncement = typeof announcement.$inferInsert;
