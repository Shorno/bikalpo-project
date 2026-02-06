-- Order price change (pending) and confirmed total (customer lock)
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "previous_total" numeric(10, 2);
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "total_price_changed_at" timestamp;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "confirmed_subtotal" numeric(10, 2);
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "confirmed_total" numeric(10, 2);
