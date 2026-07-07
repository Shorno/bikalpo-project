ALTER TABLE "product_type_rule_setting"
ADD COLUMN IF NOT EXISTS "tracking_available" boolean DEFAULT true NOT NULL;

ALTER TABLE "product_type_rule_setting"
ADD COLUMN IF NOT EXISTS "inventory_unit_available" boolean DEFAULT true NOT NULL;
