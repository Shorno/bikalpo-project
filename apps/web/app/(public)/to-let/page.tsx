import {
  ArrowRight,
  Bell,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarCheck2,
  Car,
  ChevronRight,
  Eye,
  Home,
  KeyRound,
  LayoutGrid,
  Plus,
  type LucideIcon,
  Search,
  Shapes,
  Store,
  Users,
  Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import { ToLetHeroBanner } from "@/components/features/to-let/to-let-hero-banner";
import type { ToLetBannerSlide } from "@bikalpo-project/api/lib/tolet-banner";
import Link from "next/link";
import { LandingListingGrid } from "@/components/features/to-let/landing-listing-grid";
import { AlertDashboardLink } from "@/components/features/to-let/alerts/alert-dashboard-link";
import { RentalTypeCarousel } from "@/components/features/to-let/rental-type-carousel";
import { ToLetAccountLink } from "@/components/features/to-let/to-let-account-link";
import { ToLetCommunityReviews } from "@/components/features/to-let/to-let-community-reviews";
import { ToLetLocationExplorer } from "@/components/features/to-let/to-let-location-explorer";
import { ToLetSearchButton } from "@/components/features/to-let/to-let-search-button";
import { toLetChip, toLetChipRow, toLetInverseButton, toLetMobileSecondary, toLetPrimaryButton } from "@/components/features/to-let/to-let-button";
import { listPublicToLetUnitListings } from "@/lib/public-data";
import { getPublicOrpcClient } from "@/lib/orpc/public-server";
import {
  filterToLetMarketplaceListings,
  parseToLetSearchParams,
  type ToLetMarketplaceSearchParams,
  type ToLetMarketRentalType,
  toLetMarketHref,
  toLetBrowseHref,
} from "@/lib/to-let-marketplace";
import styles from "./to-let-mobile.module.css";

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
  { value: "family_sublet", label: "Family Sub-Let", banglaLabel: "ফ্যামিলি সাবলেট", icon: Home },
  { value: "bachelor_sublet", label: "Bachelor Sub-Let", banglaLabel: "ব্যাচেলর সাবলেট", icon: Users },
  { value: "factory", label: "Factory", banglaLabel: "কারখানা", icon: Warehouse },
];

export default async function ToLetPage({ searchParams }: ToLetPageProps) {
  const params = await searchParams;
  const { query, selectedType } = parseToLetSearchParams(params);
  let listingsUnavailable = false;
  let unitListings: UnitListing[] = [];
  const [catalogResult, results, platformResult, bannerResult] = await Promise.allSettled([
    listPublicToLetUnitListings(60),
    getPublicOrpcClient(60).toLetUnitListing.listPublicPage({ page: 1, limit: selectedType ? 4 : 8, q: query, type: selectedType }),
    getPublicOrpcClient(60).landing.getPlatformStats(),
    getPublicOrpcClient(60).toLetBanner.getPublic(),
  ]);
  if (catalogResult.status === "fulfilled") unitListings = catalogResult.value;
  listingsUnavailable = results.status === "rejected";
  const filteredUnitListings = results.status === "fulfilled" ? results.value.listings : [];
  const resultCount = results.status === "fulfilled" ? results.value.total : 0;
  const { queryMatched: queryMatchedListings } =
    filterToLetMarketplaceListings(unitListings, query, selectedType);
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
    <div className={`${styles.landing} min-h-screen bg-muted/30 text-foreground`}>
      <ToLetCatalogHero
        query={query}
        selectedType={selectedType}
        listings={queryMatchedListings}
        slides={bannerResult.status === "fulfilled" ? bannerResult.value.slides : []}
      />

      <section
        id="listings"
        aria-labelledby="recent-listings-heading"
        className="scroll-mt-28 border-y border-border bg-card pb-12 pt-8 sm:pb-16 sm:pt-10"
      >
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="recent-listings-heading"
                className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-3xl"
              >
                সাম্প্রতিক ও ভেরিফাইড To-Let লিস্টিং
              </h2>
              {!listingsUnavailable ? (
                <p className="mt-1.5 text-sm text-muted-foreground" role="status">
                  <span className="font-mono font-semibold tabular-nums text-foreground">
                    {resultCount.toLocaleString("en-BD")}
                  </span>{" "}
                  {resultCount === 1 ? "listing" : "listings"}
                  {selectedType ? ` · ${rentalTypes.find(type => type.value === selectedType)?.label}` : ""}
                  {query ? ` for “${query}”` : ""}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={toLetBrowseHref(query, selectedType)}
                className={`${toLetPrimaryButton} max-sm:hidden`}
              >
                <LayoutGrid className="size-4" aria-hidden="true" /> See all listings
              </Link>
            </div>
          </div>

          <div className="relative mt-6 md:hidden">
            <nav aria-label="Listing categories" className={`flex gap-2 overflow-x-auto pr-7 [&>*]:shrink-0 [&>*]:whitespace-nowrap ${toLetChipRow}`}>
              <FilterChip href={toLetMarketHref(query)} active={!selectedType} label="All" />
              {rentalTypes.map(type => (
                <FilterChip key={type.value} href={toLetMarketHref(query, type.value)} active={selectedType === type.value} label={type.label.replace(" To-Let", "")} />
              ))}
            </nav>
            <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 flex h-full w-7 items-center justify-end bg-card"><ArrowRight className="size-4 text-muted-foreground" /></span>
          </div>
          <div className="mt-6 hidden flex-wrap items-start gap-2 md:flex">
            <FilterChip
              href={toLetMarketHref(query)}
              active={!selectedType}
              label="All listings"
            />
            {rentalTypes.filter(type => ["family_flat", "bachelor_room", "sublet"].includes(type.value)).map((type) => (
              <FilterChip
                key={type.value}
                href={toLetMarketHref(query, type.value)}
                active={selectedType === type.value}
                label={type.label.replace(" To-Let", "")}
              />
            ))}
            {[
              { label: "Commercial", values: ["shop", "office", "warehouse", "garage", "factory"] },
              { label: "More", values: ["family_sublet", "bachelor_sublet", "other"] },
            ].map(group => (
              <details key={group.label} className="relative">
                <summary className={`cursor-pointer list-none ${toLetChip(Boolean(selectedType && group.values.includes(selectedType)))}`}>
                  {selectedType && group.values.includes(selectedType) ? rentalTypes.find(item => item.value === selectedType)?.label : group.label}
                  <ChevronRight className="size-3.5 rotate-90" aria-hidden="true" />
                </summary>
                <div className="absolute left-0 top-full z-20 mt-2 min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md">
                  {rentalTypes.filter(type => group.values.includes(type.value)).map(type => (
                    <Link key={type.value} href={toLetMarketHref(query, type.value)} aria-current={selectedType === type.value ? "page" : undefined} className="flex min-h-11 items-center rounded-md px-3 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">{type.label}</Link>
                  ))}
                </div>
              </details>
            ))}
          </div>

          {(query || selectedType) && !listingsUnavailable ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Search className="size-4" aria-hidden="true" />
              <span>Filtered results</span>
              <Link
                href="/to-let#listings"
                className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
              >
                Clear filters
              </Link>
            </div>
          ) : null}

          <div className="mt-6">
            {listingsUnavailable ? (
              <ListingMessage
                title="Listings are temporarily unavailable"
                description="The marketplace could not be loaded. Please try again in a moment."
                actionLabel="Try again"
                actionHref={toLetBrowseHref(query, selectedType)}
              />
            ) : filteredUnitListings.length > 0 ? (
              <LandingListingGrid key={`${query}:${selectedType ?? "all"}`} initialListings={filteredUnitListings} total={resultCount} query={query} type={selectedType} />
            ) : (
              <ListingMessage
                title="No matching listing"
                description="Try another location or rental type. New public listings appear here automatically."
                actionLabel="View all listings"
                actionHref="/to-let/listings"
              />
            )}
          </div>
        </div>
      </section>

      <ToLetLocationExplorer
        listings={mapListings}
        locationPins={locationPins}
        selectedType={selectedType}
        unavailable={catalogResult.status === "rejected"}
      />

      <PlatformSnapshot
        stats={platformResult.status === "fulfilled" ? platformResult.value : null}
      />

      <RentalTypeDirectory listings={queryMatchedListings} query={query} />

      <section aria-labelledby="to-let-alert-heading" className="border-b border-border bg-card py-6 sm:py-8">
        <div className="site-container flex flex-col gap-5 px-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary"><Bell className="size-5" aria-hidden="true" /></span>
            <div className="max-w-2xl">
              <h2 id="to-let-alert-heading" className="text-lg font-semibold text-foreground">পছন্দের বাসার খবর পেতে To-Let Alert</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Dashboard-এ এলাকা, ইউনিটের ধরন ও প্রয়োজন অনুযায়ী alert তৈরি করুন। আপনার শর্তের সঙ্গে মিলে নতুন listing এলে alert dashboard-এ notification দেখতে পারবেন। সেখান থেকেই alert যোগ, pause বা delete করা যাবে।</p>
            </div>
          </div>
          <AlertDashboardLink />
        </div>
      </section>

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
  slides,
}: {
  query: string;
  selectedType?: ToLetMarketRentalType;
  listings: UnitListing[];
  slides: ToLetBannerSlide[];
}) {
  const visibleTypes = rentalTypes.slice(0, 6);

  return (
    <section className={`${styles.hero} bg-card`}>
      <div className="site-container px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
          <aside className="hidden min-h-[460px] overflow-hidden rounded-xl border border-border bg-card lg:block">
            <div className="flex h-14 items-center gap-2 border-b border-border px-4 text-sm font-semibold text-foreground">
              <Building2 className="size-4 text-primary" />
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
                    className="flex min-h-14 items-center gap-3 border-b border-border px-4 text-sm text-foreground transition-colors hover:bg-muted/30 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                  >
                    <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {label}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {count}
                    </span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </Link>
                );
              })}
            </nav>
          </aside>

          <ToLetHeroBanner slides={slides} className={`${styles.heroBanner} relative min-h-[420px] overflow-hidden rounded-xl bg-zinc-800 sm:min-h-[460px]`}>

              <Form
                key={`${query}:${selectedType ?? "all"}`}
                action="/to-let#listings"
                className="mt-7 grid max-w-2xl gap-2 rounded-lg bg-card p-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto]"
              >
                <label className="relative block">
                  <span className="sr-only">Search To-Let listings</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="Area, property or listing ID"
                    className="h-11 w-full rounded-md border-0 bg-muted pl-10 pr-3 text-sm text-foreground outline-none ring-ring placeholder:text-muted-foreground focus:ring-4"
                  />
                </label>
                <label>
                  <span className="sr-only">Rental type</span>
                  <select
                    name="type"
                    defaultValue={selectedType ?? ""}
                    className="h-11 w-full rounded-md border-0 bg-muted px-3 text-sm text-foreground outline-none ring-ring focus:ring-4"
                  >
                    <option value="">All types</option>
                    {rentalTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <ToLetSearchButton className={`${toLetPrimaryButton} h-11 px-5`} />
              </Form>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                <Link
                  href="#listings"
                  className={`${toLetPrimaryButton} focus-visible:outline-white`}
                >
                  <LayoutGrid className="size-4" aria-hidden="true" /> Browse listings
                </Link>
                <ToLetAccountLink
                  href="/account/to-let/properties/new"
                  className={toLetInverseButton}
                >
                  <Plus className="size-4" aria-hidden="true" /> List your property
                </ToLetAccountLink>
              </div>
          </ToLetHeroBanner>
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
    <section aria-labelledby="rental-types-heading" className="border-b border-border bg-card py-10 sm:py-14">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <h2 id="rental-types-heading" className="text-xl font-bold tracking-tight text-balance text-foreground sm:text-2xl">
          যে ধরনের ইউনিট খুঁজছেন, সেখান থেকেই শুরু করুন
        </h2>

        <RentalTypeCarousel>
          {rentalTypes.map(({ value, label, banglaLabel, icon: Icon }) => {
            const count = listings.filter(
              (listing) => listing.unit.unitType === value,
            ).length;
            return (
              <Link
                key={value}
                href={toLetMarketHref(query, value)}
                aria-label={`${label}, ${count} ${count === 1 ? "listing" : "listings"}`}
                className="group flex min-h-20 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {banglaLabel}
                  </span>
                </span>
                <span
                  className={`font-mono text-sm font-semibold tabular-nums ${count > 0 ? "text-foreground" : "text-muted-foreground/60"}`}
                  aria-hidden="true"
                >
                  {count.toLocaleString("en-BD")}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            );
          })}
        </RentalTypeCarousel>
      </div>
    </section>
  );
}

function PlatformSnapshot({
  stats,
}: {
  stats: { registeredUsers: number; activeSellers: number; productsAndServices: number; dailyOrders: number } | null;
}) {
  const items = [
    { label: "Registered Users", value: stats?.registeredUsers },
    { label: "Active Sellers", value: stats?.activeSellers },
    { label: "Products & Services", value: stats?.productsAndServices },
    { label: "Daily Orders", value: stats?.dailyOrders },
  ];

  return (
    <section
      aria-label="Bikalpo platform statistics"
      className="border-b border-border bg-muted/30"
    >
      <div className="site-container px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
          {items.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col-reverse gap-1 bg-card px-4 py-4 sm:px-6 sm:py-5"
            >
              <dt className="text-xs font-medium text-muted-foreground sm:text-sm">
                {label}
              </dt>
              <dd className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {value === undefined ? "—" : value.toLocaleString("en-BD")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {!stats && (
        <p className="site-container px-4 pb-5 text-xs text-muted-foreground sm:px-6 lg:px-8" role="status">
          Platform statistics are temporarily unavailable.
        </p>
      )}
    </section>
  );
}

function TenantJourney() {
  const steps: ReadonlyArray<{
    title: string;
    icon: LucideIcon;
  }> = [
    {
      title: "Find listings",
      icon: Search,
    },
    {
      title: "View details",
      icon: Eye,
    },
    {
      title: "Request a booking",
      icon: CalendarCheck2,
    },
    {
      title: "Join as a tenant",
      icon: BadgeCheck,
    },
  ];

  return (
    <section id="to-let-journey" className="border-b border-border bg-muted/30 py-12 sm:py-16">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-balance text-foreground sm:text-3xl">
          Your To-Let Journey
        </h2>
        <p className="mt-2 max-w-[70ch] text-sm leading-6 text-muted-foreground">
          From listing search to digital booking and tenant connection
        </p>

        <ol className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ title, icon: Icon }, index) => (
            <li
              key={title}
              className="relative flex items-center gap-3 rounded-lg border border-border bg-card p-4 sm:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                  Step {index + 1}
                </span>
                <h3 className="mt-0.5 font-semibold text-foreground">{title}</h3>
              </span>
              {index < steps.length - 1 ? (
                <ArrowRight
                  className="hidden size-4 shrink-0 text-muted-foreground lg:block"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function OwnerCallToAction() {
  return (
    <section id="register-property" className="bg-muted/30 py-12 sm:py-16">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-xl border border-border bg-card p-5 sm:gap-8 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
          <div className="max-w-3xl">
            <h2 className="text-2xl leading-snug font-bold tracking-tight text-balance text-foreground sm:text-3xl">
              একটি Property নিবন্ধন করুন, হাজারো ভাড়াটিয়ার কাছে পৌঁছান—এক প্ল্যাটফর্মে
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Bikalpo-তে Property Account তৈরি করে আপনার ফ্ল্যাট, বাসা, অফিস, দোকান,
              গ্যারেজ, গুদাম বা যেকোনো ভাড়ার ইউনিটের জন্য Verified Listing প্রকাশ করুন।
            </p>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Permanent Property ID, QR Code, Smart Booking, Social Media Share
              এবং Tenant Management—সবকিছু এক জায়গায়।
            </p>
          </div>
          <div className="grid min-w-0 gap-3 sm:min-w-64">
            <ToLetAccountLink href="/account/to-let/properties/new" className={`${toLetPrimaryButton} min-h-11`}>
              <Building2 className="size-4" aria-hidden="true" /> Property Account তৈরি করুন
            </ToLetAccountLink>
            <ToLetAccountLink href="/account/to-let/properties" className={`${toLetPrimaryButton} ${toLetMobileSecondary} min-h-11`}>
              <Plus className="size-4" aria-hidden="true" /> নতুন To-Let পোস্ট করুন
            </ToLetAccountLink>
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
      className={toLetChip(active)}
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
    <div className="border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <Building2 className="mx-auto size-9 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <Link
        href={actionHref}
        className={`${toLetPrimaryButton} mt-5`}
      >
        {actionLabel}
      </Link>
    </div>
  );
}
