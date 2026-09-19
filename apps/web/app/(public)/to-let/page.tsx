import {
  ArrowRight,
  Bell,
  ArrowDown,
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
import { Button } from "@/components/ui/button";
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

      <PlatformSnapshot
        stats={platformResult.status === "fulfilled" ? platformResult.value : null}
      />

      <RentalTypeDirectory listings={queryMatchedListings} query={query} />

      <section
        id="listings"
        aria-labelledby="recent-listings-heading"
        className="scroll-mt-28 border-y border-border bg-card py-12 sm:py-16"
      >
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                Curated listings
              </p>
              <h2
                id="recent-listings-heading"
                className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              >
                সাম্প্রতিক ও ভেরিফাইড To-Let লিস্টিং
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={toLetBrowseHref(query, selectedType)}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary hover:underline hover:underline-offset-4"
              >
                See all listings <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          <div className="relative mt-7 md:hidden">
            <nav aria-label="Listing categories" className="flex gap-2 overflow-x-auto pb-2 pr-7 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
              <FilterChip href={toLetMarketHref(query)} active={!selectedType} label="All" />
              {rentalTypes.map(type => (
                <FilterChip key={type.value} href={toLetMarketHref(query, type.value)} active={selectedType === type.value} label={type.label.replace(" To-Let", "")} />
              ))}
            </nav>
            <span aria-hidden="true" className="pointer-events-none absolute right-0 top-0 flex h-10 w-6 items-center justify-center bg-background"><ArrowRight className="size-4" /></span>
          </div>
          <div className="mt-7 hidden flex-wrap items-start gap-2 md:flex">
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
                <summary className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring ${selectedType && group.values.includes(selectedType) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}>
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

          {!listingsUnavailable ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <Search className="size-4 text-primary" aria-hidden="true" />
              <span>
                {resultCount.toLocaleString("en-BD")} result(s)
                {selectedType ? ` · ${rentalTypes.find(type => type.value === selectedType)?.label}` : ""}
                {query ? ` for “${query}”` : ""}
              </span>
              {(query || selectedType) && <Link
                href="/to-let#listings"
                className="ml-auto font-semibold text-primary hover:underline"
              >
                Clear filters
              </Link>}
            </div>
          ) : null}

          <div className="mt-7">
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

      <ToLetLocationExplorer
        listings={mapListings}
        locationPins={locationPins}
        selectedType={selectedType}
        unavailable={catalogResult.status === "rejected"}
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
                <ToLetSearchButton className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60" />
              </Form>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm">
                <Link
                  href="#listings"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
    <section className="border-b border-border bg-muted/30 py-12 sm:py-16">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
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
                className="group flex min-h-24 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-ring hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-secondary group-hover:text-secondary-foreground group-focus-visible:bg-secondary group-focus-visible:text-secondary-foreground">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {banglaLabel} · {count.toLocaleString("en-BD")}
                  </span>
                </span>
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
      className="border-b border-border bg-card"
    >
      <div className="site-container grid grid-cols-2 gap-3 px-4 py-7 sm:px-6 lg:grid-cols-4 lg:px-8">
        {items.map(({ label, value }) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card px-3 py-4 sm:px-5"
          >
              <div className="min-w-0">
                <p className="font-mono text-2xl font-bold tabular-nums text-foreground">
                  {value === undefined ? "—" : value.toLocaleString("en-BD")}
                </p>
                <h2 className="mt-1 text-sm font-semibold text-foreground">
                  {label}
                </h2>
              </div>
          </article>
        ))}
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
        <h2 className="text-center text-xl font-semibold md:hidden">Your To-Let Journey</h2>
        <p className="hidden text-xs font-semibold tracking-[0.14em] text-primary uppercase md:block">
          Tenant journey
        </p>
        <div className="mt-2 hidden flex-col gap-3 md:flex lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            From listing search to digital booking and tenant connection
          </h2>
        </div>

        <ol className="mt-6 space-y-3 text-center md:hidden">
          {["Find Listing", "View Details", "Booking Request", "Join / Move In"].map((label, index) => <li key={label}>
            <div className="flex items-center justify-center gap-3 py-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-sm font-semibold">{index + 1}</span><span className="font-medium">{label}</span></div>
            {index < 3 && <ArrowDown className="mx-auto mt-2 size-4 text-muted-foreground" aria-hidden="true" />}
          </li>)}
        </ol>
        <ol className="mt-8 hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ title, icon: Icon }, index) => (
            <li
              key={title}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="min-w-0 flex-1 font-semibold text-foreground">{title}</h3>
                <span className="shrink-0 font-mono text-sm font-semibold text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
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
        <Button asChild size="lg" className="min-h-12 w-full md:hidden"><ToLetAccountLink href="/account/to-let/properties/new">Register Property <ArrowRight className="size-4" /></ToLetAccountLink></Button>
        <div className="hidden gap-8 rounded-xl border border-border bg-card p-6 sm:p-8 md:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
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
      className={`inline-flex min-h-10 shrink-0 items-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        active
          ? "border-primary bg-primary text-white"
          : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:text-primary"
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
    <div className="border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <Building2 className="mx-auto size-9 text-muted-foreground" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
