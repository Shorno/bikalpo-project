import { relations } from "drizzle-orm";
import {
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers";
import { user } from "./auth-schema";

/**
 * Status of a product identity request from warehouse owners.
 */
export const productRequestStatusEnum = pgEnum("product_request_status", [
    "pending",
    "approved",
    "rejected",
]);

/**
 * Product Identity Request — warehouse owners can request new core identities
 * that don't exist in the catalog yet.
 *
 * Admin reviews and either creates the core identity or rejects with a note.
 */
export const productIdentityRequest = pgTable("product_identity_request", {
    id: serial("id").primaryKey(),

    /** Who made the request */
    requestedBy: text("requested_by")
        .notNull()
        .references(() => user.id, { onDelete: "cascade" }),

    /** Suggested type name (e.g. "Grocery", "Fashion") */
    typeName: varchar("type_name", { length: 100 }),

    /** Suggested category name (e.g. "Rice", "Oil") */
    categoryName: varchar("category_name", { length: 100 }),

    /** Suggested sub-category name (e.g. "Miniket", "Basmati") */
    subCategoryName: varchar("sub_category_name", { length: 100 }),

    /** Suggested product/core identity name */
    productName: varchar("product_name", { length: 200 }).notNull(),

    /** Optional description or details */
    description: text("description"),

    /** Optional reference image URL */
    referenceImage: varchar("reference_image", { length: 500 }),

    /** Request status */
    status: productRequestStatusEnum("status").default("pending").notNull(),

    /** Admin note (reason for rejection, etc.) */
    adminNote: text("admin_note"),

    /** Admin who reviewed */
    reviewedBy: text("reviewed_by").references(() => user.id, {
        onDelete: "set null",
    }),

    /** When it was reviewed */
    reviewedAt: timestamp("reviewed_at"),

    ...timestamps,
});

export const productIdentityRequestRelations = relations(
    productIdentityRequest,
    ({ one }) => ({
        requester: one(user, {
            fields: [productIdentityRequest.requestedBy],
            references: [user.id],
        }),
        reviewer: one(user, {
            fields: [productIdentityRequest.reviewedBy],
            references: [user.id],
            relationName: "reviewer",
        }),
    }),
);

export type ProductIdentityRequest =
    typeof productIdentityRequest.$inferSelect;
export type NewProductIdentityRequest =
    typeof productIdentityRequest.$inferInsert;
