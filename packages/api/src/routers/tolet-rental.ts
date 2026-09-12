import { unitLocationLabel } from "../lib/tolet-unit-address";
import { db } from "@bikalpo-project/db";
import {
	toletBookingRequest,
	toletAlertNotification,
	toletProperty,
	toletRentalAlert,
	toletRentalComment,
	toletRentalContract,
	toletRentPayment,
	toletUnit,
	toletUnitListing,
	user,
} from "@bikalpo-project/db/schema";
import { env } from "@bikalpo-project/env/server";
import { ORPCError } from "@orpc/server";
import { and, asc, count, desc, eq, inArray, isNull, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { consumerProcedure, publicProcedure } from "../index";
import { canAccessToLetRentalDetails, isToLetCalendarDate, toLetDhakaDateString } from "./helpers/tolet-rental-lifecycle";
import { toLetRentOtp, verifyToLetRentPayment } from "../services/tolet-rent-payment";
import { ownerUnitRentalHistoryProcedure } from "./tolet-owner-rental-history";
import { syncToLetAlertNotifications } from "../services/tolet-alert-notifications";
import { saveToLetAlert } from "../services/tolet-saved-alerts";
import { toLetMarketplaceStatus } from "./helpers/tolet-marketplace-visibility";
import {
	completeExpiredToLetContract,
	ensureToLetRentCycles,
	TO_LET_RENT_DUE_DAY,
	type ToLetContractRow,
} from "../services/tolet-rental-lifecycle";

const bookingCodeSchema = z
	.string()
	.trim()
	.regex(/^BKG-\d{6,10}$/, "Invalid Booking ID");
const propertyCodeSchema = z
	.string()
	.trim()
	.regex(/^PR-20\d{2}-\d{6,10}$/, "Invalid Property ID");
const unitCodeSchema = z
	.string()
	.trim()
	.regex(/^UNT-\d{6,10}$/, "Invalid Unit ID");
const dateSchema = z.string().refine(isToLetCalendarDate, "Enter a valid calendar date (YYYY-MM-DD)");

function publicNumber(code: string) {
	const value = Number(code.split("-").at(-1));
	if (!Number.isSafeInteger(value)) {
		throw new ORPCError("NOT_FOUND", { message: "Record not found" });
	}
	return value;
}

function contractCode(value: number) {
	return `CTR-${String(value).padStart(6, "0")}`;
}

async function contractContext(bookingCode: string, userId: string) {
	const bookingNumber = publicNumber(bookingCode);
	const [row] = await db
		.select({
			contract: toletRentalContract,
			booking: toletBookingRequest,
			unit: toletUnit,
			property: toletProperty,
		})
		.from(toletRentalContract)
		.innerJoin(
			toletBookingRequest,
			eq(toletRentalContract.bookingRequestId, toletBookingRequest.id),
		)
		.innerJoin(toletUnit, eq(toletRentalContract.unitId, toletUnit.id))
		.innerJoin(
			toletProperty,
			eq(toletRentalContract.propertyId, toletProperty.id),
		)
		.where(eq(toletBookingRequest.publicNumber, bookingNumber))
		.limit(1);

	if (
		!row ||
		(row.contract.tenantUserId !== userId &&
			row.contract.ownerUserId !== userId)
	) {
		throw new ORPCError("NOT_FOUND", { message: "Rental contract not found" });
	}
	const previousStatus = row.contract.status;
	row.contract = await completeExpiredToLetContract(
		row.contract as ToLetContractRow,
	);
	if (previousStatus !== row.contract.status) {
		const [currentUnit] = await db.select().from(toletUnit).where(eq(toletUnit.id, row.unit.id)).limit(1);
		if (currentUnit) row.unit = currentUnit;
	}
	if (!canAccessToLetRentalDetails(row.contract, userId)) {
		throw new ORPCError("FORBIDDEN", {
			message: "This rental period has ended. Find this rental in Rental History.",
		});
	}
	await ensureToLetRentCycles(row.contract as ToLetContractRow);
	return row;
}

async function rentalDto(bookingCode: string, userId: string) {
	const row = await contractContext(bookingCode, userId);
	const payments = await db
		.select()
		.from(toletRentPayment)
		.where(eq(toletRentPayment.contractId, row.contract.id))
		.orderBy(asc(toletRentPayment.cycleMonth));
	const isOwner = row.contract.ownerUserId === userId;
	const today = toLetDhakaDateString();
	const canShowOtp = isOwner && ["active", "leaving"].includes(row.contract.status) &&
		row.contract.startDate <= today && row.contract.endDate >= today;
	const comments = await db
		.select()
		.from(toletRentalComment)
		.where(eq(toletRentalComment.contractId, row.contract.id))
		.orderBy(asc(toletRentalComment.createdAt));

	return {
		contractCode: contractCode(row.contract.publicNumber),
		tenantId: row.contract.tenantUserId,
		status: row.contract.status,
		startDate: row.contract.startDate,
		endDate: row.contract.endDate,
		rentDueDay: row.contract.rentDueDay,
		monthlyRent: Number(row.contract.monthlyRent),
		advanceAmount: Number(row.contract.advanceAmount),
		securityDeposit: Number(row.contract.securityDeposit),
		serviceCharge: Number(row.contract.serviceCharge),
		parkingCharge: Number(row.contract.parkingCharge),
		utilityCharge: Number(row.contract.utilityCharge),
		activatedAt: row.contract.activatedAt.toISOString(),
		leaveRequestedAt: row.contract.leaveRequestedAt?.toISOString() ?? null,
		accessEndsAt: row.contract.accessEndsAt?.toISOString() ?? null,
		completedAt: row.contract.completedAt?.toISOString() ?? null,
		unitStatus: row.unit.status,
		payments: payments.map((payment) => ({
			cycleMonth: payment.cycleMonth,
			dueDate: payment.dueDate,
			amount: Number(payment.amount),
			referenceName: payment.referenceName,
			status: payment.status,
			verifiedAt: payment.verifiedAt?.toISOString() ?? null,
			otp:
				canShowOtp && payment.status === "pending" && payment.dueDate <= today
					? toLetRentOtp(row.contract.id, payment.cycleMonth, env.BETTER_AUTH_SECRET)
					: null,
		})),
		comments: comments.map((comment) => ({
			id: comment.id,
			body: comment.body,
			rating: comment.rating,
			isMine: comment.authorUserId === userId,
			createdAt: comment.createdAt.toISOString(),
		})),
	};
}

const alertCategorySchema = z.enum([
	"any",
	"family_flat",
	"bachelor_room",
	"sublet",
	"family_sublet",
	"bachelor_sublet",
	"shop",
	"office",
	"warehouse",
	"factory",
	"garage",
	"other",
]);

const alertFields = {
	preferredCategory: alertCategorySchema,
	preferredLocation: z.string().trim().min(2).max(200),
	minimumSizeSqFt: z.number().int().min(0).max(1_000_000),
	minimumBedrooms: z.number().int().min(0).max(100),
	minimumBathrooms: z.number().int().min(0).max(100),
	minimumBalconies: z.number().int().min(0).max(100),
	balconyPreference: z.enum(["required", "optional", "not_required"]),
	preferredFloor: z.string().trim().min(1).max(30),
} as const;

function alertDto(alert: typeof toletRentalAlert.$inferSelect) {
	return {
		id: alert.id,
		preferredCategory: alert.preferredCategory,
		preferredLocation: alert.preferredLocation,
		minimumSizeSqFt: alert.minimumSizeSqFt,
		minimumBedrooms: alert.minimumBedrooms,
		minimumBathrooms: alert.minimumBathrooms,
		minimumBalconies: alert.minimumBalconies,
		balconyPreference: alert.balconyPreference,
		preferredFloor: alert.preferredFloor,
		status: alert.status,
		createdAt: alert.createdAt.toISOString(),
		updatedAt: alert.updatedAt.toISOString(),
	};
}

export const toLetRentalRouter = {
	getOwnerUnitHistory: ownerUnitRentalHistoryProcedure,
	listPublicReviews: publicProcedure
		.route({ method: "GET", path: "/to-let/reviews", tags: ["To-Let Rental"] })
		.input(z.object({ page: z.number().int().min(1).max(10000).default(1), limit: z.number().int().min(1).max(20).default(6) }).strict())
		.handler(async ({ input }) => {
			if (process.env.TOLET_PUBLIC_REVIEWS_ENABLED !== "true") return { reviews: [] as { id: string; body: string; rating: number | null; createdAt: Date; authorName: string }[], total: 0, page: input.page, limit: input.limit, enabled: false };
			const scope = and(sql`"tolet_rental_comment"."is_public" = true`, eq(toletRentalComment.authorUserId, toletRentalContract.tenantUserId));
			const [reviews, totals] = await Promise.all([
				db.select({ id: toletRentalComment.id, body: toletRentalComment.body, rating: toletRentalComment.rating, createdAt: toletRentalComment.createdAt, authorName: user.name })
					.from(toletRentalComment).innerJoin(toletRentalContract, eq(toletRentalComment.contractId, toletRentalContract.id)).innerJoin(user, eq(toletRentalComment.authorUserId, user.id))
					.where(scope).orderBy(desc(toletRentalComment.createdAt), desc(toletRentalComment.id)).limit(input.limit).offset((input.page - 1) * input.limit),
				db.select({ total: count() }).from(toletRentalComment).innerJoin(toletRentalContract, eq(toletRentalComment.contractId, toletRentalContract.id)).where(scope),
			]);
			return { reviews, total: totals[0]?.total ?? 0, page: input.page, limit: input.limit, enabled: true };
		}),
	eligibleReviewRentals: consumerProcedure
		.route({ method: "GET", path: "/to-let/reviews/eligible-rentals", tags: ["To-Let Rental"] })
		.handler(async ({ context }) => {
			const rows = await db.select({ publicNumber: toletBookingRequest.publicNumber, title: toletUnit.name, propertyName: toletProperty.name })
				.from(toletRentalContract).innerJoin(toletBookingRequest, eq(toletRentalContract.bookingRequestId, toletBookingRequest.id))
				.innerJoin(toletUnit, eq(toletRentalContract.unitId, toletUnit.id)).innerJoin(toletProperty, eq(toletRentalContract.propertyId, toletProperty.id))
				.where(and(eq(toletRentalContract.tenantUserId, context.session.user.id), inArray(toletRentalContract.status, ["active", "leaving"]), gte(toletRentalContract.endDate, toLetDhakaDateString())))
				.orderBy(desc(toletRentalContract.createdAt)).limit(100);
			return { rentals: rows.map(row => ({ bookingCode: `BKG-${String(row.publicNumber).padStart(6, "0")}`, title: `${row.propertyName} · ${row.title}` })) };
		}),
	listAlertNotifications: consumerProcedure
		.route({ method: "GET", path: "/to-let/alert-notifications", tags: ["To-Let Rental"], summary: "Discover and list my matched rental notifications" })
		.input(z.object({ page: z.number().int().min(1).max(10000).default(1) }))
		.handler(async ({ context, input }) => {
			const userId = context.session.user.id;
			await syncToLetAlertNotifications(userId);
			const scope = eq(toletAlertNotification.userId, userId);
			const [rows, totals, unread] = await Promise.all([
				db.select({ notification: toletAlertNotification, listing: toletUnitListing, unit: toletUnit, property: toletProperty })
					.from(toletAlertNotification)
					.innerJoin(toletUnitListing, eq(toletAlertNotification.listingId, toletUnitListing.id))
					.innerJoin(toletUnit, eq(toletUnitListing.unitId, toletUnit.id))
					.innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
					.where(scope).orderBy(desc(toletAlertNotification.createdAt), desc(toletAlertNotification.id)).limit(12).offset((input.page - 1) * 12),
				db.select({ value: count() }).from(toletAlertNotification).where(scope),
				db.select({ value: count() }).from(toletAlertNotification).where(and(scope, isNull(toletAlertNotification.readAt))),
			]);
			return {
				total: totals[0]?.value ?? 0, unreadCount: unread[0]?.value ?? 0,
				notifications: rows.map(({ notification, listing, unit, property }) => {
					const status = property.status === "active" && listing.visibility === "public"
						? toLetMarketplaceStatus({ listingStatus: listing.status, unitStatus: unit.status, publishedAt: listing.publishedAt, createdAt: listing.createdAt, closedAt: listing.closedAt }) : null;
					return {
						id: notification.id, createdAt: notification.createdAt.toISOString(), readAt: notification.readAt?.toISOString() ?? null,
						listing: status ? {
							listingCode: `LST-${String(listing.publicNumber).padStart(6, "0")}`,
							title: listing.title, propertyName: property.name, unitName: unit.name,
							location: unitLocationLabel(property, unit),
							unitType: unit.unitType, sizeSqFt: unit.sizeSqFt, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms,
							monthlyRent: listing.monthlyRentVisible ? Number(listing.monthlyRent) : null,
							imageUrl: listing.imageUrls[0] ?? unit.imageUrls[0] ?? property.coverImageUrl,
							imageUrls: Array.from(new Set([...listing.imageUrls, ...unit.imageUrls].filter(Boolean))),
							availableFrom: listing.availableFrom,
							facilities: [
								property.hasWaterSupply && "Water supply", property.hasGasConnection && "Gas connection",
								property.hasSecurityGuard && "Security", property.hasParking && "Parking",
								property.hasLift && "Lift", listing.hasInternet && "Internet",
							].filter((value): value is string => Boolean(value)),
							status,
						} : null,
					};
				}),
			};
		}),

	markAlertNotificationsRead: consumerProcedure
		.route({ method: "POST", path: "/to-let/alert-notifications/read", tags: ["To-Let Rental"], summary: "Mark my received rental alerts as read" })
		.input(z.object({ notificationIds: z.array(z.uuid()).min(1).max(12) }).strict())
		.handler(async ({ context, input }) => {
			await db.update(toletAlertNotification).set({ readAt: new Date() }).where(and(
				eq(toletAlertNotification.userId, context.session.user.id),
				inArray(toletAlertNotification.id, input.notificationIds), isNull(toletAlertNotification.readAt),
			));
			return { success: true };
		}),

	listAlerts: consumerProcedure
		.route({
			method: "GET",
			path: "/to-let/alerts",
			tags: ["To-Let Rental"],
			summary: "List my saved To-Let alerts",
		})
		.handler(async ({ context }) => {
			const alerts = await db
				.select()
				.from(toletRentalAlert)
				.where(eq(toletRentalAlert.userId, context.session.user.id))
				.orderBy(desc(toletRentalAlert.createdAt))
				.limit(50);

			return { alerts: alerts.map(alertDto) };
		}),

	createAlert: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/alerts",
			tags: ["To-Let Rental"],
			summary: "Create a saved To-Let alert",
		})
		.input(z.object(alertFields).strict())
		.handler(async ({ context, input }) => {
			const alert = await db.transaction(
				(tx) => saveToLetAlert(tx, context.session.user.id, input),
				{ isolationLevel: "read committed" },
			);
			return { alert: alertDto(alert) };
		}),

	deleteAlert: consumerProcedure
		.route({
			method: "DELETE",
			path: "/to-let/alerts/{alertId}",
			tags: ["To-Let Rental"],
			summary: "Delete one of my saved To-Let alerts",
		})
		.input(z.object({ alertId: z.uuid("Invalid alert ID") }).strict())
		.handler(async ({ context, input }) => {
			const [deleted] = await db.delete(toletRentalAlert)
				.where(and(
					eq(toletRentalAlert.id, input.alertId),
					eq(toletRentalAlert.userId, context.session.user.id),
				))
				.returning({ id: toletRentalAlert.id });
			if (!deleted) throw new ORPCError("NOT_FOUND", { message: "Alert not found" });
			return { success: true };
		}),

	updateAlertStatus: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/alerts/{alertId}/status",
			tags: ["To-Let Rental"],
			summary: "Pause or resume one of my saved To-Let alerts",
		})
		.input(
			z
				.object({
					alertId: z.uuid("Invalid alert ID"),
					status: z.enum(["active", "paused"]),
				})
				.strict(),
		)
		.handler(async ({ context, input }) => {
			const [alert] = await db
				.update(toletRentalAlert)
				.set({ status: input.status, updatedAt: new Date() })
				.where(
					and(
						eq(toletRentalAlert.id, input.alertId),
						eq(toletRentalAlert.userId, context.session.user.id),
						inArray(toletRentalAlert.status, ["active", "paused"]),
					),
				)
				.returning();

			if (!alert) {
				throw new ORPCError("NOT_FOUND", { message: "Alert not found" });
			}

			return { alert: alertDto(alert) };
		}),

	activate: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/owner/contracts/activate",
			tags: ["To-Let Rental"],
			summary: "Activate a contract for an accepted owned booking",
		})
		.input(
			z
				.object({
					propertyCode: propertyCodeSchema,
					unitCode: unitCodeSchema,
					bookingCode: bookingCodeSchema,
					startDate: dateSchema,
					endDate: dateSchema,
					rentDueDay: z.literal(TO_LET_RENT_DUE_DAY),
					contractSigned: z.literal(true),
				})
				.strict(),
		)
		.handler(async ({ context, input }) => {
			if (input.endDate < input.startDate) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Contract end date must be on or after the start date",
				});
			}
			const bookingNumber = publicNumber(input.bookingCode);
			const propertyNumber = publicNumber(input.propertyCode);
			const unitNumber = publicNumber(input.unitCode);
			const contract = await db.transaction(async (tx) => {
				const [row] = await tx
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
					.innerJoin(toletProperty, eq(toletUnit.propertyId, toletProperty.id))
					.where(
						and(
							eq(toletBookingRequest.publicNumber, bookingNumber),
							eq(toletProperty.publicNumber, propertyNumber),
							eq(toletUnit.publicNumber, unitNumber),
							eq(toletProperty.ownerUserId, context.session.user.id),
						),
					)
					.limit(1)
					.for("update");

				if (!row || row.booking.status !== "accepted") {
					throw new ORPCError("CONFLICT", {
						message: "Only an accepted booking can activate a contract",
					});
				}
				if (row.unit.status !== "booked") {
					throw new ORPCError("CONFLICT", {
						message: "The Unit must be booked before contract activation",
					});
				}

				const offer = row.booking.offerSnapshot.listing;
				const now = new Date();
				const [created] = await tx
					.insert(toletRentalContract)
					.values({
						bookingRequestId: row.booking.id,
						propertyId: row.property.id,
						unitId: row.unit.id,
						ownerUserId: row.property.ownerUserId,
						tenantUserId: row.booking.requesterUserId,
						startDate: input.startDate,
						endDate: input.endDate,
						rentDueDay: input.rentDueDay,
						monthlyRent: String(offer.monthlyRent),
						advanceAmount: String(offer.advanceAmount),
						securityDeposit: String(offer.securityDeposit),
						serviceCharge: String(offer.serviceCharge),
						parkingCharge: String(offer.parkingCharge),
						utilityCharge: String(offer.utilityCharge),
						status: "active",
						activatedAt: now,
						createdAt: now,
						updatedAt: now,
					})
					.returning();
				if (!created) throw new ORPCError("CONFLICT");
				await tx
					.update(toletUnit)
					.set({ status: "occupied", updatedAt: now })
					.where(
						and(eq(toletUnit.id, row.unit.id), eq(toletUnit.status, "booked")),
					);
				return created;
			});

			await ensureToLetRentCycles(contract as ToLetContractRow);
			return {
				contract: await rentalDto(input.bookingCode, context.session.user.id),
			};
		}),

	getForBooking: consumerProcedure
		.route({
			method: "GET",
			path: "/to-let/rentals/{bookingCode}",
			tags: ["To-Let Rental"],
			summary: "Get an owned or tenant rental contract",
		})
		.input(z.object({ bookingCode: bookingCodeSchema }).strict())
		.handler(async ({ context, input }) => {
			const bookingNumber = publicNumber(input.bookingCode);
			const [existingContract] = await db
				.select({ id: toletRentalContract.id })
				.from(toletRentalContract)
				.innerJoin(
					toletBookingRequest,
					eq(toletRentalContract.bookingRequestId, toletBookingRequest.id),
				)
				.where(eq(toletBookingRequest.publicNumber, bookingNumber))
				.limit(1);

			if (!existingContract) return { contract: null };
			return {
				contract: await rentalDto(input.bookingCode, context.session.user.id),
			};
		}),

	verifyPayment: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/rentals/{bookingCode}/payments/verify",
			tags: ["To-Let Rental"],
			summary: "Verify a monthly rent payment with the owner OTP",
		})
		.input(
			z
				.object({
					bookingCode: bookingCodeSchema,
					cycleMonth: dateSchema.refine(value => value.endsWith("-01"), "Select a valid rent month"),
					referenceName: z.string().trim().min(2).max(150),
					otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit rent OTP"),
				})
				.strict(),
		)
		.handler(async ({ context, input }) => {
			const row = await contractContext(
				input.bookingCode,
				context.session.user.id,
			);
			if (row.contract.tenantUserId !== context.session.user.id) {
				throw new ORPCError("FORBIDDEN", { message: "Tenant access required" });
			}
			const result = await db.transaction(tx => verifyToLetRentPayment(tx, {
				...input, contractId: row.contract.id, tenantUserId: context.session.user.id,
			}, env.BETTER_AUTH_SECRET), { isolationLevel: "read committed" });
			if (result.status === "forbidden") throw new ORPCError("FORBIDDEN", { message: "Tenant access required" });
			if (result.status === "rate_limited") throw new ORPCError("TOO_MANY_REQUESTS", { message: "Too many incorrect rent OTP attempts. Try again in 15 minutes." });
			if (result.status === "incorrect") throw new ORPCError("BAD_REQUEST", { message: "Incorrect rent OTP" });
			if (result.status !== "paid") {
				throw new ORPCError("CONFLICT", {
					message: "This rent cycle is already paid or unavailable",
				});
			}
			return { payment: result.payment };
		}),

	requestLeave: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/rentals/{bookingCode}/leave",
			tags: ["To-Let Rental"],
			summary: "Schedule contract completion and create the next rental alert",
		})
		.input(
			z
				.object({
					bookingCode: bookingCodeSchema,
					alert: z.object(alertFields).strict().optional(),
				})
				.strict(),
		)
		.handler(async ({ context, input }) => {
			const row = await contractContext(
				input.bookingCode,
				context.session.user.id,
			);
			if (row.contract.tenantUserId !== context.session.user.id) {
				throw new ORPCError("FORBIDDEN", { message: "Tenant access required" });
			}
			if (row.contract.status === "leaving") {
				return { contract: await rentalDto(input.bookingCode, context.session.user.id) };
			}
			if (row.contract.status !== "active") {
				throw new ORPCError("CONFLICT", {
					message: "Only an active rental can start the leave process",
				});
			}
			const now = new Date();
			const accessEndsAt = new Date(`${row.contract.endDate}T23:59:59+06:00`);
			await db.transaction(async (tx) => {
				const changed = await tx
					.update(toletRentalContract)
					.set({
						status: "leaving",
						leaveRequestedAt: now,
						accessEndsAt,
						updatedAt: now,
					})
					.where(and(eq(toletRentalContract.id, row.contract.id), eq(toletRentalContract.status, "active")))
					.returning({ id: toletRentalContract.id });
				if (changed.length && input.alert) await saveToLetAlert(tx, context.session.user.id, input.alert, row.contract.id);
			}, { isolationLevel: "read committed" });
			return {
				contract: await rentalDto(input.bookingCode, context.session.user.id),
			};
		}),

	addComment: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/rentals/{bookingCode}/comments",
			tags: ["To-Let Rental"],
			summary: "Add verified tenant feedback to a rental",
		})
		.input(
			z
				.object({
					bookingCode: bookingCodeSchema,
					body: z.string().trim().min(3).max(2000),
					rating: z.number().int().min(1).max(5).optional(),
					isPublic: z.boolean().default(false),
				})
				.strict().refine(value => !value.isPublic || value.rating !== undefined, { message: "A rating is required for public reviews", path: ["rating"] }),
		)
		.handler(async ({ context, input }) => {
			if (input.isPublic && process.env.TOLET_PUBLIC_REVIEWS_ENABLED !== "true") throw new ORPCError("FORBIDDEN", { message: "Public reviews are not enabled yet" });
			const row = await contractContext(
				input.bookingCode,
				context.session.user.id,
			);
			if (row.contract.tenantUserId !== context.session.user.id) {
				throw new ORPCError("FORBIDDEN", { message: "Tenant access required" });
			}
			const comment = await db.transaction(async tx => {
			const [created] = await tx
				.insert(toletRentalComment)
				.values({
					contractId: row.contract.id,
					authorUserId: context.session.user.id,
					body: input.body,
					rating: input.rating,
				})
				.returning();
			if (input.isPublic && created) await tx.execute(sql`UPDATE "tolet_rental_comment" SET "is_public" = true WHERE "id" = ${created.id}`);
			return created;
			});
			return { comment };
		}),
};
