# Store policy pages

## Approved scope

Add basic static Return & Refund, Delivery Policy and Cancellation pages to every existing public store. Keep the independent shop header and footer. Use the current store's actual name and preserve customer preview mode in store navigation. Link the three pages from the shop footer; continue linking platform-wide Terms & Conditions and Privacy Policy.

Routes: `/stores/[slug]/policies/return-refund`, `/stores/[slug]/policies/delivery`, `/stores/[slug]/policies/cancellation`.

The copy is preliminary general guidance, consistent with existing placeholder company pages. Do not invent return windows, refund deadlines, delivery guarantees or additional transaction rules. Existing order and support destinations can be linked. No new cancellation, returns, refunds, messaging or policy-editing functionality is included.

Unknown policy IDs and stores unavailable through the public store API must show not found. API failures must propagate rather than being represented as missing stores.

## Validation

Check each page and its store context, footer links, desktop/mobile readability, preview-preserving URLs and missing-route handling. Run formatting, web type checking and the existing test suites. Existing React type conflicts in calendar, field and skeleton components are outside this change.
