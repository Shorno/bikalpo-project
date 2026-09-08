"use client";

import {
  calculatePosPaymentTotals,
  calculatePosSplitPayments,
} from "@bikalpo-project/api/services/owner-pos";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Loader2,
  Minus,
  PackageOpen,
  Pause,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBasket,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  type PosCustomer,
  PosCustomerEntry,
} from "@/components/warehouse/pos-customer-entry";
import { PosInvoiceDialog } from "@/components/warehouse/pos-invoice-dialog";
import { cn } from "@/lib/utils";
import {
  buildPosTypeTree,
  matchesPosTypeSelection,
  type PosCatalogSelection,
} from "@/lib/warehouse-pos-catalog";
import { orpc, queryClient } from "@/utils/orpc";

type CatalogVariant = {
  variantId: number;
  productId: number;
  sku: string | null;
  coreProductName: string;
  typeId: number;
  typeName: string;
  categoryId: number;
  categoryName: string;
  subCategoryId: number;
  subCategoryName: string;
  brandName: string;
  pack: string;
  variantLabel: string;
  unitLabel: string;
  allowsDecimal: boolean;
  availableQty: number;
  unitPrice: number;
};

type CartItem = CatalogVariant & { quantity: number };

type PaymentAccount = {
  id: string;
  name: string;
  type: "cash" | "bank";
  balance: number;
  isDefault: boolean;
};

type PaymentDraft = { id: string; accountId: string; received: string };

const deliveryMethods = ["Self Pickup", "Courier", "Own Delivery"] as const;
const defaultTerms =
  "Please verify product quantity, packaging, and condition before leaving the counter.";

function toNumericAmount(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumericAmount(value));
}

function localDateInput() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function newPayment(accountId = "", received = ""): PaymentDraft {
  return { id: crypto.randomUUID(), accountId, received };
}

export default function WarehousePosPage() {
  const [search, setSearch] = useState("");
  const [catalogSelection, setCatalogSelection] =
    useState<PosCatalogSelection>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<number>>(new Set());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [discountDialog, setDiscountDialog] = useState(false);
  const [selectedCustomerSnapshot, setSelectedCustomerSnapshot] =
    useState<PosCustomer | null>(null);
  const [checkoutDialog, setCheckoutDialog] = useState(false);
  const [payments, setPayments] = useState<PaymentDraft[]>([newPayment()]);
  const [deliveryMethod, setDeliveryMethod] =
    useState<(typeof deliveryMethods)[number]>("Self Pickup");
  const [saleDate, setSaleDate] = useState(localDateInput());
  const [terms, setTerms] = useState(defaultTerms);
  const [checkoutRequestId, setCheckoutRequestId] = useState(() =>
    crypto.randomUUID(),
  );
  const [invoiceSaleId, setInvoiceSaleId] = useState<number | null>(null);
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const bootstrapQuery = useQuery({
    queryKey: ["warehousePos", "bootstrap"],
    queryFn: () => orpc.warehousePos.getBootstrap.call({}),
  });
  const catalogQuery = useQuery({
    queryKey: ["warehousePos", "catalog"],
    queryFn: () => orpc.warehousePos.getCatalog.call({}),
  });
  const accountsQuery = useQuery({
    queryKey: ["finance", "paymentAccounts"],
    queryFn: () => orpc.finance.getPaymentAccounts.call({}),
  });

  const variants = (catalogQuery.data?.variants ?? []) as CatalogVariant[];
  const paymentAccounts = (accountsQuery.data?.paymentAccounts ??
    []) as PaymentAccount[];
  const defaultCustomer = useMemo(
    () =>
      bootstrapQuery.data?.defaultCustomer
        ? ({
            ...bootstrapQuery.data.defaultCustomer,
            address: null,
            isDefault: true,
            outstanding: 0,
          } as PosCustomer)
        : null,
    [bootstrapQuery.data?.defaultCustomer],
  );
  const selectedCustomerId = selectedCustomerSnapshot?.id;
  const selectedCustomerQuery = useQuery({
    queryKey: ["warehousePos", "customers", "selected", selectedCustomerId],
    queryFn: () =>
      orpc.warehousePos.searchCustomers.call({
        customerId: selectedCustomerId!,
      }),
    enabled:
      selectedCustomerId !== undefined && !selectedCustomerSnapshot?.isDefault,
  });
  const selectedCustomer =
    selectedCustomerQuery.data?.customers.find(
      (customer) => customer.id === selectedCustomerId,
    ) ??
    selectedCustomerSnapshot ??
    defaultCustomer;

  useEffect(() => {
    if (paymentAccounts.length === 0) return;
    setPayments((current) =>
      current.map((payment, index) =>
        payment.accountId
          ? payment
          : {
              ...payment,
              accountId: paymentAccounts[index]?.id ?? paymentAccounts[0]!.id,
            },
      ),
    );
  }, [paymentAccounts]);

  const productTypes = useMemo(() => buildPosTypeTree(variants), [variants]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleVariants = variants.filter((variant) => {
    if (!matchesPosTypeSelection(variant, catalogSelection)) return false;
    if (!normalizedSearch) return true;
    return [
      variant.sku,
      variant.coreProductName,
      variant.brandName,
      variant.pack,
      variant.variantLabel,
    ].some((value) => value?.toLowerCase().includes(normalizedSearch));
  });

  const subtotal = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const discountAmount = Math.min(
    subtotal,
    Math.max(0, toNumericAmount(discount)),
  );
  const payable = Math.max(0, subtotal - discountAmount);
  let paymentValidationError: string | null = null;
  const receivedAmounts = payments.map((payment) =>
    Math.max(0, toNumericAmount(payment.received)),
  );
  const splitPayment = calculatePosPaymentTotals({
    payableTotal: payable,
    receivedAmounts,
  });
  if (payments.every((payment) => payment.accountId)) {
    try {
      calculatePosSplitPayments({
        payableTotal: payable,
        payments: payments.map((payment, index) => {
          const account = paymentAccounts.find(
            (candidate) => candidate.id === payment.accountId,
          );
          if (!account) throw new Error("Select a valid payment account");
          return {
            accountId: Number(account.id),
            accountType: account.type,
            receivedAmount: receivedAmounts[index] ?? 0,
          };
        }),
      });
    } catch (error) {
      paymentValidationError = errorMessage(error);
    }
  }
  const received = splitPayment.receivedTotal;
  const change = splitPayment.change;
  const due = splitPayment.due;
  const paymentStatus = splitPayment.paymentStatus;

  const addVariant = (variant: CatalogVariant) => {
    setCart((current) => {
      const existing = current.find(
        (item) => item.variantId === variant.variantId,
      );
      if (existing) {
        if (existing.quantity + 1 > variant.availableQty) {
          toast.error(
            `Only ${money(variant.availableQty)} ${variant.unitLabel} available`,
          );
          return current;
        }
        return current.map((item) =>
          item.variantId === variant.variantId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...current, { ...variant, quantity: 1 }];
    });
  };

  const updateQuantity = (variantId: number, next: number) => {
    setCart((current) =>
      current.flatMap((item) => {
        if (item.variantId !== variantId) return [item];
        if (next <= 0) return [];
        const normalized = item.allowsDecimal ? next : Math.floor(next);
        if (normalized > item.availableQty) {
          toast.error(
            `Only ${money(item.availableQty)} ${item.unitLabel} available`,
          );
          return [item];
        }
        return [{ ...item, quantity: normalized }];
      }),
    );
  };

  const resetDraft = () => {
    if (cart.length > 0 && !window.confirm("Reset this POS draft?")) return;
    setCart([]);
    setDiscount("0");
    setSelectedCustomerSnapshot(defaultCustomer);
    setPayments([newPayment(paymentAccounts[0]?.id)]);
    setTerms(defaultTerms);
    setDeliveryMethod("Self Pickup");
    setSaleDate(localDateInput());
    setCheckoutRequestId(crypto.randomUUID());
    searchRef.current?.focus();
  };

  const holdOrder = useMutation({
    mutationFn: () =>
      orpc.warehousePos.holdCart.call({
        saleType: "wholesale",
        customerId: selectedCustomer?.id,
        discount: discountAmount,
        tax: 0,
        note: terms || undefined,
        items: cart.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      }),
    onSuccess: () => {
      toast.success(
        "Order held. Stock and price will be checked again at checkout.",
      );
      setCart([]);
      setDiscount("0");
      setCheckoutRequestId(crypto.randomUUID());
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const completeOrder = useMutation({
    mutationFn: () =>
      orpc.warehousePos.completeSale.call({
        checkoutRequestId,
        customerId: selectedCustomer?.id,
        discount: discountAmount,
        deliveryMethod,
        paymentStatus,
        saleDate,
        terms: terms || undefined,
        payments: payments.map((payment) => ({
          paymentAccountId: Number(payment.accountId),
          receivedAmount: Math.max(0, toNumericAmount(payment.received)),
        })),
        items: cart.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      }),
    onSuccess: async (result) => {
      setInvoiceSaleId(result.saleId);
      setCheckoutDialog(false);
      setInvoiceDialog(true);
      setCart([]);
      setDiscount("0");
      setPayments([newPayment(paymentAccounts[0]?.id)]);
      setCheckoutRequestId(crypto.randomUUID());
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["warehousePos", "catalog"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["warehousePos", "customers"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["finance", "paymentAccounts"],
        }),
      ]);
      toast.success(
        result.duplicate
          ? "Order was already submitted"
          : `Invoice ${result.invoiceNo} created`,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const openCheckout = () => {
    if (cart.length === 0)
      return toast.error("Add at least one product before placing the order");
    if (paymentAccounts.length === 0)
      return toast.error(
        "Create an active cash or bank account in Finance first",
      );
    setPayments((current) => {
      if (current.length !== 1 || current[0]?.received) return current;
      return [
        {
          ...current[0],
          accountId: current[0].accountId || paymentAccounts[0]!.id,
          received: String(payable),
        },
      ];
    });
    setCheckoutDialog(true);
  };

  const addPaymentRow = () => {
    const used = new Set(payments.map((payment) => payment.accountId));
    const next = paymentAccounts.find((account) => !used.has(account.id));
    if (!next) return toast.error("No other payment account is available");
    setPayments((current) => [...current, newPayment(next.id, "0")]);
  };

  const canSubmit =
    cart.length > 0 &&
    payments.every(
      (payment) => payment.accountId && toNumericAmount(payment.received) >= 0,
    ) &&
    new Set(payments.map((payment) => payment.accountId)).size ===
      payments.length &&
    !paymentValidationError &&
    (due === 0 ||
      Boolean(
        selectedCustomer &&
          !selectedCustomer.isDefault &&
          selectedCustomer.phone,
      ));

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-zinc-50 text-zinc-950">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white">
            <ReceiptText aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-[-0.02em]">
              Point of Sale
            </h1>
            <p className="text-xs text-zinc-500">Counter order registry</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <p className="font-semibold">
              Welcome, {bootstrapQuery.data?.welcomeName || "Warehouse user"}
            </p>
            <p className="flex items-center justify-end gap-1.5 text-xs text-zinc-500">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
              {new Date().toLocaleDateString("en-BD", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 xl:min-h-0 xl:grid-cols-[190px_minmax(0,1fr)_320px]">
        <aside className="border-b border-zinc-200 bg-white xl:border-b-0 xl:border-r">
          <div className="border-b border-zinc-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Catalog
            </p>
          </div>
          <nav
            aria-label="Product types and variants"
            className="max-h-64 space-y-1 overflow-y-auto p-2 xl:max-h-[calc(100vh-11rem)]"
          >
            <button
              className={cn(
                "flex min-h-10 w-full items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
                catalogSelection === null
                  ? "bg-blue-700 text-white"
                  : "text-zinc-700 hover:bg-zinc-100",
              )}
              aria-pressed={catalogSelection === null}
              onClick={() => setCatalogSelection(null)}
              type="button"
            >
              All
            </button>
            {productTypes.map((productType) => {
              const expanded = expandedTypes.has(productType.id);
              const selected = catalogSelection?.typeId === productType.id;
              return (
                <div key={productType.id}>
                  <button
                    aria-expanded={expanded}
                    aria-controls={`pos-type-${productType.id}-variants`}
                    aria-pressed={selected && catalogSelection.pack === null}
                    className={cn(
                      "flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
                      selected
                        ? "bg-blue-700 text-white"
                        : "text-zinc-700 hover:bg-zinc-100",
                    )}
                    onClick={() => {
                      setCatalogSelection({
                        typeId: productType.id,
                        pack: null,
                      });
                      setExpandedTypes((current) => {
                        const next = new Set(current);
                        if (
                          expanded &&
                          selected &&
                          catalogSelection.pack === null
                        )
                          next.delete(productType.id);
                        else next.add(productType.id);
                        return next;
                      });
                    }}
                    type="button"
                  >
                    {expanded ? (
                      <ChevronDown
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                    ) : (
                      <ChevronRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                    )}
                    <span className="break-words">{productType.name}</span>
                  </button>
                  <ul
                    id={`pos-type-${productType.id}-variants`}
                    hidden={!expanded}
                    className="pb-2 pl-6"
                  >
                    {productType.packs.map((pack) => (
                      <li className="border-l border-zinc-200" key={pack}>
                        <button
                          aria-pressed={
                            selected && catalogSelection.pack === pack
                          }
                          className={cn(
                            "min-h-10 w-full rounded-r-md px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700",
                            selected && catalogSelection.pack === pack
                              ? "bg-blue-50 font-semibold text-blue-700"
                              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                          )}
                          onClick={() => {
                            setCatalogSelection({
                              typeId: productType.id,
                              pack,
                            });
                          }}
                          type="button"
                        >
                          {pack}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-col bg-white xl:min-h-0">
          <section className="border-b border-zinc-200 p-4">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              />
              <Input
                aria-label="Search or scan product"
                className="h-11 border-zinc-300 bg-white pl-10 pr-10 text-sm"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  const exact = variants.find(
                    (variant) =>
                      variant.sku?.toLowerCase() ===
                      search.trim().toLowerCase(),
                  );
                  if (exact) {
                    addVariant(exact);
                    setSearch("");
                  }
                }}
                placeholder="Search / Scan Product"
                ref={searchRef}
                value={search}
              />
              {search ? (
                <button
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  onClick={() => setSearch("")}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {catalogQuery.isLoading ? (
                <div className="flex h-24 w-full items-center justify-center text-sm text-zinc-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading stock…
                </div>
              ) : catalogQuery.isError ? (
                <div className="flex h-24 w-full items-center justify-between border border-red-200 bg-red-50 px-4 text-sm text-red-700">
                  <span>Products could not be loaded.</span>
                  <Button
                    onClick={() => catalogQuery.refetch()}
                    size="sm"
                    variant="outline"
                  >
                    Retry
                  </Button>
                </div>
              ) : visibleVariants.length === 0 ? (
                <div className="flex h-24 w-full items-center justify-center text-sm text-zinc-500">
                  No in-stock products match this view.
                </div>
              ) : (
                visibleVariants.map((variant) => {
                  const inCart = cart.find(
                    (item) => item.variantId === variant.variantId,
                  );
                  return (
                    <button
                      className={cn(
                        "group relative min-h-24 w-44 shrink-0 rounded-lg border bg-white p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                        inCart
                          ? "border-blue-600 bg-blue-50"
                          : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50",
                      )}
                      key={variant.variantId}
                      onClick={() => addVariant(variant)}
                      type="button"
                    >
                      <p className="truncate text-sm font-semibold">
                        {variant.brandName || variant.coreProductName}
                      </p>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {variant.coreProductName} · {variant.pack}
                      </p>
                      <div className="mt-3 flex items-end justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-blue-700 tabular-nums">
                          ৳{money(variant.unitPrice)}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                          Stock {money(variant.availableQty)}
                        </span>
                      </div>
                      {inCart ? (
                        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-700 px-1 font-mono text-[10px] font-bold text-white">
                          {money(inCart.quantity)}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section
            aria-labelledby="item-entry-heading"
            className="flex flex-1 flex-col xl:min-h-0"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-bold" id="item-entry-heading">
                  Item entry
                </h2>
                <p className="text-xs text-zinc-500">
                  {cart.length} distinct {cart.length === 1 ? "item" : "items"}
                </p>
              </div>
              {cart.length ? (
                <span className="font-mono text-xs text-zinc-500 tabular-nums">
                  Subtotal ৳{money(subtotal)}
                </span>
              ) : null}
            </div>
            <div className="overflow-auto xl:flex-1">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-zinc-50">
                  <TableRow className="border-zinc-200 hover:bg-zinc-50">
                    <TableHead className="w-32 font-mono text-[11px]">
                      SKU
                    </TableHead>
                    <TableHead className="text-[11px]">PRODUCT</TableHead>
                    <TableHead className="text-[11px]">VARIANT</TableHead>
                    <TableHead className="w-40 text-center text-[11px]">
                      QTY
                    </TableHead>
                    <TableHead className="w-28 text-right text-[11px]">
                      TOTAL
                    </TableHead>
                    <TableHead className="w-14">
                      <span className="sr-only">Remove</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cart.length === 0 ? (
                    <TableRow className="hover:bg-white">
                      <TableCell colSpan={6}>
                        <div className="flex min-h-64 flex-col items-center justify-center text-center">
                          <PackageOpen className="h-8 w-8 text-zinc-300" />
                          <p className="mt-3 text-sm font-semibold">
                            No items entered
                          </p>
                          <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-500">
                            Choose a product card above or scan an exact SKU to
                            begin this counter order.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cart.map((item) => (
                      <TableRow
                        className="border-zinc-200"
                        key={item.variantId}
                      >
                        <TableCell className="font-mono text-xs text-zinc-500">
                          {item.sku || "—"}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.coreProductName}
                        </TableCell>
                        <TableCell className="text-sm text-zinc-600">
                          {item.brandName ? `${item.brandName} · ` : ""}
                          {item.variantLabel}
                        </TableCell>
                        <TableCell>
                          <div className="mx-auto flex w-fit items-center overflow-hidden rounded-md border border-zinc-200">
                            <button
                              aria-label={`Decrease ${item.coreProductName}`}
                              className="flex h-8 w-8 items-center justify-center hover:bg-zinc-100"
                              onClick={() =>
                                updateQuantity(
                                  item.variantId,
                                  item.quantity - 1,
                                )
                              }
                              type="button"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              aria-label={`${item.coreProductName} quantity`}
                              className="h-8 w-16 border-x border-zinc-200 text-center font-mono text-xs tabular-nums outline-none"
                              max={item.availableQty}
                              min={item.allowsDecimal ? 0.01 : 1}
                              onChange={(event) =>
                                updateQuantity(
                                  item.variantId,
                                  toNumericAmount(event.target.value),
                                )
                              }
                              step={item.allowsDecimal ? 0.01 : 1}
                              type="number"
                              value={item.quantity}
                            />
                            <button
                              aria-label={`Increase ${item.coreProductName}`}
                              className="flex h-8 w-8 items-center justify-center hover:bg-zinc-100"
                              onClick={() =>
                                updateQuantity(
                                  item.variantId,
                                  item.quantity + 1,
                                )
                              }
                              type="button"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold tabular-nums">
                          ৳{money(item.quantity * item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            aria-label={`Remove ${item.coreProductName}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 hover:text-red-800"
                            onClick={() => updateQuantity(item.variantId, 0)}
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </main>

        <aside className="border-t border-zinc-200 bg-zinc-50 xl:border-l xl:border-t-0">
          <section className="border-b border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-bold">Order details</h2>
            </div>
            <div className="p-4">
              <PosCustomerEntry
                selectedCustomer={selectedCustomer}
                defaultCustomer={defaultCustomer}
                onSelect={setSelectedCustomerSnapshot}
              />
            </div>
          </section>

          <section className="bg-white">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-bold">Payment summary</h2>
            </div>
            <dl className="space-y-3 p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="font-mono tabular-nums">৳{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Discount</dt>
                <dd className="font-mono tabular-nums">
                  − ৳{money(discountAmount)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-3 text-base font-bold">
                <dt>Grand total</dt>
                <dd className="font-mono text-blue-700 tabular-nums">
                  ৳{money(payable)}
                </dd>
              </div>
            </dl>
            <button
              className="flex w-full items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
              onClick={() => setDiscountDialog(true)}
              type="button"
            >
              <span>Edit discount</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </section>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-white px-4 py-3 lg:px-6">
        <div className="flex flex-wrap gap-2">
          <Button className="gap-2" onClick={resetDraft} variant="outline">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            className="gap-2"
            disabled={cart.length === 0 || holdOrder.isPending}
            onClick={() => holdOrder.mutate()}
            variant="outline"
          >
            {holdOrder.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            Hold order
          </Button>
          <Button
            className="gap-2 bg-blue-700 hover:bg-blue-800"
            disabled={cart.length === 0}
            onClick={openCheckout}
          >
            <ShoppingBasket className="h-4 w-4" />
            Place order
          </Button>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Payable total
          </span>
          <span className="font-mono text-xl font-extrabold text-blue-700 tabular-nums">
            ৳{money(payable)}
          </span>
        </div>
      </footer>

      <Dialog onOpenChange={setDiscountDialog} open={discountDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit discount</DialogTitle>
            <DialogDescription>
              Apply one fixed discount to this counter order.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="discount">Discount amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                ৳
              </span>
              <Input
                className="pl-8 font-mono tabular-nums"
                id="discount"
                max={subtotal}
                min="0"
                onChange={(event) => setDiscount(event.target.value)}
                type="number"
                value={discount}
              />
            </div>
            <p className="text-xs text-zinc-500">Maximum ৳{money(subtotal)}</p>
          </div>
          <DialogFooter>
            <Button
              className="bg-blue-700 hover:bg-blue-800"
              onClick={() => setDiscountDialog(false)}
            >
              Apply discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setCheckoutDialog} open={checkoutDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Complete order</DialogTitle>
            <DialogDescription>
              Review the customer and allocate the received amount before
              submitting.
            </DialogDescription>
          </DialogHeader>

          <section className="rounded-lg border border-zinc-200 bg-white p-3">
            <PosCustomerEntry
              selectedCustomer={selectedCustomer}
              defaultCustomer={defaultCustomer}
              onSelect={setSelectedCustomerSnapshot}
            />
          </section>

          <section className="mt-2">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Payments</h3>
                <p className="text-xs text-zinc-500">
                  Split the received amount across finance accounts.
                </p>
              </div>
              <Button
                className="gap-2"
                disabled={payments.length >= paymentAccounts.length}
                onClick={addPaymentRow}
                size="sm"
                variant="outline"
              >
                <CirclePlus className="h-4 w-4" />
                Add more
              </Button>
            </div>
            <div className="grid gap-3">
              {payments.map((payment, index) => (
                <div
                  className="grid gap-3 rounded-lg border border-zinc-200 p-3 md:grid-cols-[1fr_1.25fr_1fr_auto]"
                  key={payment.id}
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor={`received-${payment.id}`}>
                      Received amount *
                    </Label>
                    <Input
                      className="font-mono tabular-nums"
                      id={`received-${payment.id}`}
                      min="0"
                      onChange={(event) =>
                        setPayments((current) =>
                          current.map((row) =>
                            row.id === payment.id
                              ? { ...row, received: event.target.value }
                              : row,
                          ),
                        )
                      }
                      type="number"
                      value={payment.received}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`payment-account-${payment.id}`}>
                      Select account *
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        setPayments((current) =>
                          current.map((row) =>
                            row.id === payment.id
                              ? { ...row, accountId: value }
                              : row,
                          ),
                        )
                      }
                      value={payment.accountId}
                    >
                      <SelectTrigger id={`payment-account-${payment.id}`}>
                        <SelectValue placeholder="Select finance account" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentAccounts.map((account) => (
                          <SelectItem
                            disabled={payments.some(
                              (row) =>
                                row.id !== payment.id &&
                                row.accountId === account.id,
                            )}
                            key={account.id}
                            value={account.id}
                          >
                            {account.name} · ৳{money(account.balance)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`delivery-method-${payment.id}`}>
                      Delivery method *
                    </Label>
                    <Select
                      onValueChange={(value) =>
                        setDeliveryMethod(
                          value as (typeof deliveryMethods)[number],
                        )
                      }
                      value={deliveryMethod}
                    >
                      <SelectTrigger id={`delivery-method-${payment.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {deliveryMethods.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      aria-label={`Remove payment ${index + 1}`}
                      disabled={payments.length === 1}
                      onClick={() =>
                        setPayments((current) =>
                          current.filter((row) => row.id !== payment.id),
                        )
                      }
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 border-y border-zinc-200 py-4 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="payment-status">Payment status *</Label>
              <Select disabled value={paymentStatus}>
                <SelectTrigger id="payment-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="due">Due</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="responsible-person">Responsible person</Label>
              <Input
                id="responsible-person"
                readOnly
                value={bootstrapQuery.data?.welcomeName || "Warehouse user"}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sale-date">Date *</Label>
              <Input
                id="sale-date"
                onChange={(event) => setSaleDate(event.target.value)}
                type="date"
                value={saleDate}
              />
            </div>
          </section>

          <div className="grid gap-2">
            <Label htmlFor="terms">
              Notes / terms & conditions{" "}
              <span className="font-normal text-zinc-500">
                (shown on invoice)
              </span>
            </Label>
            <Textarea
              className="min-h-24 resize-y"
              id="terms"
              maxLength={3000}
              onChange={(event) => setTerms(event.target.value)}
              value={terms}
            />
          </div>

          {due > 0 && selectedCustomer?.isDefault ? (
            <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Select a named customer with a phone number before submitting an
              order with due ৳{money(due)}.
            </div>
          ) : null}
          {paymentValidationError ? (
            <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {paymentValidationError}
            </div>
          ) : null}

          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 md:grid-cols-4">
            {[
              { label: "Payable total", value: payable },
              { label: "Received", value: received },
              { label: "Change", value: change },
              { label: "Due", value: due },
            ].map((metric) => (
              <div className="bg-white p-4" key={metric.label}>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                  {metric.label}
                </p>
                <p className="mt-2 font-mono text-xl font-extrabold tabular-nums">
                  ৳{money(metric.value)}
                </p>
              </div>
            ))}
          </section>

          <DialogFooter>
            <Button onClick={() => setCheckoutDialog(false)} variant="outline">
              Cancel
            </Button>
            <Button
              className="min-w-28 bg-blue-700 hover:bg-blue-800"
              disabled={!canSubmit || completeOrder.isPending}
              onClick={() => completeOrder.mutate()}
            >
              {completeOrder.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PosInvoiceDialog
        open={invoiceDialog}
        onOpenChange={setInvoiceDialog}
        saleId={invoiceSaleId}
      />
    </div>
  );
}
