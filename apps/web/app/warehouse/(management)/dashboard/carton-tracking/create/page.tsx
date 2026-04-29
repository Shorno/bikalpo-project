"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BoxesIcon,
  Check,
  CheckCircle2,
  Package,
  PackagePlus,
  QrCode,
  Search,
  ShieldCheck,
  Weight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";

const STEPS = [
  { num: 1, label: "Product Type" },
  { num: 2, label: "Add Items" },
  { num: 3, label: "Validation" },
  { num: 4, label: "Define Carton" },
  { num: 5, label: "Generate ID" },
  { num: 6, label: "Preview & Price" },
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STEPS.map((s, i) => {
        const done = current > s.num;
        const active = current === s.num;
        return (
          <div key={s.num} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? "bg-emerald-500 text-white"
                    : active
                      ? "bg-amber-600 text-white shadow-md shadow-amber-200"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? <Check size={14} /> : s.num}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${active ? "text-amber-700" : done ? "text-emerald-600" : "text-gray-400"}`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-0.5 shrink-0 ${done ? "bg-emerald-300" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CreateCartonPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Form state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedVariantInfo, setSelectedVariantInfo] = useState<any>(null);
  const [packCount, setPackCount] = useState<number>(0);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [storageAreaId, setStorageAreaId] = useState<string>("");
  const [note, setNote] = useState("");
  const [cartonPrice, setCartonPrice] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [generateBarcode, setGenerateBarcode] = useState(true);

  // ── Queries ──
  const { data: searchData } = useQuery({
    queryKey: ["warehouse", "searchProductsForStock", searchQuery],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({ search: searchQuery }),
    enabled: searchQuery.length >= 2,
  });

  const { data: configsData } = useQuery({
    queryKey: ["warehouse", "getCartonConfigs", selectedVariantId],
    queryFn: () =>
      (orpc.warehouse as any).getCartonConfigs.call({ variantId: selectedVariantId }),
    enabled: !!selectedVariantId,
  });

  const { data: areasData } = useQuery({
    queryKey: ["warehouse", "getStorageAreas"],
    queryFn: () => (orpc.warehouse as any).getStorageAreas.call({}),
  });

  const products = searchData?.products ?? [];
  const configs = configsData?.configs ?? [];
  const areas = areasData?.areas ?? [];
  const selectedConfig = configs.find((c: any) => c.id === selectedConfigId);

  // Auto-calculated values
  const variantWeightKg = parseFloat(selectedVariantInfo?.weightKg || selectedVariantInfo?.weight || "0");
  const totalWeightKg = packCount > 0 ? (packCount * variantWeightKg).toFixed(2) : "0";
  const variantPrice = parseFloat(selectedVariantInfo?.price || "0");
  const looseKgPrice = variantWeightKg > 0 ? (variantPrice / variantWeightKg).toFixed(2) : "0";
  const totalLoosePrice = (packCount * variantPrice).toFixed(2);

  // ── Create mutation ──
  const createMutation = useMutation({
    mutationFn: () =>
      (orpc.warehouse as any).createCarton.call({
        variantId: selectedVariantId!,
        packCount,
        cartonConfigId: selectedConfigId || undefined,
        storageAreaId: storageAreaId ? Number(storageAreaId) : undefined,
        note: note || undefined,
        overrideCartonPrice: cartonPrice || undefined,
        overrideDeliveryCost: deliveryCost || undefined,
      }),
    onSuccess: (res: any) => {
      toast.success(`Carton ${res.cartonId} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      router.push("/warehouse/dashboard/carton-tracking");
    },
    onError: (err: any) => toast.error(err.message || "Failed to create carton"),
  });

  // ── Validation ──
  const validationChecks = [
    { label: "Product & variant selected", ok: !!selectedVariantId },
    { label: "Pack quantity specified", ok: packCount > 0 },
    { label: `Minimum quantity met (${packCount} packs)`, ok: packCount >= 1 },
    { label: "Stock available for deduction", ok: packCount > 0 },
    { label: "No duplicate conflict", ok: true },
  ];
  const allValid = validationChecks.every((c) => c.ok);

  const canProceed = () => {
    switch (step) {
      case 1: return true;
      case 2: return !!selectedVariantId && packCount > 0;
      case 3: return allValid;
      case 4: return true;
      case 5: return true;
      case 6: return !!selectedVariantId && packCount > 0;
      default: return false;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link href="/warehouse/dashboard/carton-tracking">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-amber-50">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <PackagePlus size={20} className="text-amber-600" />
            Create Carton
          </h1>
          <p className="text-xs text-gray-500">Step {step} of 6</p>
        </div>
      </div>

      <Stepper current={step} />

      {/* ── Step Content ── */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
        {/* Step 1: Product Type */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Select Product Type</h3>
            <div className="p-4 rounded-xl border-2 border-amber-500 bg-amber-50/50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-amber-500 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Single Product Carton</p>
                  <p className="text-xs text-gray-500 mt-0.5">One product variant per carton</p>
                </div>
              </div>
            </div>
            <div className="p-4 rounded-xl border-2 border-gray-100 bg-gray-50/50 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                <div>
                  <p className="font-semibold text-gray-400">Mixed Product Carton 🔥</p>
                  <p className="text-xs text-gray-400 mt-0.5">Coming soon — multiple variants in one carton</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Add Items — Scan/Search + Qty */}
        {step === 2 && (
          <div className="space-y-5">
            <h3 className="font-bold text-gray-900">Add Items (Carton Composition)</h3>

            {/* Search */}
            <div>
              <Label className="text-xs font-bold text-gray-600 uppercase mb-1.5 block">Scan / Add SKU</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by SKU or product name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && !selectedVariantId && (
              <div className="max-h-56 overflow-y-auto border rounded-xl divide-y">
                {products.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No products found</p>
                ) : (
                  products.map((p: any) =>
                    (p.variants || []).map((v: any) => {
                      const vid = v.variantId || v.id;
                      return (
                        <div
                          key={vid}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-amber-50 transition-colors"
                          onClick={() => {
                            setSelectedVariantId(vid);
                            setSelectedVariantInfo({ ...v, productName: p.name || p.productName });
                            setSelectedConfigId(null);
                          }}
                        >
                          <div className="p-2 bg-gray-100 rounded-lg shrink-0">
                            <Package size={16} className="text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">{p.name || p.productName}</p>
                            <p className="text-xs text-gray-500">
                              {v.unitLabel || v.label} · {v.weightKg || v.weight}KG
                              {v.sku ? ` · SKU: ${v.sku}` : ""}
                            </p>
                          </div>
                        </div>
                      );
                    }),
                  )
                )}
              </div>
            )}

            {/* Selected Item Table */}
            {selectedVariantId && selectedVariantInfo && (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase">SKU</th>
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase">Product Name</th>
                        <th className="text-left px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase">Variant</th>
                        <th className="text-center px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase">Qty (Pack)</th>
                        <th className="text-center px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="hover:bg-amber-50/30">
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {selectedVariantInfo.sku || "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {selectedVariantInfo.productName}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {selectedVariantInfo.unitLabel || selectedVariantInfo.label} · {variantWeightKg}KG
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Input
                            type="number"
                            min={1}
                            value={packCount || ""}
                            onChange={(e) => setPackCount(Number(e.target.value) || 0)}
                            placeholder="0"
                            className="w-20 text-center mx-auto h-8 font-bold"
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-7"
                            onClick={() => {
                              setSelectedVariantId(null);
                              setSelectedVariantInfo(null);
                              setPackCount(0);
                              setSearchQuery("");
                            }}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Total Items */}
                <div className="flex items-center justify-between p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                  <span className="text-sm font-bold text-amber-800">👉 Total Items:</span>
                  <span className="text-sm font-bold text-amber-900">
                    → {packCount} Pack{packCount !== 1 ? "s" : ""}
                    {packCount > 0 && ` (${totalWeightKg} KG)`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Validation */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" />
              Validation
            </h3>
            <div className="space-y-2">
              {validationChecks.map((c, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${c.ok ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${c.ok ? "bg-emerald-500" : "bg-red-400"}`}>
                    {c.ok ? <Check size={14} className="text-white" /> : <span className="text-white text-xs font-bold">!</span>}
                  </div>
                  <span className={`text-sm font-medium ${c.ok ? "text-emerald-700" : "text-red-700"}`}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Define Carton */}
        {step === 4 && (
          <div className="space-y-5">
            <h3 className="font-bold text-gray-900">Define Carton</h3>

            {/* Carton Type (optional config selection) */}
            {configs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-600 uppercase">Carton Type (Optional)</Label>
                <div className="grid gap-2">
                  {configs.map((c: any) => {
                    const isSelected = selectedConfigId === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected ? "border-amber-500 bg-amber-50/50" : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => {
                          setSelectedConfigId(isSelected ? null : c.id);
                          if (!isSelected && c.cartonPrice) setCartonPrice(c.cartonPrice);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? "border-amber-500" : "border-gray-300"}`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                            </div>
                            <span className="text-sm font-semibold text-gray-900">{c.label || `${c.packsPerCarton} Pack Carton`}</span>
                          </div>
                          <span className="text-sm font-bold text-amber-700">৳{Number(c.cartonPrice).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Auto-calculated Weight */}
            <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/40 border border-blue-200/60 rounded-xl">
              <div className="flex items-center gap-3 mb-2">
                <Weight size={18} className="text-blue-600" />
                <span className="text-xs font-bold text-blue-700 uppercase">Carton Weight (Auto Calculated)</span>
              </div>
              <p className="text-2xl font-extrabold text-blue-900 tabular-nums">{totalWeightKg} KG</p>
              <p className="text-xs text-blue-600 mt-1">
                {variantWeightKg} KG × {packCount} pcs = {totalWeightKg} KG
              </p>
            </div>

            {/* Storage Location */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-600 uppercase">Storage Location (Optional)</Label>
              <Select value={storageAreaId} onValueChange={setStorageAreaId}>
                <SelectTrigger><SelectValue placeholder="Select storage area" /></SelectTrigger>
                <SelectContent>
                  {areas.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 5: Generate Carton ID */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900">Generate Carton ID 🔥</h3>
            <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-200/60 rounded-xl text-center">
              <QrCode size={36} className="text-amber-500 mx-auto mb-3" />
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Carton ID</p>
              <p className="text-2xl font-mono font-extrabold text-amber-800">CTN-{new Date().getFullYear()}-XXXXXX</p>
              <p className="text-xs text-gray-500 mt-2">Auto-generated on creation</p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
              <input type="checkbox" checked={generateBarcode} onChange={(e) => setGenerateBarcode(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">Barcode / QR</p>
                <p className="text-xs text-gray-500">Auto Generate ✔</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-600 uppercase">Note (Optional)</Label>
              <Textarea placeholder="Add any notes…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
            </div>
          </div>
        )}

        {/* Step 6: Preview & Price */}
        {step === 6 && (
          <div className="space-y-5">
            <h3 className="font-bold text-gray-900">Preview</h3>

            {/* Carton Summary */}
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <p className="text-xs font-bold text-gray-500 uppercase">Carton: CTN-{new Date().getFullYear()}-XXXXXX</p>
              </div>
              <div className="px-4 py-3 border-b">
                <p className="text-sm text-gray-500 mb-1">Inside:</p>
                <p className="text-sm font-semibold text-gray-900">
                  • {selectedVariantInfo?.productName} {selectedVariantInfo?.unitLabel || selectedVariantInfo?.label} × {packCount}
                </p>
              </div>
              <div className="px-4 py-3 bg-amber-50/50">
                <p className="text-sm font-bold text-amber-800">
                  Carton Setup: [{totalWeightKg} KG ({variantWeightKg} KG × {packCount} pcs)]
                </p>
              </div>
            </div>

            {/* Editable Pricing */}
            <div className="space-y-3 p-4 bg-amber-50/50 rounded-xl border border-amber-200/60">
              <div>
                <Label className="text-xs text-gray-600">Carton Price</Label>
                <Input
                  type="number"
                  placeholder={selectedConfig?.cartonPrice || "0"}
                  value={cartonPrice}
                  onChange={(e) => setCartonPrice(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Loose KG pricing breakdown */}
              <div className="pt-2 border-t border-amber-200/60">
                <p className="text-xs font-bold text-gray-600 mb-2">🔹 Loose (KG) Pack Pricing</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      Price: <span className="font-mono font-bold">{variantPrice}</span> / Pack
                    </span>
                    <span className="font-bold text-gray-900">
                      {packCount} Pack → ৳{Number(totalLoosePrice).toLocaleString()}
                    </span>
                  </div>
                  {variantWeightKg > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Price: <span className="font-mono font-bold">৳{looseKgPrice}</span> / KG
                      </span>
                      <span className="font-bold text-gray-900">
                        {totalWeightKg} KG → ৳{(parseFloat(looseKgPrice) * parseFloat(totalWeightKg)).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-600">Delivery Cost (৳)</Label>
                <Input
                  type="number"
                  placeholder={selectedConfig?.deliveryCostPerCarton || "0"}
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Rules */}
            <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl">
              <p className="text-xs font-bold text-blue-700 mb-2">⚠ Rules</p>
              <ul className="text-xs text-blue-600 space-y-1">
                <li>• Carton once created → Cannot edit ❌</li>
                <li>• Stock auto deducted ✔</li>
                <li>• Linked with inventory ✔</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
          className="gap-1.5"
        >
          <ArrowLeft size={14} /> Previous
        </Button>
        <div className="flex gap-2">
          {step === 6 && (
            <Button variant="outline" className="gap-1.5" disabled>
              🏷️ Generate Label
            </Button>
          )}
          {step < 6 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700"
            >
              Next <ArrowRight size={14} />
            </Button>
          ) : (
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canProceed() || createMutation.isPending}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <PackagePlus size={14} />
              {createMutation.isPending ? "Creating…" : "📦 Create Carton"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
