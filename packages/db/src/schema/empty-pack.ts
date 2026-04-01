import { relations } from "drizzle-orm";
import {
    decimal,
    index,
    integer,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { brand } from "./brand";
import { deliveryGroupInvoice } from "./delivery";
import { productVariant } from "./product-variant";

// Empty pack status enum
export const emptyPackStatusEnum = pgEnum("empty_pack_status", [
    "collected",   // Deliveryman collected from customer
    "submitted",   // Deliveryman submitted to godown/supervisor
    "verified",    // Supervisor verified count
    "rejected",    // Supervisor found discrepancy
]);

/**
 * Tracks empty pack (bottle/jar/can/sack) returns collected during delivery.
 * Each row = one type of pack collected from one delivery stop.
 */
export const emptyPack = pgTable(
    "empty_pack",
    {
        id: serial("id").primaryKey(),

        /** Which delivery stop this pack was collected from */
        deliveryGroupInvoiceId: integer("delivery_group_invoice_id")
            .notNull()
            .references(() => deliveryGroupInvoice.id, { onDelete: "cascade" }),

        /** Product variant the pack belongs to (e.g., IFAD 5L Jar) */
        variantId: integer("variant_id").references(
            () => productVariant.id,
            { onDelete: "set null" },
        ),

        /** Brand of the empty pack */
        brandId: integer("brand_id").references(() => brand.id, {
            onDelete: "set null",
        }),

        /** Pack type description (e.g., "5L Jar", "1L Bottle") */
        packDescription: text("pack_description"),

        /** How many empty packs collected */
        quantityCollected: integer("quantity_collected").notNull().default(0),

        /** Photo proof of collected packs */
        photoProof: text("photo_proof"),

        /** Current status */
        status: emptyPackStatusEnum("status").default("collected").notNull(),

        /** Supervisor who received the packs */
        submittedTo: text("submitted_to").references(() => user.id, {
            onDelete: "set null",
        }),

        /** Supervisor who verified the count */
        verifiedBy: text("verified_by").references(() => user.id, {
            onDelete: "set null",
        }),

        /** Deposit amount charged if pack not returned */
        depositAmount: decimal("deposit_amount", {
            precision: 10,
            scale: 2,
        }).default("0").notNull(),

        notes: text("notes"),

        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
        submittedAt: timestamp("submitted_at"),
        verifiedAt: timestamp("verified_at"),
    },
    (table) => [
        index("emptyPack_dgiId_idx").on(table.deliveryGroupInvoiceId),
        index("emptyPack_status_idx").on(table.status),
    ],
);

// Relations
export const emptyPackRelations = relations(emptyPack, ({ one }) => ({
    deliveryGroupInvoice: one(deliveryGroupInvoice, {
        fields: [emptyPack.deliveryGroupInvoiceId],
        references: [deliveryGroupInvoice.id],
    }),
    variant: one(productVariant, {
        fields: [emptyPack.variantId],
        references: [productVariant.id],
    }),
    brand: one(brand, {
        fields: [emptyPack.brandId],
        references: [brand.id],
    }),
}));

// Types
export type EmptyPack = typeof emptyPack.$inferSelect;
export type NewEmptyPack = typeof emptyPack.$inferInsert;
export type EmptyPackStatus = (typeof emptyPackStatusEnum.enumValues)[number];
