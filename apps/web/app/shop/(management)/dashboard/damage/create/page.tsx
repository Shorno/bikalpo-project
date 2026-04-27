"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarIcon,
  Loader2Icon,
  Package,
  SaveIcon,
  Search,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ImageUploader from "@/components/ImageUploader";
import {
  useSearchShopVariantsForAdjustment,
  useCreateDamageEntry,
} from "@/hooks/use-shop-owner-api";

// ─── Types ─────────────────────────────────────────────────────

type DamageType = "physical" | "expired" | "lost";

type SelectedItem = {
  inventoryId: number;
  variantId: number;
  sku: string | null;
  unitLabel: string;
  weightKg: string;
  productName: string;
  productImage: string | null;
  brandName: string | null;
  currentQty: number;
  qty: string;
  unitPrice: string;
  note: string;
};

const DAMAGE_TYPES: { value: DamageType; label: string; icon: string; desc: string }[] = [
  { value: "physical", label: "Physical Damage", icon: "💥", desc: "Broken, torn, or crushed" },
  { value: "expired", label: "Expired", icon: "⏰", desc: "Past expiry date" },
  { value: "lost", label: "Lost / Missing", icon: "📦", desc: "Cannot be found" },
];

// ─── Main Page ─────────────────────────────────────────────────

export default function CreateDamageEntryPage() {
  const router = useRouter();

  const [damageType, setDamageType] = useState<DamageType | null>(null);
  const [description, setDescription] = useState("");
  const [enteredByName, setEnteredByName] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split("T")[0]!,
  );
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Product search
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  const { data: searchData, isLoading: searchLoading } =
    useSearchShopVariantsForAdjustment(debouncedSearch);
  const searchResults = (searchData as any)?.variants ?? [];

  const createMutation = useCreateDamageEntry();

  const handleSearchInput = useCallback((value: string) => {
    setSearchTerm(value);
    clearTimeout((window as any).__dmgProductSearch);
    (window as any).__dmgProductSearch = setTimeout(() => {
      setDebouncedSearch(value);
      setShowSearchResults(value.length >= 1);
    }, 300);
  }, []);

  const addItem = useCallback(
    (variant: any) => {
      if (selectedItems.find((i) => i.inventoryId === variant.inventoryId)) {
        toast.error("Product already added");
        return;
      }
      setSelectedItems((prev) => [
        ...prev,
        {
          inventoryId: variant.inventoryId,
          variantId: variant.variantId,
          sku: variant.sku,
          unitLabel: variant.unitLabel,
          weightKg: variant.weightKg,
          productName: variant.productName,
          productImage: variant.productImage,
          brandName: variant.brandName,
          currentQty: variant.availableQty,
          qty: "",
          unitPrice: "",
          note: "",
        },
      ]);
      setSearchTerm("");
      setDebouncedSearch("");
      setShowSearchResults(false);
    },
    [selectedItems],
  );

  const removeItem = useCallback((inventoryId: number) => {
    setSelectedItems((prev) => prev.filter((i) => i.inventoryId !== inventoryId));
  }, []);

  const updateItem = useCallback(
    (inventoryId: number, field: "qty" | "unitPrice" | "note", value: string) => {
      setSelectedItems((prev) =>
        prev.map((i) =>
          i.inventoryId === inventoryId ? { ...i, [field]: value } : i,
        ),
      );
    },
    [],
  );

  // Derived
  const itemsWithCalc = selectedItems.map((item) => {
    const qty = parseInt(item.qty) || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const totalValue = qty * unitPrice;
    return { ...item, qtyNum: qty, unitPriceNum: unitPrice, totalValue };
  });

  const hasQtyExceedsStock = itemsWithCalc.some(
    (i) => i.qtyNum > i.currentQty,
  );
  const hasAnyInput = itemsWithCalc.some((i) => i.qty !== "");
  const totalQty = itemsWithCalc.reduce((s, i) => s + i.qtyNum, 0);
  const totalLoss = itemsWithCalc.reduce((s, i) => s + i.totalValue, 0);

  const canSubmit =
    damageType &&
    selectedItems.length > 0 &&
    hasAnyInput &&
    !hasQtyExceedsStock;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const items = itemsWithCalc
      .filter((i) => i.qtyNum > 0)
      .map((i) => ({
        inventoryId: i.inventoryId,
        qty: i.qtyNum,
        unitPrice: i.unitPriceNum > 0 ? i.unitPriceNum : undefined,
        note: i.note || undefined,
      }));

    createMutation.mutate(
      {
        damageType: damageType!,
        description: description || undefined,
        proofImages,
        enteredByName: enteredByName || undefined,
        entryDate,
        items,
      },
      {
        onSuccess: (result: any) => {
          toast.success(result.message || "Damage entry recorded!");
          router.push("/dashboard/damage");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to create damage entry");
        },
      },
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/damage">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeftIcon size={16} />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            ➕ Add Damage Entry
          </h1>
          <p className="text-sm text-gray-500">
            Record damaged, expired, or lost products
          </p>
        </div>
      </div>

      {/* ─── Section 1: Damage Info ─── */}
      <div className="bg-white border rounded-lg p-5 space-y-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          💥 Damage Info
        </h2>

        {/* Damage Type */}
        <div>
          <label className="text-xs font-semibold text-gray-600 mb-2 block">
            Damage Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DAMAGE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setDamageType(t.value)}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all text-center ${
                  damageType === t.value
                    ? "border-red-500 bg-red-50 shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                <span className="text-xs font-semibold text-gray-800">{t.label}</span>
                <span className="text-[10px] text-gray-400 leading-tight">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Date + Staff */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Entry Date
            </label>
            <div className="relative">
              <CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Checked By (Optional)
            </label>
            <Input
              placeholder="Staff name..."
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ─── Section 2: Product Picker ─── */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          📦 Select Damaged Products
        </h2>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
          <Input
            placeholder="Search by product name, SKU, or brand..."
            value={searchTerm}
            onChange={(e) => handleSearchInput(e.target.value)}
            onFocus={() => {
              if (debouncedSearch.length >= 1) setShowSearchResults(true);
            }}
            className="pl-9 h-10 text-sm"
          />

          {showSearchResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto">
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2Icon size={20} className="animate-spin text-gray-400" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">No variants found</div>
              ) : (
                searchResults.map((v: any) => {
                  const alreadyAdded = selectedItems.some((i) => i.inventoryId === v.inventoryId);
                  return (
                    <button
                      key={v.inventoryId}
                      type="button"
                      disabled={alreadyAdded}
                      onClick={() => addItem(v)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-0 ${
                        alreadyAdded ? "bg-gray-50 opacity-50 cursor-not-allowed" : "hover:bg-red-50"
                      }`}
                    >
                      <div className="shrink-0 w-8 h-8 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                        {v.productImage ? (
                          <Image src={v.productImage} alt={v.productName} width={32} height={32} className="w-8 h-8 object-cover" unoptimized={v.productImage.startsWith("http")} />
                        ) : (
                          <Package size={14} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{v.productName}</p>
                        <p className="text-[11px] text-gray-500">
                          {v.brandName ? `${v.brandName} · ` : ""}{v.unitLabel}
                          {v.weightKg ? ` · ${v.weightKg}kg` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-gray-700 tabular-nums">{v.availableQty}</p>
                        <p className="text-[10px] text-gray-400">in stock</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {showSearchResults && (
          <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)} />
        )}

        {/* Selected Items Table */}
        {selectedItems.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-3">Product</th>
                  <th className="text-left py-2 px-3">Variant</th>
                  <th className="text-right py-2 px-3">Stock</th>
                  <th className="text-center py-2 px-3 w-20">Qty</th>
                  <th className="text-center py-2 px-3 w-24">Unit Price</th>
                  <th className="text-right py-2 px-3">Total</th>
                  <th className="text-center py-2 px-3 w-9" />
                </tr>
              </thead>
              <tbody>
                {itemsWithCalc.map((item) => {
                  const exceeds = item.qtyNum > item.currentQty;
                  return (
                    <tr key={item.inventoryId} className={`border-t ${exceeds ? "bg-red-50/50" : "hover:bg-gray-50/50"}`}>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="shrink-0 w-7 h-7 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                            {item.productImage ? (
                              <Image src={item.productImage} alt={item.productName} width={28} height={28} className="w-7 h-7 object-cover" unoptimized={item.productImage.startsWith("http")} />
                            ) : (
                              <Package size={12} className="text-gray-400" />
                            )}
                          </div>
                          <span className="font-semibold text-gray-900 truncate max-w-[140px]">{item.productName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-500">
                        {item.brandName ? `${item.brandName} · ` : ""}{item.unitLabel}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-gray-700">{item.currentQty}</td>
                      <td className="py-2.5 px-3">
                        <Input
                          type="number"
                          min={0}
                          value={item.qty}
                          onChange={(e) => updateItem(item.inventoryId, "qty", e.target.value)}
                          placeholder="0"
                          className={`h-8 text-sm text-center tabular-nums font-bold w-20 mx-auto ${exceeds ? "border-red-300 text-red-600" : ""}`}
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <Input
                          type="number"
                          min={0}
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.inventoryId, "unitPrice", e.target.value)}
                          placeholder="Auto"
                          className="h-8 text-sm text-center tabular-nums w-24 mx-auto"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-red-600">
                        {item.totalValue > 0 ? `৳${item.totalValue.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button type="button" onClick={() => removeItem(item.inventoryId)} className="text-gray-400 hover:text-red-500 transition-colors">
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
            Search and add damaged products above
          </div>
        )}
      </div>

      {/* ─── Section 3: Proof & Description ─── */}
      <div className="bg-white border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          📸 Damage Proof & Description
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Upload Photo Evidence
            </label>
            <ImageUploader
              value={proofImages[0] || ""}
              onChange={(url) => {
                if (url) {
                  setProofImages((prev) => [...prev.filter(Boolean), url]);
                }
              }}
              folder="damage-proof"
              maxSizeMB={5}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
              Description (Optional)
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the damage, cause, or any relevant details..."
              className="text-sm resize-none"
              rows={6}
            />
          </div>
        </div>
      </div>

      {/* ─── Section 4: Summary ─── */}
      {selectedItems.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
            📊 Summary
          </h3>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-xs text-gray-400">Items</span>
              <p className="font-bold text-gray-900">{itemsWithCalc.filter((i) => i.qtyNum > 0).length} SKU</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">Total Qty</span>
              <p className="font-bold text-gray-900">{totalQty} Units</p>
            </div>
            <div>
              <span className="text-xs text-gray-400">Total Loss</span>
              <p className="font-bold text-red-600 tabular-nums">
                ৳ {totalLoss.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          {hasQtyExceedsStock && (
            <p className="text-xs text-red-600 font-medium mt-2">
              ⚠ Some quantities exceed available stock
            </p>
          )}
        </div>
      )}

      {/* ─── Section 5: Actions ─── */}
      <div className="flex items-center justify-between bg-white border rounded-lg p-4">
        <Link href="/dashboard/damage">
          <Button variant="outline" size="sm" className="gap-1.5" disabled={createMutation.isPending}>
            <XIcon size={14} />
            Cancel
          </Button>
        </Link>
        <Button
          size="sm"
          className="gap-1.5 bg-red-600 hover:bg-red-700"
          disabled={!canSubmit || createMutation.isPending}
          onClick={handleSubmit}
        >
          {createMutation.isPending ? (
            <Loader2Icon size={14} className="animate-spin" />
          ) : (
            <SaveIcon size={14} />
          )}
          Submit Damage Entry
        </Button>
      </div>
    </div>
  );
}
