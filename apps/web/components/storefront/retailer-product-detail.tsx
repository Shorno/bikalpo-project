"use client";

import {
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  ShoppingCart,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ProductImageGallery } from "@/components/features/products/product-image-gallery";
import { ProductSpecs } from "@/components/features/products/product-specs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-orpc-cart";
import { withCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import {
  getNextRetailerQuantity,
  getRetailerPurchaseBounds,
} from "@/lib/retailer-purchase";
import { cn } from "@/lib/utils";
import type { client } from "@/utils/orpc";

type RetailerProductDetailData = Awaited<
  ReturnType<typeof client.customer.getShopProductBySlug>
>;
type RetailerProduct = RetailerProductDetailData["product"];
type RetailerVariant = RetailerProduct["variants"][number];

export function RetailerProductDetail({
  data,
  previewMode,
}: {
  data: RetailerProductDetailData;
  previewMode: boolean;
}) {
  const { product, shop } = data;
  const [selectedVariantId, setSelectedVariantId] = useState(
    product.variants[0]?.id,
  );
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ??
    product.variants[0];

  if (!selectedVariant) return null;

  const shopName = shop.shopName || shop.name;
  const shopHref = withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(shop.shopSlug || "")}`,
    previewMode,
  );
  const categoryHref = withCustomerStorefrontPreview(
    `${shopHref.split("?")[0]}?category=${encodeURIComponent(product.category.slug)}`,
    previewMode,
  );
  const images = Array.from(
    new Set(
      [product.image, ...product.images.map((image) => image.imageUrl)].filter(
        Boolean,
      ),
    ),
  );
  const availableQuantity = Math.max(
    0,
    Math.floor(Number(selectedVariant.availableQty)),
  );
  const retailPrice = Number(selectedVariant.retailPrice);
  const displayUnit =
    selectedVariant.quantitySelectorLabel ||
    selectedVariant.unitLabel ||
    selectedVariant.orderUnit;

  return (
    <div
      className={cn(
        "min-h-screen bg-slate-50/60",
        !previewMode && "pb-28 md:pb-0",
      )}
    >
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-2">
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500"
          >
            <Link href="/" className="hidden hover:text-slate-950 sm:inline">
              Home
            </Link>
            <ChevronRight
              className="hidden size-3 shrink-0 sm:block"
              aria-hidden="true"
            />
            <Link
              href={withCustomerStorefrontPreview("/stores", previewMode)}
              className="hidden hover:text-slate-950 sm:inline"
            >
              Stores
            </Link>
            <ChevronRight
              className="hidden size-3 shrink-0 sm:block"
              aria-hidden="true"
            />
            <Link
              href={shopHref}
              className="max-w-48 truncate font-medium text-slate-700 hover:text-slate-950"
            >
              <span className="sm:hidden">Back to </span>
              {shopName}
            </Link>
            <ChevronRight
              className="hidden size-3 shrink-0 sm:block"
              aria-hidden="true"
            />
            <span
              className="hidden truncate font-medium text-slate-950 sm:inline"
              aria-current="page"
            >
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      <main className="container mx-auto px-4 py-4">
        <section className="overflow-hidden rounded-lg border bg-white">
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.46fr)_minmax(420px,0.54fr)]">
            <div className="min-w-0 border-b p-4 sm:p-5 lg:border-b-0 lg:border-r">
              <ProductImageGallery
                images={images}
                productName={product.name}
                density="compact"
              />
            </div>

            <div className="flex min-w-0 flex-col p-4 sm:p-5 lg:p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <Link href={categoryHref}>
                  <Badge variant="secondary" className="font-medium">
                    {product.category.name}
                  </Badge>
                </Link>
                {product.subCategory && (
                  <Badge variant="outline">{product.subCategory.name}</Badge>
                )}
                {product.brand && (
                  <Badge variant="outline">{product.brand.name}</Badge>
                )}
              </div>

              <h1 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-slate-950 sm:text-2xl">
                {product.name}
              </h1>
              {product.shortDescription && (
                <p className="mt-2 max-w-[70ch] text-sm leading-5 text-slate-600">
                  {product.shortDescription}
                </p>
              )}

              <div className="mt-3 flex min-w-0 items-center gap-2.5 border-t pt-3">
                {shop.image ? (
                  <Image
                    src={shop.image}
                    alt={shopName}
                    width={36}
                    height={36}
                    className="size-9 shrink-0 rounded-md border object-cover"
                  />
                ) : (
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-slate-50">
                    <Store className="size-4 text-primary" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <p className="truncate text-xs font-semibold text-slate-950">
                      Sold by {shopName}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-blue-700">
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                      Verified
                    </span>
                  </div>
                  {shop.shopAddress && (
                    <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{shop.shopAddress}</span>
                    </p>
                  )}
                </div>
                <Link
                  href={shopHref}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline hover:underline-offset-4"
                >
                  View store
                </Link>
              </div>

              <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-y py-3">
                <div>
                  <p className="text-[11px] font-medium text-slate-500">
                    {displayUnit ? `Price per ${displayUnit}` : "Retail price"}
                  </p>
                  <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums text-slate-950">
                    ৳{retailPrice.toLocaleString("en-BD")}
                  </p>
                </div>
                <p className="mb-1 inline-flex items-center gap-1.5 font-mono text-xs font-medium tabular-nums text-emerald-700">
                  <PackageCheck className="size-4" aria-hidden="true" />
                  {availableQuantity.toLocaleString("en-BD")} available
                </p>
              </div>

              {product.variants.length > 1 && (
                <fieldset className="mt-4 min-w-0">
                  <legend className="text-sm font-semibold text-slate-950">
                    Select size
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-slate-200 xl:grid-cols-4">
                    {product.variants.map((variant) => {
                      const active = variant.id === selectedVariant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => setSelectedVariantId(variant.id)}
                          aria-pressed={active}
                          className={cn(
                            "relative min-h-16 bg-white px-3 py-2.5 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                            active
                              ? "bg-blue-50 text-primary"
                              : "hover:bg-slate-50",
                          )}
                        >
                          <span
                            className={cn(
                              "block pr-5 text-sm font-semibold",
                              active ? "text-blue-950" : "text-slate-950",
                            )}
                          >
                            {variant.unitLabel}
                          </span>
                          <span className="mt-1 block font-mono text-xs tabular-nums text-slate-600">
                            ৳
                            {Number(variant.retailPrice).toLocaleString(
                              "en-BD",
                            )}
                          </span>
                          {active && (
                            <span className="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" aria-hidden="true" />
                              <span className="sr-only">Selected</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              <div className="mt-4">
                <RetailerPurchaseControls
                  key={selectedVariant.id}
                  product={product}
                  variant={selectedVariant}
                  shopId={shop.id}
                  displayUnit={displayUnit}
                  previewMode={previewMode}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          {product.description && (
            <section className="rounded-lg border bg-white p-5">
              <h2 className="text-base font-semibold text-slate-950">
                Product description
              </h2>
              <div
                className="prose prose-slate mt-3 max-w-none text-sm leading-6"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            </section>
          )}
          <section className="rounded-lg border bg-white p-5">
            <h2 className="text-base font-semibold text-slate-950">
              Product information
            </h2>
            <div className="mt-3">
              <ProductSpecs
                categoryName={product.category.name}
                brandName={product.brand?.name ?? null}
                subCategoryName={product.subCategory?.name}
                productSize={product.size}
                features={product.features}
                variants={[selectedVariant]}
                density="compact"
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function RetailerPurchaseControls({
  product,
  variant,
  shopId,
  displayUnit,
  previewMode,
}: {
  product: RetailerProduct;
  variant: RetailerVariant;
  shopId: string;
  displayUnit: string;
  previewMode: boolean;
}) {
  const availableQuantity = Math.max(
    0,
    Math.floor(Number(variant.availableQty)),
  );
  const bounds = getRetailerPurchaseBounds({
    availableQuantity,
    orderMin: Number(variant.orderMin || 1),
    orderMax: variant.orderMax ? Number(variant.orderMax) : null,
    orderIncrement: Number(variant.orderIncrement || 1),
  });
  const [quantity, setQuantity] = useState(bounds.initialQuantity);
  const [isAdding, setIsAdding] = useState(false);
  const { addItem } = useCart();
  const price = Number(variant.retailPrice);
  const quantityLabelId = `retailer-quantity-${variant.id}`;

  if (previewMode) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
        Ordering is disabled while viewing the customer preview.
      </div>
    );
  }

  if (!bounds.canPurchase) {
    return (
      <div className="rounded-lg border bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
        This option does not have enough stock for its minimum order quantity.
      </div>
    );
  }

  const handleAddToCart = async () => {
    setIsAdding(true);
    try {
      await addItem(product.id, quantity, variant.id, shopId);
    } finally {
      setIsAdding(false);
    }
  };
  const nextDecrease = getNextRetailerQuantity(quantity, "decrease", bounds);
  const nextIncrease = getNextRetailerQuantity(quantity, "increase", bounds);

  return (
    <>
      <div className="flex items-end gap-3">
        <div className="shrink-0">
          <p
            id={quantityLabelId}
            className="mb-1 text-xs font-medium text-slate-600"
          >
            Quantity
          </p>
          <div
            className="flex h-11 items-center rounded-lg border bg-white"
            role="group"
            aria-labelledby={quantityLabelId}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-r-none"
              onClick={() => setQuantity(nextDecrease)}
              disabled={nextDecrease === quantity || isAdding}
              aria-label={`Decrease quantity by ${bounds.increment}`}
            >
              <Minus className="size-4" aria-hidden="true" />
            </Button>
            <span
              className="w-11 text-center font-mono text-sm font-medium tabular-nums"
              aria-live="polite"
            >
              {quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-l-none"
              onClick={() => setQuantity(nextIncrease)}
              disabled={nextIncrease === quantity || isAdding}
              aria-label={`Increase quantity by ${bounds.increment}`}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <RetailerAddToCartButton
          className="hidden h-11 flex-1 text-sm font-semibold md:inline-flex"
          isAdding={isAdding}
          onAdd={handleAddToCart}
        />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] md:hidden">
        <div className="container mx-auto flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] font-medium tabular-nums text-slate-500">
              {displayUnit} · Qty {quantity}
            </p>
            <p className="font-mono text-base font-semibold tabular-nums text-slate-950">
              ৳{(price * quantity).toLocaleString("en-BD")}
            </p>
          </div>
          <RetailerAddToCartButton
            className="h-11 min-w-40 text-sm font-semibold"
            isAdding={isAdding}
            onAdd={handleAddToCart}
          />
        </div>
      </div>
    </>
  );
}

function RetailerAddToCartButton({
  isAdding,
  onAdd,
  className,
}: {
  isAdding: boolean;
  onAdd: () => Promise<void>;
  className?: string;
}) {
  return (
    <Button
      type="button"
      className={className}
      onClick={() => void onAdd()}
      disabled={isAdding}
    >
      {isAdding ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <ShoppingCart className="size-4" aria-hidden="true" />
      )}
      {isAdding ? "Adding..." : "Add to Cart"}
    </Button>
  );
}
