import assert from "node:assert/strict";
import test from "node:test";
import { storeTrackingOrderHref } from "./store-tracking-links";

test("store order tracking keeps preview and encodes the order segment", () => {
  assert.equal(
    storeTrackingOrderHref("/stores/example/track", "ORD-1"),
    "/stores/example/track/ORD-1",
  );
  assert.equal(
    storeTrackingOrderHref("/stores/example/track?preview=customer", "ORD/2"),
    "/stores/example/track/ORD%2F2?preview=customer",
  );
});
