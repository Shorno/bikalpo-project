-- Product: add reorder_level, sku, supplier, last_restocked_at
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "reorder_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "sku" varchar(100);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "supplier" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "last_restocked_at" timestamp;

--> statement-breakpoint
-- Stock change log and enum
DO $$ BEGIN
  CREATE TYPE "public"."stock_change_type" AS ENUM('add', 'reduce');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stock_change_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "change_type" "stock_change_type" NOT NULL,
  "quantity" integer NOT NULL,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "created_by_id" text
);--> statement-breakpoint
ALTER TABLE "stock_change_log" ADD CONSTRAINT "stock_change_log_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_change_log" ADD CONSTRAINT "stock_change_log_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stockChangeLog_productId_idx" ON "stock_change_log" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stockChangeLog_createdAt_idx" ON "stock_change_log" USING btree ("created_at");
