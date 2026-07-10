-- Read-only preflight for 0023_split_multibrand_admin_products.sql.
-- Run this against a recent database copy before applying the migration.

WITH admin_product_brands AS (
    SELECT p.id AS product_id, pvp.brand_id
    FROM product p
    JOIN product_variant_price pvp ON pvp.product_id = p.id
    WHERE p.created_by_warehouse_id IS NULL AND pvp.brand_id IS NOT NULL
    UNION
    SELECT p.id AS product_id, pb.brand_id
    FROM product p
    JOIN product_brand pb ON pb.product_id = p.id
    WHERE p.created_by_warehouse_id IS NULL
)
SELECT COUNT(*) AS multibrand_admin_products
FROM (
    SELECT product_id
    FROM admin_product_brands
    GROUP BY product_id
    HAVING COUNT(DISTINCT brand_id) > 1
) multibrand;

SELECT core_product_id, brand_id, COUNT(*) AS duplicate_count,
       ARRAY_AGG(id ORDER BY "createdAt", id) AS product_ids
FROM product
WHERE created_by_warehouse_id IS NULL
  AND core_product_id IS NOT NULL
  AND brand_id IS NOT NULL
GROUP BY core_product_id, brand_id
HAVING COUNT(*) > 1;

WITH prospective_slugs AS (
    SELECT p.id AS source_product_id,
           LEFT(p.slug || '-' || b.slug, 150) AS prospective_slug,
           b.id AS brand_id
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
    JOIN brand b ON b.id = linked.brand_id
    WHERE p.created_by_warehouse_id IS NULL
      AND linked.brand_id IS DISTINCT FROM p.brand_id
    GROUP BY p.id, p.slug, b.id, b.slug
)
SELECT prospective_slugs.*, existing.id AS colliding_product_id
FROM prospective_slugs
JOIN product existing ON existing.slug = prospective_slugs.prospective_slug;

WITH linked_brands AS (
    SELECT p.id AS product_id, COUNT(DISTINCT pb.brand_id) AS brand_count
    FROM product p
    JOIN product_brand pb ON pb.product_id = p.id
    WHERE p.created_by_warehouse_id IS NULL AND p.brand_id IS NULL
    GROUP BY p.id
)
SELECT *
FROM linked_brands
WHERE brand_count > 0;
