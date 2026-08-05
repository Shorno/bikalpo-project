import assert from "node:assert/strict";
import test from "node:test";
import { sellerApplicationInputSchema } from "./seller-application";
import { warehouseApplicationInputSchema } from "./warehouse-application";

const sharedInput = {
  ownerName: "Test Owner",
  phoneNumber: "01700000000",
};

test("dedicated application schemas accept every matching business nature", () => {
  for (const businessNature of [
    "retail_shop",
    "manufacturer",
    "importer",
  ] as const) {
    assert.equal(
      sellerApplicationInputSchema.safeParse({
        ...sharedInput,
        businessNature,
        shopName: "Test Shop",
        shopAddress: "Test Address",
      }).success,
      true,
    );
  }

  for (const businessNature of ["wholesaler", "distributor"] as const) {
    assert.equal(
      warehouseApplicationInputSchema.safeParse({
        ...sharedInput,
        businessNature,
        warehouseName: "Test Warehouse",
        warehouseAddress: "Test Address",
      }).success,
      true,
    );
  }
});

test("dedicated application schemas reject contradictory business natures", () => {
  assert.equal(
    sellerApplicationInputSchema.safeParse({
      ...sharedInput,
      businessNature: "wholesaler",
      shopName: "Test Shop",
      shopAddress: "Test Address",
    }).success,
    false,
  );
  assert.equal(
    warehouseApplicationInputSchema.safeParse({
      ...sharedInput,
      businessNature: "retail_shop",
      warehouseName: "Test Warehouse",
      warehouseAddress: "Test Address",
    }).success,
    false,
  );
});

test("dedicated application schemas preserve legacy missing business nature", () => {
  assert.equal(
    sellerApplicationInputSchema.safeParse({
      ...sharedInput,
      shopName: "Legacy Shop",
      shopAddress: "Legacy Address",
    }).success,
    true,
  );
  assert.equal(
    warehouseApplicationInputSchema.safeParse({
      ...sharedInput,
      warehouseName: "Legacy Warehouse",
      warehouseAddress: "Legacy Address",
    }).success,
    true,
  );
});
