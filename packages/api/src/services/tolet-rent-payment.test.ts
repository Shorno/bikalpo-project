import assert from "node:assert/strict";
import test from "node:test";
import { toletRentalContract, toletRentPayment, verification } from "@bikalpo-project/db/schema";
import { toLetRentOtp, toLetRentOtpAttemptId, toLetRentOtpMatches, verifyToLetRentPayment, TO_LET_RENT_OTP_ATTEMPTS, TO_LET_RENT_OTP_COOLDOWN_MS } from "./tolet-rent-payment";

const secret = "local-test-secret-no-live-credentials-needed";
const now = new Date("2026-09-12T10:00:00Z");
const input = { contractId: "contract-one", tenantUserId: "tenant", cycleMonth: "2026-09-01", referenceName: "Property owner", otp: "" };
const validOtp = toLetRentOtp(input.contractId, input.cycleMonth, secret);
const invalidOtp = validOtp === "000000" ? "999999" : "000000";

function harness(overrides: { startDate?: string; endDate?: string; status?: string; paymentStatus?: string; dueDate?: string; noPayment?: boolean; noContract?: boolean } = {}) {
	const contract = { id: input.contractId, tenantUserId: "tenant", status: overrides.status ?? "active", startDate: overrides.startDate ?? "2026-08-01", endDate: overrides.endDate ?? "2026-12-31" };
	const payment = { id: "payment-one", contractId: contract.id, cycleMonth: input.cycleMonth, dueDate: overrides.dueDate ?? input.cycleMonth, status: overrides.paymentStatus ?? "pending", referenceName: null as string | null, verifiedAt: null as Date | null };
	let attempt: { id: string; value: string; expiresAt: Date } | undefined;
	let previous = Promise.resolve();
	const run = async (otp: string, at = now, change: Partial<typeof input> = {}) => {
		let locked = false;
		let release: (() => void) | undefined;
		const checkLock = () => assert.equal(locked, true, "contract must be locked before payment/counter access");
		const tx = {
			select() { return { from(table: unknown) { return { where() { return { limit() {
				if (table === toletRentalContract) return { async for() {
					const wait = previous; previous = new Promise<void>(resolve => { release = resolve; }); await wait; locked = true;
					return overrides.noContract ? [] : [contract];
				} };
				checkLock();
				if (table === toletRentPayment) return { async for() { return overrides.noPayment ? [] : [payment]; } };
				assert.equal(table, verification); return Promise.resolve(attempt ? [attempt] : []);
			} }; } }; } }; },
			insert(table: unknown) { checkLock(); assert.equal(table, verification); return { values(row: NonNullable<typeof attempt>) { return { async onConflictDoUpdate() { attempt = row; } }; } }; },
			update(table: unknown) { checkLock(); assert.equal(table, toletRentPayment); return { set(values: Partial<typeof payment>) { return { where() { return { async returning() { Object.assign(payment, values); return [payment]; } }; } }; } }; },
			delete(table: unknown) { checkLock(); assert.equal(table, verification); return { async where() { attempt = undefined; } }; },
		};
		try { return await verifyToLetRentPayment(tx as unknown as Parameters<typeof verifyToLetRentPayment>[0], { ...input, ...change, otp }, secret, at); }
		finally { release?.(); }
	};
	return { run, payment, get attempt() { return attempt; } };
}

test("OTP remains six digits, bound to contract and calendar month", () => {
	assert.match(validOtp, /^\d{6}$/);
	assert.notEqual(validOtp, toLetRentOtp("other-contract", input.cycleMonth, secret));
	assert.notEqual(validOtp, toLetRentOtp(input.contractId, "2026-10-01", secret));
	assert.equal(toLetRentOtpMatches(validOtp, validOtp), true);
	assert.equal(toLetRentOtpMatches(invalidOtp, validOtp), false);
	assert.equal(toLetRentOtpMatches("12345", validOtp), false);
	assert.notEqual(toLetRentOtpAttemptId(input.contractId, input.cycleMonth), toLetRentOtpAttemptId(input.contractId, "2026-10-01"));
});

test("correct OTP stores Paid, receiver reference and verification time once", async () => {
	const state = harness();
	assert.equal((await state.run(validOtp)).status, "paid");
	assert.equal(state.payment.referenceName, input.referenceName);
	assert.deepEqual(state.payment.verifiedAt, now);
	assert.equal((await state.run(validOtp)).status, "unavailable");
});

test("incorrect OTP persists a failure and leaves rent Pending", async () => {
	const state = harness();
	assert.equal((await state.run(invalidOtp)).status, "incorrect");
	assert.equal(state.payment.status, "pending");
	assert.equal(state.payment.referenceName, null);
	assert.equal(state.attempt?.value, "1");
});

test("five failed attempts lock the cycle, cooldown expires and successful payment clears attempts", async () => {
	const state = harness();
	for (let index = 0; index < TO_LET_RENT_OTP_ATTEMPTS; index++) assert.equal((await state.run(invalidOtp)).status, "incorrect");
	assert.equal((await state.run(validOtp)).status, "rate_limited");
	assert.equal(state.payment.status, "pending");
	assert.equal((await state.run(validOtp, new Date(now.getTime() + TO_LET_RENT_OTP_COOLDOWN_MS))).status, "paid");
	assert.equal(state.attempt, undefined);
});

test("parallel wrong submissions cannot bypass the shared attempt counter", async () => {
	const state = harness();
	const results = await Promise.all(Array.from({ length: 20 }, () => state.run(invalidOtp)));
	assert.equal(results.filter(result => result.status === "incorrect").length, 5);
	assert.equal(results.filter(result => result.status === "rate_limited").length, 15);
	assert.equal(state.payment.status, "pending");
});

test("parallel correct submissions cannot pay twice", async () => {
	const state = harness();
	const results = await Promise.all(Array.from({ length: 8 }, () => state.run(validOtp)));
	assert.equal(results.filter(result => result.status === "paid").length, 1);
	assert.equal(results.filter(result => result.status === "unavailable").length, 7);
});

test("unrelated accounts, completed/expired/future contracts and missing cycles cannot pay", async () => {
	assert.equal((await harness({ noContract: true }).run(validOtp)).status, "forbidden");
	for (const overrides of [{ status: "completed" }, { endDate: "2026-09-11" }, { startDate: "2026-09-20" }, { noPayment: true }, { dueDate: "2026-09-15" }]) {
		assert.equal((await harness(overrides).run(validOtp)).status, "unavailable");
	}
});

test("malformed, non-month-start and future cycles are rejected", async () => {
	for (const cycleMonth of ["2026-02-30", "2026-09-12", "2026-10-01", "2026-07-01"]) {
		assert.equal((await harness().run(validOtp, now, { cycleMonth })).status, "unavailable");
	}
});

test("Leaving tenant can pay through final Dhaka date but not after it", async () => {
	assert.equal((await harness({ status: "leaving", endDate: "2026-09-12" }).run(validOtp, new Date("2026-09-12T17:59:59Z"))).status, "paid");
	assert.equal((await harness({ status: "leaving", endDate: "2026-09-12" }).run(validOtp, new Date("2026-09-12T18:00:00Z"))).status, "unavailable");
});
