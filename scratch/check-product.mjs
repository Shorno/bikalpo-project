import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres'
});

await client.connect();

// 1. Product info
const product = await client.query(`SELECT id, name, slug, brand_id FROM product WHERE id = 17`);
console.log('\n=== PRODUCT ===');
console.table(product.rows);

// 2. Product brands (M2M)
const productBrands = await client.query(`
  SELECT pb.id, pb.product_id, pb.brand_id, b.name as brand_name 
  FROM product_brand pb 
  JOIN brand b ON pb.brand_id = b.id 
  WHERE pb.product_id = 17
`);
console.log('\n=== PRODUCT BRANDS (M2M) ===');
console.table(productBrands.rows);

// 3. Variants with brand info
const variants = await client.query(`
  SELECT pv.id, pv.product_id, pv.unit_label, pv.weight_kg, pv.variant_type, 
         pv.brand_id, b.name as brand_name, pv.price, pv.sku
  FROM product_variant pv
  LEFT JOIN brand b ON pv.brand_id = b.id
  WHERE pv.product_id = 17
  ORDER BY pv.brand_id, pv.id
`);
console.log('\n=== VARIANTS (brand-wise) ===');
console.table(variants.rows);

// 4. Inventory for these variants
const inventory = await client.query(`
  SELECT inv.id, inv.owner_type, inv.owner_id, inv.variant_id, inv.available_qty, inv.reserved_qty,
         pv.unit_label, pv.weight_kg, pv.brand_id, b.name as brand_name
  FROM inventory inv
  JOIN product_variant pv ON inv.variant_id = pv.id
  LEFT JOIN brand b ON pv.brand_id = b.id
  WHERE pv.product_id = 17
  ORDER BY pv.brand_id, inv.id
`);
console.log('\n=== INVENTORY (brand-wise) ===');
console.table(inventory.rows);

await client.end();
