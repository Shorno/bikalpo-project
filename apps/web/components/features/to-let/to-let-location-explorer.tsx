"use client";

import {
  Compass,
  ExternalLink,
  LocateFixed,
  MapPin,
  MapPinned,
  Navigation,
  Route,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

const nearbyPlaces = [
  "School",
  "Hospital",
  "Mosque",
  "Market",
  "Bus Stop",
  "Metro Station",
] as const;

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
  const [selectedListingCode, setSelectedListingCode] = useState(
    listings[0]?.listingCode ?? "",
  );
  const [radiusKm, setRadiusKm] = useState("5");
  const [nearbyPlace, setNearbyPlace] = useState<
    (typeof nearbyPlaces)[number] | null
  >(null);
  const [zoneMode, setZoneMode] = useState(false);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  const visibleListings = useMemo(() => {
    if (!zoneMode || selectedZones.length === 0) return listings;
    return listings.filter((listing) =>
      selectedZones.some((area) =>
        listing.location.toLowerCase().includes(area.toLowerCase()),
      ),
    );
  }, [listings, selectedZones, zoneMode]);

  const initialListing =
    visibleListings.find((listing) => coordinatesFor(listing)) ??
    visibleListings[0];
  const focusedListing =
    visibleListings.find(
      (listing) => listing.listingCode === selectedListingCode,
    ) ?? initialListing;

  useEffect(() => {
    if (
      visibleListings.length > 0 &&
      !visibleListings.some(
        (listing) => listing.listingCode === selectedListingCode,
      )
    ) {
      setSelectedListingCode(visibleListings[0]?.listingCode ?? "");
    }
  }, [selectedListingCode, visibleListings]);

  const coordinates = coordinatesFor(focusedListing);
  const mapLabel =
    focusedListing?.location || selectedZones[0] || locationPins[0] || "Dhaka";
  const baseMapQuery = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : mapLabel;
  const mapQuery = nearbyPlace
    ? `${nearbyPlace} within ${radiusKm} km of ${mapLabel}`
    : baseMapQuery;
  const googleMapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`;
  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(baseMapQuery)}`;
  const availableCount = visibleListings.filter(
    (listing) => listing.marketplaceStatus === "available",
  ).length;

  const toggleZone = (area: string) => {
    setSelectedZones((current) =>
      current.includes(area)
        ? current.filter((candidate) => candidate !== area)
        : [...current, area],
    );
  };

  return (
    <section
      id="location-intelligence"
      aria-labelledby="location-intelligence-heading"
      className="scroll-mt-28 border-y border-stone-200/80 bg-white py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-3xl sm:mb-10">
          <h2
            id="location-intelligence-heading"
            className="text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl"
          >
            নির্ভুলভাবে আপনার পছন্দের To-Let ইউনিট খুঁজুন
          </h2>
          <p className="mt-4 max-w-[70ch] text-sm leading-7 text-muted-foreground sm:text-base">
            নিজের Search Area ও radius নির্ধারণ করুন, কাছের School, Hospital,
            Mosque, Market, Bus Stop বা Metro Station দেখুন এবং Google Maps-এ
            distance ও commute route যাচাই করুন।
          </p>
        </div>

        <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/30 p-4 sm:p-5">
          <form
            action="/to-let#location-intelligence"
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_auto]"
          >
            <label className="relative block">
              <span className="sr-only">Search area</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={mapLabel === "Dhaka" ? "" : mapLabel}
                placeholder="Search Area — e.g. Dhanmondi, Dhaka"
                className="min-h-11 w-full rounded-lg border border-input bg-background pl-10 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            {selectedType ? (
              <input type="hidden" name="type" value={selectedType} />
            ) : null}
            <label>
              <span className="sr-only">Radius search</span>
              <select
                value={radiusKm}
                onChange={(event) => setRadiusKm(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="1">Within 1 km</option>
                <option value="3">Within 3 km</option>
                <option value="5">Within 5 km</option>
                <option value="10">Within 10 km</option>
                <option value="20">Within 20 km</option>
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <LocateFixed className="size-4" /> Search area
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">
                Nearby places
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {nearbyPlaces.map((place) => (
                  <button
                    key={place}
                    type="button"
                    aria-pressed={nearbyPlace === place}
                    onClick={() =>
                      setNearbyPlace((current) =>
                        current === place ? null : place,
                      )
                    }
                    className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      nearbyPlace === place
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                    }`}
                  >
                    {place}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              aria-pressed={zoneMode}
              onClick={() => {
                setZoneMode((current) => !current);
                if (zoneMode) setSelectedZones([]);
              }}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                zoneMode
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:border-primary/40 hover:text-primary"
              }`}
            >
              <MapPinned className="size-4" />
              {zoneMode ? "Finish zone" : "Draw Zone"}
            </button>
          </div>

          {zoneMode ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Area chips থেকে এক বা একাধিক location নির্বাচন করে আপনার search zone
              তৈরি করুন। Selected zone অনুযায়ী result list update হবে।
            </p>
          ) : null}
        </div>

        <div className="grid overflow-hidden rounded-xl border border-stone-200 bg-background lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-border p-5 sm:p-6 lg:border-r lg:border-b-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-primary">
                  Matching locations
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {visibleListings.length} location result(s)
                </h3>
              </div>
              <Compass className="size-5 text-muted-foreground" />
            </div>

            {unavailable ? (
              <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                Listing results are temporarily unavailable. Area, radius and
                nearby-place search can still be explored on Google Maps.
              </div>
            ) : null}

            <div className="mt-5 space-y-3">
              {visibleListings.length > 0 ? (
                visibleListings.map((listing) => {
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
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Show ${listing.title} on map`}
                        onClick={() =>
                          setSelectedListingCode(listing.listingCode)
                        }
                        className="group grid min-h-28 w-full grid-cols-[6.5rem_minmax(0,1fr)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                          <span className="mt-1 block font-mono text-sm font-semibold tabular-nums text-emerald-700">
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
                        className="flex min-h-11 items-center justify-between border-t border-border px-3 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
                      >
                        View details <ExternalLink className="size-3.5" />
                      </Link>
                    </article>
                  );
                })
              ) : !unavailable ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  No location matches the selected search zone and rental-type
                  filters.
                </div>
              ) : null}
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
                  {nearbyPlace
                    ? `${nearbyPlace} near ${mapLabel}`
                    : `Showing ${mapLabel}`}
                </p>
              </div>
              <a
                href={googleMapsSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Open in Google Maps <ExternalLink className="size-3.5" />
              </a>
            </div>

            <iframe
              key={mapQuery}
              src={googleMapsEmbedUrl}
              title={`Google Map showing ${mapQuery}`}
              className="min-h-[330px] w-full flex-1 border-0 bg-muted"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />

            <div className="grid border-t border-border bg-background sm:grid-cols-3">
              <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:border-r sm:border-b-0">
                <LocateFixed className="size-4 text-primary" />
                <div>
                  <p className="text-[11px] text-muted-foreground">Radius</p>
                  <p className="text-xs font-semibold">Within {radiusKm} km</p>
                </div>
              </div>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-primary/5 sm:border-r sm:border-b-0"
              >
                <Route className="size-4 text-primary" />
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Commute time
                  </p>
                  <p className="text-xs font-semibold">Check route</p>
                </div>
              </a>
              <div className="flex items-center gap-3 px-4 py-3">
                <Navigation className="size-4 text-primary" />
                <div>
                  <p className="text-[11px] text-muted-foreground">
                    Live availability
                  </p>
                  <p className="text-xs font-semibold tabular-nums">
                    {unavailable ? "Unavailable" : `${availableCount} unit(s)`}
                  </p>
                </div>
              </div>
            </div>

            {locationPins.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-5 py-3">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {zoneMode ? "Build search zone:" : "Filter by area:"}
                </span>
                {locationPins.map((area) =>
                  zoneMode ? (
                    <button
                      key={area}
                      type="button"
                      aria-pressed={selectedZones.includes(area)}
                      onClick={() => toggleZone(area)}
                      className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-colors ${
                        selectedZones.includes(area)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      <MapPin className="size-3" /> {area}
                    </button>
                  ) : (
                    <Link
                      key={area}
                      href={areaFilterHref(area, selectedType)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-background px-3 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <MapPin className="size-3" /> {area}
                    </Link>
                  ),
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
