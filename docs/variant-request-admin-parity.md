# Variant Request and Admin Parity

## Decision

Admin direct creation and Warehouse/Shop Owner requests use one structured
Variant Option contract:

- required Product Type and optional Category;
- a `measurement`, `loose`, or `attribute` definition;
- an optional display alias;
- server-defaulted sort order `0`;
- derived canonical label, signature, operational unit, and inventory behavior.

The shared API creation service validates scope, derives projections, checks
canonical-signature uniqueness, allocates the scoped SKU, and inserts the
Variant Option. Request approval calls the same service inside the approval
transaction.

## Previous mismatch

The Warehouse request form used the obsolete `name`, `unit`, `size`, and
`pack | loose` payload and permitted a Global scope. The approval path copied
those fields directly into `variant_option`, leaving the structured definition
columns empty. Inventory resolution correctly rejects such a row because its
operational semantics cannot be known safely.

Shop Owners previously had no persistent Variant request flow. The apparent
setup dialog only displayed a success toast and did not create a request.

## Compatibility policy

Pending legacy request JSON remains readable as historical evidence. Admin
must replace it with a complete structured definition before approval; the
application never guesses whether a legacy Pack/Unit value represented an
attribute, measured container, or something else.

Existing unstructured Variant Options are retained. Migration `0046` marks
missing or invalid definitions as `needs_review = true`, preserving Product,
stock, price, and history references for explicit Admin review.

## Source locations

- Shared editor: `apps/web/components/features/variant-option/components/variant-definition-editor.tsx`
- Admin dialog: `apps/web/components/features/variant-option/components/variant-option-dialog.tsx`
- Request form: `apps/web/components/catalog-approval/variant-request-modal.tsx`
- API service: `packages/api/src/routers/helpers/structured-variant-option.ts`
- Request/approval router: `packages/api/src/routers/catalog-approval-request.ts`
- Definition and inventory semantics: `packages/db/src/variant-definition.ts`
