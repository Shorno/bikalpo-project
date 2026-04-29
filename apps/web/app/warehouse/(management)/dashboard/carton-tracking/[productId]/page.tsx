"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BoxesIcon,
  Eye,
  Layers,
  Package,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

export default function CartonVariantBreakdownPage() {
  const params = useParams();
  const productId = Number(params.productId);

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getCartonTrackingVariants", productId],
    queryFn: () =>
      (orpc.warehouse as any).getCartonTrackingVariants.call({ productId }),
    enabled: !!productId,
  });

  const product = data?.product ?? {
    productName: "Loading...",
    productImage: "",
  };
  const variants = data?.variants ?? [];

  const totalCartons = variants.reduce(
    (s: number, v: any) => s + v.activeCartons,
    0,
  );
  const totalPacks = variants.reduce(
    (s: number, v: any) => s + v.totalPacks,
    0,
  );

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb + Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/warehouse/dashboard/carton-tracking">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg hover:bg-amber-50"
          >
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link
            href="/warehouse/dashboard/carton-tracking"
            className="hover:text-amber-600 transition-colors"
          >
            Carton Tracking
          </Link>
          <span>/</span>
          <span className="font-semibold text-gray-900">
            {product.productName}
          </span>
        </div>
      </div>

      {/* ── Product Info Card ── */}
      <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-amber-50/80 to-orange-50/40 border border-amber-200/60 rounded-2xl">
        <div className="shrink-0 w-14 h-14 rounded-xl bg-white border border-amber-200/60 flex items-center justify-center overflow-hidden shadow-sm">
          {product.productImage ? (
            <Image
              src={product.productImage}
              alt={product.productName}
              width={56}
              height={56}
              className="w-14 h-14 object-cover"
              unoptimized={product.productImage?.startsWith("http")}
            />
          ) : (
            <Package size={24} className="text-amber-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900">
            {product.productName}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {variants.length} variant{variants.length !== 1 ? "s" : ""} ·{" "}
            {totalCartons} active carton{totalCartons !== 1 ? "s" : ""} ·{" "}
            {totalPacks.toLocaleString()} pcs
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-center px-4 py-2 bg-white/80 rounded-xl border">
            <p className="text-xl font-extrabold text-amber-700 tabular-nums">
              {totalCartons}
            </p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">
              Cartons
            </p>
          </div>
          <div className="text-center px-4 py-2 bg-white/80 rounded-xl border">
            <p className="text-xl font-extrabold text-emerald-700 tabular-nums">
              {totalPacks.toLocaleString()}
            </p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase">
              Units
            </p>
          </div>
        </div>
      </div>

      {/* ── Variant Breakdown ── */}
      <div>
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Layers size={14} />
          Variant Breakdown
        </p>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 border rounded-xl bg-gray-50/50">
            <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">
              Loading variants…
            </p>
          </div>
        ) : variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-dashed rounded-xl bg-gray-50/50">
            <BoxesIcon className="text-gray-300 mb-3" size={40} />
            <p className="text-gray-500 font-medium">
              No cartons for this product
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100/80 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Variant
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Brand
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Cartons
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Total Units
                  </th>
                  <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variants.map((v: any) => (
                  <tr
                    key={v.variantId}
                    className="hover:bg-amber-50/30 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-50 rounded-lg">
                          <BoxesIcon size={16} className="text-amber-500" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {v.variantLabel}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {v.weightKg} KG · SKU: {v.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-md">
                        {v.brandName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center font-bold text-gray-900 tabular-nums">
                      {v.activeCartons}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-emerald-600 tabular-nums">
                      {v.totalPacks.toLocaleString()} pcs
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Link
                        href={`/warehouse/dashboard/carton-tracking/${productId}/${v.variantId}`}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
                        >
                          <Eye size={13} />
                          Detail
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
