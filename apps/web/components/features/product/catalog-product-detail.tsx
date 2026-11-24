"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  Loader2,
  MessageSquare,
  Minus,
  PackagePlus,
  Pencil,
  Plus,
  Printer,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  resolveBrandScope,
  scopeVariantPrices,
} from "@/app/(dashboard)/dashboard/admin/web-view/_lib/brand-scope";
import { StarRating } from "@/components/features/reviews/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type DetailVariantPrice,
  hasExchangeOption,
  inventoryUnitLabel,
  lpgPriceRows,
  sortVariantsBySize,
  variantOptionLabel,
} from "@/lib/catalog-product-detail";
import { cn } from "@/lib/utils";
import { getPublicAppBaseUrl } from "@/lib/warehouse-storefront-url";
import { orpc } from "@/utils/orpc";

type ProductCode = {
  variantOptionId: number;
  saleType: string | null;
  code: string;
};

type FeatureItem = { key: string; value: string };
type FeatureGroup = { title: string; items: FeatureItem[] };

type VariantPrice = DetailVariantPrice & {
  variantOptionId?: number | null;
  brandId?: number | null;
  isActive?: boolean | null;
  catalogSku?: string | null;
};

type ProductBrandLink = {
  brandId?: number | null;
  brand?: { id?: number | null; name: string } | null;
};

type DetailProduct = {
  id: number;
  name: string;
  slug: string;
  sku?: string | null;
  catalogCode?: string | null;
  image: string;
  images?: { imageUrl: string }[];
  shortDescription?: string | null;
  description?: string | null;
  features?: FeatureGroup[] | null;
  isFeatured?: boolean;
  status?: string | null;
  category?: {
    name: string;
    slug: string;
    type?: { family?: string | null } | null;
  } | null;
  subCategory?: { name: string } | null;
  brand?: { id?: number | null; name: string } | null;
  productBrands?: ProductBrandLink[];
  variantPrices?: VariantPrice[];
  /** 13-digit code of each size and Type (Product ID + 0 + size + Type). */
  productCodes?: ProductCode[];
  // Inventory & Product Rules, as set when the product was created.
  minimumOrderEnabled?: boolean | null;
  minimumOrderQty?: string | number | null;
  returnPolicyEnabled?: boolean | null;
  trackingType?: string | null;
  expiryEnabled?: boolean | null;
  damageControlEnabled?: boolean | null;
  conversionEnabled?: boolean | null;
  inventoryLooseUnitEnabled?: boolean | null;
  inventoryLooseUnit?: string | null;
  isReturnablePack?: boolean | null;
  defaultPackDepositAmount?: string | number | null;
};

type ReviewUser = { name?: string | null };
type Review = {
  id: number;
  rating: number;
  title?: string | null;
  comment?: string | null;
  isVerifiedPurchase?: boolean | null;
  createdAt: string | Date;
  user?: ReviewUser | null;
};

type ReviewStats = { averageRating: number; totalReviews: number };

const LISTING_URL = "/dashboard/admin/web-view";

function formatBDT(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return `৳${amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function formatQty(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString("en-BD", { maximumFractionDigits: 2 })
    : "—";
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export type CatalogProductAction = {
  label: string;
  kind: "add" | "edit";
} & (
  | { href: string; onSelect?: never; pending?: never }
  /** Runs in place, e.g. adding a brand product straight to the seller's products. */
  | { href?: never; onSelect: () => void; pending?: boolean }
);

/**
 * The catalog product page shared by admin and the seller panels, per the
 * client review: the summary beside the images, then Product Information ·
 * Description · Reviews tabs. Prices are masked in the summary for everyone;
 * admin sees the real ones in the admin-only block, and sellers never receive
 * them from the server.
 */
export function CatalogProductDetail({
  product,
  brandId = null,
  reviews,
  stats,
  listingUrl = LISTING_URL,
  listingLabel = "Web View",
  viewer = "admin",
  primaryAction,
  brandPicker,
  brandless = false,
}: {
  product: DetailProduct;
  brandId?: number | null;
  reviews: Review[];
  stats: ReviewStats;
  listingUrl?: string;
  listingLabel?: string;
  viewer?: "admin" | "seller";
  /** Admin: Edit Product (default). Sellers: Add Product, or Edit for their own copy. */
  primaryAction?: CatalogProductAction;
  /** Seller panels: switches between the brands offered for this product. */
  brandPicker?: ReactNode;
  /**
   * A catalog item admin has not set up a brand for. There is no brand, size,
   * price, or rule yet, so those parts are left out; the seller picks the
   * brand when adding it.
   */
  brandless?: boolean;
}) {
  // Seller panels live on the shop./warehouse. subdomains, where a relative
  // /products link would be rewritten into the portal. Resolve the public
  // host after mount so server and client render the same first href.
  const [publicBaseUrl, setPublicBaseUrl] = useState("");
  useEffect(() => {
    setPublicBaseUrl(getPublicAppBaseUrl(window.location.origin));
  }, []);

  const { brands, hasSingleBrand, defaultBrandId } = useMemo(
    () => resolveBrandScope(product),
    [product],
  );

  // Resolve the brand this page is scoped to. Honour a valid ?brandId= deep
  // link, but never depend on it: a missing or unknown brand falls back to the
  // product's primary brand so the page can never leak another brand's variants.
  const effectiveBrandId =
    brandId != null && brands.some((brand) => brand.id === brandId)
      ? brandId
      : defaultBrandId;

  // Only the variants configured for the resolved brand — matches the
  // brand-scoped listing card rather than showing every brand's variants.
  const activeVariants = useMemo(
    () =>
      sortVariantsBySize(
        scopeVariantPrices(
          product.variantPrices ?? [],
          effectiveBrandId,
          hasSingleBrand,
        ),
      ),
    [product.variantPrices, effectiveBrandId, hasSingleBrand],
  );

  const [activeImage, setActiveImage] = useState(0);

  const images = useMemo(() => {
    const all = [
      product.image,
      ...(product.images?.map((img) => img.imageUrl) ?? []),
    ].filter((src): src is string => Boolean(src));
    return Array.from(new Set(all));
  }, [product.image, product.images]);

  const brandName = brandless
    ? "Not set"
    : (brands.find((brand) => brand.id === effectiveBrandId)?.name ??
      product.brand?.name ??
      "Unbranded");

  const productId = product.catalogCode || `PRD-${product.id}`;
  const isLpg = product.category?.type?.family === "lpg";
  const exchange = hasExchangeOption(activeVariants);
  // Codes of the sizes shown for this brand, in size order.
  const productCodes = activeVariants.flatMap((variant) =>
    (product.productCodes ?? [])
      .filter((code) => code.variantOptionId === variant.variantOptionId)
      .map((code) => ({
        ...code,
        label: [variantOptionLabel(variant.variantOption), code.saleType]
          .filter(Boolean)
          .join(" · "),
      })),
  );
  const codedTypes = [
    ...new Set(
      productCodes
        .map((code) => code.saleType)
        .filter((type): type is string => Boolean(type)),
    ),
  ];
  const cylinderTypes =
    codedTypes.length > 0
      ? codedTypes
      : exchange
        ? ["Exchange", "New"]
        : ["New"];
  const sizeLabels = activeVariants.map((variant) =>
    variantOptionLabel(variant.variantOption),
  );
  const inventoryUnit = inventoryUnitLabel(activeVariants);
  const minimumOrder = brandless
    ? "—"
    : product.minimumOrderEnabled
      ? `${formatQty(product.minimumOrderQty)} ${inventoryUnit ?? "unit"}`
      : "Not required";
  // A catalog item without a brand has no rules yet; they are set on adding it.
  const ruleValue = (enabled: boolean) => (brandless ? null : enabled);
  const variantSkus = activeVariants
    .map((variant) => variant.catalogSku)
    .filter((sku): sku is string => Boolean(sku));
  // Each size has its own sellable SKU (e.g. OMR-LPG-12KG); the product-level
  // sku field only repeats the Product ID.
  const sku = variantSkus.join(", ") || product.sku?.trim() || "—";

  const features = (product.features ?? []).filter(
    (group) => group?.items?.length,
  );
  const hasDescription = Boolean(
    features.length || product.shortDescription || product.description,
  );

  const categoryName = product.category?.name ?? "Uncategorized";
  const storefrontHref =
    !brandless && product.category?.slug
      ? `${publicBaseUrl}/products/${product.category.slug}/${product.slug}`
      : null;
  const action: CatalogProductAction = primaryAction ?? {
    label: "Edit Product",
    href: `/dashboard/admin/products/${product.id}/edit`,
    kind: "edit",
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href={listingUrl} className="hover:text-foreground">
          {listingLabel}
        </Link>
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{categoryName}</span>
        {product.subCategory?.name ? (
          <>
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{product.subCategory.name}</span>
          </>
        ) : null}
        {brandless ? null : (
          <>
            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{brandName}</span>
          </>
        )}
        <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{productId}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={listingUrl}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {product.name}
            </h1>
            <p className="text-xs text-muted-foreground">{productId}</p>
          </div>
        </div>
        {storefrontHref ? (
          <Button asChild variant="outline" size="sm">
            <a href={storefrontHref} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              View on Storefront
            </a>
          </Button>
        ) : null}
      </div>

      {brandPicker}

      {/* Main */}
      <div className="grid gap-6 rounded-xl border bg-card p-5 shadow-sm lg:grid-cols-2 lg:gap-8 lg:p-6">
        {/* Gallery */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted/30">
            {images.length > 0 ? (
              <Image
                src={images[activeImage] ?? images[0]}
                alt={product.name}
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="object-contain p-4"
                unoptimized={images[activeImage]?.startsWith("http") ?? false}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-14 w-14 text-muted-foreground/30" />
              </div>
            )}
            {product.isFeatured ? (
              <Badge className="absolute left-3 top-3 bg-slate-900/90 text-white">
                Featured
              </Badge>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {images.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  aria-label={`Show image ${index + 1}`}
                  aria-pressed={index === activeImage}
                  onClick={() => setActiveImage(index)}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-muted/40 transition-colors",
                    index === activeImage
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/20",
                  )}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                    unoptimized={src.startsWith("http")}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Summary */}
        <div className="flex flex-col">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Product ID</dt>
            <dd className="font-semibold tabular-nums">{productId}</dd>
            <dt className="text-muted-foreground">Product Name</dt>
            <dd className="font-semibold">{product.name}</dd>
            <dt className="text-muted-foreground">Brand</dt>
            <dd className="font-semibold">{brandName}</dd>
          </dl>

          {/* Price stays masked here; admins see real prices under Pricing. */}
          <p
            className={cn(
              "mt-5 flex items-baseline gap-2",
              brandless && "hidden",
            )}
          >
            <span className="text-sm text-muted-foreground">Price</span>
            <span className="sr-only">Hidden</span>
            <span aria-hidden="true" className="text-2xl font-bold">
              ৳*****
            </span>
          </p>

          <div
            className={cn(
              "mt-1.5 flex flex-wrap items-center gap-2",
              brandless && "hidden",
            )}
          >
            {stats.totalReviews > 0 ? (
              <>
                <StarRating
                  rating={Math.round(stats.averageRating)}
                  size="sm"
                />
                <span className="text-sm font-medium">
                  {stats.averageRating.toFixed(1)}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({stats.totalReviews.toLocaleString("en-BD")}{" "}
                  {stats.totalReviews === 1 ? "Review" : "Reviews"})
                </span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">
                No reviews yet
              </span>
            )}
          </div>

          <div className="my-5 border-t" />

          {activeVariants.length > 0 ? (
            <OptionGroup
              label={isLpg ? "Cylinder Size" : "Variants"}
              options={sizeLabels}
            />
          ) : null}
          {isLpg && !brandless ? (
            <OptionGroup
              label="Cylinder Type"
              options={cylinderTypes}
              className="mt-4"
            />
          ) : null}

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Quantity</p>
            {/* Display only for now; ordering happens from the seller panels. */}
            <div className="inline-flex items-center rounded-lg border">
              <Button
                variant="ghost"
                size="icon"
                disabled
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </Button>
              <span className="w-10 text-center text-sm font-medium tabular-nums">
                1
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled
                aria-label="Increase quantity"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {action.onSelect ? (
              <Button onClick={action.onSelect} disabled={action.pending}>
                {action.pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <PackagePlus className="size-4" />
                )}
                {action.pending ? "Adding…" : action.label}
              </Button>
            ) : (
              <Button asChild>
                <Link href={action.href}>
                  {action.kind === "add" ? (
                    <PackagePlus className="size-4" />
                  ) : (
                    <Pencil className="size-4" />
                  )}
                  {action.label}
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => toast.info("Label printing is coming soon.")}
            >
              <Printer className="size-4" />
              Print Label
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="information">
        <TabsList className="h-11 w-full max-w-lg p-1">
          <TabsTrigger value="information" className="text-sm">
            Product Information
          </TabsTrigger>
          <TabsTrigger value="description" className="text-sm">
            Description
          </TabsTrigger>
          <TabsTrigger value="reviews" className="text-sm">
            Reviews
            {stats.totalReviews > 0 ? (
              <span className="ml-1 text-muted-foreground">
                ({stats.totalReviews})
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Product Information */}
        <TabsContent value="information" className="mt-4 space-y-5">
          <Section title="Product Information">
            <dl className="max-w-2xl text-sm">
              <InfoRow label="Product ID" value={productId} />
              <InfoRow label="Category" value={categoryName} />
              <InfoRow
                label="Sub Category"
                value={product.subCategory?.name ?? "None"}
              />
              <InfoRow label="Product Name" value={product.name} />
              <InfoRow
                label="Variant"
                value={
                  brandless
                    ? "Chosen when you add it"
                    : isLpg
                      ? exchange || codedTypes.length > 0
                        ? "Size / Type"
                        : "Size"
                      : sizeLabels.join(", ") || "None"
                }
              />
              <InfoRow label="Inventory Unit" value={inventoryUnit ?? "—"} />
              <InfoRow label="Minimum Order" value={minimumOrder} />
              <InfoRow label="Brand" value={brandName} className="mt-3" />
              <InfoRow
                label="SKU"
                value={
                  variantSkus.length > 0 ? (
                    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                      {variantSkus.map((code) => (
                        <span key={code} className="whitespace-nowrap">
                          {code}
                        </span>
                      ))}
                    </span>
                  ) : (
                    sku
                  )
                }
              />
              {brandless ? null : (
                <InfoRow
                  label="Product Code"
                  value={
                    productCodes.length > 0 ? (
                      <span className="flex flex-col gap-0.5">
                        {productCodes.map((code) => (
                          <span
                            key={code.code}
                            className="flex flex-wrap items-baseline gap-x-2"
                          >
                            <span className="font-mono tabular-nums">
                              {code.code}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {code.label}
                            </span>
                          </span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              )}
              <InfoRow
                label="Status"
                value={product.status === "inactive" ? "Inactive" : "Active"}
              />
            </dl>
          </Section>

          <Section title="Inventory & Product Rules">
            {/* Two columns of rules split by row lines; the last row has none. */}
            <div className="grid sm:grid-cols-2 sm:gap-x-10 [&>*:last-child]:border-b-0 [&>*:nth-last-child(2)]:border-b-0">
              <RuleCell label="Variant">
                <div className="mt-1.5 space-y-1.5 text-sm">
                  {brandless ? (
                    <p className="text-muted-foreground">
                      Chosen when you add it
                    </p>
                  ) : (
                    <>
                      {isLpg ? (
                        <ValueList label="Type" values={cylinderTypes} />
                      ) : null}
                      <ValueList
                        label={isLpg ? "Size" : "Options"}
                        values={sizeLabels}
                      />
                    </>
                  )}
                </div>
              </RuleCell>
              <RuleCell label="Conversion">
                <RuleState
                  enabled={ruleValue(Boolean(product.conversionEnabled))}
                />
              </RuleCell>
              <RuleCell label="Inventory Unit">
                <p className="mt-1.5 text-sm font-medium">
                  {inventoryUnit ?? "—"}
                </p>
              </RuleCell>
              <RuleCell label="Inventory Loose Unit">
                <RuleState
                  enabled={ruleValue(
                    Boolean(product.inventoryLooseUnitEnabled),
                  )}
                />
                {product.inventoryLooseUnitEnabled ? (
                  <RuleDetail
                    label="Unit"
                    value={(product.inventoryLooseUnit ?? "").toUpperCase()}
                  />
                ) : null}
              </RuleCell>
              <RuleCell label="Return Policy">
                <RuleState
                  enabled={ruleValue(Boolean(product.returnPolicyEnabled))}
                />
              </RuleCell>
              <RuleCell label="Empty Pack Return">
                <RuleState
                  enabled={ruleValue(Boolean(product.isReturnablePack))}
                />
                {product.isReturnablePack ? (
                  <RuleDetail
                    label="Empty Pack Price"
                    value={
                      formatBDT(product.defaultPackDepositAmount) ?? "Not set"
                    }
                  />
                ) : null}
              </RuleCell>
              <RuleCell label="Batch Tracking">
                <RuleState
                  enabled={ruleValue(product.trackingType === "batch")}
                />
              </RuleCell>
              <RuleCell label="Damage Tracking">
                <RuleState
                  enabled={ruleValue(Boolean(product.damageControlEnabled))}
                />
              </RuleCell>
              <RuleCell label="Expiry Tracking">
                <RuleState
                  enabled={ruleValue(Boolean(product.expiryEnabled))}
                />
              </RuleCell>
              <RuleCell label="Minimum Order Qty">
                <RuleState
                  enabled={ruleValue(Boolean(product.minimumOrderEnabled))}
                />
                {product.minimumOrderEnabled ? (
                  <RuleDetail label="Minimum Order" value={minimumOrder} />
                ) : null}
              </RuleCell>
              <RuleCell label="Delivery Cost">
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Not set for this product
                </p>
              </RuleCell>
              <div aria-hidden="true" className="border-b max-sm:hidden" />
            </div>
          </Section>

          {viewer === "admin" ? (
            <AdminSections
              productId={product.id}
              stats={stats}
              pricing={isLpg ? lpgPriceRows(activeVariants) : null}
            />
          ) : null}
        </TabsContent>

        {/* Description */}
        <TabsContent value="description" className="mt-4">
          <div className="space-y-6 rounded-xl border bg-card p-5 shadow-sm lg:p-6">
            {hasDescription ? (
              <>
                {features.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {features.map((group) => (
                      <SpecGroup key={group.title} group={group} />
                    ))}
                  </div>
                ) : null}

                {product.shortDescription ? (
                  <div>
                    <h3 className="text-sm font-semibold">Short Description</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {product.shortDescription}
                    </p>
                  </div>
                ) : null}

                {product.description ? (
                  <div>
                    <h3 className="text-sm font-semibold">Description</h3>
                    <div
                      className="prose prose-sm mt-1.5 max-w-none text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No description or specifications have been added for this
                product.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Reviews */}
        <TabsContent value="reviews" className="mt-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm lg:p-6">
            <div className="flex items-center gap-5 border-b pb-5">
              <div className="text-center">
                <p className="text-4xl font-bold leading-none">
                  {stats.averageRating.toFixed(1)}
                </p>
                <div className="mt-2 flex justify-center">
                  <StarRating
                    rating={Math.round(stats.averageRating)}
                    size="sm"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {stats.totalReviews}{" "}
                  {stats.totalReviews === 1 ? "review" : "reviews"}
                </p>
              </div>
            </div>

            {reviews.length > 0 ? (
              <div className="divide-y">
                {reviews.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">No reviews yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This product has not received any customer reviews.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Display-only option circles, like the storefront's choices. */
function OptionGroup({
  label,
  options,
  className,
}: {
  label: string;
  options: string[];
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-sm font-medium">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li
            key={option}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
          >
            <span
              aria-hidden="true"
              className="size-3.5 rounded-full border-2 border-muted-foreground/40"
            />
            {option}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm lg:p-6">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** One "Label : Value" line in a condensed single-column list. */
function InfoRow({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[8.5rem_1fr] gap-x-3 py-1 sm:grid-cols-[10rem_1fr]",
        className,
      )}
    >
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}

function RuleCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b py-3.5">
      <p className="text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

/** Read-only Enable / Disable, shown the way the product form sets it. */
function RuleState({ enabled }: { enabled: boolean | null }) {
  if (enabled === null) {
    return <p className="mt-1.5 text-sm text-muted-foreground">Not set yet</p>;
  }
  return (
    <p className="mt-1.5 flex gap-4 text-sm">
      <span className="sr-only">{enabled ? "Enabled" : "Disabled"}</span>
      {[true, false].map((option) => {
        const selected = option === enabled;
        return (
          <span
            key={String(option)}
            aria-hidden="true"
            className={cn(
              "inline-flex items-center gap-1.5",
              selected
                ? "font-medium text-foreground"
                : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-3.5 rounded-full border-2",
                selected
                  ? "border-[4.5px] border-primary"
                  : "border-muted-foreground/40",
              )}
            />
            {option ? "Enable" : "Disable"}
          </span>
        );
      })}
    </p>
  );
}

function RuleDetail({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      {label}: <span className="font-medium text-foreground">{value}</span>
    </p>
  );
}

function ValueList({ label, values }: { label: string; values: string[] }) {
  return (
    <p className="flex flex-wrap items-center gap-1.5">
      <span className="w-12 text-muted-foreground">{label}</span>
      {values.length > 0 ? (
        values.map((value) => (
          <span
            key={value}
            className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-medium"
          >
            {value}
          </span>
        ))
      ) : (
        <span className="text-muted-foreground">None</span>
      )}
    </p>
  );
}

/** Product History and Pricing: rendered for the admin panel only. */
function AdminSections({
  productId,
  stats,
  pricing,
}: {
  productId: number;
  stats: ReviewStats;
  pricing: ReturnType<typeof lpgPriceRows> | null;
}) {
  const { data: insights, isLoading } = useQuery(
    orpc.product.getAdminProductInsights.queryOptions({
      input: { id: productId },
    }),
  );
  const pending = isLoading ? "Loading…" : "—";
  const created = formatDate(insights?.createdAt);

  return (
    <>
      <Section title="Product History">
        <dl className="max-w-2xl text-sm">
          <InfoRow
            label="Created"
            value={
              created
                ? `${created}${insights?.createdByName ? ` by ${insights.createdByName}` : ""}`
                : pending
            }
          />
          <InfoRow
            label="Price Changed"
            value={
              insights
                ? (formatDate(insights.lastPriceChangeAt) ?? "Not changed yet")
                : pending
            }
          />
          <InfoRow
            label="Average Rating"
            value={
              stats.totalReviews > 0 ? (
                <span className="flex items-center gap-2">
                  <StarRating
                    rating={Math.round(stats.averageRating)}
                    size="sm"
                  />
                  {stats.averageRating.toFixed(1)}
                </span>
              ) : (
                "No reviews yet"
              )
            }
          />
          <InfoRow
            label="Total Orders"
            value={
              insights
                ? `${insights.orderCount.toLocaleString("en-BD")} ${insights.orderCount === 1 ? "Order" : "Orders"}`
                : pending
            }
          />
        </dl>
      </Section>

      {pricing ? (
        <Section title="Pricing">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col" className="pl-0">
                  Capacity
                </TableHead>
                <TableHead scope="col" className="whitespace-normal text-right">
                  Exchange Price
                </TableHead>
                <TableHead
                  scope="col"
                  className="whitespace-normal pr-0 text-right"
                >
                  New Cylinder Price
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pricing.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-20 text-center text-muted-foreground"
                  >
                    No cylinder sizes configured for this brand.
                  </TableCell>
                </TableRow>
              ) : (
                pricing.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-0 font-medium">
                      {row.capacity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.exchangePrice === null
                        ? "—"
                        : formatBDT(row.exchangePrice)}
                    </TableCell>
                    <TableCell className="pr-0 text-right tabular-nums">
                      {row.newPrice === null
                        ? "Not set"
                        : formatBDT(row.newPrice)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Section>
      ) : null}
    </>
  );
}

function SpecGroup({ group }: { group: FeatureGroup }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-2.5 text-sm font-medium">
        {group.title}
      </div>
      <dl className="divide-y">
        {group.items.map((item) => (
          <div
            key={`${item.key}-${item.value}`}
            className="flex justify-between gap-4 px-4 py-2.5 text-sm"
          >
            <dt className="text-muted-foreground">{item.key}</dt>
            <dd className="text-right font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReviewItem({ review }: { review: Review }) {
  const name = review.user?.name?.trim() || "Anonymous";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex gap-3 py-4 first:pt-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{name}</span>
            {review.isVerifiedPurchase ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                Verified
              </Badge>
            ) : null}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(review.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <StarRating rating={review.rating} size="sm" />
          {review.title ? (
            <span className="text-sm font-medium">{review.title}</span>
          ) : null}
        </div>
        {review.comment ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {review.comment}
          </p>
        ) : null}
      </div>
    </div>
  );
}
