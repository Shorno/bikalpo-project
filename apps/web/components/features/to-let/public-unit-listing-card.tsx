import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
} from "lucide-react";
import Link from "next/link";
import { ListingImageCarousel } from "./listing-image-carousel";

export interface PublicUnitListing {
  listingCode: string;
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

function whatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `88${digits}` : digits;
}

export function PublicUnitListingCard({
  listing,
  href,
  phone,
}: PublicUnitListingCardProps) {
  const detailHref =
    href === undefined ? `/to-let/listings/${listing.listingCode}` : href;
  const contactPhone = phone ?? listing.contact?.phone;
  const today = new Date().toISOString().slice(0, 10);
  const isAvailableNow = listing.availableFrom <= today;
  const availabilityLabel = isAvailableNow
    ? "Available now"
    : `Available from ${new Intl.DateTimeFormat("en-BD", {
        day: "numeric",
        month: "short",
      }).format(new Date(`${listing.availableFrom}T00:00:00`))}`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      <ListingImageCarousel imageUrls={listing.imageUrls} alt={listing.title} />

      <div className="flex flex-1 flex-col space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {availabilityLabel}
          </span>
          <span className="text-xs font-medium text-gray-500">
            {listing.listingCode}
          </span>
        </div>

        <div>
          <p className="flex items-center gap-1 text-xs font-medium text-blue-600">
            <Building2 className="size-3.5" /> {humanize(listing.unit.unitType)}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-gray-900">
            {listing.title}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {listing.property.name} / {listing.unit.name}
          </p>
        </div>

        <p className="flex items-center gap-1 text-sm text-gray-500">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="truncate">{listing.location}</span>
        </p>

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600">
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

        <div className="mt-auto flex items-end justify-between border-t border-gray-100 pt-3">
          <div>
            <p className="text-lg font-bold text-emerald-600">
              {listing.monthlyRent === null
                ? "Price hidden"
                : `৳${listing.monthlyRent.toLocaleString("en-BD")}`}
            </p>
            <p className="text-xs text-gray-500">
              {listing.monthlyRent === null
                ? "Owner visibility setting"
                : "per month"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
          {contactPhone ? (
            <a
              href={`tel:${contactPhone}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Phone className="size-3.5" /> Call
            </a>
          ) : (
            <span className="inline-flex items-center justify-center rounded-lg border border-gray-100 px-3 py-2 text-xs font-semibold text-gray-400">
              Contact unavailable
            </span>
          )}

          {detailHref ? (
            <Link
              href={detailHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              View Details <ArrowRight className="size-3.5" />
            </Link>
          ) : contactPhone ? (
            <a
              href={`https://wa.me/${whatsAppPhone(contactPhone)}?text=${encodeURIComponent(`I am interested in ${listing.listingCode}: ${listing.title}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </a>
          ) : (
            <span className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-400">
              Details unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
