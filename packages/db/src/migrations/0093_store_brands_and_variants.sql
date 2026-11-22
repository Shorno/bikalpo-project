-- Store-only brands and variant options.
-- A row with owner_id NULL is global (admin catalog), as before. A row with an
-- owner belongs to one shop or warehouse, which creates it from Create Product;
-- only that store sees it. Store rows take no 2-digit SKU code.
ALTER TABLE "brand" ADD COLUMN IF NOT EXISTS "owner_type" varchar(20);
--> statement-breakpoint
ALTER TABLE "brand" ADD COLUMN IF NOT EXISTS "owner_id" text REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "variant_option" ADD COLUMN IF NOT EXISTS "owner_type" varchar(20);
--> statement-breakpoint
ALTER TABLE "variant_option" ADD COLUMN IF NOT EXISTS "owner_id" text REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
-- Slugs stay unique among global brands and within each store.
ALTER TABLE "brand" DROP CONSTRAINT IF EXISTS "brand_slug_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brand_global_slug_unique"
  ON "brand" ("slug") WHERE "owner_id" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "brand_owner_slug_unique"
  ON "brand" ("owner_id", "slug") WHERE "owner_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_owner_idx" ON "brand" ("owner_type", "owner_id");
--> statement-breakpoint
-- The same structured variant may exist globally and in a store.
DROP INDEX IF EXISTS "variant_option_scope_signature_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "variant_option_scope_signature_unique"
  ON "variant_option" (COALESCE("owner_id", ''), COALESCE("type_id", 0), COALESCE("category_id", 0), "canonical_signature")
  WHERE "canonical_signature" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "variant_option_owner_idx" ON "variant_option" ("owner_type", "owner_id");
