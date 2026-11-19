import assert from "node:assert/strict";
import test from "node:test";
import {
  groupOwnerProducts,
  type OwnerProductVariantRow,
  ownerProductFilterOptions,
  ownerProductListInput,
  queryOwnerProducts,
  shortVariantLabel,
} from "./owner-product-list";

const measurement = (value: string, unit: string, container: string) => ({
  name: `${value} ${unit} ${container}`,
  definitionKind: "measurement",
  definition: {
    kind: "measurement",
    value,
    measurementUnit: unit,
    container,
    operationalUnit: container,
  },
});

function row(
  overrides: Partial<OwnerProductVariantRow>,
): OwnerProductVariantRow {
  return {
    productId: 1,
    productName: "Bashundhara LPG Gas Cylinder",
    productCode: "0202010108",
    productStatus: "active",
    coreProductName: "LPG Gas Cylinder",
    typeId: 4,
    typeName: "Gas",
    family: "lpg",
    categoryId: 10,
    categoryName: "LPG",
    subCategoryId: 100,
    subCategoryName: "Cylinder",
    variantId: 11,
    variantOption: measurement("12", "kg", "cylinder"),
    variantUnitLabel: "12 kg Cylinder",
    availableQty: "10",
    price: "1450.00",
    ...overrides,
  };
}

test("short variant label keeps value and unit only", () => {
  assert.equal(shortVariantLabel(measurement("12", "kg", "cylinder")), "12KG");
  assert.equal(shortVariantLabel(measurement("500", "g", "packet")), "500G");
  assert.equal(shortVariantLabel(null, "8GB"), "8GB");
  assert.equal(shortVariantLabel(null, null), "—");
});

test("one variant shows its label; several show a count; value sums qty × price", () => {
  const items = groupOwnerProducts([
    row({}),
    row({
      productId: 2,
      productCode: "0202010104",
      productName: "Fresh LPG Gas Cylinder",
      variantId: 21,
      availableQty: "4",
      price: "1000",
    }),
    row({
      productId: 2,
      productCode: "0202010104",
      productName: "Fresh LPG Gas Cylinder",
      variantId: 22,
      variantOption: measurement("35", "kg", "cylinder"),
      availableQty: "-3",
      price: "4000",
    }),
  ]);

  assert.equal(items.length, 2);
  assert.deepEqual(
    items.map((item) => [
      item.productCode,
      item.variantCount,
      item.variantLabel,
      item.value,
    ]),
    [
      ["0202010108", 1, "12KG", 14500],
      // Negative stock never reduces value.
      ["0202010104", 2, null, 4000],
    ],
  );
});

test("brand-inclusive names only for LPG; others use the core product name", () => {
  const [lpg, ram] = groupOwnerProducts([
    row({}),
    row({
      productId: 3,
      productName: "Corsair DDR4 Desktop RAM",
      coreProductName: "DDR4 Desktop RAM",
      family: "generic",
      variantOption: null,
      variantUnitLabel: "8GB",
    }),
  ]);
  assert.equal(lpg?.name, "Bashundhara LPG Gas Cylinder");
  assert.equal(ram?.name, "DDR4 Desktop RAM");
  assert.equal(ram?.variantLabel, "8GB");
});

test("products without variants and inactive products are still listed", () => {
  const [item] = groupOwnerProducts([
    row({
      productStatus: "inactive",
      variantId: null,
      variantOption: null,
      availableQty: null,
      price: null,
    }),
  ]);
  assert.equal(item?.variantCount, 0);
  assert.equal(item?.variantLabel, null);
  assert.equal(item?.value, 0);
  assert.equal(item?.isActive, false);
});

test("search matches name or Product ID; status, filters, sort and paging apply", () => {
  const items = groupOwnerProducts([
    row({}),
    row({
      productId: 2,
      productCode: "0202010104",
      productName: "Fresh LPG Gas Cylinder",
      productStatus: "inactive",
      price: "2000",
    }),
    row({
      productId: 3,
      productCode: "0501010210",
      productName: "Corsair DDR4 Desktop RAM",
      coreProductName: "DDR4 Desktop RAM",
      family: "generic",
      typeId: 7,
      categoryId: 20,
      subCategoryId: null,
    }),
  ]);
  const query = (input: Record<string, unknown>) =>
    queryOwnerProducts(items, ownerProductListInput.parse(input));

  assert.deepEqual(
    query({ search: "fresh" }).items.map((i) => i.productId),
    [2],
  );
  assert.deepEqual(
    query({ search: "05010" }).items.map((i) => i.productId),
    [3],
  );
  assert.deepEqual(
    query({ status: "inactive" }).items.map((i) => i.productId),
    [2],
  );
  assert.deepEqual(
    query({ typeId: 7 }).items.map((i) => i.productId),
    [3],
  );
  assert.deepEqual(
    query({ sortBy: "value_desc" }).items.map((i) => i.productId),
    [2, 1, 3],
  );

  const paged = query({ pageSize: 2, page: 9 });
  assert.equal(paged.pagination.page, 2);
  assert.equal(paged.pagination.totalCount, 3);
  assert.equal(paged.items.length, 1);
});

test("filter options carry parent ids for cascading", () => {
  const options = ownerProductFilterOptions([row({}), row({ variantId: 12 })]);
  assert.deepEqual(options.types, [{ id: 4, name: "Gas", parentId: null }]);
  assert.deepEqual(options.categories, [{ id: 10, name: "LPG", parentId: 4 }]);
  assert.deepEqual(options.subCategories, [
    { id: 100, name: "Cylinder", parentId: 10 },
  ]);
});

test("attribute variants show their value only", () => {
  assert.equal(
    shortVariantLabel({
      name: "RAM Capacity 8GB",
      definitionKind: "attribute",
      definition: {
        kind: "attribute",
        attribute: "RAM Capacity",
        value: "8GB",
        operationalUnit: "unit",
      },
    }),
    "8GB",
  );
});
