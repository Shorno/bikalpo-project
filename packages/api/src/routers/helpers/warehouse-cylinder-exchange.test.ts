import assert from "node:assert/strict";
import test from "node:test";
import {
  creditExchangeEmptyPack,
  creditRetailerExchangeOrder,
  warehouseExchangeEmptyCreditQty,
} from "./empty-pack-stock";
import { syncWarehouseCylinderExchange } from "./warehouse-cylinder-exchange";

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

test("creditRetailerExchangeOrder credits shop empty stock for Exchange lines", async () => {
  const movementInserts: Array<{
    ownerType: string;
    ownerId: string;
    quantity: number;
    orderItemId: number;
  }> = [];
  const tx = {
    query: {
      orderItem: {
        findMany: async () => [
          {
            id: 21,
            variantId: 8,
            cylinderSaleMode: "exchange",
            quantity: 3,
            modifiedQty: 3,
          },
        ],
      },
    },
    insert: () => ({
      values: (values: {
        ownerType?: string;
        ownerId?: string;
        quantity?: number;
        orderItemId?: number;
      }) => {
        if (values.ownerType && values.orderItemId) {
          movementInserts.push({
            ownerType: values.ownerType,
            ownerId: values.ownerId!,
            quantity: values.quantity!,
            orderItemId: values.orderItemId,
          });
        }
        return {
          onConflictDoNothing: () => ({
            returning: async () => [{ id: 1 }],
          }),
          onConflictDoUpdate: async () => undefined,
        };
      },
    }),
  };

  await creditRetailerExchangeOrder(tx as never, {
    shopId: "shop-1",
    orderId: 99,
  });

  assert.deepEqual(movementInserts, [
    {
      ownerType: "shop",
      ownerId: "shop-1",
      quantity: 3,
      orderItemId: 21,
    },
  ]);
});
