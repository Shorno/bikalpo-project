# Public and retailer layout separation

## Request

Keep the public site and individual retailer shops independently editable: each must own its header, navigation, and footer through separate reusable components, instead of selecting public/shop content conditionally by pathname. Preserve current URLs and behavior; the shop footer will receive its own design in a later task.

## Ownership

- Public pages, including `/` and `/stores`, use `app/(public)/layout.tsx` with `PublicHeader` and `PublicFooter`.
- `/stores/[slug]` and `/stores/[slug]/products/[productSlug]` live under the sibling `(retailer-storefront)` route group, using `stores/[slug]/layout.tsx` with `ShopHeader` and `ShopFooter`.
- Shop components live in `components/storefront/layout`: `ShopHeader`, `ShopNavigation`, `ShopSearch`, `ShopFooter`, an independent navigation list, and independent footer CSS.
- Root providers remain shared, so navigation between public and shop routes preserves cart/authentication infrastructure.
- The public header no longer recognizes or switches into store routes. The unrelated To-Let public header/footer variants retain their existing behavior.
- The older `app/shop/(storefront)` subdomain surface is separate from the retailer URLs in this request and keeps its existing customer navbar and public footer.

## Deliberate independence

The shop footer starts as a copy of the currently approved footer and owns its own content/composition/styles. This is deliberate duplication at a requested design boundary, so the forthcoming shop footer redesign cannot alter the public footer. The existing live seller-location widget and low-level cart/UI components are still reused. Shop menu configuration is likewise independent from public navigation, while preserving its current links. Do not recombine these into pathname switches merely because their initial content matches.

## Acceptance checks

- Original public, directory, retailer, and retailer-product URLs still resolve.
- Each route renders exactly one intended header and footer.
- Public pages have global search; retailer pages have shop-specific search and navigation.
- Shop search, preview mode, cart affordances, and product URLs retain their behavior.
- Typecheck, targeted formatting, route checks, and full available test suite are run; unrelated baseline failures are reported separately.

## Validation results

- HTTP checks returned 200 with one footer for `/`, `/stores`, `/stores/shorno-xyz`, and customer preview. Public and shop search controls matched their intended routes.
- Browser checks confirmed shop search filters products, retailer product preview hides the cart button, and following the footer home link restores the public header.
- Targeted Biome checks passed. The retailer URL tests passed.
- Full available test run plus an environment-corrected retry: 319 passed, 10 integration tests skipped. Eight API test files initially failed environment validation; all 37 tests in those files passed after loading the existing server environment.
- Route types regenerated successfully. Web typechecking remains blocked by existing React type conflicts in unchanged `calendar.tsx`, `field.tsx`, and `skeleton.tsx`; no changed-file errors remain.
