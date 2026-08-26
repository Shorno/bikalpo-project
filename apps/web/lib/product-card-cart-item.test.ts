import assert from "node:assert/strict";
import test from "node:test";
import {
  findProductCardCartItem,
  getProductCardSelectionKey,
} from "./product-card-cart-item";

const cartItems = [
  {
    id: 1,
    productId: 7,
    variantId: 17,
    shopId: null,
    quantity: 1,
    cylinderSale: { mode: "exchange" as const },
  },
  {
    id: 2,
    productId: 7,
    variantId: 17,
    shopId: null,
    quantity: 3,
    cylinderSale: { mode: "new" as const },
  },
  {
    id: 3,
    productId: 7,
    variantId: 19,
    shopId: null,
    quantity: 2,
    cylinderSale: { mode: "exchange" as const },
  },
  {
    id: 4,
    productId: 7,
    variantId: 17,
    shopId: "shop-1",
    quantity: 4,
    cylinderSale: { mode: "exchange" as const },
  },
];

test("reference cards match the exact variant and New or Exchange cart line", () => {
  assert.equal(
    findProductCardCartItem(cartItems, {
      productId: 7,
      variantId: 17,
      shopId: null,
      cylinderSaleMode: "exchange",
    })?.id,
    1,
  );
  assert.equal(
    findProductCardCartItem(cartItems, {
      productId: 7,
      variantId: 17,
      shopId: null,
      cylinderSaleMode: "new",
    })?.id,
    2,
  );
  assert.equal(
    findProductCardCartItem(cartItems, {
      productId: 7,
      variantId: 19,
      shopId: null,
      cylinderSaleMode: "exchange",
    })?.id,
    3,
  );
});

test("reference cards never reuse a retailer-bound cart line", () => {
  assert.equal(
    findProductCardCartItem([cartItems[3]!], {
      productId: 7,
      variantId: 17,
      shopId: null,
      cylinderSaleMode: "exchange",
    }),
    undefined,
  );
});

test("pending selection keys distinguish variant, type, and retailer", () => {
  const exchangeKey = getProductCardSelectionKey({
    productId: 7,
    variantId: 17,
    shopId: null,
    cylinderSaleMode: "exchange",
  });

  assert.notEqual(
    exchangeKey,
    getProductCardSelectionKey({
      productId: 7,
      variantId: 17,
      shopId: null,
      cylinderSaleMode: "new",
    }),
  );
  assert.notEqual(
    exchangeKey,
    getProductCardSelectionKey({
      productId: 7,
      variantId: 19,
      shopId: null,
      cylinderSaleMode: "exchange",
    }),
  );
  assert.notEqual(
    exchangeKey,
    getProductCardSelectionKey({
      productId: 7,
      variantId: 17,
      shopId: "shop-1",
      cylinderSaleMode: "exchange",
    }),
  );
});
