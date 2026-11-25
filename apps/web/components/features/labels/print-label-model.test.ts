import { describe, expect, it } from "bun:test";
import {
  filterLabelProducts,
  labelSizeText,
  type PrintLabelProduct,
  printQueue,
} from "./print-label-model";

const omera: PrintLabelProduct = {
  productId: 1,
  name: "Omera LPG Gas",
  brandName: "Omera",
  labels: [
    {
      key: "11:New",
      variantId: 11,
      sizeLabel: "12 KG cylinder",
      saleType: "New",
      code: "0202010100101",
      price: 3200,
      container: "Cylinder",
      number: "12",
      unit: "KG",
    },
    {
      key: "11:Exchange",
      variantId: 11,
      sizeLabel: "12 KG cylinder",
      saleType: "Exchange",
      code: "0202010100102",
      price: null,
      container: "Cylinder",
      number: "12",
      unit: "KG",
    },
  ],
};

describe("print labels", () => {
  it("writes the size line with the typed unit", () => {
    expect(labelSizeText(omera.labels[0]!, "KG")).toBe("Cylinder: 12 KG");
    expect(labelSizeText(omera.labels[0]!, " ")).toBe("Cylinder: 12");
  });

  it("queues each chosen label once per copy", () => {
    const queue = printQueue([omera], {
      "11:New": { selected: true, copies: 2, unit: "Kg" },
      "11:Exchange": { selected: false, copies: 5, unit: "KG" },
    });
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({
      brand: "Omera",
      sizeText: "Cylinder: 12 Kg",
      priceText: "৳3,200",
      code: "0202010100101",
    });
    expect(new Set(queue.map((label) => label.id)).size).toBe(2);
  });

  it("finds a label by its full code or the product", () => {
    expect(filterLabelProducts([omera], "0202010100102")[0]!.labels).toHaveLength(1);
    expect(filterLabelProducts([omera], "omera")[0]!.labels).toHaveLength(2);
    expect(filterLabelProducts([omera], "fresh")).toEqual([]);
  });
});
