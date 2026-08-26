"use client";

import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Heart,
  MapPin,
  Megaphone,
  Package,
  Phone,
  RotateCcw,
  ShoppingBag,
  Star,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type {
  StorefrontAddSelection,
  StorefrontProduct,
} from "./storefront-product-card";
export { StorefrontProductCard } from "./storefront-product-card";

export interface StorefrontFacet {
  name: string;
  slug: string;
  count: number;
  subcategories: Array<{ name: string; slug: string; count: number }>;
}

interface StoreHeaderProps {
  shop: {
    name: string;
    shopName: string | null;
    shopAddress: string | null;
    shopOpeningTime: string | null;
    shopClosingTime: string | null;
    phoneNumber: string | null;
  };
  productCount: number;
  stats: {
    averageRating: number;
    totalReviews: number;
    totalOrders: number;
    totalCustomers: number;
  };
  followerCount: number;
  isFollowing: boolean;
  isFollowPending: boolean;
  onToggleFollow: () => void;
}

export function StoreHeader({
  shop,
  productCount,
  stats,
  followerCount,
  isFollowing,
  isFollowPending,
  onToggleFollow,
}: StoreHeaderProps) {
  const displayName = shop.shopName || shop.name;
  const metrics = [
    stats.totalReviews > 0
      ? {
          icon: Star,
          value: stats.averageRating.toFixed(1),
          label: `${stats.totalReviews.toLocaleString("en-BD")} reviews`,
        }
      : null,
    stats.totalOrders > 0
      ? {
          icon: ShoppingBag,
          value: stats.totalOrders.toLocaleString("en-BD"),
          label: stats.totalOrders === 1 ? "order" : "orders",
        }
      : null,
    stats.totalCustomers > 0
      ? {
          icon: Users,
          value: stats.totalCustomers.toLocaleString("en-BD"),
          label: stats.totalCustomers === 1 ? "customer" : "customers",
        }
      : null,
    {
      icon: Heart,
      value: followerCount.toLocaleString("en-BD"),
      label: followerCount === 1 ? "follower" : "followers",
    },
    {
      icon: Package,
      value: productCount.toLocaleString("en-BD"),
      label: productCount === 1 ? "product" : "products",
    },
  ].filter(Boolean) as Array<{
    icon: typeof Star;
    value: string;
    label: string;
  }>;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 md:py-8 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">
              {displayName}
            </h1>
            {shop.shopAddress && (
              <p className="mt-2 flex max-w-3xl items-start gap-1.5 text-sm leading-5 text-slate-600">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span>{shop.shopAddress}</span>
              </p>
            )}
            {shop.shopOpeningTime && shop.shopClosingTime && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                <Clock3
                  className="size-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span>
                  Open {formatStoreTime(shop.shopOpeningTime)}–
                  {formatStoreTime(shop.shopClosingTime)}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={isFollowing ? "outline" : "default"}
              className={cn("h-10", isFollowing && "bg-white")}
              aria-pressed={isFollowing}
              disabled={isFollowPending}
              onClick={onToggleFollow}
            >
              <Heart
                className={cn("size-4", isFollowing && "fill-current")}
                aria-hidden="true"
              />
              {isFollowPending
                ? "Updating…"
                : isFollowing
                  ? "Following"
                  : "Follow"}
            </Button>
            {shop.phoneNumber && (
              <Button asChild variant="outline" className="h-10 bg-white">
                <a href={`tel:${shop.phoneNumber}`}>
                  <Phone className="size-4" aria-hidden="true" />
                  Contact store
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 border-y sm:flex sm:flex-wrap">
          {metrics.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex min-h-16 items-center gap-3 border-r px-3 first:pl-0 last:border-r-0 sm:min-w-40 sm:px-5"
            >
              <Icon
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold tabular-nums text-slate-950">
                  {value}
                </p>
                <p className="truncate text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

function formatStoreTime(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

export interface StorefrontOffer {
  id: number;
  name: string;
  summary: string;
}

export function StorefrontOfferBanner({
  offers,
}: {
  offers: StorefrontOffer[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (offers.length === 0) {
    return (
      <section aria-label="Store offers" className="border-b bg-blue-50">
        <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 md:py-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-blue-200 bg-white/70 p-4 md:p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Megaphone className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                Store offers
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-950 md:text-lg">
                Promotions coming soon
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Special offers and limited-time deals will appear here.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const activeOffer = offers[Math.min(activeIndex, offers.length - 1)];
  if (!activeOffer) return null;

  return (
    <section aria-label="Store offers" className="border-b bg-blue-50">
      <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 md:py-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-lg border border-blue-200 bg-white p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Megaphone className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
                Today&apos;s special offer
              </p>
              <h2 className="mt-1 text-base font-semibold text-slate-950 md:text-lg">
                {activeOffer.name}
              </h2>
              {activeOffer.summary && (
                <p className="mt-1 text-sm text-slate-600">
                  {activeOffer.summary}
                </p>
              )}
            </div>
          </div>

          {offers.length > 1 && (
            <div className="flex shrink-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 bg-white"
                onClick={() =>
                  setActiveIndex((current) =>
                    current === 0 ? offers.length - 1 : current - 1,
                  )
                }
                aria-label="Previous offer"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <div
                className="flex items-center gap-1.5"
                role="group"
                aria-label={`${activeIndex + 1} of ${offers.length}`}
              >
                {offers.map((offer, index) => (
                  <button
                    key={offer.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      index === activeIndex ? "bg-primary" : "bg-slate-300",
                    )}
                    aria-label={`Show offer ${index + 1}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-9 bg-white"
                onClick={() =>
                  setActiveIndex((current) => (current + 1) % offers.length)
                }
                aria-label="Next offer"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface CategoryFilterProps {
  facets: StorefrontFacet[];
  category: string;
  subcategory: string;
  onCategoryChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
}

function CategoryFilter({
  facets,
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
}: CategoryFilterProps) {
  const selectedCategory = facets.find((facet) => facet.slug === category);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Category
        </p>
        <div className="space-y-1">
          <FilterOption
            active={!category}
            count={facets.reduce((sum, facet) => sum + facet.count, 0)}
            label="All products"
            onClick={() => onCategoryChange("")}
          />
          {facets.map((facet) => (
            <FilterOption
              key={facet.slug}
              active={category === facet.slug}
              count={facet.count}
              label={facet.name}
              onClick={() => onCategoryChange(facet.slug)}
            />
          ))}
        </div>
      </div>

      {selectedCategory && selectedCategory.subcategories.length > 0 && (
        <div className="border-t pt-4">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {selectedCategory.name} subcategories
          </p>
          <div className="space-y-1">
            <FilterOption
              active={!subcategory}
              count={selectedCategory.count}
              label="All subcategories"
              onClick={() => onSubcategoryChange("")}
            />
            {selectedCategory.subcategories.map((facet) => (
              <FilterOption
                key={facet.slug}
                active={subcategory === facet.slug}
                count={facet.count}
                label={facet.name}
                onClick={() => onSubcategoryChange(facet.slug)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterOption({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active
          ? "bg-blue-50 font-medium text-primary"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      )}
    >
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 font-mono text-[11px] tabular-nums",
          active ? "text-primary" : "text-slate-400",
        )}
      >
        {count}
      </span>
    </button>
  );
}

export function StorefrontCategorySidebar(props: CategoryFilterProps) {
  const hasFilters = !!(props.category || props.subcategory);

  return (
    <aside className="sticky top-24 hidden self-start rounded-lg border bg-slate-50/60 lg:block">
      <div className="flex min-h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="size-4 text-primary" aria-hidden="true" />
          Browse catalog
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => props.onCategoryChange("")}
            className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Reset
          </button>
        )}
      </div>
      <div className="p-2.5">
        <CategoryFilter {...props} />
      </div>
    </aside>
  );
}

interface MobileFiltersProps {
  facets: StorefrontFacet[];
  category: string;
  subcategory: string;
  activeCount: number;
  onApply: (category: string, subcategory: string) => void;
}

export function StorefrontMobileFilters({
  facets,
  category,
  subcategory,
  activeCount,
  onApply,
}: MobileFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftSubcategory, setDraftSubcategory] = useState(subcategory);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftCategory(category);
      setDraftSubcategory(subcategory);
    }
    setOpen(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-11 lg:hidden">
          <Filter className="size-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[88%] gap-0 bg-white p-0 shadow-none sm:max-w-sm"
      >
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle>Filter products</SheetTitle>
          <SheetDescription>
            Choose a category and subcategory, then apply your selection.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <CategoryFilter
            facets={facets}
            category={draftCategory}
            subcategory={draftSubcategory}
            onCategoryChange={(value) => {
              setDraftCategory(value);
              setDraftSubcategory("");
            }}
            onSubcategoryChange={setDraftSubcategory}
          />
        </div>
        <SheetFooter className="grid grid-cols-2 border-t bg-slate-50 p-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 bg-white"
            onClick={() => {
              setDraftCategory("");
              setDraftSubcategory("");
            }}
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset
          </Button>
          <Button
            type="button"
            className="h-11"
            onClick={() => {
              onApply(draftCategory, draftSubcategory);
              setOpen(false);
            }}
          >
            Apply filters
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function ActiveFilterSummary({
  query,
  categoryLabel,
  subcategoryLabel,
  onClear,
}: {
  query: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  onClear: () => void;
}) {
  const values = [
    query ? `Search: ${query}` : "",
    categoryLabel ? `Category: ${categoryLabel}` : "",
    subcategoryLabel ? `Subcategory: ${subcategoryLabel}` : "",
  ].filter(Boolean);

  if (values.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5">
      <span className="text-xs font-medium text-slate-500">Active:</span>
      {values.map((value) => (
        <span
          key={value}
          className="max-w-full truncate rounded-md border bg-slate-50 px-2 py-1 text-xs text-slate-700"
        >
          {value}
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <X className="size-3.5" aria-hidden="true" />
        Clear all
      </button>
    </div>
  );
}

export function StorefrontEmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-slate-50/60 px-6 py-16 text-center">
      <Package className="mx-auto size-10 text-slate-300" aria-hidden="true" />
      <h2 className="mt-4 text-base font-semibold text-slate-950">
        {filtered ? "No matching products" : "This store has no products yet"}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
        {filtered
          ? "Try a different search or clear the current category filters."
          : "The retailer has not published any in-stock products for customers."}
      </p>
      {filtered && (
        <Button
          type="button"
          variant="outline"
          className="mt-5 h-11 bg-white"
          onClick={onClear}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Clear filters
        </Button>
      )}
    </div>
  );
}

export function StorefrontSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="border-b bg-slate-50/70">
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
          <Skeleton className="mb-5 h-3 w-48" />
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-80 max-w-[70vw]" />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-3 py-7 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-lg border p-4">
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-lg border bg-white"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
