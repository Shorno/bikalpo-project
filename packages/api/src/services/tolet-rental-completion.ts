import type { db } from "@bikalpo-project/db";
import { toletRentalContract, toletUnit } from "@bikalpo-project/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { shouldCompleteToLetContract, toLetDhakaDateString } from "../routers/helpers/tolet-rental-lifecycle";

type CompletionTransaction = Pick<typeof db, "select" | "update">;

// Lock the unit before its contract, matching booking/activation lock ordering.
// Never release a unit from an expired snapshot without rereading the contract.
export async function completeToLetRentalInTransaction(
	tx: CompletionTransaction,
	contractId: string,
	unitId: string,
	now = new Date(),
) {
	const [unit] = await tx.select().from(toletUnit).where(eq(toletUnit.id, unitId)).limit(1).for("update");
	const [contract] = await tx.select().from(toletRentalContract)
		.where(and(eq(toletRentalContract.id, contractId), eq(toletRentalContract.unitId, unitId))).limit(1).for("update");
	if (!unit || !contract || !shouldCompleteToLetContract(contract, toLetDhakaDateString(now))) return contract ?? null;
	const [updated] = await tx.update(toletRentalContract)
		.set({ status: "completed", completedAt: now, updatedAt: now })
		.where(and(eq(toletRentalContract.id, contract.id), inArray(toletRentalContract.status, ["active", "leaving"]))).returning();
	if (!updated) return contract;

	const [otherContract] = await tx.select({ id: toletRentalContract.id }).from(toletRentalContract)
		.where(and(eq(toletRentalContract.unitId, unit.id), ne(toletRentalContract.id, contract.id), inArray(toletRentalContract.status, ["active", "leaving"]))).limit(1);
	// A newer reservation, paused unit or another active tenancy must survive
	// reconciliation of historical data. Only this tenancy's occupied unit is released.
	if (!otherContract && unit.status === "occupied") {
		await tx.update(toletUnit).set({ status: "vacant", updatedAt: now })
			.where(and(eq(toletUnit.id, unit.id), eq(toletUnit.status, "occupied")));
	}
	return updated;
}
