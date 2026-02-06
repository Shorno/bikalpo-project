import { relations } from "drizzle-orm";
import {
    decimal,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { product } from "./product";
import { productVariant } from "./product-variant";

export const cart = pgTable(
    "cart",
    {
        id: serial("id").primaryKey(),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [index("cart_userId_idx").on(table.userId)],
);

export const cartItem = pgTable(
    "cart_item",
    {
        id: serial("id").primaryKey(),
        cartId: integer("cart_id")
            .notNull()
            .references(() => cart.id, { onDelete: "cascade" }),
        productId: integer("product_id")
            .notNull()
            .references(() => product.id, { onDelete: "cascade" }),
        variantId: integer("variant_id").references(() => productVariant.id, {
            onDelete: "cascade",
        }),
        quantity: integer("quantity").notNull().default(1),
        price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Price at time of adding
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("cartItem_cartId_idx").on(table.cartId),
        index("cartItem_productId_idx").on(table.productId),
        index("cartItem_variantId_idx").on(table.variantId),
    ],
);

export const cartRelations = relations(cart, ({ one, many }) => ({
    user: one(user, {
        fields: [cart.userId],
        references: [user.id],
    }),
    items: many(cartItem),
}));

export const cartItemRelations = relations(cartItem, ({ one }) => ({
    cart: one(cart, {
        fields: [cartItem.cartId],
        references: [cart.id],
    }),
    product: one(product, {
        fields: [cartItem.productId],
        references: [product.id],
    }),
    variant: one(productVariant, {
        fields: [cartItem.variantId],
        references: [productVariant.id],
    }),
}));

export type Cart = typeof cart.$inferSelect;
export type CartItem = typeof cartItem.$inferSelect;
export type NewCart = typeof cart.$inferInsert;
export type NewCartItem = typeof cartItem.$inferInsert;

export interface CartWithItems extends Cart {
    items: (CartItem & {
        product: {
            id: number;
            name: string;
            slug: string;
            image: string;
            size: string;
            price: string;
            inStock: boolean;
        };
        variant?: {
            id: number;
            quantitySelectorLabel: string;
            unitLabel: string;
            price: string;
        } | null;
    })[];
}
