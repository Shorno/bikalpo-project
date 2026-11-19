-- Core Product ID (System ID) becomes 8 flat digits with no separators:
--   Type(2) Category(2) SubCategory(2, "00" when none) Core serial(2)   e.g. "02020118"
-- The shared Catalog Product ID appends the brand code:                e.g. "0202011805"
-- The core serial shrinks from 3 digits to 2 (01-99 within its category/subcategory).
-- Abort instead of truncating if any existing serial does not fit in 2 digits.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "core_product_identity"
    WHERE "sku" !~ '^0*[0-9]{1,2}$' OR "sku" ~ '^0+$'
  ) THEN
    RAISE EXCEPTION 'Core product serials above 99 (or zero) cannot be shortened to 2 digits; renumber them first';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "core_product_identity" SET "sku" = LPAD(LTRIM("sku", '0'), 2, '0');
--> statement-breakpoint
UPDATE "core_product_identity"
SET "catalog_code" = codes."catalog_code"
FROM (
  SELECT cp."id",
    LPAD(COALESCE(pt."sku_code", ''), 2, '0')
      || LPAD(COALESCE(c."sku_code", ''), 2, '0')
      || LPAD(COALESCE(sc."sku_code", ''), 2, '0')
      || LPAD(cp."sku", 2, '0') AS "catalog_code"
  FROM "core_product_identity" AS cp
  JOIN "category" AS c ON c."id" = cp."category_id"
  LEFT JOIN "product_type" AS pt ON pt."id" = c."type_id"
  LEFT JOIN "sub_category" AS sc ON sc."id" = cp."sub_category_id"
) AS codes
WHERE "core_product_identity"."id" = codes."id";
--> statement-breakpoint
-- Products follow their core product's classification and ID.
UPDATE "product" AS p
SET "catalog_code" = cp."catalog_code" || LPAD(b."sku_code", 2, '0'),
    "category_id" = cp."category_id",
    "sub_category_id" = cp."sub_category_id"
FROM "core_product_identity" AS cp, "brand" AS b
WHERE cp."id" = p."core_product_id" AND b."id" = p."brand_id" AND b."sku_code" IS NOT NULL;
--> statement-breakpoint
-- Admin products use the Catalog Product ID as their SKU.
UPDATE "product" SET "sku" = "catalog_code"
WHERE "creator_source" = 'admin' AND "catalog_code" IS NOT NULL;
