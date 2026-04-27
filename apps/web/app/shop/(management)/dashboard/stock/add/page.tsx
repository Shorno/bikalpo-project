"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, ChevronRight, Loader, Package, Plus,
  Search, Tag, Box,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  useShopProductsForStock,
  useAddShopStock,
} from "@/hooks/use-shop-owner-api";

// ─── Types ───────────────────────────────────────────────────────

type StockType = "purchase" | "return" | "adjustment" | "opening";

type Product = {
  id: number;
  name: string;
  image: string | null;
  category: { id: number; name: string } | null;
  variants: {
    variantId: number;
    inventoryId: number;
    unitLabel: string;
    weightKg: string;
    brandName: string | null;
    currentStock: number;
    retailPrice: string | null;
  }[];
};

// ─── Main Component ──────────────────────────────────────────────

export default function AddStockPage() {
  const router = useRouter();

  // Search
  const [productSearch, setProductSearch] = useState("");
  const { data, isLoading: loadingProducts } = useShopProductsForStock(productSearch);
  const products: Product[] = (data as any)?.products ?? [];

  // Selection
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Quantity entries: inventoryId → addQuantity
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  // Stock type + note
  const [stockType, setStockType] = useState<StockType>("purchase");
  const [note, setNote] = useState("");

  // Mutation
  const addStock = useAddShopStock();

  // ─── Derived ─────────────────────────────────────────────────

  const previews = useMemo(() => {
    if (!selectedProduct) return [];
    return selectedProduct.variants.map((v) => {
      const addQty = parseFloat(quantities[v.inventoryId] || "0") || 0;
      return {
        ...v,
        addQty,
        newStock: v.currentStock + addQty,
      };
    });
  }, [selectedProduct, quantities]);

  const totalAdding = previews.reduce((sum, v) => sum + v.addQty, 0);
  const hasEntries = totalAdding > 0;
  const variantsChanged = previews.filter((v) => v.addQty > 0).length;

  // ─── Handlers ────────────────────────────────────────────────

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setQuantities({});
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setQuantities({});
  };

  const handleSubmit = () => {
    const entries = previews
      .filter((v) => v.addQty > 0)
      .map((v) => ({
        inventoryId: v.inventoryId,
        addQuantity: v.addQty,
      }));

    if (entries.length === 0) {
      toast.error("Please enter quantity for at least one variant");
      return;
    }

    addStock.mutate(
      {
        entries,
        stockType,
        note: note.trim() || undefined,
      },
      {
        onSuccess: (result: any) => {
          toast.success(result.message || "Stock added successfully!");
          router.push("/dashboard/stock");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to add stock");
        },
      },
    );
  };

  const isPending = addStock.isPending;

  // ─── Render ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link href="/dashboard/stock">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Add Stock</h1>
                <p className="text-sm text-muted-foreground">
                  Add inventory to your store
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/stock")}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isPending || !hasEntries}
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
                    onClick={handleClearProduct}
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
                      <p className="font-medium text-sm">{selectedProduct.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedProduct.category?.name || ""}
                        {" · "}
                        {selectedProduct.variants.length} variant
                        {selectedProduct.variants.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
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
                          {p.image ? (
                            <Image
                              src={p.image}
                              alt={p.name}
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-md object-cover border"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-gray-100 flex items-center justify-center">
                              <Package className="h-4 w-4 text-gray-300" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {p.category?.name || ""}
                              {" · "}
                              {p.variants.length} variant{p.variants.length !== 1 ? "s" : ""}
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

            {/* ── Step 2: Variant Stock Entry ── */}
            {selectedProduct && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      2
                    </div>
                    <CardTitle className="text-base">Variant Stock Entry</CardTitle>
                  </div>
                  <CardDescription>
                    Enter the quantity to add for each variant
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Variant summary info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Product</span>
                      <p className="font-medium truncate">{selectedProduct.name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Category</span>
                      <p>{selectedProduct.category?.name || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Variants</span>
                      <p>{selectedProduct.variants.length}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Total Stock</span>
                      <p className="font-semibold">
                        {selectedProduct.variants.reduce((s, v) => s + v.currentStock, 0)}
                      </p>
                    </div>
                  </div>

                  {/* Entry table */}
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="text-xs bg-gradient-to-r from-gray-50 to-white">
                          <TableHead className="py-2.5 font-bold text-gray-700">Brand</TableHead>
                          <TableHead className="py-2.5 font-bold text-gray-700">Variant</TableHead>
                          <TableHead className="py-2.5 font-bold text-gray-700">Unit</TableHead>
                          <TableHead className="text-center py-2.5 font-bold text-gray-700">Current Stock</TableHead>
                          <TableHead className="text-center py-2.5 w-[120px] font-bold text-gray-700">Add Qty</TableHead>
                          <TableHead className="text-center py-2.5 font-bold text-gray-700">Result Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previews.map((v) => (
                          <TableRow key={v.inventoryId} className="hover:bg-gray-50/50">
                            <TableCell className="text-sm py-3">
                              {v.brandName || "—"}
                            </TableCell>
                            <TableCell className="text-sm font-medium py-3">
                              {v.unitLabel}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-3">
                              {v.weightKg ? `${v.weightKg} KG` : "—"}
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <Badge
                                variant="outline"
                                className={`text-xs font-bold ${
                                  v.currentStock > 10
                                    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                                    : v.currentStock > 0
                                      ? "border-amber-200 text-amber-700 bg-amber-50"
                                      : "border-red-200 text-red-700 bg-red-50"
                                }`}
                              >
                                {v.currentStock}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-3">
                              <Input
                                type="text"
                                inputMode="numeric"
                                value={quantities[v.inventoryId] || ""}
                                onChange={(e) =>
                                  setQuantities((prev) => ({
                                    ...prev,
                                    [v.inventoryId]: e.target.value,
                                  }))
                                }
                                placeholder="0"
                                className="h-8 w-20 mx-auto text-center text-sm"
                              />
                            </TableCell>
                            <TableCell className="text-center py-3">
                              {v.addQty > 0 ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="text-xs text-muted-foreground line-through">
                                    {v.currentStock}
                                  </span>
                                  <span className="text-sm font-bold text-emerald-600">
                                    → {v.newStock}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {v.currentStock}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Auto conversion summary */}
                  {hasEntries && (
                    <div className="flex flex-col p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1">
                        Stock Addition Summary
                      </p>
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        +{totalAdding} unit{totalAdding !== 1 ? "s" : ""} across {variantsChanged} variant{variantsChanged !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Step 3: Stock Type & Note ── */}
            {selectedProduct && (
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      3
                    </div>
                    <CardTitle className="text-base">Stock Type & Note</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stock type radio (warehouse style) */}
                  <div className="flex gap-3">
                    {(
                      [
                        { value: "purchase", label: "Purchase Stock", desc: "Bought from supplier" },
                        { value: "return", label: "Return Stock", desc: "Returned from customer" },
                        { value: "adjustment", label: "Adjustment", desc: "Manual correction" },
                        { value: "opening", label: "Opening Stock", desc: "Initial inventory" },
                      ] as const
                    ).map(({ value, label, desc }) => (
                      <label
                        key={value}
                        className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          stockType === value
                            ? "bg-primary/5 border-primary/30"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="stockType"
                          value={value}
                          checked={stockType === value}
                          onChange={() => setStockType(value)}
                          className="accent-primary"
                        />
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Note */}
                  <Field>
                    <FieldLabel>Note (Optional)</FieldLabel>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Any additional notes about this stock entry..."
                    />
                  </Field>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Sidebar: Summary ── */}
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

                {/* Category */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Category</p>
                  <p className="text-sm font-medium">
                    {selectedProduct?.category?.name || "—"}
                  </p>
                </div>

                <Separator />

                {/* Stock Type */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Stock Type</p>
                  <p className="text-sm font-medium capitalize">{stockType}</p>
                </div>

                <Separator />

                {/* Quantities */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Quantity</p>
                  {hasEntries ? (
                    <>
                      <p className="text-sm font-semibold">
                        +{totalAdding} unit{totalAdding !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {variantsChanged} variant{variantsChanged !== 1 ? "s" : ""}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>

                {/* Live preview */}
                {hasEntries && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Live Preview</p>
                      <div className="space-y-1.5">
                        {previews
                          .filter((v) => v.addQty > 0)
                          .map((v) => (
                            <div
                              key={v.inventoryId}
                              className="flex items-center justify-between text-sm p-2 bg-emerald-50 rounded-md"
                            >
                              <span className="text-emerald-800 font-medium truncate text-xs">
                                {v.brandName ? `${v.brandName} · ` : ""}{v.unitLabel}
                              </span>
                              <span className="text-emerald-700 shrink-0 text-xs">
                                {v.currentStock} → <span className="font-bold">{v.newStock}</span>
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </>
                )}

                {note && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Note</p>
                      <p className="text-sm">{note}</p>
                    </div>
                  </>
                )}

                {/* Action */}
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={isPending || !hasEntries}
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
    </div>
  );
}
