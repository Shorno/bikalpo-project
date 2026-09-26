import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as schema from "@bikalpo-project/db/schema";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

// The service is exercised against an isolated, in-memory PostgreSQL engine.
// Its default connection is never used by these tests.
Object.assign(process.env, {
  DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused",
  BETTER_AUTH_SECRET: "consumer-price-test-secret-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGINS: "http://localhost:3001",
  CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test",
  CLOUDINARY_API_SECRET: "test",
  BARIKOI_API_KEY: "test",
});

const fixtureSql = `
CREATE TABLE product_type (id integer PRIMARY KEY, name text, slug text, fulfillment_family text);
CREATE TABLE category (id integer PRIMARY KEY, name text, type_id integer);
CREATE TABLE sub_category (id integer PRIMARY KEY, name text);
CREATE TABLE brand (id integer PRIMARY KEY, name text);
CREATE TABLE core_product_identity (id integer PRIMARY KEY, name text, sku text);
CREATE TABLE variant_option (id integer PRIMARY KEY, name text, unit text, size text, definition jsonb);
CREATE TABLE product (id integer PRIMARY KEY, name text, sku text, category_id integer,
  sub_category_id integer, core_product_id integer, brand_id integer, creator_source text);
CREATE TABLE product_variant_price (id integer PRIMARY KEY, product_id integer, variant_option_id integer,
  brand_id integer, consumer_price numeric(10,2), is_active boolean DEFAULT true, sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());
CREATE TABLE catalog_variant (id integer PRIMARY KEY, global_sku text);
CREATE TABLE product_variant (id integer PRIMARY KEY, product_id integer, source_variant_price_id integer,
  source_variant_option_id integer, brand_id integer, is_active boolean DEFAULT true, sku text,
  preferred_local_sku text, catalog_variant_id integer, pack_type text, packaging_type text,
  price numeric(10,2), exchange_enabled boolean DEFAULT false, exchange_credit_amount numeric(10,2) DEFAULT 0,
  "updatedAt" timestamp DEFAULT now());
CREATE TABLE product_brand (id integer PRIMARY KEY, product_id integer, brand_id integer,
  created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now());

INSERT INTO product_type VALUES (1, 'LPG', 'lpg', 'lpg'), (2, 'Grocery', 'grocery', 'grocery');
INSERT INTO category VALUES (1, 'Gas', 1), (2, 'Food', 2);
INSERT INTO sub_category VALUES (1, 'Household'), (2, 'Rice');
INSERT INTO brand VALUES (1, 'Omera'), (2, 'Bashundhara'), (3, 'ACI'), (4, 'PRAN');
INSERT INTO core_product_identity VALUES (1, 'LPG Cylinder', 'CORE-GAS'), (2, 'Miniket Rice', 'CORE-RICE');
INSERT INTO variant_option VALUES
  (1, '12 KG Cylinder', 'KG', '12', '{"kind":"measurement","value":"12","measurementUnit":"KG","container":"cylinder"}'),
  (2, '16 KG Cylinder', 'KG', '16', '{"kind":"measurement","value":"16","measurementUnit":"KG","container":"cylinder"}'),
  (3, '1KG Pack', 'KG', '1', '{"kind":"measurement","value":"1","measurementUnit":"KG","container":"packet"}');
INSERT INTO product VALUES
  (1, 'Omera LPG Cylinder', 'PRD-000001', 1, 1, 1, 1, 'admin'),
  (2, 'Bashundhara LPG Cylinder', 'PRD-000002', 1, 1, 1, 2, 'admin'),
  (3, 'ACI Miniket Rice', 'PRD-000003', 2, 2, 2, 3, 'admin'),
  (4, 'PRAN Miniket Rice', 'PRD-000004', 2, 2, 2, 4, 'admin'),
  (5, 'Retailer Rice', 'SHOP-5', 2, 2, 2, 3, 'shop'),
  (6, 'Gas Regulator', 'PRD-000006', 1, 1, null, 1, 'admin');
INSERT INTO product_variant_price (id, product_id, variant_option_id, brand_id, consumer_price) VALUES
  (1, 1, 1, 1, 3200), (2, 1, 2, 1, 4200), (3, 2, 1, 2, 3180),
  (4, 3, 3, 3, 60), (5, 4, 3, 4, 58), (6, 5, 3, 3, 80), (7, 6, 3, 1, 600);
INSERT INTO catalog_variant VALUES (1, 'BKV-0000000001');
INSERT INTO product_variant (id, product_id, source_variant_price_id, source_variant_option_id, brand_id, sku,
  preferred_local_sku, catalog_variant_id, pack_type, packaging_type, price, exchange_enabled, exchange_credit_amount) VALUES
  (1, 1, 1, 1, 1, 'OMERA-12', 'BARCODE-12', 1, 'cylinder', 'cylinder', 3200, true, 1720),
  (2, 1, 2, 2, 1, 'OMERA-16', null, null, 'cylinder', 'cylinder', 4200, true, 2220),
  (3, 2, 3, 1, 2, 'BASH-12', null, null, 'cylinder', 'cylinder', 3180, true, 1710),
  (4, 3, 4, 3, 3, 'ACI-1', null, null, 'packet', 'packet', 60, false, 0),
  (5, 4, 5, 3, 4, 'PRAN-1', null, null, 'packet', 'packet', 58, false, 0),
  (6, 5, 6, 3, 3, 'SHOP-1', null, null, 'packet', 'packet', 80, false, 0);
`;

test("price console groups, searches, synchronizes and logs atomically without touching owner prices", async (t) => {
  const pg = new PGlite();
  try {
    await pg.exec(fixtureSql);
    const migration = await readFile(
      new URL(
        "../../../db/src/migrations/0084_consumer_price_log.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pg.exec(migration);
    await pg.exec(migration); // additive migration is safe to rerun
    const { createConsumerPriceService } = await import(
      "./consumer-reference-prices"
    );
    const service = createConsumerPriceService(
      drizzle(pg, { schema }) as unknown as Parameters<
        typeof createConsumerPriceService
      >[0],
    );
    const actor = { id: "admin-98450", name: "Admin 98450" };

    await t.test(
      "pagination keeps actual products separate even when they share a core identity",
      async () => {
        const page = await service.fetchConsumerReferencePricePage({
          limit: 1,
        });
        assert.deepEqual(
          page.items.map((row) => ({
            productId: row.productId,
            productName: row.productName,
            groupKey: row.groupKey,
          })),
          [{ productId: 3, productName: "ACI Miniket Rice", groupKey: "p:3" }],
        );
        assert.equal(page.stats.totalProducts, 5);
        assert.equal(page.stats.totalVariants, 6);
        assert.equal(page.pagination.totalPages, 5);
        const next = await service.fetchConsumerReferencePricePage({
          page: 2,
          limit: 1,
        });
        assert.equal(next.items[0]?.productName, "PRAN Miniket Rice");
        assert.equal(next.items[0]?.groupKey, "p:4");
        assert.equal(
          next.items[0]?.coreProductId,
          page.items[0]?.coreProductId,
        );
        const grocery = await service.fetchConsumerReferencePricePage({
          coreProductId: 2,
        });
        assert.equal(new Set(grocery.items.map((row) => row.groupKey)).size, 2);
        for (const row of grocery.items) {
          assert.equal(row.groupKey, `p:${row.productId}`);
        }
        const lpg = await service.fetchConsumerReferencePricePage({
          typeId: 1,
        });
        assert.equal(new Set(lpg.items.map((row) => row.groupKey)).size, 3);
        const omera = await service.fetchConsumerReferencePricePage({
          search: "Omera LPG Cylinder",
          limit: 1,
        });
        assert.deepEqual(
          omera.items.map((row) => row.variantPriceId),
          [1, 2],
        );
        assert.ok(omera.items.every((row) => row.productId === 1));
        assert.equal(omera.stats.totalProducts, 1);
        assert.equal(
          lpg.items.find((row) => row.variantPriceId === 1)?.exchangePrice,
          "1480.00",
        );
        assert.equal(
          lpg.items.find((row) => row.variantPriceId === 7)?.isCylinderPricing,
          false,
        );
        const last = await service.fetchConsumerReferencePricePage({
          page: 900,
          limit: 1,
        });
        assert.equal(last.pagination.page, 5);
        assert.ok(last.items.length);
      },
    );

    await t.test(
      "search covers product, brand, core SKU and scanned catalog/local identifiers",
      async () => {
        for (const search of [
          "Omera",
          "PRD-000001",
          "CORE-GAS",
          "OMERA-12",
          "BARCODE-12",
          "BKV-0000000001",
        ]) {
          assert.ok(
            (
              await service.fetchConsumerReferencePricePage({ search })
            ).items.some((row) => row.variantPriceId === 1),
            search,
          );
        }
        assert.equal(
          (await service.fetchConsumerReferencePricePage({ search: "%" })).items
            .length,
          0,
        );
        assert.equal(
          (
            await service.fetchConsumerReferencePricePage({
              typeId: 2,
              categoryId: 2,
              subCategoryId: 2,
              coreProductId: 2,
            })
          ).items.length,
          2,
        );
      },
    );

    await t.test(
      "inline LPG edit synchronizes New price and exchange credit and records author/old/new values",
      async () => {
        const result = await service.saveConsumerReferencePrices(
          [{ variantPriceId: 1, consumerPrice: "3300", exchangePrice: "1500" }],
          actor,
          "inline",
        );
        assert.equal(result.updatedCount, 1);
        const variant = (
          await pg.query<{ price: string; exchange_credit_amount: string }>(
            "SELECT price, exchange_credit_amount FROM product_variant WHERE id = 1",
          )
        ).rows[0];
        assert.deepEqual(variant, {
          price: "3300.00",
          exchange_credit_amount: "1800.00",
        });
        const log = (
          await pg.query<Record<string, unknown>>(
            "SELECT * FROM consumer_price_log",
          )
        ).rows[0];
        assert.equal(log?.actor_id, actor.id);
        assert.equal(log?.previous_price, "3200.00");
        assert.equal(log?.new_price, "3300.00");
        assert.equal(log?.previous_exchange_price, "1480.00");
        assert.equal(log?.new_exchange_price, "1500.00");
        assert.equal(
          (
            await service.fetchConsumerReferencePricePage({
              search: "OMERA-12",
            })
          ).items[0]?.updatedByName,
          actor.name,
        );
      },
    );

    await t.test(
      "a bad bulk row rolls back earlier writes and logs, and owner prices are forbidden",
      async () => {
        for (const badId of [6, 999]) {
          await assert.rejects(
            service.saveConsumerReferencePrices(
              [
                { variantPriceId: 4, consumerPrice: "65" },
                { variantPriceId: badId, consumerPrice: "90" },
              ],
              actor,
              "excel",
            ),
          );
        }
        assert.equal(
          (
            await pg.query<{ consumer_price: string }>(
              "SELECT consumer_price FROM product_variant_price WHERE id = 4",
            )
          ).rows[0]?.consumer_price,
          "60.00",
        );
        assert.equal(
          (await pg.query("SELECT * FROM consumer_price_log")).rows.length,
          1,
        );
        assert.equal(
          (
            await pg.query<{ price: string }>(
              "SELECT price FROM product_variant WHERE id = 6",
            )
          ).rows[0]?.price,
          "80.00",
        );
      },
    );

    await t.test(
      "bulk edits persist together, preserve a no-op audit trail, and export beyond a page",
      async () => {
        const result = await service.saveConsumerReferencePrices(
          [
            { variantPriceId: 4, consumerPrice: "65.50" },
            { variantPriceId: 5, consumerPrice: "61" },
          ],
          actor,
          "excel",
        );
        assert.equal(result.updatedCount, 2);
        assert.equal(
          (
            await pg.query(
              "SELECT * FROM consumer_price_log WHERE source = 'excel'",
            )
          ).rows.length,
          2,
        );
        assert.equal(
          (
            await service.saveConsumerReferencePrices(
              [{ variantPriceId: 4, consumerPrice: "65.50" }],
              actor,
              "inline",
            )
          ).updatedCount,
          0,
        );
        assert.equal(
          (await pg.query("SELECT * FROM consumer_price_log")).rows.length,
          3,
        );
        assert.equal(
          (await service.fetchConsumerReferencePriceData({})).items.length,
          6,
        );
      },
    );
  } finally {
    await pg.close();
  }
});
