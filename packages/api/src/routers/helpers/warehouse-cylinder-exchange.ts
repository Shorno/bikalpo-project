import type { db } from "@bikalpo-project/db";
import { productVariant } from "@bikalpo-project/db/schema";
import { eq } from "drizzle-orm";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Persist New/Exchange enablement onto every variant of a warehouse product. */
export async function syncWarehouseCylinderExchange(
  tx: DbTransaction,
  input: { productId: number; enabled: boolean },
) {
  await tx
    .update(productVariant)
    .set({ exchangeEnabled: input.enabled })
    .where(eq(productVariant.productId, input.productId));
}

/** Mystore Type: Exchange/New follows the selected variant flag only. */
export function warehouseVariantAllowsCylinderExchange(
  variant: { exchangeEnabled?: boolean | null } | null | undefined,
) {
  return Boolean(variant?.exchangeEnabled);
}
