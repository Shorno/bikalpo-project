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
    const codeMigration = await readFile(
      new URL(
        "../../../db/src/migrations/0085_price_user_display_codes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pg.exec(codeMigration);
    await pg.exec(codeMigration);
    const removeCodeMigration = await readFile(
      new URL(
        "../../../db/src/migrations/0086_remove_price_user_display_codes.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await pg.exec(removeCodeMigration);
    await pg.exec(removeCodeMigration);
    assert.deepEqual(
      (
        await pg.query(
          "SELECT to_regclass('user_display_code') AS aliases, to_regclass('user_display_code_seq') AS sequence",
        )
      ).rows,
      [{ aliases: null, sequence: null }],
    );
    const { createConsumerPriceService } = await import(
      "./consumer-reference-prices"
    );
    const service = createConsumerPriceService(
      drizzle(pg, { schema }) as unknown as Parameters<
        typeof createConsumerPriceService
      >[0],
    );
    const actor = { id: "auth-admin-A9b2Q", name: "Test Admin" };

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
        const barcodeMatch = await service.fetchConsumerReferencePricePage({
          search: "BARCODE-12",
        });
        assert.deepEqual(
          barcodeMatch.items.map((row) => row.variantPriceId),
          [1, 2],
        );
        assert.equal(barcodeMatch.stats.totalVariants, 2);
        assert.deepEqual(
          (
            await service.fetchConsumerReferencePriceData({
              search: "BARCODE-12",
            })
          ).items.map((row) => row.variantPriceId),
          [1, 2],
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
          ).items[0]?.updatedById,
          actor.id,
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
    await t.test(
      "product-wide inline save is atomic, retains authenticated editor IDs and rejects another product's variants",
      async () => {
        const before = await service.fetchConsumerReferenceProductPrices(1);
        const originalPrice = before[0]!.consumerPrice;
        await assert.rejects(
          service.saveConsumerReferencePrices(
            [
              {
                variantPriceId: 1,
                consumerPrice: "3500",
                exchangePrice: "1600",
              },
              { variantPriceId: 4, consumerPrice: "99" },
            ],
            actor,
            "inline",
            1,
          ),
          /does not belong/,
        );
        assert.equal(
          (await service.fetchConsumerReferenceProductPrices(1))[0]!
            .consumerPrice,
          originalPrice,
        );
        const result = await service.saveConsumerReferencePrices(
          [
            { variantPriceId: 1, consumerPrice: "3500", exchangePrice: "1600" },
            { variantPriceId: 2, consumerPrice: "4500", exchangePrice: "2100" },
          ],
          actor,
          "inline",
          1,
        );
        assert.equal(result.updatedCount, 2);
        const after = await service.fetchConsumerReferenceProductPrices(1);
        assert.deepEqual(
          after.map((row) => row.consumerPrice),
          ["3500.00", "4500.00"],
        );
        assert.deepEqual(
          after.map((row) => row.updatedById),
          [actor.id, actor.id],
        );
        await service.saveConsumerReferencePrices(
          [{ variantPriceId: 1, consumerPrice: "3501", exchangePrice: "1601" }],
          actor,
          "inline",
          1,
        );
        assert.equal(
          (await service.fetchConsumerReferenceProductPrices(1))[0]!
            .updatedById,
          actor.id,
        );
        // Two authenticated IDs may share a display suffix. Attribution must
        // retain each full ID, even when the five-character labels are equal.
        const secondActor = { id: "another-auth-admin-A9b2Q", name: "Second" };
        await service.saveConsumerReferencePrices(
          [{ variantPriceId: 3, consumerPrice: "3250", exchangePrice: "1490" }],
          secondActor,
          "inline",
          2,
        );
        const secondProduct = (
          await service.fetchConsumerReferenceProductPrices(2)
        )[0]!;
        assert.equal(secondProduct.updatedById, secondActor.id);
        assert.notEqual(secondProduct.updatedById, after[0]!.updatedById);
        assert.equal(
          (
            await service.fetchConsumerReferencePriceData({
              search: "00000001",
            })
          ).items.length,
          2,
        );
        assert.equal(
          (
            await pg.query(
              "SELECT * FROM consumer_price_log WHERE variant_price_id IN (1,2) AND new_price IN (3500,4500) AND source = 'inline'",
            )
          ).rows.length,
          2,
        );
      },
    );

    await t.test(
      "last editor changes only on a saved price change and full IDs remain in history",
      async () => {
        const secondActor = { id: "another-auth-admin-A9b2Q", name: "Second" };
        const rows = await service.fetchConsumerReferenceProductPrices(1);
        const unchanged = await service.saveConsumerReferencePrices(
          rows.map((row) => ({
            variantPriceId: row.variantPriceId,
            consumerPrice: row.consumerPrice,
            exchangePrice: row.exchangePrice ?? undefined,
          })),
          secondActor,
          "inline",
          1,
        );
        assert.equal(unchanged.updatedCount, 0);
        assert.deepEqual(
          (await service.fetchConsumerReferenceProductPrices(1)).map(
            (row) => row.updatedById,
          ),
          [actor.id, actor.id],
        );
        await service.saveConsumerReferencePrices(
          [{ variantPriceId: 1, consumerPrice: "3502", exchangePrice: "1601" }],
          secondActor,
          "inline",
          1,
        );
        assert.deepEqual(
          (await service.fetchConsumerReferenceProductPrices(1)).map(
            (row) => row.updatedById,
          ),
          [secondActor.id, actor.id],
        );
        const history = (
          await pg.query<{ actor_id: string }>(
            "SELECT DISTINCT actor_id FROM consumer_price_log WHERE variant_price_id = 1 ORDER BY actor_id",
          )
        ).rows;
        assert.deepEqual(
          history.map((row) => row.actor_id),
          [actor.id, secondActor.id].sort(),
        );
      },
    );

    await t.test(
      "inventory details match exact catalog variants and exclude unreceived or unrelated purchase costs",
      async () => {
        await pg.exec(`
        ALTER TABLE product ADD COLUMN image text DEFAULT '', ADD COLUMN status text DEFAULT 'active';
        ALTER TABLE product_variant ADD COLUMN unit_label text DEFAULT 'Cylinder';
        CREATE TABLE "user" (id text PRIMARY KEY, name text, warehouse_name text, shop_name text);
        INSERT INTO "user" VALUES ('warehouse-one','Warehouse One','Warehouse One',null);
        INSERT INTO product (id,name,sku,category_id,brand_id,creator_source) VALUES (7,'Owner Omera','WH-7',1,1,'warehouse'),(8,'Unrelated','WH-8',1,2,'warehouse');
        INSERT INTO product_variant (id,product_id,catalog_variant_id,price,is_active) VALUES (101,7,1,1600,true),(102,8,2,1700,true);
        CREATE TABLE inventory (id integer PRIMARY KEY, owner_id text, owner_type text, variant_id integer, available_qty numeric, reserved_qty numeric, retail_price numeric, updated_at timestamp DEFAULT now());
        INSERT INTO inventory VALUES (1,'warehouse-one','warehouse',101,12,2,1600,now()),(2,'warehouse-one','warehouse',102,999,0,1700,now());
        CREATE TABLE purchase (id integer PRIMARY KEY, warehouse_id text, owner_type text, status text, entry_mode text, purchase_number text);
        INSERT INTO purchase VALUES (1,'warehouse-one','warehouse','received','exchange','PO-1'),(2,'warehouse-one','warehouse','draft','new','PO-2'),(3,'warehouse-one','warehouse','cancelled','new','PO-3'),(4,'warehouse-one','warehouse','partial','new','PO-4'),(5,'warehouse-one','warehouse','received','new','PO-5');
        CREATE TABLE purchase_item (id integer PRIMARY KEY,purchase_id integer,variant_id integer,quantity_unit text,unit_cost numeric,received_qty numeric,"updatedAt" timestamp DEFAULT now());
        INSERT INTO purchase_item (id,purchase_id,variant_id,quantity_unit,unit_cost,received_qty) VALUES (1,1,101,'cylinder',1000,12),(2,2,101,'cylinder',1,12),(3,3,101,'cylinder',2,12),(4,4,101,'cylinder',3,0),(5,5,102,'cylinder',4,12);
        CREATE TABLE stock_entry (id integer PRIMARY KEY,warehouse_id text,variant_id integer,cost_type text,purchase_price numeric,reference text,quantity numeric,"createdAt" timestamp DEFAULT now());
        INSERT INTO stock_entry VALUES (1,'warehouse-one',101,'per_pack',900,'GRN-1',10,now());
        CREATE TABLE "order" (id integer PRIMARY KEY,status text);
        INSERT INTO "order" VALUES (1,'delivered'),(2,'cancelled'),(3,'delivered');
        CREATE TABLE order_item (id integer PRIMARY KEY,order_id integer,variant_id integer,catalog_variant_id integer,total_price numeric);
        INSERT INTO order_item VALUES (1,1,101,1,1600),(2,2,101,1,900),(3,3,102,2,5000);
      `);
        const { createConsumerPriceInventoryService } = await import(
          "./consumer-price-inventory"
        );
        const details = createConsumerPriceInventoryService(
          drizzle(pg, { schema }) as unknown as Parameters<
            typeof createConsumerPriceInventoryService
          >[0],
        );
        const result = await details(1);
        assert.equal(result.history[0]!.actorId, "another-auth-admin-A9b2Q");
        assert.equal(result.prices[0]!.operationalUnit, "cylinder");
        assert.equal(result.stock.length, 1);
        assert.deepEqual(result.stock[0]!.priceIds, [1]);
        assert.equal(result.stock[0]!.ownerName, "Warehouse One");
        assert.deepEqual(result.receipts.map((row) => row.reference).sort(), [
          "GRN-1",
          "PO-1",
        ]);
        assert.equal(
          result.receipts.find((row) => row.reference === "PO-1")!.mode,
          "exchange",
        );
        assert.equal(
          result.receipts.find((row) => row.reference === "GRN-1")!.unit,
          "pack",
        );
        assert.equal(result.performance.orders, 1);
        assert.equal(result.performance.sales, "1600");
        await assert.rejects(details(7), /Admin product not found/);
        await assert.rejects(details(999), /Admin product not found/);
      },
    );
  } finally {
    await pg.close();
  }
});
