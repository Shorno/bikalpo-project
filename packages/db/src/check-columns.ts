import { db } from "./index";
import { sql } from "drizzle-orm";

await db.execute(sql`ALTER TABLE core_product_identity DROP CONSTRAINT IF EXISTS core_product_identity_sku_unique`);
console.log("✅ Dropped unique constraint on core_product_identity.sku");
process.exit(0);
