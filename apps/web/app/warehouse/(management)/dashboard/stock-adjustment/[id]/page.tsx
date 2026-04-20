"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CalendarIcon,
  CheckCircle2Icon,
  FileTextIcon,
  InfoIcon,
  Loader2Icon,
  Package,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";

// ─── Constants ────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  increase: "Increase",
  decrease: "Decrease",
  damage: "Damage",
  loss: "Loss",
  correction: "Correction",
};

const TYPE_ICONS: Record<string, string> = {
  increase: "📈",
  decrease: "📉",
  damage: "💥",
  loss: "📦",
  correction: "🔧",
};

const TYPE_COLORS: Record<string, string> = {
  increase: "bg-emerald-50 text-emerald-700 border-emerald-200",
  decrease: "bg-amber-50 text-amber-700 border-amber-200",
  damage: "bg-red-50 text-red-700 border-red-200",
  loss: "bg-rose-50 text-rose-700 border-rose-200",
  correction: "bg-blue-50 text-blue-700 border-blue-200",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2Icon }
> = {
  draft: {
    label: "Draft",
    color: "text-gray-500 bg-gray-100",
    icon: FileTextIcon,
  },
  submitted: {
    label: "Submitted & Applied",
    color: "text-blue-700 bg-blue-50",
    icon: SendIcon,
  },
  approved: {
    label: "Approved",
    color: "text-emerald-700 bg-emerald-50",
    icon: CheckCircle2Icon,
  },
  rejected: {
    label: "Rejected",
    color: "text-red-700 bg-red-50",
    icon: XCircleIcon,
  },
};

const REASON_LABELS: Record<string, string> = {
  physical_count: "Physical Count Mismatch",
  damage: "Damage",
  expired: "Expired Products",
  theft: "Theft / Pilferage",
  system_error: "System Error",
  other: "Other",
};

// ─── Status Flow Visual ────────────────────────────────────────

function StatusFlow({ current }: { current: string }) {
  const steps = [
    { key: "draft", label: "Draft", icon: FileTextIcon },
    { key: "submitted", label: "Submitted", icon: SendIcon },
    { key: "approved", label: "Approved", icon: CheckCircle2Icon },
  ];

  const currentIdx = steps.findIndex((s) => s.key === current);
  const isRejected = current === "rejected";

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, idx) => {
        const isActive = idx <= currentIdx && !isRejected;
        const isCurrent = step.key === current;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                isCurrent
                  ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                  : isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {isActive && idx < currentIdx ? (
                <CheckCircle2Icon size={12} />
              ) : (
                <Icon size={12} />
              )}
              {step.label}
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-6 h-0.5 mx-0.5 ${
                  idx < currentIdx && !isRejected
                    ? "bg-emerald-400"
                    : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}

      {isRejected && (
        <>
          <div className="w-6 h-0.5 mx-0.5 bg-red-300" />
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 ring-2 ring-red-300">
            <XCircleIcon size={12} />
            Rejected
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function StockAdjustmentDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const adjustmentId = Number(params.id);

  const { data, isLoading, error } = useQuery({
    queryKey: ["stockAdjustment", "detail", adjustmentId],
    queryFn: () =>
      (orpc.stockAdjustment as any).getById.call({ id: adjustmentId }),
    enabled: !!adjustmentId,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      (orpc.stockAdjustment as any).submit.call({ id: adjustmentId }),
    onSuccess: () => {
      toast.success("Adjustment submitted and applied to inventory");
      queryClient.invalidateQueries({ queryKey: ["stockAdjustment"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to submit adjustment");
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-500">Loading adjustment details…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <XCircleIcon size={48} className="text-red-300 mb-4" />
        <p className="text-gray-500 text-lg font-medium">
          Adjustment not found
        </p>
        <Link href="/warehouse/dashboard/stock-adjustment" className="mt-4">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeftIcon size={14} />
            Back to list
          </Button>
        </Link>
      </div>
    );
  }

  const adj = data;
  const items = adj.items || [];
  const statusConf = STATUS_CONFIG[adj.status] || STATUS_CONFIG.draft;

  // Compute stock impact totals
  const totalBefore = items.reduce(
    (s: number, i: any) => s + parseFloat(i.currentQty || "0"),
    0,
  );
  const totalAdjust = parseFloat(adj.totalQtyChange || "0");
  const totalAfter = items.reduce(
    (s: number, i: any) => s + parseFloat(i.afterQty || "0"),
    0,
  );

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/warehouse/dashboard/stock-adjustment">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeftIcon size={16} />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              📋 Adjustment{" "}
              <span className="font-mono text-amber-700">
                {adj.adjustmentNo}
              </span>
            </h1>
          </div>
        </div>

        {/* Submit button for drafts */}
        {adj.status === "draft" && (
          <Button
            size="sm"
            className="gap-1.5 bg-amber-600 hover:bg-amber-700"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <Loader2Icon size={14} className="animate-spin" />
            ) : (
              <SendIcon size={14} />
            )}
            Submit & Apply
          </Button>
        )}
      </div>

      {/* Status Flow */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
          📍 Status Flow
        </h3>
        <StatusFlow current={adj.status} />
      </div>

      {/* Adjustment Info Card */}
      <div className="bg-white border rounded-lg p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
          📦 Adjustment Details
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
          <div>
            <span className="text-[11px] text-gray-400 uppercase block">
              Type
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full border text-xs font-semibold ${TYPE_COLORS[adj.adjustmentType] || ""}`}
            >
              {TYPE_ICONS[adj.adjustmentType]}{" "}
              {TYPE_LABELS[adj.adjustmentType] || adj.adjustmentType}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 uppercase block">
              Status
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xs font-semibold ${statusConf.color}`}
            >
              <statusConf.icon size={12} />
              {statusConf.label}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 uppercase block">
              Date
            </span>
            <p className="text-sm font-medium text-gray-800 mt-1 flex items-center gap-1">
              <CalendarIcon size={12} className="text-gray-400" />
              {new Date(adj.adjustmentDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 uppercase block">
              Reason
            </span>
            <p className="text-sm font-medium text-gray-800 mt-1">
              {REASON_LABELS[adj.reason] || adj.reason}
            </p>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 uppercase block">
              Total Items
            </span>
            <p className="text-sm font-bold text-gray-900 mt-1">
              {adj.totalItems} SKU
            </p>
          </div>
          <div>
            <span className="text-[11px] text-gray-400 uppercase block">
              Total Qty Change
            </span>
            <p
              className={`text-sm font-bold mt-1 tabular-nums ${totalAdjust >= 0 ? "text-emerald-600" : "text-red-600"}`}
            >
              {totalAdjust >= 0 ? "+" : ""}
              {totalAdjust} Units
            </p>
          </div>
        </div>

        {adj.referenceNote && (
          <div className="mt-4 pt-3 border-t">
            <span className="text-[11px] text-gray-400 uppercase block">
              Reference Note
            </span>
            <p className="text-sm text-gray-700 mt-1 flex items-start gap-1.5">
              <InfoIcon size={14} className="text-gray-400 mt-0.5 shrink-0" />
              {adj.referenceNote}
            </p>
          </div>
        )}
      </div>

      {/* Item Details Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            📦 Item Details
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b">
              <th className="text-left py-2.5 px-4">Product</th>
              <th className="text-left py-2.5 px-3">Variant</th>
              <th className="text-right py-2.5 px-3">Before</th>
              <th className="text-center py-2.5 px-3">Adjust</th>
              <th className="text-right py-2.5 px-3">After</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const currentQty = parseFloat(item.currentQty || "0");
              const adjustQty = parseFloat(item.adjustQty || "0");
              const afterQty = parseFloat(item.afterQty || "0");
              const isPositive = adjustQty >= 0;

              return (
                <tr
                  key={item.id}
                  className="border-t hover:bg-gray-50/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="shrink-0 w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                        {item.productImage ? (
                          <Image
                            src={item.productImage}
                            alt={item.productName}
                            width={32}
                            height={32}
                            className="w-8 h-8 object-cover"
                            unoptimized={item.productImage?.startsWith("http")}
                          />
                        ) : (
                          <Package size={14} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {item.productName}
                        </p>
                        {item.sku && (
                          <p className="text-[11px] font-mono text-gray-400">
                            {item.sku}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs text-gray-500">
                    {item.brandName ? `${item.brandName} · ` : ""}
                    {item.unitLabel}
                    {item.color ? ` · ${item.color}` : ""}
                    {item.size ? ` · ${item.size}` : ""}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-medium text-gray-700">
                    {currentQty}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
                        isPositive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {adjustQty}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-bold text-gray-900">
                    {afterQty}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stock Impact Summary */}
      <div className="bg-white border rounded-lg p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          📊 Stock Impact
          <span className="text-amber-600 text-[10px] font-bold bg-amber-50 px-1.5 py-0.5 rounded">
            IMPORTANT
          </span>
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <span className="text-xs text-gray-400 uppercase block">
              Before Adjustment
            </span>
            <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
              {totalBefore}
            </p>
            <span className="text-[11px] text-gray-400">Units</span>
          </div>
          <div
            className={`rounded-lg p-4 text-center ${totalAdjust >= 0 ? "bg-emerald-50" : "bg-red-50"}`}
          >
            <span className="text-xs text-gray-400 uppercase block">
              Change
            </span>
            <p
              className={`text-2xl font-bold mt-1 tabular-nums ${totalAdjust >= 0 ? "text-emerald-600" : "text-red-600"}`}
            >
              {totalAdjust >= 0 ? "+" : ""}
              {totalAdjust}
            </p>
            <span className="text-[11px] text-gray-400">Units</span>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <span className="text-xs text-gray-400 uppercase block">
              After Adjustment
            </span>
            <p className="text-2xl font-bold text-blue-700 mt-1 tabular-nums">
              {totalAfter}
            </p>
            <span className="text-[11px] text-gray-400">Units</span>
          </div>
        </div>

        {adj.status === "submitted" && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            <CheckCircle2Icon size={14} />
            <span className="font-medium">
              This adjustment has been applied to inventory — stock updated in
              real-time.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
