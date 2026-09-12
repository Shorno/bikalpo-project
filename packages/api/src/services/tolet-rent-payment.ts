import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { db } from "@bikalpo-project/db";
import { toletRentalContract, toletRentPayment, verification } from "@bikalpo-project/db/schema";
import { and, eq } from "drizzle-orm";
import { isToLetCalendarDate, toLetDhakaDateString } from "../routers/helpers/tolet-rental-lifecycle";

type PaymentTransaction = Pick<typeof db, "select" | "update" | "insert" | "delete">;

export const TO_LET_RENT_OTP_ATTEMPTS = 5;
export const TO_LET_RENT_OTP_COOLDOWN_MS = 15 * 60 * 1_000;

export function toLetRentOtp(contractId: string, cycleMonth: string, secret: string) {
	const digest = createHmac("sha256", secret)
		.update(`tolet-rent:${contractId}:${cycleMonth}`).digest("hex");
	return String(Number.parseInt(digest.slice(0, 12), 16) % 1_000_000).padStart(6, "0");
}

export function toLetRentOtpMatches(otp: string, expected: string) {
	return /^\d{6}$/.test(otp) && /^\d{6}$/.test(expected) &&
		timingSafeEqual(Buffer.from(otp), Buffer.from(expected));
}

export function toLetRentOtpAttemptId(contractId: string, cycleMonth: string) {
	return `tolet-rent-otp:${createHash("sha256").update(`${contractId}:${cycleMonth}`).digest("hex")}`;
}

type PaymentInput = {
	contractId: string;
	tenantUserId: string;
	cycleMonth: string;
	referenceName: string;
	otp: string;
};

// Call inside a transaction, and throw user-facing errors AFTER it commits.
// Otherwise a bad-OTP exception would roll back the persisted attempt counter.
export async function verifyToLetRentPayment(
	tx: PaymentTransaction,
	input: PaymentInput,
	secret: string,
	now = new Date(),
) {
	const today = toLetDhakaDateString(now);
	const [contract] = await tx.select().from(toletRentalContract)
		.where(and(eq(toletRentalContract.id, input.contractId), eq(toletRentalContract.tenantUserId, input.tenantUserId)))
		.limit(1).for("update");
	if (!contract) return { status: "forbidden" } as const;
	if (!isToLetCalendarDate(input.cycleMonth) || !input.cycleMonth.endsWith("-01") ||
		!(["active", "leaving"].includes(contract.status)) || contract.startDate > today || contract.endDate < today) {
		return { status: "unavailable" } as const;
	}
	const [payment] = await tx.select().from(toletRentPayment)
		.where(and(eq(toletRentPayment.contractId, contract.id), eq(toletRentPayment.cycleMonth, input.cycleMonth)))
		.limit(1).for("update");
	if (!payment || payment.status !== "pending" || payment.dueDate > today ||
		input.cycleMonth < `${contract.startDate.slice(0, 7)}-01` || input.cycleMonth > `${today.slice(0, 7)}-01`) {
		return { status: "unavailable" } as const;
	}

	// Reuse the shared, expiring verification store under an isolated namespace.
	// The contract/payment row locks serialize all attempts across API instances;
	// process restarts or parallel requests cannot reset or evade the counter.
	const attemptId = toLetRentOtpAttemptId(contract.id, input.cycleMonth);
	const [stored] = await tx.select().from(verification).where(eq(verification.id, attemptId)).limit(1);
	const liveAttempt = stored && stored.expiresAt > now ? stored : undefined;
	const parsedCount = Number(liveAttempt?.value ?? 0);
	const attempts = Number.isSafeInteger(parsedCount) && parsedCount >= 0 ? parsedCount : TO_LET_RENT_OTP_ATTEMPTS;
	if (attempts >= TO_LET_RENT_OTP_ATTEMPTS) return { status: "rate_limited" } as const;

	if (!toLetRentOtpMatches(input.otp, toLetRentOtp(contract.id, input.cycleMonth, secret))) {
		const value = String(attempts + 1);
		const expiresAt = liveAttempt?.expiresAt ?? new Date(now.getTime() + TO_LET_RENT_OTP_COOLDOWN_MS);
		await tx.insert(verification).values({ id: attemptId, identifier: attemptId, value, expiresAt, createdAt: now, updatedAt: now })
			.onConflictDoUpdate({ target: verification.id, set: { value, expiresAt, updatedAt: now } });
		return { status: "incorrect" } as const;
	}
	const [updated] = await tx.update(toletRentPayment)
		.set({ referenceName: input.referenceName, status: "paid", verifiedAt: now, updatedAt: now })
		.where(and(eq(toletRentPayment.id, payment.id), eq(toletRentPayment.status, "pending"))).returning();
	if (!updated) return { status: "unavailable" } as const;
	await tx.delete(verification).where(eq(verification.id, attemptId));
	return { status: "paid", payment: { cycleMonth: updated.cycleMonth, status: updated.status } } as const;
}
