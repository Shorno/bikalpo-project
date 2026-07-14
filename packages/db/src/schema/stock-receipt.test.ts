import assert from "node:assert/strict";
import test from "node:test";
import { getTableColumns } from "drizzle-orm";
import { stockEntryTypeEnum } from "./stock-entry";
import { stockReceipt } from "./stock-receipt";

test("maps stock receipts and enables direct receiving", () => {
  const columns = getTableColumns(stockReceipt);

  assert.equal(columns.receiptNo.name, "receipt_no");
  assert.equal(columns.idempotencyKey.name, "idempotency_key");
  assert.equal(columns.receiptDate.name, "receipt_date");
  assert.ok(stockEntryTypeEnum.enumValues.includes("direct"));
});
