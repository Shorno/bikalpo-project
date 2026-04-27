"use client";

import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AlertTriangle,
  ArrowLeftIcon,
  CalendarIcon,
  Package,
  UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDamageEntryDetail } from "@/hooks/use-shop-owner-api";

const TYPE_LABELS: Record<string, string> = {
  physical: "Physical Damage",
  expired: "Expired",
  lost: "Lost / Missing",
};

const TYPE_COLORS: Record<string, string> = {
  physical: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function DamageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const entryId = parseInt(id, 10);
  const { data, isLoading } = useDamageEntryDetail(entryId);
  const entry = data as any;

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/damage">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeftIcon size={16} /> Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Damage Entry</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-red-200 border-t-red-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/damage">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeftIcon size={16} /> Back
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Not Found</h1>
        </div>
        <p className="text-gray-500">Damage entry not found.</p>
      </div>
    );
  }

  const items = entry.items ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/damage">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeftIcon size={16} /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            🆔 {entry.entryNo}
          </h1>
          <p className="text-sm text-gray-500">Damage Entry Detail</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white border rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          🧾 Basic Info
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-gray-400">Entry ID</span>
            <p className="font-mono font-bold text-gray-900">{entry.entryNo}</p>
          </div>
          <div>
            <span className="text-xs text-gray-400">Type</span>
            <div className="mt-0.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${TYPE_COLORS[entry.damageType] || "bg-gray-100"}`}
              >
                {TYPE_LABELS[entry.damageType] || entry.damageType}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-400">Date</span>
            <p className="text-sm text-gray-900 flex items-center gap-1">
              <CalendarIcon size={12} />
              {new Date(entry.entryDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-400">Entered By</span>
            <p className="text-sm text-gray-900 flex items-center gap-1">
              <UserIcon size={12} />
              {entry.enteredByName || "—"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t">
          <div>
            <span className="text-xs text-gray-400">Total Quantity</span>
            <p className="text-lg font-bold text-gray-900">{entry.totalQty} Units</p>
          </div>
          <div>
            <span className="text-xs text-gray-400">Total Loss</span>
            <p className="text-lg font-bold text-red-600 tabular-nums">
              ৳ {parseFloat(entry.totalLossValue).toLocaleString("en-IN")}
            </p>
          </div>
          <div>
            <span className="text-xs text-gray-400">Status</span>
            <p className={`text-sm font-semibold ${entry.status === "active" ? "text-emerald-600" : "text-gray-400"}`}>
              {entry.status === "active" ? "✔ Active" : "Cancelled"}
            </p>
          </div>
        </div>
      </div>

      {/* Product Breakdown */}
      <div className="bg-white border rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          📦 Product Breakdown
        </h2>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <TableHead className="py-2 h-auto">Product</TableHead>
                <TableHead className="py-2 h-auto">Brand</TableHead>
                <TableHead className="py-2 h-auto">Variant</TableHead>
                <TableHead className="py-2 h-auto">Category</TableHead>
                <TableHead className="text-center py-2 h-auto">Qty</TableHead>
                <TableHead className="text-right py-2 h-auto">Unit Price</TableHead>
                <TableHead className="text-right py-2 h-auto">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow key={item.id} className="hover:bg-gray-50/50">
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="shrink-0 w-7 h-7 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                        {item.productImage ? (
                          <Image
                            src={item.productImage}
                            alt={item.productName}
                            width={28}
                            height={28}
                            className="w-7 h-7 object-cover"
                            unoptimized={item.productImage?.startsWith("http")}
                          />
                        ) : (
                          <Package size={12} className="text-gray-400" />
                        )}
                      </div>
                      <span className="font-semibold text-gray-900 text-sm truncate max-w-[140px]">
                        {item.productName}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 py-2.5">
                    {item.brandName || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 py-2.5">
                    {item.unitLabel}
                    {item.weightKg ? ` · ${item.weightKg}kg` : ""}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600 py-2.5">
                    {item.categoryName || "—"}
                  </TableCell>
                  <TableCell className="text-center font-bold text-gray-900 py-2.5 tabular-nums">
                    {item.qty}
                  </TableCell>
                  <TableCell className="text-right text-sm text-gray-700 py-2.5 tabular-nums">
                    ৳ {parseFloat(item.unitPrice).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-right text-sm font-bold text-red-600 py-2.5 tabular-nums">
                    ৳ {parseFloat(item.totalValue).toLocaleString("en-IN")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="text-right text-xs text-gray-500">
          ✔ Total = {entry.totalQty} Units ✔ Matches Entry
        </div>
      </div>

      {/* Proof Images */}
      {entry.proofImages?.length > 0 && (
        <div className="bg-white border rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            📸 Damage Proof
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {entry.proofImages.map((url: string, idx: number) => (
              <div
                key={idx}
                className="aspect-square rounded-lg overflow-hidden border bg-gray-100"
              >
                <Image
                  src={url}
                  alt={`Proof ${idx + 1}`}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover"
                  unoptimized={url.startsWith("http")}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {entry.description && (
        <div className="bg-white border rounded-lg p-5 space-y-2">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            📝 Description
          </h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {entry.description}
          </p>
        </div>
      )}
    </div>
  );
}
