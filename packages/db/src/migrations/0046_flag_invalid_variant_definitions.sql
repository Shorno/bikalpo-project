-- Approved legacy requests could create Variant Options without the structured
-- definition required by inventory operations. Preserve those rows and every
-- reference, but force an Admin review before they can be treated as concrete.
UPDATE "variant_option"
SET "needs_review" = true
WHERE
  "definition" IS NULL
  OR "definition_kind" IS NULL
  OR "definition_kind" NOT IN ('measurement', 'loose', 'attribute')
  OR jsonb_typeof("definition") <> 'object'
  OR "definition" ->> 'kind' IS DISTINCT FROM "definition_kind"
  OR (
    "definition_kind" = 'measurement'
    AND (
      NULLIF(btrim("definition" ->> 'value'), '') IS NULL
      OR NULLIF(btrim("definition" ->> 'measurementUnit'), '') IS NULL
      OR NULLIF(btrim("definition" ->> 'container'), '') IS NULL
      OR "definition" ->> 'container' NOT IN (
        'sack', 'carton', 'packet', 'bottle', 'can', 'jar', 'pouch',
        'box', 'unit', 'pair', 'cylinder', 'drum', 'bundle'
      )
    )
  )
  OR (
    "definition_kind" = 'loose'
    AND NULLIF(btrim("definition" ->> 'measurementUnit'), '') IS NULL
  )
  OR (
    "definition_kind" = 'attribute'
    AND (
      NULLIF(btrim("definition" ->> 'attribute'), '') IS NULL
      OR NULLIF(btrim("definition" ->> 'value'), '') IS NULL
    )
  );
