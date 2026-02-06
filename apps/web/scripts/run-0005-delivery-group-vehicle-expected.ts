/**
 * One-off: add vehicle_type and expected_delivery_at to delivery_group.
 * Run when db:migrate fails (e.g. 0001 already applied).
 *
 *   pnpm exec tsx scripts/run-0005-delivery-group-vehicle-expected.ts
 */
import "dotenv/config";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

async function main() {
  // Ensure enum exists (from 0004; may be missing if 0004 not applied)
  await pool.query(`
    DO $$ BEGIN
      CREATE TYPE "public"."invoice_vehicle_type" AS ENUM('bike', 'car', 'van', 'truck');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$
  `);
  await pool.query(`
    ALTER TABLE "delivery_group" ADD COLUMN IF NOT EXISTS "vehicle_type" "invoice_vehicle_type"
  `);
  await pool.query(`
    ALTER TABLE "delivery_group" ADD COLUMN IF NOT EXISTS "expected_delivery_at" timestamp
  `);
  console.log(
    "Applied 0005: delivery_group.vehicle_type, delivery_group.expected_delivery_at",
  );
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
