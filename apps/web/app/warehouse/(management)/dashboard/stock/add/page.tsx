"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Box,
  BoxSelect,
  CalendarIcon,
  Check,
  ChevronRight,
  Loader,
  Package,
  Plus,
  Scale,
  Search,
  Tag,
  Trash2,
  Truck,
  Wallet,
  Weight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

// ============================================================
// Types
// ============================================================

type ProductResult = {
  id: number;
  name: string;
  image: string;
  trackingType: string;
  expiryEnabled: boolean;
  categoryId: number;
  subCategoryId: number | null;
  category?: { id: number; name: string } | null;
  subCategory?: { id: number; name: string } | null;
  brand?: { id: number; name: string } | null;
  coreProduct?: {
    id: number;
    name: string;
    supportsPack: boolean;
    supportsLoose: boolean;
  } | null;
  variants: {
    id: number;
    sku: string | null;
    unitLabel: string;
    weightKg: string;
    price: string;
    brandId: number | null;
    packType: string | null;
    brand?: { id: number; name: string } | null;
  }[];
};

type SelectedVariant = ProductResult["variants"][0];

/** One row in the multi-item stock entry table */
type StockItem = {
  id: number;
  productName: string;
  productImage: string;
  variantId: number;
  variantLabel: string;
  sku: string;
  weightKg: number;
  brandName: string;
  entryType: "loose" | "pack" | "carton";
  quantity: number;        // packs, KG, or carton count
  costType: "per_kg" | "per_pack" | "per_carton";
  purchasePrice: number;
  // Carton-specific (inline definition -- no cartonConfig)
  cartonConfigId: number | null;
  packsPerCarton: number;
  cartonSource: "packs" | "loose";
  kgPerCarton: number;
  cartonCount: number;
  // Pre-computed
  totalKg: number;
  totalPacks: number;
  totalCost: number;
};

// ============================================================
// Main Component
// ============================================================

export default function AddStockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Step 1 -- Product search
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(
    null,
  );

  // Product filters
  const [filterCategoryId, setFilterCategoryId] = useState<number | undefined>();
  const [filterSubCategoryId, setFilterSubCategoryId] = useState<number | undefined>();

  // Step 2 -- Variant
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    null,
  );

  // Step 1 -- Entry mode (drives everything below)
  const [entryType, setEntryType] = useState<"loose" | "pack" | "carton">("pack");

  // Step 2/3 -- Product search & Variant
  const [quantity, setQuantity] = useState("");
  // Carton-specific (inline definition -- no cartonConfig)
  const [cartonSource, setCartonSource] = useState<"packs" | "loose">("packs");
  const [packsPerCarton, setPacksPerCarton] = useState("");
  const [kgPerCarton, setKgPerCarton] = useState("");
  const [cartonCount, setCartonCount] = useState("");

  // Payment & Supplier (top-level header -- shared across all items)
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [paymentAccount, setPaymentAccount] = useState<"cash" | "bank">("cash");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [reference, setReference] = useState("");
  const [storageAreaId, setStorageAreaId] = useState<number | null>(null);
  const [shelfRack, setShelfRack] = useState("");
  const [showCreateAreaDialog, setShowCreateAreaDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDescription, setNewAreaDescription] = useState("");

  // Cost
  const [costType, setCostType] = useState<"per_kg" | "per_pack" | "per_carton">("per_pack");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [vatTax, setVatTax] = useState("");

  // Batch/Expiry
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");

  const [note, setNote] = useState("");

  // === Multi-row items table ===
  const itemIdRef = useRef(0);
  const [items, setItems] = useState<StockItem[]>([]);

  // === Queries ===

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ["warehouse", "getWarehouseProductsForStock", { search: productSearch, categoryId: filterCategoryId, subCategoryId: filterSubCategoryId }],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({
        search: productSearch || undefined,
        categoryId: filterCategoryId,
        subCategoryId: filterSubCategoryId,
        limit: 50,
      }),
    enabled: true,
  });

  const products: ProductResult[] = productsData?.products ?? [];

  // Derive filter options from all products (unfiltered fetch for options)
  const { data: allProductsData } = useQuery({
    queryKey: ["warehouse", "getWarehouseProductsForStock", { forFilters: true }],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({ limit: 500 }),
  });
  const allProducts: ProductResult[] = allProductsData?.products ?? [];

  const categoryOptions = useMemo(() => {
    const map = new Map<number, string>();
    allProducts.forEach(p => { if (p.category) map.set(p.category.id, p.category.name); });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts]);

  const subCategoryOptions = useMemo(() => {
    const map = new Map<number, string>();
    allProducts
      .filter(p => !filterCategoryId || p.categoryId === filterCategoryId)
      .forEach(p => { if (p.subCategory) map.set(p.subCategory.id, p.subCategory.name); });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts, filterCategoryId]);

  const { data: suppliersData } = useQuery({
    queryKey: ["warehouse", "getSuppliers"],
    queryFn: () => (orpc.warehouse as any).getSuppliers.call({}),
  });

  const suppliers: any[] = suppliersData?.suppliers ?? [];

  const { data: storageAreasData } = useQuery({
    queryKey: ["warehouse", "getStorageAreas"],
    queryFn: () => (orpc.warehouse as any).getStorageAreas.call({}),
  });

  const storageAreas: any[] = storageAreasData?.areas ?? [];

  // === Derived state ===

  const selectedVariant: SelectedVariant | null = useMemo(() => {
    if (!selectedProduct || !selectedVariantId) return null;
    return (
      selectedProduct.variants.find((v) => v.id === selectedVariantId) ?? null
    );
  }, [selectedProduct, selectedVariantId]);

  const supportsPack = selectedProduct?.coreProduct?.supportsPack ?? true;
  const supportsLoose = selectedProduct?.coreProduct?.supportsLoose ?? false;

  // Filter variants based on entry mode
  const filteredVariants = useMemo(() => {
    if (!selectedProduct) return [];
    const variants = selectedProduct.variants;
    if (entryType === "loose") {
      // Only show loose variants
      return variants.filter((v) => v.packType === "loose");
    }
    if (entryType === "pack") {
      // Only show pack variants (packType = "packet" or "pack")
      return variants.filter((v) => v.packType !== "loose");
    }
    if (entryType === "carton") {
      // Cartons are assembled from packs -- show pack variants
      // (if cartonSource is "loose", show loose variants instead)
      if (cartonSource === "loose") {
        return variants.filter((v) => v.packType === "loose");
      }
      return variants.filter((v) => v.packType !== "loose");
    }
    return variants;
  }, [selectedProduct, entryType, cartonSource]);

  // Auto-conversions
  const conversions = useMemo(() => {
    if (!selectedVariant) return { kg: 0, packs: 0, cartons: 0 };
    const packWeight = parseFloat(selectedVariant.weightKg);

    if (entryType === "carton") {
      const cCount = parseInt(cartonCount) || 0;
      if (cCount <= 0) return { kg: 0, packs: 0, cartons: cCount };

      if (cartonSource === "loose") {
        const kgPer = parseFloat(kgPerCarton) || 0;
        const totalKg = kgPer * cCount;
        const totalPacks = packWeight > 0 ? totalKg / packWeight : 0;
        return { kg: totalKg, packs: totalPacks, cartons: cCount };
      } else {
        const ppCarton = parseInt(packsPerCarton) || 0;
        const packs = cCount * ppCarton;
        return { kg: packs * packWeight, packs, cartons: cCount };
      }
    }

    if (!quantity || parseFloat(quantity) <= 0) return { kg: 0, packs: 0, cartons: 0 };
    const qty = parseFloat(quantity);

    if (entryType === "loose") {
      const packsFromLoose = packWeight > 0 ? qty / packWeight : 0;
      return { kg: qty, packs: packsFromLoose, cartons: 0 };
    } else {
      return { packs: qty, kg: qty * packWeight, cartons: 0 };
    }
  }, [selectedVariant, quantity, entryType, cartonCount, cartonSource, packsPerCarton, kgPerCarton]);

  // Cost auto-conversion
  const costConversions = useMemo(() => {
    if (!selectedVariant || !purchasePrice || parseFloat(purchasePrice) <= 0) {
      return { perKg: 0, perPack: 0, total: 0 };
    }
    const price = parseFloat(purchasePrice);
    const packWeight = parseFloat(selectedVariant.weightKg);

    if (costType === "per_kg") {
      return {
        perKg: price,
        perPack: price * packWeight,
        total: price * conversions.kg,
      };
    } else if (costType === "per_carton") {
      const cCount = parseInt(cartonCount) || 0;
      const ppCarton = cartonSource === "loose" ? 1 : (parseInt(packsPerCarton) || 1);
      return {
        perPack: price / ppCarton,
        perKg: packWeight > 0 ? price / (ppCarton * packWeight) : 0,
        total: price * cCount,
      };
    } else {
      return {
        perPack: price,
        perKg: packWeight > 0 ? price / packWeight : 0,
        total: price * conversions.packs,
      };
    }
  }, [selectedVariant, purchasePrice, costType, conversions, cartonCount, cartonSource, packsPerCarton]);

  // Aggregate totals from items table
  const itemsSubtotal = useMemo(() => items.reduce((sum, item) => sum + item.totalCost, 0), [items]);
  const itemsTotalKg = useMemo(() => items.reduce((sum, item) => sum + item.totalKg, 0), [items]);
  const itemsTotalPacks = useMemo(() => items.reduce((sum, item) => sum + item.totalPacks, 0), [items]);
  const grandTotal = useMemo(() => {
    return itemsSubtotal - (parseFloat(discount) || 0) + (parseFloat(vatTax) || 0);
  }, [itemsSubtotal, discount, vatTax]);

  // === Mutation ===

  const addStockMutation = useMutation({
    mutationFn: (data: any) =>
      (orpc.warehouse as any).addStockEntry.call(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success("Stock added successfully!");
      router.push("/warehouse/dashboard/stock");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to add stock");
    },
  });

  const createAreaMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      (orpc.warehouse as any).createStorageArea.call(data),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "getStorageAreas"] });
      setStorageAreaId(result.area.id);
      setShowCreateAreaDialog(false);
      setNewAreaName("");
      setNewAreaDescription("");
      toast.success("Storage area created!");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create storage area");
    },
  });

  // === Handlers ===

  const handleSelectProduct = (product: ProductResult) => {
    setSelectedProduct(product);
    setSelectedVariantId(null);
    setQuantity("");
  };

  const handleAddItem = useCallback(() => {
    if (!selectedVariant || !selectedProduct) {
      toast.error("Please select a product and variant");
      return;
    }
    if (entryType === "carton") {
      if (!cartonCount || parseInt(cartonCount) <= 0) {
        toast.error("Please enter number of cartons");
        return;
      }
      if (cartonSource === "packs" && (!packsPerCarton || parseInt(packsPerCarton) <= 0)) {
        toast.error("Please enter packs per carton");
        return;
      }
      if (cartonSource === "loose" && (!kgPerCarton || parseFloat(kgPerCarton) <= 0)) {
        toast.error("Please enter KG per carton");
        return;
      }
    } else if (!quantity || parseFloat(quantity) <= 0) {
      toast.error("Please enter a quantity");
      return;
    }
    if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
      toast.error("Please enter a purchase price");
      return;
    }

    const newItem: StockItem = {
      id: ++itemIdRef.current,
      productName: selectedProduct.name,
      productImage: selectedProduct.image || "",
      variantId: selectedVariant.id,
      variantLabel: selectedVariant.unitLabel,
      sku: selectedVariant.sku || "",
      weightKg: parseFloat(selectedVariant.weightKg),
      brandName: selectedVariant.brand?.name || "",
      entryType,
      quantity: entryType === "carton" ? parseInt(cartonCount) : parseFloat(quantity),
      costType,
      purchasePrice: parseFloat(purchasePrice),
      cartonConfigId: null,
      packsPerCarton: entryType === "carton" ? (parseInt(packsPerCarton) || 0) : 0,
      cartonSource: cartonSource,
      kgPerCarton: entryType === "carton" ? (parseFloat(kgPerCarton) || 0) : 0,
      cartonCount: entryType === "carton" ? parseInt(cartonCount) : 0,
      totalKg: conversions.kg,
      totalPacks: conversions.packs,
      totalCost: costConversions.total,
    };

    setItems(prev => [...prev, newItem]);

    // Reset the add-item form
    setSelectedProduct(null);
    setSelectedVariantId(null);
    setQuantity("");
    setCartonCount("");
    setPacksPerCarton("");
    setKgPerCarton("");
    setPurchasePrice("");
    setProductSearch("");
    toast.success(`Added ${newItem.productName} to the list`);
  }, [selectedVariant, selectedProduct, entryType, quantity, cartonCount, purchasePrice, costType, cartonSource, packsPerCarton, kgPerCarton, conversions, costConversions]);

  const handleRemoveItem = useCallback((itemId: number) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const handleSubmit = () => {
    if (items.length === 0) {
      toast.error("Please add at least one item to the table");
      return;
    }

    // Build API payload for each item
    const submitItem = (item: StockItem) => {
      const effectiveQty = item.entryType === "carton"
        ? String(item.totalPacks || item.cartonCount)
        : String(item.quantity);

      return {
        variantId: item.variantId,
        entryType: item.entryType,
        quantity: effectiveQty,
        quantityUnit: item.entryType === "loose" ? "KG" : item.entryType === "carton" ? "Carton" : "Pack",
        supplierId: supplierId || undefined,
        costType: item.costType,
        purchasePrice: String(item.purchasePrice),
        reference: reference || undefined,
        batchNo: batchNo || undefined,
        expiryDate: expiryDate || undefined,
        manufactureDate: manufactureDate || undefined,
        storageAreaId: storageAreaId || undefined,
        shelfRack: shelfRack || undefined,
        note: note || undefined,
        // Inline carton definition (replaces cartonConfig)
        cartonCount: item.entryType === "carton" ? item.cartonCount : undefined,
        cartonSource: item.entryType === "carton" ? item.cartonSource : undefined,
        packsPerCarton: item.entryType === "carton" && item.cartonSource === "packs" ? item.packsPerCarton : undefined,
        kgPerCarton: item.entryType === "carton" && item.cartonSource === "loose" ? item.kgPerCarton : undefined,
        createCartonRecords: item.entryType === "carton" ? true : undefined,
      };
    };

    // Submit all items
    Promise.all(items.map(item =>
      (orpc.warehouse as any).addStockEntry.call(submitItem(item))
    )).then(() => {
      queryClient.invalidateQueries({ queryKey: ["warehouse"] });
      toast.success(`${items.length} item${items.length > 1 ? "s" : ""} added to stock!`);
      router.push("/warehouse/dashboard/stock");
    }).catch((err: any) => {
      toast.error(err?.message || "Failed to add stock");
    });
  };

  const isPending = addStockMutation.isPending;

  // === Render ===

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/warehouse/dashboard/stock">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Add Stock</h1>
                <p className="text-sm text-muted-foreground">
                  Add inventory to your warehouse
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/warehouse/dashboard/stock")}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || items.length === 0}
              >
                {isPending && (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Check className="mr-2 h-4 w-4" />
                Confirm & Add Stock ({items.length})
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* ------ Step 1: Entry Mode ------ */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <CardTitle className="text-base">Entry Mode</CardTitle>
            </div>
            <CardDescription>
              Select how you want to add stock -- this determines which products and fields are shown
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Loose Entry */}
              <button
                type="button"
                onClick={() => {
                  if (items.length > 0 && entryType !== "loose") {
                    if (!confirm("Switching mode will clear your current items. Continue?")) return;
                    setItems([]);
                  }
                  setEntryType("loose");
                  setCostType("per_kg");
                  setSelectedProduct(null);
                  setSelectedVariantId(null);
                  setQuantity("");
                }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  entryType === "loose"
                    ? "border-amber-500 bg-amber-50 shadow-sm"
                    : "border-gray-200 hover:border-amber-200 hover:bg-amber-50/30"
                }`}
              >
                <div className={`p-2.5 rounded-lg ${entryType === "loose" ? "bg-amber-100" : "bg-gray-100"}`}>
                  <Weight className={`h-5 w-5 ${entryType === "loose" ? "text-amber-600" : "text-gray-400"}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${entryType === "loose" ? "text-amber-800" : "text-gray-700"}`}>Loose Entry</p>
                  <p className="text-xs text-muted-foreground">Enter quantity in KG</p>
                </div>
              </button>

              {/* Pack Entry */}
              <button
                type="button"
                onClick={() => {
                  if (items.length > 0 && entryType !== "pack") {
                    if (!confirm("Switching mode will clear your current items. Continue?")) return;
                    setItems([]);
                  }
                  setEntryType("pack");
                  setCostType("per_pack");
                  setSelectedProduct(null);
                  setSelectedVariantId(null);
                  setQuantity("");
                }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  entryType === "pack"
                    ? "border-blue-500 bg-blue-50 shadow-sm"
                    : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/30"
                }`}
              >
                <div className={`p-2.5 rounded-lg ${entryType === "pack" ? "bg-blue-100" : "bg-gray-100"}`}>
                  <Package className={`h-5 w-5 ${entryType === "pack" ? "text-blue-600" : "text-gray-400"}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${entryType === "pack" ? "text-blue-800" : "text-gray-700"}`}>Pack Entry</p>
                  <p className="text-xs text-muted-foreground">Enter number of packs</p>
                </div>
              </button>

              {/* Carton Entry */}
              <button
                type="button"
                onClick={() => {
                  if (items.length > 0 && entryType !== "carton") {
                    if (!confirm("Switching mode will clear your current items. Continue?")) return;
                    setItems([]);
                  }
                  setEntryType("carton");
                  setCostType("per_carton");
                  setSelectedProduct(null);
                  setSelectedVariantId(null);
                  setQuantity("");
                }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${
                  entryType === "carton"
                    ? "border-emerald-500 bg-emerald-50 shadow-sm"
                    : "border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/30"
                }`}
              >
                <div className={`p-2.5 rounded-lg ${entryType === "carton" ? "bg-emerald-100" : "bg-gray-100"}`}>
                  <BoxSelect className={`h-5 w-5 ${entryType === "carton" ? "text-emerald-600" : "text-gray-400"}`} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${entryType === "carton" ? "text-emerald-800" : "text-gray-700"}`}>Carton Entry</p>
                  <p className="text-xs text-muted-foreground">New supplier cartons</p>
                </div>
              </button>
            </div>

            {/* Carton Source Sub-toggle */}
            {entryType === "carton" && (
              <div className="mt-4 p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Carton Source</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCartonSource("packs")}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      cartonSource === "packs"
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-emerald-50"
                    }`}
                  >
                    From Packs
                  </button>
                  <button
                    type="button"
                    onClick={() => setCartonSource("loose")}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      cartonSource === "loose"
                        ? "bg-emerald-600 text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-emerald-50"
                    }`}
                  >
                    From Loose (KG)
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* ------ Step 2: Select Product ------ */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    2
                  </div>
                  <CardTitle className="text-base">Select Product</CardTitle>
                </div>
                <CardDescription>
                  Search and select a product to add stock
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Category / SubCategory filters */}
                <div className="flex gap-2">
                  <Select
                    value={filterCategoryId ? String(filterCategoryId) : "all"}
                    onValueChange={(v) => {
                      setFilterCategoryId(v === "all" ? undefined : Number(v));
                      setFilterSubCategoryId(undefined);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {subCategoryOptions.length > 0 && (
                    <Select
                      value={filterSubCategoryId ? String(filterSubCategoryId) : "all"}
                      onValueChange={(v) => setFilterSubCategoryId(v === "all" ? undefined : Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All Sub-categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sub-categories</SelectItem>
                        {subCategoryOptions.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search your products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {selectedProduct ? (
                  <div
                    className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg cursor-pointer"
                    onClick={() => {
                      setSelectedProduct(null);
                      setSelectedVariantId(null);
                    }}
                  >
                    {selectedProduct.image && (
                      <Image
                        src={selectedProduct.image}
                        alt={selectedProduct.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-cover border"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {selectedProduct.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedProduct.coreProduct?.name}
                        {selectedProduct.brand
                          ? ` · ${selectedProduct.brand.name}`
                          : ""}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] shrink-0"
                    >
                      <Check className="mr-0.5 h-3 w-3" />
                      Selected
                    </Badge>
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-1">
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : products.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        {productSearch || filterCategoryId
                          ? "No products match your search or filters"
                          : "No products found. Create products from the catalog first."}
                      </div>
                    ) : (
                      products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/80 transition-colors cursor-pointer"
                          onClick={() => handleSelectProduct(p)}
                        >
                          {p.image && (
                            <Image
                              src={p.image}
                              alt={p.name}
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-md object-cover border"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {p.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {p.category?.name}
                              {p.subCategory ? ` > ${p.subCategory.name}` : ""}
                              {p.brand ? ` - ${p.brand.name}` : ""}
                              {" - "}
                              {p.variants.length} variant
                              {p.variants.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ------ Step 3: Select Variant ------ */}
            {selectedProduct && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      3
                    </div>
                    <CardTitle className="text-base">Select Variant</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={selectedVariantId ? String(selectedVariantId) : ""}
                    onValueChange={(v) => setSelectedVariantId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a variant..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredVariants.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.brand?.name ? `${v.brand.name} · ` : ""}
                          {v.unitLabel} ({v.weightKg} KG)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedVariant && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">SKU</span>
                        <p className="font-mono text-xs">{selectedVariant.sku || "--"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Weight</span>
                        <p>{selectedVariant.weightKg} KG</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Pack Size</span>
                        <p>{selectedVariant.unitLabel}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Brand</span>
                        <p>{selectedVariant.brand?.name || "--"}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ------ Step 4: Quantity & Carton Setup ------ */}
            {selectedVariant && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      4
                    </div>
                    <CardTitle className="text-base">
                      {entryType === "carton" ? "Carton Setup & Price" : "Quantity & Price"}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Carton inline definition */}
                  {entryType === "carton" && (
                    <div className="space-y-3 p-4 bg-emerald-50/50 border border-emerald-200 rounded-lg">
                      <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Carton Definition</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {cartonSource === "packs" ? (
                          <Field>
                            <FieldLabel>Packs Per Carton *</FieldLabel>
                            <Input
                              type="number"
                              step="1"
                              min="1"
                              value={packsPerCarton}
                              onChange={(e) => setPacksPerCarton(e.target.value)}
                              placeholder="e.g. 12"
                            />
                          </Field>
                        ) : (
                          <Field>
                            <FieldLabel>KG Per Carton *</FieldLabel>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={kgPerCarton}
                              onChange={(e) => setKgPerCarton(e.target.value)}
                              placeholder="e.g. 25"
                            />
                          </Field>
                        )}
                        <Field>
                          <FieldLabel>Number of Cartons *</FieldLabel>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            value={cartonCount}
                            onChange={(e) => setCartonCount(e.target.value)}
                            placeholder="e.g. 5"
                          />
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* Quantity input for non-carton */}
                  {entryType !== "carton" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel>
                          {entryType === "loose" ? "Quantity (KG)" : "Number of Packs"}
                        </FieldLabel>
                        <Input
                          type="number"
                          step="0.01"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder={entryType === "loose" ? "e.g. 100" : "e.g. 50"}
                        />
                      </Field>

                      {/* Auto conversion */}
                      {quantity && parseFloat(quantity) > 0 && (
                        <div className="flex flex-col justify-center p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">
                            Auto Conversion
                          </p>
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                            = {conversions.kg.toFixed(2)} KG
                          </p>
                          {entryType !== "loose" && (
                            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                              = {conversions.packs.toFixed(2)} Pack{conversions.packs !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Carton auto-conversion */}
                  {entryType === "carton" && parseInt(cartonCount) > 0 &&
                    ((cartonSource === "packs" && parseInt(packsPerCarton) > 0) ||
                     (cartonSource === "loose" && parseFloat(kgPerCarton) > 0)) && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">
                          Auto Conversion
                        </p>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          = {conversions.cartons} Carton{conversions.cartons !== 1 ? "s" : ""}
                        </p>
                        {cartonSource === "packs" && (
                          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                            = {conversions.packs.toFixed(0)} Total Packs
                          </p>
                        )}
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          = {conversions.kg.toFixed(2)} KG Total
                        </p>
                      </div>
                  )}

                  {/* Price + Add to Table */}
                  <Separator />
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Field>
                        <FieldLabel>
                          Purchase Price (৳{" "}
                          {costType === "per_kg" ? "/ KG" : costType === "per_carton" ? "/ Carton" : "/ Pack"})
                        </FieldLabel>
                        <div className="flex gap-2">
                          {entryType !== "carton" && (
                            <Select
                              value={costType}
                              onValueChange={(v) => setCostType(v as any)}
                            >
                              <SelectTrigger className="w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="per_kg">Per KG</SelectItem>
                                {entryType !== "loose" && <SelectItem value="per_pack">Per Pack</SelectItem>}
                              </SelectContent>
                            </Select>
                          )}
                          <Input
                            type="number"
                            step="0.01"
                            value={purchasePrice}
                            onChange={(e) => setPurchasePrice(e.target.value)}
                            placeholder={entryType === "carton" ? "e.g. 580 per carton" : "e.g. 350"}
                            className="flex-1"
                          />
                        </div>
                      </Field>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedVariant || !purchasePrice}
                      className="shrink-0"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add to Table
                    </Button>
                  </div>

                  {/* Inline price conversion hint */}
                  {purchasePrice && parseFloat(purchasePrice) > 0 && costConversions.total > 0 && (
                    <p className="text-xs text-muted-foreground">
                      = ৳{costConversions.perKg.toFixed(2)}/KG
                      {entryType !== "loose" && ` · ৳${costConversions.perPack.toFixed(2)}/Pack`}
                      {" "}· Total: ৳{costConversions.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}






            {/* ------ Items Table ------ */}
            {items.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Items ({items.length})</CardTitle>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setItems([])}>
                      Clear All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-b bg-muted/40">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product</th>
                          <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Variant</th>
                          <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Mode</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Qty</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Total KG</th>
                          <th className="text-right px-3 py-2.5 font-medium text-muted-foreground">Cost</th>
                          <th className="w-10 px-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium">{item.productName}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{item.brandName ? `${item.brandName} · ` : ""}{item.variantLabel}</td>
                            <td className="px-3 py-2.5 text-center"><Badge variant="secondary" className="text-xs capitalize">{item.entryType}</Badge></td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity} {item.entryType === "loose" ? "KG" : item.entryType === "carton" ? "Ctn" : "Pk"}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{item.totalKg.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums font-medium">৳{item.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="px-2 py-2.5">
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Cost Summary */}
                  <div className="border-t">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
                      <span className="text-sm text-muted-foreground">Subtotal ({items.length} items)</span>
                      <span className="text-sm font-medium tabular-nums">৳ {itemsSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 border-t">
                      <span className="text-sm text-muted-foreground">Discount</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">৳</span>
                        <input type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-1 focus:ring-primary/50 outline-none bg-background" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2 border-t">
                      <span className="text-sm text-muted-foreground">VAT / Tax</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">৳</span>
                        <input type="number" step="0.01" min="0" value={vatTax} onChange={(e) => setVatTax(e.target.value)} placeholder="0" className="w-24 px-2 py-1 text-sm text-right border rounded focus:ring-1 focus:ring-primary/50 outline-none bg-background" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-primary/5">
                      <span className="text-sm font-semibold">TOTAL</span>
                      <span className="text-lg font-bold text-primary tabular-nums">৳ {grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ------ Step 5: Batch & Expiry ------ */}
            {selectedVariant &&
              selectedProduct &&
              (selectedProduct.trackingType !== "none" ||
                selectedProduct.expiryEnabled) && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
                        5
                      </div>
                      <CardTitle className="text-base">
                        Batch & Expiry
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {selectedProduct.trackingType !== "none" && (
                        <Field>
                          <FieldLabel>Batch No</FieldLabel>
                          <Input
                            value={batchNo}
                            onChange={(e) => setBatchNo(e.target.value)}
                            placeholder="e.g. B-1001"
                          />
                        </Field>
                      )}
                      {selectedProduct.expiryEnabled && (
                        <Field>
                          <FieldLabel>Expiry Date</FieldLabel>
                          <Input
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                          />
                        </Field>
                      )}
                      <Field>
                        <FieldLabel>Manufacture Date</FieldLabel>
                        <Input
                          type="date"
                          value={manufactureDate}
                          onChange={(e) => setManufactureDate(e.target.value)}
                        />
                      </Field>
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Note */}
            {selectedVariant && (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Note (Optional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any additional notes about this stock entry..."
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar -- Supplier Info + Summary */}
          <div className="space-y-4">
            {/* ------ Payment & Supplier Info ------ */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm">Payment & Supplier</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Field>
                  <FieldLabel className="text-xs">Supplier / Payee</FieldLabel>
                  <Select
                    value={supplierId ? String(supplierId) : ""}
                    onValueChange={(v) => setSupplierId(Number(v))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                          {s.company ? ` (${s.company})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel className="text-xs">Payment</FieldLabel>
                    <Select
                      value={paymentAccount}
                      onValueChange={(v) => setPaymentAccount(v as "cash" | "bank")}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel className="text-xs">Date</FieldLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-8 justify-start text-left font-normal text-sm",
                            !paymentDate && "text-muted-foreground",
                          )}
                        >
                          {paymentDate ? (
                            format(paymentDate, "MMM d, yyyy")
                          ) : (
                            <span>Pick date</span>
                          )}
                          <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={paymentDate}
                          onSelect={(date) => setPaymentDate(date ?? new Date())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </Field>
                </div>

                <Field>
                  <FieldLabel className="text-xs">Reference / Invoice No</FieldLabel>
                  <Input
                    className="h-8 text-sm"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. INV-001"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel className="text-xs">Location</FieldLabel>
                    {storageAreas.length > 0 ? (
                      <Select
                        value={storageAreaId ? String(storageAreaId) : ""}
                        onValueChange={(v) => {
                          if (v === "__create__") {
                            setShowCreateAreaDialog(true);
                            return;
                          }
                          setStorageAreaId(Number(v));
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Location..." />
                        </SelectTrigger>
                        <SelectContent>
                          {storageAreas.map((a: any) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.name}
                            </SelectItem>
                          ))}
                          <SelectItem
                            value="__create__"
                            className="text-primary font-medium"
                          >
                            + Create New
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-8 justify-start text-muted-foreground font-normal text-sm"
                        onClick={() => setShowCreateAreaDialog(true)}
                      >
                        + Create
                      </Button>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel className="text-xs">Shelf / Rack</FieldLabel>
                    <Input
                      className="h-8 text-sm"
                      value={shelfRack}
                      onChange={(e) => setShelfRack(e.target.value)}
                      placeholder="e.g. A-01"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ------ Entry Summary ------ */}
            <Card className="sticky top-20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Entry Summary</CardTitle>
                {items.length > 0 && (
                  <CardDescription>{items.length} item{items.length > 1 ? "s" : ""} added</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Quick Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mb-0.5">Total Items</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums">{items.length}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mb-0.5">Total Weight</p>
                    <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{itemsTotalKg > 0 ? `${itemsTotalKg.toFixed(1)}` : "0"}<span className="text-xs font-medium ml-0.5">KG</span></p>
                  </div>
                </div>

                {itemsTotalPacks > 0 && (
                  <div className="flex items-center justify-between text-sm px-1">
                    <span className="text-muted-foreground">Total Packs</span>
                    <span className="font-semibold tabular-nums">{itemsTotalPacks.toFixed(0)}</span>
                  </div>
                )}

                {/* Items Mini List */}
                {items.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Items</p>
                      {items.map((item, idx) => (
                        <div key={item.id} className="flex items-center justify-between text-sm gap-2">
                          <span className="truncate text-muted-foreground">
                            <span className="text-foreground font-medium">{idx + 1}.</span> {item.productName}
                          </span>
                          <span className="shrink-0 tabular-nums font-medium">৳{item.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Cost Breakdown */}
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">{itemsSubtotal > 0 ? `৳ ${itemsSubtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "--"}</span>
                  </div>
                  {(parseFloat(discount) || 0) > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount</span>
                      <span className="tabular-nums">- ৳ {parseFloat(discount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  {(parseFloat(vatTax) || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT / Tax</span>
                      <span className="tabular-nums">+ ৳ {parseFloat(vatTax).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="p-3 -mx-1 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Grand Total</span>
                    <span className="text-xl font-bold text-primary tabular-nums">
                      ৳ {grandTotal > 0 ? grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                    </span>
                  </div>
                </div>

                {/* Action */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isPending || items.length === 0}
                >
                  {isPending && (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Check className="mr-2 h-4 w-4" />
                  {items.length === 0 ? "Add items to continue" : `Confirm & Add Stock (${items.length})`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ------ Create Storage Area Dialog ------ */}
      <Dialog open={showCreateAreaDialog} onOpenChange={setShowCreateAreaDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Storage Area</DialogTitle>
            <DialogDescription>
              Add a new storage area for your warehouse (e.g. Main Warehouse,
              Cold Storage, Dry Store).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel>Name *</FieldLabel>
              <Input
                value={newAreaName}
                onChange={(e) => setNewAreaName(e.target.value)}
                placeholder="e.g. Main Warehouse"
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel>Description (Optional)</FieldLabel>
              <Input
                value={newAreaDescription}
                onChange={(e) => setNewAreaDescription(e.target.value)}
                placeholder="e.g. Ground floor, 500 sqft dry storage"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateAreaDialog(false)}
              disabled={createAreaMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newAreaName.trim()) {
                  toast.error("Please enter a name");
                  return;
                }
                createAreaMutation.mutate({
                  name: newAreaName.trim(),
                  description: newAreaDescription.trim() || undefined,
                });
              }}
              disabled={createAreaMutation.isPending || !newAreaName.trim()}
            >
              {createAreaMutation.isPending && (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
