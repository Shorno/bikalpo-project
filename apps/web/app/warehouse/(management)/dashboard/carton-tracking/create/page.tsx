"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Box,
  Check,
  Hash,
  Layers,
  MapPin,
  Package,
  PackagePlus,
  QrCode,
  Search,
  Trash2,
  Weight,
} from "lucide-react";
import Image from "next/image";
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

type CartonItem = {
  variantId: number;
  sku: string;
  productName: string;
  brandName: string | null;
  variantLabel: string;
  weightKg: number;
  price: number;
  packCount: number;
  availableStock: number;
  totalStock: number;
  stockInCartons: number;
  availableForCarton: number;
  image: string | null;
  isLoose: boolean;
};

const STEPS = [
  { label: "Product Type", icon: Layers },
  { label: "Add Items", icon: Package },
  { label: "Define Carton", icon: Box },
  { label: "Generate ID", icon: Hash },
  { label: "Preview", icon: BarChart3 },
];

function formatStockValue(value: number, isLoose: boolean) {
  if (isLoose) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: value % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    });
  }
  return Math.floor(value).toLocaleString();
}

function Stepper({ current }: { current: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center">
        {STEPS.map((step, i) => {
          const num = i + 1;
          const done = current > num;
          const active = current === num;
          const Icon = step.icon;
          return (
            <div key={num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                    transition-all duration-300 ring-4
                    ${done
                      ? "bg-emerald-600 text-white ring-emerald-100"
                      : active
                        ? "bg-gray-900 text-white ring-gray-200"
                        : "bg-white text-gray-400 ring-transparent border-2 border-gray-200"
                    }
                  `}
                >
                  {done ? <Check size={18} strokeWidth={2.5} /> : <Icon size={16} />}
                </div>
                <div className="flex flex-col items-center">
                  <span
                    className={`text-xs font-semibold whitespace-nowrap ${
                      active ? "text-gray-900" : done ? "text-emerald-600" : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className={`text-[10px] ${active ? "text-gray-500" : "text-transparent"}`}>
                    Step {num}
                  </span>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 mx-3 mt-[-20px]">
                  <div className={`h-0.5 w-full rounded-full transition-colors duration-300 ${done ? "bg-emerald-500" : "bg-gray-200"}`} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CreateCartonPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [productType, setProductType] = useState<"single" | "mixed">("single");

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [items, setItems] = useState<CartonItem[]>([]);
  const isSingleMode = productType === "single";

  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [storageAreaId, setStorageAreaId] = useState<string>("");
  const [note, setNote] = useState("");
  const [cartonPrice, setCartonPrice] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("");
  const [generateBarcode, setGenerateBarcode] = useState(true);

  // Load all products for filter options
  const { data: allProductsData } = useQuery({
    queryKey: ["w", "all-products-for-filters"],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({ limit: 200 }),
  });

  const hasActiveFilters =
    searchQuery.length >= 1 || categoryFilter !== "all" || subCategoryFilter !== "all" || productFilter !== "all";

  const { data: searchData } = useQuery({
    queryKey: ["w", "search", searchQuery, categoryFilter, subCategoryFilter, productFilter],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({
        search: searchQuery || undefined,
        categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
        subCategoryId: subCategoryFilter !== "all" ? Number(subCategoryFilter) : undefined,
        productId: productFilter !== "all" ? Number(productFilter) : undefined,
        limit: 50,
      }),
    enabled: hasActiveFilters,
  });

  const firstVariantId = items.length > 0 ? items[0].variantId : null;
  const { data: configsData } = useQuery({
    queryKey: ["w", "configs", firstVariantId],
    queryFn: () => (orpc.warehouse as any).getCartonConfigs.call({ variantId: firstVariantId }),
    enabled: !!firstVariantId,
  });
  const { data: areasData } = useQuery({
    queryKey: ["w", "areas"],
    queryFn: () => (orpc.warehouse as any).getStorageAreas.call({}),
  });
  const { data: nextIdData } = useQuery({
    queryKey: ["w", "next-carton-id"],
    queryFn: () => (orpc.warehouse as any).getNextCartonIdPreview.call({}),
  });

  const allProductsList = allProductsData?.products ?? [];
  const products = searchData?.products ?? [];
  const configs = configsData?.configs ?? [];
  const areas = areasData?.areas ?? [];
  const selectedConfig = configs.find((c: any) => c.id === selectedConfigId);
  const nextCartonId = nextIdData?.nextCartonId ?? "CTN-...";

  // Extract filter options from all products
  const allCategories = allProductsList.reduce((acc: any[], p: any) => {
    if (p.category && !acc.find((c: any) => c.id === p.category.id)) acc.push(p.category);
    return acc;
  }, []);

  const allSubCategories = allProductsList.reduce((acc: any[], p: any) => {
    if (!p.subCategory) return acc;
    if (categoryFilter !== "all" && p.categoryId !== Number(categoryFilter)) return acc;
    if (!acc.find((sc: any) => sc.id === p.subCategory.id)) acc.push(p.subCategory);
    return acc;
  }, []);

  const allProductNames = allProductsList.reduce((acc: any[], p: any) => {
    if (categoryFilter !== "all" && p.categoryId !== Number(categoryFilter)) return acc;
    if (subCategoryFilter !== "all" && p.subCategoryId !== Number(subCategoryFilter)) return acc;
    if (!acc.find((item: any) => item.id === p.id)) acc.push({ id: p.id, name: p.name });
    return acc;
  }, []);

  const totalPacks = items.reduce((s, i) => s + i.packCount, 0);
  const totalWeightKg = items.reduce((s, i) =>
    s + (i.isLoose ? i.packCount : i.packCount * i.weightKg), 0).toFixed(2);
  const totalLoosePrice = items.reduce((s, i) => s + i.packCount * i.price, 0).toFixed(2);

  const addItem = (variant: any, product: any) => {
    const vid = variant.variantId || variant.id;
    if (items.find((i) => i.variantId === vid)) return;
    const packType = variant.packType || variant.packagingType || "other";
    const isLoose = packType === "loose";
    const totalStock = Math.max(0, parseFloat(String(variant.stock?.availableQty ?? 0)));
    const stockInCartons = Math.max(0, parseFloat(String(variant.stock?.inCartonQty ?? 0)));
    const looseStock = variant.stock?.looseStock ?? 0;
    const availableForCarton = Math.max(0, parseFloat(String(looseStock)));
    const newItem: CartonItem = {
      variantId: vid,
      sku: variant.sku || "—",
      productName: product.name || product.productName,
      brandName: variant.brand?.name || product.brand?.name || null,
      variantLabel: isLoose
        ? `Loose · per KG`
        : `${variant.unitLabel || variant.label} · ${variant.weightKg || variant.weight}KG`,
      weightKg: parseFloat(variant.weightKg || variant.weight || "0"),
      price: parseFloat(variant.price || "0"),
      packCount: 0,
      availableStock: isLoose
        ? availableForCarton
        : Math.max(0, Math.floor(availableForCarton)),
      totalStock: isLoose ? totalStock : Math.floor(totalStock),
      stockInCartons: isLoose ? stockInCartons : Math.floor(stockInCartons),
      availableForCarton: isLoose
        ? availableForCarton
        : Math.max(0, Math.floor(availableForCarton)),
      image: product.coreProduct?.image || product.image || null,
      isLoose,
    };
    if (isSingleMode) {
      setItems([newItem]);
      setSearchQuery("");
    } else {
      setItems([...items, newItem]);
    }
  };

  const updatePackCount = (variantId: number, count: number) => {
    setItems(items.map((i) => (i.variantId === variantId ? { ...i, packCount: count } : i)));
  };

  const removeItem = (variantId: number) => {
    setItems(items.filter((i) => i.variantId !== variantId));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      (orpc.warehouse as any).createCarton.call({
        variantId: items[0].variantId,
        packCount: items[0].packCount,
        cartonConfigId: selectedConfigId || undefined,
        storageAreaId: storageAreaId ? Number(storageAreaId) : undefined,
        note: note || undefined,
        overrideCartonPrice: cartonPrice || undefined,
        overrideDeliveryCost: deliveryCost || undefined,
      }),
    onSuccess: (res: any) => {
      toast.success(`Carton ${res.cartonId} created!`);
      qc.invalidateQueries({ queryKey: ["warehouse"] });
      router.push("/warehouse/dashboard/carton-tracking");
    },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const canNext = () => {
    switch (step) {
      case 2:
        return (
          items.length > 0 &&
          items.every((i) => i.packCount > 0 && i.packCount <= i.availableStock)
        );
      default:
        return true;
    }
  };

  // Check if any item in the carton is loose
  const hasLooseItems = items.some((i) => i.isLoose);
  const hasPackItems = items.some((i) => !i.isLoose);

  return (
    <div className="min-h-screen bg-gray-50/60">
      {/* Top navigation bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/warehouse/dashboard/carton-tracking">
                <div className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer">
                  <ArrowLeft size={16} className="text-gray-500" />
                </div>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div>
                <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <PackagePlus size={18} className="text-gray-600" />
                  Create Carton
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Step {step} of {STEPS.length} — {STEPS[step - 1].label}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 font-medium">
                {productType === "single" ? "Single Product" : "Mixed"} Mode
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
        {/* Stepper */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <Stepper current={step} />
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Step header */}
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">{STEPS[step - 1].label}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 1 && "Choose the type of carton you want to create."}
              {step === 2 && "Search and add products to your carton composition."}
              {step === 3 && "Configure carton dimensions, weight, and storage details."}
              {step === 4 && "A unique carton ID will be assigned upon creation."}
              {step === 5 && "Review your carton details and set final pricing."}
            </p>
          </div>

          <div className="px-8 py-8">
            {/* ─── Step 1: Product Type ─── */}
            {step === 1 && (
              <div className="max-w-2xl">
                <div className="space-y-4">
                  <div
                    className={`
                      relative p-6 rounded-xl border-2 cursor-pointer transition-all group
                      ${productType === "single"
                        ? "border-gray-900 bg-gray-50 shadow-sm"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                      }
                    `}
                    onClick={() => {
                      setProductType("single");
                      setItems([]);
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`
                          w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors
                          ${productType === "single" ? "bg-gray-900" : "border-2 border-gray-300 group-hover:border-gray-400"}
                        `}
                      >
                        {productType === "single" && <Check size={14} className="text-white" strokeWidth={2.5} />}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">Single Product Carton</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Contains only one product variant per carton. Best for standardized inventory.
                        </p>
                      </div>
                      <Package size={24} className={`flex-shrink-0 ${productType === "single" ? "text-gray-900" : "text-gray-300"}`} />
                    </div>
                  </div>

                  <div className="relative p-6 rounded-xl border border-gray-200 bg-gray-50/50 opacity-60 cursor-not-allowed">
                    <div className="flex items-start gap-4">
                      <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-400">Mixed Product Carton</p>
                          <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide">
                            Coming Soon
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          Combine multiple product variants in a single carton.
                        </p>
                      </div>
                      <Layers size={24} className="text-gray-300 flex-shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 2: Add Items ─── */}
            {step === 2 && (
              <div className="space-y-6">
                {isSingleMode && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                    <p className="text-sm text-amber-700 font-medium">
                      Single Product Mode — Only one product variant allowed per carton
                    </p>
                  </div>
                )}

                {/* Filters */}
                {!(isSingleMode && items.length > 0) && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">Category</Label>
                        <Select
                          value={categoryFilter}
                          onValueChange={(val) => {
                            setCategoryFilter(val);
                            setSubCategoryFilter("all");
                            setProductFilter("all");
                          }}
                        >
                          <SelectTrigger className="h-[42px] bg-gray-50 border-gray-200">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {allCategories.map((c: any) => (
                              <SelectItem key={c.id} value={String(c.id)}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">Sub-category</Label>
                        <Select
                          value={subCategoryFilter}
                          onValueChange={(val) => {
                            setSubCategoryFilter(val);
                            setProductFilter("all");
                          }}
                          disabled={categoryFilter === "all"}
                        >
                          <SelectTrigger className="h-[42px] bg-gray-50 border-gray-200">
                            <SelectValue placeholder={categoryFilter === "all" ? "Select a category first" : "All Sub-categories"} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sub-categories</SelectItem>
                            {allSubCategories.map((sc: any) => (
                              <SelectItem key={sc.id} value={String(sc.id)}>
                                {sc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">Product</Label>
                        <Select
                          value={productFilter}
                          onValueChange={setProductFilter}
                          disabled={allProductNames.length === 0}
                        >
                          <SelectTrigger className="h-[42px] bg-gray-50 border-gray-200">
                            <SelectValue placeholder="All Products" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Products</SelectItem>
                            {allProductNames.map((p: any) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search by SKU, product name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-[42px] text-sm bg-gray-50 border-gray-200 focus:bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Search Results */}
                {hasActiveFilters && !(isSingleMode && items.length > 0) && (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y bg-white shadow-sm">
                    {products.length === 0 ? (
                      <div className="flex flex-col items-center py-10 text-center">
                        <Search size={28} className="text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500 font-medium">No products found</p>
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your search terms</p>
                      </div>
                    ) : (
                      products.map((p: any) =>
                        (p.variants || []).map((v: any) => {
                          const vid = v.variantId || v.id;
                          const alreadyAdded = items.find((i) => i.variantId === vid);
                          const isLoose = (v.packType || v.packagingType || "other") === "loose";
                          const totalStock = Math.max(0, Number(v.stock?.availableQty ?? 0));
                          const stockInCartons = Math.max(0, Number(v.stock?.inCartonQty ?? 0));
                          const availableForCarton = Math.max(0, Number(v.stock?.looseStock ?? 0));
                          const looseStock = isLoose
                            ? availableForCarton
                            : Math.max(0, Math.floor(availableForCarton));
                          const outOfStock = looseStock <= 0;
                          const productImage = p.coreProduct?.image || p.image;
                          return (
                            <div
                              key={vid}
                              className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                                alreadyAdded
                                  ? "bg-emerald-50/40 cursor-default"
                                  : outOfStock
                                    ? "bg-gray-50/50 cursor-not-allowed opacity-60"
                                    : "cursor-pointer hover:bg-gray-50"
                              }`}
                              onClick={() => !alreadyAdded && !outOfStock && addItem(v, p)}
                            >
                              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {productImage ? (
                                  <Image src={productImage} alt={p.name || ""} width={40} height={40} className="w-full h-full object-cover" />
                                ) : (
                                  <Package size={18} className="text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-sm text-gray-900 truncate">{p.name || p.productName}</p>
                                  {(v.brand?.name || p.brand?.name) && (
                                    <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                                      {v.brand?.name || p.brand?.name}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {v.unitLabel || v.label} · {v.weightKg || v.weight}KG
                                  {v.sku ? ` · ${v.sku}` : ""}
                                  {p.category ? ` · ${p.category.name}` : ""}
                                </p>
                                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                                  <span>
                                    Total:{" "}
                                    <span className="font-semibold text-gray-700">
                                      {formatStockValue(totalStock, isLoose)} {isLoose ? "KG" : "Pack"}
                                    </span>
                                  </span>
                                  <span>
                                    In cartons:{" "}
                                    <span className="font-semibold text-blue-600">
                                      {formatStockValue(stockInCartons, isLoose)} {isLoose ? "KG" : "Pack"}
                                    </span>
                                  </span>
                                  <span>
                                    Available for carton:{" "}
                                    <span className="font-semibold text-amber-600">
                                      {formatStockValue(availableForCarton, isLoose)} {isLoose ? "KG" : "Pack"}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <span className={`text-xs font-semibold tabular-nums px-2.5 py-1 rounded-full ${
                                outOfStock
                                  ? "bg-red-50 text-red-600"
                                  : "bg-gray-100 text-gray-600"
                              }`}>
                                {outOfStock
                                  ? "No stock"
                                  : `${formatStockValue(availableForCarton, isLoose)} ready`}
                              </span>
                              {alreadyAdded ? (
                                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full">
                                  <Check size={14} /> Added
                                </span>
                              ) : !outOfStock ? (
                                <span className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors">
                                  + Add
                                </span>
                              ) : null}
                            </div>
                          );
                        })
                      )
                    )}
                  </div>
                )}

                {/* Selected Items Table */}
                {items.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Selected Items ({items.length})
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50/80 border-b border-gray-200">
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              SKU
                            </th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Product Name
                            </th>
                            <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Variant
                            </th>
                            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Stock Snapshot
                            </th>
                            <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              Qty {hasLooseItems && hasPackItems ? "" : hasLooseItems ? "(KG)" : "(Pack)"}
                            </th>
                            <th className="w-16" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((item) => {
                            const overLimit = item.packCount > item.availableStock;
                            return (
                              <tr key={item.variantId} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-4 font-mono text-xs text-gray-500">{item.sku}</td>
                                <td className="px-5 py-4">
                                  <span className="font-semibold text-gray-900">{item.productName}</span>
                                  {item.brandName && (
                                    <span className="ml-2 text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                      {item.brandName}
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-4 text-gray-600">{item.variantLabel}</td>
                                <td className="px-5 py-4 text-center">
                                  <div className="space-y-1 text-xs">
                                    <div className="font-semibold tabular-nums text-gray-700">
                                      {formatStockValue(item.totalStock, item.isLoose)} {item.isLoose ? "KG" : "Pack"} total
                                    </div>
                                    <div className="tabular-nums text-blue-600">
                                      {formatStockValue(item.stockInCartons, item.isLoose)} {item.isLoose ? "KG" : "Pack"} in cartons
                                    </div>
                                    <div className="tabular-nums text-amber-600">
                                      {formatStockValue(item.availableForCarton, item.isLoose)} {item.isLoose ? "KG" : "Pack"} ready
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-4 text-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min={item.isLoose ? 0.1 : 1}
                                        max={item.availableStock}
                                        step={item.isLoose ? 0.1 : 1}
                                        value={item.packCount || ""}
                                        onChange={(e) => updatePackCount(item.variantId, Number(e.target.value) || 0)}
                                        placeholder="0"
                                        className={`w-24 h-9 text-center font-semibold mx-auto bg-gray-50 ${
                                          overLimit ? "border-red-400 text-red-600 focus:ring-red-200" : "border-gray-200"
                                        }`}
                                      />
                                      {item.isLoose && (
                                        <span className="text-xs text-gray-400 font-medium">KG</span>
                                      )}
                                    </div>
                                    {overLimit && (
                                      <span className="text-[11px] text-red-500 font-medium">
                                        Max {item.isLoose ? `${item.availableStock.toFixed(1)} KG` : item.availableStock}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-4 text-center">
                                  <button
                                    onClick={() => removeItem(item.variantId)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Bar */}
                    <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Total Items</span>
                      </div>
                      <div className="flex items-center gap-4">
                        {hasPackItems && (
                          <span className="text-sm font-bold text-gray-900">
                            {items.filter(i => !i.isLoose).reduce((s, i) => s + i.packCount, 0)} Pack{items.filter(i => !i.isLoose).reduce((s, i) => s + i.packCount, 0) !== 1 ? "s" : ""}
                          </span>
                        )}
                        {hasLooseItems && (
                          <>
                            {hasPackItems && <div className="h-4 w-px bg-gray-300" />}
                            <span className="text-sm font-bold text-gray-900">
                              {items.filter(i => i.isLoose).reduce((s, i) => s + i.packCount, 0).toFixed(1)} KG Loose
                            </span>
                          </>
                        )}
                        <div className="h-4 w-px bg-gray-300" />
                        <span className="text-sm text-gray-600 font-medium">{totalWeightKg} KG Total</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {items.length === 0 && !hasActiveFilters && (
                  <div className="flex flex-col items-center py-16 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                      <Package size={28} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-600">No items added yet</p>
                    <p className="text-sm text-gray-400 mt-1 max-w-xs">
                      Search or filter products above to add items to your carton
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ─── Step 3: Define Carton ─── */}
            {step === 3 && (
              <div className="space-y-8">
                {/* Carton Templates */}
                {configs.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold text-gray-900">Carton Template</Label>
                      <p className="text-xs text-gray-500 mt-0.5">Choose a predefined template or continue with custom settings</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {configs.map((c: any) => {
                        const sel = selectedConfigId === c.id;
                        return (
                          <div
                            key={c.id}
                            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                              sel
                                ? "border-gray-900 bg-gray-50 shadow-sm"
                                : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                            }`}
                            onClick={() => {
                              setSelectedConfigId(sel ? null : c.id);
                              if (!sel && c.cartonPrice) setCartonPrice(c.cartonPrice);
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                    sel ? "bg-gray-900 border-gray-900" : "border-gray-300"
                                  }`}
                                >
                                  {sel && <Check size={12} className="text-white" />}
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 text-sm">
                                    {c.label || `${c.packsPerCarton} Pack Carton`}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {c.packsPerCarton} pcs · {c.cartonWeightKg} KG
                                  </p>
                                </div>
                              </div>
                              <span className="text-base font-bold text-gray-900 tabular-nums">
                                ৳{Number(c.cartonPrice).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Weight Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <Weight size={18} className="text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">Carton Weight</span>
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium uppercase">
                        Auto
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-gray-900 tabular-nums">{totalWeightKg} KG</p>
                    <p className="text-sm text-gray-500 mt-2">
                      {items.map((i) => `${i.weightKg}KG × ${i.packCount}`).join(" + ")} = {totalWeightKg} KG
                    </p>
                  </div>

                  {/* Storage Location */}
                  <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-4">
                      <MapPin size={18} className="text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">Storage Location</span>
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium uppercase">
                        Optional
                      </span>
                    </div>
                    <Select value={storageAreaId} onValueChange={setStorageAreaId}>
                      <SelectTrigger className="h-11 bg-white border-gray-200">
                        <SelectValue placeholder="Select storage area" />
                      </SelectTrigger>
                      <SelectContent>
                        {areas.map((a: any) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Step 4: Generate ID ─── */}
            {step === 4 && (
              <div className="max-w-2xl space-y-6">
                {/* ID Preview */}
                <div className="p-8 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
                    <QrCode size={24} className="text-gray-500" />
                  </div>
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-2">Carton ID</p>
                  <p className="text-3xl font-mono font-bold text-gray-900 tracking-wider">
                    {nextCartonId}
                  </p>
                  <p className="text-sm text-gray-500 mt-3">This ID will be assigned when you create the carton</p>
                </div>

                {/* Barcode option */}
                <label className="flex items-center gap-4 p-5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateBarcode}
                    onChange={(e) => setGenerateBarcode(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Generate Barcode / QR Code</p>
                    <p className="text-xs text-gray-500 mt-0.5">Automatically generate for label printing and scanning</p>
                  </div>
                </label>

                {/* Note */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Notes <span className="text-gray-400 font-normal">(Optional)</span>
                  </Label>
                  <Textarea
                    placeholder="Add any internal notes about this carton..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                    className="resize-none bg-gray-50 border-gray-200 focus:bg-white"
                  />
                </div>
              </div>
            )}

            {/* ─── Step 5: Preview & Pricing ─── */}
            {step === 5 && (
              <div className="space-y-8">
                {/* Carton Summary */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  {/* Left: Carton Details */}
                  <div className="lg:col-span-3 space-y-6">
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Carton ID</p>
                          <p className="text-sm font-mono font-bold text-gray-900 mt-0.5">
                            {nextCartonId}
                          </p>
                        </div>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold">
                          Draft
                        </span>
                      </div>
                      <div className="px-6 py-5">
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">Contents</p>
                        <div className="space-y-3">
                          {items.map((item) => (
                            <div key={item.variantId} className="flex items-center justify-between py-2">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                  {item.image ? (
                                    <Image src={item.image} alt={item.productName} width={36} height={36} className="w-full h-full object-cover" />
                                  ) : (
                                    <Package size={16} className="text-gray-400" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm font-semibold text-gray-900">{item.productName}</p>
                                    {item.brandName && (
                                      <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                                        {item.brandName}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500">{item.variantLabel.split(" · ")[0]}</p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-gray-900 tabular-nums">
                                {item.isLoose ? `${item.packCount} KG` : `x ${item.packCount}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-700">Carton Total</span>
                          <div className="flex items-center gap-4">
                            {hasPackItems && (
                              <span className="text-sm font-bold text-gray-900">
                                {items.filter(i => !i.isLoose).reduce((s, i) => s + i.packCount, 0)} pcs
                              </span>
                            )}
                            {hasLooseItems && (
                              <>
                                {hasPackItems && <div className="h-4 w-px bg-gray-300" />}
                                <span className="text-sm font-bold text-gray-900">
                                  {items.filter(i => i.isLoose).reduce((s, i) => s + i.packCount, 0).toFixed(1)} KG
                                </span>
                              </>
                            )}
                            <div className="h-4 w-px bg-gray-300" />
                            <span className="text-sm font-bold text-gray-900">{totalWeightKg} KG</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Pricing */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border border-gray-200 p-6 space-y-5">
                      <p className="text-sm font-semibold text-gray-900">Pricing</p>

                      <div>
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">Carton Price (৳)</Label>
                        <Input
                          type="number"
                          placeholder={selectedConfig?.cartonPrice || "0"}
                          value={cartonPrice}
                          onChange={(e) => setCartonPrice(e.target.value)}
                          className="h-11 bg-gray-50 border-gray-200"
                        />
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Pack Value Breakdown
                        </p>
                        <div className="space-y-2.5">
                          {items.map((item) => (
                            <div key={item.variantId} className="flex justify-between text-sm">
                              <span className="text-gray-600">
                                {item.productName} × {item.packCount}
                              </span>
                              <span className="font-semibold text-gray-900 tabular-nums">
                                ৳{(item.packCount * item.price).toLocaleString()}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm pt-3 border-t border-gray-100">
                            <span className="text-gray-700 font-semibold">Total Pack Value</span>
                            <span className="font-bold text-gray-900 tabular-nums">
                              ৳{Number(totalLoosePrice).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <Label className="text-xs font-medium text-gray-600 mb-2 block">Delivery Cost (৳)</Label>
                        <Input
                          type="number"
                          placeholder={selectedConfig?.deliveryCostPerCarton || "0"}
                          value={deliveryCost}
                          onChange={(e) => setDeliveryCost(e.target.value)}
                          className="h-11 bg-gray-50 border-gray-200"
                        />
                      </div>
                    </div>

                    {/* Rules Notice */}
                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={16} className="text-amber-600" />
                        <p className="text-sm font-semibold text-amber-800">Important</p>
                      </div>
                      <ul className="text-sm text-amber-700 space-y-1.5 ml-6 list-disc">
                        <li>Carton price can be edited after creation</li>
                        <li>Stock will be auto-deducted from inventory</li>
                        <li>Linked with inventory tracking system</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-8 pb-6">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            className="gap-2 h-11 px-6 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Previous
          </Button>
          <div className="flex gap-3">
            {step < 5 ? (
              <Button
                onClick={() => {
                  const nextStep = step + 1;
                  // Auto-populate carton price with total pack value when entering Preview
                  if (nextStep === 5 && !cartonPrice) {
                    setCartonPrice(totalLoosePrice);
                  }
                  setStep(nextStep);
                }}
                disabled={!canNext()}
                className="gap-2 h-11 px-8 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white"
              >
                Next <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canNext() || createMutation.isPending}
                className="gap-2 h-11 px-8 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <PackagePlus size={16} />
                {createMutation.isPending ? "Creating..." : "Create Carton"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
