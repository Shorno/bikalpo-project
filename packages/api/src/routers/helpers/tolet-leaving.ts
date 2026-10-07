import { db } from "@bikalpo-project/db";
import { type ToletUnit, toletRentalContract } from "@bikalpo-project/db/schema";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { completeExpiredToLetContract } from "../../services/tolet-rental-lifecycle";
import { toLetDhakaDateString } from "./tolet-rental-lifecycle";

type Reader = Pick<typeof db, "select">;

/**
 * The current tenancy on an occupied unit: its last day when known (the leave
 * date, or a fixed contract end date) and whether the tenant has asked to
 * leave. Null when the unit has no current tenant.
 *
 * Owners may advertise an occupied unit at any time; the next tenant can only
 * be accepted once the unit is vacant again.
 */
export async function toLetCurrentTenancy(
	unit: Pick<ToletUnit, "id" | "status">,
	reader: Reader = db,
) {
	if (unit.status !== "occupied") return null;
	const [contract] = await reader
		.select({
			endDate: toletRentalContract.endDate,
			status: toletRentalContract.status,
		})
		.from(toletRentalContract)
		.where(
			and(
				eq(toletRentalContract.unitId, unit.id),
				inArray(toletRentalContract.status, ["active", "leaving"]),
			),
		)
		.limit(1);
	if (!contract) return null;
	return { until: contract.endDate, leaving: contract.status === "leaving" };
}

/**
 * Finish tenancies whose last day has passed so the unit is vacant from the
 * 1st, even before the hourly reconciler runs (it is off in development).
 * Scope by unit before accepting a new tenant, or by owner before listing units.
 */
export async function toLetReleaseEndedTenancies(
	scope: { unitId: string } | { ownerUserId: string },
) {
	const contracts = await db
		.select()
		.from(toletRentalContract)
		.where(
			and(
				"unitId" in scope
					? eq(toletRentalContract.unitId, scope.unitId)
					: eq(toletRentalContract.ownerUserId, scope.ownerUserId),
				inArray(toletRentalContract.status, ["active", "leaving"]),
				isNotNull(toletRentalContract.endDate),
				lt(toletRentalContract.endDate, toLetDhakaDateString()),
			),
		);
	for (const contract of contracts) {
		await completeExpiredToLetContract(contract);
	}
}
