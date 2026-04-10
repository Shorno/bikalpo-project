import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../apps/server/.env") });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // First check table columns
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'delivery_group_invoice' ORDER BY ordinal_position`
  );
  console.log("COLUMNS:", cols.rows.map((r: any) => r.column_name).join(", "));

  const r = await pool.query(`SELECT * FROM delivery_group_invoice ORDER BY id DESC LIMIT 5`);
  console.log("ROWS:", JSON.stringify(r.rows, null, 2));

  await pool.end();
}
main();
