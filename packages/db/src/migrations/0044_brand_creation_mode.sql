CREATE TYPE "public"."brand_creation_mode" AS ENUM('batch', 'single');--> statement-breakpoint
ALTER TABLE "core_product_identity" ADD COLUMN "brand_creation_mode" "brand_creation_mode" DEFAULT 'batch' NOT NULL;
