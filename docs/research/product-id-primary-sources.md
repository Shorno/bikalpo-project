# Product identifiers: primary-source research

Researched on 28 September 2026 for the client's Product System ID, Product Inventory ID, and SKU requirements. Repository observations refer to commit `51f05a07e9025d55e250b25d089cdbd3e7e4c1b4`. This note supports the [software requirements](../product-id-software-requirements.md); it is research and architectural advice, not an implementation or a database migration.

## Client requirements, translated into English

| Identifier | Client example | Stated purpose |
| --- | --- | --- |
| Product System ID | `SYS-000000000001` | Generated when a product is created; permanent identity of the main product record. The product's Type must never change after creation. |
| Product Inventory ID | `INV-030000000001` | Identifies a stock-managed item/variant related to Type, Category, Subcategory, Product, Variant, Color, and Size. A sports shoe's Black/40, Black/41, Black/42, and White/40 combinations each receive a different ID and have separate stock quantities. |
| SKU | `APX-SHOE-BLK-42` | A readable, memorable, speakable, searchable code used for sales and purchases. Visible to visitors, customers, retailers, wholesalers, salespeople, and warehouse staff. |

The examples do **not** define what the `03` in the Inventory ID means, which digits encode which fields, whether sequences are global or scoped, whether one Inventory ID is shared by multiple stock owners, or whether the main product means a shared catalog entity or an owner's product listing. No external standard can settle those client-specific choices. These remain explicit design decisions in the requirements, rather than inferred facts.

## Relevant Bikalpo model

The schema already separates several identities:

- `product` is an actual product record with core identity, brand, creator source, and creator-scoped uniqueness. Its primary key is a serial integer. Source: [product schema](../../packages/db/src/schema/product.ts#L59), [owner-scoped constraints](../../packages/db/src/schema/product.ts#L197).
- `catalog_variant` is documented as a platform-wide orderable trade-variant identity. It has an integer primary key, a generated `BKV-` Global SKU, and unique core+brand+variant-option combinations, with separate handling for unbranded combinations. Source: [canonical variant schema](../../packages/db/src/schema/catalog-variant.ts#L19).
- `product_variant.catalogVariantId` links an owner variant to that shared canonical identity. The same row can retain a preferred local SKU. Source: [owner-variant bridge](../../packages/db/src/schema/product-variant.ts#L215).
- `inventory` is an owner stock snapshot. It holds quantities and is unique by owner type, owner ID, and owner variant ID. It is not the shared catalog identity. Source: [inventory schema](../../packages/db/src/schema/inventory.ts#L27).

Consequently, applying the client's `INV-` prefix to the existing `inventory.id` without deciding its scope would change the meaning of the client's example. A variant identity and an owner's stock balance are related but different records. The research below supports maintaining that distinction; it does not mandate a particular Bikalpo table name or require copying another platform's schema.

## External evidence

### 1. Permanent keys need not encode product classification

GS1's architectural principles distinguish an identifier from the business information associated with it. They explain that embedding such information in an identification key reduces capacity and creates difficulties when that information changes. This is a GS1 design principle, not a rule that automatically applies to Bikalpo's private identifiers. [GS1 Architecture Principles, “Non-significance of keys”](https://ref.gs1.org/architecture/principles/)

**Bikalpo recommendation:** give SYS and INV stable values and store taxonomy relationships separately. A category rename or approved reclassification should not rewrite historical identifiers. If the client confirms that `03` is an immutable Type code, it can be an issuance-time prefix with a documented namespace; do not infer that all seven listed attributes must be packed into twelve digits.

### 2. Color and size combinations represent distinct trade variants

GS1 states that each size/color combination needs its own GTIN when those combinations are separately identified trade items. The rule distinguishes a Black/40 shoe from a Black/41 shoe; it does not require a new GTIN for every physical copy of Black/40. [GS1 FAQ on size and color variations](https://support.gs1.org/support/solutions/articles/43000734083-how-many-gs1-gtins-do-i-need-when-i-have-a-product-with-many-sizes-and-colours-)

**Bikalpo recommendation:** model an inventory variant as an exact, normalized selection of applicable options. Enforce uniqueness on that combination in its selected product/brand scope. Do not place only a free-text combined label such as `Black / 40` into the identity model and depend on spelling to establish equality.

### 3. A trade item, a batch, and an individual physical unit are different levels

The GS1 Global Traceability Standard distinguishes class-level identification by GTIN, batch/lot identification by GTIN plus lot, and individual-instance identification by GTIN plus serial number. Separate location and party information participates in traceability. [GS1 Global Traceability Standard, sections 3.2 and 4.1.1](https://ref.gs1.org/standards/global-traceability/)

**Bikalpo recommendation:** the client's shoe example is variant-level identification with quantity, not unit serialization. Do not issue a new INV for each of the 25 identical Black/40 pairs. Existing batch, carton, serialized-unit, and movement identifiers must retain their separate purposes. A product ID redesign must not collapse those records into one code.

### 4. Stock identity and stock at a location can be separate

Shopify's current GraphQL model describes an InventoryItem as the inventory information associated with a product variant across locations. InventoryLevel associates that item with a location and quantities. This is one concrete commerce design, not a universal industry schema. [Shopify InventoryItem](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryItem), [Shopify InventoryLevel](https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryLevel)

**Bikalpo recommendation:** preserve the existing shared-catalog/owner-stock separation. If INV denotes the canonical trade variant, multiple owners may hold stock of the same INV while each owner keeps an independent balance. If INV instead denotes an owner variant, explicitly document that the same physical trade item receives different INV values for different owners and retain the canonical catalog link. Never infer the stock owner or authorization solely from the identifier.

### 5. Human-readable SKU and barcode are separate concepts

Shopify documents SKU and barcode as separate fields, recommends unique SKUs for different variants, consistent abbreviations, and the same variant SKU across locations. It also allows SKU-based lookup and customer-facing SKU presentation. These are useful practices, not a requirement to adopt Shopify's suggested character limit. [Shopify SKU guidance](https://help.shopify.com/en/manual/products/details/sku)

**Bikalpo recommendation:** store the SKU explicitly rather than recomputing it from mutable names whenever a page loads. Define whether uniqueness is platform-wide or owner-scoped, normalize case consistently, and detect collisions. `APX-SHOE-BLK-42` may collide when one brand has several shoe models; add a stable model/style discriminator when needed. Retain previous codes as search aliases if a SKU is intentionally changed. A local owner alias must not silently replace the platform-wide identity used to match sales and purchase items.

### 6. A private SYS/INV/SKU is not a GS1 GTIN

GS1 describes GTIN as a globally defined trade-item identifier and normally assigns responsibility to the brand owner. Its formats and allocation rules are independent of Bikalpo's private code conventions. [GS1 GTIN definition](https://support.gs1.org/support/solutions/articles/43000734283-what-is-a-global-trade-item-number-gtin-), [GS1 identifier and barcode distinctions](https://support.gs1.org/support/solutions/articles/43000734124-what-is-the-difference-between-a-gs1-gtin-a-barcode-an-ean-and-a-upc-)

**Bikalpo recommendation:** keep genuine manufacturer GTIN/barcodes as separate searchable data. Do not relabel a newly generated twelve-digit sequence as a GTIN/UPC because its length resembles one. Replacing `BKV-` or a local SKU must preserve any existing manufacturer identifiers and scanner lookup mappings.

### 7. Brand affects trade-item identity

GS1's GTIN Management Standard requires a new GTIN when the primary brand appearing on the trade item changes. This establishes that brand can be part of trade identity, rather than merely a filter label. [GS1 primary-brand rule](https://www.gs1.org/1/gtinrules/en/rule/268/primary-brand)

**Bikalpo recommendation:** preserve the current brand dimension when identifying otherwise similar variants. A descriptive correction to a brand label and replacing one product's actual brand with another are different operations. The latter should not silently repurpose an existing canonical inventory variant with transaction history. How SYS groups brands must be stated explicitly in the SRS.

### 8. Database allocation handles concurrent ID generation

PostgreSQL's `nextval` allocates values atomically between concurrent sessions. Allocations are not reclaimed after rollback, so gaps are expected; sequence allocation is not a gapless numbering system. PostgreSQL also warns against publishing a sequence-derived value outside the database before the transaction commits. [PostgreSQL sequence functions](https://www.postgresql.org/docs/current/functions-sequence.html)

**Bikalpo recommendation:** issue identifiers in the database creation transaction. Do not use row count, `MAX + 1`, timestamps, random truncation, or a UI-generated counter. Accept gaps. Return the persisted identifier from the successful create result, and ensure retried create requests do not create duplicate business entities. Define maximum capacity and fail before overflow rather than trimming digits.

### 9. Generation is not sufficient for uniqueness or immutability

PostgreSQL identity columns do not themselves guarantee uniqueness; a primary-key or unique constraint is still required. Composite unique constraints and foreign keys can enforce variant scope and valid relationships. PostgreSQL's default unique-constraint behavior treats nulls as distinct, so optional dimensions need an explicit strategy. [Identity columns](https://www.postgresql.org/docs/current/ddl-identity-columns.html), [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)

PostgreSQL trigger functions can inspect old and new values and reject an update; its examples include refusing to change an existing key. [Trigger functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)

**Bikalpo recommendation:** enforce SYS/INV uniqueness and non-nullability in the database. Enforce the client's immutable-Type rule on every write path, including imports and direct maintenance writes; hiding a selector is insufficient. Use a database trigger where application-only enforcement cannot cover these paths. The exact choice should account for type inherited through category/core relations, so changing a parent relationship cannot bypass the rule.

### 10. Migration can preserve compatibility

PostgreSQL supports staged validation of eligible constraints and attaching a unique constraint to a qualifying unique index. These options reduce migration disruption but do not prove an application's compatibility. Feature details depend on the deployed PostgreSQL version; the consulted current documentation is PostgreSQL 18. [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)

**Bikalpo recommendation:** add the new identity fields and a deterministic old-to-new mapping before changing callers. Backfill, validate duplicates and missing links, then switch API/UI/search/document output together. Preserve existing integer foreign keys unless changing their meaning is necessary. Keep historical identifiers resolvable. A controlled development cutover is reasonable; a full database reset is a separate decision, not required merely to introduce SYS and INV.

## Recommended acceptance constraints for the SRS

These are proposed Bikalpo requirements derived from the client examples, the inspected schema, and the research above; they are not quotations from an external standard.

1. One successful product creation produces one permanent SYS for each entity defined as a main product. An edit or retry cannot silently create another identity for the same entity.
2. SYS remains stable through name, description, price, visibility, and stock changes. Type changes are rejected after creation, including indirect changes through taxonomy reassignment.
3. Each valid stock-managed option combination receives one INV in the chosen scope. Reordering the same option selections cannot create a duplicate variant.
4. Black/40 and Black/41 have different INV values; repeated purchases of Black/40 affect its existing identity and the relevant owner's stock rather than minting a new variant.
5. The requirements state the relationship between SYS, canonical trade variants, owner variants, and inventory balances. All are independently addressable where existing workflows require them.
6. Inventory, purchasing, sales, returns, transfers, conversions, reference prices, and audit records resolve the same underlying variant without parsing names or SKU text.
7. New IDs are unique during concurrent creation. Aborted transactions may leave numeric gaps; issued IDs are never recycled onto another business entity.
8. Full identifiers remain available for copying and search on desktop and mobile. Visual truncation must never alter stored identity or make a suffix the lookup key.
9. SKU search follows a documented scope. Ambiguous legacy aliases produce an explicit disambiguation path rather than selecting an arbitrary product.
10. The migration reconciles row counts, canonical links, quantities, ledger references, barcode mappings, and historical documents before the old display format is retired.

## Decisions that research cannot make for the client

- Whether SYS identifies the current owner-specific `product`, a shared core+brand product, or the core identity spanning brands.
- Whether INV is platform-wide or owner-specific, and whether `03` has an intended Type meaning.
- Whether SKU is globally controlled, owner-controlled, or supports both a canonical SKU and local aliases.
- The exact digit capacity, SKU maximum length, allowed renames, and policy for exceptional correction of a product created under the wrong Type.

The main software requirements should choose and label a recommended interpretation for each, explain the effect on existing workflows, and leave only genuinely business-dependent decisions for client confirmation. None of these uncertainties prevents producing a concrete implementation plan.
