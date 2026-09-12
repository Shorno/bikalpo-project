// Deliberately applies only the two additions approved for this task.
// Do not run the whole pending migration chain (public reviews are deferred).
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../../../apps/server/.env", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), quiet: true });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const before = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tolet_unit_listing' AND column_name IN ('facility_inclusions','tour_url')");
  console.log("Existing approved fields:", before.rows);
  const sql = await readFile(new URL("./migrations/0083_tolet_facility_inclusions_tour.sql", import.meta.url), "utf8");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
  const after = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tolet_unit_listing' AND column_name IN ('facility_inclusions','tour_url') ORDER BY column_name");
  if (after.rows.length !== 2) throw new Error("Approved fields were not both created");
  console.log("Verified approved fields:", after.rows);
} finally { await pool.end(); }
