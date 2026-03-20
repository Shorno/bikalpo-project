import { relations } from "drizzle-orm";
import { index, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const warehouseApplication = pgTable(
    "warehouse_application",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        // Business details
        warehouseName: text("warehouse_name").notNull(),
        ownerName: text("owner_name").notNull(),
        phoneNumber: text("phone_number").notNull(),
        warehouseAddress: text("warehouse_address").notNull(),
        tradeLicenseNumber: text("trade_license_number"),
        // Business profile (from wizard step 2)
        businessCategory: text("business_category"),
        yearsInBusiness: text("years_in_business"),
        monthlyRevenue: text("monthly_revenue"),
        // Location (from wizard step 3 — Barikoi)
        latitude: text("latitude"),
        longitude: text("longitude"),
        area: text("area"),
        district: text("district"),
        division: text("division"),
        postCode: text("post_code"),
        // Plan selection (from wizard step 5)
        selectedPlan: text("selected_plan"),
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
        index("warehouse_application_userId_idx").on(table.userId),
        index("warehouse_application_status_idx").on(table.status),
    ],
);

export const warehouseApplicationRelations = relations(warehouseApplication, ({ one }) => ({
    user: one(user, {
        fields: [warehouseApplication.userId],
        references: [user.id],
    }),
    reviewer: one(user, {
        fields: [warehouseApplication.reviewedBy],
        references: [user.id],
        relationName: "warehouseApplicationReviewer",
    }),
}));
