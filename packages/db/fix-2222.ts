import pg from "pg";
const c = new pg.Client("postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres");
await c.connect();

// Check variants for all products
const vars = await c.query(`SELECT pv.id, pv.product_id, p.name, pv.unit_label, pv.variant_type, pv.pack_type, pv.weight_kg, pv.price FROM product_variant pv JOIN product p ON pv.product_id = p.id ORDER BY pv.product_id, pv.id`);
console.log("ALL VARIANTS:");
vars.rows.forEach(r => console.log(`  pid=${r.product_id} (${r.name}) v=${r.id} label=${r.unit_label} type=${r.variant_type} pack=${r.pack_type} w=${r.weight_kg} p=${r.price}`));

await c.end();
