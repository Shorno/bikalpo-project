"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Locate,
  MapPin,
  Search,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CustomerPreviewBanner } from "@/components/storefront/customer-preview-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { orpc } from "@/utils/orpc";

type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "granted"; lat: string; lng: string }
  | { status: "denied" }
  | { status: "unavailable" };

export default function StoresPage() {
  const searchParams = useSearchParams();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));
  const [search, setSearch] = useState("");
  const [areaId, setAreaId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [location, setLocation] = useState<LocationState>({ status: "idle" });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation({ status: "unavailable" });
      return;
    }
    setLocation({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          status: "granted",
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
        });
        setPage(1);
      },
      () => {
        setLocation({ status: "denied" });
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, []);

  // Auto-request location on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const isLocated = location.status === "granted";

  const { data: areasData } = useQuery(
    orpc.customer.getAreas.queryOptions({
      input: undefined,
      staleTime: 1000 * 60 * 10,
    }),
  );

  const { data, isLoading, isError } = useQuery(
    orpc.customer.getShops.queryOptions({
      input: {
        search: search || undefined,
        areaId,
        lat: isLocated ? location.lat : undefined,
        lng: isLocated ? location.lng : undefined,
        page,
        limit: 12,
      },
      staleTime: 1000 * 60 * 2,
    }),
  );

  const shops = data?.shops ?? [];
  const pagination = data?.pagination;
  const areas = areasData?.areas ?? [];
  const hasActiveFilters = !!search || !!areaId || isLocated;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50/80 to-white">
      {previewMode && <CustomerPreviewBanner />}
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="container mx-auto px-4 py-14 relative">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Discover Local Shops
            </h1>
            <p className="text-emerald-100/90 mt-3 text-base sm:text-lg leading-relaxed">
              Browse verified sellers near you and explore their catalogs. Find
              quality products from trusted local businesses.
            </p>
          </div>

          {/* Stats & Location */}
          <div className="flex items-center gap-6 mt-6">
            {pagination && (
              <div className="text-white/90">
                <span className="text-2xl font-bold">
                  {pagination.totalCount}
                </span>
                <span className="text-emerald-200 ml-1.5 text-sm">
                  {isLocated ? "shops near you" : "shops available"}
                </span>
              </div>
            )}

            {/* Location status */}
            {location.status === "idle" ||
            location.status === "denied" ||
            location.status === "unavailable" ? (
              <button
                onClick={requestLocation}
                className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all"
              >
                <Locate className="w-4 h-4" />
                Use my location
              </button>
            ) : location.status === "loading" ? (
              <span className="flex items-center gap-1.5 text-sm text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                Detecting location…
              </span>
            ) : isLocated ? (
              <span className="flex items-center gap-1.5 text-sm text-emerald-200">
                <Locate className="w-4 h-4" />
                Showing nearby shops
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="container mx-auto px-4 -mt-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-900/5 border border-gray-100 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search shops by name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10 h-11 bg-gray-50/80 border-gray-200 focus:bg-white transition-colors"
              />
            </div>

            {areas.length > 0 && (
              <Select
                value={areaId ? String(areaId) : "all"}
                onValueChange={(v) => {
                  setAreaId(v === "all" ? undefined : Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-52 h-11 bg-gray-50/80 border-gray-200">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="All areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  {areas.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Active filters indicator */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">Filters:</span>
              {search && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs font-normal cursor-pointer hover:bg-gray-200"
                  onClick={() => setSearch("")}
                >
                  &ldquo;{search}&rdquo;
                  <X className="w-3 h-3" />
                </Badge>
              )}
              {areaId && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs font-normal cursor-pointer hover:bg-gray-200"
                  onClick={() => setAreaId(undefined)}
                >
                  {areas.find((a: any) => a.id === areaId)?.name || "Area"}
                  <X className="w-3 h-3" />
                </Badge>
              )}
              {isLocated && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-xs font-normal cursor-pointer hover:bg-gray-200"
                  onClick={() => setLocation({ status: "idle" })}
                >
                  <Locate className="w-3 h-3" />
                  Near me
                  <X className="w-3 h-3" />
                </Badge>
              )}
              <button
                onClick={() => {
                  setSearch("");
                  setAreaId(undefined);
                  setLocation({ status: "idle" });
                }}
                className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ShopCardSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <p className="text-gray-700 font-semibold text-lg">
              Something went wrong
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Failed to load shops. Please try again later.
            </p>
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-gray-700 font-semibold text-lg">
              No shops found
            </p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
              {search
                ? "Try adjusting your search term or filters"
                : "No approved shops available in this area yet"}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearch("");
                  setAreaId(undefined);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Results count */}
            {pagination && (
              <p className="text-sm text-gray-400 mb-5">
                Showing{" "}
                <span className="text-gray-600 font-medium">
                  {(pagination.page - 1) * 12 + 1}–
                  {Math.min(pagination.page * 12, pagination.totalCount)}
                </span>{" "}
                of{" "}
                <span className="text-gray-600 font-medium">
                  {pagination.totalCount}
                </span>{" "}
                shops
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {shops.map((shop: any) => (
                <Link
                  key={shop.id}
                  href={withCustomerStorefrontPreview(
                    `/stores/${shop.shopSlug}`,
                    previewMode,
                  )}
                  className="group"
                >
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-emerald-200/60">
                    {/* Card Header */}
                    <div className="relative bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-6">
                      <div className="flex items-center gap-4">
                        {shop.image ? (
                          <div className="relative">
                            <Image
                              src={shop.image}
                              alt={shop.shopName || shop.name}
                              width={56}
                              height={56}
                              className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm"
                            />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm border border-emerald-100">
                            <Store className="w-6 h-6 text-emerald-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">
                            {shop.shopName || shop.name}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="text-[11px] mt-1.5 bg-white/70 text-gray-600 font-normal"
                          >
                            <ShoppingBag className="w-3 h-3 mr-1" />
                            {shop.businessType || "Retail"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="px-5 py-3.5 flex items-center justify-between">
                      {shop.shopAddress ? (
                        <div className="flex items-center gap-1.5 text-[13px] text-gray-400 min-w-0">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{shop.shopAddress}</span>
                        </div>
                      ) : (
                        <span />
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0 ml-2" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1 mx-2">
                  {Array.from(
                    { length: Math.min(pagination.totalPages, 5) },
                    (_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                            p === page
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "text-gray-500 hover:bg-gray-100"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    },
                  )}
                  {pagination.totalPages > 5 && (
                    <>
                      <span className="text-gray-300 px-1">…</span>
                      <button
                        onClick={() => setPage(pagination.totalPages)}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                          pagination.totalPages === page
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        {pagination.totalPages}
                      </button>
                    </>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ShopCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="bg-gray-50 p-6 flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="px-5 py-3.5">
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}
