"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, ChevronRight, Loader, Package, Plus,
  Search, Tag, Box, CalendarIcon, CreditCard, User, FileText,
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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

  // ── Payment & Supplier Info (frontend-only) ──
  const [supplier, setSupplier] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [referenceNo, setReferenceNo] = useState("");

  // ── Entry Mode (frontend-only) ──
  type EntryMode = "loose" | "pack" | "carton";
  const [entryMode, setEntryMode] = useState<EntryMode>("loose");

  // ── Cost & Total (frontend-only) ──
  const [discount, setDiscount] = useState("0");
  const [vatTax, setVatTax] = useState("0");

  // ── Batch & Expiry (frontend-only) ──
  const [batchNo, setBatchNo] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

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
      {/* ══ Sticky Header (compact) ══ */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                <Link href="/dashboard/stock">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-base font-bold flex items-center gap-2">
                  📦 Add Stock
                  <span className="text-[10px] text-muted-foreground font-normal">Product Inventory Entry</span>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => router.push("/dashboard/stock")}
                disabled={isPending}
              >
                ❌ Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleSubmit}
                disabled={isPending || !hasEntries}
              >
                {isPending && (
                  <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                )}
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Confirm & Add Stock
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 max-w-4xl space-y-4">
        {/* ══════════════════════════════════════════════════════════
            🟦 PAYMENT & SUPPLIER INFO
            ══════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1 bg-blue-100 rounded">
                <CreditCard className="h-3.5 w-3.5 text-blue-600" />
              </div>
              Payment & Supplier Info
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Payee / Supplier */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Payee
                </label>
                <Select value={supplier} onValueChange={setSupplier}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct Purchase</SelectItem>
                    <SelectItem value="supplier-1">ACI Foods Ltd</SelectItem>
                    <SelectItem value="supplier-2">PRAN Group</SelectItem>
                    <SelectItem value="supplier-3">Fresh Agro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Account */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Payment Account
                </label>
                <Select value={paymentAccount} onValueChange={setPaymentAccount}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">💵 Cash</SelectItem>
                    <SelectItem value="bank">🏦 Bank Transfer</SelectItem>
                    <SelectItem value="bkash">📱 bKash</SelectItem>
                    <SelectItem value="credit">📋 Credit / Due</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Payment Date
                </label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {/* Reference No */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Reference No
                </label>
                <Input
                  placeholder="Invoice No..."
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════
            🟨 PRODUCT SELECTION (Step 1)
            ══════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="p-1 bg-amber-100 rounded">
                <Search className="h-3.5 w-3.5 text-amber-600" />
              </div>
              Product Selection
            </CardTitle>
            <CardDescription className="text-xs">
              Search and select a product to add stock for
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by SKU / Product Name / Brand..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
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
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {loadingProducts ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : products.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    {productSearch
                      ? "No products match your search"
                      : "No products found. Create products from the catalog first."}
                  </div>
                ) : (
                  products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex items-center gap-3 w-full rounded-lg px-3 py-2 text-left hover:bg-muted/80 transition-colors cursor-pointer"
                      onClick={() => handleSelectProduct(p)}
                    >
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.name}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-md object-cover border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
                          <Package className="h-3.5 w-3.5 text-gray-300" />
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

        {/* ══════════════════════════════════════════════════════════
            🧱 ENTRY MODE
            ══════════════════════════════════════════════════════════ */}
        {selectedProduct && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1 bg-orange-100 rounded">
                  <Box className="h-3.5 w-3.5 text-orange-600" />
                </div>
                🧱 Entry Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {([
                  { value: "loose" as EntryMode, label: "Loose Entry", desc: "KG / Liter" },
                  { value: "pack" as EntryMode, label: "Pack Entry", desc: "Per Pack" },
                  { value: "carton" as EntryMode, label: "Carton Entry", desc: "Auto → Pack" },
                ] as const).map(({ value, label, desc }) => (
                  <label
                    key={value}
                    className={`flex-1 flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors text-xs ${
                      entryMode === value
                        ? "bg-orange-50 border-orange-300 ring-1 ring-orange-200"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="entryMode"
                      value={value}
                      checked={entryMode === value}
                      onChange={() => setEntryMode(value)}
                      className="accent-orange-500"
                    />
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              {entryMode === "carton" && (
                <p className="text-[10px] text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded">
                  📦 Carton → auto converted to packs. Enter carton quantity, system calculates pack count.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            📋 ITEM ENTRY TABLE
            ══════════════════════════════════════════════════════════ */}
        {selectedProduct && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1 bg-emerald-100 rounded">
                  <Box className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                📋 Item Entry Table
              </CardTitle>
              <CardDescription className="text-xs">
                Enter the quantity to add for each variant
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Variant summary info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-muted/50 rounded-lg text-xs">
                <div>
                  <span className="text-muted-foreground text-[10px]">Product</span>
                  <p className="font-medium truncate">{selectedProduct.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Category</span>
                  <p>{selectedProduct.category?.name || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Variants</span>
                  <p>{selectedProduct.variants.length}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Total Stock</span>
                  <p className="font-semibold">
                    {selectedProduct.variants.reduce((s, v) => s + v.currentStock, 0)}
                  </p>
                </div>
              </div>

              {/* Entry table */}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[10px] bg-gray-50">
                      <TableHead className="py-2 font-bold text-gray-700">Brand</TableHead>
                      <TableHead className="py-2 font-bold text-gray-700">Variant</TableHead>
                      <TableHead className="py-2 font-bold text-gray-700">Unit</TableHead>
                      <TableHead className="text-center py-2 font-bold text-gray-700">Current</TableHead>
                      <TableHead className="text-center py-2 w-[100px] font-bold text-gray-700">Add Qty</TableHead>
                      <TableHead className="text-center py-2 font-bold text-gray-700">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previews.map((v) => (
                      <TableRow key={v.inventoryId} className="hover:bg-gray-50/50">
                        <TableCell className="text-xs py-2">
                          {v.brandName || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-medium py-2">
                          {v.unitLabel}
                        </TableCell>
                        <TableCell className="text-[10px] text-muted-foreground py-2">
                          {v.weightKg ? `${v.weightKg} KG` : "—"}
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold ${
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
                        <TableCell className="text-center py-2">
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
                            className="h-7 w-16 mx-auto text-center text-xs"
                          />
                        </TableCell>
                        <TableCell className="text-center py-2">
                          {v.addQty > 0 ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-[10px] text-muted-foreground line-through">
                                {v.currentStock}
                              </span>
                              <span className="text-xs font-bold text-emerald-600">
                                → {v.newStock}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {v.currentStock}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Addition summary */}
              {hasEntries && (
                <div className="flex items-center p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-xs text-emerald-700 font-medium">
                    📦 +{totalAdding} unit{totalAdding !== 1 ? "s" : ""} across {variantsChanged} variant{variantsChanged !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            💰 COST & TOTAL
            ══════════════════════════════════════════════════════════ */}
        {selectedProduct && hasEntries && (() => {
          const subtotal = previews.reduce((sum, v) => {
            const price = parseFloat(v.retailPrice || "0");
            return sum + (v.addQty * price);
          }, 0);
          const disc = parseFloat(discount) || 0;
          const vat = parseFloat(vatTax) || 0;
          const total = subtotal - disc + vat;

          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="p-1 bg-rose-100 rounded">
                    <CreditCard className="h-3.5 w-3.5 text-rose-600" />
                  </div>
                  💰 Cost & Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-medium">৳ {subtotal.toFixed(0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-muted-foreground">Discount:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">৳</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                          className="h-6 w-16 text-right text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-muted-foreground">VAT / Tax:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">৳</span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={vatTax}
                          onChange={(e) => setVatTax(e.target.value)}
                          className="h-6 w-16 text-right text-xs"
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold">TOTAL:</span>
                      <span className="font-bold text-lg">৳ {total.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════
            📦 BATCH & EXPIRY
            ══════════════════════════════════════════════════════════ */}
        {selectedProduct && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1 bg-cyan-100 rounded">
                  <FileText className="h-3.5 w-3.5 text-cyan-600" />
                </div>
                📦 Batch & Expiry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Batch No
                  </label>
                  <Input
                    placeholder="B-1001"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Expiry Date
                  </label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            ⚙ STOCK TYPE & NOTE
            ══════════════════════════════════════════════════════════ */}
        {selectedProduct && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1 bg-purple-100 rounded">
                  <Tag className="h-3.5 w-3.5 text-purple-600" />
                </div>
                Stock Type & Note
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stock type radio */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(
                  [
                    { value: "purchase", label: "Purchase Stock", desc: "Bought from supplier", icon: "🛒" },
                    { value: "return", label: "Return Stock", desc: "Returned from customer", icon: "↩️" },
                    { value: "adjustment", label: "Adjustment", desc: "Manual correction", icon: "🔧" },
                    { value: "opening", label: "Opening Stock", desc: "Initial inventory", icon: "📋" },
                  ] as const
                ).map(({ value, label, desc, icon }) => (
                  <label
                    key={value}
                    className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors text-xs ${
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
                      <p className="font-medium">{icon} {label}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Note (Optional)
                </label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any additional notes about this stock entry..."
                  className="h-8 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            📊 LIVE PREVIEW
            ══════════════════════════════════════════════════════════ */}
        {hasEntries && (
          <Card className="border-emerald-200 bg-emerald-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="p-1 bg-emerald-100 rounded">
                  <Package className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                📊 Live Preview — After Adding Stock
              </CardTitle>
              <CardDescription className="text-xs text-emerald-700">
                Confirm the stock changes before submitting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800 mb-2">
                  Product: {selectedProduct?.name}
                </p>
                {previews
                  .filter((v) => v.addQty > 0)
                  .map((v) => (
                    <div
                      key={v.inventoryId}
                      className="flex items-center justify-between text-xs p-2 bg-white rounded-md border border-emerald-100"
                    >
                      <span className="text-emerald-800 font-medium truncate">
                        {v.brandName ? `${v.brandName} + ` : ""}{v.unitLabel}
                      </span>
                      <span className="text-emerald-700 shrink-0 font-medium">
                        {v.currentStock} → <span className="font-bold text-emerald-900">{v.newStock}</span>
                        {v.weightKg && parseFloat(v.weightKg) === 0 ? " KG" : " Pack"}
                      </span>
                    </div>
                  ))}
                <p className="text-[10px] text-emerald-600 mt-2">
                  👉 Helps retailer confirm before submit
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ══════════════════════════════════════════════════════════
            ⚡ FINAL ACTIONS
            ══════════════════════════════════════════════════════════ */}
        {selectedProduct && (
          <div className="flex items-center justify-end gap-2 pb-6">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => router.push("/dashboard/stock")}
              disabled={isPending}
            >
              ❌ Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              disabled
            >
              💾 Save Draft
            </Button>
            <Button
              size="sm"
              className="h-9 text-xs"
              onClick={handleSubmit}
              disabled={isPending || !hasEntries}
            >
              {isPending && (
                <Loader className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              ✅ Confirm & Add Stock
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
