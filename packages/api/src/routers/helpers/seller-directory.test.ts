import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  sellerLocationsQuery,
  sellersByLocationQuery,
} from "./seller-directory";

test("seller cards expose current business photos, category and logo without registration documents", async () => {
  const pg = new PGlite();
  const dialect = new PgDialect();
  try {
    await pg.exec(`
      create table "user" (
        id text, role text, seller_status text, banned boolean,
        shop_name text, shop_slug text, shop_logo text, warehouse_name text, warehouse_slug text
      );
      create table seller_application (
        id text, user_id text, business_nature text, shop_address text,
        district text, division text, latitude text, longitude text,
        updated_at timestamp, status text, area text, business_category text, document_urls json
      );
      create table warehouse_application (like seller_application including all);
      alter table warehouse_application rename shop_address to warehouse_address;
      insert into "user" values
        ('retailer', 'shop_owner', 'approved', false, 'Local shop', 'local-shop', '/logo.png', null, null),
        ('warehouse', 'warehouse', null, false, null, null, null, 'Wholesale depot', 'depot'),
        ('pending', 'shop_owner', 'pending', false, 'Pending shop', 'pending', null, null, null);
      insert into seller_application values
        ('old', 'retailer', 'retail_shop', 'Old address', 'Dhaka', 'Dhaka', '23.8', '90.4', '2025-01-01', 'approved', 'Old area', 'Old category', '{"storeFront":"/old.jpg"}'),
        ('current', 'retailer', 'retail_shop', 'Business address', 'Dhaka', 'Dhaka', '23.8', '90.4', '2026-01-01', 'approved', 'Mirpur', 'Grocery', '{"storeFront":"/front.jpg","shopPhoto":"/inside.jpg","warehouse":"","nid":"/private-id.pdf","tradeLicense":"/private-license.pdf"}'),
        ('pending', 'pending', 'retail_shop', 'Pending address', 'Dhaka', 'Dhaka', '23.8', '90.4', '2026-01-01', 'pending', 'Mirpur', 'Grocery', '{"storeFront":"/pending.jpg"}');
      insert into warehouse_application values
        ('warehouse', 'warehouse', 'wholesaler', 'Warehouse address', 'Dhaka', 'Dhaka', '23.8', '90.4', '2026-01-01', 'approved', 'Uttara', 'Gas', '{"warehouse":"/warehouse.jpg","nid":"/private-warehouse-id.pdf"}');
    `);
    const listQuery = dialect.sqlToQuery(
      sellersByLocationQuery(" DHAKA ", "dhaka"),
    );
    const { rows } = await pg.query<{
      totalCount: number;
      sellers: Array<{
        id: string;
        logo: string | null;
        images: string[];
        area: string;
        category: string;
      }>;
    }>(listQuery.sql, listQuery.params);
    assert.equal(rows[0].totalCount, 2);
    const retailer = rows[0].sellers.find((seller) => seller.id === "retailer");
    assert.equal(retailer?.logo, "/logo.png");
    assert.equal(retailer?.area, "Mirpur");
    assert.equal(retailer?.category, "Grocery");
    assert.deepEqual(retailer?.images, ["/front.jpg", "/inside.jpg"]);
    const warehouse = rows[0].sellers.find(
      (seller) => seller.id === "warehouse",
    );
    assert.equal(warehouse?.logo, null);
    assert.equal(warehouse?.category, "Gas");
    assert.deepEqual(warehouse?.images, ["/warehouse.jpg"]);
    assert.doesNotMatch(JSON.stringify(rows), /private|pending\.jpg|old\.jpg/);

    await pg.exec("update warehouse_application set document_urls = null");
    const emptyPhotos = await pg.query<{
      sellers: Array<{ id: string; images: string[] }>;
    }>(listQuery.sql, listQuery.params);
    assert.deepEqual(
      emptyPhotos.rows[0].sellers.find((seller) => seller.id === "warehouse")
        ?.images,
      [],
    );
    const locationQuery = dialect.sqlToQuery(sellerLocationsQuery());
    const locations = await pg.query<{ count: number }>(
      locationQuery.sql,
      locationQuery.params,
    );
    assert.equal(locations.rows[0].count, 2);
  } finally {
    await pg.close();
  }
});
