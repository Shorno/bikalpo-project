"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BoxesIcon,
  Eye,
  Layers,
  MapPin,
  Package,
  PackagePlus,
  Search,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

// ─── KPI Card ──────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: "amber" | "blue" | "emerald" | "purple";
}) {
  const styles = {
    amber: {
      bg: "bg-gradient-to-br from-amber-50 to-amber-100/60 border-amber-200/80",
      icon: "bg-amber-200/80 text-amber-700",
      val: "text-amber-800",
    },
    blue: {
      bg: "bg-gradient-to-br from-blue-50 to-blue-100/60 border-blue-200/80",
      icon: "bg-blue-200/80 text-blue-700",
      val: "text-blue-800",
    },
    emerald: {
      bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/60 border-emerald-200/80",
      icon: "bg-emerald-200/80 text-emerald-700",
      val: "text-emerald-800",
    },
    purple: {
      bg: "bg-gradient-to-br from-purple-50 to-purple-100/60 border-purple-200/80",
      icon: "bg-purple-200/80 text-purple-700",
      val: "text-purple-800",
    },
  };
  const s = styles[color];

  return (
    <div
      className={`border rounded-2xl p-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${s.bg}`}
    >
      <div className="flex items-center gap-3.5">
        <div className={`p-3 rounded-xl ${s.icon}`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <div className={`text-2xl font-extrabold tabular-nums ${s.val}`}>
            {value}
          </div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function CartonTrackingPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getCartonTrackingProducts", debouncedSearch, page],
    queryFn: () =>
      (orpc.warehouse as any).getCartonTrackingProducts.call({
        search: debouncedSearch || undefined,
        page,
        pageSize,
      }),
  });

  const rawProducts = data?.products ?? [];
  const products = variantFilter
    ? rawProducts.filter((p: any) =>
        p.variantsAvailable.toUpperCase().includes(variantFilter.toUpperCase()),
      )
    : rawProducts;
  const kpi = data?.kpi ?? {
    totalProducts: 0,
    totalCartons: 0,
    totalUnits: 0,
    activeLocations: 0,
  };
  const pagination = data?.pagination ?? {
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 rounded-xl">
              <BoxesIcon className="text-amber-600" size={22} />
            </div>
            Carton Tracking
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage all cartons across your warehouse
          </p>
        </div>
        <Link href="/warehouse/dashboard/carton-tracking/create">
          <Button className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm">
            <PackagePlus size={16} />
            Create Carton
          </Button>
        </Link>
      </div>

      {/* ── Search / Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Search SKU / Product Name / Carton ID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              clearTimeout((window as any).__cartonSearchTimer);
              (window as any).__cartonSearchTimer = setTimeout(() => {
                setDebouncedSearch(e.target.value);
                setPage(1);
              }, 300);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Filter:</span>
          {["All", "2KG", "5KG", "10KG", "25KG"].map((v) => (
            <Button
              key={v}
              variant={
                (v === "All" && !variantFilter) || variantFilter === v
                  ? "default"
                  : "outline"
              }
              size="sm"
              className={`text-xs h-7 px-2.5 ${
                (v === "All" && !variantFilter) || variantFilter === v
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "hover:bg-amber-50 hover:border-amber-300"
              }`}
              onClick={() => {
                setVariantFilter(v === "All" ? "" : v);
                setPage(1);
              }}
            >
              {v}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground ml-auto">
          <span className="font-semibold text-foreground">
            {pagination.totalCount}
          </span>{" "}
          products
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total Products"
          value={kpi.totalProducts.toLocaleString()}
          icon={Package}
          color="amber"
        />
        <KpiCard
          label="Total Cartons"
          value={kpi.totalCartons.toLocaleString()}
          icon={BoxesIcon}
          color="blue"
        />
        <KpiCard
          label="Total Units"
          value={`${kpi.totalUnits.toLocaleString()} pcs`}
          icon={Layers}
          color="emerald"
        />
        <KpiCard
          label="Active Locations"
          value={kpi.activeLocations}
          icon={MapPin}
          color="purple"
        />
      </div>

      {/* ── Product Table ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-xl bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading carton data…
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-xl bg-gray-50/50">
          <BoxesIcon className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">
            No cartons found
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {debouncedSearch
              ? "Try adjusting your search"
              : "Create your first carton to get started"}
          </p>
          {!debouncedSearch && (
            <Link href="/warehouse/dashboard/carton-tracking/create">
              <Button className="mt-4 bg-amber-600 hover:bg-amber-700 text-sm">
                <PackagePlus size={14} className="mr-1.5" />
                Create Carton
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100/80 border-b border-gray-200">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Variants Available
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Carton Weight
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Total Qty
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p: any) => (
                <tr
                  key={p.productId}
                  className="hover:bg-amber-50/30 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border">
                        {p.productImage ? (
                          <Image
                            src={p.productImage}
                            alt={p.productName}
                            width={36}
                            height={36}
                            className="w-9 h-9 object-cover"
                            unoptimized={p.productImage.startsWith("http")}
                          />
                        ) : (
                          <Package size={16} className="text-gray-400" />
                        )}
                      </div>
                      <span className="font-semibold text-gray-900 truncate">
                        {p.productName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {p.variantsAvailable
                        .split(", ")
                        .map((v: string, i: number) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-700 rounded-md"
                          >
                            {v}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-gray-700 tabular-nums">
                    {p.totalWeightKg} KG
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="font-bold text-gray-900 tabular-nums">
                      {p.activeCartons}
                    </span>
                    <span className="text-gray-500 ml-1 text-xs">Carton</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Link
                      href={`/warehouse/dashboard/carton-tracking/${p.productId}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
                      >
                        <Eye size={13} />
                        View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-xs text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-900">
                  {(page - 1) * pageSize + 1}–
                  {Math.min(page * pageSize, pagination.totalCount)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-900">
                  {pagination.totalCount}
                </span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="h-7 w-7 p-0 text-xs"
                >
                  «
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="h-7 w-7 p-0 text-xs"
                >
                  ‹
                </Button>
                <span className="text-xs font-medium text-gray-600 px-2">
                  Page {page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="h-7 w-7 p-0 text-xs"
                >
                  ›
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(pagination.totalPages)}
                  disabled={page === pagination.totalPages}
                  className="h-7 w-7 p-0 text-xs"
                >
                  »
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
