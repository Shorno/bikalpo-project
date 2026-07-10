/**
 * DEV-ONLY: Delete SPECIFIC core products (and the brand products generated
 * from them) by id. Nothing is deleted unless you pass ids.
 *
 * For each targeted core product it deletes, in FK-safe order inside one
 * transaction:
 *   1. order/invoice/estimate items referencing its generated products
 *      (these use onDelete: "restrict" and would otherwise block the delete)
 *   2. the generated products themselves (cascades variants, prices, images,
 *      brands, cart items, reviews, stock logs, pack rules — all "cascade")
 *   3. the core product identity (cascades its generation template)
 *
 * Pass --products-only to delete just the generated products and KEEP the
 * core identity (so you can re-generate against it).
 *
 * Intended for cleaning up test data during development. Do NOT run in prod.
 *
 * Examples:
 *   npx tsx packages/db/src/dev-reset-core-products.ts 12 15 18
 *   npx tsx packages/db/src/dev-reset-core-products.ts --products-only 12
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { inArray } from "drizzle-orm";

// Load env before importing the db module (which validates env at import time).
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../apps/server/.env") });

const { db } = await import("./index");
const {
  coreProductIdentity,
  estimateItem,
  invoiceItem,
  orderItem,
  product,
} = await import("./schema");

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run dev-reset-core-products in production.");
  }

  const args = process.argv.slice(2);
  const productsOnly = args.includes("--products-only");
  const coreIds = args
    .filter((a) => !a.startsWith("--"))
    .map((a) => Number.parseInt(a, 10));

  if (coreIds.length === 0 || coreIds.some((id) => Number.isNaN(id))) {
    console.error(
      "Usage: tsx dev-reset-core-products.ts [--products-only] <coreId> [coreId...]",
    );
    process.exit(1);
  }

  console.log(
    `=== DEV reset: core products [${coreIds.join(", ")}]${
      productsOnly ? " (products only, keeping cores)" : ""
    } ===\n`,
  );

  await db.transaction(async (tx) => {
    // Confirm which cores actually exist (and show names for a sanity check)
    const cores = await tx
      .select({ id: coreProductIdentity.id, name: coreProductIdentity.name })
      .from(coreProductIdentity)
      .where(inArray(coreProductIdentity.id, coreIds));

    if (cores.length === 0) {
      console.log("No matching core products found. Nothing to delete.");
      return;
    }
    const foundIds = cores.map((c) => c.id);
    for (const c of cores) console.log(`  core #${c.id} — ${c.name}`);
    const missing = coreIds.filter((id) => !foundIds.includes(id));
    if (missing.length > 0) {
      console.log(`  (not found, skipped: ${missing.join(", ")})`);
    }

    // Products generated from those cores
    const prods = await tx
      .select({ id: product.id })
      .from(product)
      .where(inArray(product.coreProductId, foundIds));
    const productIds = prods.map((p) => p.id);
    console.log(`\nLinked products: ${productIds.length}`);

    if (productIds.length > 0) {
      // Clear the "restrict" FKs that would block product deletion
      await tx.delete(orderItem).where(inArray(orderItem.productId, productIds));
      await tx
        .delete(invoiceItem)
        .where(inArray(invoiceItem.productId, productIds));
      await tx
        .delete(estimateItem)
        .where(inArray(estimateItem.productId, productIds));

      // Delete products (cascades everything else product-owned)
      await tx.delete(product).where(inArray(product.id, productIds));
    }

    if (productsOnly) {
      console.log(
        `\nDeleted ${productIds.length} products. Kept ${foundIds.length} core products.`,
      );
      return;
    }

    // Delete core identities (cascades admin_product_generation_template)
    await tx
      .delete(coreProductIdentity)
      .where(inArray(coreProductIdentity.id, foundIds));

    console.log(
      `\nDeleted ${productIds.length} products and ${foundIds.length} core products.`,
    );
  });

  console.log("=== Done ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
