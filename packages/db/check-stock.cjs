const { Pool } = require("pg");
const p = new Pool({ connectionString: "postgres://postgres:VnAofnw2a8PZOI6VDKK23eMrWYYSSMh9Ozz4BvVDf6H6UP0MfPhetDnShOdEphJ9@72.62.74.96:2222/postgres" });

async function check() {
  // Check stock_change_log for product_id of "For Example new"
  const prod = await p.query(`SELECT id FROM product WHERE name LIKE '%Example new%'`);
  const productId = prod.rows[0]?.id;
  console.log("Product ID:", productId);

  if (productId) {
    const logs = await p.query(`
      SELECT * FROM stock_change_log WHERE product_id = $1 ORDER BY created_at DESC
    `, [productId]);
    console.log("\n=== STOCK CHANGE LOG ===");
    console.table(logs.rows);
  }

  // Check order 59 details  
  console.log("\n=== ORDER 59 ===");
  const order = await p.query(`
    SELECT o.id, o.status, o.shipped_at, o.delivered_at, o.received_at,
           oi.id as item_id, oi.variant_id, oi.quantity, oi.unit_price,
           pv.unit_label, b.name as brand
    FROM "order" o
    JOIN order_item oi ON oi.order_id = o.id
    JOIN product_variant pv ON oi.variant_id = pv.id
    LEFT JOIN brand b ON pv.brand_id = b.id
    WHERE o.id = 59
  `);
  console.table(order.rows);

  // Check invoice for order 59
  console.log("\n=== INVOICES for order 59 ===");
  const inv = await p.query(`
    SELECT i.id, i.invoice_number, i.status, i.order_id,
           ii.variant_id, ii.quantity, ii.unit_price
    FROM invoice i
    JOIN invoice_item ii ON ii.invoice_id = i.id
    WHERE i.order_id = 59
  `);
  console.table(inv.rows);

  p.end();
}
check().catch(e => { console.error(e); p.end(); });
