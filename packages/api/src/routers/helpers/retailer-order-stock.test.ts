import assert from "node:assert/strict";
import test from "node:test";
import {
  deductRetailerOrderStock,
  RetailerOrderStockError,
  type RetailerOrderStockMutation,
  type RetailerOrderStockWriter,
  restoreRetailerOrderStock,
} from "./retailer-order-stock";

const shopId = "shop-shorno";
const firstLine = {
  productId: 8,
  variantId: 19,
  productName: "Omera 25 KG",
  quantity: 1,
  inventoryQty: "1.00",
};

function inventoryKey(input: RetailerOrderStockMutation) {
  return `${input.shopId}:${input.productId}:${input.variantId}`;
}

function memoryWriter(stock: Map<string, number>): RetailerOrderStockWriter {
  return {
    async deduct(input) {
      const key = inventoryKey(input);
      const available = stock.get(key);
      if (available == null || available < input.quantity) return false;
      stock.set(key, available - input.quantity);
      return true;
    },
    async restore(input) {
      const key = inventoryKey(input);
      const available = stock.get(key);
      if (available == null) return false;
      stock.set(key, available + input.quantity);
      return true;
    },
  };
}

async function transaction<T>(
  stock: Map<string, number>,
  operation: (writer: RetailerOrderStockWriter) => Promise<T>,
) {
  const working = new Map(stock);
  const result = await operation(memoryWriter(working));
  stock.clear();
  for (const [key, quantity] of working) stock.set(key, quantity);
  return result;
}

test("deducts multiple lines from the exact retailer product variants", async () => {
  const stock = new Map([
    [`${shopId}:8:19`, 2],
    [`${shopId}:8:20`, 3],
    ["another-shop:8:19", 7],
  ]);

  await transaction(stock, (writer) =>
    deductRetailerOrderStock(writer, shopId, [
      firstLine,
      {
        productId: 8,
        variantId: 20,
        productName: "Omera 35 KG",
        quantity: 2,
        inventoryQty: "2.00",
      },
    ]),
  );

  assert.equal(stock.get(`${shopId}:8:19`), 1);
  assert.equal(stock.get(`${shopId}:8:20`), 1);
  assert.equal(stock.get("another-shop:8:19"), 7);
});

test("rolls back every deduction when a later retailer line loses stock", async () => {
  const stock = new Map([
    [`${shopId}:8:19`, 2],
    [`${shopId}:8:20`, 0],
  ]);

  await assert.rejects(
    transaction(stock, (writer) =>
      deductRetailerOrderStock(writer, shopId, [
        firstLine,
        {
          productId: 8,
          variantId: 20,
          productName: "Omera 35 KG",
          quantity: 1,
        },
      ]),
    ),
    RetailerOrderStockError,
  );

  assert.equal(stock.get(`${shopId}:8:19`), 2);
  assert.equal(stock.get(`${shopId}:8:20`), 0);
});

test("restores the same retailer rows using the immutable inventory quantity", async () => {
  const stock = new Map([[`${shopId}:8:19`, 1]]);

  await transaction(stock, (writer) =>
    restoreRetailerOrderStock(writer, shopId, [
      { ...firstLine, quantity: 99, inventoryQty: "1.00" },
    ]),
  );

  assert.equal(stock.get(`${shopId}:8:19`), 2);
});
