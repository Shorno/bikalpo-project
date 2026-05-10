CREATE TYPE "public"."order_source" AS ENUM('direct', 'salesman', 'estimate', 'pre_order');--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "order_source" "order_source" DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier" ADD COLUMN "category_id" integer;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_orderSource_idx" ON "order" USING btree ("order_source");--> statement-breakpoint
CREATE INDEX "supplier_categoryId_idx" ON "supplier" USING btree ("category_id");