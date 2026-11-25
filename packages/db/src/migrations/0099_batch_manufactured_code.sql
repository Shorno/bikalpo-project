-- Batch page (client, 2026-11-25): the maker's lot code printed on the
-- pack ("Manufactured", e.g. XXL099), entered with the batch when stock
-- comes in. Additive and nullable only.
ALTER TABLE "inventory_movement" ADD COLUMN IF NOT EXISTS "manufactured_code" varchar(100);
--> statement-breakpoint
ALTER TABLE "purchase_item" ADD COLUMN IF NOT EXISTS "manufactured_code" varchar(100);
--> statement-breakpoint
ALTER TABLE "stock_entry" ADD COLUMN IF NOT EXISTS "manufactured_code" varchar(100);
