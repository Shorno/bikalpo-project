-- Every active warehouse-configured variant must have an inventory snapshot,
-- even before the warehouse adds stock.
INSERT INTO "inventory" (
    "owner_type",
    "owner_id",
    "variant_id",
    "available_qty",
    "reserved_qty",
    "in_carton_qty",
    "active_carton_count",
    "updated_at"
)
SELECT
    'warehouse'::"inventory_owner_type",
    COALESCE(p."created_by_id", p."created_by_warehouse_id"),
    pv.id,
    0,
    0,
    0,
    0,
    NOW()
FROM "product_variant" pv
JOIN "product" p ON p.id = pv."product_id"
WHERE p."creator_source" = 'warehouse'
  AND COALESCE(p."created_by_id", p."created_by_warehouse_id") IS NOT NULL
  AND p.status = 'active'
  AND pv."is_active" = TRUE
ON CONFLICT ("owner_type", "owner_id", "variant_id") DO NOTHING;

-- Reconcile the known LPG record created by the retired inventory-first flow.
-- This block is skipped in databases that do not contain the affected records.
DO $$
DECLARE
    target_warehouse_id text := 'LKWilrdw3U7piLkTBsc07yOAOI4cg52M';
    affected_record_count integer;
BEGIN
    SELECT COUNT(*) INTO affected_record_count
    FROM "product"
    WHERE id IN (101, 102, 103);

    IF affected_record_count = 0 THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM "product"
        WHERE id = 101 AND "core_product_id" = 9 AND "brand_id" = 20
          AND "creator_source" = 'warehouse'
          AND COALESCE("created_by_id", "created_by_warehouse_id") = target_warehouse_id
    ) OR NOT EXISTS (
        SELECT 1 FROM "product"
        WHERE id = 102 AND "core_product_id" = 9 AND "brand_id" = 19
          AND "creator_source" = 'warehouse'
          AND COALESCE("created_by_id", "created_by_warehouse_id") = target_warehouse_id
    ) OR NOT EXISTS (
        SELECT 1 FROM "product"
        WHERE id = 103 AND "core_product_id" = 9 AND "brand_id" = 19
          AND "created_by_warehouse_id" = target_warehouse_id
    ) OR NOT EXISTS (
        SELECT 1 FROM "product_variant"
        WHERE id = 346 AND "product_id" = 102 AND "source_variant_option_id" = 30
    ) OR NOT EXISTS (
        SELECT 1 FROM "product_variant"
        WHERE id = 348 AND "product_id" = 102 AND "source_variant_option_id" = 33
    ) OR NOT EXISTS (
        SELECT 1 FROM "product_variant"
        WHERE id = 349 AND "product_id" = 103 AND "source_variant_option_id" = 8
    ) OR NOT EXISTS (
        SELECT 1 FROM "product_variant"
        WHERE id = 350 AND "product_id" = 103 AND "source_variant_option_id" = 33
    ) THEN
        RAISE EXCEPTION 'LPG warehouse reconciliation guard failed; no data was moved';
    END IF;

    IF EXISTS (SELECT 1 FROM "carton" WHERE "variant_id" IN (349, 350))
       OR EXISTS (SELECT 1 FROM "carton_config" WHERE "variant_id" IN (349, 350))
       OR EXISTS (SELECT 1 FROM "stock_adjustment_item" WHERE "variant_id" IN (349, 350))
       OR EXISTS (SELECT 1 FROM "damage_entry_item" WHERE "variant_id" IN (349, 350))
       OR EXISTS (SELECT 1 FROM "purchase_item" WHERE "variant_id" IN (349, 350))
       OR EXISTS (SELECT 1 FROM "empty_pack" WHERE "variant_id" IN (349, 350)) THEN
        RAISE EXCEPTION 'Legacy LPG variants have unexpected operational references; reconciliation aborted';
    END IF;

    -- Variant option 30 is the canonical configured identity, but its older
    -- counterpart contains the physical 12KG measurement used by stock totals.
    UPDATE "product_variant" canonical
    SET "weight_kg" = CASE
            WHEN canonical."weight_kg"::numeric = 0 THEN legacy."weight_kg"
            ELSE canonical."weight_kg"
        END,
        "pack_weight_kg" = COALESCE(canonical."pack_weight_kg", legacy."pack_weight_kg"),
        "updatedAt" = NOW()
    FROM "product_variant" legacy
    WHERE canonical.id = 346 AND legacy.id = 349;

    INSERT INTO "inventory" (
        "owner_type", "owner_id", "variant_id", "available_qty",
        "reserved_qty", "retail_price", "in_carton_qty",
        "active_carton_count", "updated_at"
    )
    SELECT
        old_inventory."owner_type",
        old_inventory."owner_id",
        CASE old_inventory."variant_id" WHEN 349 THEN 346 ELSE 348 END,
        old_inventory."available_qty",
        old_inventory."reserved_qty",
        old_inventory."retail_price",
        old_inventory."in_carton_qty",
        old_inventory."active_carton_count",
        NOW()
    FROM "inventory" old_inventory
    WHERE old_inventory."owner_type" = 'warehouse'
      AND old_inventory."owner_id" = target_warehouse_id
      AND old_inventory."variant_id" IN (349, 350)
    ON CONFLICT ("owner_type", "owner_id", "variant_id") DO UPDATE
    SET "available_qty" = "inventory"."available_qty"::numeric + EXCLUDED."available_qty"::numeric,
        "reserved_qty" = "inventory"."reserved_qty"::numeric + EXCLUDED."reserved_qty"::numeric,
        "retail_price" = COALESCE(EXCLUDED."retail_price", "inventory"."retail_price"),
        "in_carton_qty" = "inventory"."in_carton_qty"::numeric + EXCLUDED."in_carton_qty"::numeric,
        "active_carton_count" = "inventory"."active_carton_count" + EXCLUDED."active_carton_count",
        "updated_at" = NOW();

    UPDATE "stock_entry"
    SET "variant_id" = CASE "variant_id" WHEN 349 THEN 346 ELSE 348 END,
        "updatedAt" = NOW()
    WHERE "warehouse_id" = target_warehouse_id
      AND "variant_id" IN (349, 350);

    DELETE FROM "inventory"
    WHERE "owner_type" = 'warehouse'
      AND "owner_id" = target_warehouse_id
      AND "variant_id" IN (349, 350);
END $$;
