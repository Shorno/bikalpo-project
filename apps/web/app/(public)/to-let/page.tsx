import {
  Bell,
  Briefcase,
  Building2,
  Car,
  Home,
  KeyRound,
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
import Link from "next/link";
import { LandingListingGrid } from "@/components/features/to-let/landing-listing-grid";
import { AlertDashboardLink } from "@/components/features/to-let/alerts/alert-dashboard-link";
import { ToLetAccountLink } from "@/components/features/to-let/to-let-account-link";
import { ToLetCategoryScroller } from "@/components/features/to-let/to-let-category-scroller";
import { ToLetCommunityReviews } from "@/components/features/to-let/to-let-community-reviews";
import { ToLetLocationExplorer } from "@/components/features/to-let/to-let-location-explorer";
import { ToLetMarketHero } from "@/components/features/to-let/to-let-market-hero";
import { ToLetSearchButton } from "@/components/features/to-let/to-let-search-button";
import { toLetChip, toLetMobileSecondary, toLetPrimaryButton } from "@/components/features/to-let/to-let-button";
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
    getPublicOrpcClient(60).toLetUnitListing.listPublicPage({ page: 1, limit: 12, q: query, type: selectedType }),
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

  // The location select offers known areas; keep a typed query selectable too.
  const areaOptions =
    query && !areaNames.some((area) => area.toLowerCase() === query.toLowerCase())
      ? [query, ...areaNames]
      : areaNames;
  const searchField =
    "h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className={`${styles.landing} min-h-screen bg-muted/30 pb-4 text-foreground`}>
      <ToLetMarketHero slides={bannerResult.status === "fulfilled" ? bannerResult.value.slides : []}>
        <Form
          key={`${query}:${selectedType ?? "all"}`}
          action="/to-let#listings"
          className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-2 shadow-lg sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] sm:p-2.5"
        >
          <label>
            <span className="sr-only">Rental type</span>
            <select name="type" defaultValue={selectedType ?? ""} className={searchField}>
              <option value="">Select Type</option>
              {rentalTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label.replace(" To-Let", "")}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Area</span>
            <select name="q" defaultValue={query} className={searchField}>
              <option value="">Select Area</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </label>
          <ToLetSearchButton className={`${toLetPrimaryButton} col-span-2 h-11 px-4 sm:col-span-1 sm:px-5`} />
        </Form>
      </ToLetMarketHero>

      <section
        id="listings"
        aria-labelledby="recent-listings-heading"
        className="scroll-mt-28 pt-8 pb-10 sm:pt-10 sm:pb-14"
      >
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <h2 id="recent-listings-heading" className="sr-only">
            To-Let listings
          </h2>
          <div className="flex justify-end">
            <AlertDashboardLink />
          </div>
          <div className="mt-4">
            <ToLetCategoryScroller label="Listing categories">
              <FilterChip href={toLetMarketHref(query)} active={!selectedType} label="All" />
              {categoryOrder.map((value) => {
                const type = rentalTypes.find((item) => item.value === value);
                return type ? (
                  <FilterChip
                    key={type.value}
                    href={toLetMarketHref(query, type.value)}
                    active={selectedType === type.value}
                    label={type.label.replace(" To-Let", "")}
                  />
                ) : null;
              })}
            </ToLetCategoryScroller>
          </div>

          {(query || selectedType) && !listingsUnavailable ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground" role="status">
              <Search className="size-4" aria-hidden="true" />
              <span>
                <span className="font-semibold tabular-nums text-foreground">
                  {resultCount.toLocaleString("en-BD")}
                </span>{" "}
                {resultCount === 1 ? "listing" : "listings"}
                {selectedType ? ` · ${rentalTypes.find((type) => type.value === selectedType)?.label}` : ""}
                {query ? ` in “${query}”` : ""}
              </span>
              <Link
                href="/to-let#listings"
                className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
              >
                Clear filters
              </Link>
            </div>
          ) : null}

          <div className="mt-5">
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

      <section aria-labelledby="to-let-alert-heading" className="pb-6 sm:pb-8">
        <div className="site-container px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-2xl border border-primary/15 bg-linear-to-br from-primary/[0.07] via-card to-card p-4 sm:p-6 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-4 md:gap-y-1.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm md:row-span-2 md:size-11 md:self-start">
              <Bell className="size-5" aria-hidden="true" />
            </span>
            <h2 id="to-let-alert-heading" data-slot="alert-title" className="min-w-0 text-base leading-snug font-bold text-balance text-foreground md:text-lg">
              পছন্দের বাসার খবর পেতে To-Let Alert
            </h2>
            <p className="col-span-2 max-w-2xl text-[13px] leading-6 text-muted-foreground md:col-span-1 md:col-start-2 md:text-sm">
              Dashboard-এ এলাকা, ইউনিটের ধরন ও প্রয়োজন অনুযায়ী alert তৈরি করুন। আপনার শর্তের সঙ্গে মিলে নতুন listing এলে alert dashboard-এ notification দেখতে পারবেন। সেখান থেকেই alert যোগ, pause বা delete করা যাবে।
            </p>
            <div className="col-span-2 mt-1 md:col-span-1 md:col-start-3 md:row-span-2 md:row-start-1 md:mt-0 md:self-center [&>a]:w-full md:[&>a]:w-auto">
              <AlertDashboardLink />
            </div>
          </div>
        </div>
      </section>

      <ToLetLocationExplorer
        listings={mapListings}
        locationPins={locationPins}
        selectedType={selectedType}
        unavailable={catalogResult.status === "rejected"}
      />

      <TenantJourney />

      <PlatformSnapshot
        stats={platformResult.status === "fulfilled" ? platformResult.value : null}
      />

      <ToLetCommunityReviews />

      <OwnerCallToAction />
    </div>
  );
}

/** Chip order on the landing page, matching how tenants search. */
const categoryOrder: ReadonlyArray<ToLetMarketRentalType> = [
  "family_flat",
  "bachelor_room",
  "family_sublet",
  "bachelor_sublet",
  "sublet",
  "shop",
  "office",
  "warehouse",
  "garage",
  "factory",
  "other",
];

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
    <section aria-label="Bikalpo platform statistics" className="pb-6 sm:pb-8">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {items.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col-reverse items-center gap-1 rounded-2xl border border-border bg-card px-3 py-5 text-center sm:py-6"
            >
              <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
              <dd className="text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
                {value === undefined ? "—" : value.toLocaleString("en-BD")}
              </dd>
            </div>
          ))}
        </dl>
        {!stats && (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            Platform statistics are temporarily unavailable.
          </p>
        )}
      </div>
    </section>
  );
}

function TenantJourney() {
  const steps = ["Find Listings", "View Details", "Request a Booking", "Join as a Tenant"];

  return (
    <section id="to-let-journey" className="py-6 sm:py-8">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground uppercase sm:text-2xl">
            Tenant Journey
          </h2>
          <ol className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {steps.map((title, index) => (
              <li key={title} className="rounded-xl border border-border bg-background p-4">
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-foreground sm:text-base">{title}</h3>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function OwnerCallToAction() {
  return (
    <section id="register-property" className="pt-2 pb-8 sm:pb-10">
      <div className="site-container px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-border bg-card p-5 text-center sm:p-8 lg:p-10">
          <h2 className="text-2xl leading-snug font-bold tracking-tight text-balance text-foreground sm:text-3xl lg:text-[clamp(1.375rem,2.1vw,1.875rem)] lg:whitespace-nowrap">
            একটি Property নিবন্ধন করুন, হাজারো ভাড়াটিয়ার কাছে পৌঁছান—এক প্ল্যাটফর্মে
          </h2>
          <div className="mx-auto mt-4 max-w-4xl space-y-1 text-sm leading-7 text-pretty text-muted-foreground xl:max-w-none xl:whitespace-nowrap">
            <p>Bikalpo-তে Property Account তৈরি করে আপনার ফ্ল্যাট, বাসা, অফিস, দোকান, গ্যারেজ, গুদাম বা যেকোনো ভাড়ার ইউনিটের জন্য Verified Listing প্রকাশ করুন।</p>
            <p>Permanent Property ID, QR Code, Smart Booking, Social Media Share এবং Tenant Management—সবকিছু এক জায়গায়।</p>
          </div>
          <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2 sm:gap-4">
            <ToLetAccountLink href="/account/to-let/properties/new" className={`${toLetPrimaryButton} sm:min-h-12`}>
              <Building2 className="size-4" aria-hidden="true" /> Property নিবন্ধন করুন
            </ToLetAccountLink>
            <ToLetAccountLink href="/account/to-let/properties" className={`${toLetPrimaryButton} ${toLetMobileSecondary} sm:min-h-12`}>
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
