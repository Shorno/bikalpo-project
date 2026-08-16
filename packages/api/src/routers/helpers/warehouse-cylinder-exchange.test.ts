import assert from "node:assert/strict";
import test from "node:test";
import { syncWarehouseCylinderExchange } from "./warehouse-cylinder-exchange";
import {
  creditExchangeEmptyPack,
  warehouseExchangeEmptyCreditQty,
} from "./empty-pack-stock";

test("syncWarehouseCylinderExchange writes exchangeEnabled onto every variant", async () => {
  const calls: Array<{ values: { exchangeEnabled: boolean } }> = [];
  const tx = {
    update: () => ({
      set: (values: { exchangeEnabled: boolean }) => ({
        where: async () => {
          calls.push({ values });
        },
      }),
    }),
  };

  await syncWarehouseCylinderExchange(tx as never, {
    productId: 42,
    enabled: true,
  });
  await syncWarehouseCylinderExchange(tx as never, {
    productId: 42,
    enabled: false,
  });

  assert.equal(calls[0]?.values.exchangeEnabled, true);
  assert.equal(calls[1]?.values.exchangeEnabled, false);
});

test("creditExchangeEmptyPack skips missing variants and non-positive quantities", async () => {
  const tx = {
    insert: () => {
      throw new Error("should not insert");
    },
  };

  assert.equal(
    await creditExchangeEmptyPack(tx as never, {
      ownerType: "warehouse",
      ownerId: "wh-1",
      orderId: 1,
      orderItemId: 9,
      variantId: null,
      quantity: 2,
    }),
    false,
  );
  assert.equal(
    await creditExchangeEmptyPack(tx as never, {
      ownerType: "warehouse",
      ownerId: "wh-1",
      orderId: 1,
      orderItemId: 9,
      variantId: 11,
      quantity: 0,
    }),
    false,
  );
});

test("New sales do not credit empty pack and Exchange credits delivered quantity", () => {
  assert.equal(
    warehouseExchangeEmptyCreditQty({
      cylinderSaleMode: "new",
      quantity: 3,
      modifiedQty: 3,
    }),
    0,
  );
  assert.equal(
    warehouseExchangeEmptyCreditQty({
      cylinderSaleMode: "exchange",
      quantity: 3,
      modifiedQty: 2,
    }),
    2,
  );
  assert.equal(
    warehouseExchangeEmptyCreditQty({
      cylinderSaleMode: "exchange",
      quantity: 4,
      modifiedQty: null,
    }),
    4,
  );
});
