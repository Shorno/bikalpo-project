import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres'
});

await client.connect();

const result = await client.query(`
  SELECT pv.id, pv.unit_label, pv.weight_kg, pv.sku, pv.brand_id, 
         b.name as brand_name, pv.source_variant_price_id, pv."createdAt"
  FROM product_variant pv
  LEFT JOIN brand b ON pv.brand_id = b.id
  WHERE pv.product_id = 17
  ORDER BY pv.id
`);

console.log('\n=== ALL VARIANTS FOR PRODUCT 17 ===');
console.table(result.rows);

await client.end();
