import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

// ── Marketing Material (Admin-created designs) ─────────────────────
export const marketingMaterial = pgTable(
    "marketing_material",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        title: text("title").notNull(),
        // banner | sticker | leaflet | poster | standee | qr_sticker
        type: text("type").notNull(),
        // shop_branding | warehouse_branding | product_promotion | campaign
        category: text("category").default("shop_branding"),
        designFileUrl: text("design_file_url"),
        sizeFormat: text("size_format"), // "10x3 ft", "A4", "Round Sticker"
        description: text("description"),
        stockQuantity: integer("stock_quantity").default(0).notNull(),
        // active | disabled
        status: text("status").default("active").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("marketing_material_type_idx").on(table.type),
        index("marketing_material_status_idx").on(table.status),
        index("marketing_material_category_idx").on(table.category),
    ],
);

export const marketingMaterialRelations = relations(marketingMaterial, ({ many }) => ({
    requests: many(marketingMaterialRequest),
}));

// ── Marketing Material Request (Seller-submitted orders) ───────────
export const marketingMaterialRequest = pgTable(
    "marketing_material_request",
    {
        id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
        // Auto-generated: MR-101, MR-102, etc.
        requestNumber: text("request_number").unique().notNull(),
        materialId: text("material_id")
            .notNull()
            .references(() => marketingMaterial.id, { onDelete: "cascade" }),
        requestedByUserId: text("requested_by_user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        // retailer | wholesaler | warehouse
        userType: text("user_type").notNull(),
        quantity: integer("quantity").notNull(),
        // courier | warehouse_pickup | sales_delivery
        deliveryType: text("delivery_type").default("courier").notNull(),
        // free | subsidized | paid
        paymentType: text("payment_type").default("free").notNull(),
        paymentAmount: integer("payment_amount").default(0),
        deliveryAddress: text("delivery_address"),
        deliveryContact: text("delivery_contact"),
        // pending | approved | rejected | dispatched | delivered
        status: text("status").default("pending").notNull(),
        adminNote: text("admin_note"),
        reviewedByUserId: text("reviewed_by_user_id").references(() => user.id),
        reviewedAt: timestamp("reviewed_at"),
        dispatchedAt: timestamp("dispatched_at"),
        deliveredAt: timestamp("delivered_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("mmr_material_id_idx").on(table.materialId),
        index("mmr_requested_by_idx").on(table.requestedByUserId),
        index("mmr_status_idx").on(table.status),
        index("mmr_user_type_idx").on(table.userType),
        index("mmr_request_number_idx").on(table.requestNumber),
    ],
);

export const marketingMaterialRequestRelations = relations(marketingMaterialRequest, ({ one }) => ({
    material: one(marketingMaterial, {
        fields: [marketingMaterialRequest.materialId],
        references: [marketingMaterial.id],
    }),
    requestedBy: one(user, {
        fields: [marketingMaterialRequest.requestedByUserId],
        references: [user.id],
        relationName: "marketingRequestUser",
    }),
    reviewedBy: one(user, {
        fields: [marketingMaterialRequest.reviewedByUserId],
        references: [user.id],
        relationName: "marketingRequestReviewer",
    }),
}));
