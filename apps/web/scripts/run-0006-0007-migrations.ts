/**
 * Run 0006 (product_variant + cart/order variant_id) and 0007 (variant pricing/delivery_rule).
 * Use when db:migrate fails due to earlier migrations (e.g. address already exists).
 *
 *   pnpm exec tsx scripts/run-0006-0007-migrations.ts
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

function splitStatements(content: string): string[] {
  return content
    .split(/--> statement-breakpoint\n?/)
    .map((s) => s.replace(/^[\s\n]+|[\s\n]+$/g, ""))
    .filter((s) => s.length > 0);
}

async function runFile(name: string) {
  const path = join(process.cwd(), "drizzle", name);
  const content = readFileSync(path, "utf-8");
  const statements = splitStatements(content);
  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    try {
      await pool.query(sql);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (
        err.code === "42P07" ||
        err.code === "42701" ||
        err.code === "42710" ||
        err.code === "42P16" ||
        err.message?.includes("already exists")
      ) {
        // relation/column already exists or invalid alter - skip
        continue;
      }
      throw e;
    }
  }
}

async function main() {
  await runFile("0006_product_variant.sql");
  console.log(
    "Applied 0006: product_variant, cart_item.variant_id, order_item.variant_id",
  );
  await runFile("0007_variant_pricing_delivery_rules.sql");
  console.log(
    "Applied 0007: variant pricing/order/quantity options, delivery_rule",
  );
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
