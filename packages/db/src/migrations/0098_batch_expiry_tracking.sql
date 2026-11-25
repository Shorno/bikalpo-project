-- Phase 5 (client review 2026-11-24): expiry is tracked per batch.
-- A stock-in movement carries its batch number and dates; the Expired page
-- reads stock-ins with an expiry date. Additive and nullable only.
ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "batch_no" varchar(100);
--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "manufacture_date" date;
--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "expiry_date" date;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventoryMovement_owner_expiry_idx" ON "inventory_movement" USING btree ("owner_type","owner_id","expiry_date");
--> statement-breakpoint
ALTER TABLE "purchase_item" ADD COLUMN IF NOT EXISTS "manufacture_date" date;
--> statement-breakpoint
-- Days before expiry that the Expired page warns, per product (like the
-- low-stock limit).
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "expiry_alert_days" integer DEFAULT 10 NOT NULL;
