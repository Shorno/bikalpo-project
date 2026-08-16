import {
	boolean,
	decimal,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const checkoutSetting = pgTable("checkout_setting", {
	ownerId: text("owner_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	allowSelfPickup: boolean("allow_self_pickup").default(true).notNull(),
	allowCourier: boolean("allow_courier").default(true).notNull(),
	allowRetailDeposits: boolean("allow_retail_deposits")
		.default(false)
		.notNull(),
	defaultShippingFee: decimal("default_shipping_fee", {
		precision: 10,
		scale: 2,
	})
		.default("0")
		.notNull(),
	taxPercentage: decimal("tax_percentage", { precision: 5, scale: 2 })
		.default("0")
		.notNull(),
	wholesaleCreditDays: integer("wholesale_credit_days").default(0).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export type CheckoutSetting = typeof checkoutSetting.$inferSelect;
export type NewCheckoutSetting = typeof checkoutSetting.$inferInsert;
