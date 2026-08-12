UPDATE "admin_product_generation_template"
SET "details" = "details" - 'inventoryUnit'
WHERE "details" ? 'inventoryUnit';--> statement-breakpoint

UPDATE "warehouse_product_generation_template"
SET "details" = "details" - 'inventoryUnit'
WHERE "details" ? 'inventoryUnit';--> statement-breakpoint

UPDATE "shop_product_generation_template"
SET "details" = "details" - 'inventoryUnit'
WHERE "details" ? 'inventoryUnit';--> statement-breakpoint

ALTER TABLE "product" DROP COLUMN IF EXISTS "inventory_unit";--> statement-breakpoint
ALTER TABLE "product_type_rule_setting" DROP COLUMN IF EXISTS "inventory_unit_options";--> statement-breakpoint
ALTER TABLE "product_type_rule_setting" DROP COLUMN IF EXISTS "inventory_unit_available";--> statement-breakpoint
ALTER TABLE "product_type_rule_setting" DROP COLUMN IF EXISTS "default_inventory_unit";
