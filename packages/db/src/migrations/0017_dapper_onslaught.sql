ALTER TABLE "estimate" ADD COLUMN "warehouse_id" text;--> statement-breakpoint
ALTER TABLE "estimate" ADD COLUMN "discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "estimate_item" ADD COLUMN "variant_id" integer;--> statement-breakpoint
ALTER TABLE "estimate_item" ADD COLUMN "product_size" text;--> statement-breakpoint
ALTER TABLE "estimate" ADD CONSTRAINT "estimate_warehouse_id_user_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_item" ADD CONSTRAINT "estimate_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estimate_warehouseId_idx" ON "estimate" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "estimateItem_variantId_idx" ON "estimate_item" USING btree ("variant_id");
