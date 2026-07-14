DROP INDEX IF EXISTS "product_core_brand_shop_unique";
--> statement-breakpoint
DO $$
DECLARE
    product_row RECORD;
    brand_row RECORD;
    primary_brand_id integer;
    new_product_id integer;
    base_slug text;
    candidate_slug text;
    suffix integer;
    suffix_text text;
BEGIN
    -- Legacy retailer products stored brand membership only in junction/variant rows.
    UPDATE product AS target
    SET brand_id = source.brand_id,
        "updatedAt" = NOW()
    FROM (
        SELECT p.id AS product_id, MIN(linked.brand_id) AS brand_id
        FROM product p
        CROSS JOIN LATERAL (
            SELECT pvp.brand_id
            FROM product_variant_price pvp
            WHERE pvp.product_id = p.id AND pvp.brand_id IS NOT NULL
            UNION
            SELECT pv.brand_id
            FROM product_variant pv
            WHERE pv.product_id = p.id AND pv.brand_id IS NOT NULL
            UNION
            SELECT pb.brand_id
            FROM product_brand pb
            WHERE pb.product_id = p.id
        ) linked
        WHERE p.creator_source = 'shop'
          AND p.created_by_id IS NOT NULL
          AND p.core_product_id IS NOT NULL
          AND p.brand_id IS NULL
        GROUP BY p.id
        HAVING COUNT(DISTINCT linked.brand_id) = 1
    ) source
    WHERE target.id = source.product_id;

    -- Split remaining multi-brand retailer rows into independent brand products.
    FOR product_row IN
        SELECT p.*
        FROM product p
        CROSS JOIN LATERAL (
            SELECT COUNT(DISTINCT linked.brand_id) AS brand_count
            FROM (
                SELECT pvp.brand_id FROM product_variant_price pvp
                WHERE pvp.product_id = p.id AND pvp.brand_id IS NOT NULL
                UNION
                SELECT pv.brand_id FROM product_variant pv
                WHERE pv.product_id = p.id AND pv.brand_id IS NOT NULL
                UNION
                SELECT pb.brand_id FROM product_brand pb
                WHERE pb.product_id = p.id
            ) linked
        ) counts
        WHERE p.creator_source = 'shop'
          AND p.created_by_id IS NOT NULL
          AND p.core_product_id IS NOT NULL
          AND counts.brand_count > 1
        ORDER BY p.id
    LOOP
        SELECT COALESCE(product_row.brand_id, MIN(linked.brand_id))
        INTO primary_brand_id
        FROM (
            SELECT pvp.brand_id FROM product_variant_price pvp
            WHERE pvp.product_id = product_row.id AND pvp.brand_id IS NOT NULL
            UNION
            SELECT pv.brand_id FROM product_variant pv
            WHERE pv.product_id = product_row.id AND pv.brand_id IS NOT NULL
            UNION
            SELECT pb.brand_id FROM product_brand pb
            WHERE pb.product_id = product_row.id
        ) linked;

        UPDATE product
        SET brand_id = primary_brand_id, "updatedAt" = NOW()
        WHERE id = product_row.id;

        FOR brand_row IN
            SELECT linked.brand_id, b.name, b.slug
            FROM (
                SELECT pvp.brand_id FROM product_variant_price pvp
                WHERE pvp.product_id = product_row.id AND pvp.brand_id IS NOT NULL
                UNION
                SELECT pv.brand_id FROM product_variant pv
                WHERE pv.product_id = product_row.id AND pv.brand_id IS NOT NULL
                UNION
                SELECT pb.brand_id FROM product_brand pb
                WHERE pb.product_id = product_row.id
            ) linked
            JOIN brand b ON b.id = linked.brand_id
            WHERE linked.brand_id <> primary_brand_id
            ORDER BY linked.brand_id
        LOOP
            base_slug := LEFT(product_row.slug || '-' || brand_row.slug, 140);
            candidate_slug := base_slug;
            suffix := 2;
            WHILE EXISTS (SELECT 1 FROM product WHERE slug = candidate_slug) LOOP
                suffix_text := '-' || suffix::text;
                candidate_slug := LEFT(base_slug, 150 - LENGTH(suffix_text)) || suffix_text;
                suffix := suffix + 1;
            END LOOP;

            INSERT INTO product (
                name, slug, description, category_id, sub_category_id, brand_id,
                core_product_id, size, price, reorder_level, sku, supplier,
                last_restocked_at, image, short_description, video_url, features,
                in_stock, is_featured, is_returnable_pack,
                default_pack_deposit_amount, allowed_pack_brands,
                allowed_pack_sizes, return_policy_enabled, tracking_type,
                expiry_enabled, damage_control_enabled, stock_tracking_enabled,
                minimum_order_enabled, minimum_order_qty, inventory_unit,
                conversion_enabled, inventory_loose_unit_enabled,
                inventory_loose_unit, visibility, scheduled_at, status,
                created_by_warehouse_id, creator_source, created_by_id,
                derived_from_product_id, "createdAt", "updatedAt"
            ) VALUES (
                LEFT(brand_row.name || ' ' || product_row.name, 150),
                candidate_slug, product_row.description, product_row.category_id,
                product_row.sub_category_id, brand_row.brand_id,
                product_row.core_product_id, product_row.size, product_row.price,
                product_row.reorder_level, product_row.sku, product_row.supplier,
                product_row.last_restocked_at, product_row.image,
                product_row.short_description, product_row.video_url,
                product_row.features, product_row.in_stock, product_row.is_featured,
                product_row.is_returnable_pack,
                product_row.default_pack_deposit_amount,
                product_row.allowed_pack_brands, product_row.allowed_pack_sizes,
                product_row.return_policy_enabled, product_row.tracking_type,
                product_row.expiry_enabled, product_row.damage_control_enabled,
                product_row.stock_tracking_enabled,
                product_row.minimum_order_enabled, product_row.minimum_order_qty,
                product_row.inventory_unit, product_row.conversion_enabled,
                product_row.inventory_loose_unit_enabled,
                product_row.inventory_loose_unit, product_row.visibility,
                product_row.scheduled_at, product_row.status,
                NULL, 'shop', product_row.created_by_id,
                product_row.derived_from_product_id, product_row."createdAt", NOW()
            ) RETURNING id INTO new_product_id;

            UPDATE product_variant_price
            SET product_id = new_product_id, updated_at = NOW()
            WHERE product_id = product_row.id AND brand_id = brand_row.brand_id;

            UPDATE product_variant
            SET product_id = new_product_id, "updatedAt" = NOW()
            WHERE product_id = product_row.id AND brand_id = brand_row.brand_id;

            INSERT INTO product_image (product_id, image_url, "createdAt", "updatedAt")
            SELECT new_product_id, image_url, "createdAt", NOW()
            FROM product_image WHERE product_id = product_row.id;
        END LOOP;
    END LOOP;
END $$;
--> statement-breakpoint
DELETE FROM product_brand pb
USING product p
WHERE pb.product_id = p.id
  AND p.creator_source = 'shop'
  AND p.core_product_id IS NOT NULL;
INSERT INTO product_brand (product_id, brand_id, "createdAt", "updatedAt")
SELECT p.id, p.brand_id, NOW(), NOW()
FROM product p
WHERE p.creator_source = 'shop'
  AND p.created_by_id IS NOT NULL
  AND p.core_product_id IS NOT NULL
  AND p.brand_id IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY created_by_id, core_product_id, brand_id
               ORDER BY "createdAt", id
           ) AS position
    FROM product
    WHERE creator_source = 'shop'
      AND created_by_id IS NOT NULL
      AND core_product_id IS NOT NULL
      AND brand_id IS NOT NULL
)
UPDATE product p
SET core_product_id = NULL, "updatedAt" = NOW()
FROM ranked
WHERE p.id = ranked.id AND ranked.position > 1;
--> statement-breakpoint
-- Product/variant pairs must stay aligned after variants move to split products.
UPDATE order_item oi
SET product_id = pv.product_id
FROM product_variant pv
WHERE oi.variant_id = pv.id AND oi.product_id <> pv.product_id;
UPDATE cart_item ci
SET product_id = pv.product_id
FROM product_variant pv
WHERE ci.variant_id = pv.id AND ci.product_id <> pv.product_id;
UPDATE estimate_item ei
SET product_id = pv.product_id
FROM product_variant pv
WHERE ei.variant_id = pv.id AND ei.product_id <> pv.product_id;
UPDATE warehouse_pos_sale_item wi
SET product_id = pv.product_id
FROM product_variant pv
WHERE wi.variant_id = pv.id AND wi.product_id <> pv.product_id;
--> statement-breakpoint
CREATE TABLE "shop_product_generation_template" (
    "id" serial PRIMARY KEY NOT NULL,
    "core_product_id" integer NOT NULL,
    "shop_id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "source_admin_template_version" integer,
    "details" jsonb NOT NULL,
    "created_by_id" text,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "shop_product_generation_template"
    ADD CONSTRAINT "shop_product_generation_template_core_product_id_fk"
    FOREIGN KEY ("core_product_id") REFERENCES "public"."core_product_identity"("id") ON DELETE cascade;
ALTER TABLE "shop_product_generation_template"
    ADD CONSTRAINT "shop_product_generation_template_shop_id_fk"
    FOREIGN KEY ("shop_id") REFERENCES "public"."user"("id") ON DELETE cascade;
ALTER TABLE "shop_product_generation_template"
    ADD CONSTRAINT "shop_product_generation_template_created_by_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null;
--> statement-breakpoint
INSERT INTO shop_product_generation_template (
    core_product_id, shop_id, version, source_admin_template_version,
    details, created_by_id, "createdAt", "updatedAt"
)
SELECT DISTINCT ON (p.created_by_id, p.core_product_id)
    p.core_product_id,
    p.created_by_id,
    1,
    admin_template.version,
    COALESCE(
        admin_template.details - 'price',
        jsonb_build_object(
            'name', cp.name,
            'slug', cp.slug,
            'description', p.description,
            'shortDescription', p.short_description,
            'videoUrl', p.video_url,
            'size', p.size,
            'price', '0',
            'image', p.image,
            'additionalImages', '[]'::jsonb,
            'features', COALESCE(p.features, '[]'::jsonb),
            'inStock', false,
            'isFeatured', false,
            'reorderLevel', p.reorder_level,
            'isReturnablePack', p.is_returnable_pack,
            'defaultPackDepositAmount', p.default_pack_deposit_amount::text,
            'allowedPackBrands', to_jsonb(p.allowed_pack_brands),
            'allowedPackSizes', to_jsonb(p.allowed_pack_sizes),
            'returnPolicyEnabled', p.return_policy_enabled,
            'trackingType', p.tracking_type,
            'expiryEnabled', p.expiry_enabled,
            'damageControlEnabled', p.damage_control_enabled,
            'stockTrackingEnabled', p.stock_tracking_enabled,
            'minimumOrderEnabled', p.minimum_order_enabled,
            'minimumOrderQty', p.minimum_order_qty::text,
            'inventoryUnit', p.inventory_unit,
            'conversionEnabled', p.conversion_enabled,
            'inventoryLooseUnitEnabled', p.inventory_loose_unit_enabled,
            'inventoryLooseUnit', p.inventory_loose_unit,
            'visibility', p.visibility,
            'status', 'draft'
        )
    ) || jsonb_build_object('price', '0'),
    p.created_by_id,
    p."createdAt",
    NOW()
FROM product p
JOIN core_product_identity cp ON cp.id = p.core_product_id
LEFT JOIN admin_product_generation_template admin_template
  ON admin_template.core_product_id = p.core_product_id
WHERE p.creator_source = 'shop'
  AND p.created_by_id IS NOT NULL
  AND p.core_product_id IS NOT NULL
ORDER BY p.created_by_id, p.core_product_id, p.id;
--> statement-breakpoint
CREATE UNIQUE INDEX "product_core_brand_shop_unique"
ON "product" ("created_by_id", "core_product_id", "brand_id")
WHERE "creator_source" = 'shop'
  AND "created_by_id" IS NOT NULL
  AND "core_product_id" IS NOT NULL
  AND "brand_id" IS NOT NULL;
CREATE UNIQUE INDEX "shop_generation_template_owner_core_unique"
ON "shop_product_generation_template" ("shop_id", "core_product_id");
