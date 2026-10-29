import assert from "node:assert/strict";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  type ShopCardProfile,
  shopCardProfilesQuery,
} from "./shop-card-profile";

test("store cards use the latest approved business profile and only public photos", async () => {
  const pg = new PGlite();
  const dialect = new PgDialect();
  try {
    await pg.exec(`
      create table seller_application (
        id text, user_id text, area text, district text, division text,
        business_nature text, business_category text, document_urls json,
        status text, updated_at timestamp
      );
      insert into seller_application values
        ('old', 'shop', 'Old area', 'Dhaka', 'Dhaka', 'retail_shop', 'Old category',
          '{"storeFront":"/old.jpg"}', 'approved', '2025-01-01'),
        ('current', 'shop', 'Mirpur', 'Dhaka', 'Dhaka', 'retail_shop', 'Grocery',
          '{"storeFront":"/front.jpg","shopPhoto":"/inside.jpg","warehouse":"","nid":"/private-id.pdf","tradeLicense":"/private-license.pdf"}', 'approved', '2026-01-01'),
        ('pending', 'shop', 'Pending area', 'Dhaka', 'Dhaka', 'retail_shop', 'Pending category',
          '{"storeFront":"/pending.jpg"}', 'pending', '2026-02-01'),
        ('empty', 'empty-shop', null, null, null, null, null, null, 'approved', '2026-01-01'),
        ('other', 'other-shop', 'Uttara', 'Dhaka', 'Dhaka', 'retail_shop', 'Gas',
          '{"storeFront":"/other.jpg"}', 'approved', '2026-01-01');
    `);
    const query = dialect.sqlToQuery(
      shopCardProfilesQuery(["shop", "empty-shop", "missing-shop"]),
    );
    const { rows } = await pg.query<ShopCardProfile>(query.sql, query.params);
    assert.equal(rows.length, 2);
    const profile = rows.find((row) => row.userId === "shop");
    assert.equal(profile?.area, "Mirpur");
    assert.equal(profile?.category, "Grocery");
    assert.deepEqual(profile?.images, ["/front.jpg", "/inside.jpg"]);
    assert.deepEqual(
      rows.find((row) => row.userId === "empty-shop")?.images,
      [],
    );
    assert.doesNotMatch(
      JSON.stringify(rows),
      /private|old\.jpg|pending|other\.jpg/,
    );

    const emptyQuery = dialect.sqlToQuery(shopCardProfilesQuery([]));
    assert.deepEqual(
      (await pg.query(emptyQuery.sql, emptyQuery.params)).rows,
      [],
    );
  } finally {
    await pg.close();
  }
});
