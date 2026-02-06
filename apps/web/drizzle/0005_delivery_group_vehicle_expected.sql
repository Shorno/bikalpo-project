-- Delivery group: optional vehicle type and expected delivery date
-- (for area-based assignment flow; reuses invoice_vehicle_type enum)
ALTER TABLE "delivery_group" ADD COLUMN IF NOT EXISTS "vehicle_type" "invoice_vehicle_type";--> statement-breakpoint
ALTER TABLE "delivery_group" ADD COLUMN IF NOT EXISTS "expected_delivery_at" timestamp;
