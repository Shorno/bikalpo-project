import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { toLetCategoryLabel } from "@bikalpo-project/api/lib/tolet-categories";
import { toLetBrowseHref, type ToLetMarketRentalType } from "@/lib/to-let-marketplace";
import { PublicUnitListingCard, type PublicUnitListing } from "./public-unit-listing-card";

export function LandingListingGrid({ initialListings, total, query, type }: {
  initialListings: PublicUnitListing[]; total: number; query: string; type?: ToLetMarketRentalType;
}) {
  const listings = initialListings.slice(0, type ? 4 : 8);
  const category = type ? toLetCategoryLabel(type) : "";
  return <>
    <div className="grid grid-cols-2 gap-x-2 gap-y-5 md:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map(listing => <PublicUnitListingCard key={listing.listingCode} listing={listing} compactMobile />)}
    </div>
    <div className="mt-6 flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">Showing {listings.length} of {total} listings</p>
      <Link href={toLetBrowseHref(query, type)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {category ? `See all ${category} listings` : "See all listings"}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  </>;
}
