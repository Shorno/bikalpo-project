import assert from "node:assert/strict";

import { buildProductTypeFulfillmentProfile } from "../packages/db/src/fulfillment.ts";
import * as stockMeasure from "../apps/web/lib/stock-measure.ts";
import * as warehouseFulfillment from "../apps/web/components/features/warehouse/warehouse-order-fulfillment.ts";

type Fixture = {
  name: string;
  type: {
    name: string;
    slug: string;
    inventoryBehaviour: "auto_break" | "fixed_pack" | "loose_convert";
    isReturnablePack?: boolean;
  };
  variant: {
    unitLabel: string;
    weightKg: string;
    packType: string | null;
    orderUnit?: string | null;
    piecesPerUnit?: number | null;
    totalCartonCount?: number;
    cartonOptions?: Array<{
      weightKg: number;
      count: number;
      totalKg: number;
      packsPerCarton: number;
    }>;
  };
  expected: {
    family: string;
    measureUnit: string;
    quantityPerPack: number;
    firstMode: string;
  };
};

const fixtures: Fixture[] = [
  {
    name: "grocery carton flow",
    type: {
      name: "Grocery",
      slug: "grocery",
      inventoryBehaviour: "auto_break",
    },
    variant: {
      unitLabel: "5KG Pack",
      weightKg: "5",
      packType: "packet",
      orderUnit: "KG",
      totalCartonCount: 10,
      cartonOptions: [
        {
          weightKg: 50,
          count: 10,
          totalKg: 500,
          packsPerCarton: 10,
        },
      ],
    },
    expected: {
      family: "grocery",
      measureUnit: "KG",
      quantityPerPack: 5,
      firstMode: "carton",
    },
  },
  {
    name: "legacy lpg cylinder flow",
    type: {
      name: "LPG",
      slug: "lpg",
      inventoryBehaviour: "fixed_pack",
      isReturnablePack: true,
    },
    variant: {
      unitLabel: "12KG",
      weightKg: "12",
      packType: "packet",
      orderUnit: "KG",
    },
    expected: {
      family: "lpg",
      measureUnit: "CYLINDER",
      quantityPerPack: 1,
      firstMode: "cylinder",
    },
  },
];

for (const fixture of fixtures) {
  const profile = buildProductTypeFulfillmentProfile(fixture.type);
  const measure = stockMeasure.getStockMeasureInfo({
    packType: fixture.variant.packType,
    orderUnit: fixture.variant.orderUnit,
    unitLabel: fixture.variant.unitLabel,
    weightKg: fixture.variant.weightKg,
    piecesPerUnit: fixture.variant.piecesPerUnit,
    typeName: fixture.type.name,
    family: profile.family,
  });
  const options = warehouseFulfillment.getWarehouseOrderModeOptions(profile, {
    availableQty: "10",
    variant: fixture.variant,
  });

  assert.equal(profile.family, fixture.expected.family, `${fixture.name}: family`);
  assert.equal(
    measure.quantityUnit,
    fixture.expected.measureUnit,
    `${fixture.name}: measure unit`,
  );
  assert.equal(
    measure.quantityPerPack,
    fixture.expected.quantityPerPack,
    `${fixture.name}: quantity per pack`,
  );
  assert.equal(
    options[0]?.mode,
    fixture.expected.firstMode,
    `${fixture.name}: first mode`,
  );
}

console.log(`Verified ${fixtures.length} warehouse fulfillment fixtures.`);
