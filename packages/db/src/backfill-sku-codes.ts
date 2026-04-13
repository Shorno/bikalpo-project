/**
 * Manually add sku_code columns and then backfill existing data.
 * This bypasses the interactive drizzle-kit push.
 */
import { db } from "./index";
import { sql } from "drizzle-orm";

async function migrate() {
    console.log("🔧 Adding sku_code columns...\n");

    // 1. product_type
    try {
        await db.execute(sql`ALTER TABLE product_type ADD COLUMN IF NOT EXISTS sku_code VARCHAR(2) UNIQUE`);
        console.log("✅ product_type.sku_code added");
    } catch (e: any) { console.log("⏭️  product_type.sku_code:", e.message); }

    // 2. category
    try {
        await db.execute(sql`ALTER TABLE category ADD COLUMN IF NOT EXISTS sku_code VARCHAR(3)`);
        console.log("✅ category.sku_code added");
    } catch (e: any) { console.log("⏭️  category.sku_code:", e.message); }

    // 3. sub_category
    try {
        await db.execute(sql`ALTER TABLE sub_category ADD COLUMN IF NOT EXISTS sku_code VARCHAR(3)`);
        console.log("✅ sub_category.sku_code added");
    } catch (e: any) { console.log("⏭️  sub_category.sku_code:", e.message); }

    // 4. brand
    try {
        await db.execute(sql`ALTER TABLE brand ADD COLUMN IF NOT EXISTS sku_code VARCHAR(2) UNIQUE`);
        console.log("✅ brand.sku_code added");
    } catch (e: any) { console.log("⏭️  brand.sku_code:", e.message); }

    // 5. variant_option
    try {
        await db.execute(sql`ALTER TABLE variant_option ADD COLUMN IF NOT EXISTS sku_code VARCHAR(2)`);
        console.log("✅ variant_option.sku_code added");
    } catch (e: any) { console.log("⏭️  variant_option.sku_code:", e.message); }

    console.log("\n🔄 Backfilling SKU codes...\n");

    // Backfill product types (2-digit, global)
    const types = await db.execute(sql`
        UPDATE product_type SET sku_code = sub.code FROM (
            SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt", id)::text, 2, '0') AS code
            FROM product_type WHERE sku_code IS NULL
        ) sub WHERE product_type.id = sub.id
        RETURNING product_type.id, product_type.name, product_type.sku_code
    `);
    console.log(`📦 Product Types: ${types.rowCount ?? 0} updated`);
    for (const r of types.rows as any[]) { console.log(`   ${r.name} → ${r.sku_code}`); }

    // Backfill categories (3-digit, scoped to type_id)
    const cats = await db.execute(sql`
        UPDATE category SET sku_code = sub.code FROM (
            SELECT id, LPAD(ROW_NUMBER() OVER (PARTITION BY type_id ORDER BY "createdAt", id)::text, 3, '0') AS code
            FROM category WHERE sku_code IS NULL
        ) sub WHERE category.id = sub.id
        RETURNING category.id, category.name, category.sku_code
    `);
    console.log(`📂 Categories: ${cats.rowCount ?? 0} updated`);
    for (const r of cats.rows as any[]) { console.log(`   ${r.name} → ${r.sku_code}`); }

    // Backfill sub_categories (3-digit, scoped to category_id)
    const subs = await db.execute(sql`
        UPDATE sub_category SET sku_code = sub.code FROM (
            SELECT id, LPAD(ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY "createdAt", id)::text, 3, '0') AS code
            FROM sub_category WHERE sku_code IS NULL
        ) sub WHERE sub_category.id = sub.id
        RETURNING sub_category.id, sub_category.name, sub_category.sku_code
    `);
    console.log(`📁 Sub Categories: ${subs.rowCount ?? 0} updated`);
    for (const r of subs.rows as any[]) { console.log(`   ${r.name} → ${r.sku_code}`); }

    // Backfill brands (2-digit, global)
    const brands = await db.execute(sql`
        UPDATE brand SET sku_code = sub.code FROM (
            SELECT id, LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt", id)::text, 2, '0') AS code
            FROM brand WHERE sku_code IS NULL
        ) sub WHERE brand.id = sub.id
        RETURNING brand.id, brand.name, brand.sku_code
    `);
    console.log(`🏷️  Brands: ${brands.rowCount ?? 0} updated`);
    for (const r of brands.rows as any[]) { console.log(`   ${r.name} → ${r.sku_code}`); }

    // Backfill variant options (2-digit, scoped to type_id + category_id)
    const variants = await db.execute(sql`
        UPDATE variant_option SET sku_code = sub.code FROM (
            SELECT id, LPAD(ROW_NUMBER() OVER (
                PARTITION BY COALESCE(type_id, 0), COALESCE(category_id, 0)
                ORDER BY "createdAt", id
            )::text, 2, '0') AS code
            FROM variant_option WHERE sku_code IS NULL
        ) sub WHERE variant_option.id = sub.id
        RETURNING variant_option.id, variant_option.name, variant_option.sku_code
    `);
    console.log(`🔧 Variant Options: ${variants.rowCount ?? 0} updated`);
    for (const r of variants.rows as any[]) { console.log(`   ${r.name} → ${r.sku_code}`); }

    console.log("\n✅ Migration + backfill complete!");
    process.exit(0);
}

migrate().catch((err) => {
    console.error("❌ Failed:", err);
    process.exit(1);
});
