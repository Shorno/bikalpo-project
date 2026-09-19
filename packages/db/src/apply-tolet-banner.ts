import { Pool } from "pg";
import { readFile } from "node:fs/promises";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const sql = await readFile(new URL("../../../docs/pending/tolet-banner.sql", import.meta.url), "utf8");
  await pool.query(sql);
  const result = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tolet_banner' ORDER BY ordinal_position");
  console.log("To-Let banner table ready:", result.rows.map(row => row.column_name).join(", "));
} finally { await pool.end(); }
