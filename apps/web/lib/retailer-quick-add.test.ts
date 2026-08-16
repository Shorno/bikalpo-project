import assert from "node:assert/strict";
import test from "node:test";
import { addRetailerProductToCart } from "./retailer-quick-add";

test("retailer quick add delegates to the cart flow as a direct purchase", async () => {
  let received: unknown[] | undefined;

  await addRetailerProductToCart(
    async (...args) => {
      received = args;
    },
    {
      productId: 7,
      variantId: 17,
      shopId: "shop-1",
    },
  );

  assert.deepEqual(received, [7, 1, 17, "shop-1", "direct", undefined]);
});

test("retailer quick add passes cylinder sale mode when selected on the card", async () => {
  let received: unknown[] | undefined;

  await addRetailerProductToCart(
    async (...args) => {
      received = args;
    },
    {
      productId: 7,
      variantId: 17,
      shopId: "shop-1",
      cylinderSaleMode: "exchange",
    },
  );

  assert.deepEqual(received, [7, 1, 17, "shop-1", "direct", "exchange"]);
});
