# Store footer: existing-capability implementation

## Scope

User approved implementing the supplied shop footer structure using existing capabilities only, following `store-footer-requirements-research.md`. The client diagram is reference material; missing messaging, brand/review sections, store policies, store-bound requests/reporting, guest tracking and app downloads are not authorized new features.

## Implemented boundary

- Separate shop footer uses the established aqua `#e4f3ef` surface throughout with blue `#2455c6` headings; its former blue rule and copyright bar have been removed to match the shared public treatment.
- About Store and Our Products link to real store-root anchors, including from product pages and with preview mode preserved. Initial asynchronous store loading handles the requested anchor after content mounts.
- Customer support uses accurate existing destinations: Support tickets `/account/support`, Track order `/account/track`, My item requests `/account/requests`. These retain existing authentication and account scope.
- Policies links only to the existing global Terms page; no placeholder store policies or legal copy are created.
- Existing navigation identity API now explicitly selects approved business registration contact channels, along with public phone/hours. It never publishes the whole application or falls back to login email. Generated phone-auth email placeholders are excluded.
- Only provided HTTP(S) social URLs appear. No new social fields/settings are introduced. Missing business email/socials are omitted; app icons remain clearly non-interactive Coming soon placeholders.
- Footer shows real store phone, provided business email, store page link, hours, dynamic year/store name and Powered by Bikalpo. When store data is unavailable, an explicitly labelled demo contact set keeps the preview populated without presenting sample values as real. Platform Home, All Stores, Help Center, Contact Us remain separate.
- Mobile stacks the sections, uses at least 44px link targets and a two-column platform menu. Long contact text wraps; fetch loading/failure does not invent store data.

## Design notes

These local decisions describe the built shop footer in `shop-footer.module.css`.

- The aqua/blue palette above pairs dark ink (`#244459`) with muted text (`#466572`) and blue headings. The entire footer, including copyright, is one uninterrupted aqua surface with no framing divider.
- Desktop uses three equal columns with a 3rem gap inside a centered 80rem container, 2rem side padding and 2.5rem top padding. Secondary groups have 2rem top spacing.
- At 767px and below, columns stack with 1.75rem gaps and no dividing rules; side padding becomes 1rem, top padding 2rem and secondary spacing 1.25rem. Platform links form two columns; copyright stacks and aligns left.
- Typography inherits the page font: body and headings are 1rem with 1.6 line height; headings use weight 650. App notes are 0.75rem and copyright is 0.875rem.
- Links underline on hover; keyboard focus uses a 2px current-color outline offset by 4px. Mobile and coarse-pointer links have a minimum 44px height. Social controls are 2.75rem square; social and app outlines have 6px corners.

## Validation

- Targeted link/preview/security tests passed; full suite: 321 passed, 10 integration tests skipped.
- Biome checks and design detector passed for footer files. Web typecheck still reports existing duplicate React type errors in unchanged calendar/field/skeleton components; no changed-file errors.
- Browser inspection covers desktop/mobile rendering, real contacts with placeholder email excluded, product-to-store anchor routing, and preview preservation.

## Deliberate omissions

Available Brands, Store Reviews, Message Seller, a generic contextual Report Issue action, store-specific item requests and store policy links are omitted because their corresponding public features do not exist. Final app URLs, platform policy/help/contact text and additional seller social channels remain outside this change.
