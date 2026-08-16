import {
	boolean,
	decimal,
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { order } from "./order";

export const checkoutPromotionAudienceEnum = pgEnum(
	"checkout_promotion_audience",
	["retail", "wholesale", "all"],
);

export const checkoutPromotionTypeEnum = pgEnum("checkout_promotion_type", [
	"fixed",
	"percentage",
]);

export const checkoutPromotion = pgTable(
	"checkout_promotion",
	{
		id: serial("id").primaryKey(),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		code: varchar("code", { length: 40 }).notNull(),
		name: varchar("name", { length: 120 }).notNull(),
		audience: checkoutPromotionAudienceEnum("audience")
			.default("all")
			.notNull(),
		type: checkoutPromotionTypeEnum("type").notNull(),
		value: decimal("value", { precision: 12, scale: 2 }).notNull(),
		minimumSubtotal: decimal("minimum_subtotal", {
			precision: 12,
			scale: 2,
		})
			.default("0")
			.notNull(),
		maximumDiscount: decimal("maximum_discount", {
			precision: 12,
			scale: 2,
		}),
		usageLimit: integer("usage_limit"),
		usedCount: integer("used_count").default(0).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		startsAt: timestamp("starts_at"),
		endsAt: timestamp("ends_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("checkoutPromotion_owner_code_unique").on(
			table.ownerId,
			table.code,
		),
		index("checkoutPromotion_owner_active_idx").on(
			table.ownerId,
			table.isActive,
		),
	],
);

export const checkoutPromotionRedemption = pgTable(
	"checkout_promotion_redemption",
	{
		id: serial("id").primaryKey(),
		promotionId: integer("promotion_id")
			.notNull()
			.references(() => checkoutPromotion.id, { onDelete: "restrict" }),
		orderId: integer("order_id")
			.notNull()
			.references(() => order.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		codeSnapshot: varchar("code_snapshot", { length: 40 }).notNull(),
		discountAmount: decimal("discount_amount", {
			precision: 12,
			scale: 2,
		}).notNull(),
		metadata: text("metadata"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("checkoutPromotionRedemption_order_unique").on(table.orderId),
		index("checkoutPromotionRedemption_promotion_idx").on(table.promotionId),
		index("checkoutPromotionRedemption_user_idx").on(table.userId),
	],
);

export type CheckoutPromotion = typeof checkoutPromotion.$inferSelect;
export type NewCheckoutPromotion = typeof checkoutPromotion.$inferInsert;
export type CheckoutPromotionRedemption =
	typeof checkoutPromotionRedemption.$inferSelect;
