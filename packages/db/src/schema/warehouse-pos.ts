import { relations, sql } from "drizzle-orm";
import {
    check,
    boolean,
    decimal,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    serial,
    text,
    timestamp,
    uniqueIndex,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { product } from "./product";
import { productVariant } from "./product-variant";

export const warehousePosCustomerTypeEnum = pgEnum("warehouse_pos_customer_type", [
    "walk_in",
    "retail",
    "wholesale",
]);

export const warehousePosSaleTypeEnum = pgEnum("warehouse_pos_sale_type", [
    "retail",
    "wholesale",
]);

export const warehousePosPaymentMethodEnum = pgEnum("warehouse_pos_payment_method", [
    "cash",
    "bkash",
    "nagad",
    "bank",
    "due",
]);

export const warehousePosSaleStatusEnum = pgEnum("warehouse_pos_sale_status", [
    "completed",
    "cancelled",
]);

export const warehousePosCartStatusEnum = pgEnum("warehouse_pos_cart_status", [
    "held",
    "converted",
    "cancelled",
]);

export const warehousePosPaymentEntryTypeEnum = pgEnum(
    "warehouse_pos_payment_entry_type",
    ["payment", "reversal"],
);

export type WarehousePosCartItem = {
    variantId: number;
    productId: number;
    sku: string | null;
    productName: string;
    variantLabel: string;
    unitLabel: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
};

export type WarehousePosCartData = {
    saleType: "retail" | "wholesale";
    items: WarehousePosCartItem[];
    note?: string | null;
    discount?: { mode: "fixed" | "percentage"; value: number };
    tax?: { mode: "fixed" | "percentage"; value: number };
};

export const warehousePosCustomer = pgTable(
    "warehouse_pos_customer",
    {
        id: serial("id").primaryKey(),
        warehouseId: text("warehouse_id")
            .references(() => user.id, { onDelete: "cascade" }),
        shopId: text("shop_id").references(() => user.id, {
            onDelete: "cascade",
        }),
        linkedUserId: text("linked_user_id").references(() => user.id, {
            onDelete: "set null",
        }),
        name: varchar("name", { length: 150 }).notNull(),
        phone: varchar("phone", { length: 30 }),
        normalizedPhone: varchar("normalized_phone", { length: 30 }),
        address: text("address"),
        customerType: warehousePosCustomerTypeEnum("customer_type")
            .default("walk_in")
            .notNull(),
        isDefault: boolean("is_default").default(false).notNull(),
        createdById: text("created_by_id").references(() => user.id, {
            onDelete: "set null",
        }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("warehousePosCustomer_warehouseId_idx").on(table.warehouseId),
        index("warehousePosCustomer_shopId_idx").on(table.shopId),
        index("warehousePosCustomer_phone_idx").on(table.phone),
        index("warehousePosCustomer_linkedUserId_idx").on(table.linkedUserId),
        check(
            "warehouse_pos_customer_exactly_one_owner",
            sql`num_nonnulls(${table.warehouseId}, ${table.shopId}) = 1`,
        ),
    ],
);

export const warehousePosCart = pgTable(
    "warehouse_pos_cart",
    {
        id: serial("id").primaryKey(),
        warehouseId: text("warehouse_id")
            .references(() => user.id, { onDelete: "cascade" }),
        shopId: text("shop_id").references(() => user.id, {
            onDelete: "cascade",
        }),
        customerId: integer("customer_id").references(() => warehousePosCustomer.id, {
            onDelete: "set null",
        }),
        heldRef: varchar("held_ref", { length: 40 }).notNull().unique(),
        cartData: jsonb("cart_data").$type<WarehousePosCartData>().notNull(),
        subtotal: decimal("subtotal", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        discount: decimal("discount", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        tax: decimal("tax", { precision: 12, scale: 2 }).default("0").notNull(),
        total: decimal("total", { precision: 12, scale: 2 }).default("0").notNull(),
        status: warehousePosCartStatusEnum("status").default("held").notNull(),
        heldById: text("held_by_id").references(() => user.id, { onDelete: "set null" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("warehousePosCart_warehouseId_idx").on(table.warehouseId),
        index("warehousePosCart_shopId_idx").on(table.shopId),
        index("warehousePosCart_customerId_idx").on(table.customerId),
        index("warehousePosCart_status_idx").on(table.status),
        check(
            "warehouse_pos_cart_exactly_one_owner",
            sql`num_nonnulls(${table.warehouseId}, ${table.shopId}) = 1`,
        ),
    ],
);

export const warehousePosSale = pgTable(
    "warehouse_pos_sale",
    {
        id: serial("id").primaryKey(),
        warehouseId: text("warehouse_id")
            .references(() => user.id, { onDelete: "cascade" }),
        shopId: text("shop_id").references(() => user.id, {
            onDelete: "cascade",
        }),
        saleType: warehousePosSaleTypeEnum("sale_type").default("retail").notNull(),
        invoiceNo: varchar("invoice_no", { length: 40 }).notNull().unique(),
        checkoutRequestId: varchar("checkout_request_id", { length: 80 }),
        customerId: integer("customer_id").references(() => warehousePosCustomer.id, {
            onDelete: "set null",
        }),
        customerName: varchar("customer_name", { length: 150 }).notNull(),
        customerPhone: varchar("customer_phone", { length: 30 }),
        customerAddress: text("customer_address"),
        subtotal: decimal("subtotal", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        discount: decimal("discount", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        discountMode: varchar("discount_mode", { length: 20 }),
        discountValue: decimal("discount_value", { precision: 12, scale: 2 }),
        tax: decimal("tax", { precision: 12, scale: 2 }).default("0").notNull(),
        taxMode: varchar("tax_mode", { length: 20 }),
        taxValue: decimal("tax_value", { precision: 12, scale: 2 }),
        total: decimal("total", { precision: 12, scale: 2 }).default("0").notNull(),
        paid: decimal("paid", { precision: 12, scale: 2 }).default("0").notNull(),
        due: decimal("due", { precision: 12, scale: 2 }).default("0").notNull(),
        tenderedAmount: decimal("tendered_amount", { precision: 12, scale: 2 }),
        changeAmount: decimal("change_amount", { precision: 12, scale: 2 })
            .default("0")
            .notNull(),
        paymentMethod: warehousePosPaymentMethodEnum("payment_method").notNull(),
        status: warehousePosSaleStatusEnum("status").default("completed").notNull(),
        note: text("note"),
        heldCartId: integer("held_cart_id").references(() => warehousePosCart.id, {
            onDelete: "set null",
        }),
        soldById: text("sold_by_id").references(() => user.id, {
            onDelete: "set null",
        }),
        voidReason: text("void_reason"),
        voidedById: text("voided_by_id").references(() => user.id, {
            onDelete: "set null",
        }),
        voidedAt: timestamp("voided_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("warehousePosSale_warehouseId_idx").on(table.warehouseId),
        index("warehousePosSale_shopId_idx").on(table.shopId),
        index("warehousePosSale_customerId_idx").on(table.customerId),
        index("warehousePosSale_saleType_idx").on(table.saleType),
        index("warehousePosSale_createdAt_idx").on(table.createdAt),
        uniqueIndex("warehousePosSale_checkoutRequestId_unique")
            .on(table.checkoutRequestId)
            .where(sql`${table.checkoutRequestId} IS NOT NULL`),
        check(
            "warehouse_pos_sale_exactly_one_owner",
            sql`num_nonnulls(${table.warehouseId}, ${table.shopId}) = 1`,
        ),
    ],
);

export const warehousePosSaleItem = pgTable(
    "warehouse_pos_sale_item",
    {
        id: serial("id").primaryKey(),
        saleId: integer("sale_id")
            .notNull()
            .references(() => warehousePosSale.id, { onDelete: "cascade" }),
        variantId: integer("variant_id").references(() => productVariant.id, {
            onDelete: "set null",
        }),
        productId: integer("product_id").references(() => product.id, {
            onDelete: "set null",
        }),
        sku: varchar("sku", { length: 100 }),
        productName: varchar("product_name", { length: 160 }).notNull(),
        variantLabel: varchar("variant_label", { length: 200 }).notNull(),
        quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
        unitLabel: varchar("unit_label", { length: 50 }).notNull(),
        unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
        lineTotal: decimal("line_total", { precision: 12, scale: 2 }).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("warehousePosSaleItem_saleId_idx").on(table.saleId),
        index("warehousePosSaleItem_variantId_idx").on(table.variantId),
    ],
);

export const warehousePosPayment = pgTable(
    "warehouse_pos_payment",
    {
        id: serial("id").primaryKey(),
        saleId: integer("sale_id")
            .notNull()
            .references(() => warehousePosSale.id, { onDelete: "cascade" }),
        entryType: warehousePosPaymentEntryTypeEnum("entry_type")
            .default("payment")
            .notNull(),
        idempotencyKey: varchar("idempotency_key", { length: 80 }),
        reversesPaymentId: integer("reverses_payment_id"),
        paymentMethod: warehousePosPaymentMethodEnum("payment_method").notNull(),
        amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
        tenderedAmount: decimal("tendered_amount", { precision: 12, scale: 2 }),
        transactionRef: varchar("transaction_ref", { length: 100 }),
        note: text("note"),
        paidAt: timestamp("paid_at").defaultNow().notNull(),
        createdById: text("created_by_id").references(() => user.id, {
            onDelete: "set null",
        }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("warehousePosPayment_saleId_idx").on(table.saleId),
        index("warehousePosPayment_method_idx").on(table.paymentMethod),
        uniqueIndex("warehousePosPayment_idempotencyKey_unique")
            .on(table.idempotencyKey)
            .where(sql`${table.idempotencyKey} IS NOT NULL`),
    ],
);

export const warehousePosCustomerRelations = relations(warehousePosCustomer, ({ one, many }) => ({
    warehouse: one(user, {
        fields: [warehousePosCustomer.warehouseId],
        references: [user.id],
        relationName: "warehousePosCustomerWarehouse",
    }),
    shop: one(user, {
        fields: [warehousePosCustomer.shopId],
        references: [user.id],
        relationName: "warehousePosCustomerShop",
    }),
    linkedUser: one(user, {
        fields: [warehousePosCustomer.linkedUserId],
        references: [user.id],
        relationName: "warehousePosCustomerLinkedUser",
    }),
    createdBy: one(user, {
        fields: [warehousePosCustomer.createdById],
        references: [user.id],
        relationName: "warehousePosCustomerCreatedBy",
    }),
    sales: many(warehousePosSale),
    carts: many(warehousePosCart),
}));

export const warehousePosCartRelations = relations(warehousePosCart, ({ one }) => ({
    warehouse: one(user, {
        fields: [warehousePosCart.warehouseId],
        references: [user.id],
        relationName: "warehousePosCartWarehouse",
    }),
    shop: one(user, {
        fields: [warehousePosCart.shopId],
        references: [user.id],
        relationName: "warehousePosCartShop",
    }),
    customer: one(warehousePosCustomer, {
        fields: [warehousePosCart.customerId],
        references: [warehousePosCustomer.id],
    }),
    heldBy: one(user, {
        fields: [warehousePosCart.heldById],
        references: [user.id],
        relationName: "warehousePosCartHeldBy",
    }),
}));

export const warehousePosSaleRelations = relations(warehousePosSale, ({ one, many }) => ({
    warehouse: one(user, {
        fields: [warehousePosSale.warehouseId],
        references: [user.id],
        relationName: "warehousePosSaleWarehouse",
    }),
    shop: one(user, {
        fields: [warehousePosSale.shopId],
        references: [user.id],
        relationName: "warehousePosSaleShop",
    }),
    customer: one(warehousePosCustomer, {
        fields: [warehousePosSale.customerId],
        references: [warehousePosCustomer.id],
    }),
    heldCart: one(warehousePosCart, {
        fields: [warehousePosSale.heldCartId],
        references: [warehousePosCart.id],
    }),
    soldBy: one(user, {
        fields: [warehousePosSale.soldById],
        references: [user.id],
        relationName: "warehousePosSaleSoldBy",
    }),
    voidedBy: one(user, {
        fields: [warehousePosSale.voidedById],
        references: [user.id],
        relationName: "warehousePosSaleVoidedBy",
    }),
    items: many(warehousePosSaleItem),
    payments: many(warehousePosPayment),
}));

export const warehousePosSaleItemRelations = relations(warehousePosSaleItem, ({ one }) => ({
    sale: one(warehousePosSale, {
        fields: [warehousePosSaleItem.saleId],
        references: [warehousePosSale.id],
    }),
    variant: one(productVariant, {
        fields: [warehousePosSaleItem.variantId],
        references: [productVariant.id],
    }),
    product: one(product, {
        fields: [warehousePosSaleItem.productId],
        references: [product.id],
    }),
}));

export const warehousePosPaymentRelations = relations(warehousePosPayment, ({ one }) => ({
    sale: one(warehousePosSale, {
        fields: [warehousePosPayment.saleId],
        references: [warehousePosSale.id],
    }),
    createdBy: one(user, {
        fields: [warehousePosPayment.createdById],
        references: [user.id],
        relationName: "warehousePosPaymentCreatedBy",
    }),
}));

export type WarehousePosCustomer = typeof warehousePosCustomer.$inferSelect;
export type NewWarehousePosCustomer = typeof warehousePosCustomer.$inferInsert;
export type WarehousePosCart = typeof warehousePosCart.$inferSelect;
export type NewWarehousePosCart = typeof warehousePosCart.$inferInsert;
export type WarehousePosSale = typeof warehousePosSale.$inferSelect;
export type NewWarehousePosSale = typeof warehousePosSale.$inferInsert;
export type WarehousePosSaleItem = typeof warehousePosSaleItem.$inferSelect;
export type NewWarehousePosSaleItem = typeof warehousePosSaleItem.$inferInsert;
export type WarehousePosPayment = typeof warehousePosPayment.$inferSelect;
export type NewWarehousePosPayment = typeof warehousePosPayment.$inferInsert;

// ── Due Collection for Invoice-based Sales ──────────────────────────
export const warehouseDueCollection = pgTable(
    "warehouse_due_collection",
    {
        id: serial("id").primaryKey(),
        warehouseId: text("warehouse_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        invoiceId: integer("invoice_id")
            .notNull(),
        paymentMethod: warehousePosPaymentMethodEnum("payment_method").notNull(),
        amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
        transactionRef: varchar("transaction_ref", { length: 100 }),
        note: text("note"),
        collectedAt: timestamp("collected_at").defaultNow().notNull(),
        collectedById: text("collected_by_id").references(() => user.id, {
            onDelete: "set null",
        }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("warehouseDueCollection_warehouseId_idx").on(table.warehouseId),
        index("warehouseDueCollection_invoiceId_idx").on(table.invoiceId),
    ],
);

export const warehouseDueCollectionRelations = relations(warehouseDueCollection, ({ one }) => ({
    warehouse: one(user, {
        fields: [warehouseDueCollection.warehouseId],
        references: [user.id],
        relationName: "warehouseDueCollectionWarehouse",
    }),
    collectedBy: one(user, {
        fields: [warehouseDueCollection.collectedById],
        references: [user.id],
        relationName: "warehouseDueCollectionCollectedBy",
    }),
}));

export type WarehouseDueCollection = typeof warehouseDueCollection.$inferSelect;
export type NewWarehouseDueCollection = typeof warehouseDueCollection.$inferInsert;
