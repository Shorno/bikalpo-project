"use client";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  MapPin,
  Megaphone,
  Minus,
  Package,
  Phone,
  Plus,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  type CylinderSaleMode,
  CylinderTypeRadios,
  shortVariantLabel,
} from "@/components/features/products/cylinder-type-radios";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import type { CartItem } from "@/hooks/use-orpc-cart";
import { getRetailerProductHref } from "@/lib/retailer-storefront-url";
import { cn } from "@/lib/utils";

export interface StorefrontFacet {
  name: string;
  slug: string;
  count: number;
  subcategories: Array<{ name: string; slug: string; count: number }>;
}

export interface StorefrontProduct {
  id: number;
  name: string;
  slug: string;
  image: string;
  images: Array<{ imageUrl: string }>;
  category: { name: string; slug: string } | null;
  subCategory: { name: string; slug: string } | null;
  lowestRetailPrice: number;
  variantCount: number;
  totalAvailableQty: number;
  averageRating?: number;
  totalReviews?: number;
  soldOrderCount?: number;
  variants: Array<{
    variantId: number;
    sku: string | null;
    unitLabel: string | null;
    quantitySelectorLabel: string | null;
    basePrice: string | null;
    retailPrice: string;
    availableQty: string;
    sortOrder?: number;
    exchangeEnabled?: boolean;
    exchangeCreditAmount?: string | number;
    canExchange?: boolean;
  }>;
}

export interface StorefrontAddSelection {
  variantId: number;
  cylinderSaleMode: CylinderSaleMode;
}

interface StoreHeaderProps {
  shop: {
    name: string;
    shopName: string | null;
    shopAddress: string | null;
    businessType: string | null;
    image: string | null;
    phoneNumber: string | null;
  };
  productCount: number;
  stats: {
    averageRating: number;
    totalReviews: number;
    totalOrders: number;
    totalCustomers: number;
  };
}

export function StoreHeader({ shop, productCount, stats }: StoreHeaderProps) {
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
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 md:gap-5">
            {shop.image ? (
              <Image
                src={shop.image}
                alt=""
                width={80}
                height={80}
                className="size-16 shrink-0 rounded-lg border bg-slate-50 object-cover md:size-20"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border bg-slate-50 md:size-20">
                <Store className="size-7 text-primary" aria-hidden="true" />
              </div>
            )}

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
              {shop.businessType && (
                <p className="mt-1 text-xs capitalize text-slate-500">
                  {shop.businessType} store
                </p>
              )}
            </div>
          </div>

          {shop.phoneNumber && (
            <Button asChild variant="outline" className="h-10 bg-white">
              <a href={`tel:${shop.phoneNumber}`}>
                <Phone className="size-4" aria-hidden="true" />
                Contact store
              </a>
            </Button>
          )}
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
  if (offers.length === 0) return null;

  const activeOffer = offers[Math.min(activeIndex, offers.length - 1)];
  if (!activeOffer) return null;

  return (
    <section aria-label="Store offers" className="border-b bg-blue-50">
      <div className="container mx-auto px-4 py-5 md:py-6">
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

interface ProductCardProps {
  product: StorefrontProduct;
  shopSlug: string;
  shopId?: string | null;
  previewMode: boolean;
  isAdding: boolean;
  cartItems?: CartItem[];
  pendingCartItemIds?: ReadonlySet<number>;
  onQuickAdd: (
    product: StorefrontProduct,
    selection: StorefrontAddSelection,
  ) => void;
  onUpdateQuantity?: (cartItemId: number, quantity: number) => Promise<void>;
}

export function StorefrontProductCard({
  product,
  shopSlug,
  shopId,
  previewMode,
  isAdding,
  cartItems = [],
  pendingCartItemIds,
  onQuickAdd,
  onUpdateQuantity,
}: ProductCardProps) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.variantId,
  );
  const [cylinderSaleMode, setCylinderSaleMode] =
    useState<CylinderSaleMode>("exchange");
  const selectedVariant =
    product.variants.find(
      (variant) => variant.variantId === selectedVariantId,
    ) ?? product.variants[0];
  const listingCanExchange = Boolean(
    selectedVariant?.canExchange ?? selectedVariant?.exchangeEnabled,
  );
  const effectiveCylinderSaleMode: CylinderSaleMode = listingCanExchange
    ? cylinderSaleMode
    : "new";
  const image = product.images?.[0]?.imageUrl || product.image;
  const detailHref = getRetailerProductHref({
    shopSlug,
    productSlug: product.slug,
    previewMode,
  });
  const shouldHideCategoryContext = [
    product.category?.name,
    product.category?.slug,
    product.subCategory?.name,
    product.subCategory?.slug,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => {
      const normalized = value.toLowerCase().replace(/[_-]+/g, " ").trim();
      return normalized === "lpg" || normalized === "industrial lpg";
    });
  const categoryContext = [product.category?.name, product.subCategory?.name]
    .filter(Boolean)
    .join(" / ");
  const unitLabel = selectedVariant?.unitLabel;
  const selectedPrice = Number(
    selectedVariant?.retailPrice ?? product.lowestRetailPrice,
  );
  const selectedAvailableQty = Number(
    selectedVariant?.availableQty ?? product.totalAvailableQty,
  );
  const cartItem =
    shopId && selectedVariant
      ? cartItems.find(
          (item) =>
            item.productId === product.id &&
            item.variantId === selectedVariant.variantId &&
            item.shopId === shopId &&
            (item.cylinderSale?.mode ?? "new") === effectiveCylinderSaleMode,
        )
      : undefined;
  const isUpdating = cartItem
    ? pendingCartItemIds?.has(cartItem.id) === true
    : false;
  const totalReviews = product.totalReviews ?? 0;
  const soldOrderCount = product.soldOrderCount ?? 0;
  const averageRating = product.averageRating ?? 0;
  const showRatings = totalReviews > 0;
  const showSold = soldOrderCount > 0;

  const handleSizeChange = (variantId: number) => {
    const nextVariant = product.variants.find(
      (variant) => variant.variantId === variantId,
    );
    setSelectedVariantId(variantId);
    setCylinderSaleMode(
      nextVariant?.canExchange || nextVariant?.exchangeEnabled
        ? "exchange"
        : "new",
    );
  };

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white transition-colors hover:border-slate-400 focus-within:border-primary">
      <Link href={detailHref} className="block border-b bg-slate-50">
        <div className="relative aspect-[4/3] overflow-hidden p-4 sm:p-5">
          {image ? (
            <Image
              src={image}
              alt={product.name}
              fill
              sizes="(max-width: 430px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Package className="size-10 text-slate-300" aria-hidden="true" />
              <span className="sr-only">No product image available</span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {!shouldHideCategoryContext && (
          <p className="min-h-4 truncate text-[11px] font-medium uppercase tracking-[0.06em] text-slate-500">
            {categoryContext || "Retail product"}
          </p>
        )}
        <Link
          href={detailHref}
          className={cn(
            "focus-visible:outline-none",
            shouldHideCategoryContext ? "mt-0" : "mt-1.5",
          )}
        >
          <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-950 transition-colors hover:text-primary group-focus-within:text-primary">
            {product.name}
          </h2>
        </Link>

        {(showRatings || showSold) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            {showRatings && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                <span className="font-medium tabular-nums text-slate-700">
                  {averageRating.toFixed(1)}
                </span>
                <span className="text-slate-400">
                  ({totalReviews.toLocaleString("en-BD")})
                </span>
              </span>
            )}
            {showSold && (
              <span className="tabular-nums">
                Sold {soldOrderCount.toLocaleString("en-BD")}{" "}
                {soldOrderCount === 1 ? "order" : "orders"}
              </span>
            )}
          </div>
        )}

        <div className="mt-3">
          <p className="font-mono text-lg font-semibold tabular-nums text-slate-950">
            ৳{selectedPrice.toLocaleString("en-BD")}
            {unitLabel ? (
              <span className="ml-1 font-sans text-xs font-normal text-slate-500">
                / {shortVariantLabel(unitLabel, product.name)}
              </span>
            ) : null}
          </p>
        </div>

        {product.variants.length > 1 && (
          <div className="mt-3">
            <span
              className="mb-1.5 block text-[11px] font-medium text-slate-400"
              id={`product-${product.id}-size-label`}
            >
              Size
            </span>
            <RadioGroup
              aria-labelledby={`product-${product.id}-size-label`}
              className="flex w-auto flex-wrap gap-x-4 gap-y-2"
              onValueChange={(variantId) => handleSizeChange(Number(variantId))}
              value={String(selectedVariant?.variantId ?? "")}
            >
              {product.variants.map((variant) => {
                const label =
                  variant.quantitySelectorLabel ||
                  variant.unitLabel ||
                  variant.sku ||
                  `Size ${variant.variantId}`;
                const optionId = `product-${product.id}-size-${variant.variantId}`;
                return (
                  <label
                    className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700"
                    htmlFor={optionId}
                    key={variant.variantId}
                  >
                    <RadioGroupItem
                      id={optionId}
                      value={String(variant.variantId)}
                    />
                    <span>{shortVariantLabel(label, product.name)}</span>
                  </label>
                );
              })}
            </RadioGroup>
          </div>
        )}

        {listingCanExchange && (
          <div className="mt-3">
            <CylinderTypeRadios
              appearance="radio"
              value={effectiveCylinderSaleMode}
              onChange={setCylinderSaleMode}
            />
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Available{" "}
          <span className="font-mono tabular-nums text-slate-700">
            {selectedAvailableQty.toLocaleString("en-BD")}
          </span>
        </p>

        <div className="mt-auto flex items-center gap-2 pt-4">
          {previewMode ? (
            <Button
              type="button"
              className="h-9 flex-1 text-xs"
              disabled
              aria-label="Add to cart unavailable in preview"
            >
              <ShoppingCart className="size-3.5" aria-hidden="true" />
              Add to cart
            </Button>
          ) : cartItem && onUpdateQuantity ? (
            <div
              className="flex h-9 flex-1 items-center justify-between rounded-md border border-slate-200 bg-white px-1"
              role="group"
              aria-label={`Quantity for ${product.name}`}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                onClick={() =>
                  void onUpdateQuantity(cartItem.id, cartItem.quantity - 1)
                }
                disabled={isUpdating}
                aria-label={`Decrease ${product.name} quantity`}
              >
                <Minus className="size-3.5" aria-hidden="true" />
              </Button>
              <span
                className="min-w-8 text-center font-mono text-sm font-semibold tabular-nums text-slate-950"
                aria-live="polite"
              >
                {cartItem.quantity}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                onClick={() =>
                  void onUpdateQuantity(cartItem.id, cartItem.quantity + 1)
                }
                disabled={
                  isUpdating || cartItem.quantity >= selectedAvailableQty
                }
                aria-label={`Increase ${product.name} quantity`}
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              className="h-9 flex-1 text-xs"
              disabled={
                isAdding || !selectedVariant || selectedAvailableQty <= 0
              }
              onClick={() => {
                if (!selectedVariant) return;
                onQuickAdd(product, {
                  variantId: selectedVariant.variantId,
                  cylinderSaleMode: effectiveCylinderSaleMode,
                });
              }}
              aria-label={`Add ${product.name} to cart`}
            >
              <ShoppingCart className="size-3.5" aria-hidden="true" />
              {isAdding ? "Adding…" : "Add to cart"}
            </Button>
          )}
          <Button asChild variant="outline" className="h-9 px-3 text-xs">
            <Link href={detailHref}>
              <Eye className="size-3.5" aria-hidden="true" />
              Details
            </Link>
          </Button>
        </div>
      </div>
    </article>
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
        <div className="container mx-auto px-4 py-6">
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
      <div className="container mx-auto px-4 py-7">
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
