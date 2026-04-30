const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres'
});

(async () => {
  // Get assignments  
  const r2 = await pool.query(`
    SELECT sca.id, sca.shop_id, sca.category_id, sca.subcategory_id,
           u.name as shop_name,
           c.name as cat_name
    FROM shop_category_assignment sca
    JOIN "user" u ON u.id = sca.shop_id
    JOIN category c ON c.id = sca.category_id
  `);
  console.log('=== Shop Category Assignments ===');
  console.log(JSON.stringify(r2.rows, null, 2));

  // Find the shop user by phone-like matching
  const r3 = await pool.query(`SELECT id, name, is_seller, shop_slug FROM "user" WHERE is_seller = true LIMIT 10`);
  console.log('\n=== Seller Users ===');
  console.log(JSON.stringify(r3.rows, null, 2));

  // Check what categories the core products belong to
  const r4 = await pool.query(`
    SELECT cp.id, cp.name, cp.category_id, c.name as cat_name, c.type_id,
           cp.sub_category_id, sc.name as subcat_name
    FROM core_product_identity cp
    LEFT JOIN category c ON c.id = cp.category_id
    LEFT JOIN sub_category sc ON sc.id = cp.sub_category_id
  `);
  console.log('\n=== Core Products with Categories ===');
  console.log(JSON.stringify(r4.rows, null, 2));

  // Check assigned categories vs core product categories
  const r5 = await pool.query(`
    SELECT DISTINCT sca.category_id, c.name as assigned_cat
    FROM shop_category_assignment sca
    JOIN category c ON c.id = sca.category_id
  `);
  console.log('\n=== Assigned Category IDs ===');
  console.log(JSON.stringify(r5.rows, null, 2));

  const r6 = await pool.query(`
    SELECT DISTINCT category_id FROM core_product_identity
  `);
  console.log('\n=== Core Product Category IDs ===');
  console.log(JSON.stringify(r6.rows, null, 2));

  await pool.end();
})();
