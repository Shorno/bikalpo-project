import { describe, expect, it } from "bun:test";
import { buildPrintLabels, labelSizeParts, type PrintLabelRow } from "./print-labels";

const cylinder12 = {
  name: "12 KG cylinder",
  skuCode: "01",
  definition: { kind: "measurement", value: "12", measurementUnit: "kg", container: "cylinder" },
};

const row = (overrides: Partial<PrintLabelRow> = {}): PrintLabelRow => ({
  productId: 1,
  productName: "Omera LPG Gas",
  brandName: "Omera",
  catalogCode: "02020101",
  variantId: 11,
  variantOptionId: 1,
  exchangeEnabled: true,
  variantOption: cylinder12,
  saleTypePrices: { New: "3200", Exchange: "1450" },
  sellingPrice: "3100",
  ...overrides,
});

describe("labelSizeParts", () => {
  it("reads container, number and unit from the size", () => {
    expect(labelSizeParts(cylinder12)).toEqual({
      container: "Cylinder",
      number: "12",
      unit: "KG",
    });
    expect(
      labelSizeParts({ definition: { kind: "attribute", attribute: "pair", value: "20" } }),
    ).toEqual({ container: "Pair", number: "20", unit: "" });
  });
});

describe("buildPrintLabels", () => {
  it("makes one label per Type with that Type's price and code", () => {
    const [product] = buildPrintLabels([row()]);
    expect(product!.brandName).toBe("Omera");
    expect(product!.labels.map((label) => [label.saleType, label.code, label.price])).toEqual([
      ["New", "0202010100101", 3200],
      ["Exchange", "0202010100102", 1450],
    ]);
  });

  it("falls back to the selling price for New and a size without a Type", () => {
    const [product] = buildPrintLabels([
      row({ saleTypePrices: { New: "", Exchange: "" } }),
      row({
        productId: 2,
        variantId: 21,
        variantOption: {
          name: "5 KG pack",
          skuCode: "03",
          definition: { kind: "measurement", value: "5", measurementUnit: "kg", container: "pack" },
        },
        saleTypePrices: null,
        exchangeEnabled: false,
        sellingPrice: "450",
      }),
    ]);
    expect(product!.labels.map((label) => label.price)).toEqual([3100, null]);
    const [, rice] = buildPrintLabels([
      row({ productName: "A" }),
      row({
        productId: 2,
        productName: "B",
        variantId: 21,
        variantOption: {
          name: "5 KG pack",
          skuCode: "03",
          definition: { kind: "measurement", value: "5", measurementUnit: "kg", container: "pack" },
        },
        saleTypePrices: null,
        exchangeEnabled: false,
        sellingPrice: "450",
      }),
    ]);
    expect(rice!.labels).toHaveLength(1);
    expect(rice!.labels[0]).toMatchObject({ saleType: null, code: "0202010100300", price: 450 });
  });

  it("skips a size with no size code", () => {
    const [product] = buildPrintLabels([
      row({ variantOption: { ...cylinder12, skuCode: null } }),
    ]);
    expect(product!.labels).toEqual([]);
  });
});
