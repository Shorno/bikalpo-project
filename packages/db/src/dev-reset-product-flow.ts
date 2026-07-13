/**
 * DEV-ONLY: Reset catalog, inventory, and commerce test data so the complete
 * Admin -> Warehouse -> Retailer product flow can be tested from scratch.
 *
 * Preview (default):
 *   pnpm db:reset-product-flow
 *
 * Execute:
 *   pnpm db:reset-product-flow --execute
 *
 * Authentication, users, organizations, brands, product types, categories,
 * assignments, connections, suppliers, and other reusable master data are
 * intentionally preserved.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { Pool, type PoolClient } from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../apps/server/.env") });

const RESET_TABLES = [
	"admin_product_generation_template",
	"brand_update",
	"cart",
	"cart_item",
	"carton",
	"carton_config",
	"catalog_approval_request",
	"combo_offer",
	"complaint",
	"complaint_action_log",
	"complaint_reply",
	"core_product_identity",
	"customer_home_tab_product",
	"damage_entry",
	"damage_entry_item",
	"delivery_group",
	"delivery_group_invoice",
	"delivery_kpi",
	"delivery_location_ping",
	"empty_pack",
	"estimate",
	"estimate_item",
	"expense",
	"financial_ledger",
	"inventory",
	"invoice",
	"invoice_item",
	"item_request",
	"offer",
	"open_order_bid",
	"open_order_bid_item",
	"order",
	"order_item",
	"order_return",
	"payment",
	"product",
	"product_brand",
	"product_identity_request",
	"product_image",
	"product_pack_rule",
	"product_review",
	"product_variant",
	"product_variant_price",
	"purchase",
	"purchase_item",
	"sales_model_product",
	"shop_product_generation_template",
	"stock_adjustment",
	"stock_adjustment_item",
	"stock_entry",
	"variant_conversion_map",
	"variant_option",
	"warehouse_due_collection",
	"warehouse_pos_cart",
	"warehouse_pos_payment",
	"warehouse_pos_sale",
	"warehouse_pos_sale_item",
	"warehouse_product_generation_template",
	"warehouse_variant_alias",
] as const;

const PRESERVED_TABLES = [
	"user",
	"account",
	"session",
	"brand",
	"product_type",
	"category",
	"sub_category",
	"product_type_rule_setting",
	"shop_category_assignment",
	"warehouse_category_assignment",
	"shop_warehouse_connection",
	"warehouse_warehouse_connection",
	"supplier",
	"payee",
	"expense_category",
	"delivery_area",
	"delivery_schedule",
	"warehouse_pos_customer",
] as const;

type Counts = Record<string, number>;

function quoteIdentifier(identifier: string) {
	return `"${identifier.replaceAll('"', '""')}"`;
}

async function getCounts(
	client: Pool | PoolClient,
	tables: readonly string[],
): Promise<Counts> {
	const counts: Counts = {};

	for (const table of tables) {
		const result = await client.query<{ count: string }>(
			`select count(*)::text as count from public.${quoteIdentifier(table)}`,
		);
		counts[table] = Number(result.rows[0]?.count ?? 0);
	}

	return counts;
}

function printCounts(title: string, counts: Counts) {
	console.log(`\n${title}`);
	let total = 0;
	let nonEmptyTables = 0;

	for (const [table, count] of Object.entries(counts)) {
		total += count;
		if (count > 0) {
			nonEmptyTables += 1;
			console.log(`  ${table}: ${count}`);
		}
	}

	if (nonEmptyTables === 0) {
		console.log("  All tables are empty.");
	}
	console.log(`  Total rows: ${total}`);
}

async function validateTablesAndForeignKeys(pool: Pool) {
	const existingResult = await pool.query<{ table_name: string }>(`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `);
	const existingTables = new Set(
		existingResult.rows.map((row) => row.table_name),
	);
	const requiredTables = [...RESET_TABLES, ...PRESERVED_TABLES];
	const missingTables = requiredTables.filter(
		(table) => !existingTables.has(table),
	);

	if (missingTables.length > 0) {
		throw new Error(
			`Reset aborted because expected tables are missing: ${missingTables.join(", ")}`,
		);
	}

	const foreignKeyResult = await pool.query<{
		child_table: string;
		parent_table: string;
	}>(`
    select
      child.relname as child_table,
      parent.relname as parent_table
    from pg_constraint constraint_record
    join pg_class child on child.oid = constraint_record.conrelid
    join pg_namespace child_namespace on child_namespace.oid = child.relnamespace
    join pg_class parent on parent.oid = constraint_record.confrelid
    join pg_namespace parent_namespace on parent_namespace.oid = parent.relnamespace
    where constraint_record.contype = 'f'
      and child_namespace.nspname = 'public'
      and parent_namespace.nspname = 'public'
  `);
	const resetTableSet = new Set<string>(RESET_TABLES);
	const uncoveredDependencies = foreignKeyResult.rows.filter(
		({ child_table, parent_table }) =>
			resetTableSet.has(parent_table) && !resetTableSet.has(child_table),
	);

	if (uncoveredDependencies.length > 0) {
		const details = uncoveredDependencies
			.map(
				({ child_table, parent_table }) => `${child_table} -> ${parent_table}`,
			)
			.join(", ");
		throw new Error(
			`Reset aborted because the explicit table list does not cover these dependencies: ${details}`,
		);
	}
}

function assertCountsUnchanged(before: Counts, after: Counts) {
	const changed = Object.keys(before).filter(
		(table) => before[table] !== after[table],
	);

	if (changed.length > 0) {
		throw new Error(
			`Preserved table counts changed unexpectedly: ${changed.join(", ")}`,
		);
	}
}

function assertResetTablesAreEmpty(counts: Counts) {
	const nonEmpty = Object.entries(counts).filter(([, count]) => count !== 0);

	if (nonEmpty.length > 0) {
		throw new Error(
			`Reset verification failed for: ${nonEmpty
				.map(([table, count]) => `${table} (${count})`)
				.join(", ")}`,
		);
	}
}

async function main() {
	const args = process.argv.slice(2);
	const execute = args.includes("--execute");
	const unknownArgs = args.filter((arg) => arg !== "--execute");

	if (unknownArgs.length > 0) {
		throw new Error(`Unknown arguments: ${unknownArgs.join(", ")}`);
	}
	if (process.env.NODE_ENV === "production") {
		throw new Error("Refusing to reset product-flow data in production.");
	}
	if (!process.env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not configured.");
	}

	const databaseUrl = new URL(process.env.DATABASE_URL);
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });

	try {
		const targetResult = await pool.query<{
			database_name: string;
			environment: string;
		}>(`
      select
        current_database() as database_name,
        current_setting('server_version') as environment
    `);
		const target = targetResult.rows[0];

		console.log("=== Development product-flow database reset ===");
		console.log(`Mode: ${execute ? "EXECUTE" : "PREVIEW"}`);
		console.log(`NODE_ENV: ${process.env.NODE_ENV ?? "unset"}`);
		console.log(
			`Database: ${target?.database_name ?? databaseUrl.pathname.slice(1)}`,
		);
		console.log(`Host: ${databaseUrl.hostname}`);
		console.log(`PostgreSQL: ${target?.environment ?? "unknown"}`);

		await validateTablesAndForeignKeys(pool);

		const resetCountsBefore = await getCounts(pool, RESET_TABLES);
		const preservedCountsBefore = await getCounts(pool, PRESERVED_TABLES);
		printCounts("Rows scheduled for deletion", resetCountsBefore);
		printCounts("Preserved rows", preservedCountsBefore);

		if (!execute) {
			console.log(
				"\nPreview complete. Run `pnpm db:reset-product-flow --execute` to delete these development records.",
			);
			return;
		}

		const client = await pool.connect();
		try {
			await client.query("begin");
			await client.query(
				`truncate table ${RESET_TABLES.map(
					(table) => `public.${quoteIdentifier(table)}`,
				).join(", ")} restart identity`,
			);

			const resetCountsAfter = await getCounts(client, RESET_TABLES);
			const preservedCountsAfter = await getCounts(client, PRESERVED_TABLES);
			assertResetTablesAreEmpty(resetCountsAfter);
			assertCountsUnchanged(preservedCountsBefore, preservedCountsAfter);
			await client.query("commit");
		} catch (error) {
			await client.query("rollback");
			throw error;
		} finally {
			client.release();
		}

		const verifiedResetCounts = await getCounts(pool, RESET_TABLES);
		const verifiedPreservedCounts = await getCounts(pool, PRESERVED_TABLES);
		assertResetTablesAreEmpty(verifiedResetCounts);
		assertCountsUnchanged(preservedCountsBefore, verifiedPreservedCounts);
		printCounts("Reset verification", verifiedResetCounts);
		printCounts("Preserved rows after reset", verifiedPreservedCounts);
		console.log("\nDevelopment product-flow reset completed successfully.");
	} finally {
		await pool.end();
	}
}

main().catch((error) => {
	console.error("Reset failed:", error);
	process.exit(1);
});
