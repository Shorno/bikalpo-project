import { ArrowRight, Eye, Phone } from "lucide-react";
import Link from "next/link";
import { ListingImageCarousel } from "./listing-image-carousel";

export interface PublicUnitListing {
  listingCode: string;
  marketplaceStatus: "available" | "booked";
  marketplaceVisibleUntil: string | Date | null;
  title: string;
  description: string | null;
  monthlyRent: number | null;
  availableFrom: string;
  imageUrls: string[];
  viewCount: number;
  location: string;
  contact?: {
    phone: string;
  };
  property: {
    name: string;
    nearbyLandmark?: string | null;
  };
  unit: {
    name: string;
    unitType: string;
    bedrooms: number;
    bathrooms: number;
    balconies: number;
    sizeSqFt: number;
  };
}

interface PublicUnitListingCardProps {
  listing: PublicUnitListing;
  href?: string | null;
  phone?: string;
}

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function PublicUnitListingCard({
  listing,
  href,
  phone,
}: PublicUnitListingCardProps) {
  const detailHref =
    href === undefined ? `/to-let/listings/${listing.listingCode}` : href;
  const contactPhone = phone ?? listing.contact?.phone;
  const isBooked = listing.marketplaceStatus === "booked";
  const unitType = humanize(listing.unit.unitType);
  const isGarage = listing.unit.unitType === "garage";
  const unitSummary = isGarage
    ? "GARAGE / PARKING"
    : `${unitType} (${listing.unit.sizeSqFt.toLocaleString("en-BD")} Sq.ft)`;
  const location =
    isGarage && listing.property.nearbyLandmark?.trim()
      ? `${listing.property.nearbyLandmark.trim()} (${listing.property.name})`
      : listing.location;
  const rooms = [
    listing.unit.bedrooms > 0 ? `${listing.unit.bedrooms} Bed` : null,
    listing.unit.bathrooms > 0 ? `${listing.unit.bathrooms} Bathroom` : null,
    listing.unit.balconies > 0 ? `${listing.unit.balconies} Balcony` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const generatedDefaultTitle = `${listing.property.name} - ${listing.unit.name}`;
  const displayTitle =
    listing.title.trim().localeCompare(generatedDefaultTitle, undefined, {
      sensitivity: "base",
    }) === 0
      ? listing.unit.name
      : listing.title;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white transition-colors hover:border-blue-300 focus-within:border-blue-500">
      <div className="relative">
        <ListingImageCarousel
          imageUrls={listing.imageUrls}
          alt={displayTitle}
          galleryHref={detailHref}
          className="border-b border-zinc-200"
        />
        <span
          className={`pointer-events-none absolute top-3 left-3 z-10 rounded-md px-2.5 py-1.5 text-xs font-semibold ${isBooked ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
        >
          {isBooked ? "Booked" : "Book Now"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-zinc-500">
            <Eye className="size-3.5" aria-hidden="true" />
            {listing.viewCount.toLocaleString("en-BD")} views
          </span>
          <span className="text-xs tabular-nums text-zinc-500">
            ID: {listing.listingCode}
          </span>
        </div>

        <div className="mt-3">
          <p className="text-lg font-semibold tabular-nums text-zinc-950">
            {listing.monthlyRent === null
              ? "— — —"
              : `৳${listing.monthlyRent.toLocaleString("en-BD")}`}
            <span className="ml-1 text-xs font-normal text-zinc-500">
              / Month
            </span>
            {listing.monthlyRent === null && (
              <span className="sr-only">Rent hidden by owner</span>
            )}
          </p>
          <h3 className="mt-1 text-sm font-semibold leading-5 text-zinc-950">
            {detailHref ? (
              <Link
                href={detailHref}
                className="rounded-sm hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {unitSummary}
              </Link>
            ) : (
              unitSummary
            )}
          </h3>
        </div>

        {!isGarage && rooms ? (
          <p className="mt-1 text-xs leading-5 text-zinc-600">· {rooms}</p>
        ) : null}
        <p className="mt-2 mb-4 line-clamp-2 break-words text-xs leading-5 text-zinc-600">
          {location}
        </p>

        <div
          className={`mt-auto grid gap-2 border-t border-zinc-200 pt-3 ${
            !isBooked && contactPhone ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {!isBooked && contactPhone ? (
            <a
              href={`tel:${contactPhone}`}
              aria-label={`Call about ${displayTitle}`}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-900 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <Phone className="size-3.5" /> Call
            </a>
          ) : !isBooked ? (
            <span className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-500">
              Contact unavailable
            </span>
          ) : null}

          {detailHref ? (
            <Link
              href={detailHref}
              aria-label={`View details for ${displayTitle}`}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              View Details <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <span className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500">
              Details unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
