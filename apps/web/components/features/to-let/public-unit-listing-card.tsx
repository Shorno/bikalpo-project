import { ArrowRight, Bath, BedDouble, Eye, MapPin, Phone, Fence } from "lucide-react";
import Link from "next/link";
import { toLetCategoryLabel as humanize, toLetUnitCapabilities } from "@bikalpo-project/api/lib/tolet-categories";
import { ListingImageCarousel } from "./listing-image-carousel";
import styles from "./compact-listing-card.module.css";

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
  compactMobile?: boolean;
}

export function PublicUnitListingCard({
  listing,
  href,
  phone,
  compactMobile = false,
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
  const mobileArea = listing.location.split(",")[0]?.trim() || listing.location;
  const mobileUnitSummary = isGarage
    ? "Garage"
    : `${listing.unit.unitType === "warehouse" ? "Godown" : unitType} (${listing.unit.sizeSqFt.toLocaleString("en-BD")} S.F)`;
  const rooms = [
    { value: listing.unit.bedrooms, label: "Bed", mobileLabel: "Bed", icon: BedDouble },
    { value: listing.unit.bathrooms, label: "Bath", mobileLabel: "Bathroom", icon: Bath },
    { value: listing.unit.balconies, label: "Balcony", mobileLabel: "Balcony", icon: Fence },
  ].filter(({ value }) => value > 0);
  const isResidential = toLetUnitCapabilities(listing.unit.unitType).bedrooms;
  const generatedDefaultTitle = `${listing.property.name} - ${listing.unit.name}`;
  const displayTitle =
    listing.title.trim().localeCompare(generatedDefaultTitle, undefined, {
      sensitivity: "base",
    }) === 0
      ? listing.unit.name
      : listing.title;

  return (
    <article data-residential={isResidential || undefined} className={`${compactMobile ? styles.compact : ""} group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground transition-colors hover:border-primary/40 focus-within:border-primary`}>
      <div className="relative">
        <ListingImageCarousel
          imageUrls={listing.imageUrls}
          alt={displayTitle}
          galleryHref={detailHref}
          className="border-b border-border"
        />
        <span
          data-slot="booking-status"
          className={`pointer-events-none absolute top-3 left-3 z-10 rounded-md px-2.5 py-1.5 text-xs font-semibold ${isBooked ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
        >
          {isBooked ? "Booked" : "Book Now"}
        </span>
      </div>

      <div data-slot="card-body" className="flex flex-1 flex-col p-4 sm:p-5">
        <div data-slot="metadata" className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
            <Eye className="size-3.5" aria-hidden="true" />
            {listing.viewCount.toLocaleString("en-BD")} views
          </span>
          <span className="break-all text-xs tabular-nums text-muted-foreground">
            <MobileAlt compactMobile={compactMobile} desktop={`ID: ${listing.listingCode}`} mobile={listing.listingCode} />
          </span>
        </div>

        <div data-slot="summary" className="mt-4">
          <h3 className="text-sm font-semibold leading-6 text-foreground sm:text-base">
            {detailHref ? (
              <Link
                href={detailHref}
                className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <MobileAlt compactMobile={compactMobile} desktop={unitSummary} mobile={mobileUnitSummary} />
              </Link>
            ) : (
              <MobileAlt compactMobile={compactMobile} desktop={unitSummary} mobile={mobileUnitSummary} />
            )}
          </h3>
        </div>

        {!isGarage && rooms.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-muted-foreground" aria-label="Room details">
            {rooms.map(({ value, label, mobileLabel, icon: Icon }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <MobileAlt compactMobile={compactMobile} desktop={`${value} ${label}`} mobile={`${value} ${mobileLabel}`} />
              </li>
            ))}
          </ul>
        ) : null}
        <div data-slot="location" className="mt-3 mb-5 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground sm:text-sm">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p className="line-clamp-2 break-words"><MobileAlt compactMobile={compactMobile} desktop={location} mobile={mobileArea} /></p>
        </div>

        <div
          data-slot="actions"
          className={`mt-auto grid gap-2 border-t border-border pt-3 ${
            !isBooked && contactPhone ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {!isBooked && contactPhone ? (
            <a
              href={`tel:${contactPhone}`}
              aria-label={`Call about ${displayTitle}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Phone className="size-3.5" /> Call
            </a>
          ) : !isBooked ? (
            <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              Contact unavailable
            </span>
          ) : null}

          {detailHref ? (
            <Link
              href={detailHref}
              aria-label={`View details for ${displayTitle}`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              View Details <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
              Details unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function MobileAlt({ compactMobile, desktop, mobile }: { compactMobile: boolean; desktop: string; mobile: string }) {
  if (!compactMobile || desktop === mobile) return <span>{desktop}</span>;
  return <>
    <span className="md:hidden">{mobile}</span>
    <span className="hidden md:inline">{desktop}</span>
  </>;
}
