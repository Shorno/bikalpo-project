import { db } from "./src";
import { inventory } from "./src/schema";
import { eq } from "drizzle-orm";

async function main() {
  const items = await db.query.inventory.findMany({
    where: eq(inventory.ownerType, "shop"),
    with: {
      variant: {
        columns: { id: true, sku: true, brandId: true, packType: true, weightKg: true, innerPackSizeKg: true, packCountInside: true },
        with: {
          brand: { columns: { id: true, name: true } },
        },
      },
    },
    limit: 20,
  });

  for (const item of items) {
    console.log(JSON.stringify({
      invId: item.id,
      variantId: item.variant?.id,
      sku: item.variant?.sku,
      brandId: item.variant?.brandId,
      brandName: item.variant?.brand?.name ?? null,
      packType: item.variant?.packType,
      qty: item.availableQty,
    }));
  }
  process.exit(0);
}
main();
