import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeRetailerOrderStock,
  RetailerOrderStockError,
  type RetailerOrderStockMutation,
  type RetailerOrderStockWriter,
  releaseRetailerOrderStock,
  reserveRetailerOrderStock,
} from "./retailer-order-stock";

const shopId = "shop-shorno";
const firstLine = {
  productId: 8,
  variantId: 19,
  productName: "Omera 25 KG",
  quantity: 1,
  inventoryQty: "1.00",
};
type Stock = { available: number; reserved: number };

function inventoryKey(input: RetailerOrderStockMutation) {
  return `${input.shopId}:${input.productId}:${input.variantId}`;
}

function memoryWriter(stock: Map<string, Stock>): RetailerOrderStockWriter {
  return {
    async reserve(input) {
      const row = stock.get(inventoryKey(input));
      if (!row || row.available < input.quantity) return false;
      row.available -= input.quantity;
      row.reserved += input.quantity;
      return true;
    },
    async release(input) {
      const row = stock.get(inventoryKey(input));
      if (!row || row.reserved < input.quantity) return false;
      row.available += input.quantity;
      row.reserved -= input.quantity;
      return true;
    },
    async consume(input) {
      const row = stock.get(inventoryKey(input));
      if (!row || row.reserved < input.quantity) return false;
      row.reserved -= input.quantity;
      return true;
    },
  };
}

async function transaction<T>(
  stock: Map<string, Stock>,
  operation: (writer: RetailerOrderStockWriter) => Promise<T>,
) {
  const working = new Map(
    [...stock].map(([key, row]) => [key, { ...row }] as const),
  );
  const result = await operation(memoryWriter(working));
  stock.clear();
  for (const [key, row] of working) stock.set(key, row);
  return result;
}

test("order placement moves exact retailer stock from available to reserved", async () => {
  const stock = new Map<string, Stock>([
    [`${shopId}:8:19`, { available: 2, reserved: 0 }],
    [`${shopId}:8:20`, { available: 3, reserved: 0 }],
  ]);
  await transaction(stock, (writer) =>
    reserveRetailerOrderStock(writer, shopId, [
      firstLine,
      { ...firstLine, variantId: 20, quantity: 2, inventoryQty: "2.00" },
    ]),
  );
  assert.deepEqual(stock.get(`${shopId}:8:19`), { available: 1, reserved: 1 });
  assert.deepEqual(stock.get(`${shopId}:8:20`), { available: 1, reserved: 2 });
});

test("reservation rolls back when a later line loses stock", async () => {
  const stock = new Map<string, Stock>([
    [`${shopId}:8:19`, { available: 2, reserved: 0 }],
    [`${shopId}:8:20`, { available: 0, reserved: 0 }],
  ]);
  await assert.rejects(
    transaction(stock, (writer) =>
      reserveRetailerOrderStock(writer, shopId, [
        firstLine,
        { ...firstLine, variantId: 20 },
      ]),
    ),
    RetailerOrderStockError,
  );
  assert.deepEqual(stock.get(`${shopId}:8:19`), { available: 2, reserved: 0 });
});

test("cancellation releases reserved stock back to available", async () => {
  const stock = new Map<string, Stock>([
    [`${shopId}:8:19`, { available: 1, reserved: 1 }],
  ]);
  await transaction(stock, (writer) =>
    releaseRetailerOrderStock(writer, shopId, [firstLine]),
  );
  assert.deepEqual(stock.get(`${shopId}:8:19`), { available: 2, reserved: 0 });
});

test("completed handoff consumes the reservation without changing available", async () => {
  const stock = new Map<string, Stock>([
    [`${shopId}:8:19`, { available: 1, reserved: 1 }],
  ]);
  await transaction(stock, (writer) =>
    consumeRetailerOrderStock(writer, shopId, [firstLine]),
  );
  assert.deepEqual(stock.get(`${shopId}:8:19`), { available: 1, reserved: 0 });
});
