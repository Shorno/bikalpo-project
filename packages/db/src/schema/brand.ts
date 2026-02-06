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
    logo: varchar("logo", { length: 255 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order").default(0).notNull(),
    ...timestamps,
});

export type Brand = typeof brand.$inferSelect;
export type NewBrand = typeof brand.$inferInsert;
