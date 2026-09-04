"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookmarkPlus,
  Box,
  Check,
  CircleDollarSign,
  Clock3,
  Download,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBasket,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { authorizeShopPermission } from "@bikalpo-project/auth/shop-permissions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useShopMyAccess } from "@/hooks/use-shop-staff-api";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadRetailerPosReceipt } from "@/lib/retailer-pos-receipt";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type CartLine = {
  variantId: number;
  productId: number;
  productName: string;
  variantLabel: string;
  sku: string | null;
  unitLabel: string;
  availableQty: number;
  unitPrice: number;
  quantity: number;
};

type Adjustment = { mode: "fixed" | "percentage"; value: number };

type SelectedCustomer = {
  id: number;
  name: string;
  phone: string | null;
  isDefault?: boolean;
};

const emptyFilters = {
  typeId: "all",
  categoryId: "all",
  subCategoryId: "all",
  coreProductId: "all",
  brandId: "all",
  pack: "all",
};

function amount(base: number, adjustment: Adjustment) {
  return adjustment.mode === "percentage"
    ? base * (adjustment.value / 100)
    : adjustment.value;
}

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function receiptHtml(detail: any) {
  const sale = detail.sale;
  return `<!doctype html><html><head><title>${sale.invoiceNo}</title><style>
  body{font-family:Segoe UI,sans-serif;color:#17201c;max-width:360px;margin:0 auto;padding:18px;font-size:12px}
  h1{font-size:18px;margin:0}.muted{color:#647067}.center{text-align:center}.rule{border-top:1px dashed #8b978f;margin:12px 0}
  table{width:100%;border-collapse:collapse}td{padding:4px 0;vertical-align:top}.right{text-align:right}.total{font-size:15px;font-weight:700}
  @media print{body{padding:0}}
  </style></head><body><div class="center"><h1>${detail.shop.name}</h1><div>${detail.shop.address || ""}</div><div>${detail.shop.phone || ""}</div></div>
  <div class="rule"></div><div><b>${sale.invoiceNo}</b></div><div>${new Date(sale.createdAt).toLocaleString("en-BD")}</div><div>${sale.customerName}${sale.customerPhone ? ` · ${sale.customerPhone}` : ""}</div>
  <div class="rule"></div><table>${sale.items.map((item: any) => `<tr><td>${item.productName}<br><span class="muted">${item.quantity} ${item.unitLabel} × BDT ${formatMoney(item.unitPrice)}</span></td><td class="right">${formatMoney(item.lineTotal)}</td></tr>`).join("")}</table>
  <div class="rule"></div><table><tr><td>Subtotal</td><td class="right">BDT ${formatMoney(sale.subtotal)}</td></tr><tr><td>Discount</td><td class="right">− BDT ${formatMoney(sale.discount)}</td></tr><tr><td>VAT</td><td class="right">BDT ${formatMoney(sale.tax)}</td></tr><tr class="total"><td>Total</td><td class="right">BDT ${formatMoney(sale.total)}</td></tr><tr><td>Paid</td><td class="right">BDT ${formatMoney(sale.paid)}</td></tr><tr><td>Due</td><td class="right">BDT ${formatMoney(sale.due)}</td></tr>${Number(sale.changeAmount) > 0 ? `<tr><td>Change</td><td class="right">BDT ${formatMoney(sale.changeAmount)}</td></tr>` : ""}</table>
  <div class="rule"></div><div class="center muted">Counter sale · Served by ${sale.soldBy?.name || detail.shop.ownerName}</div></body></html>`;
}

export default function RetailerPosPage() {
  const queryClient = useQueryClient();
  const access = useShopMyAccess();
  const canCreateSale = access.data
    ? authorizeShopPermission(access.data.permissions, "shop_pos", "create")
    : false;
  const canDeleteHeldCart = access.data
    ? authorizeShopPermission(access.data.permissions, "shop_pos", "delete")
    : false;
  const canCreateCustomer = access.data
    ? authorizeShopPermission(
        access.data.permissions,
        "shop_customers",
        "create",
      )
    : false;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<SelectedCustomer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [discount, setDiscount] = useState<Adjustment>({
    mode: "fixed",
    value: 0,
  });
  const [tax, setTax] = useState<Adjustment>({ mode: "fixed", value: 0 });
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bkash" | "nagad" | "bank"
  >("cash");
  const [tendered, setTendered] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [note, setNote] = useState("");
  const [activeHeldCartId, setActiveHeldCartId] = useState<number | null>(null);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    address: "",
  });
  const [receiptSaleId, setReceiptSaleId] = useState<number | null>(null);
  const checkoutRequestId = useRef<string | null>(null);

  const bootstrapQuery = useQuery(
    orpc.retailerPos.getBootstrap.queryOptions({ input: {} }),
  );
  const catalogInput = useMemo(
    () => ({
      search: search || undefined,
      typeId: filters.typeId === "all" ? undefined : Number(filters.typeId),
      categoryId:
        filters.categoryId === "all" ? undefined : Number(filters.categoryId),
      subCategoryId:
        filters.subCategoryId === "all"
          ? undefined
          : Number(filters.subCategoryId),
      coreProductId:
        filters.coreProductId === "all"
          ? undefined
          : Number(filters.coreProductId),
      brandId: filters.brandId === "all" ? undefined : Number(filters.brandId),
      pack: filters.pack === "all" ? undefined : filters.pack,
    }),
    [filters, search],
  );
  const catalogQuery = useQuery(
    orpc.retailerPos.getCatalog.queryOptions({ input: catalogInput }),
  );
  const customersQuery = useQuery(
    orpc.retailerPos.searchCustomers.queryOptions({
      input: { search: customerSearch || undefined },
    }),
  );
  const heldQuery = useQuery(
    orpc.retailerPos.listHeldCarts.queryOptions({ input: {} }),
  );
  const receiptQuery = useQuery({
    ...orpc.retailerPos.getSale.queryOptions({
      input: { saleId: receiptSaleId ?? 0 },
    }),
    enabled: receiptSaleId !== null,
  });

  useEffect(() => {
    if (!selectedCustomer && bootstrapQuery.data?.defaultCustomer) {
      setSelectedCustomer(bootstrapQuery.data.defaultCustomer);
    }
  }, [bootstrapQuery.data?.defaultCustomer, selectedCustomer]);

  const subtotal = cart.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const discountAmount = Math.min(
    subtotal,
    Math.max(0, amount(subtotal, discount)),
  );
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.max(0, amount(taxable, tax));
  const total = taxable + taxAmount;
  const tenderedNumber = Math.max(0, Number(tendered || 0));
  const paid = Math.min(total, tenderedNumber);
  const due = Math.max(0, total - paid);
  const change = Math.max(0, tenderedNumber - total);

  const resetCart = () => {
    setCart([]);
    setSelectedCustomer(bootstrapQuery.data?.defaultCustomer ?? null);
    setDiscount({ mode: "fixed", value: 0 });
    setTax({ mode: "fixed", value: 0 });
    setPaymentMethod("cash");
    setTendered("");
    setTransactionRef("");
    setNote("");
    setActiveHeldCartId(null);
  };

  const createCustomerMutation = useMutation({
    mutationFn: (input: typeof customerForm) =>
      orpc.retailerPos.createCustomer.call(input),
    onSuccess: ({ customer }) => {
      setSelectedCustomer(customer);
      setCustomerDialog(false);
      setCustomerForm({ name: "", phone: "", address: "" });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.searchCustomers.key(),
      });
      toast.success("Customer added to this shop");
    },
    onError: (error) => toast.error(error.message),
  });

  const selectCustomerMutation = useMutation({
    mutationFn: async (
      customer: NonNullable<typeof customersQuery.data>["customers"][number],
    ) => {
      if (customer.id) return { customer };
      return orpc.retailerPos.createCustomer.call({
        name: customer.name,
        phone: customer.phone || "",
        address: customer.address || undefined,
        linkedUserId: customer.linkedUserId || undefined,
      });
    },
    onSuccess: ({ customer }) => {
      if (!customer.id) return;
      setSelectedCustomer({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        isDefault: customer.isDefault,
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.searchCustomers.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const holdMutation = useMutation({
    mutationFn: () =>
      orpc.retailerPos.holdCart.call({
        customerId: selectedCustomer?.id,
        discount,
        tax,
        note: note || undefined,
        items: cart.map(({ variantId, quantity, unitPrice }) => ({
          variantId,
          quantity,
          expectedUnitPrice: unitPrice,
        })),
      }),
    onSuccess: () => {
      toast.success("Cart held without reserving stock");
      resetCart();
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listHeldCarts.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => {
      checkoutRequestId.current ||= crypto.randomUUID();
      return orpc.retailerPos.completeSale.call({
        checkoutRequestId: checkoutRequestId.current,
        customerId: selectedCustomer?.id,
        paymentMethod,
        tenderedAmount: tenderedNumber,
        transactionRef: transactionRef || undefined,
        discount,
        tax,
        note: note || undefined,
        heldCartId: activeHeldCartId ?? undefined,
        items: cart.map(({ variantId, quantity, unitPrice }) => ({
          variantId,
          quantity,
          expectedUnitPrice: unitPrice,
        })),
      });
    },
    onSuccess: (result) => {
      checkoutRequestId.current = null;
      setReceiptSaleId(result.saleId);
      resetCart();
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.getCatalog.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listHeldCarts.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listSales.key(),
      });
      toast.success(`Sale completed · ${result.invoiceNo}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelHeldMutation = useMutation({
    mutationFn: (cartId: number) =>
      orpc.retailerPos.cancelHeldCart.call({ cartId }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listHeldCarts.key(),
      }),
    onError: (error) => toast.error(error.message),
  });

  const addProduct = (variant: any) => {
    setCart((current) => {
      const existing = current.find(
        (line) => line.variantId === variant.variantId,
      );
      if (existing) {
        if (existing.quantity + 1 > existing.availableQty) {
          toast.error("No more stock is available");
          return current;
        }
        return current.map((line) =>
          line.variantId === variant.variantId
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        );
      }
      return [...current, { ...variant, quantity: 1 }];
    });
  };

  const updateQuantity = (variantId: number, next: number) => {
    setCart((current) =>
      current
        .map((line) =>
          line.variantId === variantId
            ? {
                ...line,
                quantity: Math.min(line.availableQty, Math.max(0, next)),
              }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  };

  const restoreHeldCart = (held: any) => {
    const catalog = catalogQuery.data?.variants ?? [];
    const restored: CartLine[] = [];
    for (const item of held.cartData.items) {
      const current = catalog.find(
        (variant) => variant.variantId === item.variantId,
      );
      if (!current) continue;
      restored.push({ ...current, quantity: Number(item.quantity) });
    }
    setCart(restored);
    setDiscount(
      held.cartData.discount ?? { mode: "fixed", value: Number(held.discount) },
    );
    setTax(held.cartData.tax ?? { mode: "fixed", value: Number(held.tax) });
    setNote(held.cartData.note ?? "");
    setSelectedCustomer(
      held.customer ?? bootstrapQuery.data?.defaultCustomer ?? null,
    );
    setActiveHeldCartId(held.id);
    toast.info("Held Cart restored with current prices and stock");
  };

  const setFilter = (key: keyof typeof filters, value: string) => {
    const order = [
      "typeId",
      "categoryId",
      "subCategoryId",
      "coreProductId",
      "brandId",
      "pack",
    ] as const;
    const index = order.indexOf(key);
    setFilters((current) => ({
      ...current,
      ...Object.fromEntries(
        order.slice(index + 1).map((child) => [child, "all"]),
      ),
      [key]: value,
    }));
  };

  const canComplete =
    cart.length > 0 &&
    tendered !== "" &&
    (due <= 0 ||
      Boolean(
        selectedCustomer &&
          !selectedCustomer.isDefault &&
          selectedCustomer.phone,
      ));

  return (
    <div className="-m-4 min-h-[calc(100vh-3rem)] bg-[#f3f0e8] md:-m-6">
      <header className="border-b border-white/10 bg-[#10241d] px-4 py-4 text-[#f5f1e8] md:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
              <CircleDollarSign className="h-4 w-4" /> Retail counter
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Point of Sale
            </h1>
            <p className="mt-1 text-sm text-white/60">
              {bootstrapQuery.data?.shop.name || "Your shop"} ·{" "}
              {bootstrapQuery.data?.shop.ownerName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(heldQuery.data?.carts.length ?? 0) > 0 && (
              <Badge className="border-amber-300/25 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">
                <Clock3 className="mr-1 h-3.5 w-3.5" />{" "}
                {heldQuery.data?.carts.length} held
              </Badge>
            )}
            <div className="hidden text-right text-xs text-white/55 sm:block">
              <div>
                {new Date().toLocaleDateString("en-BD", {
                  weekday: "long",
                  day: "numeric",
                  month: "short",
                })}
              </div>
              <div className="text-white/80">Live inventory</div>
            </div>
          </div>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-8.5rem)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_410px]">
        <section className="min-w-0 border-r border-[#d7d1c4] p-4 md:p-6">
          <div className="mb-4 rounded-2xl border border-[#d7d1c4] bg-white/85 p-3 shadow-[0_8px_30px_rgba(31,48,40,0.06)] backdrop-blur">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68736d]" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product name or SKU…"
                className="h-11 border-0 bg-[#f3f0e8] pl-10 text-base shadow-none focus-visible:ring-emerald-700"
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
              {(
                [
                  ["typeId", "Type", catalogQuery.data?.options.types],
                  [
                    "categoryId",
                    "Category",
                    catalogQuery.data?.options.categories,
                  ],
                  [
                    "subCategoryId",
                    "Subcategory",
                    catalogQuery.data?.options.subCategories,
                  ],
                  [
                    "coreProductId",
                    "Identity",
                    catalogQuery.data?.options.coreProducts,
                  ],
                  ["brandId", "Brand", catalogQuery.data?.options.brands],
                ] as const
              ).map(([key, label, options]) => (
                <Select
                  key={key}
                  value={filters[key]}
                  onValueChange={(value) => setFilter(key, value)}
                >
                  <SelectTrigger className="h-9 bg-white text-xs">
                    <SelectValue placeholder={label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All {label}</SelectItem>
                    {options?.map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
              <Select
                value={filters.pack}
                onValueChange={(value) => setFilter("pack", value)}
              >
                <SelectTrigger className="h-9 bg-white text-xs">
                  <SelectValue placeholder="Pack / weight" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All packs</SelectItem>
                  {catalogQuery.data?.options.packs.map((pack) => (
                    <SelectItem key={pack} value={pack}>
                      {pack}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {Object.values(filters).some((value) => value !== "all") && (
              <button
                type="button"
                onClick={() => setFilters(emptyFilters)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>

          {(heldQuery.data?.carts.length ?? 0) > 0 && (
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {heldQuery.data?.carts.map((held) => (
                <div
                  key={held.id}
                  className="flex min-w-56 items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
                >
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => restoreHeldCart(held)}
                  >
                    <div className="truncate text-sm font-semibold text-amber-950">
                      {held.heldRef}
                    </div>
                    <div className="truncate text-xs text-amber-800/70">
                      {held.customer?.name || "Walk-in"} · BDT{" "}
                      {formatMoney(held.total)}
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-amber-900"
                    disabled={!canDeleteHeldCart}
                    onClick={() => cancelHeldMutation.mutate(held.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-semibold text-[#17201c]">Available stock</h2>
              <p className="text-xs text-[#68736d]">
                Select a product to add one sell unit
              </p>
            </div>
            <span className="text-xs tabular-nums text-[#68736d]">
              {catalogQuery.data?.variants.length ?? 0} variants
            </span>
          </div>

          {catalogQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-2xl bg-white/70"
                />
              ))}
            </div>
          ) : (catalogQuery.data?.variants.length ?? 0) === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#c8c1b3] bg-white/50 text-center">
              <PackageSearch className="mb-3 h-9 w-9 text-[#89918c]" />
              <h3 className="font-semibold">No sellable stock found</h3>
              <p className="mt-1 max-w-sm text-sm text-[#68736d]">
                Try clearing filters, or configure retail prices and stock
                before opening the counter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-4">
              {catalogQuery.data?.variants.map((variant) => (
                <button
                  key={variant.variantId}
                  type="button"
                  onClick={() => addProduct(variant)}
                  className="group flex min-h-40 flex-col rounded-2xl border border-[#d8d2c6] bg-[#fffdf8] p-4 text-left shadow-[0_4px_16px_rgba(31,48,40,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-[0_12px_30px_rgba(20,72,52,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-[#e9efe9] p-2 text-emerald-800">
                      <Box className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-semibold text-[#68736d]">
                      {variant.availableQty} {variant.unitLabel}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-sm font-semibold leading-snug text-[#17201c]">
                    {variant.productName}
                  </div>
                  <div className="mt-1 truncate text-xs text-[#68736d]">
                    {variant.brandName || "Unbranded"} · {variant.pack}
                  </div>
                  <div className="mt-auto flex items-end justify-between pt-3">
                    <div>
                      <div className="text-base font-bold text-emerald-900">
                        BDT {formatMoney(variant.unitPrice)}
                      </div>
                      <div className="max-w-28 truncate font-mono text-[10px] text-[#89918c]">
                        {variant.globalSku || variant.localSku || "No SKU"}
                      </div>
                    </div>
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#10241d] text-white transition group-hover:bg-emerald-700">
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="bg-[#fffdf8] xl:sticky xl:top-0 xl:h-[calc(100vh-3rem)] xl:overflow-y-auto">
          <div className="border-b border-[#e1dbcf] p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 font-semibold text-[#17201c]">
                  <ShoppingBasket className="h-4 w-4 text-emerald-800" />{" "}
                  Current sale
                </div>
                <p className="mt-0.5 text-xs text-[#68736d]">
                  {cart.length} lines ·{" "}
                  {cart.reduce((sum, line) => sum + line.quantity, 0)} units
                </p>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-red-700"
                  onClick={resetCart}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto border-b border-[#e1dbcf] p-4 md:p-5">
            {cart.length === 0 ? (
              <div className="grid min-h-32 place-items-center text-center">
                <div>
                  <ShoppingBasket className="mx-auto mb-2 h-7 w-7 text-[#a1a7a3]" />
                  <p className="text-sm font-medium">Your cart is empty</p>
                  <p className="text-xs text-[#7d8580]">
                    Choose a product from the catalog.
                  </p>
                </div>
              </div>
            ) : (
              cart.map((line) => (
                <div
                  key={line.variantId}
                  className="rounded-xl border border-[#e1dbcf] bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {line.productName}
                      </div>
                      <div className="truncate text-xs text-[#748078]">
                        {line.variantLabel} · BDT {formatMoney(line.unitPrice)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateQuantity(line.variantId, 0)}
                      className="text-[#8c948f] hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-lg border border-[#d8d2c6]">
                      <button
                        type="button"
                        className="p-1.5"
                        onClick={() =>
                          updateQuantity(line.variantId, line.quantity - 1)
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-9 text-center text-sm font-semibold tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="p-1.5"
                        onClick={() =>
                          updateQuantity(line.variantId, line.quantity + 1)
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="font-semibold tabular-nums">
                      BDT {formatMoney(line.quantity * line.unitPrice)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-4 p-4 md:p-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-[#68736d]">
                  Customer
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-emerald-800"
                  disabled={!canCreateCustomer}
                  onClick={() => setCustomerDialog(true)}
                >
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
              <Select
                value={selectedCustomer ? `pos:${selectedCustomer.id}` : ""}
                onValueChange={(value) => {
                  const customer = customersQuery.data?.customers.find(
                    (item) => item.key === value,
                  );
                  if (customer) selectCustomerMutation.mutate(customer);
                }}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      value={customerSearch}
                      onChange={(event) =>
                        setCustomerSearch(event.target.value)
                      }
                      placeholder="Search name or phone"
                      className="h-8"
                    />
                  </div>
                  {customersQuery.data?.customers.map((customer) => (
                    <SelectItem key={customer.key} value={customer.key}>
                      {customer.name}
                      {customer.phone ? ` · ${customer.phone}` : ""}
                      {customer.source === "online" ? " · Online" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {due > 0 && selectedCustomer?.isDefault && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                  Select a named customer with phone to leave an Outstanding
                  Balance.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <AdjustmentField
                label="Discount"
                value={discount}
                onChange={setDiscount}
              />
              <AdjustmentField label="VAT" value={tax} onChange={setTax} />
            </div>

            <div className="rounded-xl bg-[#eef1ec] p-3 text-sm">
              <SummaryRow label="Subtotal" value={subtotal} />
              <SummaryRow label="Discount" value={-discountAmount} muted />
              <SummaryRow label="VAT" value={taxAmount} muted />
              <div className="my-2 border-t border-[#d3dad3]" />
              <SummaryRow label="Total" value={total} strong />
            </div>

            <div>
              <Label className="mb-2 block text-xs uppercase tracking-wide text-[#68736d]">
                Payment method
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {(["cash", "bkash", "nagad", "bank"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-semibold capitalize transition",
                      paymentMethod === method
                        ? "border-[#10241d] bg-[#10241d] text-white"
                        : "border-[#d8d2c6] bg-white hover:border-emerald-700",
                    )}
                  >
                    {method === "bkash" ? "bKash" : method}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">Tendered / Paid</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tendered}
                  onChange={(event) => setTendered(event.target.value)}
                  placeholder={formatMoney(total)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Reference</Label>
                <Input
                  value={transactionRef}
                  onChange={(event) => setTransactionRef(event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            {(due > 0 || change > 0) && (
              <div
                className={cn(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold",
                  due > 0
                    ? "bg-amber-100 text-amber-900"
                    : "bg-emerald-100 text-emerald-900",
                )}
              >
                <span>{due > 0 ? "Outstanding Balance" : "Cash change"}</span>
                <span>BDT {formatMoney(due || change)}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={
                  !canCreateSale || cart.length === 0 || holdMutation.isPending
                }
                onClick={() => holdMutation.mutate()}
              >
                <BookmarkPlus className="mr-2 h-4 w-4" /> Hold
              </Button>
              <Button
                className="flex-[1.6] bg-emerald-700 text-white hover:bg-emerald-800"
                disabled={
                  !canCreateSale || !canComplete || checkoutMutation.isPending
                }
                onClick={() => checkoutMutation.mutate()}
              >
                <Check className="mr-2 h-4 w-4" />{" "}
                {checkoutMutation.isPending ? "Completing…" : "Complete sale"}
              </Button>
            </div>
          </div>
        </aside>
      </main>

      <Dialog open={customerDialog} onOpenChange={setCustomerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add POS Customer</DialogTitle>
            <DialogDescription>
              Phone is required so Due payments stay attached to the right
              person.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={customerForm.name}
                onChange={(event) =>
                  setCustomerForm({ ...customerForm, name: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                className="mt-1"
                value={customerForm.phone}
                onChange={(event) =>
                  setCustomerForm({
                    ...customerForm,
                    phone: event.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                className="mt-1"
                value={customerForm.address}
                onChange={(event) =>
                  setCustomerForm({
                    ...customerForm,
                    address: event.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                customerForm.name.trim().length < 2 ||
                customerForm.phone.trim().length < 7 ||
                !canCreateCustomer ||
                createCustomerMutation.isPending
              }
              onClick={() => createCustomerMutation.mutate(customerForm)}
            >
              Add customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={receiptSaleId !== null}
        onOpenChange={(open) => !open && setReceiptSaleId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-emerald-700" /> Sale
              completed
            </DialogTitle>
            <DialogDescription>
              {receiptQuery.data?.sale.invoiceNo}
            </DialogDescription>
          </DialogHeader>
          {receiptQuery.data && (
            <div className="rounded-xl border bg-[#fffdf8] p-5">
              <div className="text-center">
                <div className="font-semibold">
                  {receiptQuery.data.shop.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {receiptQuery.data.shop.address}
                </div>
              </div>
              <div className="my-4 border-t border-dashed" />
              {receiptQuery.data.sale.items.map((item) => (
                <div
                  key={item.id}
                  className="mb-2 flex justify-between gap-4 text-sm"
                >
                  <span>
                    {item.productName} × {item.quantity}
                  </span>
                  <span>BDT {formatMoney(item.lineTotal)}</span>
                </div>
              ))}
              <div className="my-4 border-t border-dashed" />
              <SummaryRow
                label="Total"
                value={Number(receiptQuery.data.sale.total)}
                strong
              />
              <SummaryRow
                label="Paid"
                value={Number(receiptQuery.data.sale.paid)}
              />
              <SummaryRow
                label="Due"
                value={Number(receiptQuery.data.sale.due)}
              />
            </div>
          )}
          <DialogFooter className="grid grid-cols-3 gap-2 sm:grid-cols-3">
            <Button variant="outline" onClick={() => setReceiptSaleId(null)}>
              New sale
            </Button>
            <Button
              variant="outline"
              disabled={!receiptQuery.data}
              onClick={() =>
                receiptQuery.data &&
                downloadRetailerPosReceipt(receiptQuery.data)
              }
            >
              <Download className="mr-1 h-4 w-4" /> PDF
            </Button>
            <Button
              onClick={() => {
                if (!receiptQuery.data) return;
                const popup = window.open("", "_blank", "width=440,height=720");
                popup?.document.write(receiptHtml(receiptQuery.data));
                popup?.document.close();
                popup?.focus();
                popup?.print();
              }}
            >
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdjustmentField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Adjustment;
  onChange: (value: Adjustment) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <div className="flex">
        <Select
          value={value.mode}
          onValueChange={(mode: "fixed" | "percentage") =>
            onChange({ ...value, mode })
          }
        >
          <SelectTrigger className="w-20 rounded-r-none px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fixed">BDT</SelectItem>
            <SelectItem value="percentage">%</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          min="0"
          max={value.mode === "percentage" ? 100 : undefined}
          step="0.01"
          value={value.value || ""}
          onChange={(event) =>
            onChange({ ...value, value: Number(event.target.value || 0) })
          }
          className="rounded-l-none border-l-0"
        />
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: number;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-0.5",
        strong && "text-base font-bold",
        muted && "text-[#68736d]",
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">
        {value < 0 ? "− " : ""}BDT {formatMoney(Math.abs(value))}
      </span>
    </div>
  );
}
