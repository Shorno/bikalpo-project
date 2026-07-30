import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck2,
  Compass,
  ExternalLink,
  Eye,
  Home,
  KeyRound,
  type LucideIcon,
  MapPin,
  MessageSquareText,
  QrCode,
  Search,
  ShieldCheck,
  Star,
  Store,
  Users,
  Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PublicToLetCard } from "@/components/features/to-let/public-tolet-card";
import { PublicUnitListingCard } from "@/components/features/to-let/public-unit-listing-card";
import { Button } from "@/components/ui/button";
import {
  getToLetListings,
  listPublicToLetUnitListings,
} from "@/lib/public-data";

export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "Bikalpo To-Let | Find Rental Spaces in Bangladesh" },
  description:
    "Explore available flats, bachelor rooms, sublets, shops, offices and warehouses published by property owners on Bikalpo.",
};

type UnitListing = Awaited<
  ReturnType<typeof listPublicToLetUnitListings>
>[number];

type RentalType =
  | "family_flat"
  | "bachelor_room"
  | "sublet"
  | "shop"
  | "office"
  | "warehouse";

interface ToLetPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
  }>;
}

const rentalTypes: ReadonlyArray<{
  value: RentalType;
  label: string;
  banglaLabel: string;
  icon: LucideIcon;
}> = [
  {
    value: "family_flat",
    label: "Family To-Let",
    banglaLabel: "ফ্যামিলি বাসা",
    icon: Home,
  },
  {
    value: "bachelor_room",
    label: "Bachelor",
    banglaLabel: "ব্যাচেলর",
    icon: Users,
  },
  {
    value: "sublet",
    label: "Sublet",
    banglaLabel: "সাবলেট",
    icon: KeyRound,
  },
  {
    value: "shop",
    label: "Shop To-Let",
    banglaLabel: "দোকান",
    icon: Store,
  },
  {
    value: "office",
    label: "Office To-Let",
    banglaLabel: "অফিস",
    icon: Briefcase,
  },
  {
    value: "warehouse",
    label: "Warehouse",
    banglaLabel: "গুদামঘর",
    icon: Warehouse,
  },
];

const journeySteps: ReadonlyArray<{
  title: string;
  description: string;
  icon: LucideIcon;
  phase: "live" | "upcoming";
}> = [
  {
    title: "Find listings",
    description: "Search by location and rental type.",
    icon: Search,
    phase: "live",
  },
  {
    title: "View details",
    description: "Compare photos, rent, facilities and owner contact.",
    icon: Eye,
    phase: "live",
  },
  {
    title: "Request a booking",
    description: "Select a preferred date and send a tracked request.",
    icon: CalendarCheck2,
    phase: "live",
  },
  {
    title: "Join as a tenant",
    description: "Owner confirmation, contract and tenant connection.",
    icon: BadgeCheck,
    phase: "upcoming",
  },
];

function isRentalType(value: string | undefined): value is RentalType {
  return rentalTypes.some((type) => type.value === value);
}

function marketHref(query: string, type?: RentalType) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type) params.set("type", type);
  const search = params.toString();
  return `/to-let${search ? `?${search}` : ""}#listings`;
}

function searchableListingText(listing: UnitListing) {
  return [
    listing.listingCode,
    listing.title,
    listing.description,
    listing.location,
    listing.property.name,
    listing.property.area,
    listing.property.district,
    listing.property.division,
    listing.unit.name,
    listing.unit.unitType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default async function ToLetPage({ searchParams }: ToLetPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLowerCase();
  const selectedType = isRentalType(params.type) ? params.type : undefined;

  const [legacyListings, unitListings] = await Promise.all([
    getToLetListings(300),
    listPublicToLetUnitListings(0),
  ]);

  const filteredUnitListings = unitListings.filter((listing) => {
    if (selectedType && listing.unit.unitType !== selectedType) return false;
    if (!normalizedQuery) return true;
    return searchableListingText(listing).includes(normalizedQuery);
  });

  const filteredLegacyListings = selectedType
    ? []
    : legacyListings.filter((listing) => {
        if (!normalizedQuery) return true;
        return [
          listing.title,
          listing.description,
          listing.location,
          listing.area,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      });

  const propertyCount = new Set(
    unitListings.map((listing) => listing.propertyCode),
  ).size;
  const areaCount = new Set(
    unitListings
      .map((listing) => listing.property.area.trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const totalViews = unitListings.reduce(
    (total, listing) => total + listing.viewCount,
    0,
  );
  const mapListings = unitListings.slice(0, 2);
  const locationPins = Array.from(
    new Map(
      unitListings.map((listing) => [
        listing.property.area.trim().toLowerCase(),
        listing.property.area,
      ]),
    ).values(),
  ).slice(0, 4);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ToLetHero query={query} selectedType={selectedType} />

      <MarketplaceSnapshot
        listingCount={unitListings.length}
        propertyCount={propertyCount}
        areaCount={areaCount}
        totalViews={totalViews}
      />

      <RentalTypeExplorer listings={unitListings} query={query} />

      <section
        id="listings"
        aria-labelledby="curated-listings-heading"
        className="scroll-mt-32 border-y border-border/70 bg-background py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Curated listings"
            title="সাম্প্রতিক ও সক্রিয় To-Let লিস্টিং"
            description="Property owner-এর প্রকাশিত এবং এখন ভাড়ার জন্য available listings থেকে আপনার প্রয়োজনের ইউনিটটি খুঁজুন।"
            action={
              <Link
                href="/to-let#listings"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline hover:underline-offset-4"
              >
                See all listings <ArrowRight className="size-4" />
              </Link>
            }
          />

          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav
              aria-label="Filter listings by rental type"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            >
              <FilterChip
                href={marketHref(query)}
                active={!selectedType}
                label="All"
              />
              {rentalTypes.map((type) => (
                <FilterChip
                  key={type.value}
                  href={marketHref(query, type.value)}
                  active={selectedType === type.value}
                  label={type.label.replace(" To-Let", "")}
                />
              ))}
            </nav>

            <span
              title="Saved To-Let alerts are coming soon"
              className="inline-flex w-fit cursor-not-allowed items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary"
            >
              <Bell className="size-4" /> My Alert
              <span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground shadow-sm">
                Coming soon
              </span>
            </span>
          </div>

          {query || selectedType ? (
            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Search className="size-4 text-primary" />
              <span>
                Showing{" "}
                {filteredUnitListings.length + filteredLegacyListings.length}{" "}
                result(s)
                {query ? ` for “${query}”` : ""}
                {selectedType
                  ? ` in ${rentalTypes.find((type) => type.value === selectedType)?.label}`
                  : ""}
              </span>
              <Link
                href="/to-let#listings"
                className="ml-auto font-semibold text-primary hover:underline"
              >
                Clear filters
              </Link>
            </div>
          ) : null}

          {filteredUnitListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredUnitListings.map((listing) => (
                <PublicUnitListingCard
                  key={listing.listingCode}
                  listing={listing}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
              <Building2 className="mx-auto size-10 text-muted-foreground/60" />
              <h3 className="mt-4 text-lg font-semibold">
                No matching listing
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Try another area or rental type. New Public listings will appear
                here automatically after an owner publishes them.
              </p>
            </div>
          )}

          {filteredLegacyListings.length > 0 ? (
            <div className="mt-12 border-t border-border pt-10">
              <div className="mb-5">
                <h3 className="text-lg font-semibold">Other To-Let listings</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Listings from the earlier Bikalpo To-Let catalog.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {filteredLegacyListings.map((listing) => (
                  <PublicToLetCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <LocationIntelligence
        listings={mapListings}
        locationPins={locationPins}
      />

      <TenantJourney firstListing={unitListings[0]} />

      <CommunityReviewsPreview />

      <OwnerCallToAction />
    </div>
  );
}

function ToLetHero({
  query,
  selectedType,
}: {
  query: string;
  selectedType?: RentalType;
}) {
  return (
    <section className="border-b border-border/70 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="relative min-h-[470px] overflow-hidden rounded-xl bg-slate-950 sm:min-h-[500px]">
          <Image
            src="/images/to-let-hero.png"
            alt="Modern apartment overlooking Dhaka for Bikalpo To-Let"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1280px) 100vw, 1280px"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,12,30,0.96)_0%,rgba(2,12,30,0.9)_42%,rgba(2,12,30,0.42)_72%,rgba(2,12,30,0.12)_100%)]" />
          <div className="relative flex min-h-[470px] max-w-3xl flex-col justify-center px-6 py-10 text-white sm:min-h-[500px] sm:px-10 lg:px-12">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-[0.12em] text-blue-100 uppercase backdrop-blur-sm">
              <KeyRound className="size-3.5" /> Bikalpo To-Let
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">
              Bangladesh&apos;s most trusted digital To-Let platform.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-100/90 sm:text-base sm:leading-8">
              Find, compare and contact the owner directly for your desired
              house, flat, sublet, shop, office or garage in one place. Send a
              Booking Request online.
            </p>

            <form
              action="/to-let#listings"
              className="mt-8 grid gap-2 rounded-xl border border-white/20 bg-white p-2 shadow-2xl shadow-slate-950/25 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
            >
              <label className="relative block">
                <span className="sr-only">
                  Search by area, property or listing ID
                </span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Area, property or listing ID"
                  className="h-11 w-full rounded-lg border-0 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none ring-primary/25 placeholder:text-slate-400 focus:ring-4"
                />
              </label>
              <label>
                <span className="sr-only">Rental type</span>
                <select
                  name="type"
                  defaultValue={selectedType ?? ""}
                  className="h-11 w-full rounded-lg border-0 bg-slate-50 px-3 text-sm text-slate-700 outline-none ring-primary/25 focus:ring-4"
                >
                  <option value="">All rental types</option>
                  {rentalTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="lg" className="h-11 rounded-lg px-5">
                Search <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-lg">
                <Link href="#listings">
                  Browse listings <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-lg border-white/30 bg-white/10 text-white hover:bg-white hover:text-slate-950"
              >
                <Link href="/account/to-let/properties/new">
                  Add your property
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketplaceSnapshot({
  listingCount,
  propertyCount,
  areaCount,
  totalViews,
}: {
  listingCount: number;
  propertyCount: number;
  areaCount: number;
  totalViews: number;
}) {
  const stats: ReadonlyArray<{
    label: string;
    value: string;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      label: "Live listings shown",
      value: listingCount.toLocaleString("en-BD"),
      description: "Available now or from a listed date",
      icon: KeyRound,
    },
    {
      label: "Properties represented",
      value: propertyCount.toLocaleString("en-BD"),
      description: "Unique properties in the current results",
      icon: Building2,
    },
    {
      label: "Areas represented",
      value: areaCount.toLocaleString("en-BD"),
      description: "Locations covered by current results",
      icon: MapPin,
    },
    {
      label: "Listing views",
      value: totalViews.toLocaleString("en-BD"),
      description: "Interest across the current listings",
      icon: Eye,
    },
  ];

  return (
    <section
      aria-label="Current To-Let marketplace snapshot"
      className="bg-background"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, description, icon: Icon }) => (
            <article
              key={label}
              className="rounded-xl border border-border bg-background p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-2xl font-semibold tracking-[-0.03em]">
                    {value}
                  </p>
                  <h2 className="mt-1 text-sm font-semibold">{label}</h2>
                </div>
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary">
                  <Icon className="size-5" />
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function RentalTypeExplorer({
  listings,
  query,
}: {
  listings: UnitListing[];
  query: string;
}) {
  return (
    <section className="border-y border-border/70 bg-muted/20 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Explore rental types"
          title="যে ধরনের ইউনিট খুঁজছেন, সেখান থেকেই শুরু করুন"
          description="ফ্যামিলি, ব্যাচেলর, সাবলেট, অফিস, দোকান ও গুদামঘরসহ বিভিন্ন ধরনের To-Let listing থেকে প্রয়োজন অনুযায়ী সঠিক ইউনিট নির্বাচন করুন।"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {rentalTypes.map(({ value, label, banglaLabel, icon: Icon }) => {
            const count = listings.filter(
              (listing) => listing.unit.unitType === value,
            ).length;
            return (
              <Link
                key={value}
                href={marketHref(query, value)}
                className="group flex min-h-44 flex-col rounded-xl border border-border bg-background p-4 shadow-sm transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/8 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-4.5" />
                  </span>
                  <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <div className="mt-5">
                  <div>
                    <h3 className="font-semibold">{label}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {banglaLabel}
                    </p>
                  </div>
                </div>
                <p className="mt-auto pt-5 text-xs font-semibold text-primary">
                  {count} live {count === 1 ? "listing" : "listings"} shown
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-primary"
      }`}
    >
      {label}
    </Link>
  );
}

function LocationIntelligence({
  listings,
  locationPins,
}: {
  listings: UnitListing[];
  locationPins: string[];
}) {
  const focusedListing =
    listings.find((listing) => {
      const latitude = Number(listing.property.latitude);
      const longitude = Number(listing.property.longitude);
      return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
      );
    }) ?? listings[0];
  const latitude = Number(focusedListing?.property.latitude);
  const longitude = Number(focusedListing?.property.longitude);
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  const mapQuery = hasCoordinates
    ? `${latitude},${longitude}`
    : focusedListing?.location || locationPins[0] || "Dhaka, Bangladesh";
  const mapLabel =
    focusedListing?.location || locationPins[0] || "Dhaka, Bangladesh";
  const googleMapsEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=15&output=embed`;
  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  return (
    <section className="border-y border-border/70 bg-background py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Location intelligence"
          title="নির্ভুলভাবে আপনার পছন্দের To-Let ইউনিট খুঁজুন"
          description="Available listing-এর location সরাসরি Google Maps-এ দেখুন। Exact coordinates থাকলে map সেটিই ব্যবহার করবে, অন্যথায় property area ও address দিয়ে location খুঁজবে।"
        />

        <div className="grid overflow-hidden rounded-2xl border border-border bg-background shadow-sm lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-border p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-primary">
                  Latest by area
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {listings.length} location result(s)
                </h3>
              </div>
              <Compass className="size-5 text-muted-foreground" />
            </div>

            <div className="mt-5 space-y-3">
              {listings.length > 0 ? (
                listings.map((listing) => (
                  <LocationListingPreview
                    key={listing.listingCode}
                    listing={listing}
                  />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  New location results will appear when owners publish listings.
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
                  Showing {mapLabel}
                </p>
              </div>
              <a
                href={googleMapsSearchUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Open in Google Maps <ExternalLink className="size-3.5" />
              </a>
            </div>

            <iframe
              src={googleMapsEmbedUrl}
              title={`Google Map showing ${mapLabel}`}
              className="min-h-[330px] w-full flex-1 border-0 bg-muted"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />

            {locationPins.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-5 py-3">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Available areas:
                </span>
                {locationPins.map((area) => (
                  <a
                    key={area}
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${area}, Bangladesh`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
                  >
                    <MapPin className="size-3" /> {area}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function LocationListingPreview({ listing }: { listing: UnitListing }) {
  const imageUrl = listing.imageUrls.find(
    (candidate) => candidate.trim().length > 0,
  );

  return (
    <Link
      href={`/to-let/listings/${listing.listingCode}`}
      className="group grid grid-cols-[6.5rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-primary/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="relative min-h-28 bg-muted">
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
      </div>
      <div className="min-w-0 p-3">
        <span className="text-[10px] font-semibold text-emerald-700 uppercase">
          Available
        </span>
        <h4 className="mt-1 line-clamp-1 text-sm font-semibold group-hover:text-primary">
          {listing.title}
        </h4>
        <p className="mt-1 text-sm font-semibold text-emerald-700">
          {listing.monthlyRent === null
            ? "Price hidden"
            : `৳${listing.monthlyRent.toLocaleString("en-BD")} / month`}
        </p>
        <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
          {listing.location}
        </p>
      </div>
    </Link>
  );
}

function TenantJourney({ firstListing }: { firstListing?: UnitListing }) {
  return (
    <section className="bg-muted/20 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Tenant journey"
          title="From Listing Search to Digital Booking and Tenant Connection"
          description="Fewer steps, more assurance—from finding listings to viewing details and sending a Booking Request. Contract and tenant connection are coming soon."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {journeySteps.map(
            ({ title, description, icon: Icon, phase }, index) => {
              const href =
                index === 0
                  ? "/to-let#listings"
                  : (index === 1 || index === 2) && firstListing
                    ? `/to-let/listings/${firstListing.listingCode}`
                    : undefined;
              const card = (
                <article
                  key={title}
                  className="relative h-full rounded-xl border border-border bg-background p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
                        phase === "live"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {phase === "live" ? "Live" : "Upcoming"}
                    </span>
                  </div>
                  <span className="mt-8 flex size-11 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                  {href ? (
                    <span className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      Open step <ArrowRight className="size-3.5" />
                    </span>
                  ) : null}
                </article>
              );
              return href ? (
                <Link
                  key={title}
                  href={href}
                  className="rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {card}
                </Link>
              ) : (
                <div key={title}>{card}</div>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}

function CommunityReviewsPreview() {
  const previewReviews = [
    {
      label: "সাম্প্রতিক মন্তব্য",
      text: "Property Account তৈরি করতে মাত্র কয়েক মিনিট লেগেছে।",
      author: "Sample property owner",
      icon: MessageSquareText,
    },
    {
      label: "ভাড়াটিয়ার অভিজ্ঞতা",
      text: "Verified Listing হওয়ায় কোনো ঝামেলা ছাড়াই Booking Request পাঠিয়েছি।",
      author: "Sample tenant",
      icon: BadgeCheck,
    },
    {
      label: "মালিকের মতামত",
      text: "QR Poster ব্যবহার করলে property listing সহজে share করা যায়।",
      author: "Sample property owner",
      icon: ShieldCheck,
    },
  ] as const;

  return (
    <section className="border-y border-border/70 bg-background py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Community reviews"
          title="ব্যবহারকারীদের মতামত ও বাস্তব অভিজ্ঞতা দেখুন"
          description="Verified booking ও rental journey-এর অভিজ্ঞতা থেকে community feedback তৈরি হবে। Review service চালু হলে যাচাই করা মন্তব্য এখানে প্রকাশ হবে।"
          action={
            <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
              সব মন্তব্য দেখুন
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 uppercase">
                Soon
              </span>
            </span>
          }
        />

        <div className="grid overflow-hidden rounded-2xl border border-border bg-background shadow-sm lg:grid-cols-[1.02fr_0.98fr]">
          <div className="border-b border-border p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                  User feedback
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  মন্তব্য লিখুন
                </h3>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold text-amber-700 uppercase">
                Coming soon
              </span>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
              Verified Booking Request বা active tenancy থাকলে review submit করা
              যাবে।
            </p>

            <label className="mt-6 block text-sm font-semibold text-foreground">
              আপনার মতামত বা পরামর্শ
              <textarea
                disabled
                rows={6}
                placeholder="আপনার মতামত বা পরামর্শ লিখুন..."
                className="mt-2 w-full resize-none rounded-xl border border-border bg-muted/35 p-4 text-sm outline-none placeholder:text-muted-foreground/70"
              />
            </label>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  আপনার rating
                </p>
                <div
                  role="img"
                  className="mt-2 flex items-center gap-1 text-slate-300"
                  aria-label="Rating preview"
                >
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star key={index} className="size-6" />
                  ))}
                </div>
              </div>
              <Button disabled className="rounded-lg">
                <MessageSquareText className="size-4" /> মন্তব্য প্রকাশ করুন
              </Button>
            </div>
          </div>

          <div className="bg-muted/20 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                  Recent comments
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  Verified feedback stream
                </h3>
              </div>
              <ShieldCheck className="size-6 text-primary" />
            </div>

            <div className="mt-6 space-y-3">
              {previewReviews.map(({ label, text, author, icon: Icon }) => (
                <article
                  key={label}
                  className="rounded-xl border border-border bg-background p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
                      <Icon className="size-4.5" />
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                      Sample
                    </span>
                  </div>
                  <h4 className="mt-4 text-sm font-semibold">{label}</h4>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {text}
                  </p>
                  <p className="mt-3 text-xs font-semibold text-foreground">
                    — {author}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} className="size-3.5" />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OwnerCallToAction() {
  return (
    <section className="bg-background py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-xl bg-primary px-6 py-10 text-primary-foreground sm:px-10 sm:py-14 lg:px-14">
          <div className="absolute -right-24 -top-24 size-80 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-blue-950/25 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-blue-200 uppercase">
                For property owners
              </p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
                একটি Property নিবন্ধন করুন, হাজারো ভাড়াটিয়ার কাছে পৌঁছান—এক প্ল্যাটফর্মে।
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                Bikalpo-তে Property Account তৈরি করে আপনার ফ্ল্যাট, বাসা, অফিস, দোকান,
                গ্যারেজ বা গুদামের জন্য listing publish করুন। Permanent Property ID, QR
                identity এবং Booking Request—সবকিছু এক জায়গায় manage করুন।
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-xs text-slate-200">
                {[
                  "Permanent ID",
                  "QR identity",
                  "Listing visibility",
                  "Call & WhatsApp",
                ].map((feature) => (
                  <span
                    key={feature}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1.5"
                  >
                    <BadgeCheck className="size-3.5 text-emerald-300" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <Button
                asChild
                size="lg"
                className="w-full rounded-lg bg-background text-primary hover:bg-blue-50 sm:w-auto"
              >
                <Link href="/account/to-let/properties/new">
                  <Building2 className="size-4" /> Property Account তৈরি করুন
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full rounded-lg border-white/25 bg-white/10 text-white hover:bg-white hover:text-slate-950 sm:w-auto"
              >
                <Link href="/account/to-let/properties">
                  <QrCode className="size-4" /> নতুন To-Let পোস্ট করুন
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          {eyebrow}
        </p>
        <h2
          id={
            eyebrow === "Curated listings"
              ? "curated-listings-heading"
              : undefined
          }
          className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl"
        >
          {title}
        </h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
