ALTER TABLE "carton"
ADD COLUMN IF NOT EXISTS "carton_price_overridden" boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS "delivery_cost_overridden" boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS "override_reason" text;
