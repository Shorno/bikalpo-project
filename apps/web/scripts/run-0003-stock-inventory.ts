/**
 * One-off: apply 0003_stock_inventory.sql so product has
 * reorder_level, sku, supplier, last_restocked_at and stock_change_log exists.
 * Use when db:migrate fails due to 0001 already applied (e.g. delivery_group_status exists).
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const sql = readFileSync(
  join(process.cwd(), "drizzle", "0003_stock_inventory.sql"),
  "utf-8",
);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

async function main() {
  await pool.query(sql);
  console.log(
    "Applied 0003_stock_inventory: product columns + stock_change_log.",
  );
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
