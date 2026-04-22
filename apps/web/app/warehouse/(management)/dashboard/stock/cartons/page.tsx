"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BoxIcon,
  ChevronDown,
  HashIcon,
  Package,
  PackagePlus,
  Plus,
  ScissorsIcon,
  Search,
  Weight,
  X,
} from "lucide-react";
import Image from "next/image";
import { useState, useMemo } from "react";
import { orpc } from "@/utils/orpc";

// ── Types ──
type CartonStatus = "active" | "broken" | "dispatched" | "sold";

const statusConfig: Record<CartonStatus, { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  broken: { label: "Broken", cls: "bg-red-100 text-red-600", dot: "bg-red-500" },
  dispatched: { label: "Dispatched", cls: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  sold: { label: "Sold", cls: "bg-gray-100 text-gray-600", dot: "bg-gray-500" },
};

// ── Create Carton Dialog ──
function CreateCartonDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const { data: productsData } = useQuery({
    queryKey: ["warehouse", "getWarehouseProductsForStock"],
    queryFn: () => orpc.warehouse.getWarehouseProductsForStock.call({ limit: 100 }),
  });

  const allVariants = useMemo(() => {
    if (!productsData?.products) return [];
    return productsData.products.flatMap((p: any) =>
      (p.variants || []).map((v: any) => ({
        ...v,
        productName: p.name,
        productImage: p.image,
      })),
    );
  }, [productsData]);

  const { data: configsData } = useQuery({
    queryKey: ["warehouse", "getCartonConfigs", selectedVariantId],
    queryFn: () => orpc.warehouse.getCartonConfigs.call({ variantId: selectedVariantId! }),
    enabled: !!selectedVariantId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { variantId: number; cartonConfigId: number; note?: string }) =>
      orpc.warehouse.createCarton.call(data),
    onSuccess: () => onSuccess(),
  });

  const configs = configsData?.configs || [];
  const selectedConfig = configs.find((c: any) => c.id === selectedConfigId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-gray-900">Create Carton</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Select Variant */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Variant</label>
            <select
              value={selectedVariantId || ""}
              onChange={(e) => {
                setSelectedVariantId(Number(e.target.value) || null);
                setSelectedConfigId(null);
              }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            >
              <option value="">Choose a variant...</option>
              {allVariants.map((v: any) => (
                <option key={v.id} value={v.id}>
                  {v.productName} — {v.unitLabel} ({v.weightKg}kg)
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Carton Config */}
          {selectedVariantId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Carton Config</label>
              {configs.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No carton configs for this variant. Create one first.</p>
              ) : (
                <div className="space-y-2">
                  {configs.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedConfigId(c.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${
                        selectedConfigId === c.id
                          ? "border-amber-500 bg-amber-50/50"
                          : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{c.label || `${c.packsPerCarton} Pack Carton`}</p>
                        <p className="text-xs text-gray-500">
                          {c.packsPerCarton} packs · {c.cartonWeightKg}kg · ৳{c.cartonPrice}
                        </p>
                      </div>
                      {selectedConfigId === c.id && (
                        <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {selectedConfig && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 border">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Carton Preview</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">{selectedConfig.packsPerCarton}</p>
                  <p className="text-[11px] text-gray-500">Packs</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{selectedConfig.cartonWeightKg}kg</p>
                  <p className="text-[11px] text-gray-500">Weight</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-600">৳{Number(selectedConfig.cartonPrice).toLocaleString()}</p>
                  <p className="text-[11px] text-gray-500">Price</p>
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any notes about this carton..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none"
            />
          </div>

          {/* Error */}
          {createMutation.isError && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl border border-red-200">
              {(createMutation.error as any)?.message || "Failed to create carton"}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition">
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedVariantId && selectedConfigId) {
                createMutation.mutate({
                  variantId: selectedVariantId,
                  cartonConfigId: selectedConfigId,
                  note: note || undefined,
                });
              }
            }}
            disabled={!selectedVariantId || !selectedConfigId || createMutation.isPending}
            className="px-5 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {createMutation.isPending ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Carton
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Carton Card ──
function CartonCard({
  carton,
  onBreak,
  isBreaking,
}: {
  carton: any;
  onBreak: (id: number) => void;
  isBreaking: boolean;
}) {
  const status = statusConfig[carton.status as CartonStatus] || statusConfig.active;
  const variant = carton.variant;
  const product = variant?.product;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-50/50 border-b">
        <div className="flex items-center gap-2">
          <HashIcon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm font-bold text-gray-800 font-mono">{carton.cartonId}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
            {product?.image ? (
              <Image src={product.image} alt={product.name} width={40} height={40} className="object-cover w-full h-full" unoptimized />
            ) : (
              <Package className="w-5 h-5 text-gray-300" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{product?.name || "Unknown"}</p>
            <p className="text-xs text-gray-500">
              {variant?.brand?.name && `${variant.brand.name} · `}
              {variant?.unitLabel} · {variant?.weightKg}kg
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
            <BoxIcon className="w-3.5 h-3.5 text-amber-500 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-gray-800">{carton.totalPacks}</p>
            <p className="text-[10px] text-gray-500">Packs</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
            <Weight className="w-3.5 h-3.5 text-blue-500 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-gray-800">{carton.totalWeightKg}kg</p>
            <p className="text-[10px] text-gray-500">Weight</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
            <Package className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-0.5" />
            <p className="text-sm font-bold text-gray-800">{carton.config?.label || "—"}</p>
            <p className="text-[10px] text-gray-500">Config</p>
          </div>
        </div>

        {/* Storage & Date */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{carton.storageArea?.name || "No area"}</span>
          <span>{new Date(carton.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Actions */}
      {carton.status === "active" && (
        <div className="border-t px-4 py-2.5 bg-gray-50/50">
          <button
            onClick={() => onBreak(carton.id)}
            disabled={isBreaking}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
          >
            <ScissorsIcon className="w-3.5 h-3.5" />
            {isBreaking ? "Breaking..." : "Break Carton"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function CartonManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CartonStatus | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [breakingId, setBreakingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["warehouse", "getCartons", { status: statusFilter || undefined, page: 1, limit: 100 }],
    queryFn: () =>
      orpc.warehouse.getCartons.call({
        status: statusFilter || undefined,
        page: 1,
        limit: 100,
      }),
  });

  const breakMutation = useMutation({
    mutationFn: (cartonId: number) => orpc.warehouse.breakCarton.call({ cartonId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getCartons"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyInventory"] });
      setBreakingId(null);
    },
  });

  const handleBreak = (id: number) => {
    if (confirm("Are you sure you want to break this carton? The packs will be returned to loose stock.")) {
      setBreakingId(id);
      breakMutation.mutate(id);
    }
  };

  const cartons = data?.cartons || [];
  const stats = data?.stats || { active: 0, total: 0 };

  const filtered = useMemo(() => {
    if (!search.trim()) return cartons;
    const s = search.toLowerCase();
    return cartons.filter(
      (c: any) =>
        c.cartonId?.toLowerCase().includes(s) ||
        c.variant?.product?.name?.toLowerCase().includes(s) ||
        c.variant?.brand?.name?.toLowerCase().includes(s),
    );
  }, [cartons, search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BoxIcon className="text-amber-600" size={24} />
            Carton Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, manage, and track physical cartons in your warehouse
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Carton
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white border border-emerald-200 bg-emerald-50/50 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-emerald-500 uppercase">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white border border-red-200 bg-red-50/50 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-red-500 uppercase">Broken</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.total - stats.active}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase">This Page</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{filtered.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by carton ID, product, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 focus:border-amber-500 outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CartonStatus | "")}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-amber-500 outline-none bg-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="broken">Broken</option>
            <option value="dispatched">Dispatched</option>
            <option value="sold">Sold</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-4 animate-pulse space-y-3">
              <div className="h-4 w-32 bg-gray-100 rounded" />
              <div className="h-16 w-full bg-gray-100 rounded" />
              <div className="h-8 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-xl bg-gray-50/50">
          <BoxIcon className="text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 text-lg font-medium">No cartons found</p>
          <p className="text-sm text-gray-400 mt-1">
            {cartons.length === 0 ? "Create your first carton to get started." : `No results for "${search}"`}
          </p>
          {cartons.length === 0 && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 transition"
            >
              Create First Carton
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c: any) => (
            <CartonCard
              key={c.id}
              carton={c}
              onBreak={handleBreak}
              isBreaking={breakingId === c.id && breakMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <CreateCartonDialog
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ["warehouse", "getCartons"] });
            queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyInventory"] });
          }}
        />
      )}
    </div>
  );
}
