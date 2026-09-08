import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarCheck2,
  Car,
  ChevronRight,
  Eye,
  Home,
  KeyRound,
  type LucideIcon,
  MapPin,
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

// Match the public product homepage's server-side catalog cache.
export const revalidate = 60;

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
  {
    value: "garage",
    label: "Garage",
    banglaLabel: "গ্যারেজ",
    icon: Car,
  },
  {
    value: "other",
    label: "Other",
    banglaLabel: "অন্যান্য",
    icon: Shapes,
  },
];

export default async function ToLetPage({ searchParams }: ToLetPageProps) {
  const params = await searchParams;
  const { query, selectedType } = parseToLetSearchParams(params);
  let listingsUnavailable = false;
  let unitListings: UnitListing[] = [];

  try {
    unitListings = await listPublicToLetUnitListings(60);
  } catch {
    listingsUnavailable = true;
  }

  const { queryMatched: queryMatchedListings, filtered: filteredUnitListings } =
    filterToLetMarketplaceListings(unitListings, query, selectedType);
  const propertyCount = new Set(
    unitListings.map((listing) => listing.propertyCode),
  ).size;
  const areaNames = Array.from(
    new Map(
      unitListings
        .filter((listing) => listing.property.area.trim().length > 0)
        .map((listing) => [
          listing.property.area.trim().toLowerCase(),
          listing.property.area.trim(),
        ]),
    ).values(),
  );
  const availableListingCount = unitListings.filter(
    (listing) => listing.marketplaceStatus === "available",
  ).length;
  const mapListings = [...unitListings]
    .sort((left, right) =>
      left.marketplaceStatus === right.marketplaceStatus
        ? 0
        : left.marketplaceStatus === "available"
          ? -1
          : 1,
    )
    .slice(0, 4);
  const locationPins = areaNames.slice(0, 6);

  return (
    <div className="min-h-screen bg-zinc-50 text-foreground">
      <ToLetCatalogHero
        query={query}
        selectedType={selectedType}
        listings={queryMatchedListings}
      />

      <MarketplaceSnapshot
        listingCount={unitListings.length}
        availableListingCount={availableListingCount}
        propertyCount={propertyCount}
        areaCount={areaNames.length}
      />

      <RentalTypeDirectory listings={unitListings} query={query} />

      <section
        id="listings"
        aria-labelledby="recent-listings-heading"
        className="scroll-mt-28 border-y border-zinc-200 bg-white py-12 sm:py-16"
      >
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase">
                Curated listings
              </p>
              <h2
                id="recent-listings-heading"
                className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl"
              >
                সাম্প্রতিক ও ভেরিফাইড To-Let লিস্টিং
              </h2>
              <p className="mt-2 text-sm text-zinc-500">
                Available ও recently booked unit দেখুন, তারপর সরাসরি Call বা View
                Details করুন।
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/to-let#listings"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:underline hover:underline-offset-4"
              >
                See all listings <ArrowRight className="size-4" />
              </Link>
              <ToLetAlertDialog query={query} selectedType={selectedType} />
            </div>
          </div>

          <div className="mt-7 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
            <FilterChip
              href={toLetMarketHref(query)}
              active={!selectedType}
              label="All listings"
            />
            {rentalTypes.map((type) => (
              <FilterChip
                key={type.value}
                href={toLetMarketHref(query, type.value)}
                active={selectedType === type.value}
                label={type.label.replace(" To-Let", "")}
              />
            ))}
          </div>

          {query || selectedType ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              <Search className="size-4 text-blue-600" aria-hidden="true" />
              <span>
                {filteredUnitListings.length.toLocaleString("en-BD")} result(s)
                {query ? ` for “${query}”` : ""}
              </span>
              <Link
                href="/to-let#listings"
                className="ml-auto font-semibold text-blue-700 hover:underline"
              >
                Clear filters
              </Link>
            </div>
          ) : null}

          <div className="mt-7">
            {listingsUnavailable ? (
              <ListingMessage
                title="Listings are temporarily unavailable"
                description="The marketplace could not be loaded. Please try again in a moment."
                actionLabel="Try again"
                actionHref="/to-let#listings"
              />
            ) : filteredUnitListings.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredUnitListings.map((listing) => (
                  <PublicUnitListingCard
                    key={listing.listingCode}
                    listing={listing}
                  />
                ))}
              </div>
            ) : (
              <ListingMessage
                title="No matching listing"
                description="Try another location or rental type. New public listings appear here automatically."
                actionLabel="View all listings"
                actionHref="/to-let#listings"
              />
            )}
          </div>
        </div>
      </section>

      <ToLetLocationExplorer
        listings={mapListings}
        locationPins={locationPins}
        selectedType={selectedType}
        unavailable={listingsUnavailable}
      />

      <TenantJourney />

      <ToLetCommunityReviews />

      <OwnerCallToAction />
    </div>
  );
}

function ToLetCatalogHero({
  query,
  selectedType,
  listings,
}: {
  query: string;
  selectedType?: ToLetMarketRentalType;
  listings: UnitListing[];
}) {
  const visibleTypes = rentalTypes.slice(0, 6);

  return (
    <section className="bg-white">
      <div className="site-container px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
          <aside className="hidden min-h-[390px] overflow-hidden rounded-xl border border-zinc-200 bg-white lg:block">
            <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4 text-sm font-semibold text-zinc-950">
              <Building2 className="size-4 text-blue-600" />
              Browse rental types
            </div>
            <nav aria-label="Browse To-Let by rental type">
              {visibleTypes.map(({ value, label, icon: Icon }) => {
                const count = listings.filter(
                  (listing) => listing.unit.unitType === value,
                ).length;
                return (
                  <Link
                    key={value}
                    href={toLetMarketHref(query, value)}
                    className="flex min-h-14 items-center gap-3 border-b border-zinc-100 px-4 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-zinc-100 text-zinc-600">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {label}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-zinc-400">
                      {count}
                    </span>
                    <ChevronRight className="size-3.5 text-zinc-400" />
                  </Link>
                );
              })}
            </nav>
          </aside>

          <div className="relative min-h-[390px] overflow-hidden rounded-xl bg-zinc-800">
            <Image
              src="/images/to-let-hero.png"
              alt="A modern rental home at sunset"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 980px"
            />
            <div className="absolute inset-0 bg-zinc-950/65" />
            <div className="relative flex min-h-[390px] max-w-3xl flex-col justify-center px-6 py-9 text-white sm:px-10 lg:px-12">
              <p className="text-xs font-semibold tracking-[0.16em] text-blue-200 uppercase">
                Bikalpo To-Let
              </p>
              <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
                Bangladesh&apos;s most trusted digital To-Let platform
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-100 sm:text-base">
                Find, compare and contact the owner directly for your desired
                house, flat, sublet, shop, office or garage in one place. Send a
                Booking Request online.
              </p>

              <Form
                key={`${query}:${selectedType ?? "all"}`}
                action="/to-let#listings"
                className="mt-7 grid max-w-2xl gap-2 rounded-lg bg-white p-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto]"
              >
                <label className="relative block">
                  <span className="sr-only">Search To-Let listings</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="Area, property or listing ID"
                    className="h-11 w-full rounded-md border-0 bg-zinc-100 pl-10 pr-3 text-sm text-zinc-950 outline-none ring-blue-200 placeholder:text-zinc-500 focus:ring-4"
                  />
                </label>
                <label>
                  <span className="sr-only">Rental type</span>
                  <select
                    name="type"
                    defaultValue={selectedType ?? ""}
                    className="h-11 w-full rounded-md border-0 bg-zinc-100 px-3 text-sm text-zinc-700 outline-none ring-blue-200 focus:ring-4"
                  >
                    <option value="">All types</option>
                    {rentalTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <ToLetSearchButton className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60" />
              </Form>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                <Link
                  href="#listings"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-blue-600 px-4 font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Browse listings <ArrowRight className="size-4" />
                </Link>
                <ToLetAccountLink
                  href="/account/to-let/properties/new"
                  className="font-semibold text-white underline-offset-4 hover:underline"
                >
                  List your property
                </ToLetAccountLink>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto pb-1 lg:hidden">
          {visibleTypes.map(({ value, label, icon: Icon }) => (
            <Link
              key={value}
              href={toLetMarketHref(query, value)}
              className="flex min-w-36 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm font-medium text-zinc-700"
            >
              <Icon className="size-4 text-blue-600" />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function RentalTypeDirectory({
  listings,
  query,
}: {
  listings: UnitListing[];
  query: string;
}) {
  return (
    <section className="border-b border-zinc-200 bg-zinc-50 py-12 sm:py-16">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase">
          Explore rental types
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
          যে ধরনের ইউনিট খুঁজছেন, সেখান থেকেই শুরু করুন
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
          ফ্যামিলি, ব্যাচেলর, সাবলেট, অফিস, দোকান ও গুদামঘরসহ বিভিন্ন ধরনের To-Let
          Listing থেকে আপনার প্রয়োজন অনুযায়ী সঠিক ইউনিট নির্বাচন করুন।
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {rentalTypes.map(({ value, label, banglaLabel, icon: Icon }) => {
            const count = listings.filter(
              (listing) => listing.unit.unitType === value,
            ).length;
            return (
              <Link
                key={value}
                href={toLetMarketHref(query, value)}
                className="group flex min-h-24 items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-colors hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-blue-700 transition-colors group-hover:bg-blue-50">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-zinc-950">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">
                    {banglaLabel} · {count.toLocaleString("en-BD")}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MarketplaceSnapshot({
  listingCount,
  availableListingCount,
  propertyCount,
  areaCount,
}: {
  listingCount: number;
  availableListingCount: number;
  propertyCount: number;
  areaCount: number;
}) {
  const stats: ReadonlyArray<{
    label: string;
    value: number;
    description: string;
    icon: LucideIcon;
  }> = [
    {
      label: "Published listings",
      value: listingCount,
      description: "Live and recently booked units",
      icon: KeyRound,
    },
    {
      label: "Available to book",
      value: availableListingCount,
      description: "Accepting booking requests now",
      icon: CalendarCheck2,
    },
    {
      label: "Registered properties",
      value: propertyCount,
      description: "Properties represented by current listings",
      icon: Building2,
    },
    {
      label: "Areas represented",
      value: areaCount,
      description: "Locations covered by current listings",
      icon: MapPin,
    },
  ];

  return (
    <section
      aria-label="Current To-Let marketplace data"
      className="border-b border-zinc-200 bg-white"
    >
      <div className="site-container grid grid-cols-2 gap-3 px-4 py-7 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map(({ label, value, description, icon: Icon }) => (
          <article
            key={label}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-4 sm:px-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-mono text-2xl font-bold tabular-nums text-zinc-950">
                  {value.toLocaleString("en-BD")}
                </p>
                <h2 className="mt-1 text-sm font-semibold text-zinc-900">
                  {label}
                </h2>
                <p className="mt-1 hidden text-xs leading-5 text-zinc-500 sm:block">
                  {description}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TenantJourney() {
  const steps: ReadonlyArray<{
    title: string;
    details: readonly [string, string];
    icon: LucideIcon;
  }> = [
    {
      title: "Find listings",
      details: ["Location Search", "Map Search"],
      icon: Search,
    },
    {
      title: "View details",
      details: ["Property Details", "Photo Gallery"],
      icon: Eye,
    },
    {
      title: "Request a booking",
      details: ["Booking Request", "Select Date"],
      icon: CalendarCheck2,
    },
    {
      title: "Join as a tenant",
      details: ["Owner Approval", "Booking Confirm"],
      icon: BadgeCheck,
    },
  ];

  return (
    <section className="border-b border-zinc-200 bg-zinc-50 py-12 sm:py-16">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase">
          Tenant journey
        </p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            From listing search to digital booking and tenant connection
          </h2>
          <p className="text-sm font-medium text-zinc-500">
            Fewer steps, more assurance.
          </p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
          From finding verified listings to Booking Confirm, Tenant Link and
          Monthly Rent—a fully digital experience.
        </p>

        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ title, details, icon: Icon }, index) => (
            <li
              key={title}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-sm font-semibold text-zinc-400">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-5 font-semibold text-zinc-950">{title}</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-zinc-500">
                {details.map((detail) => (
                  <li key={detail} className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-blue-600" />
                    {detail}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function OwnerCallToAction() {
  return (
    <section className="bg-zinc-50 py-12 sm:py-16">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              একটি Property নিবন্ধন করুন, হাজারো ভাড়াটিয়ার কাছে পৌঁছান—এক প্ল্যাটফর্মে
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-600">
              Bikalpo-তে Property Account তৈরি করে আপনার ফ্ল্যাট, বাসা, অফিস, দোকান,
              গ্যারেজ, গুদাম বা যেকোনো ভাড়ার ইউনিটের জন্য Verified Listing প্রকাশ করুন।
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-500">
              Permanent Property ID, QR Code, Smart Booking, Social Media Share
              এবং Tenant Management—সবকিছু এক জায়গায়।
            </p>
          </div>
          <div className="grid min-w-64 gap-3">
            <Button asChild size="lg" className="rounded-md">
              <ToLetAccountLink href="/account/to-let/properties/new">
                Property Account তৈরি করুন <ArrowRight className="size-4" />
              </ToLetAccountLink>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-md">
              <ToLetAccountLink href="/account/to-let/properties">
                নতুন To-Let পোস্ট করুন <ArrowRight className="size-4" />
              </ToLetAccountLink>
            </Button>
          </div>
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
      className={`inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-blue-300 hover:text-blue-700"
      }`}
    >
      {label}
    </Link>
  );
}

function ListingMessage({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="border border-dashed border-zinc-300 bg-zinc-50 px-6 py-14 text-center">
      <Building2 className="mx-auto size-9 text-zinc-400" />
      <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
        {description}
      </p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex min-h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
