import { LayoutGrid } from "lucide-react";
import { toLetPrimaryButton } from "@/components/features/to-let/to-let-button";
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
      <Link href={toLetBrowseHref(query, type)} className={`${toLetPrimaryButton} px-5`}>
        <LayoutGrid className="size-4" aria-hidden="true" />
        {category ? `See all ${category} listings` : "See all listings"}
      </Link>
    </div>
  </>;
}
