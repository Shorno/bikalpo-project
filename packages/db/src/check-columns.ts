import { db } from "./index";
import { sql } from "drizzle-orm";

const r = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'product_type' ORDER BY ordinal_position`
);
console.log("product_type columns:", r.rows.map((x: any) => x.column_name));

const r2 = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'category' ORDER BY ordinal_position`
);
console.log("category columns:", r2.rows.map((x: any) => x.column_name));

process.exit(0);
