import { db } from "@bikalpo-project/db";
import {
	type ToletBookingOfferSnapshot,
	type ToletBookingRequest,
	type ToletProperty,
	type ToletUnit,
	type ToletUnitListing,
	toletBookingRequest,
	toletProperty,
	toletUnit,
	toletUnitListing,
} from "@bikalpo-project/db/schema";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { consumerProcedure } from "../index";
import { canCreateToLetBookingRequest } from "./helpers/tolet-booking-access";

const propertyCodeSchema = z
	.string()
	.trim()
	.regex(/^PR-20\d{2}-\d{6,10}$/, "Invalid Property ID");

const unitCodeSchema = z
	.string()
	.trim()
	.regex(/^UNT-\d{6,10}$/, "Invalid Unit ID");

const listingCodeSchema = z
	.string()
	.trim()
	.regex(/^LST-\d{6,10}$/, "Invalid Listing ID");

const qrTokenSchema = z.uuid("Invalid property QR token");

const bookingCodeSchema = z
	.string()
	.trim()
	.regex(/^BKG-\d{6,10}$/, "Invalid Booking ID");

function blankToUndefined(value: unknown) {
	if (value == null) return undefined;
	if (typeof value === "string" && value.trim() === "") return undefined;
	return value;
}

const optionalMessageSchema = z.preprocess(
	blankToUndefined,
	z.string().trim().max(1000).optional(),
);

const optionalResponseNoteSchema = z.preprocess(
	blankToUndefined,
	z.string().trim().max(2000).optional(),
);

function isValidIsoDate(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match?.[1] || !match[2] || !match[3]) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const parsed = new Date(Date.UTC(year, month - 1, day));
	return (
		parsed.getUTCFullYear() === year &&
		parsed.getUTCMonth() === month - 1 &&
		parsed.getUTCDate() === day
	);
}

const desiredMoveInDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a move-in date")
	.refine(isValidIsoDate, "Choose a valid move-in date");

const contactPhoneSchema = z
	.string()
	.trim()
	.min(7, "Enter a contact phone number")
	.max(30)
	.refine(
		(value) => /^\+?[0-9()\-.\s]+$/.test(value) && /\d/.test(value),
		"Enter a valid contact phone number",
	);

const createBookingInputSchema = z
	.object({
		listingCode: listingCodeSchema,
		qrToken: qrTokenSchema.optional(),
		idempotencyKey: z
			.uuid("Invalid request identifier")
			.transform((value) => value.toLowerCase()),
		desiredMoveInDate: desiredMoveInDateSchema,
		contactName: z.string().trim().min(1).max(150),
		contactPhone: contactPhoneSchema,
		message: optionalMessageSchema,
	})
	.strict();

const ownerUnitInputSchema = z
	.object({
		propertyCode: propertyCodeSchema,
		unitCode: unitCodeSchema,
	})
	.strict();

const ownerBookingMutationInputSchema = ownerUnitInputSchema
	.extend({
		bookingCode: bookingCodeSchema,
		responseNote: optionalResponseNoteSchema,
	})
	.strict();

function formatPropertyCode(
	property: Pick<ToletProperty, "createdAt" | "publicNumber">,
) {
	return `PR-${property.createdAt.getFullYear()}-${String(property.publicNumber).padStart(6, "0")}`;
}

function formatUnitCode(unit: Pick<ToletUnit, "publicNumber">) {
	return `UNT-${String(unit.publicNumber).padStart(6, "0")}`;
}

function formatListingCode(listing: Pick<ToletUnitListing, "publicNumber">) {
	return `LST-${String(listing.publicNumber).padStart(6, "0")}`;
}

function formatBookingCode(
	booking: Pick<ToletBookingRequest, "publicNumber">,
) {
	return `BKG-${String(booking.publicNumber).padStart(6, "0")}`;
}

function parsePropertyCode(propertyCode: string) {
	const match = /^PR-(20\d{2})-(\d{6,10})$/.exec(propertyCode);
	if (!match?.[1] || !match[2]) {
		throw new ORPCError("NOT_FOUND", { message: "Property not found" });
	}
	return { year: Number(match[1]), publicNumber: Number(match[2]) };
}

function parsePublicNumber(code: string, pattern: RegExp, message: string) {
	const match = pattern.exec(code);
	if (!match?.[1]) throw new ORPCError("NOT_FOUND", { message });
	return Number(match[1]);
}

function parseUnitCode(unitCode: string) {
	return parsePublicNumber(unitCode, /^UNT-(\d{6,10})$/, "Unit not found");
}

function parseListingCode(listingCode: string) {
	return parsePublicNumber(
		listingCode,
		/^LST-(\d{6,10})$/,
		"Listing not found",
	);
}

function parseBookingCode(bookingCode: string) {
	return parsePublicNumber(
		bookingCode,
		/^BKG-(\d{6,10})$/,
		"Booking request not found",
	);
}

function isUniqueViolation(error: unknown) {
	if (typeof error !== "object" || error === null) return false;
	const candidate = error as {
		code?: unknown;
		cause?: { code?: unknown };
	};
	return candidate.code === "23505" || candidate.cause?.code === "23505";
}

function dhakaDateString(date = new Date()) {
	const parts = new Intl.DateTimeFormat("en", {
		timeZone: "Asia/Dhaka",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((candidate) => candidate.type === type)?.value;
	return `${part("year")}-${part("month")}-${part("day")}`;
}

function offerSnapshotDto(
	snapshot: ToletBookingOfferSnapshot,
	revealPrices = false,
) {
	const visible = (setting: boolean | undefined) =>
		revealPrices || setting !== false;
	return {
		version: snapshot.version,
		capturedAt: snapshot.capturedAt,
		listingCode: snapshot.listing.listingCode,
		title: snapshot.listing.title,
		description: snapshot.listing.description,
		monthlyRent: visible(snapshot.listing.monthlyRentVisible)
			? snapshot.listing.monthlyRent
			: null,
		advanceAmount: visible(snapshot.listing.advanceAmountVisible)
			? snapshot.listing.advanceAmount
			: null,
		securityDeposit: visible(snapshot.listing.securityDepositVisible)
			? snapshot.listing.securityDeposit
			: null,
		serviceCharge: visible(snapshot.listing.serviceChargeVisible)
			? snapshot.listing.serviceCharge
			: null,
		serviceChargeIncluded: snapshot.listing.serviceChargeIncluded,
		parkingCharge: visible(snapshot.listing.parkingChargeVisible)
			? snapshot.listing.parkingCharge
			: null,
		parkingChargeIncluded: snapshot.listing.parkingChargeIncluded,
		utilityCharge: visible(snapshot.listing.utilityChargeVisible)
			? snapshot.listing.utilityCharge
			: null,
		utilityChargeIncluded: snapshot.listing.utilityChargeIncluded,
		availableFrom: snapshot.listing.availableFrom,
		preferredTenant: snapshot.listing.preferredTenant,
		hasInternet: snapshot.listing.hasInternet,
		otherFacilities: snapshot.listing.otherFacilities,
		imageUrl: snapshot.listing.imageUrl || null,
		property: {
			propertyCode: snapshot.property.propertyCode,
			name: snapshot.property.name,
			location: [
				snapshot.property.location.area,
				snapshot.property.location.district,
				snapshot.property.location.division,
			].join(", "),
			description: snapshot.property.description ?? null,
			facilities: snapshot.property.facilities ?? null,
		},
		unit: snapshot.unit,
		ownerContact: snapshot.ownerContact,
	};
}

function bookingDto(booking: ToletBookingRequest, revealPrices = false) {
	return {
		bookingCode: formatBookingCode(booking),
		status: booking.status,
		contactName: booking.contactName,
		contactPhone: booking.contactPhone,
		desiredMoveInDate: booking.desiredMoveInDate,
		message: booking.message,
		responseNote: booking.responseNote,
		respondedAt: booking.respondedAt?.toISOString() ?? null,
		cancelledAt: booking.cancelledAt?.toISOString() ?? null,
		createdAt: booking.createdAt.toISOString(),
		updatedAt: booking.updatedAt.toISOString(),
		listingUpdatedAtAtRequest:
			booking.listingUpdatedAtAtRequest.toISOString(),
		offerSnapshot: offerSnapshotDto(booking.offerSnapshot, revealPrices),
	};
}

function createOfferSnapshot(
	row: {
		listing: ToletUnitListing;
		unit: ToletUnit;
		property: ToletProperty;
	},
	capturedAt: Date,
): ToletBookingOfferSnapshot {
	const { listing, unit, property } = row;
	const imageUrl =
		listing.imageUrls[0] ?? unit.imageUrls[0] ?? property.coverImageUrl;

	return {
		version: 1,
		capturedAt: capturedAt.toISOString(),
		listing: {
			listingCode: formatListingCode(listing),
			title: listing.title,
			description: listing.description,
			imageUrl,
			monthlyRent: Number(listing.monthlyRent),
			monthlyRentVisible: listing.monthlyRentVisible,
			advanceAmount: Number(listing.advanceAmount),
			advanceAmountVisible: listing.advanceAmountVisible,
			securityDeposit: Number(listing.securityDeposit),
			securityDepositVisible: listing.securityDepositVisible,
			serviceCharge: Number(listing.serviceCharge),
			serviceChargeVisible: listing.serviceChargeVisible,
			serviceChargeIncluded: listing.serviceChargeIncluded,
			parkingCharge: Number(listing.parkingCharge),
			parkingChargeVisible: listing.parkingChargeVisible,
			parkingChargeIncluded: listing.parkingChargeIncluded,
			utilityCharge: Number(listing.utilityCharge),
			utilityChargeVisible: listing.utilityChargeVisible,
			utilityChargeIncluded: listing.utilityChargeIncluded,
			availableFrom: listing.availableFrom,
			preferredTenant: listing.preferredTenant,
			hasInternet: listing.hasInternet,
			otherFacilities: listing.otherFacilities,
		},
		property: {
			propertyCode: formatPropertyCode(property),
			name: property.name,
			location: {
				division: property.division,
				district: property.district,
				area: property.area,
			},
			description: property.description,
			facilities: {
				hasParking: property.hasParking,
				hasLift: property.hasLift,
				hasSecurityGuard: property.hasSecurityGuard,
				hasCctv: property.hasCctv,
				hasGenerator: property.hasGenerator,
				hasWaterSupply: property.hasWaterSupply,
				hasGasConnection: property.hasGasConnection,
				hasElectricity: property.hasElectricity,
			},
		},
		unit: {
			unitCode: formatUnitCode(unit),
			name: unit.name,
			unitType: unit.unitType,
			floorNumber: unit.floorNumber,
			sizeSqFt: unit.sizeSqFt,
			bedrooms: unit.bedrooms,
			bathrooms: unit.bathrooms,
			balconies: unit.balconies,
			hasDrawingRoom: unit.hasDrawingRoom,
			hasDiningSpace: unit.hasDiningSpace,
			hasKitchen: unit.hasKitchen,
			isFurnished: unit.isFurnished,
			description: unit.description,
			imageUrls: unit.imageUrls,
		},
		ownerContact: {
			name: property.ownerName,
			phone: property.mobileNumber,
		},
	};
}

type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

function isSameCreateRequest(
	booking: ToletBookingRequest,
	input: CreateBookingInput,
) {
	return (
		booking.offerSnapshot.listing.listingCode === input.listingCode &&
		booking.contactName === input.contactName &&
		booking.contactPhone === input.contactPhone &&
		booking.desiredMoveInDate === input.desiredMoveInDate &&
		booking.message === (input.message ?? null)
	);
}

function idempotencyConflict() {
	return new ORPCError("CONFLICT", {
		message: "This request identifier was already used for different details",
	});
}

type OwnedBookingRow = {
	booking: ToletBookingRequest;
	listing: ToletUnitListing;
	unit: ToletUnit;
	property: ToletProperty;
};

function assertOwnedBookingIdentity(
	row: OwnedBookingRow | undefined,
	input: {
		propertyCode: string;
		unitCode: string;
		bookingCode: string;
	},
): asserts row is OwnedBookingRow {
	if (
		!row ||
		formatPropertyCode(row.property) !== input.propertyCode ||
		formatUnitCode(row.unit) !== input.unitCode ||
		formatBookingCode(row.booking) !== input.bookingCode
	) {
		throw new ORPCError("NOT_FOUND", {
			message: "Booking request not found",
		});
	}
}

export const toLetBookingRouter = {
	create: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/bookings",
			tags: ["To-Let Booking"],
			summary: "Request an active public or QR-authorized unit listing",
		})
		.input(createBookingInputSchema)
		.handler(async ({ context, input }) => {
			const requesterUserId = context.session.user.id;
			const listingPublicNumber = parseListingCode(input.listingCode);
			const [existing] = await db
				.select()
				.from(toletBookingRequest)
				.where(
					and(
						eq(toletBookingRequest.requesterUserId, requesterUserId),
						eq(toletBookingRequest.idempotencyKey, input.idempotencyKey),
					),
				)
				.limit(1);

			if (existing) {
				if (!isSameCreateRequest(existing, input)) throw idempotencyConflict();
				return { booking: bookingDto(existing) };
			}

			try {
				const booking = await db.transaction(async (tx) => {
					const [row] = await tx
						.select({
							listing: toletUnitListing,
							unit: toletUnit,
							property: toletProperty,
						})
						.from(toletUnitListing)
						.innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
						.innerJoin(
							toletProperty,
							eq(toletUnit.propertyId, toletProperty.id),
						)
						.where(eq(toletUnitListing.publicNumber, listingPublicNumber))
						.limit(1)
						.for("update");

					const [retry] = await tx
						.select()
						.from(toletBookingRequest)
						.where(
							and(
								eq(
									toletBookingRequest.requesterUserId,
									requesterUserId,
								),
								eq(
									toletBookingRequest.idempotencyKey,
									input.idempotencyKey,
								),
							),
						)
						.limit(1);

					if (retry) {
						if (!isSameCreateRequest(retry, input)) {
							throw idempotencyConflict();
						}
						return retry;
					}

					if (!row || formatListingCode(row.listing) !== input.listingCode) {
						throw new ORPCError("NOT_FOUND", {
							message: "Listing not found",
						});
					}
					const now = new Date();
					const canCreateBooking = canCreateToLetBookingRequest(
						{
							listingStatus: row.listing.status,
							unitStatus: row.unit.status,
							propertyStatus: row.property.status,
							visibility: row.listing.visibility,
							publishedAt: row.listing.publishedAt,
							createdAt: row.listing.createdAt,
							closedAt: row.listing.closedAt,
							requestedQrToken: input.qrToken,
							propertyQrToken: row.property.qrToken,
						},
						now,
					);
					if (!canCreateBooking) {
						throw new ORPCError("CONFLICT", {
							message: "This listing is not available for booking",
						});
					}
					if (row.property.ownerUserId === requesterUserId) {
						throw new ORPCError("FORBIDDEN", {
							message: "You cannot request a booking for your own property",
						});
					}

					const today = dhakaDateString(now);
					const earliestMoveInDate =
						row.listing.availableFrom > today
							? row.listing.availableFrom
							: today;
					if (input.desiredMoveInDate < earliestMoveInDate) {
						throw new ORPCError("BAD_REQUEST", {
							message: `Choose a move-in date on or after ${earliestMoveInDate}`,
						});
					}

					const [pendingRequest] = await tx
						.select({ id: toletBookingRequest.id })
						.from(toletBookingRequest)
						.where(
							and(
								eq(
									toletBookingRequest.requesterUserId,
									requesterUserId,
								),
								eq(toletBookingRequest.listingId, row.listing.id),
								eq(toletBookingRequest.status, "pending"),
							),
						)
						.limit(1);
					if (pendingRequest) {
						throw new ORPCError("CONFLICT", {
							message: "You already have a pending request for this listing",
						});
					}

					const [created] = await tx
						.insert(toletBookingRequest)
						.values({
							listingId: row.listing.id,
							requesterUserId,
							contactName: input.contactName,
							contactPhone: input.contactPhone,
							desiredMoveInDate: input.desiredMoveInDate,
							message: input.message ?? null,
							idempotencyKey: input.idempotencyKey,
							offerSnapshot: createOfferSnapshot(row, now),
							listingUpdatedAtAtRequest: row.listing.updatedAt,
							status: "pending",
							createdAt: now,
							updatedAt: now,
						})
						.onConflictDoNothing()
						.returning();

					if (created) return created;

					const [idempotent] = await tx
						.select()
						.from(toletBookingRequest)
						.where(
							and(
								eq(
									toletBookingRequest.requesterUserId,
									requesterUserId,
								),
								eq(
									toletBookingRequest.idempotencyKey,
									input.idempotencyKey,
								),
							),
						)
						.limit(1);

					if (idempotent) {
						if (!isSameCreateRequest(idempotent, input)) {
							throw idempotencyConflict();
						}
						return idempotent;
					}

					throw new ORPCError("CONFLICT", {
						message: "You already have a pending request for this listing",
					});
				});

				return { booking: bookingDto(booking) };
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ORPCError("CONFLICT", {
						message: "You already have a pending request for this listing",
					});
				}
				throw error;
			}
		}),

	listMine: consumerProcedure
		.route({
			method: "GET",
			path: "/to-let/bookings/mine",
			tags: ["To-Let Booking"],
			summary: "List my To-Let booking requests",
		})
		.handler(async ({ context }) => {
			const bookings = await db
				.select()
				.from(toletBookingRequest)
				.where(
					eq(
						toletBookingRequest.requesterUserId,
						context.session.user.id,
					),
				)
				.orderBy(desc(toletBookingRequest.createdAt))
				.limit(100);
			return { bookings: bookings.map((booking) => bookingDto(booking)) };
		}),

	cancelMine: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/bookings/{bookingCode}/cancel",
			tags: ["To-Let Booking"],
			summary: "Cancel my pending To-Let booking request",
		})
		.input(z.object({ bookingCode: bookingCodeSchema }).strict())
		.handler(async ({ context, input }) => {
			const bookingPublicNumber = parseBookingCode(input.bookingCode);
			const booking = await db.transaction(async (tx) => {
				const [owned] = await tx
					.select()
					.from(toletBookingRequest)
					.where(
						and(
							eq(toletBookingRequest.publicNumber, bookingPublicNumber),
							eq(
								toletBookingRequest.requesterUserId,
								context.session.user.id,
							),
						),
					)
					.limit(1)
					.for("update");

				if (!owned || formatBookingCode(owned) !== input.bookingCode) {
					throw new ORPCError("NOT_FOUND", {
						message: "Booking request not found",
					});
				}
				if (owned.status !== "pending") {
					throw new ORPCError("CONFLICT", {
						message: "Only a pending booking request can be cancelled",
					});
				}

				const now = new Date();
				const [cancelled] = await tx
					.update(toletBookingRequest)
					.set({
						status: "cancelled",
						cancelledAt: now,
						updatedAt: now,
					})
					.where(
						and(
							eq(toletBookingRequest.id, owned.id),
							eq(toletBookingRequest.status, "pending"),
						),
					)
					.returning();

				if (!cancelled) {
					throw new ORPCError("CONFLICT", {
						message: "The booking request status changed before cancellation",
					});
				}
				return cancelled;
			});

			return { booking: bookingDto(booking) };
		}),

	listOwnerForUnit: consumerProcedure
		.route({
			method: "GET",
			path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/booking-requests",
			tags: ["To-Let Booking"],
			summary: "List booking requests for an owned unit",
		})
		.input(ownerUnitInputSchema)
		.handler(async ({ context, input }) => {
			const propertyIdentity = parsePropertyCode(input.propertyCode);
			const unitPublicNumber = parseUnitCode(input.unitCode);
			const [owned] = await db
				.select({ unit: toletUnit, property: toletProperty })
				.from(toletUnit)
				.innerJoin(
					toletProperty,
					eq(toletUnit.propertyId, toletProperty.id),
				)
				.where(
					and(
						eq(toletUnit.publicNumber, unitPublicNumber),
						eq(toletProperty.publicNumber, propertyIdentity.publicNumber),
						eq(toletProperty.ownerUserId, context.session.user.id),
					),
				)
				.limit(1);

			if (
				!owned ||
				owned.property.createdAt.getFullYear() !== propertyIdentity.year ||
				formatPropertyCode(owned.property) !== input.propertyCode ||
				formatUnitCode(owned.unit) !== input.unitCode
			) {
				throw new ORPCError("NOT_FOUND", { message: "Unit not found" });
			}
			if (owned.property.status !== "active") {
				return { bookings: [] };
			}
			const hasRequestInbox = owned.unit.status === "vacant";
			const hasTenant =
				owned.unit.status === "booked" || owned.unit.status === "occupied";
			if (!hasRequestInbox && !hasTenant) {
				return { bookings: [] };
			}

			const [relevantListing] = await db
				.select({ id: toletUnitListing.id })
				.from(toletUnitListing)
				.where(
					and(
						eq(toletUnitListing.unitId, owned.unit.id),
						eq(
							toletUnitListing.status,
							hasRequestInbox ? "active" : "closed",
						),
					),
				)
				.orderBy(desc(toletUnitListing.createdAt))
				.limit(1);

			if (!relevantListing) {
				return { bookings: [] };
			}
			const bookingScope = hasRequestInbox
				? eq(toletBookingRequest.listingId, relevantListing.id)
				: and(
						eq(toletBookingRequest.listingId, relevantListing.id),
						eq(toletBookingRequest.status, "accepted"),
					);

			const bookings = await db
				.select({ booking: toletBookingRequest })
				.from(toletBookingRequest)
				.where(bookingScope)
				.orderBy(desc(toletBookingRequest.createdAt))
				.limit(100);

			return {
				bookings: bookings.map(({ booking }) => bookingDto(booking, true)),
			};
		}),

	accept: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/booking-requests/{bookingCode}/accept",
			tags: ["To-Let Booking"],
			summary: "Accept a pending booking request for an owned unit",
		})
		.input(ownerBookingMutationInputSchema)
		.handler(async ({ context, input }) => {
			const propertyIdentity = parsePropertyCode(input.propertyCode);
			const unitPublicNumber = parseUnitCode(input.unitCode);
			const bookingPublicNumber = parseBookingCode(input.bookingCode);

			try {
				const booking = await db.transaction(async (tx) => {
					const [owned] = await tx
						.select({
							booking: toletBookingRequest,
							listing: toletUnitListing,
							unit: toletUnit,
							property: toletProperty,
						})
						.from(toletBookingRequest)
						.innerJoin(
							toletUnitListing,
							eq(toletBookingRequest.listingId, toletUnitListing.id),
						)
						.innerJoin(
							toletUnit,
							eq(toletUnitListing.unitId, toletUnit.id),
						)
						.innerJoin(
							toletProperty,
							eq(toletUnit.propertyId, toletProperty.id),
						)
						.where(
							and(
								eq(
									toletBookingRequest.publicNumber,
									bookingPublicNumber,
								),
								eq(toletUnit.publicNumber, unitPublicNumber),
								eq(
									toletProperty.publicNumber,
									propertyIdentity.publicNumber,
								),
								eq(
									toletProperty.ownerUserId,
									context.session.user.id,
								),
							),
						)
						.limit(1)
						.for("update");

					assertOwnedBookingIdentity(owned, input);
					if (owned.booking.status !== "pending") {
						throw new ORPCError("CONFLICT", {
							message: "Only a pending booking request can be accepted",
						});
					}
					if (owned.property.status !== "active") {
						throw new ORPCError("CONFLICT", {
							message: "Only an active property can accept booking requests",
						});
					}
					if (owned.unit.status !== "vacant") {
						throw new ORPCError("CONFLICT", {
							message: "Only a vacant unit can accept a booking request",
						});
					}
					if (owned.listing.status !== "active") {
						throw new ORPCError("CONFLICT", {
							message: "Only an active listing can accept a booking request",
						});
					}

					const now = new Date();
					const [bookedUnit] = await tx
						.update(toletUnit)
						.set({ status: "booked", updatedAt: now })
						.where(
							and(
								eq(toletUnit.id, owned.unit.id),
								eq(toletUnit.status, "vacant"),
							),
						)
						.returning({ id: toletUnit.id });
					if (!bookedUnit) {
						throw new ORPCError("CONFLICT", {
							message: "The unit status changed before acceptance",
						});
					}

					const [closedListing] = await tx
						.update(toletUnitListing)
						.set({ status: "closed", closedAt: now, updatedAt: now })
						.where(
							and(
								eq(toletUnitListing.id, owned.listing.id),
								eq(toletUnitListing.status, "active"),
							),
						)
						.returning({ id: toletUnitListing.id });
					if (!closedListing) {
						throw new ORPCError("CONFLICT", {
							message: "The listing status changed before acceptance",
						});
					}

					const [accepted] = await tx
						.update(toletBookingRequest)
						.set({
							status: "accepted",
							responseNote: input.responseNote ?? null,
							respondedAt: now,
							updatedAt: now,
						})
						.where(
							and(
								eq(toletBookingRequest.id, owned.booking.id),
								eq(toletBookingRequest.status, "pending"),
							),
						)
						.returning();
					if (!accepted) {
						throw new ORPCError("CONFLICT", {
							message: "The booking request status changed before acceptance",
						});
					}

					await tx
						.update(toletBookingRequest)
						.set({
							status: "rejected",
							responseNote: "Another booking request was accepted",
							respondedAt: now,
							updatedAt: now,
						})
						.where(
							and(
								eq(toletBookingRequest.listingId, owned.listing.id),
								eq(toletBookingRequest.status, "pending"),
								ne(toletBookingRequest.id, owned.booking.id),
							),
						);

					return accepted;
				});

				return { booking: bookingDto(booking, true) };
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new ORPCError("CONFLICT", {
						message: "This listing already has an accepted booking request",
					});
				}
				throw error;
			}
		}),

	reject: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/owner/properties/{propertyCode}/units/{unitCode}/booking-requests/{bookingCode}/reject",
			tags: ["To-Let Booking"],
			summary: "Reject a pending booking request for an owned unit",
		})
		.input(ownerBookingMutationInputSchema)
		.handler(async ({ context, input }) => {
			const propertyIdentity = parsePropertyCode(input.propertyCode);
			const unitPublicNumber = parseUnitCode(input.unitCode);
			const bookingPublicNumber = parseBookingCode(input.bookingCode);

			const booking = await db.transaction(async (tx) => {
				const [owned] = await tx
					.select({
						booking: toletBookingRequest,
						listing: toletUnitListing,
						unit: toletUnit,
						property: toletProperty,
					})
					.from(toletBookingRequest)
					.innerJoin(
						toletUnitListing,
						eq(toletBookingRequest.listingId, toletUnitListing.id),
					)
					.innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
					.innerJoin(
						toletProperty,
						eq(toletUnit.propertyId, toletProperty.id),
					)
					.where(
						and(
							eq(toletBookingRequest.publicNumber, bookingPublicNumber),
							eq(toletUnit.publicNumber, unitPublicNumber),
							eq(
								toletProperty.publicNumber,
								propertyIdentity.publicNumber,
							),
							eq(toletProperty.ownerUserId, context.session.user.id),
						),
					)
					.limit(1)
					.for("update");

				assertOwnedBookingIdentity(owned, input);
				if (owned.booking.status !== "pending") {
					throw new ORPCError("CONFLICT", {
						message: "Only a pending booking request can be rejected",
					});
				}
				if (owned.property.status !== "active") {
					throw new ORPCError("CONFLICT", {
						message: "Only an active property can reject booking requests",
					});
				}
				if (owned.unit.status !== "vacant") {
					throw new ORPCError("CONFLICT", {
						message: "Only a vacant unit can reject a booking request",
					});
				}
				if (owned.listing.status !== "active") {
					throw new ORPCError("CONFLICT", {
						message: "Only an active listing can reject a booking request",
					});
				}

				const now = new Date();
				const [rejected] = await tx
					.update(toletBookingRequest)
					.set({
						status: "rejected",
						responseNote: input.responseNote ?? null,
						respondedAt: now,
						updatedAt: now,
					})
					.where(
						and(
							eq(toletBookingRequest.id, owned.booking.id),
							eq(toletBookingRequest.status, "pending"),
						),
					)
					.returning();

				if (!rejected) {
					throw new ORPCError("CONFLICT", {
						message: "The booking request status changed before rejection",
					});
				}
				return rejected;
			});

			return { booking: bookingDto(booking, true) };
		}),
};
