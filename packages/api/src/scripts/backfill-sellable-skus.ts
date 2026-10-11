/**
 * Issue sellable SKUs (BRAND-PRODUCT-VARIANT) for existing brands, core products,
 * and catalog variants. Preview by default; --apply commits one transaction.
 * New records get their codes automatically, so this only needs to run once.
 */
import { db } from "@bikalpo-project/db";
import {
  brand,
  catalogVariant,
  coreProductIdentity,
} from "@bikalpo-project/db/schema";
import { asc } from "drizzle-orm";
import {
  ensureBrandShortCode,
  ensureCatalogVariantSku,
  ensureCoreProductShortCode,
} from "../routers/helpers/sellable-sku";

const apply = process.argv.includes("--apply");

class Preview extends Error {}

try {
  await db.transaction(async (tx) => {
    const database = tx as unknown as typeof db;

    // Oldest first, so the earliest brand or product keeps the plainest code.
    const brands = await database.query.brand.findMany({
      orderBy: [asc(brand.id)],
      columns: { id: true, name: true },
    });
    for (const row of brands) {
      const code = await ensureBrandShortCode(database, row.id);
      console.log(`brand        ${code.padEnd(8)} ${row.name}`);
    }

    const cores = await database.query.coreProductIdentity.findMany({
      orderBy: [asc(coreProductIdentity.id)],
      columns: { id: true, name: true },
    });
    for (const row of cores) {
      const code = await ensureCoreProductShortCode(database, row.id);
      console.log(`core product ${code.padEnd(8)} ${row.name}`);
    }

    const variants = await database.query.catalogVariant.findMany({
      orderBy: [asc(catalogVariant.id)],
      columns: { id: true, globalSku: true },
      with: {
        coreProduct: { columns: { name: true } },
        brand: { columns: { name: true } },
        variantOption: { columns: { name: true } },
      },
    });
    for (const row of variants) {
      const sku = await ensureCatalogVariantSku(database, row.id);
      console.log(
        `sku          ${sku.padEnd(22)} ${row.globalSku}  ${row.brand?.name ?? "Unbranded"} ${row.coreProduct?.name} · ${row.variantOption?.name}`,
      );
    }

    if (!apply) throw new Preview();
  });
  console.log("\nApplied.");
} catch (error) {
  if (!(error instanceof Preview)) throw error;
  console.log("\nPreview only, nothing saved. Re-run with --apply to save.");
}
process.exit(0);
