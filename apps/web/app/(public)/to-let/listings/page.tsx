import Form from "next/form";
import Link from "next/link";
import { PublicUnitListingCard } from "@/components/features/to-let/public-unit-listing-card";
import { getPublicOrpcClient } from "@/lib/orpc/public-server";
import { parseToLetSearchParams, toLetBrowseHref, type ToLetMarketplaceSearchParams } from "@/lib/to-let-marketplace";
import { ToLetSearchButton } from "@/components/features/to-let/to-let-search-button";
import styles from "../to-let-mobile.module.css";

export const metadata = { title: "All To-Let listings | Bikalpo" };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<ToLetMarketplaceSearchParams & { page?: string | string[] }> }) {
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.min(10000, Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1));
  const { query: q, selectedType: type } = parseToLetSearchParams(params);
  const result = await getPublicOrpcClient(0).toLetUnitListing.listPublicPage({ page, limit: 12, q, type });
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  const href = (value: number) => toLetBrowseHref(q, type, value);
  return <div className={`${styles.landing} site-container px-4 py-8 sm:px-6 lg:px-8`}>
    <Link href="/to-let" className="inline-flex min-h-11 items-center text-primary">← Back to To-Let</Link>
    <h1 className="mt-4 text-3xl font-semibold">All To-Let listings</h1>
    <Form action="/to-let/listings" className="my-6 flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="listing-search">Search listings</label>
      <input id="listing-search" name="q" defaultValue={q} maxLength={200} placeholder="Location or property name" className="min-h-11 min-w-0 flex-1 rounded-md border bg-background px-3" />
      {type && <input type="hidden" name="type" value={type} />}
      <ToLetSearchButton className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-5 text-primary-foreground disabled:opacity-60" />
      {(q || type) && <Link className="inline-flex min-h-11 items-center text-primary" href="/to-let/listings">Clear filters</Link>}
    </Form>
    <p className="mb-5 text-sm text-muted-foreground">{result.total} matching listings</p>
    {result.listings.length ? <div className={`${styles.listings} grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4`}>{result.listings.map(listing => <PublicUnitListingCard key={listing.listingCode} listing={listing} />)}</div> : <p className="rounded-lg border p-8">No listings on this page. Try another search or return to the first page.</p>}
    <nav aria-label="Listing pages" className="mt-8 flex items-center justify-between gap-4">
      {page > 1 ? <Link className="inline-flex min-h-11 items-center text-primary" href={href(page - 1)}>Previous</Link> : <span />}
      <span>Page {page} / {pages}</span>
      {page < pages ? <Link className="inline-flex min-h-11 items-center text-primary" href={href(page + 1)}>Next</Link> : page > pages ? <Link href={href(1)}>First page</Link> : <span />}
    </nav>
  </div>;
}
