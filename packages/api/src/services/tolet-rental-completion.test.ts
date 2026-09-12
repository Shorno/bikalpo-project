import assert from "node:assert/strict";
import test from "node:test";
import { toletRentalContract, toletUnit } from "@bikalpo-project/db/schema";
import { completeToLetRentalInTransaction } from "./tolet-rental-completion";

const now = new Date("2026-09-12T18:00:00Z"); // September 13 in Dhaka.

function harness(options: { endDate?: string; status?: string; unitStatus?: string; anotherContract?: boolean } = {}) {
	const contract = { id: "old-contract", unitId: "unit-one", status: options.status ?? "leaving", endDate: options.endDate ?? "2026-09-12", completedAt: null as Date | null };
	const unit = { id: contract.unitId, status: options.unitStatus ?? "occupied" };
	const locks: string[] = [];
	const tx = {
		select(projection?: unknown) { return { from(table: unknown) { return { where() { return { limit() {
			if (projection) { assert.deepEqual(locks.slice(-2), ["unit", "contract"]); return Promise.resolve(options.anotherContract ? [{ id: "new-contract" }] : []); }
			return { async for() {
				if (table === toletUnit) { locks.push("unit"); return [unit]; }
				assert.equal(table, toletRentalContract); assert.equal(locks.at(-1), "unit"); locks.push("contract"); return [contract];
			} };
		} }; } }; } }; },
		update(table: unknown) { assert.deepEqual(locks.slice(-2), ["unit", "contract"]); return { set(values: object) { return { where() {
			if (table === toletUnit) { Object.assign(unit, values); return Promise.resolve(); }
			assert.equal(table, toletRentalContract); return { async returning() { Object.assign(contract, values); return [contract]; } };
		} }; } }; },
	};
	return { contract, unit, locks, run: () => completeToLetRentalInTransaction(tx as unknown as Parameters<typeof completeToLetRentalInTransaction>[0], contract.id, unit.id, now) };
}

test("expired leaving contract completes and releases its occupied unit once", async () => {
	const state = harness();
	assert.equal((await state.run())?.status, "completed");
	assert.equal(state.unit.status, "vacant");
	assert.deepEqual(state.contract.completedAt, now);
	await state.run();
	assert.equal(state.unit.status, "vacant");
});

test("fresh extended contract is preserved instead of completing an old snapshot", async () => {
	const state = harness({ endDate: "2026-09-30" });
	assert.equal((await state.run())?.status, "leaving");
	assert.equal(state.unit.status, "occupied");
	assert.equal(state.contract.completedAt, null);
});

test("reconciling an old completed contract never vacates a newly occupied unit", async () => {
	const state = harness({ status: "completed", unitStatus: "occupied" });
	await state.run();
	assert.equal(state.unit.status, "occupied");
});

test("completion cannot erase a newer reservation or owner deactivation", async () => {
	for (const unitStatus of ["booked", "inactive"]) {
		const state = harness({ unitStatus }); await state.run();
		assert.equal(state.contract.status, "completed");
		assert.equal(state.unit.status, unitStatus);
	}
});

test("another active contract protects the unit when reconciling legacy inconsistent data", async () => {
	const state = harness({ anotherContract: true }); await state.run();
	assert.equal(state.contract.status, "completed");
	assert.equal(state.unit.status, "occupied");
});

test("contract remains accessible through its final Dhaka day", async () => {
	const state = harness({ endDate: "2026-09-13" }); await state.run();
	assert.equal(state.contract.status, "leaving");
	assert.equal(state.unit.status, "occupied");
});
