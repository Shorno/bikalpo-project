-- Create Product "Delivery Configuration": the unit delivery is charged per
-- (cylinder, sack, box, kg...) and the default delivery cost for that unit.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "delivery_cost_unit" varchar(20);--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "default_delivery_cost" numeric(10, 2);
