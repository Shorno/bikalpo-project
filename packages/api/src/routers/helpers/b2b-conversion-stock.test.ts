import assert from "node:assert/strict";
import test from "node:test";
import { shouldDeductWarehouseSellerStock } from "./b2b-conversion";

test("warehouse conversion skips seller stock after reservations were consumed", () => {
  assert.equal(shouldDeductWarehouseSellerStock({ sellerStockConsumedAt: null }), true);
  assert.equal(
    shouldDeductWarehouseSellerStock({ sellerStockConsumedAt: new Date() }),
    false,
  );
});
