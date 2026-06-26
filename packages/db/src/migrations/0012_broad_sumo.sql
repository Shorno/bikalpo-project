-- Idempotent patch: prior fulfillment/order-status columns were applied via manual SQL
-- (see context/warehouse-order-status-lifecycle-continuation.md). This migration
-- only adds the new per-shipment receive timestamp.
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "received_at" timestamp;
