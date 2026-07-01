"use client";

import {
  buildProductTypeFulfillmentProfile,
  type ProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";

export type ProductTypeRowShape = {
  name: string;
  slug: string;
  inventoryBehaviour: "auto_break" | "loose_convert" | "fixed_pack";
  fulfillmentProfile?: ProductTypeFulfillmentProfile;
};

export function resolveProductTypeProfile<T extends ProductTypeRowShape>(row: T) {
  return (
    row.fulfillmentProfile ??
    buildProductTypeFulfillmentProfile({
      name: row.name,
      slug: row.slug,
      inventoryBehaviour: row.inventoryBehaviour,
    })
  );
}
