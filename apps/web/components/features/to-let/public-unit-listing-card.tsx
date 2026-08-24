import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  MapPin,
  Phone,
  Ruler,
} from "lucide-react";
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
  location: string;
  contact?: {
    phone: string;
  };
  property: {
    name: string;
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

function todayInDhaka() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
  const today = todayInDhaka();
  const isAvailableNow = listing.availableFrom <= today;
  const availabilityLabel = isAvailableNow
    ? "Available now"
    : `Available from ${new Intl.DateTimeFormat("en-BD", {
        day: "numeric",
        month: "short",
      }).format(new Date(`${listing.availableFrom}T00:00:00`))}`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-primary/40">
      <ListingImageCarousel
        imageUrls={listing.imageUrls}
        alt={listing.title}
        galleryHref={detailHref}
      />

      <div className="flex flex-1 flex-col space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              isBooked
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {isBooked ? "Booked" : "Available"}
          </span>
          <span className="font-mono text-xs font-medium tabular-nums text-muted-foreground">
            {listing.listingCode}
          </span>
        </div>

        <div>
          <p className="flex items-center gap-1 text-xs font-medium text-primary">
            <Building2 className="size-3.5" /> {humanize(listing.unit.unitType)}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            {listing.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {listing.property.name} / {listing.unit.name}
          </p>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {isBooked ? "No new booking requests" : availabilityLabel}
          </p>
        </div>

        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{listing.location}</span>
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {listing.unit.bedrooms > 0 ? (
            <span className="flex items-center gap-1">
              <BedDouble className="h-4 w-4" /> {listing.unit.bedrooms} bed
            </span>
          ) : null}
          {listing.unit.bathrooms > 0 ? (
            <span className="flex items-center gap-1">
              <Bath className="h-4 w-4" /> {listing.unit.bathrooms} bath
            </span>
          ) : null}
          {listing.unit.balconies > 0 ? (
            <span>{listing.unit.balconies} balcony</span>
          ) : null}
          <span className="flex items-center gap-1">
            <Ruler className="h-4 w-4" />{" "}
            {listing.unit.sizeSqFt.toLocaleString()} sq ft
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between border-t border-border pt-3">
          <div>
            <p className="font-mono text-lg font-semibold tabular-nums text-emerald-700">
              {listing.monthlyRent === null
                ? "Price hidden"
                : `৳${listing.monthlyRent.toLocaleString("en-BD")}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {listing.monthlyRent === null
                ? "Owner visibility setting"
                : "per month"}
            </p>
          </div>
        </div>

        <div
          className={`grid gap-2 border-t border-border pt-3 ${
            !isBooked && contactPhone ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {!isBooked && contactPhone ? (
            <a
              href={`tel:${contactPhone}`}
              aria-label={`Call about ${listing.title}`}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Phone className="size-3.5" /> Call
            </a>
          ) : !isBooked ? (
            <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
              Contact unavailable
            </span>
          ) : null}

          {detailHref ? (
            <Link
              href={detailHref}
              prefetch={false}
              aria-label={`View details for ${listing.title}`}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              View Details <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center justify-center rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
              Details unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
