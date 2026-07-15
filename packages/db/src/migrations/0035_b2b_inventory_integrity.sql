ALTER TYPE "public"."carton_status" ADD VALUE IF NOT EXISTS 'reserved' BEFORE 'broken';
--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "received_qty" integer;
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD COLUMN IF NOT EXISTS "order_item_id" integer;
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_order_item_id_order_item_id_fk"
    FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoiceItem_orderItemId_idx" ON "invoice_item" ("order_item_id");
--> statement-breakpoint
ALTER TABLE "carton" ADD COLUMN IF NOT EXISTS "reserved_for_order_item_id" integer;
--> statement-breakpoint
ALTER TABLE "carton" ADD COLUMN IF NOT EXISTS "reserved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "carton" ADD CONSTRAINT "carton_reserved_for_order_item_id_order_item_id_fk"
    FOREIGN KEY ("reserved_for_order_item_id") REFERENCES "public"."order_item"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "carton_reservedOrderItem_idx" ON "carton" ("reserved_for_order_item_id");
--> statement-breakpoint
UPDATE "invoice_item" ii
SET "order_item_id" = candidate."order_item_id"
FROM (
    SELECT ii2."id" AS "invoice_item_id", min(oi."id") AS "order_item_id"
    FROM "invoice_item" ii2
    JOIN "invoice" inv ON inv."id" = ii2."invoice_id"
    JOIN "order_item" oi
      ON oi."order_id" = inv."order_id"
     AND oi."variant_id" = ii2."variant_id"
    GROUP BY ii2."id"
    HAVING count(*) = 1
) candidate
WHERE ii."id" = candidate."invoice_item_id"
  AND ii."order_item_id" IS NULL;
--> statement-breakpoint
UPDATE "order_item" oi
SET "inventory_qty" = coalesce(oi."modified_qty", oi."quantity"),
    "conversion_factor" = 1,
    "quantity_unit" = coalesce(oi."quantity_unit", oi."supply_mode", 'unit'),
    "inventory_unit" = coalesce(oi."inventory_unit", oi."supply_mode", 'unit')
FROM "order" o
WHERE o."id" = oi."order_id"
  AND o."order_type" = 'b2b'
  AND oi."inventory_qty" IS NULL
  AND coalesce(oi."supply_mode", '') IN ('cylinder', 'unit', 'pair', 'box');
