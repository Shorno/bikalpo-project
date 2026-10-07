import { describe, expect, it } from "bun:test";
import {
	canAccessToLetRentalDetails,
	isToLetCalendarDate,
	shouldCompleteToLetContract,
	TO_LET_RENT_DUE_DAY,
	toLetRentCyclesThroughDate,
	toLetDhakaDateString,
	toLetEndOfNextMonth,
	toLetLeaveDate,
	toLetNextDate,
	toLetOpenEndedLeaveDate,
} from "../routers/helpers/tolet-rental-lifecycle";

describe("To-Let rental lifecycle", () => {
	it("keeps an open-ended contract running and billing until the tenant leaves", () => {
		const contract = { startDate: "2026-07-10", endDate: null, rentDueDay: 1, monthlyRent: "15000.00" };
		expect(toLetRentCyclesThroughDate(contract, "2026-10-05").map(cycle => cycle.cycleMonth))
			.toEqual(["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"]);
		expect(shouldCompleteToLetContract({ status: "active", endDate: null }, "2099-01-01")).toBe(false);
		expect(canAccessToLetRentalDetails(
			{ status: "active", endDate: null, ownerUserId: "owner", tenantUserId: "tenant" },
			"tenant",
			"2099-01-01",
		)).toBe(true);
	});
	it("gives an open-ended leave one month's notice, ending on the last day of next month", () => {
		expect(toLetOpenEndedLeaveDate("2026-10-03")).toBe("2026-10-31");
		expect(toLetOpenEndedLeaveDate("2026-11-30")).toBe("2026-11-30");
		expect(toLetOpenEndedLeaveDate("2027-02-15")).toBe("2027-02-28");
		expect(toLetOpenEndedLeaveDate("2028-02-01")).toBe("2028-02-29");
		expect(toLetNextDate("2026-10-31")).toBe("2026-11-01");
		expect(toLetNextDate("2026-12-31")).toBe("2027-01-01");
	});
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
	it("keeps tenant access for one month after moving out while preserving owner history", () => {
		const contract = { status: "leaving", endDate: "2026-10-31", tenantUserId: "tenant", ownerUserId: "owner" };
		expect(canAccessToLetRentalDetails(contract, "tenant", "2026-10-31")).toBe(true);
		const movedOut = { ...contract, status: "completed" };
		expect(canAccessToLetRentalDetails(movedOut, "tenant", "2026-11-01")).toBe(true);
		expect(canAccessToLetRentalDetails(movedOut, "tenant", "2026-11-30")).toBe(true);
		expect(canAccessToLetRentalDetails(movedOut, "tenant", "2026-12-01")).toBe(false);
		expect(canAccessToLetRentalDetails(
			{ ...movedOut, accessEndsAt: new Date("2026-11-30T23:59:59+06:00") }, "tenant", "2026-12-01",
		)).toBe(false);
		expect(canAccessToLetRentalDetails(movedOut, "owner", "2027-06-01")).toBe(true);
		expect(canAccessToLetRentalDetails(contract, "stranger", "2026-10-31")).toBe(false);
	});
	it("ends a rental on the last day of the month Leave is pressed", () => {
		const openEnded = { startDate: "2026-07-01", endDate: null };
		expect(toLetLeaveDate(openEnded, "2026-10-01")).toBe("2026-10-31");
		expect(toLetLeaveDate(openEnded, "2026-10-07")).toBe("2026-10-31");
		expect(toLetLeaveDate(openEnded, "2026-10-30")).toBe("2026-10-31");
		expect(toLetLeaveDate({ startDate: "2026-07-01", endDate: "2027-06-30" }, "2026-10-07")).toBe("2026-10-31");
		expect(toLetLeaveDate({ startDate: "2026-07-01", endDate: "2026-10-15" }, "2026-10-07")).toBe("2026-10-15");
		expect(toLetLeaveDate({ startDate: "2026-11-01", endDate: null }, "2026-10-07")).toBe("2026-11-01");
		expect(toLetEndOfNextMonth("2026-10-31")).toBe("2026-11-30");
		expect(toLetEndOfNextMonth("2026-12-31")).toBe("2027-01-31");
		expect(toLetEndOfNextMonth("2027-01-31")).toBe("2027-02-28");
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
