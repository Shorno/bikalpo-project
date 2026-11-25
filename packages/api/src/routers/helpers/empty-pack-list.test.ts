import { describe, expect, it } from "bun:test";
import { buildEmptyPackList, type EmptyPackSize } from "./empty-pack-list";

const size = (overrides: Partial<EmptyPackSize>): EmptyPackSize => ({
  variantId: 1,
  productId: 10,
  productCode: "02020101",
  productName: "Omera LPG Gas Cylinder",
  label: "12 KG cylinder",
  categoryId: 1,
  categoryName: "LPG",
  subCategoryId: 2,
  subCategoryName: "Cylinder",
  fullQty: 0,
  emptyQty: 0,
  ...overrides,
});

describe("buildEmptyPackList", () => {
  it("counts only empties still owed on Exchange sales", () => {
    const [product] = buildEmptyPackList(
      [size({ fullQty: 20, emptyQty: 5 })],
      [
        // 10 exchanged, all 10 empties returned
        { variantId: 1, orderNumber: "ORD-1", saleMode: "exchange", missingEmptyQty: 0 },
        // 10 exchanged, none returned
        { variantId: 1, orderNumber: "ORD-2", saleMode: "exchange", missingEmptyQty: 10 },
        // 10 exchanged, 5 returned
        { variantId: 1, orderNumber: "ORD-3", saleMode: "exchange", missingEmptyQty: 5 },
        // New sale: no empty owed
        { variantId: 1, orderNumber: "ORD-4", saleMode: "new", missingEmptyQty: 0 },
      ],
    );
    expect(product!.inMarketQty).toBe(15);
    expect(product!.inMarketOrders).toEqual([
      { orderNumber: "ORD-2", quantity: 10 },
      { orderNumber: "ORD-3", quantity: 5 },
    ]);
    expect(product!.totalQty).toBe(40);
  });

  it("groups sizes under their product and adds them up", () => {
    const products = buildEmptyPackList(
      [
        size({ variantId: 2, label: "35 KG cylinder", fullQty: 3 }),
        size({ variantId: 1, fullQty: 7, emptyQty: 1 }),
        size({ variantId: 3, productId: 20, productName: "Bashundhara LPG", fullQty: 4 }),
      ],
      [{ variantId: 2, orderNumber: "ORD-9", saleMode: "exchange", missingEmptyQty: 2 }],
    );
    expect(products.map((product) => product.name)).toEqual([
      "Bashundhara LPG",
      "Omera LPG Gas Cylinder",
    ]);
    const omera = products[1]!;
    expect(omera.variants.map((variant) => variant.label)).toEqual([
      "12 KG cylinder",
      "35 KG cylinder",
    ]);
    expect(omera.variants.map((variant) => variant.totalQty)).toEqual([8, 5]);
    expect(omera.totalQty).toBe(13);
    expect(omera.inMarketQty).toBe(2);
  });
});
