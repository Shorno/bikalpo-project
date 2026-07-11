ALTER TABLE "variant_option" ADD COLUMN IF NOT EXISTS "definition_kind" varchar(20);
ALTER TABLE "variant_option" ADD COLUMN IF NOT EXISTS "definition" jsonb;
ALTER TABLE "variant_option" ADD COLUMN IF NOT EXISTS "display_alias" varchar(100);
ALTER TABLE "variant_option" ADD COLUMN IF NOT EXISTS "canonical_signature" varchar(255);
ALTER TABLE "variant_option" ADD COLUMN IF NOT EXISTS "needs_review" boolean DEFAULT false NOT NULL;

ALTER TYPE "pack_type" ADD VALUE IF NOT EXISTS 'unit';
ALTER TYPE "pack_type" ADD VALUE IF NOT EXISTS 'pair';
ALTER TYPE "pack_type" ADD VALUE IF NOT EXISTS 'cylinder';
ALTER TYPE "pack_type" ADD VALUE IF NOT EXISTS 'drum';
ALTER TYPE "pack_type" ADD VALUE IF NOT EXISTS 'bundle';

-- Existing records remain operational through the legacy fallback. They are
-- explicitly reviewable instead of being silently reinterpreted.
UPDATE "variant_option"
SET "needs_review" = true
WHERE "definition" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "variant_option_scope_signature_unique"
ON "variant_option" (COALESCE("type_id", 0), COALESCE("category_id", 0), "canonical_signature")
WHERE "canonical_signature" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "warehouse_variant_alias" (
  "id" serial PRIMARY KEY,
  "warehouse_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "core_product_id" integer NOT NULL REFERENCES "core_product_identity"("id") ON DELETE CASCADE,
  "variant_option_id" integer NOT NULL REFERENCES "variant_option"("id") ON DELETE CASCADE,
  "alias" varchar(100) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_variant_alias_scope_unique"
ON "warehouse_variant_alias" ("warehouse_id", "core_product_id", "variant_option_id");
