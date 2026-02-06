/**
 * One-off: ensure the "user" table has "service_area" (used by Better Auth and delivery).
 * Run when you see "Failed query" on user select or "Failed to get session" after restart.
 *
 *   pnpm exec tsx scripts/ensure-user-service-area.ts
 *
 * Safe to run multiple times (uses IF NOT EXISTS). Prefer pnpm db:migrate when possible.
 */
import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

const sql = `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "service_area" text;`;

async function main() {
  await pool.query(sql);
  console.log("OK: user.service_area exists (or was just added).");
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
