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
  QrCode,
  Search,
  Shapes,
  Store,
  Users,
  Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { PublicUnitListingCard } from "@/components/features/to-let/public-unit-listing-card";
import { ToLetAccountLink } from "@/components/features/to-let/to-let-account-link";
import { ToLetAlertDialog } from "@/components/features/to-let/to-let-alert-dialog";
import { ToLetCommunityReviews } from "@/components/features/to-let/to-let-community-reviews";
import { ToLetLocationExplorer } from "@/components/features/to-let/to-let-location-explorer";
import { ToLetSearchButton } from "@/components/features/to-let/to-let-search-button";
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
    description: "Use Location Search or Map Search to find the right unit.",
    icon: Search,
    phase: "live",
  },
  {
    title: "View details",
    description: "Review property details, photo gallery, rent and facilities.",
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
    description:
      "Owner approval confirms booking and links the tenant account.",
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
    <div
      className="min-h-screen bg-stone-50/45 text-foreground selection:bg-emerald-200 selection:text-emerald-950 [&_input]:caret-emerald-600 [&_textarea]:caret-emerald-600"
      style={
        {
          "--primary": "oklch(0.46 0.13 158)",
          "--primary-foreground": "oklch(0.985 0.008 145)",
          "--ring": "oklch(0.52 0.14 158)",
        } as CSSProperties
      }
    >
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
        className="scroll-mt-32 border-y border-stone-200/80 bg-white py-14 sm:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="সাম্প্রতিক ও ভেরিফাইড To-Let লিস্টিং"
            description="নতুন listing publish হওয়ার পর ৩০ দিন দেখা যাবে। Booking confirm হলে Booked status-সহ নতুন ৩০ দিন থাকবে; Booked unit নতুন request নেয় না।"
            action={
              <Link
                href="/to-let#listings"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline hover:underline-offset-4"
              >
                See all listings <ArrowRight className="size-4" />
              </Link>
            }
          />

          <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav
              aria-label="Filter listings by rental type"
              className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0"
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
              className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-12 text-center"
            >
              <Building2 className="mx-auto size-10 text-amber-600" />
              <h3 className="mt-4 text-lg font-semibold text-amber-950">
                Listings are temporarily unavailable
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-amber-800">
                The marketplace data could not be loaded. Try again now or save
                your search as an alert; the selected filters stay in the URL.
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <a
                  href="/to-let#listings"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-amber-950 px-4 text-sm font-semibold text-white hover:bg-amber-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-950"
                >
                  Try again
                </a>
                <ToLetAlertDialog query={query} selectedType={selectedType} />
              </div>
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
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
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

      <ToLetCommunityReviews />

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
    <section className="border-b border-stone-200/80 bg-stone-50/60">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="relative min-h-[470px] overflow-hidden rounded-2xl border border-emerald-950/10 bg-zinc-950 sm:min-h-[500px]">
          <Image
            src="/images/to-let-hero.png"
            alt="Modern apartment overlooking Dhaka for Bikalpo To-Let"
            fill
            priority
            className="object-cover saturate-[0.78]"
            sizes="(max-width: 1280px) 100vw, 1280px"
          />
          <div className="absolute inset-0 bg-zinc-950/70" />
          <div className="relative flex min-h-[470px] max-w-3xl flex-col justify-center px-6 py-10 text-white sm:min-h-[500px] sm:px-10 lg:px-12">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200/30 bg-emerald-950/45 px-3 py-1.5 text-xs font-semibold tracking-[0.12em] text-emerald-100 uppercase">
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

            <Form
              key={`${query}:${selectedType ?? "all"}`}
              action="/to-let#listings"
              className="mt-8 grid gap-2 rounded-xl border border-white/25 bg-white p-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
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
                  className="h-11 w-full rounded-lg border-0 bg-stone-50 pl-10 pr-3 text-sm text-stone-900 outline-none ring-primary/20 placeholder:text-stone-400 focus:ring-4"
                />
              </label>
              <label>
                <span className="sr-only">Rental type</span>
                <select
                  name="type"
                  defaultValue={selectedType ?? ""}
                  className="h-11 w-full rounded-lg border-0 bg-stone-50 px-3 text-sm text-stone-700 outline-none ring-primary/20 focus:ring-4"
                >
                  <option value="">All rental types</option>
                  {rentalTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </label>
              <ToLetSearchButton className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2" />
            </Form>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-h-11 rounded-lg">
                <Link href="#listings">
                  Browse listings <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-11 rounded-lg border-white/30 bg-white/10 text-white hover:bg-emerald-50 hover:text-emerald-950"
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
      className="bg-stone-50/60"
    >
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, description, icon: Icon }) => (
            <article
              key={label}
              className="rounded-xl border border-stone-200 bg-white p-5 transition-colors hover:border-emerald-300"
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
    <section className="border-y border-emerald-100 bg-emerald-50/35 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
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
                  className="group flex min-h-44 flex-col rounded-xl border border-emerald-100 bg-white p-4 transition-colors duration-200 hover:border-emerald-300 hover:bg-emerald-50/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
      className={`min-h-11 shrink-0 snap-start rounded-full border px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
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
    <section className="border-y border-emerald-100 bg-emerald-50/30 py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="From Listing Search to Digital Booking and Tenant Connection"
          description="Fewer steps, more assurance—from verified listing search and booking confirmation to tenant connection and the monthly digital rent workflow."
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
                  className="relative h-full rounded-xl border border-emerald-100 bg-white p-5"
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
                  className="rounded-xl transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {card}
                </ToLetAccountLink>
              ) : (
                <Link
                  key={title}
                  href={href}
                  prefetch={false}
                  className="rounded-xl transition-colors hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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

function OwnerCallToAction() {
  return (
    <section className="bg-stone-50/60 py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-emerald-900 bg-emerald-950 px-6 py-10 text-emerald-50 sm:px-10 sm:py-14 lg:px-14">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl">
                একটি Property নিবন্ধন করুন, হাজারো ভাড়াটিয়ার কাছে পৌঁছান—এক প্ল্যাটফর্মে।
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-100/80 sm:text-base">
                Bikalpo-তে Property Account তৈরি করে আপনার ফ্ল্যাট, বাসা, অফিস, দোকান,
                গ্যারেজ, গুদাম বা যেকোনো ভাড়ার ইউনিটের জন্য Verified Listing প্রকাশ করুন।
                Permanent Property ID, QR Code, Smart Booking, Social Media
                Share এবং Tenant Management—সবকিছু এক জায়গায়।
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-xs text-emerald-100/85">
                {[
                  "Verified Listing",
                  "Permanent Property ID",
                  "QR Code",
                  "Smart Booking",
                  "Social Media Share",
                  "Tenant Management",
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
                className="min-h-11 w-full rounded-lg bg-white text-emerald-900 hover:bg-emerald-50 sm:w-auto"
              >
                <ToLetAccountLink href="/account/to-let/properties/new">
                  <Building2 className="size-4" /> Property Account তৈরি করুন
                </ToLetAccountLink>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="min-h-11 w-full rounded-lg border-emerald-200/30 bg-emerald-900 text-emerald-50 hover:bg-emerald-50 hover:text-emerald-950 sm:w-auto"
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
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 sm:mb-10 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <h2
          id={
            title === "সাম্প্রতিক ও ভেরিফাইড To-Let লিস্টিং"
              ? "curated-listings-heading"
              : undefined
          }
          className="text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl"
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
