CREATE TABLE IF NOT EXISTS "product_type_rule_setting" (
    "id" serial PRIMARY KEY NOT NULL,
    "product_type_id" integer NOT NULL,
    "tracking_types" jsonb DEFAULT '["none","batch"]'::jsonb NOT NULL,
    "default_tracking_type" "tracking_type" DEFAULT 'none' NOT NULL,
    "return_policy_available" boolean DEFAULT true NOT NULL,
    "return_policy_default" boolean DEFAULT true NOT NULL,
    "expiry_available" boolean DEFAULT true NOT NULL,
    "expiry_default" boolean DEFAULT false NOT NULL,
    "damage_available" boolean DEFAULT true NOT NULL,
    "damage_default" boolean DEFAULT true NOT NULL,
    "stock_tracking_available" boolean DEFAULT true NOT NULL,
    "stock_tracking_default" boolean DEFAULT true NOT NULL,
    "minimum_order_available" boolean DEFAULT true NOT NULL,
    "minimum_order_default" boolean DEFAULT true NOT NULL,
    "minimum_order_qty_default" numeric(12, 2) DEFAULT '1' NOT NULL,
    "inventory_unit_options" jsonb DEFAULT '["kg","liter","piece","pack","carton","box","pair","unit","cylinder","drum","bundle"]'::jsonb NOT NULL,
    "default_inventory_unit" varchar(20) DEFAULT 'unit' NOT NULL,
    "conversion_available" boolean DEFAULT true NOT NULL,
    "conversion_default" boolean DEFAULT false NOT NULL,
    "inventory_loose_unit_available" boolean DEFAULT false NOT NULL,
    "inventory_loose_unit_default" boolean DEFAULT false NOT NULL,
    "inventory_loose_unit_options" jsonb DEFAULT '["kg","liter","piece","pack","carton","box","pair","unit","cylinder","drum","bundle"]'::jsonb NOT NULL,
    "default_inventory_loose_unit" varchar(20) DEFAULT 'kg' NOT NULL,
    "returnable_pack_available" boolean DEFAULT true NOT NULL,
    "returnable_pack_default" boolean DEFAULT false NOT NULL,
    "default_pack_deposit_amount" numeric(10, 2) DEFAULT '0',
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "product_type_rule_setting_product_type_id_unique" UNIQUE("product_type_id")
);
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "product_type_rule_setting"
        ADD CONSTRAINT "product_type_rule_setting_product_type_id_product_type_id_fk"
        FOREIGN KEY ("product_type_id") REFERENCES "product_type"("id") ON DELETE cascade;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "product_type_rule_setting" (
    "product_type_id",
    "tracking_types",
    "default_tracking_type",
    "expiry_default",
    "damage_default",
    "stock_tracking_default",
    "minimum_order_default",
    "minimum_order_qty_default",
    "default_inventory_unit",
    "conversion_default",
    "inventory_loose_unit_available",
    "inventory_loose_unit_default",
    "default_inventory_loose_unit",
    "returnable_pack_default",
    "default_pack_deposit_amount"
)
SELECT
    pt."id",
    CASE
        WHEN lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(lpg|gas|cylinder|electronics|mobile|device|phone|computer|liquid|drum|lubricant|chemical|solvent)' THEN '["none","batch","serial"]'::jsonb
        ELSE '["none","batch"]'::jsonb
    END,
    CASE
        WHEN pt."inventory_behaviour" = 'loose_convert'
            OR lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(grocery|rice|oil|flour|food|lpg|gas|cylinder|electronics|mobile|device|phone|computer|liquid|drum|lubricant|chemical|solvent)'
            THEN 'batch'::"tracking_type"
        ELSE 'none'::"tracking_type"
    END,
    CASE
        WHEN pt."inventory_behaviour" = 'loose_convert'
            OR lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(grocery|rice|oil|flour|food|liquid|drum|lubricant|chemical|solvent)'
            THEN true
        ELSE false
    END,
    true,
    true,
    true,
    '1',
    CASE pt."inventory_behaviour"
        WHEN 'auto_break' THEN 'carton'
        WHEN 'loose_convert' THEN 'kg'
        ELSE 'pack'
    END,
    CASE
        WHEN pt."inventory_behaviour" IN ('auto_break', 'loose_convert') THEN true
        ELSE false
    END,
    CASE
        WHEN pt."inventory_behaviour" = 'loose_convert' THEN true
        WHEN lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(grocery|rice|oil|flour|food)' THEN true
        ELSE false
    END,
    CASE
        WHEN pt."inventory_behaviour" = 'loose_convert' THEN true
        WHEN lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(grocery|rice|oil|flour|food)' THEN true
        ELSE false
    END,
    CASE
        WHEN pt."inventory_behaviour" = 'loose_convert' THEN 'kg'
        WHEN lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(liquid|drum|lubricant|chemical|solvent)' THEN 'liter'
        ELSE 'kg'
    END,
    CASE
        WHEN lower(coalesce(pt."slug", '') || ' ' || coalesce(pt."name", '')) ~ '(lpg|gas|cylinder|liquid|drum|lubricant|chemical|solvent)' THEN true
        ELSE false
    END,
    '0'
FROM "product_type" pt
ON CONFLICT ("product_type_id") DO NOTHING;
