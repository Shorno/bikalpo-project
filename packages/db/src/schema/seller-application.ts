import { relations } from "drizzle-orm";
import { index, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const sellerApplication = pgTable(
    "seller_application",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        // Business details
        shopName: text("shop_name").notNull(),
        ownerName: text("owner_name").notNull(),
        phoneNumber: text("phone_number").notNull(),
        businessType: text("business_type").notNull(), // retail | restaurant
        shopAddress: text("shop_address").notNull(),
        tradeLicenseNumber: text("trade_license_number"),
        // Documents (array of file URLs)
        documents: json("documents").$type<string[]>().default([]),
        // Application status
        status: text("status").default("pending").notNull(), // pending | approved | rejected
        // Admin review
        adminNotes: text("admin_notes"),
        reviewedBy: text("reviewed_by").references(() => user.id),
        reviewedAt: timestamp("reviewed_at"),
        // Timestamps
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("seller_application_userId_idx").on(table.userId),
        index("seller_application_status_idx").on(table.status),
    ],
);

export const sellerApplicationRelations = relations(sellerApplication, ({ one }) => ({
    user: one(user, {
        fields: [sellerApplication.userId],
        references: [user.id],
    }),
    reviewer: one(user, {
        fields: [sellerApplication.reviewedBy],
        references: [user.id],
        relationName: "applicationReviewer",
    }),
}));
