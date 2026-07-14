ALTER TYPE "public"."stock_entry_cost_type" ADD VALUE IF NOT EXISTS 'per_unit';--> statement-breakpoint
ALTER TABLE "stock_entry" ALTER COLUMN "converted_qty_kg" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_entry" ALTER COLUMN "converted_qty_packs" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_entry" ADD COLUMN "inventory_delta" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "stock_entry" ADD COLUMN "inventory_unit" varchar(20);--> statement-breakpoint
UPDATE "stock_entry" AS entry
SET
  "inventory_delta" = COALESCE(
    CASE WHEN entry."entry_type" = 'loose' THEN entry."quantity" ELSE entry."converted_qty_packs" END,
    entry."quantity",
    0
  ),
  "inventory_unit" = COALESCE(NULLIF(variant."order_unit", ''), 'unit')
FROM "product_variant" AS variant
WHERE variant."id" = entry."variant_id";--> statement-breakpoint
UPDATE "stock_entry"
SET "inventory_delta" = COALESCE("inventory_delta", "quantity", 0),
    "inventory_unit" = COALESCE(NULLIF("inventory_unit", ''), 'unit');--> statement-breakpoint
ALTER TABLE "stock_entry" ALTER COLUMN "inventory_delta" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "stock_entry" ALTER COLUMN "inventory_delta" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_entry" ALTER COLUMN "inventory_unit" SET DEFAULT 'unit';--> statement-breakpoint
ALTER TABLE "stock_entry" ALTER COLUMN "inventory_unit" SET NOT NULL;--> statement-breakpoint
DROP TABLE IF EXISTS "stock_change_log";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."stock_change_type";
