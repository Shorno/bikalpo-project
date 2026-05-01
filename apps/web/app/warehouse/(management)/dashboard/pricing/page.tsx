"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Filter,
  Package,
  Pencil,
  Search,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { orpc } from "@/utils/orpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────

type PriceItem = {
  inventoryId: number;
  variantId: number;
  productId: number;
  productName: string;
  coreProductId: number | null;
  coreProductName: string;
  coreProductImage: string;
  categoryId: number;
  categoryName: string;
  subCategoryId: number | null;
  subCategoryName: string;
  typeId: number | null;
  typeName: string;
  brandId: number | null;
  brandName: string;
  variantLabel: string;
  packUnit: string;
  packPrice: string;
  basePrice: string;
  isActive: boolean;
  availableQty: string;
  updatedAt: string;
  isLoose: boolean;
  weightKg: number;
};

type FilterOption = { id: number; name: string };

// ─── Grouping ──────────────────────────────────────────────────

interface GroupedCoreProduct {
  productId: number;
  productName: string;
  coreProductImage: string;
  categoryName: string;
  typeName: string;
  items: PriceItem[];
}

interface GroupedCategory {
  typeName: string;
  categoryName: string;
  coreProducts: GroupedCoreProduct[];
}

function groupItems(items: PriceItem[]): GroupedCategory[] {
  // Group by typeName + categoryName → productName
  const catMap = new Map<string, GroupedCategory>();

  for (const item of items) {
    const catKey = `${item.typeName}::${item.categoryName}`;
    if (!catMap.has(catKey)) {
      catMap.set(catKey, {
        typeName: item.typeName,
        categoryName: item.categoryName,
        coreProducts: [],
      });
    }
    const cat = catMap.get(catKey)!;

    let cp = cat.coreProducts.find(
      (c) => c.productId === item.productId
    );
    if (!cp) {
      cp = {
        productId: item.productId,
        productName: item.productName,
        coreProductImage: item.coreProductImage,
        categoryName: item.categoryName,
        typeName: item.typeName,
        items: [],
      };
      cat.coreProducts.push(cp);
    }
    cp.items.push(item);
  }

  // Sort
  const result = Array.from(catMap.values()).sort((a, b) =>
    a.typeName.localeCompare(b.typeName) || a.categoryName.localeCompare(b.categoryName)
  );
  for (const cat of result) {
    cat.coreProducts.sort((a, b) => a.productName.localeCompare(b.productName));
    for (const cp of cat.coreProducts) {
      cp.items.sort((a, b) =>
        a.brandName.localeCompare(b.brandName) || a.variantLabel.localeCompare(b.variantLabel)
      );
    }
  }

  return result;
}

// ─── Stat Card ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: "default" | "amber" | "emerald" | "blue";
}) {
  const colors = {
    default: {
      bg: "bg-white border-gray-200",
      icon: "bg-gray-100 text-gray-600",
      val: "text-gray-900",
      lbl: "text-gray-500",
    },
    amber: {
      bg: "bg-amber-50/50 border-amber-200",
      icon: "bg-amber-100 text-amber-600",
      val: "text-amber-700",
      lbl: "text-amber-500",
    },
    emerald: {
      bg: "bg-emerald-50/50 border-emerald-200",
      icon: "bg-emerald-100 text-emerald-600",
      val: "text-emerald-700",
      lbl: "text-emerald-500",
    },
    blue: {
      bg: "bg-blue-50/50 border-blue-200",
      icon: "bg-blue-100 text-blue-600",
      val: "text-blue-700",
      lbl: "text-blue-500",
    },
  };
  const c = colors[color];

  return (
    <div className={`border rounded-xl p-4 ${c.bg}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${c.icon}`}>
          <Icon size={18} />
        </div>
        <div>
          <div className={`text-2xl font-bold ${c.val}`}>{value}</div>
          <div className={`text-xs font-medium ${c.lbl}`}>{label}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Core Product Price Section ────────────────────────────────

function CoreProductSection({
  group,
  editingId,
  editPrice,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditPriceChange,
  onToggleAvailability,
  isSaving,
}: {
  group: GroupedCoreProduct;
  editingId: number | null;
  editPrice: string;
  onStartEdit: (item: PriceItem) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditPriceChange: (val: string) => void;
  onToggleAvailability: (inventoryId: number, available: boolean) => void;
  isSaving: boolean;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);

  // Fetch carton summary from PHYSICAL cartons for all variants in this product
  const variantIds = group.items.map((i) => i.variantId);
  const { data: cartonSummaryData } = useQuery({
    queryKey: ["warehouse", "getCartonSummaryBatch", variantIds],
    queryFn: () => (orpc.warehouse as any).getCartonSummaryBatch.call({ variantIds }),
    enabled: expanded && variantIds.length > 0,
  });
  const allCartonSummaries: any[] = cartonSummaryData?.cartons ?? [];

  // Map: variantId → carton summary (from physical cartons)
  const cartonByVariant = useMemo(() => {
    const map = new Map<number, any>();
    for (const c of allCartonSummaries) {
      map.set(c.variantId, c);
    }
    return map;
  }, [allCartonSummaries]);

  // --- Inline delivery editing (updates the carton_config delivery cost) ---
  const [editingDeliveryVariantId, setEditingDeliveryVariantId] = useState<number | null>(null);
  const [editDeliveryValue, setEditDeliveryValue] = useState("");

  // Also fetch carton configs for delivery editing (we need the config ID to update)
  const { data: cartonConfigsData } = useQuery({
    queryKey: ["warehouse", "getCartonConfigsBatch", variantIds],
    queryFn: () => (orpc.warehouse as any).getCartonConfigsBatch.call({ variantIds }),
    enabled: expanded && variantIds.length > 0,
  });
  const allCartonConfigs: any[] = cartonConfigsData?.configs ?? [];

  const configByVariant = useMemo(() => {
    const map = new Map<number, any>();
    for (const c of allCartonConfigs) {
      if (!map.has(c.variantId) || c.isDefault) {
        map.set(c.variantId, c);
      }
    }
    return map;
  }, [allCartonConfigs]);

  const updateConfigMutation = useMutation({
    mutationFn: (d: any) => (orpc.warehouse as any).updateCartonConfig.call(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getCartonConfigsBatch"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getCartonSummaryBatch"] });
      setEditingDeliveryVariantId(null);
      toast.success("Delivery cost updated");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to update"),
  });

  return (
    <div className="border-t first:border-t-0">
      {/* Core Product Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden shrink-0">
            {group.coreProductImage ? (
              <Image
                src={group.coreProductImage}
                alt={group.productName}
                width={32}
                height={32}
                className="object-cover w-full h-full"
                unoptimized={group.coreProductImage.startsWith("http")}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>
          <div className="text-left">
            <h4 className="text-sm font-semibold text-gray-900">🧾 {group.productName}</h4>
            <p className="text-[11px] text-gray-500">
              {group.items.length} {group.items.length === 1 ? "variant" : "variants"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {group.items.length} items
          </Badge>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Variant Price Table */}
      {expanded && (
        <div className="[&_[data-slot=table-container]]:overflow-hidden">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="text-xs w-[14%]">Brand</TableHead>
                <TableHead className="text-xs w-[14%]">Variant</TableHead>
                <TableHead className="text-xs w-[10%]">Pack Unit</TableHead>
                <TableHead className="text-xs w-[18%]">Carton Unit</TableHead>
                <TableHead className="text-xs w-[11%]">Price</TableHead>
                <TableHead className="text-xs w-[12%]">Carton Price</TableHead>
                <TableHead className="text-xs w-[9%]">Delivery</TableHead>
                <TableHead className="text-xs text-right w-[12%]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.items.map((item) => {
                const isEditing = editingId === item.inventoryId;
                const isAvailable = Number(item.availableQty) > 0;
                const cartonInfo = cartonByVariant.get(item.variantId);
                const cartonCfg = configByVariant.get(item.variantId);

                // Use physical carton data for display, fall back to config
                const displayDelivery = cartonInfo?.deliveryCostPerUnit || cartonCfg?.deliveryCostPerCarton;

                return (
                  <TableRow
                    key={item.inventoryId}
                    className={isEditing ? "bg-amber-50/60 hover:bg-amber-50/60" : ""}
                  >
                    <TableCell className="font-medium text-gray-800">
                      {item.brandName}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {item.variantLabel}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {item.packUnit}
                    </TableCell>
                    <TableCell>
                      {cartonInfo ? (() => {
                        const perCartonKg = cartonInfo.activeCartonCount > 0
                          ? parseFloat(cartonInfo.totalWeightKg) / cartonInfo.activeCartonCount
                          : parseFloat(cartonInfo.totalWeightKg);
                        const perCartonKgStr = perCartonKg % 1 === 0 ? String(perCartonKg) : perCartonKg.toFixed(1);
                        const packKg = item.weightKg || 0;
                        const packsPerCarton = !item.isLoose && packKg > 0 ? Math.round(perCartonKg / packKg) : 0;
                        return (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 font-medium flex-wrap">
                            📦 {!item.isLoose && packsPerCarton > 0
                              ? <>{packKg} KG × {packsPerCarton} pcs = {perCartonKgStr} KG × {cartonInfo.activeCartonCount} carton</>
                              : <>{perCartonKgStr} KG × {cartonInfo.activeCartonCount} carton</>
                            }
                          </span>
                        );
                      })() : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">৳</span>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => onEditPriceChange(e.target.value)}
                            className="w-24 px-2 py-1 text-sm border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none bg-white"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onSaveEdit();
                              if (e.key === "Escape") onCancelEdit();
                            }}
                          />
                          {item.isLoose && <span className="text-[10px] text-muted-foreground">/KG</span>}
                        </div>
                      ) : (
                        <span className="font-semibold">
                          ৳ {item.isLoose && item.weightKg > 0
                            ? (Number(item.packPrice) / item.weightKg).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : Number(item.packPrice).toLocaleString()}
                          {item.isLoose && <span className="text-xs font-normal text-muted-foreground ml-0.5">/KG</span>}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {cartonInfo?.cartonPrice ? (
                        <>৳ {Number(cartonInfo.cartonPrice).toLocaleString()}</>
                      ) : (
                        <span className="text-muted-foreground font-normal">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(cartonInfo || cartonCfg) ? (
                        editingDeliveryVariantId === item.variantId ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">৳</span>
                            <input
                              type="number"
                              value={editDeliveryValue}
                              onChange={(e) => setEditDeliveryValue(e.target.value)}
                              className="w-24 px-2 py-1 text-sm border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none bg-white"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && cartonCfg) {
                                  updateConfigMutation.mutate({ id: cartonCfg.id, deliveryCostPerCarton: editDeliveryValue || "0" });
                                }
                                if (e.key === "Escape") setEditingDeliveryVariantId(null);
                              }}
                              onBlur={() => {
                                if (cartonCfg) {
                                  updateConfigMutation.mutate({ id: cartonCfg.id, deliveryCostPerCarton: editDeliveryValue || "0" });
                                } else {
                                  setEditingDeliveryVariantId(null);
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <span
                            className="cursor-pointer hover:text-amber-600 transition-colors"
                            onClick={() => {
                              setEditingDeliveryVariantId(item.variantId);
                              setEditDeliveryValue(displayDelivery || "");
                            }}
                            title="Click to edit delivery cost"
                          >
                            {displayDelivery ? (
                              <>৳ {Number(displayDelivery).toLocaleString()}</>
                            ) : (
                              <span className="text-muted-foreground italic text-xs">+ add</span>
                            )}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={onSaveEdit}
                              disabled={isSaving}
                              title="Save"
                            >
                              <Check size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              onClick={onCancelEdit}
                              title="Cancel"
                            >
                              <X size={14} />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                              onClick={() => onStartEdit(item)}
                              title="Edit Price"
                            >
                              <Pencil size={13} />
                            </Button>
                            <Switch
                              size="sm"
                              checked={isAvailable}
                              onCheckedChange={(checked) =>
                                onToggleAvailability(item.inventoryId, checked)
                              }
                              title={isAvailable ? "Mark unavailable" : "Mark available"}
                            />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>


        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function WarehousePricingPage() {
  const queryClient = useQueryClient();

  // Filter state
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>();
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | undefined>();
  const [selectedCoreProductId, setSelectedCoreProductId] = useState<number | undefined>();
  const [selectedBrandId, setSelectedBrandId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editingItem, setEditingItem] = useState<PriceItem | null>(null);

  // Search debounce
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__pricingSearchTimer);
    (window as any).__pricingSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
    }, 400);
  };

  // ─── Queries ─────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "warehouse",
      "getWarehousePriceList",
      {
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        coreProductId: selectedCoreProductId,
        brandId: selectedBrandId,
        search: debouncedSearch,
      },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getWarehousePriceList.call({
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        coreProductId: selectedCoreProductId,
        brandId: selectedBrandId,
        search: debouncedSearch || undefined,
      }),
  });

  // ─── Mutations ───────────────────────────────────────────────

  const priceMutation = useMutation({
    mutationFn: (d: { inventoryId: number; retailPrice: string }) =>
      (orpc.warehouse as any).updateWarehousePrice.call(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getWarehousePriceList"] });
      setEditingId(null);
      setEditingItem(null);
      toast.success("Price updated successfully");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update price");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (d: { inventoryId: number; available: boolean }) =>
      (orpc.warehouse as any).toggleInventoryAvailability.call(d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getWarehousePriceList"] });
      toast.success("Availability updated");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to toggle availability");
    },
  });

  // ─── Derived data ────────────────────────────────────────────

  const items: PriceItem[] = data?.items ?? [];
  const stats = data?.stats ?? { totalProducts: 0, totalVariants: 0, lastUpdated: null };
  const filterOptions = data?.filterOptions ?? {
    types: [],
    categories: [],
    subCategories: [],
    coreProducts: [],
    brands: [],
  };

  const grouped = useMemo(() => groupItems(items), [items]);

  // Show more pagination
  const INITIAL_VISIBLE = 10;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);

  // Flatten all product groups across categories for counting
  const allProductGroups = useMemo(() => grouped.flatMap((cat) => cat.coreProducts), [grouped]);
  const totalGroups = allProductGroups.length;
  const hasMore = visibleCount < totalGroups;

  // Build visible grouped categories (sliced)
  const visibleGrouped = useMemo(() => {
    let count = 0;
    const result: GroupedCategory[] = [];
    for (const cat of grouped) {
      if (count >= visibleCount) break;
      const remaining = visibleCount - count;
      const visibleProducts = cat.coreProducts.slice(0, remaining);
      result.push({ ...cat, coreProducts: visibleProducts });
      count += visibleProducts.length;
    }
    return result;
  }, [grouped, visibleCount]);

  const hasActiveFilters = !!(
    selectedTypeId ||
    selectedCategoryId ||
    selectedSubCategoryId ||
    selectedCoreProductId ||
    selectedBrandId ||
    debouncedSearch
  );

  // ─── Handlers ────────────────────────────────────────────────

  const handleStartEdit = (item: PriceItem) => {
    setEditingId(item.inventoryId);
    setEditingItem(item);
    // For loose products, show per-KG price in the edit field
    if (item.isLoose && item.weightKg > 0) {
      setEditPrice(String(Number(item.packPrice) / item.weightKg));
    } else {
      setEditPrice(item.packPrice);
    }
  };

  const handleSaveEdit = () => {
    if (editingId === null) return;
    // For loose products, convert per-KG price back to total
    let priceToSave = editPrice;
    if (editingItem?.isLoose && editingItem.weightKg > 0) {
      priceToSave = String(Number(editPrice) * editingItem.weightKg);
    }
    priceMutation.mutate({
      inventoryId: editingId,
      retailPrice: priceToSave,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditPrice("");
    setEditingItem(null);
  };

  const clearFilters = () => {
    setSelectedTypeId(undefined);
    setSelectedCategoryId(undefined);
    setSelectedSubCategoryId(undefined);
    setSelectedCoreProductId(undefined);
    setSelectedBrandId(undefined);
    setSearch("");
    setDebouncedSearch("");
    setVisibleCount(INITIAL_VISIBLE);
  };

  // ─── Cascading filter options ────────────────────────────────

  const filteredCategories: FilterOption[] = useMemo(() => {
    if (!selectedTypeId) return filterOptions.categories;
    // Filter categories that belong to the selected type
    const catIdsInType = new Set(
      items.filter((i) => i.typeId === selectedTypeId).map((i) => i.categoryId)
    );
    return filterOptions.categories.filter((c: FilterOption) => catIdsInType.has(c.id));
  }, [filterOptions.categories, selectedTypeId, items]);

  const filteredSubCategories: FilterOption[] = useMemo(() => {
    if (!selectedCategoryId) return filterOptions.subCategories;
    const scIds = new Set(
      items.filter((i) => i.categoryId === selectedCategoryId).map((i) => i.subCategoryId).filter(Boolean)
    );
    return filterOptions.subCategories.filter((sc: FilterOption) => scIds.has(sc.id));
  }, [filterOptions.subCategories, selectedCategoryId, items]);

  const filteredCoreProducts: FilterOption[] = useMemo(() => {
    let pool = items;
    if (selectedCategoryId) pool = pool.filter((i) => i.categoryId === selectedCategoryId);
    if (selectedSubCategoryId) pool = pool.filter((i) => i.subCategoryId === selectedSubCategoryId);
    const cpIds = new Set(pool.map((i) => i.coreProductId).filter(Boolean));
    return filterOptions.coreProducts.filter((cp: FilterOption) => cpIds.has(cp.id));
  }, [filterOptions.coreProducts, selectedCategoryId, selectedSubCategoryId, items]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Wallet className="text-amber-600" size={22} />
            </div>
            Wholesale Price Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Supply price for retailers — set pack prices for your warehouse inventory
          </p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search product, brand..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
      </div>

      {/* ── Quick Insight Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Total Products"
          value={stats.totalProducts}
          icon={Package}
          color="amber"
        />
        <StatCard
          label="Total Variants"
          value={stats.totalVariants}
          icon={Tag}
          color="blue"
        />
        <StatCard
          label="Last Updated"
          value={
            stats.lastUpdated
              ? new Date(stats.lastUpdated).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—"
          }
          icon={DollarSign}
          color="emerald"
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Filter By
            </span>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1">
              <X size={12} />
              Clear Filters
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Type */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Type
            </Label>
            <Select
              value={selectedTypeId?.toString() ?? "all"}
              onValueChange={(val) => {
                setSelectedTypeId(val === "all" ? undefined : Number(val));
                setSelectedCategoryId(undefined);
                setSelectedSubCategoryId(undefined);
                setSelectedCoreProductId(undefined);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {filterOptions.types.map((t: FilterOption) => (
                  <SelectItem key={t.id} value={t.id.toString()}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Category
            </Label>
            <Select
              value={selectedCategoryId?.toString() ?? "all"}
              onValueChange={(val) => {
                setSelectedCategoryId(val === "all" ? undefined : Number(val));
                setSelectedSubCategoryId(undefined);
                setSelectedCoreProductId(undefined);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filteredCategories.map((c: FilterOption) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub Category */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Sub Category
            </Label>
            <Select
              value={selectedSubCategoryId?.toString() ?? "all"}
              onValueChange={(val) => {
                setSelectedSubCategoryId(val === "all" ? undefined : Number(val));
                setSelectedCoreProductId(undefined);
              }}
              disabled={!selectedCategoryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Sub Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sub Categories</SelectItem>
                {filteredSubCategories.map((sc: FilterOption) => (
                  <SelectItem key={sc.id} value={sc.id.toString()}>
                    {sc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Core Identity */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Core Identity
            </Label>
            <Select
              value={selectedCoreProductId?.toString() ?? "all"}
              onValueChange={(val) =>
                setSelectedCoreProductId(val === "all" ? undefined : Number(val))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Core Identities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Core Identities</SelectItem>
                {filteredCoreProducts.map((cp: FilterOption) => (
                  <SelectItem key={cp.id} value={cp.id.toString()}>
                    {cp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Brand */}
          <div className="space-y-1">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Brand
            </Label>
            <Select
              value={selectedBrandId?.toString() ?? "all"}
              onValueChange={(val) =>
                setSelectedBrandId(val === "all" ? undefined : Number(val))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Brands</SelectItem>
                {filterOptions.brands.map((b: FilterOption) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 border rounded-lg">
          <div className="w-8 h-8 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">Loading price list...</p>
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-red-200 rounded-lg bg-red-50/50">
          <AlertCircle className="text-red-400 mb-4" size={40} />
          <p className="text-red-600 font-semibold">Failed to load price list</p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-4"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["warehouse", "getWarehousePriceList"] })
            }
          >
            Retry
          </Button>
        </div>
      ) : items.length === 0 && !hasActiveFilters ? (
        /* ── Empty State ── */
        <div className="flex flex-col items-center justify-center py-20 border border-dashed rounded-lg bg-gray-50/50">
          <Wallet className="text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 text-lg font-medium">No products in warehouse</p>
          <p className="text-sm text-gray-400 mt-1">
            Add products from the{" "}
            <a
              href="/warehouse/dashboard/catalog"
              className="text-amber-600 underline font-medium"
            >
              Product Catalog
            </a>{" "}
            first, then manage their prices here.
          </p>
        </div>
      ) : items.length === 0 && hasActiveFilters ? (
        <div className="text-center py-12 text-gray-400 text-sm border rounded-xl bg-gray-50/50">
          No products match the current filters.{" "}
          <button onClick={clearFilters} className="text-amber-600 underline">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Result count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">{items.length}</span>{" "}
              {items.length === 1 ? "variant" : "variants"}
              {hasActiveFilters && (
                <span className="text-amber-600 ml-1">(filtered)</span>
              )}
            </p>
          </div>

          {/* Grouped Price Tables */}
          {visibleGrouped.map((cat) => (
            <div
              key={`${cat.typeName}-${cat.categoryName}`}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Category Header */}
              <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold">
                    {cat.typeName}
                  </Badge>
                  <h3 className="text-sm font-bold text-gray-900">
                    📂 {cat.categoryName.toUpperCase()}
                  </h3>
                </div>
              </div>

              {/* Core Product Sections */}
              {cat.coreProducts.map((cp) => (
                <CoreProductSection
                  key={cp.productId}
                  group={cp}
                  editingId={editingId}
                  editPrice={editPrice}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onEditPriceChange={setEditPrice}
                  onToggleAvailability={(id, available) =>
                    toggleMutation.mutate({ inventoryId: id, available })
                  }
                  isSaving={priceMutation.isPending}
                />
              ))}
            </div>
          ))}

          {/* Show More */}
          {hasMore && (
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-xs text-muted-foreground">
                Showing {Math.min(visibleCount, totalGroups)} of {totalGroups} products
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((c) => c + 10)}
                className="gap-1.5"
              >
                Show more
              </Button>
            </div>
          )}
        </div>
      )}


    </div>
  );
}
