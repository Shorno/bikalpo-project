-- Human-readable sellable SKU: BRAND-PRODUCT-VARIANT (e.g. "OMR-LPG-12KG"),
-- stored once on catalog_variant and shared by admin, warehouse, and retailer variants.
-- Codes are generated in the API (helpers/sellable-sku.ts); existing rows are filled by
-- packages/api/src/scripts/backfill-sellable-skus.ts and on first use.
ALTER TABLE "brand" ADD COLUMN IF NOT EXISTS "short_code" varchar(8);
--> statement-breakpoint
ALTER TABLE "brand" ADD CONSTRAINT "brand_short_code_unique" UNIQUE ("short_code");
--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD COLUMN IF NOT EXISTS "short_code" varchar(8);
--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD CONSTRAINT "core_product_identity_short_code_unique" UNIQUE ("short_code");
--> statement-breakpoint
ALTER TABLE "catalog_variant" ADD COLUMN IF NOT EXISTS "sku" varchar(32);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_variant_sku_unique" ON "catalog_variant" ("sku");
