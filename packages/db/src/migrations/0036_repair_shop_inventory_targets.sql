-- Phase 1: repair retailer inventory that was credited against supplier variants.

UPDATE "order_item" oi
SET "target_variant_id" = candidate."target_variant_id"
FROM (
    SELECT
        oi2."id" AS "order_item_id",
        min(target_pv."id") AS "target_variant_id"
    FROM "order_item" oi2
    JOIN "order" o ON o."id" = oi2."order_id"
    JOIN "product_variant" source_pv ON source_pv."id" = oi2."variant_id"
    JOIN "product" source_p ON source_p."id" = source_pv."product_id"
    JOIN "product" target_p
      ON target_p."creator_source" = 'shop'
     AND target_p."created_by_id" = o."user_id"
     AND target_p."core_product_id" = source_p."core_product_id"
     AND target_p."brand_id" IS NOT DISTINCT FROM coalesce(source_pv."brand_id", source_p."brand_id")
    JOIN "product_variant" target_pv
      ON target_pv."product_id" = target_p."id"
     AND target_pv."source_variant_option_id" = source_pv."source_variant_option_id"
     AND target_pv."is_active" = true
    WHERE o."order_type" = 'b2b'
      AND oi2."target_variant_id" IS NULL
      AND source_p."core_product_id" IS NOT NULL
      AND source_pv."source_variant_option_id" IS NOT NULL
    GROUP BY oi2."id"
    HAVING count(*) = 1
) candidate
WHERE oi."id" = candidate."order_item_id";
--> statement-breakpoint

CREATE TEMP TABLE "b2b_shop_inventory_repair" ON COMMIT DROP AS
SELECT
    wrong."id" AS "wrong_inventory_id",
    wrong."owner_id",
    wrong."available_qty",
    wrong."reserved_qty",
    wrong."in_carton_qty",
    wrong."active_carton_count",
    min(target_pv."id") AS "target_variant_id",
    count(*) AS "candidate_count"
FROM "inventory" wrong
JOIN "product_variant" source_pv ON source_pv."id" = wrong."variant_id"
JOIN "product" source_p ON source_p."id" = source_pv."product_id"
JOIN "product" target_p
  ON target_p."creator_source" = 'shop'
 AND target_p."created_by_id" = wrong."owner_id"
 AND target_p."core_product_id" = source_p."core_product_id"
 AND target_p."brand_id" IS NOT DISTINCT FROM coalesce(source_pv."brand_id", source_p."brand_id")
JOIN "product_variant" target_pv
  ON target_pv."product_id" = target_p."id"
 AND target_pv."source_variant_option_id" = source_pv."source_variant_option_id"
 AND target_pv."is_active" = true
WHERE wrong."owner_type" = 'shop'
  AND (
    source_p."creator_source" <> 'shop'
    OR source_p."created_by_id" IS DISTINCT FROM wrong."owner_id"
  )
GROUP BY
    wrong."id",
    wrong."owner_id",
    wrong."available_qty",
    wrong."reserved_qty",
    wrong."in_carton_qty",
    wrong."active_carton_count";
--> statement-breakpoint

DO $$
DECLARE
    wrong_count integer;
    mapped_count integer;
BEGIN
    SELECT count(*) INTO wrong_count
    FROM "inventory" wrong
    JOIN "product_variant" source_pv ON source_pv."id" = wrong."variant_id"
    JOIN "product" source_p ON source_p."id" = source_pv."product_id"
    WHERE wrong."owner_type" = 'shop'
      AND (
        source_p."creator_source" <> 'shop'
        OR source_p."created_by_id" IS DISTINCT FROM wrong."owner_id"
      );

    SELECT count(*) INTO mapped_count
    FROM "b2b_shop_inventory_repair"
    WHERE "candidate_count" = 1;

    IF wrong_count <> mapped_count THEN
        RAISE EXCEPTION 'Cannot repair shop inventory: % foreign rows but % unique mappings', wrong_count, mapped_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "b2b_shop_inventory_repair" repair
        LEFT JOIN "damage_entry_item" damage
          ON damage."inventory_id" = repair."wrong_inventory_id"
        WHERE repair."reserved_qty"::numeric <> 0
           OR repair."in_carton_qty"::numeric <> 0
           OR repair."active_carton_count" <> 0
           OR damage."id" IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Cannot automatically repair foreign shop inventory with reservations, cartons, or damage history';
    END IF;
END $$;
--> statement-breakpoint

INSERT INTO "inventory" (
    "owner_type",
    "owner_id",
    "variant_id",
    "available_qty",
    "reserved_qty",
    "in_carton_qty",
    "active_carton_count",
    "retail_price",
    "updated_at"
)
SELECT
    'shop'::"inventory_owner_type",
    repair."owner_id",
    repair."target_variant_id",
    repair."available_qty",
    repair."reserved_qty",
    repair."in_carton_qty",
    repair."active_carton_count",
    NULL,
    now()
FROM "b2b_shop_inventory_repair" repair
WHERE repair."candidate_count" = 1
ON CONFLICT ("owner_type", "owner_id", "variant_id")
DO UPDATE SET
    "available_qty" = "inventory"."available_qty"::numeric + excluded."available_qty"::numeric,
    "reserved_qty" = "inventory"."reserved_qty"::numeric + excluded."reserved_qty"::numeric,
    "in_carton_qty" = "inventory"."in_carton_qty"::numeric + excluded."in_carton_qty"::numeric,
    "active_carton_count" = "inventory"."active_carton_count" + excluded."active_carton_count",
    "updated_at" = now();
--> statement-breakpoint

DELETE FROM "inventory" wrong
USING "b2b_shop_inventory_repair" repair
WHERE wrong."id" = repair."wrong_inventory_id"
  AND repair."candidate_count" = 1;

