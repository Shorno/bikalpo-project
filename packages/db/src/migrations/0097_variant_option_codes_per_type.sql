-- Size codes (variant_option.sku_code) were counted per Type + Category, so a
-- type-wide size and a category size could share a code (12 KG and 5.5 KG
-- were both "01"). The 13-digit product code needs one code per size within
-- a Type, so the later duplicates get new codes after the Type's highest one.
WITH ranked AS (
  SELECT
    id,
    type_id,
    ROW_NUMBER() OVER (
      PARTITION BY type_id, sku_code
      ORDER BY category_id NULLS FIRST, id
    ) AS dup_rank
  FROM variant_option
  WHERE owner_id IS NULL AND sku_code IS NOT NULL
),
duplicates AS (
  SELECT id, type_id, ROW_NUMBER() OVER (PARTITION BY type_id ORDER BY id) AS n
  FROM ranked
  WHERE dup_rank > 1
),
type_max AS (
  SELECT type_id, MAX(CAST(sku_code AS INTEGER)) AS max_code
  FROM variant_option
  WHERE owner_id IS NULL AND sku_code ~ '^[0-9]+$'
  GROUP BY type_id
)
UPDATE variant_option vo
SET sku_code = LPAD((tm.max_code + d.n)::text, 2, '0')
FROM duplicates d
JOIN type_max tm ON tm.type_id IS NOT DISTINCT FROM d.type_id
WHERE vo.id = d.id;
