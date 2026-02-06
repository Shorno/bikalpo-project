-- Variant: pricing type, order rules (increment/unit), quantity selector options, care, note.
-- Delivery rules: separate table (e.g. managed in a separate tab).
ALTER TABLE "product_variant" ALTER COLUMN "quantity_selector_label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "pricing_type" varchar(20) DEFAULT 'per_unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "price_tiers" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "order_increment" numeric(12, 2) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "order_unit" varchar(20) DEFAULT 'piece' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "quantity_selector_options" jsonb DEFAULT '[]';--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "care" varchar(100);--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "note" text;--> statement-breakpoint
ALTER TABLE "product_variant" ALTER COLUMN "order_min" TYPE numeric(12, 2) USING order_min::numeric;--> statement-breakpoint
ALTER TABLE "product_variant" ALTER COLUMN "order_min" SET DEFAULT '1';--> statement-breakpoint
ALTER TABLE "product_variant" ALTER COLUMN "order_max" TYPE numeric(12, 2) USING order_max::numeric;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_rule" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(150),
  "area" varchar(100),
  "min_weight_kg" numeric(10, 2),
  "max_weight_kg" numeric(10, 2),
  "base_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
  "per_kg_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "note" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
