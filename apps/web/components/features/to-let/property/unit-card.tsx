"use client";

import {
  Bath,
  BedDouble,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers3,
  MapPin,
  Megaphone,
  PlayCircle,
  Ruler,
  Share2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useMarkToLetUnitRented } from "@/hooks/use-to-let-property-api";
import { UnitStatusBadge } from "./property-ui";
import { humanize, type ToLetUnitView } from "./types";

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(query.matches);
    updatePreference();
    query.addEventListener("change", updatePreference);
    return () => query.removeEventListener("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

function formatRent(value: number) {
  return `\u09F3${value.toLocaleString("en-BD")}`;
}

function formatFloorLabel(floorNumber: number) {
  if (floorNumber === 0) return "Ground Floor";
  if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;

  const lastTwoDigits = floorNumber % 100;
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 13
      ? "th"
      : floorNumber % 10 === 1
        ? "st"
        : floorNumber % 10 === 2
          ? "nd"
          : floorNumber % 10 === 3
            ? "rd"
            : "th";

  return `${floorNumber}${suffix} Floor`;
}

export function UnitCard({
  propertyCode,
  qrToken,
  unit,
  location,
  propertyVideoUrl,
}: {
  propertyCode: string;
  qrToken: string;
  unit: ToLetUnitView;
  location: string;
  propertyVideoUrl?: string | null;
}) {
  const listing = unit.currentListing;
  const prefersReducedMotion = usePrefersReducedMotion();
  const markRented = useMarkToLetUnitRented();
  const [slideIndex, setSlideIndex] = useState(0);
  const [showBookingCount, setShowBookingCount] = useState(false);
  const imageUrls = (
    listing?.imageUrls?.length ? listing.imageUrls : unit.imageUrls
  ).slice(0, 5);
  const media = [
    ...imageUrls.map((url) => ({
      type: "image" as const,
      url,
      label: "Photo",
    })),
    ...(listing?.videoUrl
      ? [
          {
            type: "video" as const,
            url: listing.videoUrl,
            label: "Open Listing video / 360° tour",
          },
        ]
      : []),
    ...(propertyVideoUrl && propertyVideoUrl !== listing?.videoUrl
      ? [
          {
            type: "video" as const,
            url: propertyVideoUrl,
            label: "Open property video / 360° tour",
          },
        ]
      : []),
  ];
  const activeSlide = media.length ? media[slideIndex % media.length] : null;
  const bookingCount = listing?.bookingCount ?? 0;
  const isActiveVacant =
    listing?.status === "active" && unit.status === "vacant";
  const canManageListing =
    unit.status === "vacant" &&
    (!listing ||
      listing.status === "draft" ||
      listing.status === "paused" ||
      listing.status === "closed");
  const detailsHref = `/account/to-let/properties/${propertyCode}/units/${unit.unitCode}`;
  const listingHref = `${detailsHref}/listing`;

  useEffect(() => {
    if (prefersReducedMotion || media.length < 2) return;

    const interval = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % media.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [media.length, prefersReducedMotion]);

  useEffect(() => {
    if (
      prefersReducedMotion ||
      listing?.status !== "active" ||
      bookingCount < 1
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setShowBookingCount((current) => !current);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [listing?.status, bookingCount, prefersReducedMotion]);

  const shareListing = async () => {
    if (!listing) return;

    const url = new URL(
      listing.visibility === "public"
        ? `/to-let/listings/${listing.listingCode}`
        : `/to-let/qr/${qrToken}`,
      window.location.origin,
    ).toString();
    const title = listing.title || `${unit.name} To-Let`;
    const text = `${title} is available for ${formatRent(listing.monthlyRent)} per month${location ? ` in ${location}` : ""}.`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Listing link and caption copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this Listing");
    }
  };

  const confirmRented = async () => {
    if (!listing) return;
    try {
      await markRented.mutateAsync({
        propertyCode,
        unitCode: unit.unitCode,
        listingCode: listing.listingCode,
      });
    } catch {
      // The mutation hook shows the API error.
    }
  };

  const statusText =
    prefersReducedMotion && bookingCount > 0
      ? `Book Now - ${bookingCount} ${bookingCount === 1 ? "Booking" : "Bookings"}`
      : listing?.status === "active" && bookingCount > 0 && showBookingCount
        ? `${bookingCount} ${bookingCount === 1 ? "Booking" : "Bookings"}`
        : "Book Now";

  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          {listing?.status === "active" ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {statusText}
            </span>
          ) : (
            <UnitStatusBadge status={unit.status} />
          )}
          {unit.status === "vacant" &&
          listing?.status &&
          listing.status !== "active" ? (
            <span className="text-xs font-medium text-gray-500">
              {humanize(listing.status)} Listing
            </span>
          ) : null}
        </div>

        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <Eye className="size-3.5 text-gray-400" /> View:{" "}
          {listing?.viewCount ?? 0} Views
        </span>
      </header>

      <div className="relative aspect-[16/9] bg-gray-100">
        {activeSlide?.type === "image" ? (
          <Image
            src={activeSlide.url}
            alt={`${listing?.title || unit.name} media ${slideIndex + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            unoptimized={activeSlide.url.startsWith("http")}
          />
        ) : activeSlide?.type === "video" ? (
          <a
            href={activeSlide.url}
            target="_blank"
            rel="noreferrer"
            className="flex size-full flex-col items-center justify-center gap-3 bg-gray-900 text-white transition-colors hover:bg-gray-800"
          >
            <PlayCircle className="size-12" />
            <span className="text-sm font-semibold">{activeSlide.label}</span>
          </a>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-gray-400">
            <Building2 className="size-12" />
            <span className="text-sm">No media added</span>
          </div>
        )}

        {media.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous media"
              onClick={() =>
                setSlideIndex((current) =>
                  current === 0 ? media.length - 1 : current - 1,
                )
              }
              className="absolute left-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-800 transition-colors hover:bg-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next media"
              onClick={() =>
                setSlideIndex((current) => (current + 1) % media.length)
              }
              className="absolute right-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-gray-800 transition-colors hover:bg-white"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/40 px-2 py-1.5">
              {media.map((item, index) => (
                <button
                  key={`${item.type}-${item.url}`}
                  type="button"
                  aria-label={`Show ${item.type} ${index + 1}`}
                  onClick={() => setSlideIndex(index)}
                  className={`size-1.5 rounded-full ${
                    index === slideIndex % media.length
                      ? "bg-white"
                      : "bg-white/50"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 font-mono text-xs text-gray-500">
          <span>
            Unit: {unit.name} ({formatFloorLabel(unit.floorNumber)})
          </span>
          <span>ID: {listing?.listingCode ?? unit.unitCode}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <Layers3 className="size-3.5" />
              {humanize(unit.unitType)}
            </p>
            <h3 className="mt-1 truncate text-lg font-semibold text-gray-900">
              {listing?.title || unit.name}
            </h3>
          </div>

          {listing ? (
            <p className="shrink-0 text-right text-lg font-bold text-emerald-700">
              {formatRent(listing.monthlyRent)}
              <span className="block text-xs font-normal text-gray-500">
                per month
              </span>
            </p>
          ) : (
            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
              {humanize(unit.unitType)}
            </span>
          )}
        </div>

        {listing?.description || unit.description ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-600">
            {listing?.description || unit.description}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            <BedDouble className="size-3.5 text-gray-400" /> {unit.bedrooms} bed
          </span>
          <span className="flex items-center gap-1.5">
            <Bath className="size-3.5 text-gray-400" /> {unit.bathrooms} bath
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5 text-gray-400" /> {unit.balconies}{" "}
            balcony
          </span>
          <span className="flex items-center gap-1.5">
            <Ruler className="size-3.5 text-gray-400" />
            {unit.sizeSqFt.toLocaleString("en-BD")} sq ft
          </span>
          <span className="col-span-2 flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-gray-400" />
            <span className="truncate">{location}</span>
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <Button variant="outline" size="sm" asChild className="flex-1">
            <Link href={detailsHref}>Details</Link>
          </Button>

          {canManageListing ? (
            <Button size="sm" asChild className="flex-1">
              <Link href={listingHref}>
                <Megaphone />
                {listing?.status === "closed"
                  ? "Re-List"
                  : listing
                    ? "Manage Listing"
                    : "Create Listing"}
              </Link>
            </Button>
          ) : null}

          {isActiveVacant ? (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1">
                    Mark as Booked
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Mark {unit.name} as booked?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This confirms an offline deal. The Unit will be marked as
                      booked and its active Listing will stop accepting new
                      requests.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={markRented.isPending}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={markRented.isPending}
                      onClick={() => void confirmRented()}
                    >
                      {markRented.isPending ? "Updating..." : "Confirm Booking"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => void shareListing()}
              >
                <Share2 /> Share
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
