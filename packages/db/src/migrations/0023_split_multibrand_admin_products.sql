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
    detached_count integer := 0;
BEGIN
    -- Fill a missing product.brand_id when its legacy links identify one brand.
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
            SELECT pb.brand_id
            FROM product_brand pb
            WHERE pb.product_id = p.id
        ) linked
        WHERE p.created_by_warehouse_id IS NULL
          AND p.brand_id IS NULL
        GROUP BY p.id
        HAVING COUNT(DISTINCT linked.brand_id) = 1
    ) source
    WHERE target.id = source.product_id;

    -- Split every remaining multi-brand admin product. The original row keeps
    -- its primary brand so all existing product-level foreign keys remain valid.
    FOR product_row IN
        SELECT p.*
        FROM product p
        CROSS JOIN LATERAL (
            SELECT COUNT(DISTINCT linked.brand_id) AS brand_count
            FROM (
                SELECT pvp.brand_id
                FROM product_variant_price pvp
                WHERE pvp.product_id = p.id AND pvp.brand_id IS NOT NULL
                UNION
                SELECT pb.brand_id
                FROM product_brand pb
                WHERE pb.product_id = p.id
            ) linked
        ) counts
        WHERE p.created_by_warehouse_id IS NULL
          AND counts.brand_count > 1
        ORDER BY p.id
    LOOP
        SELECT COALESCE(product_row.brand_id, MIN(linked.brand_id))
        INTO primary_brand_id
        FROM (
            SELECT pvp.brand_id
            FROM product_variant_price pvp
            WHERE pvp.product_id = product_row.id AND pvp.brand_id IS NOT NULL
            UNION
            SELECT pb.brand_id
            FROM product_brand pb
            WHERE pb.product_id = product_row.id
        ) linked;

        UPDATE product
        SET brand_id = primary_brand_id,
            "updatedAt" = NOW()
        WHERE id = product_row.id;

        FOR brand_row IN
            SELECT linked.brand_id, b.name, b.slug
            FROM (
                SELECT pvp.brand_id
                FROM product_variant_price pvp
                WHERE pvp.product_id = product_row.id AND pvp.brand_id IS NOT NULL
                UNION
                SELECT pb.brand_id
                FROM product_brand pb
                WHERE pb.product_id = product_row.id
            ) linked
            JOIN brand b ON b.id = linked.brand_id
            WHERE linked.brand_id <> primary_brand_id
            ORDER BY linked.brand_id
        LOOP
            base_slug := LEFT(product_row.slug || '-' || brand_row.slug, 150);
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
                created_by_warehouse_id, "createdAt", "updatedAt"
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
                product_row.stock_tracking_enabled, product_row.minimum_order_enabled,
                product_row.minimum_order_qty, product_row.inventory_unit,
                product_row.conversion_enabled,
                product_row.inventory_loose_unit_enabled,
                product_row.inventory_loose_unit, product_row.visibility,
                product_row.scheduled_at, product_row.status,
                product_row.created_by_warehouse_id, product_row."createdAt", NOW()
            )
            RETURNING id INTO new_product_id;

            UPDATE product_variant_price
            SET product_id = new_product_id,
                updated_at = NOW()
            WHERE product_id = product_row.id
              AND brand_id = brand_row.brand_id;

            UPDATE product_variant
            SET product_id = new_product_id,
                "updatedAt" = NOW()
            WHERE product_id = product_row.id
              AND brand_id = brand_row.brand_id
              AND source_variant_price_id IS NOT NULL;

            INSERT INTO product_image (product_id, image_url, "createdAt", "updatedAt")
            SELECT new_product_id, image_url, "createdAt", NOW()
            FROM product_image
            WHERE product_id = product_row.id;
        END LOOP;
    END LOOP;

    -- Every core-managed admin product now has exactly one junction-row brand.
    DELETE FROM product_brand pb
    USING product p
    WHERE pb.product_id = p.id
      AND p.created_by_warehouse_id IS NULL
      AND p.core_product_id IS NOT NULL;

    INSERT INTO product_brand (product_id, brand_id, "createdAt", "updatedAt")
    SELECT p.id, p.brand_id, NOW(), NOW()
    FROM product p
    WHERE p.created_by_warehouse_id IS NULL
      AND p.core_product_id IS NOT NULL
      AND p.brand_id IS NOT NULL;

    -- Detach duplicate legacy rows from the core identity. Their data and all
    -- foreign-key references remain intact as standalone admin products.
    WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY core_product_id, brand_id
                   ORDER BY "createdAt", id
               ) AS position
        FROM product
        WHERE created_by_warehouse_id IS NULL
          AND core_product_id IS NOT NULL
          AND brand_id IS NOT NULL
    )
    UPDATE product p
    SET core_product_id = NULL,
        "updatedAt" = NOW()
    FROM ranked
    WHERE p.id = ranked.id
      AND ranked.position > 1;

    GET DIAGNOSTICS detached_count = ROW_COUNT;
    RAISE NOTICE 'Detached % duplicate admin products from their core identity', detached_count;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "product_core_brand_admin_unique"
ON "product" ("core_product_id", "brand_id")
WHERE "created_by_warehouse_id" IS NULL
  AND "core_product_id" IS NOT NULL
  AND "brand_id" IS NOT NULL;
