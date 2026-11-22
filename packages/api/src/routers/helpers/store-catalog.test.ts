import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "@bikalpo-project/db/schema";
import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";

// Isolated in-memory PostgreSQL; the default connection is never used.
Object.assign(process.env, {
  DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unused",
  BETTER_AUTH_SECRET: "store-catalog-test-secret-32-characters!",
  BETTER_AUTH_URL: "http://localhost:3000",
  CORS_ORIGINS: "http://localhost:3001",
  CLOUDINARY_CLOUD_NAME: "test",
  CLOUDINARY_API_KEY: "test",
  CLOUDINARY_API_SECRET: "test",
  BARIKOI_API_KEY: "test",
});

const fixtureSql = `
CREATE TABLE product_type (id serial PRIMARY KEY, name varchar(100) NOT NULL, slug varchar(100) NOT NULL,
  description text, image varchar(255), inventory_behaviour text DEFAULT 'fixed_pack',
  fulfillment_family text, sku_code varchar(2), is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0 NOT NULL, "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL);
CREATE TABLE category (id serial PRIMARY KEY, name varchar(100) NOT NULL, slug varchar(100) NOT NULL,
  image varchar(255), type_id integer, sku_code varchar(2), is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0 NOT NULL, "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL);
CREATE TABLE brand (id serial PRIMARY KEY, name varchar(100) NOT NULL, slug varchar(100) NOT NULL,
  logo varchar(255), sku_code varchar(2), short_code varchar(8), is_active boolean DEFAULT true NOT NULL,
  display_order integer DEFAULT 0 NOT NULL, owner_type varchar(20), owner_id text,
  "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX brand_global_slug_unique ON brand (slug) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX brand_owner_slug_unique ON brand (owner_id, slug) WHERE owner_id IS NOT NULL;
CREATE TABLE variant_option (id serial PRIMARY KEY, name varchar(100) NOT NULL, unit varchar(20) NOT NULL,
  size varchar(20), variant_type text DEFAULT 'pack' NOT NULL, definition_kind varchar(20),
  definition jsonb, display_alias varchar(100), canonical_signature varchar(255),
  needs_review boolean DEFAULT false NOT NULL, type_id integer, category_id integer, sku_code varchar(2),
  is_active boolean DEFAULT true NOT NULL, sort_order integer DEFAULT 0 NOT NULL,
  owner_type varchar(20), owner_id text,
  "createdAt" timestamp DEFAULT now() NOT NULL, "updatedAt" timestamp DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX variant_option_scope_signature_unique ON variant_option
  (COALESCE(owner_id, ''), COALESCE(type_id, 0), COALESCE(category_id, 0), canonical_signature)
  WHERE canonical_signature IS NOT NULL;

INSERT INTO product_type (id, name, slug, fulfillment_family) VALUES (1, 'LPG', 'lpg', 'lpg');
INSERT INTO category (id, name, slug, type_id) VALUES (1, 'Gas', 'gas', 1);
INSERT INTO brand (id, name, slug, sku_code) VALUES (1, 'Omera', 'omera', '01');
SELECT setval('brand_id_seq', 1);
`;

const cylinder = (value: string) => ({
  kind: "measurement" as const,
  value,
  measurementUnit: "KG",
  container: "cylinder",
});

test("store-only brands and variants stay private and reuse matches", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(fixtureSql);
    const database = drizzle(pg, { schema }) as any;
    const { createStructuredVariantOption } = await import(
      "./structured-variant-option"
    );
    const { findOrCreateStoreBrand, visibleToOwner } = await import(
      "./catalog-owner"
    );
    const shopA = { ownerType: "shop" as const, ownerId: "shop-a" };
    const shopB = { ownerType: "shop" as const, ownerId: "shop-b" };
    const scope = { typeId: 1, categoryId: 1, sortOrder: 0 };

    // A global, type-wide 5 KG variant made by admin takes a 2-digit code.
    const global5 = await createStructuredVariantOption(
      { ...scope, categoryId: null, definition: cylinder("5") },
      database,
    );
    assert.equal(global5.ownerId, null);
    assert.equal(global5.skuCode, "01");

    // Shop A's own 12 KG variant: store-only, no shared SKU code.
    const a12 = await createStructuredVariantOption(
      { ...scope, definition: cylinder("12") },
      database,
      { owner: shopA, reuseExisting: true },
    );
    assert.equal(a12.ownerId, "shop-a");
    assert.equal(a12.ownerType, "shop");
    assert.equal(a12.skuCode, null);

    // Adding it again reuses it; asking for 5 KG reuses the global one.
    const again = await createStructuredVariantOption(
      { ...scope, definition: cylinder("12") },
      database,
      { owner: shopA, reuseExisting: true },
    );
    assert.equal(again.id, a12.id);
    const reusedGlobal = await createStructuredVariantOption(
      { ...scope, definition: cylinder("5") },
      database,
      { owner: shopA, reuseExisting: true },
    );
    assert.equal(reusedGlobal.id, global5.id);

    // Shop B cannot see shop A's variant, so it gets its own row.
    const b12 = await createStructuredVariantOption(
      { ...scope, definition: cylinder("12") },
      database,
      { owner: shopB, reuseExisting: true },
    );
    assert.notEqual(b12.id, a12.id);
    assert.equal(b12.ownerId, "shop-b");

    const visibleToB = await database.query.variantOption.findMany({
      where: visibleToOwner(schema.variantOption, shopB),
    });
    assert.deepEqual(
      visibleToB.map((row: { id: number }) => row.id).sort(),
      [global5.id, b12.id].sort(),
    );
    const adminView = await database.query.variantOption.findMany({
      where: visibleToOwner(schema.variantOption, null),
    });
    assert.deepEqual(
      adminView.map((row: { id: number }) => row.id),
      [global5.id],
    );

    // Admin may still add a global 12 KG; store copies don't block it.
    const global12 = await createStructuredVariantOption(
      { ...scope, definition: cylinder("12") },
      database,
    );
    assert.equal(global12.ownerId, null);
    // And a second admin create without reuse is a conflict.
    await assert.rejects(
      createStructuredVariantOption(
        { ...scope, definition: cylinder("12") },
        database,
      ),
      /already exists/,
    );

    // Brands: a visible brand with the same name is reused.
    const omera = await findOrCreateStoreBrand(database, shopA, " omera ");
    assert.equal(omera.created, false);
    assert.equal(omera.brand.id, 1);
    const fresh = await findOrCreateStoreBrand(database, shopA, "Fresh Gas");
    assert.equal(fresh.created, true);
    assert.equal(fresh.brand.slug, "fresh-gas");
    assert.equal(fresh.brand.ownerId, "shop-a");
    assert.equal(fresh.brand.skuCode, null);
    const freshAgain = await findOrCreateStoreBrand(
      database,
      shopA,
      "fresh   gas",
    );
    assert.equal(freshAgain.brand.id, fresh.brand.id);
    // Another store gets its own brand with the same slug.
    const freshB = await findOrCreateStoreBrand(database, shopB, "Fresh Gas");
    assert.equal(freshB.created, true);
    assert.notEqual(freshB.brand.id, fresh.brand.id);
    assert.equal(freshB.brand.slug, "fresh-gas");
    const globalBrands = await database.query.brand.findMany({
      where: visibleToOwner(schema.brand, null),
    });
    assert.deepEqual(
      globalBrands.map((row: { name: string }) => row.name),
      ["Omera"],
    );
    const shopABrands = await database.query.brand.findMany({
      where: and(
        visibleToOwner(schema.brand, shopA),
        eq(schema.brand.isActive, true),
      ),
    });
    assert.deepEqual(
      shopABrands.map((row: { name: string }) => row.name).sort(),
      ["Fresh Gas", "Omera"],
    );
  } finally {
    await pg.close();
  }
});
