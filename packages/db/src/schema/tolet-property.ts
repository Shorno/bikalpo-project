import { relations, sql } from "drizzle-orm";
import {
	boolean,
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

export const toletPropertyStatusEnum = pgEnum("tolet_property_status", [
	"active",
	"inactive",
	"blocked",
]);

export const toletUnitStatusEnum = pgEnum("tolet_unit_status", [
	"vacant",
	"booked",
	"occupied",
	"inactive",
]);

export const toletUnitListingStatusEnum = pgEnum("tolet_unit_listing_status", [
	"draft",
	"active",
	"paused",
	"closed",
]);

export const toletUnitListingVisibilityEnum = pgEnum(
	"tolet_unit_listing_visibility",
	["public", "qr_only"],
);

export const toletPreferredTenantEnum = pgEnum("tolet_preferred_tenant", [
	"family",
	"bachelor",
	"office",
	"female",
	"any",
]);

/**
 * A consumer-owned property account.
 *
 * `id` is the internal identifier. `publicNumber` is a database-generated,
 * permanent identity used by the API to render PR-YYYY-NNNNNN. `qrToken` is
 * the permanent, non-sequential bearer token embedded in the property QR.
 */
export const toletProperty = pgTable(
	"tolet_property",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		publicNumber: integer("public_number").generatedAlwaysAsIdentity({
			name: "tolet_property_public_number_seq",
			startWith: 100001,
		}),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		qrToken: text("qr_token")
			.notNull()
			.$defaultFn(() => crypto.randomUUID()),

		// Step 1: identity, owner/contact, and location.
		name: varchar("name", { length: 200 }).notNull(),
		coverImageUrl: text("cover_image_url").notNull(),
		ownerName: varchar("owner_name", { length: 150 }).notNull(),
		mobileNumber: varchar("mobile_number", { length: 30 }).notNull(),
		email: varchar("email", { length: 320 }),
		propertyType: varchar("property_type", { length: 50 }).notNull(),
		division: varchar("division", { length: 100 }).notNull(),
		district: varchar("district", { length: 100 }).notNull(),
		area: varchar("area", { length: 150 }).notNull(),
		fullAddress: text("full_address").notNull(),
		nearbyLandmark: text("nearby_landmark"),
		latitude: text("latitude"),
		longitude: text("longitude"),

		// Step 2: building details and property-level facilities.
		buildingType: varchar("building_type", { length: 50 }).notNull(),
		totalFloors: integer("total_floors").notNull(),
		declaredTotalUnits: integer("declared_total_units").notNull(),
		hasParking: boolean("has_parking").default(false).notNull(),
		hasLift: boolean("has_lift").default(false).notNull(),
		hasSecurityGuard: boolean("has_security_guard").default(false).notNull(),
		hasCctv: boolean("has_cctv").default(false).notNull(),
		hasGenerator: boolean("has_generator").default(false).notNull(),
		hasWaterSupply: boolean("has_water_supply").default(false).notNull(),
		hasGasConnection: boolean("has_gas_connection").default(false).notNull(),
		hasElectricity: boolean("has_electricity").default(false).notNull(),
		description: text("description"),

		// Step 3: verification media and phone verification evidence.
		frontImageUrl: text("front_image_url").notNull(),
		buildingImageUrl: text("building_image_url"),
		videoUrl: text("video_url"),
		phoneVerifiedAt: timestamp("phone_verified_at").notNull(),

		// Step 4: auditable review acknowledgements.
		informationConfirmedAt: timestamp("information_confirmed_at").notNull(),
		termsAcceptedAt: timestamp("terms_accepted_at").notNull(),
		propertyPolicyAcceptedAt: timestamp(
			"property_policy_accepted_at",
		).notNull(),

		status: toletPropertyStatusEnum("status").default("active").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tolet_property_public_number_unique").on(table.publicNumber),
		uniqueIndex("tolet_property_qr_token_unique").on(table.qrToken),
		index("tolet_property_owner_user_id_idx").on(table.ownerUserId),
		index("tolet_property_status_idx").on(table.status),
	],
);

/** A reusable physical unit that belongs to exactly one property. */
export const toletUnit = pgTable(
	"tolet_unit",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		publicNumber: integer("public_number").generatedAlwaysAsIdentity({
			name: "tolet_unit_public_number_seq",
			startWith: 100001,
		}),
		propertyId: text("property_id")
			.notNull()
			.references(() => toletProperty.id, { onDelete: "cascade" }),

		name: varchar("name", { length: 100 }).notNull(),
		unitType: varchar("unit_type", { length: 50 }).notNull(),
		status: toletUnitStatusEnum("status").default("vacant").notNull(),
		floorNumber: integer("floor_number").notNull(),
		sizeSqFt: integer("size_sq_ft").notNull(),
		bedrooms: integer("bedrooms").default(0).notNull(),
		bathrooms: integer("bathrooms").default(0).notNull(),
		balconies: integer("balconies").default(0).notNull(),
		hasDrawingRoom: boolean("has_drawing_room").default(false).notNull(),
		hasDiningSpace: boolean("has_dining_space").default(false).notNull(),
		hasKitchen: boolean("has_kitchen").default(false).notNull(),
		isFurnished: boolean("is_furnished").default(false).notNull(),
		description: text("description"),
		imageUrls: text("image_urls").array().default([]).notNull(),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tolet_unit_public_number_unique").on(table.publicNumber),
		uniqueIndex("tolet_unit_property_name_unique").on(
			table.propertyId,
			table.name,
		),
		index("tolet_unit_property_id_idx").on(table.propertyId),
		index("tolet_unit_status_idx").on(table.status),
	],
);

/**
 * A publishable advertisement for one physical unit.
 *
 * Structural unit/property details and verified contact information are
 * intentionally derived through `unitId`; they are not duplicated here.
 * A closed listing remains as history and allows the unit to be re-listed
 * later with a new permanent LST-NNNNNN identity.
 */
export const toletUnitListing = pgTable(
	"tolet_unit_listing",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		publicNumber: integer("public_number").generatedAlwaysAsIdentity({
			name: "tolet_unit_listing_public_number_seq",
			startWith: 100001,
		}),
		unitId: text("unit_id")
			.notNull()
			.references(() => toletUnit.id, { onDelete: "restrict" }),

		title: varchar("title", { length: 200 }).notNull(),
		description: text("description"),
		monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }).notNull(),
		monthlyRentVisible: boolean("monthly_rent_visible").default(true).notNull(),
		advanceAmount: numeric("advance_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		advanceAmountVisible: boolean("advance_amount_visible")
			.default(true)
			.notNull(),
		securityDeposit: numeric("security_deposit", {
			precision: 12,
			scale: 2,
		})
			.default("0")
			.notNull(),
		securityDepositVisible: boolean("security_deposit_visible")
			.default(true)
			.notNull(),
		serviceCharge: numeric("service_charge", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		serviceChargeVisible: boolean("service_charge_visible")
			.default(true)
			.notNull(),
		serviceChargeIncluded: boolean("service_charge_included")
			.default(false)
			.notNull(),
		parkingCharge: numeric("parking_charge", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		parkingChargeVisible: boolean("parking_charge_visible")
			.default(true)
			.notNull(),
		parkingChargeIncluded: boolean("parking_charge_included")
			.default(false)
			.notNull(),
		utilityCharge: numeric("utility_charge", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		utilityChargeVisible: boolean("utility_charge_visible")
			.default(true)
			.notNull(),
		utilityChargeIncluded: boolean("utility_charge_included")
			.default(false)
			.notNull(),
		availableFrom: date("available_from").notNull(),
		preferredTenant: toletPreferredTenantEnum("preferred_tenant")
			.default("any")
			.notNull(),
		hasInternet: boolean("has_internet").default(false).notNull(),
		otherFacilities: text("other_facilities"),
		imageUrls: text("image_urls").array().default([]).notNull(),
		videoUrl: text("video_url"),

		visibility: toletUnitListingVisibilityEnum("visibility")
			.default("public")
			.notNull(),
		status: toletUnitListingStatusEnum("status").default("draft").notNull(),
		viewCount: integer("view_count").default(0).notNull(),
		publishedAt: timestamp("published_at"),
		pausedAt: timestamp("paused_at"),
		closedAt: timestamp("closed_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tolet_unit_listing_public_number_unique").on(
			table.publicNumber,
		),
		uniqueIndex("tolet_unit_listing_open_unit_unique")
			.on(table.unitId)
			.where(sql`${table.status} in ('draft', 'active', 'paused')`),
		index("tolet_unit_listing_unit_id_idx").on(table.unitId),
		index("tolet_unit_listing_discovery_idx").on(
			table.status,
			table.visibility,
			table.publishedAt,
		),
		check(
			"tolet_unit_listing_monthly_rent_nonnegative",
			sql`${table.monthlyRent} >= 0`,
		),
		check(
			"tolet_unit_listing_advance_amount_nonnegative",
			sql`${table.advanceAmount} >= 0`,
		),
		check(
			"tolet_unit_listing_security_deposit_nonnegative",
			sql`${table.securityDeposit} >= 0`,
		),
		check(
			"tolet_unit_listing_service_charge_nonnegative",
			sql`${table.serviceCharge} >= 0`,
		),
		check(
			"tolet_unit_listing_parking_charge_nonnegative",
			sql`${table.parkingCharge} >= 0`,
		),
		check(
			"tolet_unit_listing_utility_charge_nonnegative",
			sql`${table.utilityCharge} >= 0`,
		),
		check(
			"tolet_unit_listing_view_count_nonnegative",
			sql`${table.viewCount} >= 0`,
		),
	],
);

export const toletPropertyRelations = relations(
	toletProperty,
	({ many, one }) => ({
		owner: one(user, {
			fields: [toletProperty.ownerUserId],
			references: [user.id],
		}),
		units: many(toletUnit),
	}),
);

export const toletUnitRelations = relations(toletUnit, ({ many, one }) => ({
	property: one(toletProperty, {
		fields: [toletUnit.propertyId],
		references: [toletProperty.id],
	}),
	listings: many(toletUnitListing),
}));

export const toletUnitListingRelations = relations(
	toletUnitListing,
	({ one }) => ({
		unit: one(toletUnit, {
			fields: [toletUnitListing.unitId],
			references: [toletUnit.id],
		}),
	}),
);

export type ToletProperty = typeof toletProperty.$inferSelect;
export type NewToletProperty = typeof toletProperty.$inferInsert;
export type ToletUnit = typeof toletUnit.$inferSelect;
export type NewToletUnit = typeof toletUnit.$inferInsert;
export type ToletUnitListing = typeof toletUnitListing.$inferSelect;
export type NewToletUnitListing = typeof toletUnitListing.$inferInsert;
