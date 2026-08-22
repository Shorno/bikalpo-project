import assert from "node:assert/strict";
import test from "node:test";

import { resolveTemplateProductIdentities } from "./retailer-offer-variant-identity";

test("matches admin and retailer owner variants through catalog identity", () => {
  const resolved = resolveTemplateProductIdentities(
    [
      { name: "Omera 12 KG", variantId: 1 },
      { name: "Omera 25 KG", variantId: 2 },
      { name: "Corsair RAM 8 GB", variantId: 57 },
    ],
    [
      { variantId: 1, catalogVariantId: 1 },
      { variantId: 2, catalogVariantId: 2 },
      { variantId: 57, catalogVariantId: 18 },
    ],
    [
      { variantId: 18, catalogVariantId: 1 },
      { variantId: 19, catalogVariantId: 2 },
    ],
  );

  assert.deepEqual(
    resolved.map((product) => ({
      name: product.name,
      catalogVariantId: product.catalogVariantId,
      ownerVariantId: product.ownerVariantId,
      available: product.available,
    })),
    [
      {
        name: "Omera 12 KG",
        catalogVariantId: 1,
        ownerVariantId: 18,
        available: true,
      },
      {
        name: "Omera 25 KG",
        catalogVariantId: 2,
        ownerVariantId: 19,
        available: true,
      },
      {
        name: "Corsair RAM 8 GB",
        catalogVariantId: 18,
        ownerVariantId: null,
        available: false,
      },
    ],
  );
});

test("prefers a catalog identity already captured in a template snapshot", () => {
  const [resolved] = resolveTemplateProductIdentities(
    [{ name: "Omera 12 KG", variantId: 1, catalogVariantId: 1 }],
    [],
    [{ variantId: 18, catalogVariantId: 1 }],
  );

  assert.equal(resolved?.ownerVariantId, 18);
  assert.equal(resolved?.available, true);
});
