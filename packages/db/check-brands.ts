import dotenv from "dotenv";
dotenv.config({ path: "../../apps/server/.env" });

import pg from "pg";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
    await client.connect();
    
    // Check products with coreProductId and their brandId
    const res = await client.query(`
        SELECT p.id, p.name, p.brand_id, b.name as brand_name, p.core_product_id
        FROM product p
        LEFT JOIN brand b ON p.brand_id = b.id
        WHERE p.core_product_id IS NOT NULL
        ORDER BY p.id
        LIMIT 20
    `);
    
    console.log("\n=== Products with coreProductId ===");
    for (const row of res.rows) {
        console.log(`  Product #${row.id}: "${row.name}" | brand_id=${row.brand_id} | brand_name=${row.brand_name} | core_product_id=${row.core_product_id}`);
    }
    
    // Check variants for these products
    if (res.rows.length > 0) {
        const ids = res.rows.map((r: any) => r.id);
        const vRes = await client.query(`
            SELECT pv.id, pv.product_id, pv.sku, pv.brand_id, b.name as brand_name, pv.unit_label
            FROM product_variant pv
            LEFT JOIN brand b ON pv.brand_id = b.id
            WHERE pv.product_id = ANY($1)
            ORDER BY pv.product_id, pv.id
        `, [ids]);
        
        console.log("\n=== Variants ===");
        for (const v of vRes.rows) {
            console.log(`  Variant #${v.id}: product=${v.product_id} | sku=${v.sku} | brand_id=${v.brand_id} | brand=${v.brand_name} | label=${v.unit_label}`);
        }
    }
    
    await client.end();
}

main().catch(console.error);
