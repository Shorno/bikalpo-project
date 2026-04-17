import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
    await db.execute(sql`ALTER TABLE product ADD COLUMN IF NOT EXISTS unit_size DECIMAL(10,2)`);
    console.log("Done: added unit_size column to product table");
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
