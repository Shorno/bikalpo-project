import assert from "node:assert/strict";
import test from "node:test";

import { buildWarehousePosPosting } from "./warehouse-pos-accounting";

test("warehouse POS posting balances split receipts, receivable, and sales", () => {
	const posting = buildWarehousePosPosting({
		total: 240,
		due: 40,
		payments: [
			{ paymentAccountId: 7, appliedAmount: 100 },
			{ paymentAccountId: 8, appliedAmount: 100 },
		],
	});

	assert.deepEqual(posting, [
		{ kind: "payment", paymentAccountId: 7, debit: 100, credit: 0 },
		{ kind: "payment", paymentAccountId: 8, debit: 100, credit: 0 },
		{ kind: "receivable", debit: 40, credit: 0 },
		{ kind: "sales", debit: 0, credit: 240 },
	]);
	assert.equal(
		posting.reduce((sum, line) => sum + line.debit, 0),
		posting.reduce((sum, line) => sum + line.credit, 0),
	);
});

test("warehouse POS posting rejects totals that do not reconcile", () => {
	assert.throws(
		() =>
			buildWarehousePosPosting({
				total: 240,
				due: 50,
				payments: [{ paymentAccountId: 7, appliedAmount: 100 }],
			}),
		/reconcile/i,
	);
});
