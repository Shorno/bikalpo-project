# Public To-Let details: consumer document alignment

Source: `CONSUMER.pdf` supplied on 2026-09-09, all five pages read and rendered for visual review. The relevant details layout is on pages 2-4; page 1 is My Bookings and page 5 is Create To-Let Alert.

Scope: `/to-let/listings/[listingCode]`, opened from a public listing's View Details action. This is not the authenticated booking details page.

## Reading order

1. Gallery and thumbnails alongside Property Name, Location, Unit ID, Unit Name, Category, Views, Size, Monthly Rent, Status, and date.
2. Overview pairs: Unit Name / Number and Unit Category; Floor Number and Unit Size; Balcony and Bathrooms; Drawing Room and Dining Space; Kitchen and Preferred Tenant. Unit Description follows, then the date and Listing Status.
3. Facilities pairs: Water Supply / Gas Connection; Electricity / Internet; Lift / Parking; Generator / Security; CCTV / Furnished. Other Facilities follows, including a truthful empty state.
4. Rent pairs: Rent / Advance; Security Deposit / Service Charge; Parking / Utility Bill. Payment Method follows. Charge amounts and inclusion flags are separate facts, so an included charge does not replace its visible numeric amount.
5. Existing supplementary property/contact/map/video information remains after the document-ordered sections. Bedrooms and publication/visibility dates remain available here rather than interrupting the specified Overview order.

Mobile uses the same DOM reading order in a single column. The gallery remains interactive; public fetching remains server-side with the existing 30-second revalidation.

## Developer-note boundaries

- Public visitors are not the current tenant. Keep Request Booking / Call rather than exposing Leave or tenant-only payment/review actions. Booked listings remain closed to new requests.
- Use Available From for an unbooked listing; use the actual Booked On date for a booked listing. Do not invent a booking date or present a public visitor as booked.
- Owner-hidden price values are already redacted to null by the public API. Render those values blank, including the hero price; never retrieve private contract prices to populate a public cache.
- Leave, moving-out access expiry, rental history, comments, and monthly payment OTP verification belong to the authenticated rental workflow. This change neither implements nor certifies that separate workflow.
- The PDF's "Relevant Cart" label provides no card contents or selection behavior. Do not invent related-card functionality in this ordering change.
- The gallery/summary component's document ordering is opt-in, so existing booking-detail consumers keep their current layout.

## Verification

- Desktop (1440 px) and mobile (390 px): HTTP 200, expected summary and Overview label order, two-column/single-column rent layout, no horizontal overflow, and no browser page exceptions.
- Booked public listing: Booked On retained; tenant-only Leave not exposed.
- Both viewport screenshots visually reviewed against PDF pages 2-4.
- 15 alert/marketplace visibility tests passed. Full web type-check still fails on React ref type incompatibilities in shared calendar/field/skeleton components; no diagnostics were reported in the two changed UI files. Production build not certified.
- No database migration, booking submission, Git commit, or GitHub push performed.
