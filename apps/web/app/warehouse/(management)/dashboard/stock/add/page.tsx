"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Box,
  Check,
  ChevronRight,
  Loader,
  Package,
  Plus,
  Search,
  Tag,
  Truck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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

// ============================================================
// Main Component
// ============================================================

export default function AddStockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Step 1 — Product search
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductResult | null>(
    null,
  );

  // Step 2 — Variant
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(
    null,
  );

  // Step 3 — Entry type & quantity
  const [entryType, setEntryType] = useState<"loose" | "pack">("pack");
  const [quantity, setQuantity] = useState("");

  // Step 4 — Supplier & cost
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [costType, setCostType] = useState<"per_kg" | "per_pack">("per_pack");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [reference, setReference] = useState("");

  // Step 5 — Batch/Expiry
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [manufactureDate, setManufactureDate] = useState("");

  // Step 6 — Storage Location
  const [storageAreaId, setStorageAreaId] = useState<number | null>(null);
  const [shelfRack, setShelfRack] = useState("");
  const [showCreateAreaDialog, setShowCreateAreaDialog] = useState(false);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaDescription, setNewAreaDescription] = useState("");

  const [note, setNote] = useState("");

  // === Queries ===

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ["warehouse", "getWarehouseProductsForStock", { search: productSearch }],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseProductsForStock.call({
        search: productSearch || undefined,
        limit: 20,
      }),
    enabled: true,
  });

  const products: ProductResult[] = productsData?.products ?? [];

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

  // Auto-conversions
  const conversions = useMemo(() => {
    if (!selectedVariant || !quantity || parseFloat(quantity) <= 0) {
      return { kg: 0, packs: 0 };
    }
    const qty = parseFloat(quantity);
    const packWeight = parseFloat(selectedVariant.weightKg);

    if (entryType === "loose") {
      return {
        kg: qty,
        packs: packWeight > 0 ? qty / packWeight : 0,
      };
    } else {
      return {
        packs: qty,
        kg: qty * packWeight,
      };
    }
  }, [selectedVariant, quantity, entryType]);

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
    } else {
      return {
        perPack: price,
        perKg: packWeight > 0 ? price / packWeight : 0,
        total: price * conversions.packs,
      };
    }
  }, [selectedVariant, purchasePrice, costType, conversions]);

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

    // Auto-set entry type based on core product support
    if (product.coreProduct?.supportsPack && !product.coreProduct?.supportsLoose) {
      setEntryType("pack");
    } else if (!product.coreProduct?.supportsPack && product.coreProduct?.supportsLoose) {
      setEntryType("loose");
    }
  };

  const handleSubmit = () => {
    if (!selectedVariant) {
      toast.error("Please select a variant");
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error("Please enter a quantity");
      return;
    }
    if (!supplierId) {
      toast.error("Please select a supplier");
      return;
    }
    if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
      toast.error("Please enter a purchase price");
      return;
    }

    addStockMutation.mutate({
      variantId: selectedVariant.id,
      entryType,
      quantity,
      quantityUnit: entryType === "loose" ? "KG" : "Pack",
      supplierId,
      costType,
      purchasePrice,
      reference: reference || undefined,
      batchNo: batchNo || undefined,
      expiryDate: expiryDate || undefined,
      manufactureDate: manufactureDate || undefined,
      storageAreaId: storageAreaId || undefined,
      shelfRack: shelfRack || undefined,
      note: note || undefined,
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
                disabled={isPending || !selectedVariant}
              >
                {isPending && (
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Check className="mr-2 h-4 w-4" />
                Confirm & Add Stock
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── Step 1: Select Product ── */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    1
                  </div>
                  <CardTitle className="text-base">Select Product</CardTitle>
                </div>
                <CardDescription>
                  Search and select a product to add stock for
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
                      ✓ Selected
                    </Badge>
                  </div>
                ) : (
                  <div className="max-h-[250px] overflow-y-auto space-y-1">
                    {loadingProducts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : products.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        {productSearch
                          ? "No products match your search"
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
                              {p.coreProduct?.name}
                              {p.brand ? ` · ${p.brand.name}` : ""}
                              {" · "}
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

            {/* ── Step 2: Select Variant ── */}
            {selectedProduct && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      2
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
                      {selectedProduct.variants.map((v) => (
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
                        <span className="text-muted-foreground text-xs">
                          SKU
                        </span>
                        <p className="font-mono text-xs">
                          {selectedVariant.sku || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Unit
                        </span>
                        <p>KG</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Pack Size
                        </span>
                        <p>{selectedVariant.unitLabel}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">
                          Brand
                        </span>
                        <p>{selectedVariant.brand?.name || "—"}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Step 3: Entry Type & Quantity ── */}
            {selectedVariant && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      3
                    </div>
                    <CardTitle className="text-base">
                      Entry Type & Quantity
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Entry type radio */}
                  <div className="flex gap-3">
                    {supportsLoose && (
                      <label
                        className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${entryType === "loose"
                          ? "bg-primary/5 border-primary/30"
                          : "hover:bg-muted/50"
                          }`}
                      >
                        <input
                          type="radio"
                          name="entryType"
                          value="loose"
                          checked={entryType === "loose"}
                          onChange={() => setEntryType("loose")}
                          className="accent-primary"
                        />
                        <div>
                          <p className="text-sm font-medium">Loose Entry</p>
                          <p className="text-xs text-muted-foreground">
                            Enter quantity in KG
                          </p>
                        </div>
                      </label>
                    )}
                    {supportsPack && (
                      <label
                        className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${entryType === "pack"
                          ? "bg-primary/5 border-primary/30"
                          : "hover:bg-muted/50"
                          }`}
                      >
                        <input
                          type="radio"
                          name="entryType"
                          value="pack"
                          checked={entryType === "pack"}
                          onChange={() => setEntryType("pack")}
                          className="accent-primary"
                        />
                        <div>
                          <p className="text-sm font-medium">Pack Entry</p>
                          <p className="text-xs text-muted-foreground">
                            Enter number of packs
                          </p>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Quantity input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>
                        {entryType === "loose"
                          ? "Quantity (KG)"
                          : "Number of Packs"}
                      </FieldLabel>
                      <Input
                        type="number"
                        step="0.01"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder={
                          entryType === "loose" ? "e.g. 100" : "e.g. 50"
                        }
                      />
                    </Field>

                    {/* Auto conversion */}
                    {quantity && parseFloat(quantity) > 0 && (
                      <div className="flex flex-col justify-center p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">
                          Auto Conversion
                        </p>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          = {conversions.packs.toFixed(2)} Pack
                          {conversions.packs !== 1 ? "s" : ""}
                        </p>
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                          = {conversions.kg.toFixed(2)} KG
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Step 4: Supplier & Cost ── */}
            {selectedVariant && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      4
                    </div>
                    <CardTitle className="text-base">Supplier & Cost</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Supplier *</FieldLabel>
                      <Select
                        value={supplierId ? String(supplierId) : ""}
                        onValueChange={(v) => setSupplierId(Number(v))}
                      >
                        <SelectTrigger>
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

                    <Field>
                      <FieldLabel>Reference / Invoice No</FieldLabel>
                      <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="e.g. INV-001"
                      />
                    </Field>
                  </div>

                  {/* Cost type radio */}
                  <div className="flex gap-3">
                    <label
                      className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${costType === "per_kg"
                        ? "bg-primary/5 border-primary/30"
                        : "hover:bg-muted/50"
                        }`}
                    >
                      <input
                        type="radio"
                        name="costType"
                        value="per_kg"
                        checked={costType === "per_kg"}
                        onChange={() => setCostType("per_kg")}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">Per KG</span>
                    </label>
                    <label
                      className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${costType === "per_pack"
                        ? "bg-primary/5 border-primary/30"
                        : "hover:bg-muted/50"
                        }`}
                    >
                      <input
                        type="radio"
                        name="costType"
                        value="per_pack"
                        checked={costType === "per_pack"}
                        onChange={() => setCostType("per_pack")}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">Per Pack</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>
                        Purchase Price (৳{" "}
                        {costType === "per_kg" ? "/ KG" : "/ Pack"}) *
                      </FieldLabel>
                      <Input
                        type="number"
                        step="0.01"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(e.target.value)}
                        placeholder="e.g. 350"
                      />
                    </Field>

                    {purchasePrice && parseFloat(purchasePrice) > 0 && (
                      <div className="flex flex-col justify-center p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">
                          Price Conversion
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          Per KG: ৳ {costConversions.perKg.toFixed(2)}
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          Per Pack: ৳ {costConversions.perPack.toFixed(2)}
                        </p>
                        {conversions.kg > 0 && (
                          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mt-1">
                            Total: ৳{" "}
                            {costConversions.total.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Step 5: Batch & Expiry ── */}
            {selectedVariant &&
              selectedProduct &&
              (selectedProduct.trackingType !== "none" ||
                selectedProduct.expiryEnabled) && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
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

            {/* ── Step 6: Storage Location ── */}
            {selectedVariant && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        6
                      </div>
                      <CardTitle className="text-base">
                        Storage Location
                      </CardTitle>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateAreaDialog(true)}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      New Area
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>Storage Area</FieldLabel>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Select storage area..." />
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
                              + Create New Area
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-muted-foreground font-normal"
                          onClick={() => setShowCreateAreaDialog(true)}
                        >
                          No storage areas — click to create one
                        </Button>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel>Shelf / Rack</FieldLabel>
                      <Input
                        value={shelfRack}
                        onChange={(e) => setShelfRack(e.target.value)}
                        placeholder="e.g. A-01, Rack 3B"
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

          {/* Sidebar — Summary */}
          <div className="space-y-6">
            <Card className="sticky top-20">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Product</p>
                  <p className="text-sm font-medium">
                    {selectedProduct?.name || "—"}
                  </p>
                </div>

                <Separator />

                {/* Variant */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Variant</p>
                  <p className="text-sm font-medium">
                    {selectedVariant
                      ? `${selectedVariant.brand?.name ? selectedVariant.brand.name + " · " : ""}${selectedVariant.unitLabel} (${selectedVariant.weightKg} KG)`
                      : "—"}
                  </p>
                </div>

                <Separator />

                {/* Entry Type */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Entry Type
                  </p>
                  <p className="text-sm font-medium capitalize">{entryType}</p>
                </div>

                <Separator />

                {/* Quantities */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Total Quantity
                  </p>
                  {conversions.kg > 0 || conversions.packs > 0 ? (
                    <>
                      <p className="text-sm font-semibold">
                        {conversions.packs.toFixed(2)} Packs
                      </p>
                      <p className="text-sm font-semibold">
                        {conversions.kg.toFixed(2)} KG
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>

                <Separator />

                {/* Cost */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Cost Summary
                  </p>
                  {costConversions.total > 0 ? (
                    <>
                      <p className="text-sm">
                        Rate: ৳ {parseFloat(purchasePrice).toFixed(2)}{" "}
                        {costType === "per_kg" ? "/ KG" : "/ Pack"}
                      </p>
                      <p className="text-lg font-bold text-primary mt-1">
                        Total: ৳{" "}
                        {costConversions.total.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>

                <Separator />

                {/* Supplier */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Supplier</p>
                  <p className="text-sm font-medium">
                    {supplierId
                      ? suppliers.find((s: any) => s.id === supplierId)?.name ||
                      "—"
                      : "—"}
                  </p>
                </div>

                {/* Action */}
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={isPending || !selectedVariant}
                >
                  {isPending && (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  <Check className="mr-2 h-4 w-4" />
                  Confirm & Add Stock
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Create Storage Area Dialog ── */}
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
