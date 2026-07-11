"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CalendarIcon,
  Loader2Icon,
  MinusCircleIcon,
  Package,
  PlusCircleIcon,
  SaveIcon,
  Search,
  SendIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ─────────────────────────────────────────────────────

type AdjustmentType =
  | "increase"
  | "decrease"
  | "damage"
  | "loss"
  | "correction";
type AdjustmentReason =
  | "physical_count"
  | "damage"
  | "expired"
  | "theft"
  | "system_error"
  | "other";

type SelectedItem = {
  variantId: number;
  sku: string | null;
  unitLabel: string;
  weightKg: string;
  productName: string;
  productImage: string | null;
  brandName: string | null;
  color: string | null;
  size: string | null;
  currentQty: number;
  adjustQty: number;
  note: string;
};

// ─── Constants ────────────────────────────────────────────────

const ADJUSTMENT_TYPES: { value: AdjustmentType; label: string; icon: string; desc: string }[] = [
  { value: "increase", label: "Increase", icon: "📈", desc: "Stock found or returned" },
  { value: "decrease", label: "Decrease", icon: "📉", desc: "Stock removed or missing" },
  { value: "damage", label: "Damage", icon: "💥", desc: "Damaged/unusable stock" },
  { value: "loss", label: "Loss", icon: "📦", desc: "Lost or stolen stock" },
  { value: "correction", label: "Correction", icon: "🔧", desc: "Fix count mismatch" },
];

const REASON_OPTIONS: { value: AdjustmentReason; label: string }[] = [
  { value: "physical_count", label: "Physical Count Mismatch" },
  { value: "damage", label: "Damage" },
  { value: "expired", label: "Expired Products" },
  { value: "theft", label: "Theft / Pilferage" },
  { value: "system_error", label: "System Error" },
  { value: "other", label: "Other" },
];

function isReductionType(type: AdjustmentType | null) {
  return type === "decrease" || type === "damage" || type === "loss";
}

function normalizeAdjustmentQty(type: AdjustmentType | null, quantity: number) {
  if (isReductionType(type)) return -Math.abs(quantity);
  if (type === "increase") return Math.abs(quantity);
  return quantity;
}

// ─── Main Page ─────────────────────────────────────────────────

export default function CreateStockAdjustmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form state
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType | null>(null);
  const [reason, setReason] = useState<AdjustmentReason | null>(null);
  const [referenceNote, setReferenceNote] = useState("");
  const [adjustmentDate, setAdjustmentDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Product search
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["stockAdjustment", "searchVariants", debouncedSearch],
    queryFn: () =>
      (orpc.stockAdjustment as any).searchVariants.call({
        search: debouncedSearch,
        limit: 20,
      }),
    enabled: debouncedSearch.length >= 1,
  });

  const searchResults = searchData?.variants ?? [];

  const handleSearchInput = useCallback((value: string) => {
    setSearchTerm(value);
    clearTimeout((window as any).__adjProductSearch);
    (window as any).__adjProductSearch = setTimeout(() => {
      setDebouncedSearch(value);
      setShowSearchResults(value.length >= 1);
    }, 300);
  }, []);

  const addItem = useCallback(
    (variant: (typeof searchResults)[0]) => {
      if (selectedItems.find((i) => i.variantId === variant.variantId)) {
        toast.error("Product already added");
        return;
      }
      setSelectedItems((prev) => [
        ...prev,
        {
          variantId: variant.variantId,
          sku: variant.sku,
          unitLabel: variant.unitLabel,
          weightKg: variant.weightKg,
          productName: variant.productName,
          productImage: variant.productImage,
          brandName: variant.brandName,
          color: variant.color,
          size: variant.size,
          currentQty: variant.availableQty,
          adjustQty: 0,
          note: "",
        },
      ]);
      setSearchTerm("");
      setDebouncedSearch("");
      setShowSearchResults(false);
    },
    [selectedItems],
  );

  const removeItem = useCallback((variantId: number) => {
    setSelectedItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const updateItemQty = useCallback((variantId: number, adjustQty: number) => {
    setSelectedItems((prev) =>
      prev.map((i) =>
        i.variantId === variantId
          ? { ...i, adjustQty: normalizeAdjustmentQty(adjustmentType, adjustQty) }
          : i,
      ),
    );
  }, [adjustmentType]);

  const handleAdjustmentTypeChange = useCallback((type: AdjustmentType) => {
    setAdjustmentType(type);
    setSelectedItems((items) =>
      items.map((item) => ({
        ...item,
        adjustQty: normalizeAdjustmentQty(type, item.adjustQty),
      })),
    );
  }, []);

  const updateItemNote = useCallback((variantId: number, note: string) => {
    setSelectedItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, note } : i)),
    );
  }, []);

  // Validation
  const hasNegativeAfterQty = selectedItems.some(
    (i) => i.currentQty + i.adjustQty < 0,
  );
  const hasZeroAdjust = selectedItems.some((i) => i.adjustQty === 0);
  const canSubmit =
    adjustmentType &&
    reason &&
    selectedItems.length > 0 &&
    !hasNegativeAfterQty &&
    !hasZeroAdjust;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (status: "draft" | "submitted") =>
      (orpc.stockAdjustment as any).create.call({
        adjustmentType,
        reason,
        referenceNote: referenceNote || undefined,
        adjustmentDate,
        status,
        items: selectedItems.map((i) => ({
          variantId: i.variantId,
          adjustQty: i.adjustQty,
          note: i.note || undefined,
        })),
      }),
    onSuccess: (data: any) => {
      toast.success(
        `Adjustment ${data.adjustmentNo} ${data.status === "submitted" ? "submitted" : "saved as draft"}`,
      );
      queryClient.invalidateQueries({ queryKey: ["stockAdjustment"] });
      router.push("/warehouse/dashboard/stock-adjustment");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create adjustment");
    },
  });

  const totalQtyChange = selectedItems.reduce((s, i) => s + i.adjustQty, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/warehouse/dashboard/stock-adjustment">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeftIcon size={16} />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            ➕ Create Stock Adjustment
          </h1>
          <p className="text-sm text-gray-500">
            Record stock corrections, damage, and manual adjustments
          </p>
        </div>
      </div>

      {/* ─── Section 1: Adjustment Info ─── */}
      <div className="bg-white border rounded-lg p-5 space-y-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          📦 Adjustment Info
        </h2>

        {/* Adjustment Type Selector */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-2 block">
            Adjustment Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {ADJUSTMENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => handleAdjustmentTypeChange(t.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                  adjustmentType === t.value
                    ? "border-amber-500 bg-amber-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                <span className="text-xs font-semibold text-gray-800">
                  {t.label}
                </span>
                <span className="text-[10px] text-gray-400 leading-tight">
                  {t.desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Reason + Date row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Reason <span className="text-red-500">*</span>
            </label>
            <Select
              value={reason ?? ""}
              onValueChange={(v) => setReason(v as AdjustmentReason)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Adjustment Date
            </label>
            <div className="relative">
              <CalendarIcon
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <Input
                type="date"
                value={adjustmentDate}
                onChange={(e) => setAdjustmentDate(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Reference Note */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
            Reference Note (Optional)
          </label>
          <Textarea
            value={referenceNote}
            onChange={(e) => setReferenceNote(e.target.value)}
            placeholder="Enter reference, invoice number, or reason details..."
            className="text-sm resize-none"
            rows={2}
          />
        </div>
      </div>

      {/* ─── Section 2: Product Picker ─── */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          📦 Select Products (SKU Level)
        </h2>

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10"
          />
          <Input
            placeholder="Search by product name, SKU, or brand..."
            value={searchTerm}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => {
              if (debouncedSearch.length >= 1) setShowSearchResults(true);
            }}
            className="pl-9 h-10 text-sm"
          />

          {/* Search Dropdown */}
          {showSearchResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto">
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2Icon
                    size={20}
                    className="animate-spin text-gray-400"
                  />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  No variants found
                </div>
              ) : (
                searchResults.map((v: any) => {
                  const alreadyAdded = selectedItems.some(
                    (i) => i.variantId === v.variantId,
                  );
                  return (
                    <button
                      key={v.variantId}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addItem(v)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-0 ${
                        alreadyAdded
                          ? "bg-gray-50 opacity-50 cursor-not-allowed"
                          : "hover:bg-amber-50"
                      }`}
                    >
                      <div className="shrink-0 w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                        {v.productImage ? (
                          <Image
                            src={v.productImage}
                            alt={v.productName}
                            width={32}
                            height={32}
                            className="w-8 h-8 object-cover"
                            unoptimized={v.productImage.startsWith("http")}
                          />
                        ) : (
                          <Package size={14} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {v.productName}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {v.brandName ? `${v.brandName} · ` : ""}
                          {v.unitLabel} · {v.weightKg}kg
                          {v.sku ? ` · ${v.sku}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-gray-700 tabular-nums">
                          {v.availableQty}
                        </p>
                        <p className="text-[10px] text-gray-400">in stock</p>
                      </div>
                      {alreadyAdded && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          Added
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Close overlay */}
        {showSearchResults && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSearchResults(false)}
          />
        )}

        {/* Selected Items Table */}
        {selectedItems.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-3">Product</th>
                  <th className="text-left py-2 px-3">Variant</th>
                  <th className="text-right py-2 px-3">Current</th>
                  <th className="text-center py-2 px-3 w-28">Adjust</th>
                  <th className="text-right py-2 px-3">After</th>
                  <th className="text-center py-2 px-3 w-9" />
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((item) => {
                  const afterQty = item.currentQty + item.adjustQty;
                  const isNegative = afterQty < 0;
                  return (
                    <tr
                      key={item.variantId}
                      className={`border-t ${isNegative ? "bg-red-50/50" : "hover:bg-gray-50/50"}`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="shrink-0 w-7 h-7 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                            {item.productImage ? (
                              <Image
                                src={item.productImage}
                                alt={item.productName}
                                width={28}
                                height={28}
                                className="w-7 h-7 object-cover"
                                unoptimized={item.productImage.startsWith(
                                  "http",
                                )}
                              />
                            ) : (
                              <Package size={12} className="text-gray-400" />
                            )}
                          </div>
                          <span className="font-semibold text-gray-900 truncate max-w-[160px]">
                            {item.productName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">
                        {item.brandName ? `${item.brandName} · ` : ""}
                        {item.unitLabel}{" "}
                        {item.color ? `· ${item.color}` : ""}
                        {item.size ? `· ${item.size}` : ""}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-gray-700">
                        {item.currentQty}
                      </td>
                      <td className="py-2.5 px-3">
                        <Input
                          type="number"
                          value={
                            item.adjustQty
                              ? isReductionType(adjustmentType)
                                ? Math.abs(item.adjustQty)
                                : item.adjustQty
                              : ""
                          }
                          onChange={(e) =>
                            updateItemQty(
                              item.variantId,
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          placeholder="0"
                          className={`h-8 text-sm text-center tabular-nums font-bold w-24 mx-auto ${
                            item.adjustQty > 0
                              ? "text-emerald-600"
                              : item.adjustQty < 0
                                ? "text-red-600"
                                : ""
                          }`}
                        />
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                          isNegative
                            ? "text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {afterQty}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(item.variantId)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <XIcon size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedItems.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm border border-dashed rounded-lg">
            Search and add products above to begin the adjustment
          </div>
        )}
      </div>

      {/* ─── Section 3: Validation ─── */}
      {selectedItems.length > 0 && (
        <div className="bg-white border rounded-lg p-4 space-y-2">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
            📊 Stock Validation
          </h3>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center gap-2">
              {hasNegativeAfterQty ? (
                <>
                  <AlertTriangleIcon size={14} className="text-red-500" />
                  <span className="text-red-600 font-medium">
                    Some items would result in negative stock — fix before
                    submitting
                  </span>
                </>
              ) : (
                <>
                  <span className="text-emerald-600">✔</span>
                  <span className="text-gray-600">
                    All stock levels valid — no negative results
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasZeroAdjust ? (
                <>
                  <AlertTriangleIcon size={14} className="text-amber-500" />
                  <span className="text-amber-600 font-medium">
                    Some items have zero adjustment — update or remove them
                  </span>
                </>
              ) : (
                <>
                  <span className="text-emerald-600">✔</span>
                  <span className="text-gray-600">
                    All items have non-zero adjustments
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="mt-3 pt-3 border-t flex items-center gap-6 text-sm">
            <div>
              <span className="text-xs text-gray-400">Total Items</span>
              <p className="font-bold text-gray-900">{selectedItems.length} SKU</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">Total Qty Change</span>
              <p
                className={`font-bold tabular-nums ${totalQtyChange >= 0 ? "text-emerald-600" : "text-red-600"}`}
              >
                {totalQtyChange >= 0 ? "+" : ""}
                {totalQtyChange} Units
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Section 4: Actions ─── */}
      <div className="flex items-center justify-between bg-white border rounded-lg p-4">
        <Link href="/warehouse/dashboard/stock-adjustment">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={createMutation.isPending}
          >
            <XIcon size={14} />
            Cancel
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={
              !adjustmentType ||
              !reason ||
              selectedItems.length === 0 ||
              createMutation.isPending
            }
            onClick={() => createMutation.mutate("draft")}
          >
            {createMutation.isPending ? (
              <Loader2Icon size={14} className="animate-spin" />
            ) : (
              <SaveIcon size={14} />
            )}
            Save Draft
          </Button>             

          <Button
            size="sm"
            className="gap-1.5 bg-amber-600 hover:bg-amber-700"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate("submitted")}
          >
            {createMutation.isPending ? (
              <Loader2Icon size={14} className="animate-spin" />
            ) : (
              <SendIcon size={14} />
            )}
            Submit Adjustment
          </Button>
        </div>
      </div>
    </div>
  );
}
