"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink,
  Eye,
  Layers,
  Loader2,
  MapPin,
  Package,
  Search,
  Tags,
  Warehouse,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { WarehouseProductGrid } from "@/components/features/warehouse/warehouse-product-grid";
import { HorizontalScrollRow } from "@/components/storefront/horizontal-scroll-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { withCustomerStorefrontPreview } from "@/lib/customer-storefront-preview";
import { cn } from "@/lib/utils";
import { getPublicAppBaseUrl } from "@/lib/warehouse-storefront-url";
import { orpc } from "@/utils/orpc";

const PAGE_SIZE = 12;

/**
 * Wholesaler My Store: the warehouse storefront as shop owners see it, with
 * ordering disabled. Product cards open the public detail page in customer
 * preview, the same way the retailer My Store does.
 */
export default function WarehouseMyStorePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const slug = (session?.user as { warehouseSlug?: string | null } | undefined)
    ?.warehouseSlug;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [publicBaseUrl, setPublicBaseUrl] = useState("");

  // The storefront lives on the public host, not this warehouse subdomain.
  useEffect(() => {
    setPublicBaseUrl(getPublicAppBaseUrl(window.location.origin));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const { data: warehouse, isLoading: warehouseLoading } = useQuery({
    ...orpc.warehouse.getStorefrontBySlug.queryOptions({
      input: { slug: slug ?? "" },
    }),
    enabled: Boolean(slug),
  });

  const { data: categoriesData } = useQuery({
    ...orpc.warehouse.getStorefrontCategories.queryOptions({
      input: { slug: slug ?? "" },
    }),
    enabled: Boolean(slug),
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    ...orpc.warehouse.getStorefrontProducts.queryOptions({
      input: {
        slug: slug ?? "",
        category: selectedCategory || undefined,
        search: search || undefined,
        page: String(page),
        limit: String(PAGE_SIZE),
      },
    }),
    enabled: Boolean(slug),
  });

  if (sessionPending || (slug && warehouseLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Loading store preview...
          </p>
        </div>
      </div>
    );
  }

  if (!slug) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <Warehouse className="mx-auto h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium text-muted-foreground">
            Your storefront link is not set up yet
          </p>
          <p className="text-sm text-muted-foreground">
            A storefront will be available once a warehouse slug is assigned.
          </p>
        </div>
      </div>
    );
  }

  const categories = categoriesData?.categories ?? [];
  const products = productsData?.products ?? [];
  const pagination = productsData?.pagination;
  const totalProducts = pagination?.totalCount ?? products.length;
  const storefrontPath = `/w/${encodeURIComponent(slug)}`;
  const customerPreviewUrl = publicBaseUrl
    ? withCustomerStorefrontPreview(`${publicBaseUrl}${storefrontPath}`, true)
    : null;
  const warehouseName =
    warehouse?.warehouseName || warehouse?.name || "My Store";

  const metrics = [
    {
      icon: Package,
      label: "Products",
      value: totalProducts.toLocaleString("en-BD"),
    },
    {
      icon: Tags,
      label: "Categories",
      value: categories.length.toLocaleString("en-BD"),
    },
    {
      icon: Layers,
      label: "Storefront",
      value: storefrontPath,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Preview Mode Banner ── */}
      <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Preview Mode</span> — This is how
            your store looks to shop owners. Cart and ordering are disabled.
          </p>
        </div>
        {customerPreviewUrl ? (
          <Button
            asChild
            size="sm"
            className="shrink-0 bg-amber-700 text-white hover:bg-amber-800"
          >
            <a
              href={customerPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              View as customer
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <Button size="sm" disabled className="shrink-0">
            View as customer
          </Button>
        )}
      </div>

      {/* ── Store Header ── */}
      <Card className="overflow-hidden py-0">
        <div className="bg-gradient-to-r from-zinc-800 to-zinc-700 p-6 text-white max-sm:p-4">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/15 max-sm:size-12">
              {warehouse?.image ? (
                <img
                  src={warehouse.image}
                  alt={warehouseName}
                  className="h-14 w-14 rounded-lg object-cover max-sm:size-10"
                />
              ) : (
                <Warehouse className="h-8 w-8 text-white max-sm:size-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold max-sm:text-lg">
                {warehouseName}
              </h1>
              {warehouse?.warehouseAddress && (
                <p className="mt-0.5 flex items-start gap-1 text-sm text-zinc-300">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {warehouse.warehouseAddress}
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 max-sm:mt-4 max-sm:gap-2">
            {metrics.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="min-w-0 rounded-lg bg-white/10 p-2.5 text-center"
              >
                <Icon className="mx-auto mb-1 h-4 w-4 text-zinc-300" />
                <p className="truncate text-sm font-bold tabular-nums">
                  {value}
                </p>
                <p className="text-[10px] text-zinc-400">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Category Navigation ── */}
      {categories.length > 0 && (
        <HorizontalScrollRow label="Product categories">
          <CategoryChip
            active={!selectedCategory}
            onClick={() => {
              setSelectedCategory(null);
              setPage(1);
            }}
          >
            All
          </CategoryChip>
          {categories.map((category) => (
            <CategoryChip
              key={category.slug}
              active={selectedCategory === category.slug}
              onClick={() => {
                setSelectedCategory(
                  category.slug === selectedCategory ? null : category.slug,
                );
                setPage(1);
              }}
            >
              {category.name}
              <span className="ml-1.5 text-xs opacity-70">
                {category.productCount}
              </span>
            </CategoryChip>
          ))}
        </HorizontalScrollRow>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search products"
          placeholder="Search products..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="pl-9"
        />
      </div>

      {/* ── Product Grid (the cards shop owners see, ordering disabled) ── */}
      <WarehouseProductGrid
        products={products}
        isLoading={productsLoading}
        warehouseSlug={slug}
        detailBasePath={
          publicBaseUrl ? `${publicBaseUrl}${storefrontPath}/products` : ""
        }
        pagination={pagination}
        onPageChange={setPage}
        mode="preview"
        embedded
      />
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-900 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
      )}
    >
      {children}
    </button>
  );
}
