import { describe, expect, it } from "bun:test";
import { ALL, type EmptyPackProduct, filterEmptyPacks } from "./empty-pack-model";

const omera: EmptyPackProduct = {
  productId: 1,
  productCode: "02020101",
  name: "Omera LPG Gas Cylinder",
  categoryId: 5,
  categoryName: "LPG",
  subCategoryId: 6,
  subCategoryName: "Cylinder",
  totalQty: 60,
  inMarketQty: 6,
  inMarketOrders: [
    { orderNumber: "ORD-1", quantity: 3 },
    { orderNumber: "ORD-2", quantity: 3 },
  ],
  variants: [
    {
      variantId: 11,
      label: "12 KG cylinder",
      totalQty: 30,
      inMarketQty: 3,
      inMarketOrders: [{ orderNumber: "ORD-1", quantity: 3 }],
    },
    {
      variantId: 12,
      label: "35 KG cylinder",
      totalQty: 30,
      inMarketQty: 3,
      inMarketOrders: [{ orderNumber: "ORD-2", quantity: 3 }],
    },
  ],
};

const none = { search: "", categoryId: ALL, subCategoryId: ALL, variant: ALL };

describe("filterEmptyPacks", () => {
  it("keeps every product with no filters", () => {
    expect(filterEmptyPacks([omera], none)).toEqual([omera]);
  });

  it("narrows a product to the chosen variant and its figures", () => {
    const [row] = filterEmptyPacks([omera], { ...none, variant: "35 KG cylinder" });
    expect(row!.variants.map((variant) => variant.label)).toEqual(["35 KG cylinder"]);
    expect(row!.totalQty).toBe(30);
    expect(row!.inMarketQty).toBe(3);
    expect(row!.inMarketOrders).toEqual([{ orderNumber: "ORD-2", quantity: 3 }]);
  });

  it("searches name, Product ID and order number; filters by category", () => {
    expect(filterEmptyPacks([omera], { ...none, search: "omera" })).toHaveLength(1);
    expect(filterEmptyPacks([omera], { ...none, search: "0202" })).toHaveLength(1);
    expect(filterEmptyPacks([omera], { ...none, search: "ord-2" })).toHaveLength(1);
    expect(filterEmptyPacks([omera], { ...none, search: "fresh" })).toHaveLength(0);
    expect(filterEmptyPacks([omera], { ...none, categoryId: "99" })).toHaveLength(0);
  });
});
