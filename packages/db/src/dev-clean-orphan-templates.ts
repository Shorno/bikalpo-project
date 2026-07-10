/**
 * DEV-ONLY: Remove orphaned admin product generation templates — templates
 * whose core product has zero admin products left. These get left behind when
 * products are force-deleted, and keep the core-product list showing "Edit"
 * (and block the "Add" flow) even though no products exist.
 *
 * Run with: npx tsx packages/db/src/dev-clean-orphan-templates.ts
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { inArray, sql } from "drizzle-orm";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../apps/server/.env") });

const { db } = await import("./index");
const { adminProductGenerationTemplate, product } = await import("./schema");

async function main() {
  const orphans = await db
    .select({ coreProductId: adminProductGenerationTemplate.coreProductId })
    .from(adminProductGenerationTemplate)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM ${product}
        WHERE ${product.coreProductId} = ${adminProductGenerationTemplate.coreProductId}
          AND ${product.createdByWarehouseId} IS NULL
      )`,
    );

  if (orphans.length === 0) {
    console.log("No orphaned generation templates found.");
    process.exit(0);
  }

  const coreIds = orphans.map((o) => o.coreProductId);
  console.log(
    `Orphaned templates for core products: ${coreIds
      .map((id) => `#${id}`)
      .join(", ")}`,
  );

  await db
    .delete(adminProductGenerationTemplate)
    .where(inArray(adminProductGenerationTemplate.coreProductId, coreIds));

  console.log(`Deleted ${coreIds.length} orphaned template(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
