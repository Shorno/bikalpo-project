import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "@bikalpo-project/db/schema";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

// The service runs against an isolated, in-memory PostgreSQL engine.
// Its default connection is never used by these tests.
Object.assign(process.env, {
  DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused",
  BETTER_AUTH_SECRET: "owner-price-test-secret-32-characters!!",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGINS: "http://localhost:3001",
  CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test",
  CLOUDINARY_API_SECRET: "test",
  BARIKOI_API_KEY: "test",
});

const fixtureSql = `
CREATE TABLE product_type (id integer PRIMARY KEY, name text);
CREATE TABLE category (id integer PRIMARY KEY, name text, type_id integer);
CREATE TABLE sub_category (id integer PRIMARY KEY, name text);
CREATE TABLE brand (id integer PRIMARY KEY, name text);
CREATE TABLE core_product_identity (id integer PRIMARY KEY, name text, catalog_code text);
CREATE TABLE variant_option (id integer PRIMARY KEY, name text, unit text, size text, definition jsonb);
CREATE TABLE product (id integer PRIMARY KEY, name text, sku text, catalog_code text,
  category_id integer, sub_category_id integer, core_product_id integer, brand_id integer,
  creator_source text, created_by_id text);
CREATE TABLE product_variant (id integer PRIMARY KEY, product_id integer, source_variant_option_id integer,
  brand_id integer, is_active boolean DEFAULT true, sku text, preferred_local_sku text,
  unit_label text DEFAULT 'Piece', quantity_selector_label text, order_unit text DEFAULT 'piece',
  pack_type text, packaging_type text DEFAULT 'loose', price numeric(10,2), sort_order integer DEFAULT 0,
  min_margin_percent numeric(5,2), min_margin_amount numeric(10,2),
  exchange_enabled boolean DEFAULT false, exchange_credit_amount numeric(10,2) DEFAULT 0);
CREATE TABLE inventory_movement (id integer PRIMARY KEY, owner_type text, owner_id text, variant_id integer,
  reason text, unit_cost numeric(14,4), reverses_movement_id integer, occurred_at timestamp);
CREATE TABLE stock_entry (id integer PRIMARY KEY, warehouse_id text, variant_id integer,
  total_cost numeric(12,2), inventory_delta numeric(12,2), "createdAt" timestamp);
CREATE TABLE inventory (id integer PRIMARY KEY, owner_type text, owner_id text, variant_id integer,
  retail_price numeric(10,2), updated_at timestamp DEFAULT now());

INSERT INTO product_type VALUES (1, 'LPG'), (2, 'Grocery');
INSERT INTO category VALUES (1, 'Gas', 1), (2, 'Food', 2);
INSERT INTO sub_category VALUES (1, 'Household'), (2, 'Rice');
INSERT INTO brand VALUES (1, 'Omera'), (2, 'ACI');
INSERT INTO core_product_identity VALUES (1, 'LPG Cylinder', '01010101'), (2, 'Miniket Rice', '02020101');
INSERT INTO variant_option VALUES
  (1, '12 KG Cylinder', 'KG', '12', '{"kind":"measurement","value":"12","measurementUnit":"KG","container":"cylinder"}');
INSERT INTO product VALUES
  (1, 'Omera LPG Cylinder', 'PRD-000001', '0101010101', 1, 1, 1, 1, 'admin', null),
  (2, 'ACI Miniket Rice', 'PRD-000002', null, 2, 2, 2, 2, 'shop', 'shop-a'),
  (3, 'Shop B Rice', 'PRD-000003', null, 2, 2, 2, 2, 'shop', 'shop-b');
INSERT INTO product_variant (id, product_id, source_variant_option_id, brand_id, sku, pack_type, packaging_type,
  price, min_margin_amount, exchange_enabled, exchange_credit_amount, quantity_selector_label) VALUES
  (1, 1, 1, 1, 'OMERA-12', 'cylinder', 'cylinder', 3000, 100, true, 1700, '12 KG'),
  (2, 2, null, 2, 'ACI-1', null, 'packet', 60, null, false, 0, '1 KG'),
  (3, 3, null, 2, 'SHOPB-1', null, 'packet', 55, null, false, 0, '1 KG');
INSERT INTO inventory (id, owner_type, owner_id, variant_id, retail_price) VALUES
  (10, 'shop', 'shop-a', 1, 3300),
  (11, 'shop', 'shop-a', 2, null),
  (12, 'shop', 'shop-b', 3, 70),
  (13, 'warehouse', 'wh-a', 1, 3150);
-- Shop A: cylinder bought at 1400 then 1450; the later 1500 receipt was reversed.
-- Rice has no purchase yet. Shop B's cost must never leak into shop A.
INSERT INTO inventory_movement VALUES
  (1, 'shop', 'shop-a', 1, 'purchase_receipt', 1400, null, '2026-11-01'),
  (2, 'shop', 'shop-a', 1, 'purchase_receipt', 1450, null, '2026-11-10'),
  (3, 'shop', 'shop-a', 1, 'purchase_receipt', 1500, null, '2026-11-15'),
  (4, 'shop', 'shop-a', 1, 'purchase_reversal', 1500, 3, '2026-11-16'),
  (5, 'shop', 'shop-b', 3, 'purchase_receipt', 50, null, '2026-11-10'),
  (6, 'warehouse', 'wh-a', 1, 'purchase_receipt', 1300, null, '2026-11-01');
-- Warehouse direct stock entry is newer than its receipt: 10 cylinders for 13500.
INSERT INTO stock_entry VALUES (1, 'wh-a', 1, 13500, 10, '2026-11-12');
`;

test("owner prices list, validate and plan only the owner's own rows", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(fixtureSql);
    const { createOwnerPriceService } = await import("./owner-prices");
    const service = createOwnerPriceService(
      drizzle(pg, { schema }) as unknown as Parameters<
        typeof createOwnerPriceService
      >[0],
    );

    const list = await service.listOwnerPrices("shop", "shop-a", {
      page: 1,
      limit: 10,
    });
    assert.equal(list.stats.totalProducts, 2);
    assert.deepEqual(
      list.items.map((row) => row.variantPriceId).sort(),
      [10, 11],
    );
    const cylinder = list.items.find((row) => row.variantPriceId === 10);
    assert.equal(cylinder?.consumerPrice, "3300.00");
    assert.equal(cylinder?.exchangePrice, "1600.00");
    assert.equal(cylinder?.isCylinderPricing, true);
    assert.equal(cylinder?.coreCatalogCode, "01010101");
    // Admin-created variant: the shop cannot change its exchange credit.
    assert.equal(cylinder?.canEditExchange, false);
    const rice = list.items.find((row) => row.variantPriceId === 11);
    // No retail price yet: falls back to the variant base price.
    assert.equal(rice?.consumerPrice, "60.00");
    assert.equal(rice?.canEditExchange, true);
    // Latest unreversed purchase receipt; none recorded for rice.
    assert.equal(cylinder?.purchasePrice, "1450.00");
    assert.equal(rice?.purchasePrice, null);

    // Warehouse: the newer direct stock entry wins over the older receipt.
    const warehouseList = await service.listOwnerPrices("warehouse", "wh-a", {});
    assert.equal(warehouseList.items[0]?.purchasePrice, "1350.00");

    const search = await service.listOwnerPrices("shop", "shop-a", {
      search: "0101010101",
    });
    assert.deepEqual(
      search.items.map((row) => row.variantPriceId),
      [10],
    );

    const filters = await service.listOwnerPriceFilters("shop", "shop-a");
    assert.deepEqual(
      filters.types.map((type) => type.name).sort(),
      ["Grocery", "LPG"],
    );

    // New price only: credit is kept, so Exchange follows automatically.
    const plan = await service.planOwnerProductPriceUpdate("shop", "shop-a", {
      productId: 1,
      rows: [{ variantPriceId: 10, consumerPrice: "3400" }],
    });
    assert.deepEqual(plan, [
      { inventoryId: 10, variantId: 1, retailPrice: "3400.00", exchange: null },
    ]);

    // Below base price + required margin (3000 + 100).
    await assert.rejects(
      service.planOwnerProductPriceUpdate("shop", "shop-a", {
        productId: 1,
        rows: [{ variantPriceId: 10, consumerPrice: "3050" }],
      }),
      /at least ৳3100\.00/,
    );

    // Changing the exchange credit of an admin variant is refused.
    await assert.rejects(
      service.planOwnerProductPriceUpdate("shop", "shop-a", {
        productId: 1,
        rows: [
          { variantPriceId: 10, consumerPrice: "3400", exchangePrice: "2000" },
        ],
      }),
      /not managed by your store/,
    );

    // Another shop's inventory line is not found.
    await assert.rejects(
      service.planOwnerProductPriceUpdate("shop", "shop-a", {
        productId: 3,
        rows: [{ variantPriceId: 12, consumerPrice: "75" }],
      }),
    );

    // Warehouses have no minimum margin check.
    const warehousePlan = await service.planOwnerProductPriceUpdate(
      "warehouse",
      "wh-a",
      { productId: 1, rows: [{ variantPriceId: 13, consumerPrice: "3050" }] },
    );
    assert.equal(warehousePlan[0]?.retailPrice, "3050.00");
  } finally {
    await pg.close();
  }
});
