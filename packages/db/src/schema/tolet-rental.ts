import { relations, sql } from "drizzle-orm";
import {
	check,
	date,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { toletBookingRequest } from "./tolet-booking";
import { toletProperty, toletUnit } from "./tolet-property";

export const toletRentalContractStatusEnum = pgEnum(
	"tolet_rental_contract_status",
	["active", "leaving", "completed"],
);

export const toletRentPaymentStatusEnum = pgEnum(
	"tolet_rent_payment_status",
	["pending", "paid"],
);

export const toletRentalAlertStatusEnum = pgEnum(
	"tolet_rental_alert_status",
	["active", "paused", "fulfilled"],
);

export const toletRentalContract = pgTable(
	"tolet_rental_contract",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		publicNumber: integer("public_number").generatedAlwaysAsIdentity({
			name: "tolet_rental_contract_public_number_seq",
			startWith: 300001,
		}),
		bookingRequestId: text("booking_request_id")
			.notNull()
			.references(() => toletBookingRequest.id, { onDelete: "restrict" }),
		propertyId: text("property_id")
			.notNull()
			.references(() => toletProperty.id, { onDelete: "restrict" }),
		unitId: text("unit_id")
			.notNull()
			.references(() => toletUnit.id, { onDelete: "restrict" }),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		tenantUserId: text("tenant_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		startDate: date("start_date").notNull(),
		endDate: date("end_date").notNull(),
		rentDueDay: integer("rent_due_day").default(1).notNull(),
		monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }).notNull(),
		advanceAmount: numeric("advance_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		securityDeposit: numeric("security_deposit", {
			precision: 12,
			scale: 2,
		})
			.default("0")
			.notNull(),
		serviceCharge: numeric("service_charge", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		parkingCharge: numeric("parking_charge", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		utilityCharge: numeric("utility_charge", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		status: toletRentalContractStatusEnum("status").default("active").notNull(),
		activatedAt: timestamp("activated_at").defaultNow().notNull(),
		leaveRequestedAt: timestamp("leave_requested_at"),
		accessEndsAt: timestamp("access_ends_at"),
		completedAt: timestamp("completed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tolet_rental_contract_public_number_unique").on(
			table.publicNumber,
		),
		uniqueIndex("tolet_rental_contract_booking_unique").on(
			table.bookingRequestId,
		),
		uniqueIndex("tolet_rental_contract_current_unit_unique")
			.on(table.unitId)
			.where(sql`${table.status} IN ('active', 'leaving')`),
		index("tolet_rental_contract_owner_status_idx").on(
			table.ownerUserId,
			table.status,
		),
		index("tolet_rental_contract_tenant_status_idx").on(
			table.tenantUserId,
			table.status,
		),
		check("tolet_rental_contract_date_order", sql`${table.endDate} >= ${table.startDate}`),
		check("tolet_rental_contract_due_day_valid", sql`${table.rentDueDay} BETWEEN 1 AND 28`),
	],
);

export const toletRentPayment = pgTable(
	"tolet_rent_payment",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		contractId: text("contract_id")
			.notNull()
			.references(() => toletRentalContract.id, { onDelete: "cascade" }),
		cycleMonth: date("cycle_month").notNull(),
		dueDate: date("due_date").notNull(),
		amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
		referenceName: varchar("reference_name", { length: 150 }),
		status: toletRentPaymentStatusEnum("status").default("pending").notNull(),
		verifiedAt: timestamp("verified_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tolet_rent_payment_contract_cycle_unique").on(
			table.contractId,
			table.cycleMonth,
		),
		index("tolet_rent_payment_contract_status_idx").on(
			table.contractId,
			table.status,
		),
		check("tolet_rent_payment_amount_nonnegative", sql`${table.amount} >= 0`),
	],
);

export const toletRentalAlert = pgTable(
	"tolet_rental_alert",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		sourceContractId: text("source_contract_id").references(
			() => toletRentalContract.id,
			{ onDelete: "set null" },
		),
		preferredCategory: varchar("preferred_category", { length: 50 }).notNull(),
		preferredLocation: varchar("preferred_location", { length: 200 }).notNull(),
		minimumSizeSqFt: integer("minimum_size_sq_ft").default(0).notNull(),
		minimumBedrooms: integer("minimum_bedrooms").default(0).notNull(),
		minimumBathrooms: integer("minimum_bathrooms").default(0).notNull(),
		minimumBalconies: integer("minimum_balconies").default(0).notNull(),
		balconyPreference: varchar("balcony_preference", { length: 20 })
			.default("optional")
			.notNull(),
		preferredFloor: varchar("preferred_floor", { length: 30 })
			.default("any")
			.notNull(),
		status: toletRentalAlertStatusEnum("status").default("active").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("tolet_rental_alert_user_status_idx").on(table.userId, table.status),
		check("tolet_rental_alert_sizes_nonnegative", sql`${table.minimumSizeSqFt} >= 0 AND ${table.minimumBedrooms} >= 0 AND ${table.minimumBathrooms} >= 0 AND ${table.minimumBalconies} >= 0`),
	],
);

export const toletRentalComment = pgTable(
	"tolet_rental_comment",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		contractId: text("contract_id")
			.notNull()
			.references(() => toletRentalContract.id, { onDelete: "cascade" }),
		authorUserId: text("author_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		body: text("body").notNull(),
		rating: integer("rating"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("tolet_rental_comment_contract_created_idx").on(
			table.contractId,
			table.createdAt,
		),
		check(
			"tolet_rental_comment_rating_valid",
			sql`${table.rating} IS NULL OR ${table.rating} BETWEEN 1 AND 5`,
		),
	],
);

export const toletRentalContractRelations = relations(
	toletRentalContract,
	({ many, one }) => ({
		booking: one(toletBookingRequest, {
			fields: [toletRentalContract.bookingRequestId],
			references: [toletBookingRequest.id],
		}),
		payments: many(toletRentPayment),
		comments: many(toletRentalComment),
	}),
);

export const toletRentPaymentRelations = relations(toletRentPayment, ({ one }) => ({
	contract: one(toletRentalContract, {
		fields: [toletRentPayment.contractId],
		references: [toletRentalContract.id],
	}),
}));

export type ToletRentalContract = typeof toletRentalContract.$inferSelect;
export type ToletRentPayment = typeof toletRentPayment.$inferSelect;
export type ToletRentalAlert = typeof toletRentalAlert.$inferSelect;
export type ToletRentalComment = typeof toletRentalComment.$inferSelect;
