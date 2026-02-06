-- Invoice: optional vehicle type and expected delivery date
DO $$ BEGIN
  CREATE TYPE "public"."invoice_vehicle_type" AS ENUM('bike', 'car', 'van', 'truck');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "vehicle_type" "invoice_vehicle_type";--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "expected_delivery_at" timestamp;

--> statement-breakpoint
-- User: optional service area for deliverymen (area-based assignment)
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "service_area" text;
