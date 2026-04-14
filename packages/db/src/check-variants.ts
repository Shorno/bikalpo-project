import { db } from "./index";
import { sql } from "drizzle-orm";

async function main() {
    // Get latest product
    const products = await db.execute(sql`
        SELECT id, name, unit_size, sku FROM product ORDER BY id DESC LIMIT 3
    `);
    console.log("\n=== Latest Products ===");
    console.table(products.rows);

    const latestId = products.rows[0]?.id;
    if (!latestId) { console.log("No products"); process.exit(0); }

    // Check variants for latest product
    const variants = await db.execute(sql`
        SELECT pv.id, pv.sku, pv.variant_type, pv.brand_id, b.name as brand_name, 
               pv.weight_kg, pv.unit_label
        FROM product_variant pv
        LEFT JOIN brand b ON b.id = pv.brand_id
        WHERE pv.product_id = ${latestId}
        ORDER BY pv.brand_id, pv.id
    `);
    console.log(`\n=== Product ${latestId} Variants (${variants.rows.length} rows) ===`);
    console.table(variants.rows);

    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
