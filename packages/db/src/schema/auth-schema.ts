import { relations } from "drizzle-orm";
import { type AnyPgColumn, boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    // Phone number fields
    phoneNumber: text("phone_number").unique(),
    phoneNumberVerified: boolean("phone_number_verified").default(false),
    // Admin plugin fields
    role: text("role").default("consumer"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    // Shop owner capability flags
    isSeller: boolean("is_seller").default(false),
    sellerStatus: text("seller_status"), // pending | approved | rejected | disabled
    businessType: text("business_type"), // retail | restaurant
    shopAddress: text("shop_address"),
    ownerName: text("owner_name"),

    // === B2B + B2C Shop Owner fields ===
    shopName: text("shop_name"),
    shopSlug: text("shop_slug"), // for public store URL: /store/{shop_slug}
    shopLogo: text("shop_logo"),
    /** Local store opening time in 24-hour HH:mm format */
    shopOpeningTime: text("shop_opening_time"),
    /** Local store closing time in 24-hour HH:mm format */
    shopClosingTime: text("shop_closing_time"),

    // === Warehouse fields ===
    warehouseName: text("warehouse_name"),
    warehouseSlug: text("warehouse_slug"), // for warehouse URL: /warehouse/{warehouse_slug}
    warehouseAddress: text("warehouse_address"),

    // === Location coordinates ===
    /** Shop owner's shop location (latitude) */
    shopLat: text("shop_lat"),
    /** Shop owner's shop location (longitude) */
    shopLng: text("shop_lng"),
    /** Warehouse location (latitude) */
    warehouseLat: text("warehouse_lat"),
    /** Warehouse location (longitude) */
    warehouseLng: text("warehouse_lng"),

    /** Whether this seller can receive open order broadcasts */
    canAcceptOpenOrder: boolean("can_accept_open_order").default(false),
    /** Current count of pending OTP confirmations (max 2 for open orders) */
    pendingOtpCount: integer("pending_otp_count").default(0),

    // Deliveryman: comma-separated areas for area-based assignment
    serviceArea: text("service_area"),
    // Links salesman/deliveryman to their parent warehouse
    warehouseId: text("warehouse_id").references((): AnyPgColumn => user.id),
    // Links retailer delivery staff to their parent shop owner
    shopId: text("shop_id").references((): AnyPgColumn => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
        .defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
}, (table) => [
    index("user_warehouseId_idx").on(table.warehouseId),
    index("user_shopId_idx").on(table.shopId),
]);

export const session = pgTable(
    "session",
    {
        id: text("id").primaryKey(),
        expiresAt: timestamp("expires_at").notNull(),
        token: text("token").notNull().unique(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        // Admin plugin field
        impersonatedBy: text("impersonated_by"),
    },
    (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
    "account",
    {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
    "verification",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [index("verification_identifier_idx").on(table.identifier)],
);

import { deliveryGroup } from "./delivery";
import { invoice } from "./invoice";

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    deliveryGroups: many(deliveryGroup),
    customerInvoices: many(invoice, { relationName: "customerInvoices" }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id],
    }),
}));

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id],
    }),
}));

export type User = typeof user.$inferSelect;
