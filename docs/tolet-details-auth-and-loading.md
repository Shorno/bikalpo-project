# To-Let details access and loading

Listing details now check the same server-side session helper as the account
layout, before fetching/rendering the listing. Guests redirect to the existing
login page with an encoded return destination. This covers the regular listing,
QR listing wrapper (including its token), and legacy numeric details routes.
Consumer login already honors safe same-origin return paths.

Authenticated details routes are dynamic, not shared full-page cache entries;
robots indexing is disabled. The normal listing route now reuses the existing
ListingDetailSkeleton as a route-level loading boundary.

This is page access control, not a new privacy classification for public catalog
data. Existing public marketplace/QR API endpoints and public cards remain public.
The property QR directory and landing page remain usable by guests.

## Comparison against product flows

- Main homepage and To-Let landing are async Server Components using the same
  public oRPC server fetch wrapper and configured 60-second data revalidation.
- Both start independent data calls in parallel. To-Let uses allSettled to handle
  partial errors; homepage uses Promise.all.
- Products browse uses section-level Suspense boundaries for filters/grid.
  To-Let landing awaits both initial calls before returning its page content,
  with a route-level loading skeleton instead of independent section streaming.
- To-Let uses eight paginated landing results plus a separate capped catalog
  sample (up to 300 listings) for stats/categories/map. Separate aggregate and
  compact map APIs would reduce the unnecessary payload.
- To-Let browse has server pagination and URL-preserving search/type filters.
- Listing carousel remote images explicitly bypass Next image optimization.
  Responsive image delivery and per-card carousel JS need a separate performance
  pass; using next/image alone does not prove image optimization is active.
- No measured production Lighthouse/Core Web Vitals comparison was performed.

Guest browser checks: regular LST-100003, QR-token listing and legacy /123 all
redirected to login with correct return URLs and no Request Booking content.
No authenticated account or business data was changed during verification.
