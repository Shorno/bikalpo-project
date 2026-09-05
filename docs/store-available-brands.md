# Available brands in a retailer store

## Approved scope

Show brand names, with logos when available, from a store's full available catalog. Deduplicate the list and link to it from the store footer. Hide both the section and footer link when there are no brands. Preserve store identity and customer preview when following the link from product detail pages. No new brand filters, tables, review/messaging features or changes to the public footer.

## Implementation

- The existing storefront identity query now returns `availableBrands` from an inventory projection scoped to the approved shop. It has no catalog search, category, sort or pagination inputs.
- Brand eligibility and catalog eligibility share `isAvailableRetailerStock`: active variant, active/public shop-owned product, not scheduled in the future, positive stock and positive retail price.
- Use the generated shop product's existing brand relation. Deduplicate by brand ID, preserve saved names/logos and sort by name. Existing brand associations remain visible even if new association with that brand is disabled, matching the brand model's documented behavior.
- Store header, footer and brand section reuse the same query cache. The section follows the product catalog, uses a wrapping text/logo list and contains no misleading filter controls. Missing/failed logos fall back to the brand name.
- Footer uses the native store-root `#available-brands` anchor, preserving preview. The section scrolls to its anchor after asynchronous data arrives and accounts for the sticky header.
- Inherit the existing shop typography, flat white content surface, slate divider/text and aqua/blue footer. No global design changes.

## Validation

Targeted tests cover 18 brands beyond one product page, duplicate variants, ordering/logo identity, missing brand data, unavailable/private/future/foreign stock, scheduling boundaries and preview anchor URLs. Browser verification checks actual brand names, persistence during catalog filtering, product-page anchor navigation and responsive wrapping. Full suite: 325 passed, 10 integration tests skipped. Web typechecking reports only the existing React type conflicts in unchanged calendar/field/skeleton components.

Review caught Next's optimized-image restriction for saved logo URLs. Brand logos use `Image unoptimized` with lazy loading, fixed dimensions and an error fallback; installed Next image-props checks confirm malformed-relative and nonallowlisted external sources do not throw before the fallback can run.
