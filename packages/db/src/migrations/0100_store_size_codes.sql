-- Store-only sizes now take a 2-digit size code too (client, 2026-11-25), so
-- every size can get a 13-digit barcode. One code per size within a Type:
-- a size already coded in the Type (same canonical signature) passes its
-- code on; otherwise it takes the next code after the Type's highest.
DO $$
DECLARE
  row record;
  code text;
BEGIN
  FOR row IN
    SELECT id, type_id, canonical_signature
    FROM variant_option
    WHERE sku_code IS NULL AND type_id IS NOT NULL
    ORDER BY id
  LOOP
    code := NULL;
    IF row.canonical_signature IS NOT NULL THEN
      SELECT sku_code INTO code
      FROM variant_option
      WHERE type_id = row.type_id
        AND canonical_signature = row.canonical_signature
        AND sku_code IS NOT NULL
      ORDER BY owner_id IS NOT NULL, id
      LIMIT 1;
    END IF;
    IF code IS NULL THEN
      SELECT LPAD((COALESCE(MAX(CAST(sku_code AS INTEGER)), 0) + 1)::text, 2, '0')
      INTO code
      FROM variant_option
      WHERE type_id = row.type_id AND sku_code ~ '^[0-9]+$';
    END IF;
    IF length(code) > 2 THEN
      RAISE EXCEPTION 'Type % has no 2-digit size codes left', row.type_id;
    END IF;
    UPDATE variant_option SET sku_code = code WHERE id = row.id;
  END LOOP;
END $$;
