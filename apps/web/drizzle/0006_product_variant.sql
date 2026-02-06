-- Product variant: one flexible table per product (e.g. 50kg Sack, 25kg Carton).
-- If full migrate fails (e.g. address already exists), run only this file against your DB.
CREATE TABLE IF NOT EXISTS "product_variant" (
  "id" serial PRIMARY KEY NOT NULL,
  "product_id" integer NOT NULL,
  "sku" varchar(100),
  "unit_label" varchar(50) NOT NULL,
  "quantity_selector_label" varchar(100) NOT NULL,
  "packaging_type" varchar(20) NOT NULL,
  "weight_kg" numeric(10, 2) NOT NULL,
  "piece_weight_kg" numeric(10, 2),
  "pieces_per_unit" integer,
  "price" numeric(10, 2) NOT NULL,
  "order_min" integer DEFAULT 1 NOT NULL,
  "order_max" integer,
  "stock_quantity" integer DEFAULT 0 NOT NULL,
  "reorder_level" integer DEFAULT 0 NOT NULL,
  "origin" varchar(100),
  "shelf_life" varchar(50),
  "packaging_note" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "productVariant_productId_idx" ON "product_variant" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "cart_item" ADD COLUMN IF NOT EXISTS "variant_id" integer;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cartItem_variantId_idx" ON "cart_item" USING btree ("variant_id");--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "variant_id" integer;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orderItem_variantId_idx" ON "order_item" USING btree ("variant_id");
