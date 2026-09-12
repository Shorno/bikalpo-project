import { db } from "@bikalpo-project/db";
import {
	toletRentalContract,
	toletRentPayment,
} from "@bikalpo-project/db/schema";
import { inArray } from "drizzle-orm";
import { completeToLetRentalInTransaction } from "./tolet-rental-completion";

import {
	shouldCompleteToLetContract,
	toLetRentCyclesThroughDate,
} from "../routers/helpers/tolet-rental-lifecycle";

export { TO_LET_RENT_DUE_DAY } from "../routers/helpers/tolet-rental-lifecycle";

export type ToLetContractRow = typeof toletRentalContract.$inferSelect;

export async function ensureToLetRentCycles(contract: ToLetContractRow) {
	const rows = toLetRentCyclesThroughDate(contract).map((cycle) => ({
		contractId: contract.id,
		...cycle,
	}));

	if (rows.length > 0) {
		await db.insert(toletRentPayment).values(rows).onConflictDoNothing();
	}
}

export async function completeExpiredToLetContract(contract: ToLetContractRow) {
	if (!shouldCompleteToLetContract(contract)) return contract;

	return db.transaction(async tx =>
		(await completeToLetRentalInTransaction(tx, contract.id, contract.unitId)) ?? contract,
		{ isolationLevel: "read committed" },
	);
}

export async function processToLetRentalLifecycle() {
	const contracts = await db
		.select()
		.from(toletRentalContract)
		.where(inArray(toletRentalContract.status, ["active", "leaving"]));

	let completedContracts = 0;
	let processedRentCycles = 0;

	for (const contract of contracts) {
		await ensureToLetRentCycles(contract);
		processedRentCycles += 1;
		const current = await completeExpiredToLetContract(contract);
		if (current.status === "completed") {
			completedContracts += 1;
		}
	}

	return {
		activeContracts: contracts.length,
		completedContracts,
		processedRentCycles,
	};
}
