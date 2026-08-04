ALTER TABLE "brand" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
