import assert from "node:assert/strict";
import test from "node:test";
import {
    fulfillmentGroupOwnerValues,
    fulfillmentOwnerLabel,
    getFulfillmentOwner,
} from "./fulfillment-owner";

test("warehouse and retailer managers resolve to explicit tenant owners", () => {
    assert.deepEqual(
        getFulfillmentOwner({ id: "warehouse-1", role: "warehouse" }),
        { kind: "warehouse", id: "warehouse-1" },
    );
    assert.deepEqual(getFulfillmentOwner({ id: "shop-1", role: "shop_owner" }), {
        kind: "shop",
        id: "shop-1",
    });
});

test("a group persists exactly one organizational owner", () => {
    assert.deepEqual(
        fulfillmentGroupOwnerValues({ kind: "warehouse", id: "warehouse-1" }),
        { warehouseId: "warehouse-1", shopId: null },
    );
    assert.deepEqual(
        fulfillmentGroupOwnerValues({ kind: "shop", id: "shop-1" }),
        { warehouseId: null, shopId: "shop-1" },
    );
});

test("retailer ownership is presented as a store", () => {
    assert.equal(fulfillmentOwnerLabel({ kind: "shop", id: "shop-1" }), "store");
});

test("shop sales staff resolve to the parent shop fulfillment desk", () => {
    assert.deepEqual(
        getFulfillmentOwner({
            id: "staff-1",
            role: "shop_staff",
            shopId: "shop-1",
            shopFunction: "sales_agent",
        }),
        { kind: "shop", id: "shop-1" },
    );
});

test("shop purchase staff cannot enter the fulfillment seam", () => {
    assert.throws(
        () =>
            getFulfillmentOwner({
                id: "staff-1",
                role: "shop_staff",
                shopId: "shop-1",
                shopFunction: "purchase_manager",
            }),
        /Fulfillment manager access required/,
    );
});

test("non-manager roles cannot enter the fulfillment seam", () => {
    assert.throws(
        () => getFulfillmentOwner({ id: "rider-1", role: "deliveryman" }),
        /Fulfillment manager access required/,
    );
});
