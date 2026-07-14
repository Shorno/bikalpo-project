ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "inventory_unit" varchar(20);
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "conversion_factor" numeric(12, 4);
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "inventory_qty" numeric(12, 2);
--> statement-breakpoint
UPDATE "invoice_item" ii
SET "variant_id" = oi."variant_id",
    "quantity_unit" = 'cylinder',
    "inventory_unit" = 'cylinder',
    "conversion_factor" = 1,
    "inventory_qty" = ii."quantity"
FROM "invoice" inv
JOIN "order_item" oi ON oi."order_id" = inv."order_id"
JOIN "product_variant" pv ON pv."id" = oi."variant_id"
JOIN "variant_option" vo ON vo."id" = pv."source_variant_option_id"
WHERE ii."invoice_id" = inv."id"
  AND ii."product_id" = oi."product_id"
  AND lower(coalesce(vo."definition"->>'container', '')) = 'cylinder'
  AND NOT EXISTS (
      SELECT 1
      FROM "order_item" other
      WHERE other."order_id" = oi."order_id"
        AND other."product_id" = oi."product_id"
        AND other."id" <> oi."id"
  );
