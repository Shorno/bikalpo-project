import assert from "node:assert/strict";
import test from "node:test";
import { buildOwnerRentalHistory, ownerRentalHistoryWindow, type OwnerHistoryContract } from "../routers/helpers/tolet-owner-rental-history";
import { getOwnedUnitRentalHistory } from "./tolet-owner-rental-history";

const secret = "local-history-test-secret";
const first: OwnerHistoryContract = { id: "contract-first", publicNumber: 300001, bookingNumber: 200001, tenantUserId: "actual-account-alice", tenantName: "Alice", startDate: "2026-06-01", endDate: "2026-06-30", status: "completed", monthlyRent: "15000.00", rentDueDay: 1 };
const current: OwnerHistoryContract = { ...first, id: "contract-current", publicNumber: 300002, bookingNumber: 200002, tenantUserId: "actual-account-bob", tenantName: "Bob", startDate: "2026-08-01", endDate: "2026-12-31", status: "active" };

test("history uses 12-month pages bounded by first known contract", () => {
	assert.deepEqual(ownerRentalHistoryWindow("2026-06-20", 1, "2026-09-12"), { totalMonths: 4, totalPages: 1, from: "2026-06-01", to: "2026-09-01" });
	assert.deepEqual(ownerRentalHistoryWindow("2024-06-01", 2, "2026-09-12"), { totalMonths: 28, totalPages: 3, from: "2024-10-01", to: "2025-09-01" });
	assert.equal(ownerRentalHistoryWindow("2026-10-01", 1, "2026-09-12").totalMonths, 0);
	assert.equal(ownerRentalHistoryWindow(null, 1, "2026-09-12").from, null);
	assert.equal(ownerRentalHistoryWindow("2026-06-01", 2, "2026-09-12").from, null);
});

test("includes previous/current tenants and uncharged full-month vacancy in PDF column order", () => {
	const rows = buildOwnerRentalHistory([first, current], [{ contractId: first.id, cycleMonth: "2026-06-01", amount: "14500.00", status: "paid", referenceName: "Manager", verifiedAt: new Date("2026-06-05T00:00:00Z") }], "2026-06-01", "2026-09-01", secret, "2026-09-12");
	assert.deepEqual(rows.map(row => [row.cycleMonth, row.tenantName, row.status]), [
		["2026-06-01", "Alice", "paid"], ["2026-07-01", "Vacant", "vacant"], ["2026-08-01", "Bob", "pending"], ["2026-09-01", "Bob", "pending"],
	]);
	assert.equal(rows[0]?.tenantId, "actual-account-alice");
	assert.equal(rows[0]?.bookingCode, "BKG-200001");
	assert.equal(rows[0]?.amount, 14500);
	assert.equal(rows[0]?.referenceName, "Manager");
	assert.equal(rows[1]?.amount, null);
	assert.equal(rows[1]?.otp, null);
	assert.equal(rows[1]?.tenantId, null);
	assert.match(rows[3]?.otp ?? "", /^\d{6}$/);
});

test("past tenant unpaid history never exposes expired contract OTP", () => {
	const rows = buildOwnerRentalHistory([first], [], "2026-06-01", "2026-06-01", secret, "2026-09-12");
	assert.equal(rows[0]?.status, "pending");
	assert.equal(rows[0]?.otp, null);
});

test("future move-in does not become a charged tenant row early", () => {
	const rows = buildOwnerRentalHistory([{ ...current, startDate: "2026-09-20" }], [], "2026-09-01", "2026-09-01", secret, "2026-09-12");
	assert.equal(rows[0]?.status, "vacant");
	assert.equal(rows[0]?.amount, null);
});

test("successive tenants in one month stay separate, without invented proration", () => {
	const rows = buildOwnerRentalHistory([{ ...first, endDate: "2026-06-14" }, { ...current, startDate: "2026-06-15" }], [], "2026-06-01", "2026-06-01", secret, "2026-09-12");
	assert.equal(rows.length, 2);
	assert.deepEqual(rows.map(row => row.tenantId), [first.tenantUserId, current.tenantUserId]);
	assert.deepEqual(rows.map(row => row.amount), [15000, 15000]);
});

test("rejects non-owner or mismatched property year before reading tenant data", async () => {
	for (const owned of [[], [{ unitId: "unit", propertyId: "property", propertyCreatedAt: new Date("2025-01-01T00:00:00Z") }]]) {
		let queries = 0;
		const store = { select() { queries++; return { from() { return { innerJoin() { return { where() { return { async limit() { return owned; } }; } }; } }; } }; } };
		await assert.rejects(getOwnedUnitRentalHistory(store as unknown as Parameters<typeof getOwnedUnitRentalHistory>[0], "not-the-owner", { propertyCode: "PR-2026-100001", unitCode: "UNT-100001", page: 1 }, secret), /Unit not found/);
		assert.equal(queries, 1);
	}
});
