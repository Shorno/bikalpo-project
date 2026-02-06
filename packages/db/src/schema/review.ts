import { relations } from "drizzle-orm";
import {
    boolean,
    index,
    integer,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
    varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { product } from "./product";

export const productReview = pgTable(
    "product_review",
    {
        id: serial("id").primaryKey(),
        productId: integer("product_id")
            .notNull()
            .references(() => product.id, { onDelete: "cascade" }),
        userId: text("user_id")
            .notNull()
            .references(() => user.id, { onDelete: "cascade" }),
        rating: integer("rating").notNull(), // 1-5
        title: varchar("title", { length: 100 }),
        comment: text("comment").notNull(),
        isVerifiedPurchase: boolean("is_verified_purchase").default(true).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => new Date())
            .notNull(),
    },
    (table) => [
        index("review_productId_idx").on(table.productId),
        index("review_userId_idx").on(table.userId),
        unique("review_product_user_unique").on(table.productId, table.userId),
    ],
);

export const productReviewRelations = relations(productReview, ({ one }) => ({
    product: one(product, {
        fields: [productReview.productId],
        references: [product.id],
    }),
    user: one(user, {
        fields: [productReview.userId],
        references: [user.id],
    }),
}));

export type ProductReview = typeof productReview.$inferSelect;
export type NewProductReview = typeof productReview.$inferInsert;

export interface ReviewWithUser extends ProductReview {
    user: {
        id: string;
        name: string;
        image: string | null;
    };
}
