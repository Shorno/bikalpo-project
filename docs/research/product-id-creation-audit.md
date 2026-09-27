# Product identity: creation and editing audit

**Date:** 2026-09-28. **Baseline:** `51f05a07e9025d55e250b25d089cdbd3e7e4c1b4`.

This is a read-only source-code audit supporting the client's proposed permanent Product System ID, variant/inventory ID, and readable SKU. It covers Admin, Warehouse, and Shop creation/editing flows. It does not change application behavior, execute database migrations, or establish that every historical row satisfies the current model. Source code and migrations are the primary evidence; recommendations and unresolved business decisions are explicitly separated below.

## Client requirement in English

The supplied client reference describes three different purposes:

1. **Product System ID**, for example `SYS-000000000001`: automatically issued when a product is created; identifies the permanent main product record. The Product Type must never change after creation.
2. **Product Inventory ID**, for example `INV-030000000001`: identifies a particular stock-managed variant, described through Type, Category, Subcategory, Product, Variant, Color, and Size. Four Sports Shoe combinations—Black/40, Black/41, Black/42, and White/40—must have four different IDs and independent quantities.
3. **SKU**, for example `APX-SHOE-BLK-42`: a readable, memorable, searchable sales/purchase code visible to visitors, customers, retailers, wholesalers, salespeople, and warehouse staff.

This reference does **not** specify which digits encode which fields, whether `03` means Footwear, whether stock identity is global or owner-specific, or whether the main product means the brand-neutral Core Identity, an owner's Brand Product, or a canonical branded model. Those are design decisions, not facts established by the example.

## Current domain and persistence

The existing [domain vocabulary](../../CONTEXT.md#L29) deliberately separates a **Core Product Identity**, an owner-specific **Brand Product**, a shared **Catalog Variant**, and an **Owner Variant**. The distinction matters: the existing table named `product` is not one globally shared branded product record.

| Level | Current storage and identifier | Meaning and source |
| --- | --- | --- |
| Product Type | `product_type.id`, optional two-character `sku_code` | Top-level classification, fulfillment family and rule settings. [Schema](../../packages/db/src/schema/product-type.ts#L43) |
| Category | `category.id`, `type_id`, optional three-character `sku_code` | Category assigned to a Type. [Schema](../../packages/db/src/schema/category.ts#L12) |
| Subcategory | `sub_category.id`, `category_id`, optional three-character `sku_code` | Category subdivision. [Schema](../../packages/db/src/schema/category.ts#L31) |
| Core Product Identity | `core_product_identity.id`, scoped `sku` | Brand-neutral reusable identity/defaults, category and optional subcategory. Its name and slug are globally unique; it has no direct frozen Type field. [Schema](../../packages/db/src/schema/core-product.ts#L42) |
| Brand Product | `product.id`, optional `sku` | One owner-specific product for a core and brand. Admin, Warehouse, and Shop have separate scopes and rows. [Schema and uniqueness rules](../../packages/db/src/schema/product.ts#L59), [owner uniqueness](../../packages/db/src/schema/product.ts#L197) |
| Variant Option | `variant_option.id`, scoped `sku_code`, structured definition | Reusable option such as package weight or one attribute/value. [Schema](../../packages/db/src/schema/variant-option.ts#L35), [definition](../../packages/db/src/variant-definition.ts#L1) |
| Catalog Variant | `catalog_variant.id`, `global_sku` such as `BKV-0000000001` | Shared exact identity currently keyed by core + brand + option. [Schema](../../packages/db/src/schema/catalog-variant.ts#L24) |
| Owner Variant | `product_variant.id`, `sku`, optional `preferred_local_sku` | An owner's sellable/stockable instance linked to the Catalog Variant; can also carry legacy color/size fields. [Schema](../../packages/db/src/schema/product-variant.ts#L72), [canonical bridge](../../packages/db/src/schema/product-variant.ts#L215) |
| Owner stock balance | `inventory.id`, owner Type + owner ID + variant ID | Actual available/reserved quantities belong to a particular owner and Owner Variant. [Schema](../../packages/db/src/schema/inventory.ts#L28), [unique owner/variant key](../../packages/db/src/schema/inventory.ts#L87) |

The system already has the separation needed to distinguish product identity, exact variant identity, and owner stock. The client's visible prefixes can build on that separation, but attaching them to the wrong existing row would change their meaning.

## Actual creation and handling flows

### Setup and structured options

Admin creates Types, Categories, Subcategories, and Core Identities. Core creation checks that the category/type and supplied subcategory are active and consistent, then assigns a scoped three-digit core code when one was not supplied. [Core creation](../../packages/api/src/routers/admin-core-product.ts#L318)

New structured Variant Options are Type-scoped, optionally Category-scoped. Their definition is one of measurement, loose, or **one** attribute/value pair. Operational units are derived from the definition and Type family: Footwear attribute options use pairs. The form likewise edits one attribute and one value; it does not define a matrix of independent axes. [Input contract](../../packages/api/src/routers/helpers/structured-variant-option-schema.ts#L1), [scope validation](../../packages/api/src/routers/helpers/structured-variant-option.ts#L26), [unit derivation](../../packages/db/src/variant-definition.ts#L94), [editor](../../apps/web/components/features/variant-option/components/variant-definition-editor.tsx#L309)

Legacy global options remain accepted by configuration compatibility checks, although the new structured option input requires a Type. Generated variants require a concrete reviewed definition. [Compatibility rules](../../packages/api/src/routers/admin-product-config.ts#L386), [concrete-definition guard](../../packages/db/src/variant-definition.ts#L396)

### Admin product creation

The product form selects Type → Category → Subcategory → Core Identity, or supplies a new Core Identity name. It then selects brands and options per brand. The API requires at least one brand and at least one option for each brand, creates an optional new Core Identity, validates option scope, saves generation defaults, and creates a separate `product` row per selected brand in a transaction. [Form selection](../../apps/web/components/features/product/components/product-form.tsx#L1300), [creation API](../../packages/api/src/routers/product.ts#L274), [brand fan-out](../../packages/api/src/routers/product.ts#L593)

Adding further brands to an existing core uses `adminProductConfig.configure`. Existing brand products retain their customized identity/detail fields; option changes synchronize existing price and variant rows. In batch mode, omitted brand products become inactive. Re-adding an inactive brand reuses its existing product row. Single mode controls how many brand configurations a save contains; it does not mean the core can only ever have one brand. [Configuration behavior](../../packages/api/src/routers/admin-product-config.ts#L488), [deactivation](../../packages/api/src/routers/admin-product-config.ts#L627), [domain definition](../../CONTEXT.md#L41)

The shared synchronization helper creates Owner Variants from selected option/price rows and resolves a shared Catalog Variant using **core + brand + option**. Unselected options are deactivated, and selecting them again reactivates the same rows. [Synchronization](../../packages/api/src/routers/helpers/sync-generated-variants.ts#L247), [canonical linking](../../packages/api/src/routers/helpers/sync-generated-variants.ts#L132)

### Warehouse and Shop configuration

Warehouse and Shop configure their own products from the same Core Identity and approved compatible options. They get distinct owner-specific `product` and `product_variant` rows. Their initial details can originate from Admin defaults, but subsequent owner customization is independent. Shop creation optionally records `derived_from_product_id`; it still creates a new product. Configuration also creates a zero-quantity owner inventory row for each new Owner Variant. [Shop fan-out](../../packages/api/src/routers/shop-product-config.ts#L650), [Shop variant and stock creation](../../packages/api/src/routers/shop-product-config.ts#L332), [Warehouse configuration](../../packages/api/src/routers/warehouse.ts#L8260)

Warehouse configuration accepts `variantOptionId` **plus optional color**, and deduplicates by option/color. Shop configuration accepts only `variantOptionId`; its synchronization map uses the option ID alone. [Warehouse contract](../../packages/api/src/routers/warehouse.ts#L7601), [Warehouse identity key](../../packages/api/src/routers/warehouse.ts#L7693), [Shop contract](../../packages/api/src/routers/shop-product-config.ts#L33), [Shop sync key](../../packages/api/src/routers/shop-product-config.ts#L228)

Removal of configured owner variants checks for live inventory before deactivation. The normal per-product Warehouse/Shop update does not offer changing the core or brand. [Warehouse stock guard](../../packages/api/src/routers/warehouse.ts#L7821), [Shop stock guard](../../packages/api/src/routers/shop-product-config.ts#L239)

### Approval and publication

Warehouse/Shop may submit requests for brands, structured Variant Options, and Core Identities. Submission creates a pending request; approval creates the actual catalog entity and stores the created entity ID/snapshot with reviewer information in a transaction. Rejection changes the request status. Identity issuance therefore belongs to actual approved entity creation, not merely to request submission. [Submission](../../packages/api/src/routers/catalog-approval-request.ts#L367), [approval transaction](../../packages/api/src/routers/catalog-approval-request.ts#L284), [rejection](../../packages/api/src/routers/catalog-approval-request.ts#L590)

An actual Admin product can exist before public publication. Public reference-product completeness requires active eligible canonical variants and positive brand-specific prices; it is stricter than creation/editability. New permanent product IDs should therefore not depend on becoming public or receiving initial stock. [Completeness guard](../../packages/api/src/routers/helpers/reference-product-catalog.ts#L155)

## Identifier generation currently in use

Several incompatible meanings are currently labeled SKU:

- Setup codes are allocated with `MAX(existing code) + 1`, scoped to the parent and capped at 99 or 999. The helper does not itself lock allocation. [Allocator](../../packages/api/src/routers/helpers/generate-sku.ts#L36)
- A 15-digit hierarchy composition helper defines `TT-CCC-SSS-PPP-BB-VV`. Repository search found its definitions but no production call to `composeSku` or `parseSku` in the API/web code inspected; its documentation must not be mistaken for the active product creation mechanism. [Composition helper](../../packages/api/src/routers/helpers/generate-sku.ts#L66)
- Admin Brand Products use a legacy category/subcategory slug prefix and a category product count. `userId` is accepted by the helper but is not included in its generated string. This is not a permanent uniqueness mechanism: concurrent creation or deletion can make a count-derived serial repeat. `product.sku` has no unique constraint in the schema. [Allocation call](../../packages/api/src/routers/admin-product-config.ts#L538), [legacy generator](../../packages/api/src/routers/helpers/generate-sku.ts#L187), [product SKU field](../../packages/db/src/schema/product.ts#L86)
- Generated Admin variants use `CP-{productId}-B{brandId}-VO-{optionId}`. Warehouse/Shop variants use `WH-...` / `SHOP-...` technical strings, while owner product SKUs include a six-character prefix of the owner ID. These are implementation-oriented references rather than the client's readable example. [Admin variant](../../packages/api/src/routers/helpers/sync-generated-variants.ts#L223), [Warehouse variant](../../packages/api/src/routers/warehouse.ts#L8658), [Shop product](../../packages/api/src/routers/shop-product-config.ts#L680), [Shop variant](../../packages/api/src/routers/shop-product-config.ts#L342)
- `catalog_variant.global_sku` uses a PostgreSQL sequence and a unique index. It is a canonical identity string, closer in purpose to the proposed INV than to a descriptive human SKU. `classification_code` and `preferred_local_sku` exist as additional fields, but they are not equivalent to a completed canonical readable-SKU creation flow. [Catalog schema](../../packages/db/src/schema/catalog-variant.ts#L29), [Owner Variant alias](../../packages/db/src/schema/product-variant.ts#L229)

## Critical gaps against the client reference

### 1. Color + size is not a canonical multidimensional identity

A structured option can represent `Size 40`; Warehouse can attach `Black` or `White` to an Owner Variant. However, canonical linking ignores color and only selects core/brand/option. The `catalog_variant` unique constraints also omit color and any independent attribute combination. [Definition type](../../packages/db/src/variant-definition.ts#L5), [local color/size](../../packages/db/src/schema/product-variant.ts#L120), [canonical uniqueness](../../packages/db/src/schema/catalog-variant.ts#L66), [linking](../../packages/api/src/routers/helpers/sync-generated-variants.ts#L149)

The precise consequence depends on scope: two colors in different owner products can resolve to the same color-blind Catalog Variant. Two active colors under the **same** product should instead fail the canonical-link operation on a fully migrated database, because migration 0037 has a unique index on `(product_id, catalog_variant_id)` for active variants. This SQL-only index is absent from the current Drizzle `product-variant.ts` declaration. That is a migration/schema parity gap; it is not evidence that two active same-product rows can silently coexist. [SQL index](../../packages/db/src/migrations/0037_global_catalog_variant_foundation.sql#L112), [Drizzle table declaration](../../packages/db/src/schema/product-variant.ts#L72)

The current Warehouse product edit adapter also maps option/exchange settings without color, so API support alone does not establish a complete color editor. Admin/Shop selection permits one instance per option. A text value such as `Black / 40` could be stuffed into a single attribute value, but would not provide normalized Color and Size axes or reliable independent filtering. [Warehouse edit adapter](../../apps/web/app/warehouse/(management)/dashboard/products/%5BproductId%5D/edit/page.tsx#L69), [Admin duplicate-option guard](../../packages/api/src/routers/product.ts#L770), [Shop option map](../../packages/api/src/routers/shop-product-config.ts#L228)

### 2. Product Type is only partially protected

Core-managed Admin product editing preserves existing category/subcategory/core/brand fields. Nevertheless, Category editing can change `typeId`, Core Identity editing directly replaces category/subcategory fields, and Subcategory editing can move to another category. A product has no immutable direct Type assignment, so upstream edits can change its effective Type or make copied classifications disagree. [Admin product guard](../../packages/api/src/routers/product.ts#L818), [Category reassignment](../../packages/api/src/routers/category.ts#L260), [Core update](../../packages/api/src/routers/admin-core-product.ts#L436), [Subcategory reassignment](../../packages/api/src/routers/admin-subcategory.ts#L285)

Preventing Type edits in one form is therefore insufficient. A permanent Type invariant must cover setup edits, core edits, direct APIs, background scripts, and database writes.

### 3. Permanent identity conflicts with legacy replacement and force deletion

Normal core-managed option synchronization preserves rows, and normal Admin product deletion deactivates its product/variants. The standalone legacy product update path still deletes/recreates generated variants. An Admin `force: true` delete path explicitly removes order, invoice, and estimate lines before hard-deleting the product; its comment describes test-data cleanup. Those paths require explicit retirement or development-only isolation when permanent IDs become contractual. [Legacy replacement](../../packages/api/src/routers/product.ts#L899), [deactivation and force delete](../../packages/api/src/routers/product.ts#L964)

Used structured options already block structural changes and deletion, except for a legacy-definition upgrade path. Core deletion blocks linked products, and category/subcategory deletion guards references. These are useful starting points, but they do not jointly enforce immutable SYS/INV assignments or immutable Product Type. [Option guard](../../packages/api/src/routers/admin-variant-option.ts#L247), [Core deletion](../../packages/api/src/routers/admin-core-product.ts#L512), [Subcategory deletion](../../packages/api/src/routers/admin-subcategory.ts#L343)

### 4. Naming SYS requires an explicit entity decision

| Candidate for SYS | What it would identify | Main consequence |
| --- | --- | --- |
| Existing Core Identity | Generic shared product root across brands and owners | Fits the unbranded `Sports Shoe` example, but two brands share the same SYS and the root is not the actual owner product record. |
| Existing `product` row | One owner's Brand Product | Minimal schema change and an exact record identity, but the same branded item has different SYS values in Admin and each owner. |
| New canonical branded product/model | One shared product model for one core and brand; Owner Products reference it | Provides a shared SYS across owners and a natural parent for exact variants, but adds an explicit domain aggregate and requires migration. |

These tradeoffs follow from the existing owner-scoped product uniqueness and shared Catalog Variant identity. The client reference alone does not select one. [Current owner uniqueness](../../packages/db/src/schema/product.ts#L197), [shared variant identity](../../packages/db/src/schema/catalog-variant.ts#L35)

**Recommendation:** if SYS is intended to mean the same commercial product across the whole marketplace, introduce a canonical branded product/model and issue SYS there. Keep existing Owner Product records for local names, prices, publication, and rules. If SYS is explicitly a per-owner database record code, attach it to `product` instead and document that different owners receive different SYS values. Do not silently equate the brand-neutral Core Identity with the existing Brand Product.

The model also needs an agreed product granularity: one brand may sell multiple distinct sports-shoe models. A generic core named only `Sports Shoe` plus brand would permit only one product per owner for that pair under current uniqueness. Either each Core Identity must represent a particular model/family, or the canonical branded product must include another model discriminator. This is a scope decision to settle with concrete catalog examples, not a cosmetic naming choice.

## Recommended implementation requirements

These are proposed engineering requirements derived from the gaps, subject to the SYS/INV scope decisions in the main specification.

1. **Canonical variant combinations:** represent the complete normalized choice tuple—such as Color=Black, Size system=EU, Size=40—together with packaging/measurement where relevant. Store a stable canonical key with database uniqueness; different attribute order must not create a duplicate. Keep existing operational unit semantics for weight, loose quantities, LPG, cartons, and pairs.
2. **Exact identity across all creation paths:** use one server service for resolving/creating canonical products and variants. Admin creation, Admin configuration, Warehouse configuration, Shop configuration, approved requests, imports, and clone/repair flows must use it. Owners must select the complete combination and preserve it in edits, stock receiving, purchase/sales selection, and catalog matching.
3. **Immutable Type:** assign/freeze Type at canonical product creation. Enforce it below the UI; block referenced Category moves across Types and any conflicting Core or product reassignment. Permit labels and non-identity metadata to change without regenerating identifiers. A true change of identity creates a new entity with explicit lineage.
4. **SYS allocation:** issue one server-generated unique permanent code at the selected product entity's creation, including draft creation. Do not derive permanence from product name, current category path, row count, or an owner-ID substring. Use database uniqueness and an allocation mechanism safe under concurrency. Never reuse an issued code; gaps are acceptable.
5. **INV scope:** preferred marketplace interpretation is one globally shared code for the complete exact canonical variant, with stock quantities still held independently per owner/location. If the client instead wants an owner-specific stock record code, preserve a separate global variant identity and explicitly label the owner-specific code's scope. Never merge owner balances because they share INV.
6. **Format contract:** define SYS/INV digit width, leading-zero behavior, exhaustion handling, and whether INV includes a frozen Type prefix. The example alone does not establish that `03` should be remapped to Footwear or that Category/Subcategory must be encoded. Keep codes as strings in APIs, forms, exports, and search.
7. **Readable SKU:** define a platform canonical readable SKU and, only if needed, separate optional owner aliases. Include enough product/model and variant context to avoid two different shoes producing the same `APX-SHOE-BLK-42`; handle collisions with a stable suffix and a unique constraint. Brand/name edits must not silently regenerate an issued code. Keep old SKUs searchable as aliases during migration.
8. **Lifecycle and legacy:** preserve SYS/INV on deactivation/reactivation and normal stock changes. Inventory depletion must not delete identity. Remove destructive replacement paths from supported product editing; quarantine historical records that cannot be mapped unambiguously rather than guessing from names or raw `size` strings. Preserve transaction snapshots and references.
9. **Database parity:** codify active canonical uniqueness and all new invariants in both migrations and the maintained schema representation, including tests that run with the real constraints. Preserve the existing inventory ownership and B2B source/target identity guards. [Existing guards](../../packages/db/src/migrations/0038_canonical_inventory_guards.sql#L5)

## Acceptance cases for this workstream

- Creating one product model and four combinations from the client's example produces one SYS and four distinct INV values under the shared-product interpretation. Black/40 and White/40 can coexist in one product.
- Two owners configuring the same canonical product/combination share SYS/INV under that interpretation, but keep separate Owner Product, Owner Variant, and stock rows. Receiving 25 pairs for owner A must not change owner B's stock.
- The Admin, Warehouse, and Shop forms preserve Color+Size on save/reopen. Case or selection order changes do not duplicate the same combination.
- Multiple distinct shoe models from the same brand remain distinct even if color/size match. EU40 is not implicitly treated as UK40.
- Removing/reselecting a brand or variant preserves all identifiers and history. Live stock/reservations prevent invalid removal.
- Concurrent creation cannot allocate duplicate SYS/INV/SKU or duplicate canonical combinations. Retried creation requests do not create another logical product.
- Attempts to move a referenced Category to another Type, reclassify the core across Types, or mutate the product's frozen Type fail consistently through APIs and database constraints.
- A display-name/category-label change leaves issued SYS/INV and existing transaction snapshots intact.
- A legacy color-blind canonical identity is split only with an explicit verified mapping; orders and stock are not reassigned by string similarity.
- Stockless draft products receive identity; pending approval requests do not claim an approved product identity. Public publication still requires the existing complete variant/reference-price rules.

## Remaining decisions

The main software requirement should record chosen defaults and clearly flag these unresolved client semantics: SYS scope; shared versus owner-specific INV; product/model granularity under a core; exact INV segmentation and Type-code mapping; canonical versus owner-specific SKU uniqueness; and whether SKU changes are permitted with permanent alias history. None of these requires a destructive implementation to be performed during this research task.
