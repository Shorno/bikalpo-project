/**
 * Run 0008 (order price change + confirmed total columns).
 * Use when db:migrate fails due to earlier migrations (e.g. address already exists).
 *
 *   pnpm exec tsx scripts/run-0008-migration.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

async function main() {
  const path = join(
    process.cwd(),
    "drizzle",
    "0008_order_price_change_confirmed.sql",
  );
  const sql = readFileSync(path, "utf-8").trim();
  await pool.query(sql);
  console.log(
    "Applied 0008: order previous_total, total_price_changed_at, confirmed_subtotal, confirmed_total",
  );
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
