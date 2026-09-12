-- Nullable additions preserve legacy listings without inventing inclusion data.
ALTER TABLE "tolet_unit_listing" ADD COLUMN IF NOT EXISTS "facility_inclusions" jsonb;
--> statement-breakpoint
ALTER TABLE "tolet_unit_listing" ADD COLUMN IF NOT EXISTS "tour_url" text;
