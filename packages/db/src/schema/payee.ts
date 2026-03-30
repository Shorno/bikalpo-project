import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";

/**
 * Payee — external entities that receive payments (landlords, utility companies, etc.)
 * NOT a system user. No login, no dashboard access.
 * Used for associating expenses with specific payees.
 */
export const payee = pgTable(
    "payee",
    {
        id: serial("id").primaryKey(),
        name: varchar("name", { length: 150 }).notNull(),
        contactPerson: varchar("contact_person", { length: 150 }),
        phone: varchar("phone", { length: 20 }).notNull(),
        email: varchar("email", { length: 150 }),
        address: text("address"),
        notes: text("notes"),

        /** Who added this payee (warehouse/shop/restaurant owner) */
        addedBy: text("added_by")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        isActive: boolean("is_active").default(true).notNull(),

        ...timestamps,
    },
    (table) => [
        index("payee_addedBy_idx").on(table.addedBy),
    ],
);

export const payeeRelations = relations(payee, ({ one }) => ({
    addedByUser: one(user, {
        fields: [payee.addedBy],
        references: [user.id],
    }),
}));

export type Payee = typeof payee.$inferSelect;
export type NewPayee = typeof payee.$inferInsert;
