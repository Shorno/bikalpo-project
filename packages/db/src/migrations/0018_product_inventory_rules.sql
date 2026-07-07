ALTER TABLE "product"
    ADD COLUMN IF NOT EXISTS "return_policy_enabled" boolean DEFAULT true NOT NULL,
    ADD COLUMN IF NOT EXISTS "minimum_order_enabled" boolean DEFAULT true NOT NULL,
    ADD COLUMN IF NOT EXISTS "minimum_order_qty" numeric(12, 2) DEFAULT '1' NOT NULL,
    ADD COLUMN IF NOT EXISTS "inventory_unit" varchar(20) DEFAULT 'unit' NOT NULL,
    ADD COLUMN IF NOT EXISTS "conversion_enabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "inventory_loose_unit_enabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS "inventory_loose_unit" varchar(20) DEFAULT 'kg' NOT NULL;
--> statement-breakpoint
UPDATE "product" p
SET
    "conversion_enabled" = CASE
        WHEN pt."inventory_behaviour" IN ('auto_break', 'loose_convert') THEN true
        ELSE p."conversion_enabled"
    END,
    "inventory_unit" = CASE pt."inventory_behaviour"
        WHEN 'auto_break' THEN 'carton'
        WHEN 'loose_convert' THEN 'kg'
        ELSE p."inventory_unit"
    END,
    "inventory_loose_unit_enabled" = CASE
        WHEN pt."inventory_behaviour" = 'loose_convert' THEN true
        ELSE p."inventory_loose_unit_enabled"
    END,
    "inventory_loose_unit" = CASE
        WHEN pt."inventory_behaviour" = 'loose_convert' THEN 'kg'
        ELSE p."inventory_loose_unit"
    END
FROM "category" c
JOIN "product_type" pt ON pt."id" = c."type_id"
WHERE p."category_id" = c."id";
