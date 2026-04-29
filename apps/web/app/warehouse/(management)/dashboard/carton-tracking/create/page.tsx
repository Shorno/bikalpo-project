"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Package, PackagePlus, QrCode, Search, Shield, Trash2, Weight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";
import { toast } from "sonner";

type CartonItem = { variantId: number; sku: string; productName: string; variantLabel: string; weightKg: number; price: number; packCount: number; };

const STEPS = ["Product Type", "Add Items", "Validation", "Define Carton", "Generate ID", "Preview"];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => {
        const num = i + 1; const done = current > num; const active = current === num;
        return (
          <div key={num} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${done ? "bg-emerald-600 border-emerald-600 text-white" : active ? "bg-white border-gray-900 text-gray-900" : "bg-white border-gray-300 text-gray-400"}`}>
                {done ? <Check size={14} strokeWidth={3} /> : num}
              </div>
              <span className={`text-[10px] font-semibold whitespace-nowrap ${active ? "text-gray-900" : done ? "text-emerald-600" : "text-gray-400"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`h-[2px] flex-1 mx-2 mt-[-14px] ${done ? "bg-emerald-600" : "bg-gray-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function CreateCartonPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [productType, setProductType] = useState<"single" | "mixed">("single");

  // Step 2 — item state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [items, setItems] = useState<CartonItem[]>([]);
  const isSingleMode = productType === "single";

  // Step 4+
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [storageAreaId, setStorageAreaId] = useState<string>("");
  const [note, setNote] = useState("");
  const [cartonPrice, setCartonPrice] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [generateBarcode, setGenerateBarcode] = useState(true);

  // Queries
  const { data: searchData } = useQuery({
    queryKey: ["w", "search", searchQuery, categoryFilter],
    queryFn: () => (orpc.warehouse as any).getWarehouseProductsForStock.call({
      search: searchQuery || undefined,
      categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
      limit: 30,
    }),
    enabled: searchQuery.length >= 1 || categoryFilter !== "all",
  });

  const firstVariantId = items.length > 0 ? items[0].variantId : null;
  const { data: configsData } = useQuery({ queryKey: ["w", "configs", firstVariantId], queryFn: () => (orpc.warehouse as any).getCartonConfigs.call({ variantId: firstVariantId }), enabled: !!firstVariantId });
  const { data: areasData } = useQuery({ queryKey: ["w", "areas"], queryFn: () => (orpc.warehouse as any).getStorageAreas.call({}) });

  const products = searchData?.products ?? [];
  const configs = configsData?.configs ?? [];
  const areas = areasData?.areas ?? [];
  const selectedConfig = configs.find((c: any) => c.id === selectedConfigId);

  // Extract unique categories from results for filter
  const allCategories = products.reduce((acc: any[], p: any) => {
    if (p.category && !acc.find((c: any) => c.id === p.category.id)) acc.push(p.category);
    return acc;
  }, []);

  // Computed totals
  const totalPacks = items.reduce((s, i) => s + i.packCount, 0);
  const totalWeightKg = items.reduce((s, i) => s + (i.packCount * i.weightKg), 0).toFixed(2);
  const totalLoosePrice = items.reduce((s, i) => s + (i.packCount * i.price), 0).toFixed(2);

  const addItem = (variant: any, product: any) => {
    const vid = variant.variantId || variant.id;
    if (items.find((i) => i.variantId === vid)) return; // already added
    const newItem: CartonItem = {
      variantId: vid,
      sku: variant.sku || "—",
      productName: product.name || product.productName,
      variantLabel: `${variant.unitLabel || variant.label} · ${variant.weightKg || variant.weight}KG`,
      weightKg: parseFloat(variant.weightKg || variant.weight || "0"),
      price: parseFloat(variant.price || "0"),
      packCount: 0,
    };
    // Single mode: replace any existing item
    if (isSingleMode) {
      setItems([newItem]);
      setSearchQuery("");
    } else {
      setItems([...items, newItem]);
    }
  };

  const updatePackCount = (variantId: number, count: number) => {
    setItems(items.map((i) => i.variantId === variantId ? { ...i, packCount: count } : i));
  };

  const removeItem = (variantId: number) => {
    setItems(items.filter((i) => i.variantId !== variantId));
  };

  // Create — uses first item's variantId for single product carton
  const createMutation = useMutation({
    mutationFn: () => (orpc.warehouse as any).createCarton.call({
      variantId: items[0].variantId,
      packCount: items[0].packCount,
      cartonConfigId: selectedConfigId || undefined,
      storageAreaId: storageAreaId ? Number(storageAreaId) : undefined,
      note: note || undefined,
      overrideCartonPrice: cartonPrice || undefined,
      overrideDeliveryCost: deliveryCost || undefined,
    }),
    onSuccess: (res: any) => { toast.success(`Carton ${res.cartonId} created!`); qc.invalidateQueries({ queryKey: ["warehouse"] }); router.push("/warehouse/dashboard/carton-tracking"); },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const checks = [
    { label: "At least one product added", ok: items.length > 0 },
    { label: "All items have pack quantity > 0", ok: items.length > 0 && items.every((i) => i.packCount > 0) },
    { label: `Total packs: ${totalPacks}`, ok: totalPacks > 0 },
    { label: "Stock available for deduction", ok: totalPacks > 0 },
    { label: "No duplicate conflict", ok: true },
  ];
  const allValid = checks.every((c) => c.ok);
  const canNext = () => { switch(step) { case 2: return items.length > 0 && items.every((i) => i.packCount > 0); case 3: return allValid; default: return true; } };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/warehouse/dashboard/carton-tracking">
          <div className="w-9 h-9 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer"><ArrowLeft size={16} className="text-gray-600" /></div>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2"><PackagePlus size={18} className="text-gray-700" /> Create Carton</h1>
          <p className="text-xs text-gray-500">Step {step} of 6 — {STEPS[step - 1]}</p>
        </div>
      </div>

      <Stepper current={step} />

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900">Select Product Type</h3>
            <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${productType === "single" ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`} onClick={() => { setProductType("single"); setItems([]); }}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center ${productType === "single" ? "bg-gray-900" : "border-2 border-gray-300"}`}>{productType === "single" && <Check size={12} className="text-white" strokeWidth={3} />}</div>
                <div><p className="font-semibold text-gray-900 text-sm">Single Product Carton</p><p className="text-xs text-gray-500 mt-0.5">One product variant per carton</p></div>
              </div>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                <div><p className="font-semibold text-gray-400 text-sm">Mixed Product Carton <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded ml-1 font-semibold">SOON</span></p><p className="text-xs text-gray-400 mt-0.5">Multiple variants in one carton</p></div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Add Items */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900">Add Items (Carton Composition)</h3>
            {isSingleMode && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-medium">📦 Single Product Mode — Only one product variant allowed per carton</p>}

            {/* Filters Row — hidden in single mode when item already selected */}
            {!(isSingleMode && items.length > 0) && (
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Search</Label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input placeholder="Search SKU, product name…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-10 text-sm" />
                  </div>
                </div>
                <div className="w-44">
                  <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {allCategories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Search Results — hidden in single mode when item already selected */}
            {(searchQuery.length >= 1 || categoryFilter !== "all") && !(isSingleMode && items.length > 0) && (
              <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 divide-y bg-white shadow-md">
                {products.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No products found</p>
                ) : (
                  products.map((p: any) => (p.variants || []).map((v: any) => {
                    const vid = v.variantId || v.id;
                    const alreadyAdded = items.find((i) => i.variantId === vid);
                    return (
                      <div key={vid} className={`flex items-center gap-3 px-4 py-3 transition-colors ${alreadyAdded ? "bg-emerald-50/50 cursor-default" : "cursor-pointer hover:bg-gray-50"}`} onClick={() => !alreadyAdded && addItem(v, p)}>
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center"><Package size={16} className="text-gray-400" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{p.name || p.productName}</p>
                          <p className="text-xs text-gray-500">{v.unitLabel || v.label} · {v.weightKg || v.weight}KG{v.sku ? ` · ${v.sku}` : ""}{p.category ? ` · ${p.category.name}` : ""}</p>
                        </div>
                        {alreadyAdded ? (
                          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Check size={14} /> Added</span>
                        ) : (
                          <span className="text-xs text-gray-400 font-medium">+ Add</span>
                        )}
                      </div>
                    );
                  }))
                )}
              </div>
            )}

            {/* Selected Items Table */}
            {items.length > 0 && (
              <div className="space-y-3 mt-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Selected Items ({items.length})</p>
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Product Name</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Variant</th>
                      <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Qty (Pack)</th>
                      <th className="text-center px-2 py-2.5 w-16"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map((item) => (
                        <tr key={item.variantId} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.sku}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900 text-sm">{item.productName}</td>
                          <td className="px-4 py-3 text-gray-600 text-sm">{item.variantLabel}</td>
                          <td className="px-4 py-3 text-center">
                            <Input type="number" min={1} value={item.packCount || ""} onChange={(e) => updatePackCount(item.variantId, Number(e.target.value) || 0)} placeholder="0" className="w-20 h-8 text-center font-bold mx-auto" />
                          </td>
                          <td className="px-2 py-3 text-center">
                            <button onClick={() => removeItem(item.variantId)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-sm font-semibold text-gray-700">👉 Total Items:</span>
                  <span className="text-sm font-bold text-gray-900">→ {totalPacks} Pack{totalPacks !== 1 ? "s" : ""}{totalPacks > 0 && <span className="text-gray-600 font-medium"> ({totalWeightKg} KG)</span>}</span>
                </div>
              </div>
            )}

            {items.length === 0 && !(searchQuery.length >= 1 || categoryFilter !== "all") && (
              <div className="flex flex-col items-center py-8 text-center border border-dashed border-gray-200 rounded-lg">
                <Package size={32} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 font-medium">No items added yet</p>
                <p className="text-xs text-gray-400 mt-1">Search or filter products above to add items</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><Shield size={18} className="text-emerald-600" />Validation</h3>
            <div className="space-y-2">
              {checks.map((c, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${c.ok ? "bg-emerald-50/50 border-emerald-200" : "bg-red-50/50 border-red-200"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${c.ok ? "bg-emerald-600" : "bg-red-500"}`}>{c.ok ? <Check size={14} className="text-white" strokeWidth={3} /> : <X size={14} className="text-white" strokeWidth={3} />}</div>
                  <span className={`text-sm font-medium ${c.ok ? "text-emerald-700" : "text-red-700"}`}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900">Define Carton</h3>
            {configs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Carton Template (Optional)</Label>
                {configs.map((c: any) => { const sel = selectedConfigId === c.id; return (
                  <div key={c.id} className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${sel ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}`} onClick={() => { setSelectedConfigId(sel ? null : c.id); if(!sel && c.cartonPrice) setCartonPrice(c.cartonPrice); }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${sel ? "bg-gray-900 border-gray-900" : "border-gray-300"}`}>{sel && <Check size={10} className="text-white" />}</div><div><p className="font-semibold text-gray-900 text-sm">{c.label || `${c.packsPerCarton} Pack Carton`}</p><p className="text-xs text-gray-500 mt-0.5">{c.packsPerCarton} pcs · {c.cartonWeightKg} KG</p></div></div>
                      <span className="text-sm font-bold text-gray-900">৳{Number(c.cartonPrice).toLocaleString()}</span>
                    </div>
                  </div>
                ); })}
              </div>
            )}
            <div className="p-5 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2"><Weight size={16} className="text-gray-500" /><span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Carton Weight (Auto Calculated)</span></div>
              <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{totalWeightKg} KG</p>
              <p className="text-sm text-gray-500 mt-1">{items.map((i) => `${i.weightKg}KG × ${i.packCount}`).join(" + ")} = {totalWeightKg} KG</p>
            </div>
            <div><Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Storage Location (Optional)</Label><Select value={storageAreaId} onValueChange={setStorageAreaId}><SelectTrigger className="h-10"><SelectValue placeholder="Select storage area" /></SelectTrigger><SelectContent>{areas.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
        )}

        {/* Step 5 */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900">Generate Carton ID</h3>
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
              <QrCode size={32} className="text-gray-400 mx-auto mb-3" />
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">Carton ID</p>
              <p className="text-2xl font-mono font-extrabold text-gray-900 tracking-wide">CTN-{new Date().getFullYear()}-XXXXXX</p>
              <p className="text-xs text-gray-500 mt-2">Assigned automatically on creation</p>
            </div>
            <label className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
              <input type="checkbox" checked={generateBarcode} onChange={(e) => setGenerateBarcode(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-gray-900" />
              <div><p className="text-sm font-medium text-gray-900">Generate Barcode / QR</p><p className="text-xs text-gray-500">Auto-generate for label printing</p></div>
            </label>
            <div><Label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Note (Optional)</Label><Textarea placeholder="Add any notes…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="resize-none" /></div>
          </div>
        )}

        {/* Step 6 */}
        {step === 6 && (
          <div className="space-y-4">
            <h3 className="text-base font-bold text-gray-900">Preview & Set Pricing</h3>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b"><p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Carton: CTN-{new Date().getFullYear()}-XXXXXX</p></div>
              <div className="px-4 py-3 border-b">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Inside</p>
                {items.map((item) => <p key={item.variantId} className="text-sm font-semibold text-gray-900">• {item.productName} {item.variantLabel.split(" · ")[0]} × {item.packCount}</p>)}
              </div>
              <div className="px-4 py-3 bg-gray-50"><p className="text-sm font-bold text-gray-900">Carton Setup: [{totalWeightKg} KG — {totalPacks} pcs total]</p></div>
            </div>
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pricing</p>
              <div><Label className="text-xs text-gray-600">Carton Price (৳)</Label><Input type="number" placeholder={selectedConfig?.cartonPrice || "0"} value={cartonPrice} onChange={(e) => setCartonPrice(e.target.value)} className="mt-1 h-10" /></div>
              <div className="pt-3 border-t border-gray-200 space-y-1.5">
                <p className="text-xs font-semibold text-gray-600">🔹 Loose Pack Pricing</p>
                {items.map((item) => (
                  <div key={item.variantId} className="flex justify-between text-sm">
                    <span className="text-gray-500">{item.productName} × {item.packCount}</span>
                    <span className="font-semibold text-gray-900">৳{(item.packCount * item.price).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
                  <span className="text-gray-700 font-semibold">Total Loose Value</span>
                  <span className="font-bold text-gray-900">৳{Number(totalLoosePrice).toLocaleString()}</span>
                </div>
              </div>
              <div><Label className="text-xs text-gray-600">Delivery Cost (৳)</Label><Input type="number" placeholder={selectedConfig?.deliveryCostPerCarton || "0"} value={deliveryCost} onChange={(e) => setDeliveryCost(e.target.value)} className="mt-1 h-10" /></div>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs font-semibold text-yellow-800 mb-1">⚠ Rules</p>
              <ul className="text-xs text-yellow-700 space-y-0.5"><li>• Carton once created → Cannot edit</li><li>• Stock auto deducted from inventory</li><li>• Linked with inventory tracking</li></ul>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pb-4">
        <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="gap-2 h-10 px-4 text-sm"><ArrowLeft size={15} /> Previous</Button>
        <div className="flex gap-2">
          {step === 6 && <Button variant="outline" className="gap-2 h-10 px-4 text-sm" disabled>🏷️ Generate Label</Button>}
          {step < 6 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="gap-2 h-10 px-5 text-sm bg-gray-900 hover:bg-gray-800 text-white">Next <ArrowRight size={15} /></Button>
          ) : (
            <Button onClick={() => createMutation.mutate()} disabled={!canNext() || createMutation.isPending} className="gap-2 h-10 px-5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">
              <PackagePlus size={15} />{createMutation.isPending ? "Creating…" : "Create Carton"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
