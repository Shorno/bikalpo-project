import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  createPriceWorkbook,
  parsePriceWorkbook,
  readPriceWorkbook,
} from "./consumer-price-workbook";

const base = {
  productId: 13,
  productName: "Omera LPG Cylinder",
  productSku: "PRD-000013",
  coreProductName: "LPG Cylinder",
  typeName: "LPG",
  categoryName: "Gas",
  subCategoryName: "Household",
  brandDisplay: "Omera",
  variantName: "12 KG Cylinder",
  variantUnit: "KG",
  updatedAt: new Date("2026-04-10T06:00:00Z"),
  updatedByName: "Admin",
};

test("exported Excel workbooks round-trip ordinary and LPG prices without changing identifiers or precision", async () => {
  const workbook = createPriceWorkbook([
    {
      ...base,
      variantPriceId: 1,
      consumerPrice: "3200.00",
      exchangePrice: "1480.00",
      isCylinderPricing: true,
    },
    {
      ...base,
      productName: "Miniket Rice",
      variantPriceId: 2,
      consumerPrice: "60.25",
      exchangePrice: null,
      isCylinderPricing: false,
    },
    {
      ...base,
      variantPriceId: 3,
      consumerPrice: "3000.00",
      exchangePrice: null,
      isCylinderPricing: true,
    },
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  const result = await readPriceWorkbook(new Uint8Array(buffer).buffer);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows, [
    { variantPriceId: 1, consumerPrice: "3200", exchangePrice: "1480" },
    { variantPriceId: 2, consumerPrice: "60.25", exchangePrice: undefined },
    { variantPriceId: 3, consumerPrice: "3000", exchangePrice: undefined },
  ]);
});

test("Excel import reports row numbers for bad prices, duplicate IDs, formulas and incomplete cylinder pairs", () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Prices");
  sheet.addRows([
    ["Variant Price ID", "Price", "Exchange Price", "New Cylinder Price"],
    [1, 60],
    [1, 65],
    [2, -20],
    [3, { formula: "1+1", result: 2 }],
    [4, "", 1500, 1000],
    [5, 60, 50],
    [6, 60, "", 90],
  ]);
  const result = parsePriceWorkbook(workbook);
  assert.equal(result.errors.length, 6);
  assert.match(result.errors[0]!, /Row 3: Duplicate/);
  assert.match(result.errors[2]!, /Row 5:.*formulas/);
  assert.match(result.errors[3]!, /Row 6:.*exceed/);
});

test("empty, incompatible and oversized worksheets are rejected", () => {
  assert.ok(parsePriceWorkbook(new ExcelJS.Workbook()).errors.length);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Prices");
  sheet.addRow(["Product", "Selling Price"]);
  assert.match(parsePriceWorkbook(workbook).errors[0]!, /Variant Price ID/);
  sheet.getRow(1).values = ["Variant Price ID", "Price"];
  assert.match(parsePriceWorkbook(workbook).errors[0]!, /no price rows/);
  for (let id = 1; id <= 1001; id++) sheet.addRow([id, 10]);
  assert.match(parsePriceWorkbook(workbook).errors.at(-1)!, /at most 1000/);
});
