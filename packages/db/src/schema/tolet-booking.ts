import { relations, sql } from "drizzle-orm";
import {
	check,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { toletUnitListing } from "./tolet-property";

export const toletBookingRequestStatusEnum = pgEnum(
	"tolet_booking_request_status",
	["pending", "accepted", "rejected", "cancelled"],
);

/**
 * Immutable, versioned copy of the public offer the consumer requested.
 * Historical booking screens must render this snapshot instead of mutable
 * property, unit, or listing rows.
 */
export type ToletBookingOfferSnapshot = {
	version: 1;
	capturedAt: string;
	listing: {
		listingCode: string;
		title: string;
		description: string | null;
		imageUrl: string;
		monthlyRent: number;
		monthlyRentVisible?: boolean;
		advanceAmount: number;
		advanceAmountVisible?: boolean;
		securityDeposit: number;
		securityDepositVisible?: boolean;
		serviceCharge: number;
		serviceChargeVisible?: boolean;
		serviceChargeIncluded: boolean;
		parkingCharge: number;
		parkingChargeVisible?: boolean;
		parkingChargeIncluded: boolean;
		utilityCharge: number;
		utilityChargeVisible?: boolean;
		utilityChargeIncluded: boolean;
		availableFrom: string;
		preferredTenant: "family" | "bachelor" | "office" | "female" | "any";
		hasInternet: boolean;
		otherFacilities: string | null;
	};
	property: {
		propertyCode: string;
		name: string;
		location: {
			division: string;
			district: string;
			area: string;
		};
		description?: string | null;
		facilities?: {
			hasParking: boolean;
			hasLift: boolean;
			hasSecurityGuard: boolean;
			hasCctv: boolean;
			hasGenerator: boolean;
			hasWaterSupply: boolean;
			hasGasConnection: boolean;
			hasElectricity: boolean;
		};
	};
	unit: {
		unitCode: string;
		name: string;
		unitType: string;
		floorNumber: number;
		sizeSqFt: number;
		bedrooms: number;
		bathrooms: number;
		balconies: number;
		hasDrawingRoom?: boolean;
		hasDiningSpace?: boolean;
		hasKitchen?: boolean;
		isFurnished?: boolean;
		description?: string | null;
		imageUrls?: string[];
	};
	ownerContact: {
		name: string;
		phone: string;
	};
};

/** A consumer's auditable request for one public, active unit listing. */
export const toletBookingRequest = pgTable(
	"tolet_booking_request",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		publicNumber: integer("public_number").generatedAlwaysAsIdentity({
			name: "tolet_booking_request_public_number_seq",
			startWith: 200001,
		}),
		listingId: text("listing_id")
			.notNull()
			.references(() => toletUnitListing.id, { onDelete: "restrict" }),
		requesterUserId: text("requester_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		contactName: varchar("contact_name", { length: 150 }).notNull(),
		contactPhone: varchar("contact_phone", { length: 30 }).notNull(),
		desiredMoveInDate: date("desired_move_in_date").notNull(),
		message: text("message"),
		idempotencyKey: varchar("idempotency_key", { length: 36 }).notNull(),
		offerSnapshot: jsonb("offer_snapshot")
			.$type<ToletBookingOfferSnapshot>()
			.notNull(),
		listingUpdatedAtAtRequest: timestamp(
			"listing_updated_at_at_request",
		).notNull(),
		status: toletBookingRequestStatusEnum("status")
			.default("pending")
			.notNull(),
		responseNote: text("response_note"),
		respondedAt: timestamp("responded_at"),
		cancelledAt: timestamp("cancelled_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tolet_booking_request_public_number_unique").on(
			table.publicNumber,
		),
		uniqueIndex("tolet_booking_request_requester_idempotency_unique").on(
			table.requesterUserId,
			table.idempotencyKey,
		),
		uniqueIndex("tolet_booking_request_pending_requester_listing_unique")
			.on(table.requesterUserId, table.listingId)
			.where(sql`${table.status} = 'pending'`),
		uniqueIndex("tolet_booking_request_accepted_listing_unique")
			.on(table.listingId)
			.where(sql`${table.status} = 'accepted'`),
		index("tolet_booking_request_requester_status_idx").on(
			table.requesterUserId,
			table.status,
		),
		index("tolet_booking_request_listing_status_idx").on(
			table.listingId,
			table.status,
		),
		check(
			"tolet_booking_request_state_timestamps_valid",
			sql`(
				(${table.status} = 'pending' AND ${table.respondedAt} IS NULL AND ${table.cancelledAt} IS NULL)
				OR (${table.status} IN ('accepted', 'rejected') AND ${table.respondedAt} IS NOT NULL AND ${table.cancelledAt} IS NULL)
				OR (${table.status} = 'cancelled' AND ${table.respondedAt} IS NULL AND ${table.cancelledAt} IS NOT NULL)
			)`,
		),
	],
);

export const toletBookingRequestRelations = relations(
	toletBookingRequest,
	({ one }) => ({
		listing: one(toletUnitListing, {
			fields: [toletBookingRequest.listingId],
			references: [toletUnitListing.id],
		}),
		requester: one(user, {
			fields: [toletBookingRequest.requesterUserId],
			references: [user.id],
		}),
	}),
);

export type ToletBookingRequest = typeof toletBookingRequest.$inferSelect;
export type NewToletBookingRequest = typeof toletBookingRequest.$inferInsert;
