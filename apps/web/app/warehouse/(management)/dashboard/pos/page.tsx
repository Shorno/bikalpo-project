"use client";

import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  Minus,
  Package,
  PauseCircle,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { orpc, queryClient } from "@/utils/orpc";
import { cn } from "@/lib/utils";

type CatalogOption = { id: number; name: string };
type CatalogVariant = {
  variantId: number;
  productId: number;
  sku: string | null;
  productName: string;
  coreProductName: string;
  typeId: number;
  typeName: string;
  categoryId: number;
  categoryName: string;
  subCategoryId: number;
  subCategoryName: string;
  coreProductId: number;
  brandId: number | null;
  brandName: string;
  pack: string;
  variantLabel: string;
  unitLabel: string;
  availableQty: number;
  unitPrice: number;
};

type PosCustomer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  customerType: "walk_in" | "retail" | "wholesale";
  isDefault: boolean;
};

type CartItem = {
  variantId: number;
  productId: number;
  sku: string | null;
  productName: string;
  variantLabel: string;
  unitLabel: string;
  qty: number;
  unitPrice: number;
};

const paymentMethods = [
  { key: "cash", label: "Cash", color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { key: "bkash", label: "bKash", color: "bg-pink-600 hover:bg-pink-700 text-white" },
  { key: "nagad", label: "Nagad", color: "bg-orange-500 hover:bg-orange-600 text-white" },
  { key: "bank", label: "Bank", color: "bg-blue-600 hover:bg-blue-700 text-white" },
  { key: "due", label: "Due", color: "bg-red-600 hover:bg-red-700 text-white" },
] as const;

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatDateLabel(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function parseNumeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTimeLabel(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateLabel} ${timeLabel}`;
}


export default function WarehousePosPage() {
  const [saleType, setSaleType] = useState<"retail" | "wholesale">("retail");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeId, setTypeId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [subCategoryId, setSubCategoryId] = useState<number | undefined>(undefined);
  const [coreProductId, setCoreProductId] = useState<number | undefined>(undefined);
  const [brandId, setBrandId] = useState<number | undefined>(undefined);
  const [pack, setPack] = useState<string | undefined>(undefined);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [taxInput, setTaxInput] = useState("0");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(undefined);
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bkash" | "nagad" | "bank" | "due"
  >("cash");
  const [paidInput, setPaidInput] = useState("0");
  const [note, setNote] = useState("");
  const [activeHeldCartId, setActiveHeldCartId] = useState<number | undefined>(undefined);
  const [completedSaleId, setCompletedSaleId] = useState<number | undefined>(undefined);
  const [showInvoice, setShowInvoice] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCustomerSearch(customerSearch),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  const bootstrapQuery = useQuery({
    queryKey: ["warehousePos", "bootstrap"],
    queryFn: () => orpc.warehousePos.getBootstrap.call({}),
  });

  const catalogQuery = useQuery({
    queryKey: [
      "warehousePos",
      "catalog",
      debouncedSearch,
      typeId,
      categoryId,
      subCategoryId,
      coreProductId,
      brandId,
      pack,
    ],
    queryFn: () =>
      orpc.warehousePos.getCatalog.call({
        search: debouncedSearch || undefined,
        typeId,
        categoryId,
        subCategoryId,
        coreProductId,
        brandId,
        pack,
      }),
    placeholderData: keepPreviousData,
  });

  const customersQuery = useQuery({
    queryKey: ["warehousePos", "customers", debouncedCustomerSearch],
    queryFn: () =>
      orpc.warehousePos.searchCustomers.call({
        search: debouncedCustomerSearch || undefined,
      }),
  });

  const heldCartsQuery = useQuery({
    queryKey: ["warehousePos", "heldCarts"],
    queryFn: () => orpc.warehousePos.listHeldCarts.call({}),
  });

  const invoiceQuery = useQuery({
    queryKey: ["warehousePos", "invoice", completedSaleId],
    queryFn: () =>
      orpc.warehousePos.getSaleInvoice.call({ saleId: completedSaleId! }),
    enabled: Boolean(completedSaleId),
  });

  useEffect(() => {
    const defaultId = bootstrapQuery.data?.defaultCustomer?.id;
    if (defaultId && !selectedCustomerId) {
      setSelectedCustomerId(defaultId);
    }
  }, [bootstrapQuery.data?.defaultCustomer?.id, selectedCustomerId]);

  useEffect(() => {
    if (paymentMethod === "due") {
      setPaidInput("0");
    }
  }, [paymentMethod]);

  const createCustomerMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      phone?: string;
      address?: string;
      customerType: "walk_in" | "retail" | "wholesale";
    }) => orpc.warehousePos.createCustomer.call(payload),
    onSuccess: async (result) => {
      setSelectedCustomerId(result.customer?.id);
      setShowAddCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerAddress("");
      await queryClient.invalidateQueries({ queryKey: ["warehousePos", "customers"] });
      toast.success("Customer added");
    },
  });

  const holdCartMutation = useMutation({
    mutationFn: (payload: {
      saleType: "retail" | "wholesale";
      customerId?: number;
      discount?: number;
      tax?: number;
      note?: string;
      items: Array<{ variantId: number; quantity: number; unitPrice?: number }>;
    }) => orpc.warehousePos.holdCart.call(payload),
    onSuccess: async () => {
      setCart([]);
      setActiveHeldCartId(undefined);
      setCompletedSaleId(undefined);
      await queryClient.invalidateQueries({ queryKey: ["warehousePos", "heldCarts"] });
      toast.success("Cart held successfully");
    },
  });

  const completeSaleMutation = useMutation({
    mutationFn: (payload: {
      saleType: "retail" | "wholesale";
      customerId?: number;
      paymentMethod: "cash" | "bkash" | "nagad" | "bank" | "due";
      paidAmount?: number;
      discount?: number;
      tax?: number;
      note?: string;
      heldCartId?: number;
      items: Array<{ variantId: number; quantity: number; unitPrice?: number }>;
    }) => orpc.warehousePos.completeSale.call(payload),
    onSuccess: async (result) => {
      setCompletedSaleId(result.saleId);
      setCart([]);
      setActiveHeldCartId(undefined);
      setShowInvoice(true);
      await queryClient.invalidateQueries({ queryKey: ["warehousePos", "catalog"] });
      await queryClient.invalidateQueries({ queryKey: ["warehousePos", "heldCarts"] });
      await queryClient.invalidateQueries({ queryKey: ["warehousePos", "invoice"] });
      toast.success(`Sale completed: ${result.invoiceNo}`);
    },
  });

  const cancelHeldCartMutation = useMutation({
    mutationFn: (cartId: number) => orpc.warehousePos.cancelHeldCart.call({ cartId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["warehousePos", "heldCarts"] });
      toast.success("Held cart cancelled");
    },
  });

  const options = catalogQuery.data?.options;
  const variants = (catalogQuery.data?.variants ?? []) as CatalogVariant[];
  const customers = (customersQuery.data?.customers ?? []) as PosCustomer[];
  const heldCarts = heldCartsQuery.data?.carts ?? [];



  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * item.unitPrice, 0),
    [cart],
  );
  const discount = parseNumeric(discountInput);
  const tax = parseNumeric(taxInput);
  const total = Math.max(0, subtotal - discount + tax);
  const paid = parseNumeric(paidInput);
  const change = Math.max(0, paid - total);
  const due = Math.max(0, total - paid);

  const addVariantToCart = (variant: CatalogVariant) => {
    setCart((previous) => {
      const existingIndex = previous.findIndex(
        (item) => item.variantId === variant.variantId,
      );
      if (existingIndex === -1) {
        return [
          ...previous,
          {
            variantId: variant.variantId,
            productId: variant.productId,
            sku: variant.sku,
            productName: variant.coreProductName,
            variantLabel: variant.variantLabel,
            unitLabel: variant.unitLabel,
            qty: 1,
            unitPrice: variant.unitPrice,
          },
        ];
      }
      const next = [...previous];
      const current = next[existingIndex]!;
      next[existingIndex] = { ...current, qty: current.qty + 1 };
      return next;
    });
    toast.success(`Added ${variant.coreProductName}`);
  };

  const updateCartQty = (variantId: number, qty: number) => {
    if (qty <= 0) {
      removeCartItem(variantId);
      return;
    }
    setCart((previous) =>
      previous.map((item) => (item.variantId === variantId ? { ...item, qty } : item)),
    );
  };

  const updateCartPrice = (variantId: number, price: number) => {
    setCart((previous) =>
      previous.map((item) =>
        item.variantId === variantId ? { ...item, unitPrice: Math.max(0, price) } : item,
      ),
    );
  };

  const removeCartItem = (variantId: number) => {
    setCart((previous) => previous.filter((item) => item.variantId !== variantId));
  };

  const resetCart = () => {
    setCart([]);
    setDiscountInput("0");
    setTaxInput("0");
    setPaidInput("0");
    setNote("");
    setActiveHeldCartId(undefined);
  };

  const holdCart = () => {
    if (cart.length === 0) {
      toast.error("Add products before holding cart");
      return;
    }
    holdCartMutation.mutate({
      saleType,
      customerId: selectedCustomerId,
      discount,
      tax,
      note: note || undefined,
      items: cart.map((item) => ({
        variantId: item.variantId,
        quantity: item.qty,
        unitPrice: item.unitPrice,
      })),
    });
  };

  const completeSale = () => {
    if (cart.length === 0) {
      toast.error("Add products before completing sale");
      return;
    }
    completeSaleMutation.mutate({
      saleType,
      customerId: selectedCustomerId,
      paymentMethod,
      paidAmount: paid,
      discount,
      tax,
      note: note || undefined,
      heldCartId: activeHeldCartId,
      items: cart.map((item) => ({
        variantId: item.variantId,
        quantity: item.qty,
        unitPrice: item.unitPrice,
      })),
    });
  };

  const restoreHeldCart = (cartRow: any) => {
    const items = (cartRow?.cartData?.items ?? []) as Array<{
      variantId: number;
      productId: number;
      sku: string | null;
      productName: string;
      variantLabel: string;
      unitLabel: string;
      quantity: string;
      unitPrice: string;
    }>;

    if (items.length === 0) {
      toast.error("This held cart has no items");
      return;
    }

    setCart(
      items.map((item) => ({
        variantId: item.variantId,
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        variantLabel: item.variantLabel,
        unitLabel: item.unitLabel,
        qty: parseNumeric(item.quantity),
        unitPrice: parseNumeric(item.unitPrice),
      })),
    );
    setSaleType((cartRow?.cartData?.saleType as "retail" | "wholesale") || "retail");
    setSelectedCustomerId(cartRow.customerId || undefined);
    setDiscountInput(String(parseNumeric(String(cartRow.discount ?? "0"))));
    setTaxInput(String(parseNumeric(String(cartRow.tax ?? "0"))));
    setNote(cartRow?.cartData?.note || "");
    setActiveHeldCartId(cartRow.id);
    toast.success(`Restored held cart: ${cartRow.heldRef}`);
  };

  const clearFilters = () => {
    setTypeId(undefined);
    setCategoryId(undefined);
    setSubCategoryId(undefined);
    setCoreProductId(undefined);
    setBrandId(undefined);
    setPack(undefined);
    setSearchText("");
  };

  const hasActiveFilters = typeId || categoryId || subCategoryId || coreProductId || brandId || pack || searchText;

  const invoice = invoiceQuery.data;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Printable receipt (only visible while printing) */}
      {invoice && (
        <div data-pos-receipt className="hidden">
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.25,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{invoice.store.name}</div>
              {invoice.store.address && <div>{invoice.store.address}</div>}
              {invoice.store.phone && <div>{invoice.store.phone}</div>}
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Invoice</span>
                <span style={{ fontWeight: 700 }}>{invoice.sale.invoiceNo}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Date</span>
                <span>{formatDateTimeLabel(invoice.sale.createdAt)}</span>
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{ opacity: 0.8 }}>Customer: </span>
                <span style={{ fontWeight: 700 }}>{invoice.customer.name}</span>
                {invoice.customer.phone ? ` (${invoice.customer.phone})` : ""}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #000", margin: "8px 0" }} />

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "4px 0", fontWeight: 700 }}>
                    Item
                  </th>
                  <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 700 }}>
                    Qty
                  </th>
                  <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 700 }}>
                    Price
                  </th>
                  <th style={{ textAlign: "right", padding: "4px 0", fontWeight: 700 }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item: any) => {
                  const qty = parseNumeric(String(item.quantity));
                  const price = parseNumeric(String(item.unitPrice));
                  const lineTotal = parseNumeric(String(item.lineTotal));
                  return (
                    <tr key={item.id}>
                      <td style={{ padding: "4px 0" }}>
                        <div style={{ fontWeight: 700 }}>{item.productName}</div>
                        <div style={{ opacity: 0.85 }}>{item.variantLabel}</div>
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "4px 0",
                          verticalAlign: "top",
                        }}
                      >
                        {formatMoney(qty)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "4px 0",
                          verticalAlign: "top",
                        }}
                      >
                        ৳{formatMoney(price)}
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          padding: "4px 0",
                          verticalAlign: "top",
                          fontWeight: 700,
                        }}
                      >
                        ৳{formatMoney(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ borderTop: "1px solid #000", margin: "8px 0" }} />

            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 700 }}>
                  ৳{formatMoney(parseNumeric(String(invoice.sale.subtotal)))}
                </span>
              </div>
              {parseNumeric(String(invoice.sale.discount)) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Discount</span>
                  <span style={{ fontWeight: 700 }}>
                    -৳{formatMoney(parseNumeric(String(invoice.sale.discount)))}
                  </span>
                </div>
              )}
              {parseNumeric(String(invoice.sale.tax)) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Tax</span>
                  <span style={{ fontWeight: 700 }}>
                    ৳{formatMoney(parseNumeric(String(invoice.sale.tax)))}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 14,
                  fontWeight: 800,
                  marginTop: 2,
                }}
              >
                <span>Total</span>
                <span>৳{formatMoney(parseNumeric(String(invoice.sale.total)))}</span>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #000", margin: "8px 0" }} />

            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Payment</span>
                <span style={{ fontWeight: 700, textTransform: "uppercase" }}>
                  {invoice.sale.paymentMethod}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Paid</span>
                <span style={{ fontWeight: 700 }}>
                  ৳{formatMoney(parseNumeric(String(invoice.sale.paid)))}
                </span>
              </div>
              {parseNumeric(String(invoice.sale.due)) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Due</span>
                  <span style={{ fontWeight: 700 }}>
                    ৳{formatMoney(parseNumeric(String(invoice.sale.due)))}
                  </span>
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #000", margin: "10px 0 8px" }} />

            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700 }}>Thank you for your purchase!</div>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 border-b bg-white px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Point of Sale</h1>
          </div>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex rounded-md border overflow-hidden">
            <button
              type="button"
              onClick={() => setSaleType("retail")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors",
                saleType === "retail"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted",
              )}
            >
              Retail
            </button>
            <button
              type="button"
              onClick={() => setSaleType("wholesale")}
              className={cn(
                "px-3 py-1 text-xs font-medium transition-colors border-l",
                saleType === "wholesale"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted",
              )}
            >
              Wholesale
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{bootstrapQuery.data?.welcomeName || "Warehouse User"}</span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{formatDateLabel(new Date())}</span>
          </div>
          {heldCarts.length > 0 && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <Badge variant="secondary" className="gap-1">
                <PauseCircle className="h-3 w-3" />
                {heldCarts.length} held
              </Badge>
            </>
          )}
        </div>
      </div>

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL: Product selection + product grid */}
        <div className="flex flex-col flex-1 border-r overflow-hidden">
          {/* Search bar */}
          <div className="p-3 border-b bg-gray-50/50 space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                ref={searchRef}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search products, SKU, brand..."
                className="pl-9 bg-white"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => { setSearchText(""); searchRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Compact filters row */}
            <div className="flex gap-2 items-end flex-wrap">
              <div className="min-w-[130px] flex-1">
                <Label className="text-[11px] text-muted-foreground mb-0.5 block">Type</Label>
                <Select
                  value={typeId ? String(typeId) : "all"}
                  onValueChange={(v) => {
                    setTypeId(v === "all" ? undefined : Number(v));
                    setCategoryId(undefined);
                    setSubCategoryId(undefined);
                    setCoreProductId(undefined);
                    setBrandId(undefined);
                    setPack(undefined);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {(options?.types as CatalogOption[] | undefined)?.map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[130px] flex-1">
                <Label className="text-[11px] text-muted-foreground mb-0.5 block">Category</Label>
                <Select
                  value={categoryId ? String(categoryId) : "all"}
                  onValueChange={(v) => {
                    setCategoryId(v === "all" ? undefined : Number(v));
                    setSubCategoryId(undefined);
                    setCoreProductId(undefined);
                    setBrandId(undefined);
                    setPack(undefined);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {options?.categories?.map((o: any) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[130px] flex-1">
                <Label className="text-[11px] text-muted-foreground mb-0.5 block">Sub Category</Label>
                <Select
                  value={subCategoryId ? String(subCategoryId) : "all"}
                  onValueChange={(v) => {
                    setSubCategoryId(v === "all" ? undefined : Number(v));
                    setCoreProductId(undefined);
                    setBrandId(undefined);
                    setPack(undefined);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sub Categories</SelectItem>
                    {options?.subCategories?.map((o: any) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[130px] flex-1">
                <Label className="text-[11px] text-muted-foreground mb-0.5 block">Core Product</Label>
                <Select
                  value={coreProductId ? String(coreProductId) : "all"}
                  onValueChange={(v) => {
                    setCoreProductId(v === "all" ? undefined : Number(v));
                    setBrandId(undefined);
                    setPack(undefined);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {options?.coreProducts?.map((o: any) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[110px]">
                <Label className="text-[11px] text-muted-foreground mb-0.5 block">Brand</Label>
                <Select
                  value={brandId ? String(brandId) : "all"}
                  onValueChange={(v) => setBrandId(v === "all" ? undefined : Number(v))}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Brands</SelectItem>
                    {options?.brands?.map((o: any) => (
                      <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-[100px]">
                <Label className="text-[11px] text-muted-foreground mb-0.5 block">Pack/Weight</Label>
                <Select
                  value={pack || "all"}
                  onValueChange={(v) => setPack(v === "all" ? undefined : v)}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Packs</SelectItem>
                    {options?.packs?.map((v: string) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-8 text-xs text-muted-foreground shrink-0"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Product grid */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              {catalogQuery.isLoading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading products...
                </div>
              ) : variants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Package className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No products found</p>
                  <p className="text-xs mt-1">Try adjusting your filters or search</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
                  {variants.map((variant) => {
                    const inCart = cart.find((c) => c.variantId === variant.variantId);
                    return (
                      <button
                        key={variant.variantId}
                        type="button"
                        onClick={() => addVariantToCart(variant)}
                        className={cn(
                          "relative text-left rounded-lg border p-3 transition-all hover:shadow-md hover:border-primary/40 active:scale-[0.98]",
                          inCart
                            ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                            : "bg-white hover:bg-gray-50/50",
                        )}
                      >
                        {inCart && (
                          <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-sm">
                            {inCart.qty}
                          </div>
                        )}
                        <p className="text-sm font-medium text-foreground truncate">
                          {variant.coreProductName}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {variant.brandName ? `${variant.brandName} - ` : ""}{variant.pack}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-semibold text-primary">
                            ৳{formatMoney(variant.unitPrice)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            Stock: {variant.availableQty}
                          </span>
                        </div>
                        {variant.sku && (
                          <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">{variant.sku}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Held carts strip */}
          {heldCarts.length > 0 && (
            <div className="border-t bg-amber-50/50 px-3 py-2 shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-medium text-amber-700 shrink-0">Held:</span>
                {heldCarts.map((held: any) => (
                  <div key={held.id} className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => restoreHeldCart(held)}
                      className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-50"
                    >
                      {held.heldRef}
                      <span className="text-muted-foreground ml-1">
                        ৳{formatMoney(parseNumeric(String(held.total)))}
                      </span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => cancelHeldCartMutation.mutate(held.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Cart + Payment + Actions */}
        <div className="w-[420px] xl:w-[460px] flex flex-col bg-gray-50/30 shrink-0 overflow-hidden">
          {/* Cart header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b bg-white shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Cart</span>
              {cart.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">
                  {cart.length} {cart.length === 1 ? "item" : "items"}
                </Badge>
              )}
            </div>
            {cart.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetCart}
                className="h-7 text-xs text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Cart items - scrollable */}
          <ScrollArea className="flex-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">Cart is empty</p>
                <p className="text-xs mt-0.5">Click a product to add</p>
              </div>
            ) : (
              <div className="divide-y">
                {cart.map((item) => (
                  <div key={item.variantId} className="px-4 py-2.5 bg-white hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        <p className="text-[11px] text-muted-foreground">{item.variantLabel}</p>
                        {item.sku && (
                          <p className="text-[10px] font-mono text-muted-foreground/60">{item.sku}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.variantId)}
                        className="text-muted-foreground hover:text-red-500 transition-colors mt-0.5 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-3">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-0 border rounded-md overflow-hidden">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.variantId, item.qty - 1)}
                          className="h-7 w-7 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) => {
                            const val = parseNumeric(e.target.value);
                            if (val > 0) updateCartQty(item.variantId, val);
                          }}
                          className="h-7 w-12 text-center text-sm font-medium border-x bg-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.variantId, item.qty + 1)}
                          className="h-7 w-7 flex items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Editable unit price */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-muted-foreground">৳</span>
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateCartPrice(item.variantId, parseNumeric(e.target.value))}
                          className="h-7 w-20 text-right text-sm font-medium border rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          step="0.01"
                          min="0"
                        />
                      </div>
                      {/* Line total */}
                      <span className="text-sm font-semibold tabular-nums text-right min-w-[70px]">
                        ৳{formatMoney(item.qty * item.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Bottom section: totals + customer + payment + actions */}
          <div className="border-t bg-white shrink-0">
            {/* Cost summary */}
            {cart.length > 0 && (
              <div className="px-4 py-3 space-y-1.5 border-b">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">৳{formatMoney(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="text-muted-foreground">Discount</span>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">৳</span>
                    <input
                      type="number"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="h-6 w-20 text-right text-sm border rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="0"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="text-muted-foreground">VAT / Tax</span>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-xs">৳</span>
                    <input
                      type="number"
                      value={taxInput}
                      onChange={(e) => setTaxInput(e.target.value)}
                      className="h-6 w-20 text-right text-sm border rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="0"
                    />
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base font-bold">
                  <span>Total</span>
                  <span className="tabular-nums text-primary">৳{formatMoney(total)}</span>
                </div>
              </div>
            )}

            {/* Customer selection */}
            <div className="px-4 py-2.5 border-b space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-muted-foreground">Customer</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddCustomer(true)}
                  className="h-6 text-[11px] text-primary hover:text-primary/80"
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  New
                </Button>
              </div>
              <Select
                value={selectedCustomerId ? String(selectedCustomerId) : "none"}
                onValueChange={(v) => setSelectedCustomerId(v === "none" ? undefined : Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Walk-in Customer" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-1.5">
                    <Input
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search customer..."
                      className="h-7 text-xs"
                    />
                  </div>
                  <SelectItem value="none">Walk-in Customer</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment method */}
            <div className="px-4 py-2.5 border-b space-y-2">
              <Label className="text-[11px] text-muted-foreground">Payment Method</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {paymentMethods.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPaymentMethod(m.key)}
                    className={cn(
                      "h-8 rounded-md text-[11px] font-medium transition-all",
                      paymentMethod === m.key
                        ? m.color + " shadow-sm"
                        : "bg-gray-100 text-muted-foreground hover:bg-gray-200",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Paid</Label>
                  <Input
                    value={paidInput}
                    onChange={(e) => setPaidInput(e.target.value)}
                    className="h-7 text-xs text-right"
                    type="number"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Change</Label>
                  <div className="h-7 flex items-center justify-end text-xs font-medium text-emerald-600 border rounded-md px-2 bg-emerald-50/50">
                    ৳{formatMoney(change)}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Due</Label>
                  <div className={cn(
                    "h-7 flex items-center justify-end text-xs font-medium border rounded-md px-2",
                    due > 0 ? "text-red-600 bg-red-50/50" : "text-muted-foreground bg-gray-50",
                  )}>
                    ৳{formatMoney(due)}
                  </div>
                </div>
              </div>
            </div>

            {/* Note */}
            <div className="px-4 py-2 border-b">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)..."
                className="min-h-[32px] h-8 text-xs resize-none"
                rows={1}
              />
            </div>

            {/* Action buttons */}
            <div className="px-4 py-3 space-y-2">
              <Button
                type="button"
                onClick={completeSale}
                disabled={cart.length === 0 || completeSaleMutation.isPending}
                className="w-full h-10 text-sm font-semibold gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {completeSaleMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {completeSaleMutation.isPending ? "Processing..." : `Complete Sale — ৳${formatMoney(total)}`}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={holdCart}
                  disabled={cart.length === 0 || holdCartMutation.isPending}
                  className="text-xs gap-1.5"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  {holdCartMutation.isPending ? "Holding..." : "Hold Cart"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetCart}
                  className="text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label className="text-xs">Name *</Label>
              <Input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Address</Label>
              <Input
                value={newCustomerAddress}
                onChange={(e) => setNewCustomerAddress(e.target.value)}
                placeholder="Address"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddCustomer(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (newCustomerName.trim().length < 2) {
                    toast.error("Customer name is required");
                    return;
                  }
                  createCustomerMutation.mutate({
                    name: newCustomerName.trim(),
                    phone: newCustomerPhone.trim() || undefined,
                    address: newCustomerAddress.trim() || undefined,
                    customerType: saleType === "wholesale" ? "wholesale" : "retail",
                  });
                }}
                disabled={createCustomerMutation.isPending}
              >
                {createCustomerMutation.isPending ? "Saving..." : "Save Customer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={showInvoice && !!invoice} onOpenChange={setShowInvoice}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {invoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  {invoice.sale.saleType === "wholesale" ? "Wholesale Invoice" : "Sales Invoice"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Store + Customer info */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="space-y-0.5">
                    <p className="font-medium">{invoice.store.name}</p>
                    {invoice.store.address && <p className="text-muted-foreground">{invoice.store.address}</p>}
                    {invoice.store.phone && <p className="text-muted-foreground">{invoice.store.phone}</p>}
                  </div>
                  <div className="space-y-0.5 text-right">
                    <p className="font-medium">{invoice.sale.invoiceNo}</p>
                    <p className="text-muted-foreground">{formatDateLabel(invoice.sale.createdAt)}</p>
                    <p className="text-muted-foreground">
                      {new Date(invoice.sale.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="text-xs">
                  <span className="text-muted-foreground">Customer: </span>
                  <span className="font-medium">{invoice.customer.name}</span>
                  {invoice.customer.phone && (
                    <span className="text-muted-foreground"> ({invoice.customer.phone})</span>
                  )}
                </div>

                {/* Items table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs">
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs">Variant</TableHead>
                        <TableHead className="text-xs text-right">Qty</TableHead>
                        <TableHead className="text-xs text-right">Price</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.items.map((item: any) => {
                        const qty = parseNumeric(String(item.quantity));
                        const price = parseNumeric(String(item.unitPrice));
                        const lineTotal = parseNumeric(String(item.lineTotal));
                        return (
                          <TableRow key={item.id} className="text-xs">
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell>{item.variantLabel}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatMoney(qty)}</TableCell>
                            <TableCell className="text-right tabular-nums">৳{formatMoney(price)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">৳{formatMoney(lineTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">৳{formatMoney(parseNumeric(String(invoice.sale.subtotal)))}</span>
                  </div>
                  {parseNumeric(String(invoice.sale.discount)) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="tabular-nums text-red-600">-৳{formatMoney(parseNumeric(String(invoice.sale.discount)))}</span>
                    </div>
                  )}
                  {parseNumeric(String(invoice.sale.tax)) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="tabular-nums">৳{formatMoney(parseNumeric(String(invoice.sale.tax)))}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total</span>
                    <span className="tabular-nums">৳{formatMoney(parseNumeric(String(invoice.sale.total)))}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Payment</span>
                    <Badge variant="outline" className="text-[10px] uppercase">{invoice.sale.paymentMethod}</Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Paid</span>
                    <span className="tabular-nums font-medium text-emerald-600">৳{formatMoney(parseNumeric(String(invoice.sale.paid)))}</span>
                  </div>
                  {parseNumeric(String(invoice.sale.due)) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Due</span>
                      <span className="tabular-nums font-medium text-red-600">৳{formatMoney(parseNumeric(String(invoice.sale.due)))}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <p className="text-center text-xs text-muted-foreground">
                  Thank You for Your Purchase!
                </p>

                {/* Invoice actions */}
                <div className="flex justify-center gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs">
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toast.success("SMS trigger queued")}
                    className="gap-1.5 text-xs"
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    SMS
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowInvoice(false)}
                    className="text-xs"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
