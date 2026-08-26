import assert from "node:assert/strict";
import test from "node:test";
import { addReferenceProductToCart } from "./reference-quick-add";

test("reference quick add delegates one exact selection to the Open Order cart", async () => {
  let received: unknown[] | undefined;

  await addReferenceProductToCart(
    async (...args) => {
      received = args;
    },
    {
      productId: 7,
      variantId: 17,
      cylinderSaleMode: "exchange",
    },
  );

  assert.deepEqual(received, [7, 1, 17, undefined, "open_order", "exchange"]);
});
