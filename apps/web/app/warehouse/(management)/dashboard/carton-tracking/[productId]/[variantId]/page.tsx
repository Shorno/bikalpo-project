"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BoxesIcon,
  Eye,
  Package,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orpc } from "@/utils/orpc";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    broken: "bg-red-100 text-red-700 border-red-200",
    dispatched: "bg-blue-100 text-blue-700 border-blue-200",
    sold: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-md border ${config[status] || config.active}`}
    >
      {status}
    </span>
  );
}

export default function CartonListPage() {
  const params = useParams();
  const productId = Number(params.productId);
  const variantId = Number(params.variantId);

  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch cartons for this variant
  const { data, isLoading } = useQuery({
    queryKey: [
      "warehouse",
      "getCartons",
      variantId,
      statusFilter,
      page,
    ],
    queryFn: () =>
      (orpc.warehouse as any).getCartons.call({
        variantId,
        status: statusFilter,
        page,
        limit,
      }),
    enabled: !!variantId,
  });

  // Fetch variant/product info
  const { data: variantData } = useQuery({
    queryKey: ["warehouse", "getCartonTrackingVariants", productId],
    queryFn: () =>
      (orpc.warehouse as any).getCartonTrackingVariants.call({ productId }),
    enabled: !!productId,
  });

  const productInfo = variantData?.product ?? { productName: "…" };
  const variantInfo =
    variantData?.variants?.find((v: any) => v.variantId === variantId) ?? {};

  const cartons = data?.cartons ?? [];
  const stats = data?.stats ?? { active: 0, total: 0 };
  const pagination = data?.pagination ?? {
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 1,
  };

  const statusOptions = [
    { label: "All", value: undefined },
    { label: "Active", value: "active" },
    { label: "Broken", value: "broken" },
    { label: "Dispatched", value: "dispatched" },
    { label: "Sold", value: "sold" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-3">
        <Link href={`/warehouse/dashboard/carton-tracking/${productId}`}>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg hover:bg-amber-50"
          >
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <Link
            href="/warehouse/dashboard/carton-tracking"
            className="hover:text-amber-600 transition-colors"
          >
            Carton Tracking
          </Link>
          <span>/</span>
          <Link
            href={`/warehouse/dashboard/carton-tracking/${productId}`}
            className="hover:text-amber-600 transition-colors"
          >
            {productInfo.productName}
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">
            {variantInfo.variantLabel || "Variant"}
          </span>
        </div>
      </div>

      {/* ── Summary Card ── */}
      <div className="p-5 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 border border-blue-200/60 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-xl border border-blue-200/60 shadow-sm">
            <BoxesIcon size={22} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {productInfo.productName} — {variantInfo.variantLabel || "Variant"}
            </h2>
            <p className="text-sm text-gray-500">
              {variantInfo.brandName || "—"} · {variantInfo.weightKg || "—"} KG
              · SKU: {variantInfo.sku || "—"}
            </p>
          </div>
        </div>
        <div className="hidden sm:flex gap-3">
          <div className="text-center px-4 py-2 bg-white/80 rounded-xl border">
            <p className="text-xl font-extrabold text-emerald-700 tabular-nums">
              {stats.active}
            </p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">
              Active
            </p>
          </div>
          <div className="text-center px-4 py-2 bg-white/80 rounded-xl border">
            <p className="text-xl font-extrabold text-gray-600 tabular-nums">
              {stats.total}
            </p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">
              Total
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter Row ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusOptions.map((opt) => (
          <Button
            key={opt.label}
            variant={statusFilter === opt.value ? "default" : "outline"}
            size="sm"
            className={`text-xs h-8 ${
              statusFilter === opt.value
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "hover:bg-amber-50 hover:border-amber-300"
            }`}
            onClick={() => {
              setStatusFilter(opt.value as any);
              setPage(1);
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* ── Carton Table ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-gray-50/50">
          <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading cartons…</p>
        </div>
      ) : cartons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-xl bg-gray-50/50">
          <Package className="text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 font-medium">No cartons found</p>
          <p className="text-sm text-gray-400 mt-1">
            {statusFilter
              ? `No ${statusFilter} cartons for this variant`
              : "Create cartons for this variant to see them here"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-100/80 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Brand
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Variant
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Carton Weight
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Total Qty
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Carton ID
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cartons.map((c: any) => (
                <tr
                  key={c.id}
                  className="hover:bg-amber-50/30 transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md">
                      {c.variant?.brand?.name || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-gray-900 text-sm">
                    {c.variant?.product?.name || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-gray-700 text-sm">
                    {c.variant?.unitLabel || "—"}
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-gray-700 tabular-nums">
                    {c.totalWeightKg} KG
                  </td>
                  <td className="px-4 py-3.5 text-center font-bold text-gray-900 tabular-nums">
                    {c.totalPacks}{" "}
                    <span className="text-xs text-gray-500 font-normal">pcs</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono font-semibold text-amber-700 text-xs bg-amber-50 px-2 py-1 rounded-md border border-amber-200/60">
                      {c.cartonId}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-xs text-gray-600">
                      {c.storageArea?.name || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Link
                      href={`/warehouse/dashboard/carton-tracking/${productId}/${variantId}/${c.id}`}
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
                <span className="font-medium">
                  {(page - 1) * limit + 1}–
                  {Math.min(page * limit, pagination.totalCount)}
                </span>{" "}
                of{" "}
                <span className="font-medium">{pagination.totalCount}</span>
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="h-7 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="h-7 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
