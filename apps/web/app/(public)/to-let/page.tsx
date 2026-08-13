import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarCheck2,
  Car,
  Eye,
  Home,
  KeyRound,
  type LucideIcon,
  MapPin,
  MessageSquareText,
  QrCode,
  Search,
  Shapes,
  ShieldCheck,
  Store,
  Users,
  Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PublicUnitListingCard } from "@/components/features/to-let/public-unit-listing-card";
import { ToLetAccountLink } from "@/components/features/to-let/to-let-account-link";
import { ToLetAlertDialog } from "@/components/features/to-let/to-let-alert-dialog";
import { ToLetLocationExplorer } from "@/components/features/to-let/to-let-location-explorer";
import { Button } from "@/components/ui/button";
import { listPublicToLetUnitListings } from "@/lib/public-data";
import {
  filterToLetMarketplaceListings,
  parseToLetSearchParams,
  type ToLetMarketplaceSearchParams,
  type ToLetMarketRentalType,
  toLetMarketHref,
} from "@/lib/to-let-marketplace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: { absolute: "Bikalpo To-Let | Find Rental Spaces in Bangladesh" },
  description:
    "Explore current To-Let listings and recently booked rental spaces published by property owners on Bikalpo.",
};

type UnitListing = Awaited<
  ReturnType<typeof listPublicToLetUnitListings>
>[number];

interface ToLetPageProps {
  searchParams: Promise<ToLetMarketplaceSearchParams>;
}

const rentalTypes: ReadonlyArray<{
  value: ToLetMarketRentalType;
  label: string;
  banglaLabel: string;
  icon: LucideIcon;
  featured: boolean;
}> = [
  {
    value: "family_flat",
    label: "Family To-Let",
    banglaLabel: "ফ্যামিলি বাসা",
    icon: Home,
    featured: true,
  },
  {
    value: "bachelor_room",
    label: "Bachelor",
    banglaLabel: "ব্যাচেলর",
    icon: Users,
    featured: true,
  },
  {
    value: "sublet",
    label: "Sublet",
    banglaLabel: "সাবলেট",
    icon: KeyRound,
    featured: true,
  },
  {
    value: "shop",
    label: "Shop To-Let",
    banglaLabel: "দোকান",
    icon: Store,
    featured: true,
  },
  {
    value: "office",
    label: "Office To-Let",
    banglaLabel: "অফিস",
    icon: Briefcase,
    featured: true,
  },
  {
    value: "warehouse",
    label: "Warehouse",
    banglaLabel: "গুদামঘর",
    icon: Warehouse,
    featured: true,
  },
  {
    value: "garage",
    label: "Garage",
    banglaLabel: "গ্যারেজ",
    icon: Car,
    featured: false,
  },
  {
    value: "other",
    label: "Other",
    banglaLabel: "অন্যান্য",
    icon: Shapes,
    featured: false,
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
    phase: "live",
  },
];

export default async function ToLetPage({ searchParams }: ToLetPageProps) {
  const params = await searchParams;
  const { query, selectedType } = parseToLetSearchParams(params);
  let listingsUnavailable = false;
  let unitListings: UnitListing[] = [];
  try {
    unitListings = await listPublicToLetUnitListings(0);
  } catch {
    listingsUnavailable = true;
  }
  const { queryMatched: queryMatchedListings, filtered: filteredUnitListings } =
    filterToLetMarketplaceListings(unitListings, query, selectedType);

  const propertyCount = new Set(
    filteredUnitListings.map((listing) => listing.propertyCode),
  ).size;
  const areaCount = new Set(
    filteredUnitListings
      .map((listing) => listing.property.area.trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const totalViews = filteredUnitListings.reduce(
    (total, listing) => total + listing.viewCount,
    0,
  );
  const availableListingCount = filteredUnitListings.filter(
    (listing) => listing.marketplaceStatus === "available",
  ).length;
  const bookedListingCount =
    filteredUnitListings.length - availableListingCount;
  const firstAvailableListing = filteredUnitListings.find(
    (listing) => listing.marketplaceStatus === "available",
  );
  const mapListings = [...filteredUnitListings]
    .sort((left, right) =>
      left.marketplaceStatus === right.marketplaceStatus
        ? 0
        : left.marketplaceStatus === "available"
          ? -1
          : 1,
    )
    .slice(0, 4);
  const locationPins = Array.from(
    new Map(
      filteredUnitListings
        .filter((listing) => listing.property.area.trim().length > 0)
        .map((listing) => [
          listing.property.area.trim().toLowerCase(),
          listing.property.area.trim(),
        ]),
    ).values(),
  ).slice(0, 4);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <ToLetHero query={query} selectedType={selectedType} />

      <MarketplaceSnapshot
        listingCount={filteredUnitListings.length}
        availableListingCount={availableListingCount}
        bookedListingCount={bookedListingCount}
        propertyCount={propertyCount}
        areaCount={areaCount}
        totalViews={totalViews}
      />

      <RentalTypeExplorer listings={queryMatchedListings} query={query} />

      <section
        id="listings"
        aria-labelledby="curated-listings-heading"
        className="scroll-mt-32 border-y border-border/70 bg-background py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Curated listings"
            title="সাম্প্রতিক ও সক্রিয় To-Let লিস্টিং"
            description="নতুন listing publish হওয়ার পর ৩০ দিন দেখা যাবে। Booking confirm হলে Booked status-সহ নতুন ৩০ দিন থাকবে; Booked unit নতুন request নেয় না।"
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
                href={toLetMarketHref(query)}
                active={!selectedType}
                label="All"
              />
              {rentalTypes.map((type) => (
                <FilterChip
                  key={type.value}
                  href={toLetMarketHref(query, type.value)}
                  active={selectedType === type.value}
                  label={type.label.replace(" To-Let", "")}
                />
              ))}
            </nav>

            <ToLetAlertDialog query={query} selectedType={selectedType} />
          </div>

          {query || selectedType ? (
            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Search className="size-4 text-primary" />
              <span>
                Showing {filteredUnitListings.length} result(s)
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

          {listingsUnavailable ? (
            <div
              role="alert"
              className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-14 text-center"
            >
              <Building2 className="mx-auto size-10 text-amber-600" />
              <h3 className="mt-4 text-lg font-semibold text-amber-950">
                Listings are temporarily unavailable
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-amber-800">
                The marketplace could not be loaded. Refresh this page to try
                again; your search filters are preserved in the URL.
              </p>
            </div>
          ) : filteredUnitListings.length > 0 ? (
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
        </div>
      </section>

      <ToLetLocationExplorer
        listings={mapListings}
        locationPins={locationPins}
        selectedType={selectedType}
        unavailable={listingsUnavailable}
      />

      <TenantJourney firstListing={firstAvailableListing} />

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
  selectedType?: ToLetMarketRentalType;
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
              key={`${query}:${selectedType ?? "all"}`}
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
                <ToLetAccountLink href="/account/to-let/properties/new">
                  Add your property
                </ToLetAccountLink>
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
  availableListingCount,
  bookedListingCount,
  propertyCount,
  areaCount,
  totalViews,
}: {
  listingCount: number;
  availableListingCount: number;
  bookedListingCount: number;
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
      label: "Listings shown",
      value: listingCount.toLocaleString("en-BD"),
      description: `${availableListingCount.toLocaleString("en-BD")} available · ${bookedListingCount.toLocaleString("en-BD")} recently booked`,
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
          {rentalTypes
            .filter((type) => type.featured)
            .map(({ value, label, banglaLabel, icon: Icon }) => {
              const count = listings.filter(
                (listing) => listing.unit.unitType === value,
              ).length;
              return (
                <Link
                  key={value}
                  href={toLetMarketHref(query, value)}
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
                    {count} {count === 1 ? "listing" : "listings"} shown
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

function TenantJourney({ firstListing }: { firstListing?: UnitListing }) {
  return (
    <section className="bg-muted/20 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Tenant journey"
          title="From Listing Search to Digital Booking and Tenant Connection"
          description="Fewer steps, more assurance—from finding listings and sending a Booking Request to owner confirmation, contract and tenant connection."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {journeySteps.map(
            ({ title, description, icon: Icon, phase }, index) => {
              const href =
                index === 0
                  ? "/to-let#listings"
                  : index === 1
                    ? firstListing
                      ? `/to-let/listings/${firstListing.listingCode}`
                      : "/to-let#listings"
                    : index === 2
                      ? firstListing
                        ? `/to-let/listings/${firstListing.listingCode}#booking`
                        : "/to-let#listings"
                      : "/account/to-let";
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
              return index === 3 ? (
                <ToLetAccountLink
                  key={title}
                  href={href}
                  className="rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {card}
                </ToLetAccountLink>
              ) : (
                <Link
                  key={title}
                  href={href}
                  prefetch={false}
                  className="rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {card}
                </Link>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}

function CommunityReviewsPreview() {
  const feedbackSteps = [
    {
      title: "Confirmed booking",
      description: "The owner accepts a real Booking Request.",
      icon: CalendarCheck2,
    },
    {
      title: "Contract linked",
      description: "The tenant account is connected to the active contract.",
      icon: BadgeCheck,
    },
    {
      title: "Feedback submitted",
      description: "The tenant writes a rating and comment from My Bookings.",
      icon: ShieldCheck,
    },
  ] as const;

  return (
    <section className="border-y border-border/70 bg-background py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Verified rental feedback"
          title="বাস্তব rental experience থেকে যাচাই করা মতামত দিন"
          description="শুধু contract-linked tenant নিজের Booking Details থেকে rating ও feedback দিতে পারবেন। Public consent/moderation ছাড়া private rental comment landing page-এ প্রকাশ করা হয় না।"
          action={
            <ToLetAccountLink
              href="/account/to-let"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-primary shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/5"
            >
              My Bookings <ArrowRight className="size-3.5" />
            </ToLetAccountLink>
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
                  আপনার rental review লিখুন
                </h3>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700 uppercase">
                Live
              </span>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
              আপনার accepted Booking-এর contract active বা completed হলে My
              Bookings-এর Details page থেকে feedback submit করুন। Feedback সেই
              rental record-এর সঙ্গে securely linked থাকবে।
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-lg">
                <ToLetAccountLink href="/account/to-let">
                  <MessageSquareText className="size-4" /> Review from My
                  Bookings
                </ToLetAccountLink>
              </Button>
              <Button asChild variant="outline" className="rounded-lg">
                <Link href="/to-let#listings">
                  Find a rental <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <p className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-5 text-blue-900">
              Existing rental comments are private to the owner and tenant. A
              future public review feed will require explicit public consent and
              moderation, so no sample testimonial is shown as real data here.
            </p>
          </div>

          <div className="bg-muted/20 p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                  Verified workflow
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  How feedback becomes verified
                </h3>
              </div>
              <ShieldCheck className="size-6 text-primary" />
            </div>

            <div className="mt-6 space-y-3">
              {feedbackSteps.map(
                ({ title, description, icon: Icon }, index) => (
                  <article
                    key={title}
                    className="rounded-xl border border-border bg-background p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
                        <Icon className="size-4.5" />
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 uppercase">
                        Step {index + 1}
                      </span>
                    </div>
                    <h4 className="mt-4 text-sm font-semibold">{title}</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </article>
                ),
              )}
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
                  "Direct owner call",
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
                <ToLetAccountLink href="/account/to-let/properties/new">
                  <Building2 className="size-4" /> Property Account তৈরি করুন
                </ToLetAccountLink>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full rounded-lg border-white/25 bg-white/10 text-white hover:bg-white hover:text-slate-950 sm:w-auto"
              >
                <ToLetAccountLink href="/account/to-let/properties">
                  <QrCode className="size-4" /> নতুন To-Let পোস্ট করুন
                </ToLetAccountLink>
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
