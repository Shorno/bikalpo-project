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
  FileText,
  Loader2,
  Minus,
  PackageOpen,
  Pause,
  Plus,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Share2,
  ShoppingBasket,
  Trash2,
  UserRound,
  UserRoundPlus,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
import { cn } from "@/lib/utils";
import {
  createWarehousePosInvoicePdf,
  printWarehousePosInvoice,
  shareWarehousePosInvoice,
  type WarehousePosInvoiceDetail,
} from "@/lib/warehouse-pos-invoice";
import { orpc, queryClient } from "@/utils/orpc";

type CatalogVariant = {
  variantId: number;
  productId: number;
  sku: string | null;
  coreProductName: string;
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

type PosCustomer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  isDefault: boolean;
  outstanding: number;
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

function invoicePreviewElement() {
  return (
    document.querySelector<HTMLElement>("[data-invoice-preview]") ?? undefined
  );
}

function newPayment(accountId = "", received = ""): PaymentDraft {
  return { id: crypto.randomUUID(), accountId, received };
}

function InvoiceSheet({ invoice }: { invoice: WarehousePosInvoiceDetail }) {
  return (
    <article
      className="w-[760px] max-w-none rounded-xl border border-zinc-200 bg-white p-7 text-zinc-950"
      data-invoice-preview=""
    >
      <header className="flex items-start justify-between gap-6 border-b border-zinc-200 pb-5">
        <div className="flex min-w-0 items-start gap-3">
          {/* The repository logo is the configured Bikalpo fallback. */}
          <Image
            alt="Bikalpo"
            className="h-12 w-12 rounded-lg border border-zinc-200 object-cover"
            height={48}
            src="/logos/bikalpo-logo.jpg"
            width={48}
          />
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-[-0.02em]">
              BIKALPO INVOICE
            </h2>
            <p className="mt-1 text-sm font-semibold">{invoice.store.name}</p>
            {invoice.store.address ? (
              <p className="mt-0.5 max-w-[52ch] text-xs text-zinc-600">
                {invoice.store.address}
              </p>
            ) : null}
            {invoice.store.phone ? (
              <p className="text-xs text-zinc-600">
                Mobile: {invoice.store.phone}
              </p>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm font-bold tabular-nums">
            {invoice.sale.invoiceNo}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            {new Date(invoice.sale.createdAt).toLocaleString("en-BD")}
          </p>
          <Badge className="mt-2 uppercase" variant="outline">
            {invoice.sale.paymentStatus}
          </Badge>
        </div>
      </header>

      <section className="grid gap-4 border-b border-zinc-200 py-5 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Customer
          </p>
          <p className="mt-1 font-semibold">{invoice.customer.name}</p>
          {invoice.customer.address ? (
            <p className="mt-0.5 text-zinc-600">{invoice.customer.address}</p>
          ) : null}
          {invoice.customer.phone ? (
            <p className="text-zinc-600">Mobile: {invoice.customer.phone}</p>
          ) : null}
        </div>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 sm:justify-self-end">
          <dt className="text-zinc-500">Delivery method</dt>
          <dd className="text-right font-medium">
            {invoice.sale.deliveryMethod}
          </dd>
          <dt className="text-zinc-500">Responsible</dt>
          <dd className="text-right font-medium">
            {invoice.sale.responsiblePersonName || "Warehouse user"}
          </dd>
          <dt className="text-zinc-500">Sale date</dt>
          <dd className="text-right font-mono tabular-nums">
            {invoice.sale.saleDate}
          </dd>
        </dl>
      </section>

      <div className="overflow-hidden border-b border-zinc-200 py-4">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-200 bg-zinc-50 hover:bg-zinc-50">
              <TableHead className="font-mono text-[11px]">SKU</TableHead>
              <TableHead className="text-[11px]">PRODUCT / VARIANT</TableHead>
              <TableHead className="text-right text-[11px]">QTY</TableHead>
              <TableHead className="text-right text-[11px]">PRICE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.items.map((item) => (
              <TableRow className="border-zinc-200" key={item.id}>
                <TableCell className="font-mono text-xs text-zinc-600">
                  {item.sku || "—"}
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{item.productName}</p>
                  <p className="text-xs text-zinc-500">{item.variantLabel}</p>
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  {money(item.quantity)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
                  ৳{money(item.unitPrice)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="ml-auto grid max-w-sm gap-2 py-5 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">
            Items total ({invoice.items.length})
          </span>
          <span className="font-mono tabular-nums">
            ৳{money(invoice.sale.subtotal)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Discount</span>
          <span className="font-mono tabular-nums">
            − ৳{money(invoice.sale.discount)}
          </span>
        </div>
        <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold">
          <span>Grand total</span>
          <span className="font-mono tabular-nums">
            ৳{money(invoice.sale.total)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Paid amount</span>
          <span className="font-mono tabular-nums">
            ৳{money(invoice.sale.paid)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Due amount</span>
          <span className="font-mono tabular-nums">
            ৳{money(invoice.sale.due)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Return amount</span>
          <span className="font-mono tabular-nums">
            ৳{money(invoice.sale.changeAmount)}
          </span>
        </div>
      </section>

      {invoice.sale.terms || invoice.sale.note ? (
        <section className="border-t border-zinc-200 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
            Note / terms
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {invoice.sale.terms || invoice.sale.note}
          </p>
        </section>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
        <span className="font-semibold text-blue-700">
          Powered by Bikalpo.com
        </span>
        <span>Thank you for shopping with Bikalpo.</span>
      </footer>
    </article>
  );
}

export default function WarehousePosPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<number | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(
    new Set(),
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState("0");
  const [discountDialog, setDiscountDialog] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );
  const [selectedCustomerSnapshot, setSelectedCustomerSnapshot] =
    useState<PosCustomer | null>(null);
  const [customerDialog, setCustomerDialog] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerDialog, setNewCustomerDialog] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    address: "",
  });
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
  const [invoicePdf, setInvoicePdf] = useState<Blob | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const bootstrapQuery = useQuery({
    queryKey: ["warehousePos", "bootstrap"],
    queryFn: () => orpc.warehousePos.getBootstrap.call({}),
  });
  const catalogQuery = useQuery({
    queryKey: ["warehousePos", "catalog"],
    queryFn: () => orpc.warehousePos.getCatalog.call({}),
  });
  const customersQuery = useQuery({
    queryKey: ["warehousePos", "customers", customerSearch],
    queryFn: () =>
      orpc.warehousePos.searchCustomers.call({
        search: customerSearch || undefined,
      }),
  });
  const accountsQuery = useQuery({
    queryKey: ["finance", "paymentAccounts"],
    queryFn: () => orpc.finance.getPaymentAccounts.call({}),
  });
  const invoiceQuery = useQuery({
    queryKey: ["warehousePos", "invoice", invoiceSaleId],
    queryFn: () =>
      orpc.warehousePos.getSaleInvoice.call({ saleId: invoiceSaleId! }),
    enabled: invoiceSaleId !== null,
  });

  const variants = (catalogQuery.data?.variants ?? []) as CatalogVariant[];
  const customers = (customersQuery.data?.customers ?? []) as PosCustomer[];
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
  const selectedCustomer =
    customers.find((customer) => customer.id === selectedCustomerId) ??
    (selectedCustomerSnapshot?.id === selectedCustomerId
      ? selectedCustomerSnapshot
      : null) ??
    (defaultCustomer?.id === selectedCustomerId ? defaultCustomer : null);

  useEffect(() => {
    if (selectedCustomerId === null && defaultCustomer?.id) {
      setSelectedCustomerId(defaultCustomer.id);
      setSelectedCustomerSnapshot(defaultCustomer);
    }
  }, [defaultCustomer, selectedCustomerId]);

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

  const categories = useMemo(() => {
    const map = new Map<
      number,
      { id: number; name: string; subcategories: Map<number, string> }
    >();
    for (const variant of variants) {
      const category = map.get(variant.categoryId) ?? {
        id: variant.categoryId,
        name: variant.categoryName,
        subcategories: new Map<number, string>(),
      };
      category.subcategories.set(
        variant.subCategoryId,
        variant.subCategoryName,
      );
      map.set(category.id, category);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [variants]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleVariants = variants.filter((variant) => {
    if (categoryId !== null && variant.categoryId !== categoryId) return false;
    if (subCategoryId !== null && variant.subCategoryId !== subCategoryId)
      return false;
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
  const invoice = invoiceQuery.data;

  useEffect(() => {
    setInvoicePdf(null);
    if (!invoice || !invoiceDialog) return;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      const element = invoicePreviewElement();
      if (!element) return;
      void createWarehousePosInvoicePdf(element)
        .then((pdf) => {
          if (!cancelled) setInvoicePdf(pdf);
        })
        .catch((error) => {
          if (!cancelled) toast.error(errorMessage(error));
        });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [invoice, invoiceDialog]);

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
    setSelectedCustomerId(defaultCustomer?.id ?? null);
    setSelectedCustomerSnapshot(defaultCustomer);
    setPayments([newPayment(paymentAccounts[0]?.id)]);
    setTerms(defaultTerms);
    setCheckoutRequestId(crypto.randomUUID());
    searchRef.current?.focus();
  };

  const createCustomer = useMutation({
    mutationFn: () =>
      orpc.warehousePos.createCustomer.call({
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim() || undefined,
        address: customerForm.address.trim() || undefined,
        customerType: "wholesale",
      }),
    onSuccess: async (result) => {
      const created = result.customer;
      setSelectedCustomerId(created?.id ?? null);
      setSelectedCustomerSnapshot(
        created ? { ...created, outstanding: 0 } : null,
      );
      setCustomerForm({ name: "", phone: "", address: "" });
      setNewCustomerDialog(false);
      setCustomerDialog(false);
      await queryClient.invalidateQueries({
        queryKey: ["warehousePos", "customers"],
      });
      toast.success("Customer added to the order");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

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
            aria-label="Product categories"
            className="flex gap-1 overflow-x-auto p-2 xl:block xl:max-h-[calc(100vh-11rem)] xl:overflow-y-auto"
          >
            <button
              className={cn(
                "flex h-9 min-w-max items-center rounded-md px-3 text-sm font-medium transition-colors xl:w-full",
                categoryId === null
                  ? "bg-blue-700 text-white"
                  : "text-zinc-700 hover:bg-zinc-100",
              )}
              onClick={() => {
                setCategoryId(null);
                setSubCategoryId(null);
              }}
              type="button"
            >
              All products
            </button>
            {categories.map((category) => {
              const expanded = expandedCategories.has(category.id);
              return (
                <div className="min-w-max xl:min-w-0" key={category.id}>
                  <div className="flex items-center">
                    <button
                      className={cn(
                        "flex h-9 flex-1 items-center rounded-md px-3 text-left text-sm font-medium transition-colors",
                        categoryId === category.id
                          ? "bg-blue-700 text-white"
                          : "text-zinc-700 hover:bg-zinc-100",
                      )}
                      onClick={() => {
                        setCategoryId(category.id);
                        setSubCategoryId(null);
                      }}
                      type="button"
                    >
                      <span className="truncate">{category.name}</span>
                    </button>
                    {category.subcategories.size > 0 ? (
                      <button
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Collapse" : "Expand"} ${category.name}`}
                        className="hidden h-9 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 xl:flex"
                        onClick={() =>
                          setExpandedCategories((current) => {
                            const next = new Set(current);
                            if (next.has(category.id)) next.delete(category.id);
                            else next.add(category.id);
                            return next;
                          })
                        }
                        type="button"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                  {expanded ? (
                    <ul className="hidden pb-2 pl-5 xl:block">
                      {[...category.subcategories.entries()].map(
                        ([id, name]) => (
                          <li className="border-l border-zinc-200" key={id}>
                            <button
                              className={cn(
                                "w-full px-3 py-1.5 text-left text-xs transition-colors",
                                subCategoryId === id
                                  ? "font-semibold text-blue-700"
                                  : "text-zinc-500 hover:text-zinc-900",
                              )}
                              onClick={() => {
                                setCategoryId(category.id);
                                setSubCategoryId(id);
                              }}
                              type="button"
                            >
                              {name}
                            </button>
                          </li>
                        ),
                      )}
                    </ul>
                  ) : null}
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
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-sm font-bold">Order details</h2>
              <Button
                className="h-8 gap-1.5"
                onClick={() => setCustomerDialog(true)}
                size="sm"
                variant="ghost"
              >
                <UserRoundPlus className="h-4 w-4" />
                Change
              </Button>
            </div>
            <div className="flex items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                <UserRound className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {selectedCustomer?.name || "Walk-in Customer"}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {selectedCustomer?.phone || "No phone on file"}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                  <span className="text-zinc-500">Customer due</span>
                  <span className="font-mono font-bold tabular-nums">
                    ৳{money(selectedCustomer?.outstanding)}
                  </span>
                </div>
              </div>
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

      <Dialog onOpenChange={setCustomerDialog} open={customerDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Select customer</DialogTitle>
            <DialogDescription>
              Choose a customer for this counter order or add a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="pl-9"
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Search by name or phone"
              value={customerSearch}
            />
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-zinc-200">
            {customersQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading customers…
              </div>
            ) : null}
            {!customersQuery.isLoading && defaultCustomer ? (
              <button
                className="flex w-full items-center justify-between border-b border-zinc-200 p-3 text-left hover:bg-zinc-50"
                onClick={() => {
                  setSelectedCustomerId(defaultCustomer.id);
                  setSelectedCustomerSnapshot(defaultCustomer);
                  setCustomerDialog(false);
                }}
                type="button"
              >
                <span>
                  <span className="block text-sm font-semibold">
                    Walk-in Customer
                  </span>
                  <span className="text-xs text-zinc-500">
                    For fully paid counter orders
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>
            ) : null}
            {customers
              .filter((customer) => !customer.isDefault)
              .map((customer) => (
                <button
                  className="flex w-full items-center justify-between border-b border-zinc-100 p-3 text-left last:border-b-0 hover:bg-zinc-50"
                  key={customer.id}
                  onClick={() => {
                    setSelectedCustomerId(customer.id);
                    setSelectedCustomerSnapshot(customer);
                    setCustomerDialog(false);
                  }}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {customer.name}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {customer.phone || "No phone"}
                      {customer.address ? ` · ${customer.address}` : ""}
                    </span>
                  </span>
                  <span className="ml-4 shrink-0 font-mono text-xs tabular-nums">
                    Due ৳{money(customer.outstanding)}
                  </span>
                </button>
              ))}
          </div>
          <DialogFooter>
            <Button
              className="gap-2"
              onClick={() => setNewCustomerDialog(true)}
              variant="outline"
            >
              <UserRoundPlus className="h-4 w-4" />
              New customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setNewCustomerDialog} open={newCustomerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>
              A phone number is required if this customer will carry a due
              balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="customer-name">Customer name *</Label>
              <Input
                id="customer-name"
                onChange={(event) =>
                  setCustomerForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                value={customerForm.name}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                id="customer-phone"
                onChange={(event) =>
                  setCustomerForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="01XXXXXXXXX"
                value={customerForm.phone}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-address">Address</Label>
              <Textarea
                id="customer-address"
                onChange={(event) =>
                  setCustomerForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                value={customerForm.address}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setNewCustomerDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className="bg-blue-700 hover:bg-blue-800"
              disabled={
                customerForm.name.trim().length < 2 || createCustomer.isPending
              }
              onClick={() => createCustomer.mutate()}
            >
              {createCustomer.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

          <section className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">
                Selected customer
              </p>
              <p className="mt-1 truncate text-sm font-semibold">
                {selectedCustomer?.name || "Walk-in Customer"}
              </p>
            </div>
            <Button
              onClick={() => setCustomerDialog(true)}
              size="sm"
              variant="outline"
            >
              Edit customer
            </Button>
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
                    <Label>Select account *</Label>
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
                      <SelectTrigger>
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
                    <Label>Delivery method *</Label>
                    <Select
                      onValueChange={(value) =>
                        setDeliveryMethod(
                          value as (typeof deliveryMethods)[number],
                        )
                      }
                      value={deliveryMethod}
                    >
                      <SelectTrigger>
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
              <Label>Payment status *</Label>
              <Select disabled value={paymentStatus}>
                <SelectTrigger>
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

      <Dialog onOpenChange={setInvoiceDialog} open={invoiceDialog}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Invoice preview</DialogTitle>
            <DialogDescription>
              Print or share the completed invoice PDF.
            </DialogDescription>
          </DialogHeader>
          {invoiceQuery.isLoading ? (
            <div className="flex min-h-80 items-center justify-center text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Preparing invoice…
            </div>
          ) : null}
          {invoiceQuery.isError ? (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 border border-red-200 bg-red-50 text-sm text-red-700">
              <span>Invoice preview could not be loaded.</span>
              <Button
                onClick={() => invoiceQuery.refetch()}
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : null}
          {invoice ? (
            <div className="overflow-x-auto">
              <InvoiceSheet invoice={invoice} />
            </div>
          ) : null}
          {invoice && !invoicePdf ? (
            <p className="flex items-center justify-center gap-2 text-xs font-medium text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Preparing the printable PDF…
            </p>
          ) : null}
          {invoice ? (
            <DialogFooter className="sm:justify-center">
              <Button
                className="gap-2"
                disabled={!invoicePdf}
                onClick={() =>
                  invoicePdf && printWarehousePosInvoice(invoicePdf)
                }
                variant="outline"
              >
                <Printer className="h-4 w-4" />
                Print only
              </Button>
              <Button
                className="gap-2"
                disabled={!invoicePdf}
                onClick={async () => {
                  try {
                    if (!invoicePdf)
                      throw new Error("Invoice PDF is still preparing");
                    const result = await shareWarehousePosInvoice(
                      invoice,
                      invoicePdf,
                    );
                    if (result === "downloaded")
                      toast.info(
                        "Direct file sharing is unavailable, so the PDF was downloaded.",
                      );
                  } catch (error) {
                    if ((error as DOMException)?.name !== "AbortError")
                      toast.error(errorMessage(error));
                  }
                }}
                variant="outline"
              >
                <Share2 className="h-4 w-4" />
                Share PDF
              </Button>
              <Button
                className="gap-2 bg-blue-700 hover:bg-blue-800"
                disabled={!invoicePdf}
                onClick={async () => {
                  try {
                    if (!invoicePdf)
                      throw new Error("Invoice PDF is still preparing");
                    await shareWarehousePosInvoice(invoice, invoicePdf);
                    printWarehousePosInvoice(invoicePdf);
                  } catch (error) {
                    if ((error as DOMException)?.name !== "AbortError")
                      toast.error(errorMessage(error));
                  }
                }}
              >
                <FileText className="h-4 w-4" />
                Print &amp; share
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
