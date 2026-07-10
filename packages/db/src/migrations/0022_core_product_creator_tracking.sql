DO $$ BEGIN
    CREATE TYPE "catalog_creator_source" AS ENUM ('admin', 'warehouse', 'shop');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "core_product_identity"
ADD COLUMN IF NOT EXISTS "created_by_id" text REFERENCES "user"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "core_product_identity"
ADD COLUMN IF NOT EXISTS "creator_source" "catalog_creator_source" DEFAULT 'admin' NOT NULL;
