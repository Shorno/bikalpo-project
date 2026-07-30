import { db } from "@bikalpo-project/db";
import {
	toletBookingRequest,
	toletProperty,
	toletRentalAlert,
	toletRentalComment,
	toletRentalContract,
	toletRentPayment,
	toletUnit,
	toletUnitListing,
} from "@bikalpo-project/db/schema";
import { env } from "@bikalpo-project/env/server";
import { ORPCError } from "@orpc/server";
import { createHmac } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { consumerProcedure } from "../index";

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
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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

function dhakaDateString(date = new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Dhaka",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

function monthStart(value: string) {
	return `${value.slice(0, 7)}-01`;
}

function addMonth(value: string) {
	const [year, month] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year ?? 0, month ?? 0, 1));
	return date.toISOString().slice(0, 10);
}

function dueDate(cycleMonth: string, dueDay: number) {
	return `${cycleMonth.slice(0, 8)}${String(dueDay).padStart(2, "0")}`;
}

function rentOtp(contractId: string, cycleMonth: string) {
	const digest = createHmac("sha256", env.BETTER_AUTH_SECRET)
		.update(`tolet-rent:${contractId}:${cycleMonth}`)
		.digest("hex");
	return String(Number.parseInt(digest.slice(0, 12), 16) % 1_000_000).padStart(
		6,
		"0",
	);
}

type ContractRow = typeof toletRentalContract.$inferSelect;

async function ensureRentCycles(contract: ContractRow) {
	const lastMonth = monthStart(
		contract.endDate < dhakaDateString() ? contract.endDate : dhakaDateString(),
	);
	let cycle = monthStart(contract.startDate);
	const rows: Array<{
		contractId: string;
		cycleMonth: string;
		dueDate: string;
		amount: string;
	}> = [];

	for (let count = 0; count < 240 && cycle <= lastMonth; count += 1) {
		rows.push({
			contractId: contract.id,
			cycleMonth: cycle,
			dueDate: dueDate(cycle, contract.rentDueDay),
			amount: contract.monthlyRent,
		});
		cycle = addMonth(cycle);
	}

	if (rows.length > 0) {
		await db.insert(toletRentPayment).values(rows).onConflictDoNothing();
	}
}

async function completeExpiredLeave(contract: ContractRow) {
	if (contract.status !== "leaving" || contract.endDate >= dhakaDateString()) {
		return contract;
	}
	const now = new Date();
	const completed = await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(toletRentalContract)
			.set({ status: "completed", completedAt: now, updatedAt: now })
			.where(
				and(
					eq(toletRentalContract.id, contract.id),
					eq(toletRentalContract.status, "leaving"),
				),
			)
			.returning();
		if (updated) {
			await tx
				.update(toletUnit)
				.set({ status: "vacant", updatedAt: now })
				.where(eq(toletUnit.id, contract.unitId));
		}
		return updated ?? contract;
	});
	return completed;
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
		(row.contract.tenantUserId !== userId && row.contract.ownerUserId !== userId)
	) {
		throw new ORPCError("NOT_FOUND", { message: "Rental contract not found" });
	}
	row.contract = await completeExpiredLeave(row.contract);
	await ensureRentCycles(row.contract);
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
	const comments = await db
		.select()
		.from(toletRentalComment)
		.where(eq(toletRentalComment.contractId, row.contract.id))
		.orderBy(asc(toletRentalComment.createdAt));

	return {
		contractCode: contractCode(row.contract.publicNumber),
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
			otp: isOwner && payment.status === "pending"
				? rentOtp(row.contract.id, payment.cycleMonth)
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

const alertFields = {
	preferredCategory: z.string().trim().min(1).max(50),
	preferredLocation: z.string().trim().min(2).max(200),
	minimumSizeSqFt: z.number().int().min(0).max(1_000_000),
	minimumBedrooms: z.number().int().min(0).max(100),
	minimumBathrooms: z.number().int().min(0).max(100),
	minimumBalconies: z.number().int().min(0).max(100),
	balconyPreference: z.enum(["required", "optional", "not_required"]),
	preferredFloor: z.string().trim().min(1).max(30),
} as const;

export const toLetRentalRouter = {
	createAlert: consumerProcedure
		.route({
			method: "POST",
			path: "/to-let/alerts",
			tags: ["To-Let Rental"],
			summary: "Create a saved To-Let alert",
		})
		.input(z.object(alertFields).strict())
		.handler(async ({ context, input }) => {
			const [alert] = await db
				.insert(toletRentalAlert)
				.values({ userId: context.session.user.id, ...input })
				.returning({ id: toletRentalAlert.id, status: toletRentalAlert.status });
			return { alert };
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
					rentDueDay: z.number().int().min(1).max(28),
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

			await ensureRentCycles(contract);
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
					cycleMonth: dateSchema,
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
			if (input.otp !== rentOtp(row.contract.id, input.cycleMonth)) {
				throw new ORPCError("BAD_REQUEST", { message: "Incorrect rent OTP" });
			}
			const now = new Date();
			const [payment] = await db
				.update(toletRentPayment)
				.set({
					referenceName: input.referenceName,
					status: "paid",
					verifiedAt: now,
					updatedAt: now,
				})
				.where(
					and(
						eq(toletRentPayment.contractId, row.contract.id),
						eq(toletRentPayment.cycleMonth, input.cycleMonth),
						eq(toletRentPayment.status, "pending"),
					),
				)
				.returning();
			if (!payment) {
				throw new ORPCError("CONFLICT", {
					message: "This rent cycle is already paid or unavailable",
				});
			}
			return { payment: { cycleMonth: payment.cycleMonth, status: payment.status } };
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
				.object({ bookingCode: bookingCodeSchema, alert: z.object(alertFields).strict() })
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
			if (row.contract.status !== "active") {
				throw new ORPCError("CONFLICT", {
					message: "Only an active rental can start the leave process",
				});
			}
			const now = new Date();
			const accessEndsAt = new Date(`${row.contract.endDate}T23:59:59+06:00`);
			await db.transaction(async (tx) => {
				await tx
					.update(toletRentalContract)
					.set({
						status: "leaving",
						leaveRequestedAt: now,
						accessEndsAt,
						updatedAt: now,
					})
					.where(eq(toletRentalContract.id, row.contract.id));
				await tx.insert(toletRentalAlert).values({
					userId: context.session.user.id,
					sourceContractId: row.contract.id,
					...input.alert,
				});
			});
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
			const [comment] = await db
				.insert(toletRentalComment)
				.values({
					contractId: row.contract.id,
					authorUserId: context.session.user.id,
					body: input.body,
					rating: input.rating,
				})
				.returning();
			return { comment };
		}),
};
