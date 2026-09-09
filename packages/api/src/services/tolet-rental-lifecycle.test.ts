import { describe, expect, it } from "bun:test";
import {
	canAccessToLetRentalDetails,
	shouldCompleteToLetContract,
	TO_LET_RENT_DUE_DAY,
	toLetRentCyclesThroughDate,
} from "../routers/helpers/tolet-rental-lifecycle";

describe("To-Let rental lifecycle", () => {
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
