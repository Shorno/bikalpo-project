import assert from "node:assert/strict";
import test from "node:test";
import { suggestDeliveryCostUnit } from "@bikalpo-project/db/product-delivery";
import { z } from "zod";
import {
  deliveryColumns,
  deliveryDetailsShape,
  sellerRetailPrice,
} from "./product-delivery";

const cylinder = {
  definition: {
    kind: "measurement",
    value: "12",
    measurementUnit: "KG",
    container: "cylinder",
  },
};
const looseRice = { definition: { kind: "loose", measurementUnit: "KG" } };
const looseOil = { definition: { kind: "loose", measurementUnit: "ML" } };

test("delivery unit follows the first selected variant's Type", () => {
  assert.equal(suggestDeliveryCostUnit([cylinder, looseRice]), "cylinder");
  assert.equal(suggestDeliveryCostUnit([undefined, looseRice]), "kg");
  assert.equal(suggestDeliveryCostUnit([looseOil]), "liter");
  assert.equal(suggestDeliveryCostUnit([{ definition: null }]), null);
  assert.equal(suggestDeliveryCostUnit([]), null);
});

test("delivery columns skip unsent fields and clear empty ones", () => {
  assert.deepEqual(deliveryColumns({}), {});
  assert.deepEqual(
    deliveryColumns({ deliveryCostUnit: "sack", defaultDeliveryCost: "25.5" }),
    { deliveryCostUnit: "sack", defaultDeliveryCost: "25.5" },
  );
  assert.deepEqual(
    deliveryColumns({ deliveryCostUnit: "", defaultDeliveryCost: "" }),
    { deliveryCostUnit: null, defaultDeliveryCost: null },
  );
});

test("delivery input accepts known units and money only", () => {
  const schema = z.object(deliveryDetailsShape);
  assert.ok(schema.safeParse({ deliveryCostUnit: "cylinder" }).success);
  assert.ok(schema.safeParse({ deliveryCostUnit: "" }).success);
  assert.ok(schema.safeParse({ defaultDeliveryCost: "" }).success);
  assert.ok(!schema.safeParse({ deliveryCostUnit: "truck" }).success);
  assert.ok(!schema.safeParse({ defaultDeliveryCost: "12.345" }).success);
});

test("an empty or zero seller price keeps the current price", () => {
  assert.equal(sellerRetailPrice(undefined), null);
  assert.equal(sellerRetailPrice(""), null);
  assert.equal(sellerRetailPrice("0"), null);
  assert.equal(sellerRetailPrice("3200"), "3200.00");
});
