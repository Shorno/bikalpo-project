import { ChevronLeft, ChevronRight } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { toLetCategoryLabel, toLetUnitTypes } from "@bikalpo-project/api/lib/tolet-categories";
import { PublicUnitListingCard } from "@/components/features/to-let/public-unit-listing-card";
import { getPublicOrpcClient } from "@/lib/orpc/public-server";
import { parseToLetSearchParams, toLetBrowseHref, type ToLetMarketplaceSearchParams } from "@/lib/to-let-marketplace";
import { ToLetSearchButton } from "@/components/features/to-let/to-let-search-button";
import { toLetChip, toLetChipRow, toLetPrimaryButton } from "@/components/features/to-let/to-let-button";
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
      <input id="listing-search" name="q" defaultValue={q} maxLength={200} placeholder="Location or property name" className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
      {type && <input type="hidden" name="type" value={type} />}
      <ToLetSearchButton className={`${toLetPrimaryButton} min-h-11 px-5`} />
      {(q || type) && <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline" href="/to-let/listings">Clear filters</Link>}
    </Form>
    <nav aria-label="Listing categories" className={`mb-5 flex gap-2 overflow-x-auto md:flex-wrap ${toLetChipRow}`}>
      {[undefined, ...toLetUnitTypes].map(category => (
        <Link
          key={category ?? "all"}
          href={toLetBrowseHref(q, category)}
          aria-current={type === category ? "page" : undefined}
          className={toLetChip(type === category)}
        >
          {category ? toLetCategoryLabel(category) : "All listings"}
        </Link>
      ))}
    </nav>
    <p className="mb-5 text-sm text-muted-foreground">{result.total} matching listings{type ? ` · ${toLetCategoryLabel(type)}` : ""}</p>
    {result.listings.length ? <div className="grid grid-cols-2 gap-x-2 gap-y-5 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">{result.listings.map(listing => <PublicUnitListingCard key={listing.listingCode} listing={listing} compactMobile />)}</div> : <p className="rounded-lg border p-8">No listings on this page. Try another search or return to the first page.</p>}
    <ListingPagination page={page} pages={pages} total={result.total} limit={result.limit} href={href} />
  </div>;
}

/** Page numbers to show: always the first and last, the current page and its neighbours. */
function pageWindow(page: number, pages: number): Array<number | "gap"> {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter(value => value >= 1 && value <= pages));
  const sorted = [...wanted].sort((left, right) => left - right);
  const items: Array<number | "gap"> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1]! > 1) items.push("gap");
    items.push(value);
  });
  return items;
}

const pagerArrow = "inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function ListingPagination({ page, pages, total, limit, href }: {
  page: number; pages: number; total: number; limit: number; href: (value: number) => string;
}) {
  if (total === 0) return null;
  if (page > pages) {
    return <div className="mt-8 flex justify-center">
      <Link href={href(1)} className={toLetPrimaryButton}>Go to the first page</Link>
    </div>;
  }
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return <nav aria-label="Listing pages" className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
    <p className="text-sm text-muted-foreground">
      Showing <span className="font-mono font-semibold tabular-nums text-foreground">{from}–{to}</span> of{" "}
      <span className="font-mono font-semibold tabular-nums text-foreground">{total}</span> listings
    </p>
    {pages > 1 ? <div className="flex items-center gap-1.5">
      {page > 1
        ? <Link href={href(page - 1)} rel="prev" className={pagerArrow} aria-label="Previous page"><ChevronLeft className="size-4" aria-hidden="true" /><span className="max-sm:sr-only">Previous</span></Link>
        : <span aria-disabled="true" className={`${pagerArrow} pointer-events-none opacity-40`}><ChevronLeft className="size-4" aria-hidden="true" /><span className="max-sm:sr-only">Previous</span></span>}
      {pageWindow(page, pages).map((item, index) => item === "gap"
        ? <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-sm text-muted-foreground">…</span>
        : <Link key={item} href={href(item)} aria-label={`Page ${item}`} aria-current={item === page ? "page" : undefined} className={`${toLetChip(item === page)} min-w-10 justify-center px-3 font-mono tabular-nums`}>{item}</Link>)}
      {page < pages
        ? <Link href={href(page + 1)} rel="next" className={pagerArrow} aria-label="Next page"><span className="max-sm:sr-only">Next</span><ChevronRight className="size-4" aria-hidden="true" /></Link>
        : <span aria-disabled="true" className={`${pagerArrow} pointer-events-none opacity-40`}><span className="max-sm:sr-only">Next</span><ChevronRight className="size-4" aria-hidden="true" /></span>}
    </div> : null}
  </nav>;
}
