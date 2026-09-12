import { describe, expect, it } from "bun:test";
import {
	canAccessToLetRentalDetails,
	isToLetCalendarDate,
	shouldCompleteToLetContract,
	TO_LET_RENT_DUE_DAY,
	toLetRentCyclesThroughDate,
	toLetDhakaDateString,
} from "../routers/helpers/tolet-rental-lifecycle";

describe("To-Let rental lifecycle", () => {
	it("rejects impossible dates and accepts leap days only in leap years", () => {
		expect(isToLetCalendarDate("2026-02-30")).toBe(false);
		expect(isToLetCalendarDate("2026-02-29")).toBe(false);
		expect(isToLetCalendarDate("2028-02-29")).toBe(true);
		expect(isToLetCalendarDate("2026-2-01")).toBe(false);
	});
	it("uses the Dhaka midnight boundary, not the server timezone", () => {
		expect(toLetDhakaDateString(new Date("2026-09-30T17:59:59.999Z"))).toBe("2026-09-30");
		expect(toLetDhakaDateString(new Date("2026-09-30T18:00:00.000Z"))).toBe("2026-10-01");
	});
	it("does not bill a future move-in in the same calendar month", () => {
		const contract = { startDate: "2026-09-20", endDate: "2026-12-31", rentDueDay: 1, monthlyRent: "15000.00" };
		expect(toLetRentCyclesThroughDate(contract, "2026-09-12")).toEqual([]);
		expect(toLetRentCyclesThroughDate(contract, "2026-09-20")).toHaveLength(1);
	});
	it("stops rent cycles at contract end and keeps legacy due-day terms", () => {
		const cycles = toLetRentCyclesThroughDate({ startDate: "2026-07-10", endDate: "2026-08-24", rentDueDay: 15, monthlyRent: "15000.00" }, "2026-10-01");
		expect(cycles.map(cycle => cycle.dueDate)).toEqual(["2026-07-15", "2026-08-15"]);
	});
	it("limits tenant details to the rental period while preserving owner history", () => {
		const contract = { status: "leaving", endDate: "2026-09-10", tenantUserId: "tenant", ownerUserId: "owner" };
		expect(canAccessToLetRentalDetails(contract, "tenant", "2026-09-10")).toBe(true);
		expect(canAccessToLetRentalDetails(contract, "tenant", "2026-09-11")).toBe(false);
		expect(canAccessToLetRentalDetails({ ...contract, status: "completed" }, "tenant", "2026-09-10")).toBe(false);
		expect(canAccessToLetRentalDetails({ ...contract, status: "completed" }, "owner", "2026-09-11")).toBe(true);
		expect(canAccessToLetRentalDetails(contract, "stranger", "2026-09-10")).toBe(false);
	});
	it("keeps a contract active through its final day", () => {
		expect(
			shouldCompleteToLetContract(
				{ status: "active", endDate: "2026-08-24" },
				"2026-08-24",
			),
		).toBe(false);
		expect(
			shouldCompleteToLetContract(
				{ status: "active", endDate: "2026-08-24" },
				"2026-08-25",
			),
		).toBe(true);
	});

	it("completes both active and leaving contracts after the end date", () => {
		expect(
			shouldCompleteToLetContract(
				{ status: "leaving", endDate: "2026-08-01" },
				"2026-08-02",
			),
		).toBe(true);
		expect(
			shouldCompleteToLetContract(
				{ status: "completed", endDate: "2026-08-01" },
				"2026-08-02",
			),
		).toBe(false);
	});

	it("creates one first-day rent cycle for every contract month", () => {
		const cycles = toLetRentCyclesThroughDate(
			{
				startDate: "2026-06-20",
				endDate: "2026-09-30",
				rentDueDay: TO_LET_RENT_DUE_DAY,
				monthlyRent: "15000.00",
			},
			"2026-08-24",
		);

		expect(cycles).toEqual([
			{
				cycleMonth: "2026-06-01",
				dueDate: "2026-06-01",
				amount: "15000.00",
			},
			{
				cycleMonth: "2026-07-01",
				dueDate: "2026-07-01",
				amount: "15000.00",
			},
			{
				cycleMonth: "2026-08-01",
				dueDate: "2026-08-01",
				amount: "15000.00",
			},
		]);
	});
});
