-- Phase 2: additive canonical catalog identity and immutable SKU snapshots.

CREATE SEQUENCE IF NOT EXISTS "catalog_variant_global_sku_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalog_variant" (
    "id" serial PRIMARY KEY NOT NULL,
    "global_sku" varchar(14) DEFAULT ('BKV-' || lpad(nextval('catalog_variant_global_sku_seq')::text, 10, '0')) NOT NULL,
    "core_product_id" integer NOT NULL,
    "brand_id" integer,
    "variant_option_id" integer NOT NULL,
    "classification_code" varchar(20),
    "conversion_target_catalog_variant_id" integer,
    "conversion_ratio" numeric(12, 4),
    "configuration_state" varchar(24) DEFAULT 'configured' NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_variant" ADD CONSTRAINT "catalog_variant_core_product_id_core_product_identity_id_fk"
    FOREIGN KEY ("core_product_id") REFERENCES "public"."core_product_identity"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "catalog_variant" ADD CONSTRAINT "catalog_variant_brand_id_brand_id_fk"
    FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "catalog_variant" ADD CONSTRAINT "catalog_variant_variant_option_id_variant_option_id_fk"
    FOREIGN KEY ("variant_option_id") REFERENCES "public"."variant_option"("id") ON DELETE restrict;
--> statement-breakpoint
ALTER TABLE "catalog_variant" ADD CONSTRAINT "catalog_variant_conversion_target_catalog_variant_id_fk"
    FOREIGN KEY ("conversion_target_catalog_variant_id") REFERENCES "public"."catalog_variant"("id") ON DELETE restrict;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_variant_global_sku_unique" ON "catalog_variant" ("global_sku");
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_variant_branded_identity_unique"
    ON "catalog_variant" ("core_product_id", "brand_id", "variant_option_id")
    WHERE "brand_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_variant_unbranded_identity_unique"
    ON "catalog_variant" ("core_product_id", "variant_option_id")
    WHERE "brand_id" IS NULL;
CREATE INDEX IF NOT EXISTS "catalog_variant_core_product_idx" ON "catalog_variant" ("core_product_id");
CREATE INDEX IF NOT EXISTS "catalog_variant_variant_option_idx" ON "catalog_variant" ("variant_option_id");
--> statement-breakpoint

ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "catalog_variant_id" integer;
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "preferred_local_sku" varchar(32);
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_catalog_variant_id_catalog_variant_id_fk"
    FOREIGN KEY ("catalog_variant_id") REFERENCES "public"."catalog_variant"("id") ON DELETE restrict;
CREATE INDEX IF NOT EXISTS "product_variant_catalog_variant_idx" ON "product_variant" ("catalog_variant_id");
--> statement-breakpoint

WITH identities AS (
    SELECT
        p."core_product_id",
        coalesce(pv."brand_id", p."brand_id") AS "brand_id",
        pv."source_variant_option_id" AS "variant_option_id",
        min(CASE WHEN p."creator_source" = 'admin' THEN pv."id" ELSE 2147483647 END) AS "admin_order",
        min(pv."id") AS "fallback_order"
    FROM "product_variant" pv
    JOIN "product" p ON p."id" = pv."product_id"
    WHERE p."core_product_id" IS NOT NULL
      AND pv."source_variant_option_id" IS NOT NULL
    GROUP BY
        p."core_product_id",
        coalesce(pv."brand_id", p."brand_id"),
        pv."source_variant_option_id"
)
INSERT INTO "catalog_variant" (
    "core_product_id",
    "brand_id",
    "variant_option_id",
    "configuration_state"
)
SELECT
    identities."core_product_id",
    identities."brand_id",
    identities."variant_option_id",
    'configured'
FROM identities
ORDER BY identities."admin_order", identities."fallback_order";
--> statement-breakpoint

UPDATE "product_variant" pv
SET "catalog_variant_id" = cv."id"
FROM "product" p, "catalog_variant" cv
WHERE p."id" = pv."product_id"
  AND cv."core_product_id" = p."core_product_id"
  AND cv."brand_id" IS NOT DISTINCT FROM coalesce(pv."brand_id", p."brand_id")
  AND cv."variant_option_id" = pv."source_variant_option_id";
--> statement-breakpoint

WITH conversion_links AS (
    SELECT
        source_pv."catalog_variant_id" AS "source_catalog_variant_id",
        min(target_pv."catalog_variant_id") AS "target_catalog_variant_id",
        min(source_pv."conversion_ratio"::numeric) AS "conversion_ratio"
    FROM "product_variant" source_pv
    JOIN "product_variant" target_pv ON target_pv."id" = source_pv."linked_retail_variant_id"
    WHERE source_pv."catalog_variant_id" IS NOT NULL
      AND target_pv."catalog_variant_id" IS NOT NULL
    GROUP BY source_pv."catalog_variant_id"
    HAVING count(DISTINCT target_pv."catalog_variant_id") = 1
)
UPDATE "catalog_variant" cv
SET
    "conversion_target_catalog_variant_id" = links."target_catalog_variant_id",
    "conversion_ratio" = links."conversion_ratio",
    "updatedAt" = now()
FROM conversion_links links
WHERE cv."id" = links."source_catalog_variant_id"
  AND links."source_catalog_variant_id" <> links."target_catalog_variant_id";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "product_variant_product_catalog_active_unique"
    ON "product_variant" ("product_id", "catalog_variant_id")
    WHERE "is_active" = true AND "catalog_variant_id" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "catalog_variant_id" integer;
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "global_sku_snapshot" varchar(14);
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "source_sku_snapshot" varchar(100);
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "target_sku_snapshot" varchar(100);
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_catalog_variant_id_catalog_variant_id_fk"
    FOREIGN KEY ("catalog_variant_id") REFERENCES "public"."catalog_variant"("id") ON DELETE restrict;
CREATE INDEX IF NOT EXISTS "orderItem_catalogVariantId_idx" ON "order_item" ("catalog_variant_id");
--> statement-breakpoint

UPDATE "order_item" oi
SET
    "catalog_variant_id" = source_pv."catalog_variant_id",
    "global_sku_snapshot" = cv."global_sku",
    "source_sku_snapshot" = source_pv."sku",
    "target_sku_snapshot" = (
        SELECT target_pv."sku"
        FROM "product_variant" target_pv
        WHERE target_pv."id" = oi."target_variant_id"
    )
FROM "product_variant" source_pv
LEFT JOIN "catalog_variant" cv ON cv."id" = source_pv."catalog_variant_id"
WHERE source_pv."id" = oi."variant_id"
  AND source_pv."catalog_variant_id" IS NOT NULL;
--> statement-breakpoint

CREATE OR REPLACE VIEW "shop_inventory_integrity_violations" AS
SELECT
    i."id" AS "inventory_id",
    i."owner_id",
    i."variant_id",
    pv."sku" AS "local_sku",
    p."creator_source",
    p."created_by_id",
    pv."catalog_variant_id"
FROM "inventory" i
JOIN "product_variant" pv ON pv."id" = i."variant_id"
JOIN "product" p ON p."id" = pv."product_id"
WHERE i."owner_type" = 'shop'
  AND (
    p."creator_source" <> 'shop'
    OR p."created_by_id" IS DISTINCT FROM i."owner_id"
  );
