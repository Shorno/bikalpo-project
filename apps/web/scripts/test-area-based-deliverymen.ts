/**
 * Test script: list deliverymen, optionally filtered by area (same logic as
 * getDeliverymenForAssignment). Use to verify area-based assignment behavior.
 *
 *   pnpm exec tsx scripts/test-area-based-deliverymen.ts [area]
 *
 *   area: e.g. "Gulshan". Omit to list all deliverymen.
 *
 * Examples:
 *   pnpm exec tsx scripts/test-area-based-deliverymen.ts
 *   pnpm exec tsx scripts/test-area-based-deliverymen.ts Gulshan
 */
import "dotenv/config";
import { Pool } from "pg";

const area = process.argv[2] ?? "";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

const sql = `
SELECT id, name, email, phone_number, service_area
FROM "user"
WHERE role = 'deliveryman'
  AND (service_area IS NULL OR service_area ILIKE '%' || $1 || '%')
ORDER BY name
`;

async function main() {
  const res = await pool.query(sql, [area]);
  const rows = res.rows as {
    id: string;
    name: string;
    email: string;
    phone_number: string | null;
    service_area: string | null;
  }[];

  if (area) {
    console.log('Deliverymen for area "%s" (or service_area NULL):', area);
  } else {
    console.log("All deliverymen:");
  }
  console.log("—".repeat(60));
  if (rows.length === 0) {
    console.log("(none)");
  } else {
    for (const r of rows) {
      console.log(
        [
          r.id,
          r.name,
          r.phone_number ?? "-",
          r.service_area ?? "(all areas)",
        ].join(" | "),
      );
    }
  }
  console.log("—".repeat(60));
  console.log("Total:", rows.length);
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
