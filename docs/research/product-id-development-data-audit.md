# Product identifier development-data audit

Read-only snapshot taken on 28 September 2026 against the database configured
for the local development application. Repository baseline:
`51f05a07e9025d55e250b25d089cdbd3e7e4c1b4`. PostgreSQL reports version **17.7**.
These counts describe this development database, not production or every deployment.

The audit used one connection, `BEGIN READ ONLY`, a 10-second per-statement
timeout, aggregate SQL queries, and `ROLLBACK`. No records, sequences, schema,
prices, or stock were changed. The temporary connection script was removed.
Credentials and owner/account identities are not included in this report.

## Observed data

| Measure | Result |
| --- | --- |
| Product rows | 28: 10 Admin, 7 Warehouse, 11 Shop |
| Products missing a Core Identity | 4: 1 Warehouse, 3 Shop |
| Products missing a brand | 4: 1 Warehouse, 3 Shop |
| Duplicate existing owner/core/brand groups | 0 |
| Owner variants | 63 |
| Owner variants missing Catalog Variant identity | 4 |
| Owner variants missing a source Variant Option | 3 |
| Owner variants with a nonblank color | 0 |
| Owner variants with a nonblank size | 31 |
| Catalog Variants | 30; all currently marked `configured` |
| Catalog Variants with `classification_code` populated | 0 |
| Inventory rows | 35: 18 Shop, 17 Warehouse |
| Stock rows whose owner variant lacks catalog identity | 4: 3 Shop, 1 Warehouse |
| Owner-variant SKU formats | 28 `CP-...`; 3 missing; 32 other readable/legacy values; no flat 15-digit values |

The catalog linkage and option counts are different measures; a missing option
does not imply that every such row is also missing catalog linkage.

### Current Product Type codes

| Type | Internal database ID | Current `sku_code` |
| --- | ---: | --- |
| Grocery | 3 | `01` |
| Gas | 4 | `02` |
| Fashion | 5 | `03` |
| Electronics | 7 | `05` |
| Footwear | 8 | `06` |

The client's `INV-03...` footwear example does **not** match the current Footwear
code if its first two digits are intended to encode Type. The client has not
defined that interpretation. A Type-code mapping must be settled before issuing
new identifiers; database primary keys are not these display codes.

### Representation differences are not established identity collisions

Fifteen Catalog Variant groups have differing raw `(color, size)` values across
their owner variants. The first eight inspected groups are cylinder options
such as `12 KG cylinder`, `25 KG cylinder`, `35 KG cylinder`, and `45 KG cylinder`.
Their raw sizes differ between the numeric size string and `NULL`.

This demonstrates inconsistent denormalized representation, **not** that fifteen
different commercial variants were incorrectly merged. Normalize against the
structured option before deciding whether any catalog identity must split.
There are currently no populated color values to use as proof of a live
Black/White collision; that risk comes from the source-code model.

### Constraints and dependencies observed in the database

`product_variant_product_catalog_active_unique` exists locally, as does
`product_variant_catalog_variant_idx`. The unique index can reject two active
owner variants that resolve to the same canonical variant within one product.
It does not make a color-blind canonical key semantically complete.

The information-schema query found 15 foreign-key references to `product`, 21
to `product_variant`, 3 to `catalog_variant`, and 4 to `inventory`. These are
constraint-reference counts in this database; they exclude unenforced logical
references, JSON payloads, browser storage, printed labels, and external files.
They support preserving existing internal keys during an additive migration.

## Reproducible core queries

Run only against an explicitly selected environment using a read-only session.

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';

SELECT creator_source, count(*) AS products,
       count(*) FILTER (WHERE core_product_id IS NULL) AS missing_core,
       count(*) FILTER (WHERE brand_id IS NULL) AS missing_brand
FROM product GROUP BY creator_source;

SELECT count(*) AS owner_variants,
       count(*) FILTER (WHERE catalog_variant_id IS NULL) AS missing_catalog,
       count(*) FILTER (WHERE source_variant_option_id IS NULL) AS missing_option,
       count(*) FILTER (WHERE nullif(trim(color), '') IS NOT NULL) AS with_color,
       count(*) FILTER (WHERE nullif(trim(size), '') IS NOT NULL) AS with_size
FROM product_variant;

SELECT owner_type, count(*) AS stock_rows,
       count(*) FILTER (WHERE pv.catalog_variant_id IS NULL) AS missing_catalog
FROM inventory i JOIN product_variant pv ON pv.id = i.variant_id
GROUP BY owner_type;

SELECT vo.name, jsonb_agg(DISTINCT coalesce(pv.size, '<null>')) AS raw_sizes
FROM product_variant pv
JOIN catalog_variant cv ON cv.id = pv.catalog_variant_id
JOIN variant_option vo ON vo.id = cv.variant_option_id
GROUP BY cv.id, vo.name
HAVING count(DISTINCT coalesce(pv.color, '') || '|' || coalesce(pv.size, '')) > 1;

SELECT id, name, sku_code FROM product_type ORDER BY id;
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'product_variant'
  AND indexdef ILIKE '%catalog_variant_id%';

ROLLBACK;
```

## Migration implications

These are recommendations derived from the snapshot:

- Review the four stocked owner variants without shared catalog identity before
  enabling ID-dependent receiving, sales, transfers, or matching.
- Do not discard legacy products or stock merely to make identifier generation
  easier. Maintain an explicit review queue for ambiguous mappings.
- Resolve Type-code ownership before adopting a Type-prefixed INV format.
- Backfill canonical attributes from structured definitions and reviewed owner
  data; do not treat `NULL` versus `12` as automatically different merchandise.
- Reconcile inventory quantities and all transaction references before and after
  migration; the low development row count does not make historical links disposable.

See the [software requirements](../product-id-software-requirements.md),
[creation-flow audit](./product-id-creation-audit.md), and
[storage/consumer audit](./product-id-storage-audit.md).
