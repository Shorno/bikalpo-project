-- Some legacy generated variants have a NULL brand_id even though their
-- source product_variant_price row is branded. After the per-brand split, the
-- source price row is authoritative for both the product and missing brand.
UPDATE product_variant AS generated_variant
SET product_id = source_price.product_id,
    brand_id = COALESCE(generated_variant.brand_id, source_price.brand_id),
    "updatedAt" = NOW()
FROM product_variant_price AS source_price
JOIN product AS target_product ON target_product.id = source_price.product_id
WHERE generated_variant.source_variant_price_id = source_price.id
  AND generated_variant.product_id <> source_price.product_id
  AND target_product.created_by_warehouse_id IS NULL
  AND target_product.core_product_id IS NOT NULL;
