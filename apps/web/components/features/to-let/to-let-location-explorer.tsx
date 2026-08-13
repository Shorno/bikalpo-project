"use client";

import { Compass, ExternalLink, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export interface ToLetLocationListing {
  listingCode: string;
  title: string;
  location: string;
  monthlyRent: number | null;
  marketplaceStatus: "available" | "booked";
  imageUrls: string[];
  property: {
    latitude: string | number | null;
    longitude: string | number | null;
  };
}

function coordinatesFor(listing: ToLetLocationListing | undefined) {
  const latitude = Number(listing?.property.latitude);
  const longitude = Number(listing?.property.longitude);
  const valid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    (latitude !== 0 || longitude !== 0);

  return valid ? { latitude, longitude } : null;
}

function areaFilterHref(area: string, selectedType?: string) {
  const params = new URLSearchParams({ q: area });
  if (selectedType) params.set("type", selectedType);
  return `/to-let?${params.toString()}#listings`;
}

export function ToLetLocationExplorer({
  listings,
  locationPins,
  selectedType,
  unavailable = false,
}: {
  listings: ToLetLocationListing[];
  locationPins: string[];
  selectedType?: string;
  unavailable?: boolean;
}) {
  const initialListing =
    listings.find((listing) => coordinatesFor(listing)) ?? listings[0];
  const [selectedListingCode, setSelectedListingCode] = useState(
    initialListing?.listingCode ?? "",
  );
  const focusedListing =
    listings.find((listing) => listing.listingCode === selectedListingCode) ??
    initialListing;
  const coordinates = coordinatesFor(focusedListing);
  const hasMapResult = Boolean(focusedListing || locationPins[0]);
  const mapQuery = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : focusedListing?.location || locationPins[0] || "";
  const mapLabel = focusedListing?.location || locationPins[0] || "";
  const googleMapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;
  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  return (
    <section className="border-y border-border/70 bg-background py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl sm:mb-10">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            Location intelligence
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
            নির্ভুলভাবে আপনার পছন্দের To-Let ইউনিট খুঁজুন
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
            Result card নির্বাচন করলে Google Map সেই Listing-এর location-এ focus
            করবে। Exact coordinates না থাকলে public address দিয়ে location খোঁজা হবে।
          </p>
        </div>

        <div className="grid overflow-hidden rounded-2xl border border-border bg-background shadow-sm lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-primary">
                  Matching locations
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {listings.length} location result(s)
                </h3>
              </div>
              <Compass className="size-5 text-muted-foreground" />
            </div>

            <div className="mt-5 space-y-3">
              {listings.length > 0 ? (
                listings.map((listing) => {
                  const selected =
                    listing.listingCode === focusedListing?.listingCode;
                  const imageUrl = listing.imageUrls.find(
                    (candidate) => candidate.trim().length > 0,
                  );

                  return (
                    <article
                      key={listing.listingCode}
                      className={`overflow-hidden rounded-xl border bg-background transition-colors ${
                        selected
                          ? "border-primary ring-2 ring-primary/15"
                          : "border-border hover:border-primary/35"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Show ${listing.title} on map`}
                        onClick={() =>
                          setSelectedListingCode(listing.listingCode)
                        }
                        className="group grid w-full grid-cols-[6.5rem_minmax(0,1fr)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <span className="relative min-h-28 bg-muted">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="104px"
                              unoptimized={imageUrl.startsWith("http")}
                            />
                          ) : null}
                        </span>
                        <span className="min-w-0 p-3">
                          <span
                            className={`text-[10px] font-semibold uppercase ${
                              listing.marketplaceStatus === "booked"
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            {listing.marketplaceStatus === "booked"
                              ? "Booked"
                              : "Available"}
                          </span>
                          <span className="mt-1 block line-clamp-1 text-sm font-semibold group-hover:text-primary">
                            {listing.title}
                          </span>
                          <span className="mt-1 block text-sm font-semibold text-emerald-700">
                            {listing.monthlyRent === null
                              ? "Price hidden"
                              : `৳${listing.monthlyRent.toLocaleString("en-BD")} / month`}
                          </span>
                          <span className="mt-2 block line-clamp-1 text-xs text-muted-foreground">
                            {listing.location}
                          </span>
                        </span>
                      </button>
                      <Link
                        href={`/to-let/listings/${listing.listingCode}`}
                        prefetch={false}
                        className="flex items-center justify-between border-t border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"
                      >
                        View details <ExternalLink className="size-3.5" />
                      </Link>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {unavailable
                    ? "Location results are temporarily unavailable."
                    : "No location matches the current search and rental-type filters."}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-[420px] min-w-0 flex-col bg-muted/20">
            <div className="flex flex-col gap-3 border-b border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                  Smart rental map · Google Maps
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0 text-primary" />
                  {unavailable
                    ? "Marketplace location data is unavailable"
                    : hasMapResult
                      ? `Showing ${mapLabel}`
                      : "No matching location to display"}
                </p>
              </div>
              {hasMapResult && !unavailable ? (
                <a
                  href={googleMapsSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Open in Google Maps <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>

            {hasMapResult && !unavailable ? (
              <iframe
                key={mapQuery}
                src={googleMapsEmbedUrl}
                title={`Google Map showing ${mapLabel}`}
                className="min-h-[330px] w-full flex-1 border-0 bg-muted"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex min-h-[330px] flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
                {unavailable
                  ? "The map will return when marketplace data is available again."
                  : "Change the search or rental type to display matching locations on the map."}
              </div>
            )}

            {locationPins.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-5 py-3">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Filter by area:
                </span>
                {locationPins.map((area) => (
                  <Link
                    key={area}
                    href={areaFilterHref(area, selectedType)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
                  >
                    <MapPin className="size-3" /> {area}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
