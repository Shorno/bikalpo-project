"use client";
import { toLetUnitCapabilities } from "@bikalpo-project/api/lib/tolet-categories";

import {
  Building2,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Eye,
  MapPin,
  PlayCircle,
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

const statusColors: Record<string, string> = {
  Empty: "bg-slate-100 text-slate-800",
  Posted: "bg-emerald-100 text-emerald-900",
  Booked: "bg-amber-100 text-amber-900",
  Rented: "bg-blue-100 text-blue-900",
  Leaving: "bg-orange-100 text-orange-900",
};

export function UnitCard({
  propertyCode,
  qrToken,
  unit,
  location,
}: {
  propertyCode: string;
  qrToken: string;
  unit: ToLetUnitView;
  location: string;
}) {
  const listing = unit.currentListing;
  const capabilities = toLetUnitCapabilities(unit.unitType);
  const residential = capabilities.bedrooms;
  const showBathrooms = capabilities.bathrooms;
  const showBalconies = capabilities.balconies;
  const prefersReducedMotion = usePrefersReducedMotion();
  const markRented = useMarkToLetUnitRented();
  const [slideIndex, setSlideIndex] = useState(0);
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
            label: "Open Listing video",
          },
        ]
      : []),
  ];
  const activeSlide = media.length ? media[slideIndex % media.length] : null;
  const bookingCount = listing?.bookingCount ?? 0;
  const isActiveVacant =
    listing?.status === "active" && unit.status === "vacant";
  const canManageListing =
    (unit.status === "vacant" || unit.status === "occupied") &&
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

  const statusLabel = unit.isLeaving
    ? "Leaving"
    : unit.status === "occupied"
      ? "Rented"
      : unit.status === "booked"
        ? "Booked"
        : unit.status === "vacant"
          ? listing?.status === "active"
            ? "Posted"
            : "Empty"
          : humanize(unit.status);
  const leavingUntil =
    unit.isLeaving && unit.leavingOn
      ? new Date(`${unit.leavingOn}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : null;
  const postedWhileRented =
    unit.status === "occupied" && listing?.status === "active";
  const rooms = [
    residential ? `${unit.bedrooms} Bed` : null,
    showBathrooms ? `${unit.bathrooms} Bathrooms` : null,
    showBalconies ? `${unit.balconies} Balcony` : null,
  ].filter((room): room is string => Boolean(room));
  const canEditActiveListing =
    listing?.status === "active" &&
    (unit.status === "vacant" || unit.status === "occupied");

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors hover:border-primary/40">
      <div className="relative aspect-square bg-muted sm:aspect-[4/3]">
        {activeSlide?.type === "image" ? (
          <Image
            src={activeSlide.url}
            alt={`${listing?.title || unit.name} media ${slideIndex + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 50vw, 25vw"
            unoptimized={activeSlide.url.startsWith("http")}
          />
        ) : activeSlide?.type === "video" ? (
          <a
            href={activeSlide.url}
            target="_blank"
            rel="noreferrer"
            className="flex size-full flex-col items-center justify-center gap-2 bg-gray-900 text-white transition-colors hover:bg-gray-800"
          >
            <PlayCircle className="size-10" />
            <span className="px-2 text-center text-xs font-semibold">{activeSlide.label}</span>
          </a>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Building2 className="size-10" />
            <span className="text-xs">No media added</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1">
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold shadow-sm sm:py-1 sm:text-xs ${statusColors[statusLabel] ?? "bg-white text-foreground"}`}>
              {statusLabel}
              {leavingUntil ? ` · ${leavingUntil}` : ""}
            </span>
            {postedWhileRented ? (
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold shadow-sm ${statusColors.Posted}`}>Posted</span>
            ) : null}
            {listing?.status === "active" && bookingCount > 0 ? (
              <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
                {bookingCount} {bookingCount === 1 ? "Booking" : "Bookings"}
              </span>
            ) : null}
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white">
            <Eye className="size-3" aria-hidden="true" />
            <span className="sr-only">Views: </span>
            {listing?.viewCount ?? 0}
          </span>
        </div>

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
              className="absolute left-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/60 text-foreground backdrop-blur-sm transition-colors hover:bg-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next media"
              onClick={() =>
                setSlideIndex((current) => (current + 1) % media.length)
              }
              className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/60 text-foreground backdrop-blur-sm transition-colors hover:bg-white"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {media.map((item, index) => (
                <button
                  key={`${item.type}-${item.url}`}
                  type="button"
                  aria-label={`Show ${item.type} ${index + 1}`}
                  onClick={() => setSlideIndex(index)}
                  className={`size-1.5 rounded-full shadow-sm sm:size-2 ${
                    index === slideIndex % media.length
                      ? "bg-primary"
                      : "bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="relative flex flex-1 flex-col p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground sm:text-xs">
          <span className="min-w-0 truncate" title={`${unit.name} (${formatFloorLabel(unit.floorNumber)})`}>
            {unit.name} ({formatFloorLabel(unit.floorNumber)})
          </span>
          <span className="shrink-0 tabular-nums">{unit.unitCode}</span>
        </div>
        <h3 className="mt-1.5 truncate text-sm font-bold text-foreground sm:text-base" title={`${humanize(unit.unitType)} (${unit.sizeSqFt.toLocaleString("en-BD")} Sq.ft)`}>
          {/* The whole text area opens the unit; the buttons below sit above this link. */}
          <Link
            href={detailsHref}
            className="rounded-sm after:absolute after:inset-0 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {humanize(unit.unitType)} ({unit.sizeSqFt.toLocaleString("en-BD")} Sq.ft)
          </Link>
        </h3>
        <p className="mt-0.5 text-sm font-bold text-primary sm:text-base">
          {listing ? formatRent(listing.monthlyRent) : "— — —"}
          <span className="text-[11px] font-normal text-muted-foreground sm:text-xs"> / Month</span>
        </p>
        {rooms.length > 0 ? (
          <p className="mt-1 truncate text-[11px] text-foreground/80 sm:text-xs" title={rooms.join(" · ")}>
            {rooms.join(" · ")}
          </p>
        ) : null}
        <p className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground sm:text-xs" title={location}>
          <MapPin className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate capitalize">{location}</span>
        </p>

        <div className="relative z-10 mt-auto pt-2.5">
          <div className="flex gap-1.5 border-t border-border pt-2.5 sm:gap-2">
          {canManageListing ? (
            <Button size="sm" asChild className="h-8 min-w-0 flex-1 px-2 text-xs sm:h-9 sm:text-sm">
              <Link href={listingHref}>Post</Link>
            </Button>
          ) : canEditActiveListing ? (
            <Button size="sm" asChild className="h-8 min-w-0 flex-1 px-2 text-xs sm:h-9 sm:text-sm">
              <Link href={listingHref}>Edit</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" asChild className="h-8 min-w-0 flex-1 px-2 text-xs sm:h-9 sm:text-sm">
              <Link href={detailsHref}>Details</Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-0 flex-1 px-2 text-xs sm:h-9 sm:text-sm"
            disabled={listing?.status !== "active"}
            onClick={() => void shareListing()}
          >
            Share
          </Button>

          {isActiveVacant ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Mark as Booked"
                  title="Mark as Booked"
                  className="size-8 shrink-0 sm:size-9"
                >
                  <CalendarCheck2 className="size-4" aria-hidden="true" />
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
          ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
