import { relations } from "drizzle-orm";
import {
    boolean,
    decimal,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";
import { category } from "./category";

/** Supplier account status */
export const supplierStatusEnum = pgEnum("supplier_status", [
    "active",
    "suspended",
]);

/**
 * Supplier — external vendors that a warehouse purchases stock from.
 * NOT a system user. No login, no dashboard access.
 * Purely a data reference layer for purchase tracking & audit.
 */
export const supplier = pgTable(
    "supplier",
    {
        id: serial("id").primaryKey(),
        name: varchar("name", { length: 150 }).notNull(),
        company: varchar("company", { length: 200 }),
        contactPerson: varchar("contact_person", { length: 150 }),
        phone: varchar("phone", { length: 20 }),
        email: varchar("email", { length: 150 }),
        address: text("address"),
        notes: text("notes"),

        /** Product category this supplier is assigned to (one supplier = one category) */
        categoryId: integer("category_id")
            .references(() => category.id, { onDelete: "set null" }),

        /** Who added this supplier (warehouse owner's userId) */
        addedBy: text("added_by")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),

        /** Credit limit for this supplier (0 = no credit) */
        creditLimit: decimal("credit_limit", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Current outstanding payable to this supplier */
        currentPayable: decimal("current_payable", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),

        /** Whether this supplier has a return pack agreement */
        returnPackAgreement: boolean("return_pack_agreement")
            .default(false)
            .notNull(),

        /** QR scan data — encoded supplier info for quick lookup */
        qrData: jsonb("qr_data"),

        status: supplierStatusEnum("status").default("active").notNull(),
        isActive: boolean("is_active").default(true).notNull(),

        ...timestamps,
    },
    (table) => [
        index("supplier_addedBy_idx").on(table.addedBy),
        index("supplier_categoryId_idx").on(table.categoryId),
    ],
);

export const supplierRelations = relations(supplier, ({ one }) => ({
    addedByUser: one(user, {
        fields: [supplier.addedBy],
        references: [user.id],
    }),
    category: one(category, {
        fields: [supplier.categoryId],
        references: [category.id],
    }),
}));

export type Supplier = typeof supplier.$inferSelect;
export type NewSupplier = typeof supplier.$inferInsert;
