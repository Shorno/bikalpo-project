-- Category and subcategory SKU codes shrink from 3 digits to 2 (01-99).
-- Abort instead of truncating if any existing code does not fit in 2 digits.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "category" WHERE "sku_code" IS NOT NULL AND "sku_code" !~ '^0*[0-9]{1,2}$')
    OR EXISTS (SELECT 1 FROM "sub_category" WHERE "sku_code" IS NOT NULL AND "sku_code" !~ '^0*[0-9]{1,2}$')
  THEN
    RAISE EXCEPTION 'Category/subcategory sku_code values above 99 cannot be shortened to 2 digits';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "category" SET "sku_code" = LPAD(LTRIM("sku_code", '0'), 2, '0') WHERE "sku_code" IS NOT NULL;
--> statement-breakpoint
UPDATE "sub_category" SET "sku_code" = LPAD(LTRIM("sku_code", '0'), 2, '0') WHERE "sku_code" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "category" ALTER COLUMN "sku_code" SET DATA TYPE varchar(2);
--> statement-breakpoint
ALTER TABLE "sub_category" ALTER COLUMN "sku_code" SET DATA TYPE varchar(2);
--> statement-breakpoint
-- Admin catalog products use the Catalog Product ID as their SKU:
-- Type(2)-Category(2)-SubCategory(2, "00" when none)-Core Product(3)-Brand(2).
-- Codes longer than their width are kept whole, matching padStart in the API.
UPDATE "product"
SET "sku" = ids."catalog_product_id"
FROM (
  SELECT
    p."id",
    concat_ws('-',
      LPAD(COALESCE(pt."sku_code", ''), GREATEST(2, LENGTH(COALESCE(pt."sku_code", ''))), '0'),
      LPAD(COALESCE(c."sku_code", ''), 2, '0'),
      LPAD(COALESCE(sc."sku_code", ''), 2, '0'),
      LPAD(COALESCE(cp."sku", ''), GREATEST(3, LENGTH(COALESCE(cp."sku", ''))), '0'),
      LPAD(COALESCE(b."sku_code", ''), GREATEST(2, LENGTH(COALESCE(b."sku_code", ''))), '0')
    ) AS "catalog_product_id"
  FROM "product" AS p
  JOIN "core_product_identity" AS cp ON cp."id" = p."core_product_id"
  JOIN "category" AS c ON c."id" = cp."category_id"
  LEFT JOIN "product_type" AS pt ON pt."id" = c."type_id"
  LEFT JOIN "sub_category" AS sc ON sc."id" = cp."sub_category_id"
  LEFT JOIN "brand" AS b ON b."id" = p."brand_id"
  WHERE p."creator_source" = 'admin'
) AS ids
WHERE "product"."id" = ids."id";
