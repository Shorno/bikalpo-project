-- Persist catalog IDs instead of composing them on every read.
--   core_product_identity.catalog_code: Type-Category-SubCategory-Core ("02-02-01-018")
--   product.catalog_code:               core catalog code + Brand ("02-02-01-018-05"),
--                                       shared by admin, warehouse, and shop products.

-- 1. Codes must be unique within their parent. Renumber later duplicates
--    (keeping the oldest row's code) to the next free code in the same scope.
WITH dup AS (
  SELECT id, type_id,
    ROW_NUMBER() OVER (PARTITION BY type_id, sku_code ORDER BY "createdAt", id) AS rn
  FROM "category" WHERE "sku_code" IS NOT NULL
), renumber AS (
  SELECT d.id,
    LPAD((
      (SELECT COALESCE(MAX("sku_code"::int), 0) FROM "category" c WHERE c."type_id" IS NOT DISTINCT FROM d."type_id")
      + ROW_NUMBER() OVER (PARTITION BY d.type_id ORDER BY d.id)
    )::text, 2, '0') AS code
  FROM dup d WHERE d.rn > 1
)
UPDATE "category" SET "sku_code" = renumber.code FROM renumber WHERE "category"."id" = renumber.id;
--> statement-breakpoint
WITH dup AS (
  SELECT id, category_id,
    ROW_NUMBER() OVER (PARTITION BY category_id, sku_code ORDER BY "createdAt", id) AS rn
  FROM "sub_category" WHERE "sku_code" IS NOT NULL
), renumber AS (
  SELECT d.id,
    LPAD((
      (SELECT COALESCE(MAX("sku_code"::int), 0) FROM "sub_category" s WHERE s."category_id" = d."category_id")
      + ROW_NUMBER() OVER (PARTITION BY d.category_id ORDER BY d.id)
    )::text, 2, '0') AS code
  FROM dup d WHERE d.rn > 1
)
UPDATE "sub_category" SET "sku_code" = renumber.code FROM renumber WHERE "sub_category"."id" = renumber.id;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "category_type_sku_code_unique" ON "category" ("type_id", "sku_code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sub_category_category_sku_code_unique" ON "sub_category" ("category_id", "sku_code");
--> statement-breakpoint

-- 2. Core product catalog code.
ALTER TABLE "core_product_identity" ADD COLUMN IF NOT EXISTS "catalog_code" varchar(32);
--> statement-breakpoint
UPDATE "core_product_identity"
SET "catalog_code" = codes."catalog_code"
FROM (
  SELECT cp."id",
    concat_ws('-',
      LPAD(COALESCE(pt."sku_code", ''), 2, '0'),
      LPAD(COALESCE(c."sku_code", ''), 2, '0'),
      LPAD(COALESCE(sc."sku_code", ''), 2, '0'),
      LPAD(cp."sku", GREATEST(3, LENGTH(cp."sku")), '0')
    ) AS "catalog_code"
  FROM "core_product_identity" AS cp
  JOIN "category" AS c ON c."id" = cp."category_id"
  LEFT JOIN "product_type" AS pt ON pt."id" = c."type_id"
  LEFT JOIN "sub_category" AS sc ON sc."id" = cp."sub_category_id"
) AS codes
WHERE "core_product_identity"."id" = codes."id";
--> statement-breakpoint
ALTER TABLE "core_product_identity" ALTER COLUMN "catalog_code" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD CONSTRAINT "core_product_identity_catalog_code_unique" UNIQUE ("catalog_code");
--> statement-breakpoint

-- 3. Shared Catalog Product ID on every core-managed product (all owners).
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "catalog_code" varchar(32);
--> statement-breakpoint
UPDATE "product" AS p
SET "catalog_code" = cp."catalog_code" || '-' || LPAD(b."sku_code", 2, '0')
FROM "core_product_identity" AS cp, "brand" AS b
WHERE cp."id" = p."core_product_id" AND b."id" = p."brand_id" AND b."sku_code" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_catalog_code_idx" ON "product" ("catalog_code");
--> statement-breakpoint
-- Admin products also used the catalog ID as their SKU; keep them in step.
UPDATE "product" SET "sku" = "catalog_code"
WHERE "creator_source" = 'admin' AND "catalog_code" IS NOT NULL;
