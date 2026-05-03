"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Barcode,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Loader2,
  Package,
  Plus,
  ReceiptText,
  Save,
  Search,
  Trash2,
  Truck,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

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

type PurchaseRow = {
  rowId: string;
  variantId?: number;
  sku: string;
  productName: string;
  unitSize: string;
  qty: string;
  totalPrice: string;
  unitLabel: string;
  variantLabel?: string;
  brandName?: string;
  pack?: string;
  unitLinePrice?: string;
};

type SupplierOption = {
  id: number;
  name: string;
  company?: string | null;
  phone?: string | null;
  currentPayable?: string | null;
};

type ExpenseCategory = {
  id: number;
  name: string;
  slug: string;
};

type PurchasePaymentMethod = "cash" | "bkash" | "bank" | "due";
type PaymentAccount = "cash" | "bank";

const PURCHASE_DRAFT_KEY = "warehouse.quickPurchase.draft.v2";
const EXPENSE_DRAFT_KEY = "warehouse.quickPurchase.expenseDraft.v2";

const paymentMethods: Array<{
  key: PurchasePaymentMethod;
  label: string;
  activeClass: string;
}> = [
  {
    key: "cash",
    label: "Cash",
    activeClass: "bg-emerald-600 text-white border-emerald-600",
  },
  {
    key: "bkash",
    label: "bKash",
    activeClass: "bg-pink-600 text-white border-pink-600",
  },
  {
    key: "bank",
    label: "Bank",
    activeClass: "bg-blue-600 text-white border-blue-600",
  },
  {
    key: "due",
    label: "Due",
    activeClass: "bg-red-600 text-white border-red-600",
  },
];

const expenseTypes = ["Transport", "Salary", "Rent", "Utility"];

function todayInputDate() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function parseNumeric(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseUnitSize(value: string) {
  const match = value.match(/[\d.]+/);
  return parseNumeric(match?.[0] ?? "0");
}

function getUnitLabel(unitSize: string, fallback = "KG") {
  const label = unitSize.replace(/[\d.\s]/g, "").trim();
  return (label || fallback || "KG").toUpperCase();
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatQuantity(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatInputNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function makeRowId() {
  return `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyRow(): PurchaseRow {
  return {
    rowId: makeRowId(),
    sku: "",
    productName: "",
    unitSize: "",
    qty: "",
    totalPrice: "",
    unitLabel: "KG",
  };
}

function mapPaymentMethodForSupplier(method: PurchasePaymentMethod) {
  if (method === "bank") return "bank" as const;
  if (method === "bkash") return "mobile_banking" as const;
  return "cash" as const;
}

export default function WarehouseQuickPurchasePage() {
  const queryClient = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [selectionMode, setSelectionMode] = useState<"search" | "manual">(
    "manual",
  );
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeId, setTypeId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [subCategoryId, setSubCategoryId] = useState<number | undefined>(
    undefined,
  );
  const [coreProductId, setCoreProductId] = useState<number | undefined>(
    undefined,
  );
  const [brandId, setBrandId] = useState<number | undefined>(undefined);
  const [pack, setPack] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<PurchaseRow[]>([]);
  const [discountInput, setDiscountInput] = useState("0");
  const [taxInput, setTaxInput] = useState("0");
  const [deliveryInput, setDeliveryInput] = useState("0");
  const [supplierId, setSupplierId] = useState<number | undefined>(undefined);
  const [purchaseDate, setPurchaseDate] = useState(todayInputDate());
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentAccount, setPaymentAccount] = useState<
    PaymentAccount | undefined
  >(undefined);
  const [paymentMethod, setPaymentMethod] = useState<
    PurchasePaymentMethod | undefined
  >(undefined);
  const [paidInput, setPaidInput] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState<
    number | undefined
  >(undefined);
  const [ledgerAccountId, setLedgerAccountId] = useState<number | undefined>(
    undefined,
  );
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayInputDate());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText), 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const catalogQuery = useQuery({
    queryKey: [
      "warehouseQuickPurchase",
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

  const suppliersQuery = useQuery({
    queryKey: ["warehouseQuickPurchase", "suppliers"],
    queryFn: () => orpc.purchase.getSuppliers.call({}),
  });

  const expenseCategoriesQuery = useQuery({
    queryKey: ["warehouseQuickPurchase", "expenseCategories"],
    queryFn: () => orpc.expense.getCategories.call({}),
  });

  const options = catalogQuery.data?.options;
  const variants = (catalogQuery.data?.variants ?? []) as CatalogVariant[];
  const suppliers = (suppliersQuery.data ?? []) as SupplierOption[];
  const expenseCategories = (expenseCategoriesQuery.data ??
    []) as ExpenseCategory[];

  useEffect(() => {
    const saved = window.localStorage.getItem(PURCHASE_DRAFT_KEY);
    if (!saved) return;

    try {
      const draft = JSON.parse(saved) as {
        items?: PurchaseRow[];
        discountInput?: string;
        taxInput?: string;
        deliveryInput?: string;
        supplierId?: number;
        purchaseDate?: string;
        referenceNo?: string;
        paymentAccount?: PaymentAccount;
        paymentMethod?: PurchasePaymentMethod;
        paidInput?: string;
        purchaseNote?: string;
      };

      if (draft.items?.length) setItems(draft.items);
      if (draft.discountInput !== undefined)
        setDiscountInput(draft.discountInput);
      if (draft.taxInput !== undefined) setTaxInput(draft.taxInput);
      if (draft.deliveryInput !== undefined)
        setDeliveryInput(draft.deliveryInput);
      if (draft.supplierId) setSupplierId(draft.supplierId);
      if (draft.purchaseDate) setPurchaseDate(draft.purchaseDate);
      if (draft.referenceNo !== undefined) setReferenceNo(draft.referenceNo);
      if (draft.paymentAccount) setPaymentAccount(draft.paymentAccount);
      if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      if (draft.paidInput !== undefined) setPaidInput(draft.paidInput);
      if (draft.purchaseNote !== undefined) setPurchaseNote(draft.purchaseNote);
    } catch {
      window.localStorage.removeItem(PURCHASE_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(EXPENSE_DRAFT_KEY);
    if (!saved) return;

    try {
      const draft = JSON.parse(saved) as {
        expenseType?: string;
        expenseCategoryId?: number;
        ledgerAccountId?: number;
        expenseAmount?: string;
        expenseNote?: string;
        expenseDate?: string;
      };

      if (draft.expenseType) setExpenseType(draft.expenseType);
      if (draft.expenseCategoryId)
        setExpenseCategoryId(draft.expenseCategoryId);
      if (draft.ledgerAccountId) setLedgerAccountId(draft.ledgerAccountId);
      if (draft.expenseAmount !== undefined)
        setExpenseAmount(draft.expenseAmount);
      if (draft.expenseNote !== undefined) setExpenseNote(draft.expenseNote);
      if (draft.expenseDate) setExpenseDate(draft.expenseDate);
    } catch {
      window.localStorage.removeItem(EXPENSE_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (!options) return;

    if (typeId && !options.types.some((option) => option.id === typeId)) {
      setTypeId(undefined);
    }
    if (
      categoryId &&
      !options.categories.some((option) => option.id === categoryId)
    ) {
      setCategoryId(undefined);
    }
    if (
      subCategoryId &&
      !options.subCategories.some((option) => option.id === subCategoryId)
    ) {
      setSubCategoryId(undefined);
    }
    if (
      coreProductId &&
      !options.coreProducts.some((option) => option.id === coreProductId)
    ) {
      setCoreProductId(undefined);
    }
    if (brandId && !options.brands.some((option) => option.id === brandId)) {
      setBrandId(undefined);
    }
    if (pack && !options.packs.includes(pack)) {
      setPack(undefined);
    }
  }, [
    options,
    typeId,
    categoryId,
    subCategoryId,
    coreProductId,
    brandId,
    pack,
  ]);

  useEffect(() => {
    if (
      expenseCategoryId &&
      !expenseCategories.some((category) => category.id === expenseCategoryId)
    ) {
      setExpenseCategoryId(undefined);
    }
    if (
      ledgerAccountId &&
      !expenseCategories.some((category) => category.id === ledgerAccountId)
    ) {
      setLedgerAccountId(undefined);
    }
  }, [expenseCategories, expenseCategoryId, ledgerAccountId]);

  useEffect(() => {
    if (paymentMethod === "due") {
      setPaidInput("0");
    }
  }, [paymentMethod]);

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === supplierId,
  );
  const selectedBrand = options?.brands.find(
    (brand: CatalogOption) => brand.id === brandId,
  );
  const selectedVariant =
    brandId && pack
      ? variants.find(
          (variant) => variant.brandId === brandId && variant.pack === pack,
        )
      : undefined;
  const finalVariantLabel = [selectedBrand?.name, pack]
    .filter(Boolean)
    .join(" + ");

  const rowsWithTotals = useMemo(
    () =>
      items.map((item) => {
        const unitQty = parseUnitSize(item.unitSize);
        const qty = parseNumeric(item.qty);
        const totalQty = unitQty * qty;
        const totalPrice = parseNumeric(item.totalPrice);
        const unitCost = totalQty > 0 ? totalPrice / totalQty : totalPrice;

        return {
          ...item,
          totalQty,
          totalPrice,
          unitCost,
          totalQtyLabel: `${formatQuantity(totalQty)} ${getUnitLabel(item.unitSize, item.unitLabel)}`,
        };
      }),
    [items],
  );

  const subtotal = rowsWithTotals.reduce(
    (sum, item) => sum + item.totalPrice,
    0,
  );
  const discount = Math.max(0, parseNumeric(discountInput));
  const tax = Math.max(0, parseNumeric(taxInput));
  const deliveryCharge = Math.max(0, parseNumeric(deliveryInput));
  const purchaseTotal = Math.max(0, subtotal - discount + tax + deliveryCharge);
  const paidAmount = Math.max(0, parseNumeric(paidInput));
  const dueAmount = Math.max(0, purchaseTotal - paidAmount);

  const validPurchaseItems = rowsWithTotals.filter(
    (item) =>
      item.productName.trim() && item.totalQty > 0 && item.totalPrice > 0,
  );

  const updateItem = (
    rowId: string,
    field: keyof PurchaseRow,
    value: string,
  ) => {
    setItems((previous) =>
      previous.map((item) => {
        if (item.rowId !== rowId) return item;

        if (field === "qty") {
          const nextQty = parseNumeric(value);
          const previousQty = parseNumeric(item.qty);
          const currentTotalPrice = parseNumeric(item.totalPrice);
          const unitLinePrice =
            parseNumeric(item.unitLinePrice) ||
            (previousQty > 0
              ? currentTotalPrice / previousQty
              : currentTotalPrice);

          return {
            ...item,
            qty: value,
            totalPrice:
              value.trim() === ""
                ? ""
                : formatInputNumber(unitLinePrice * nextQty),
            unitLinePrice: formatInputNumber(unitLinePrice),
          };
        }

        if (field === "totalPrice") {
          const qty = parseNumeric(item.qty);
          const totalPrice = parseNumeric(value);

          return {
            ...item,
            totalPrice: value,
            unitLinePrice:
              value.trim() === ""
                ? item.unitLinePrice
                : formatInputNumber(qty > 0 ? totalPrice / qty : totalPrice),
          };
        }

        return { ...item, [field]: value };
      }),
    );
  };

  const addVariantToRows = (variant: CatalogVariant) => {
    if (items.some((item) => item.variantId === variant.variantId)) {
      toast.error("This variant is already in the purchase table");
      return;
    }

    setItems((previous) => [
      ...previous,
      {
        rowId: makeRowId(),
        variantId: variant.variantId,
        sku: variant.sku || `VAR-${variant.variantId}`,
        productName: variant.coreProductName || variant.productName,
        unitSize: variant.pack || "1KG",
        qty: "1",
        totalPrice: String(variant.unitPrice || 0),
        unitLabel: variant.unitLabel || "KG",
        unitLinePrice: String(variant.unitPrice || 0),
        variantLabel: [variant.brandName, variant.pack]
          .filter(Boolean)
          .join(" + "),
        brandName: variant.brandName,
        pack: variant.pack,
      },
    ]);
    toast.success(`Added ${variant.coreProductName || variant.productName}`);
  };

  const clearAllRows = () => {
    setItems([]);
    setDiscountInput("0");
    setTaxInput("0");
    setDeliveryInput("0");
    setPaidInput("");
  };

  const resetPurchase = () => {
    setItems([]);
    setDiscountInput("0");
    setTaxInput("0");
    setDeliveryInput("0");
    setSupplierId(undefined);
    setPurchaseDate(todayInputDate());
    setReferenceNo("");
    setPaymentAccount(undefined);
    setPaymentMethod(undefined);
    setPaidInput("");
    setPurchaseNote("");
    setSearchText("");
    setTypeId(undefined);
    setCategoryId(undefined);
    setSubCategoryId(undefined);
    setCoreProductId(undefined);
    setBrandId(undefined);
    setPack(undefined);
    window.localStorage.removeItem(PURCHASE_DRAFT_KEY);
  };

  const savePurchaseDraft = () => {
    window.localStorage.setItem(
      PURCHASE_DRAFT_KEY,
      JSON.stringify({
        items,
        discountInput,
        taxInput,
        deliveryInput,
        supplierId,
        purchaseDate,
        referenceNo,
        paymentAccount,
        paymentMethod,
        paidInput,
        purchaseNote,
      }),
    );
    toast.success("Purchase draft saved");
  };

  const confirmPurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) {
        throw new Error("Select a supplier before confirming purchase");
      }
      if (validPurchaseItems.length === 0) {
        throw new Error("Add at least one valid purchase row");
      }
      if (!paymentMethod) {
        throw new Error("Select a payment method");
      }
      if (paidAmount > 0 && !paymentAccount) {
        throw new Error("Select a payment account for the paid amount");
      }

      const paymentLabel =
        paymentMethods.find((method) => method.key === paymentMethod)?.label ??
        paymentMethod;
      const accountLabel =
        paymentAccount === "bank"
          ? "Bank"
          : paymentAccount === "cash"
            ? "Cash"
            : "Not selected";
      const noteParts = [
        purchaseNote.trim() ? purchaseNote.trim() : null,
        `Payment method: ${paymentLabel}`,
        `Payment account: ${accountLabel}`,
        `Paid amount: ${paidAmount.toFixed(2)}`,
        `Due: ${dueAmount.toFixed(2)}`,
        `VAT/Tax: ${tax.toFixed(2)}`,
        `Delivery charge: ${deliveryCharge.toFixed(2)}`,
      ].filter(Boolean);

      const purchaseResult = await orpc.purchase.create.call({
        supplierId,
        purchaseDate,
        supplierInvoiceNo: referenceNo || undefined,
        paymentType: dueAmount > 0 ? "credit" : "cash",
        transportCost: String(deliveryCharge + tax),
        discount: String(discount),
        note: noteParts.join("\n"),
        items: validPurchaseItems.map((item) => ({
          productName: [
            item.productName.trim(),
            item.variantLabel ||
              [item.brandName, item.pack].filter(Boolean).join(" + "),
            item.unitSize,
          ]
            .filter(Boolean)
            .join(" - "),
          variantId: item.variantId ?? undefined,
          quantity: item.totalQty.toFixed(2),
          unitCost: item.unitCost.toFixed(2),
        })),
      });

      if (dueAmount > 0 && paidAmount > 0) {
        await orpc.supplierPayment.paySupplier.call({
          supplierId,
          amount: Math.min(paidAmount, purchaseTotal).toFixed(2),
          paymentMethod: mapPaymentMethodForSupplier(paymentMethod),
          referenceNo: referenceNo || undefined,
          note: `Partial payment against quick purchase. ${paymentLabel} via ${accountLabel}.`,
          ownerType: "warehouse",
        });
      }

      return purchaseResult;
    },
    onSuccess: async (result) => {
      toast.success(result.message || "Purchase confirmed");
      window.localStorage.removeItem(PURCHASE_DRAFT_KEY);
      resetPurchase();
      await queryClient.invalidateQueries({
        queryKey: orpc.purchase.list.key(),
      });
      await queryClient.invalidateQueries({
        queryKey: orpc.supplierPayment.getPayableSummary.key(),
      });
      await queryClient.invalidateQueries({
        queryKey: ["warehouseQuickPurchase", "suppliers"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["warehouseQuickPurchase", "catalog"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["warehouseQuickPurchase", "expenseCategories"],
      });
    },
    onError: (error) =>
      toast.error(error.message || "Could not confirm purchase"),
  });

  const saveExpenseDraft = () => {
    window.localStorage.setItem(
      EXPENSE_DRAFT_KEY,
      JSON.stringify({
        expenseType,
        expenseCategoryId,
        ledgerAccountId,
        expenseAmount,
        expenseNote,
        expenseDate,
      }),
    );
    toast.success("Expense draft saved");
  };

  const resetExpense = () => {
    setExpenseType("");
    setExpenseCategoryId(undefined);
    setLedgerAccountId(undefined);
    setExpenseAmount("");
    setExpenseNote("");
    setExpenseDate(todayInputDate());
    window.localStorage.removeItem(EXPENSE_DRAFT_KEY);
  };

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      const categoryId = expenseCategoryId || ledgerAccountId;
      if (!expenseType) {
        throw new Error("Select an expense type");
      }
      if (!categoryId) {
        throw new Error("Select an expense type or ledger account");
      }
      if (parseNumeric(expenseAmount) <= 0) {
        throw new Error("Enter a valid expense amount");
      }

      const ledgerCategory = expenseCategories.find(
        (category) => category.id === ledgerAccountId,
      );

      return orpc.expense.createExpense.call({
        title: `${expenseType} Expense`,
        categoryId,
        amount: expenseAmount,
        paymentDate: expenseDate,
        paymentMethod: "cash",
        note: [
          expenseNote.trim() || null,
          ledgerCategory ? `Ledger account: ${ledgerCategory.name} Cost` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        ownerType: "warehouse",
      });
    },
    onSuccess: async (result) => {
      toast.success(result.message);
      window.localStorage.removeItem(EXPENSE_DRAFT_KEY);
      resetExpense();
      await queryClient.invalidateQueries({
        queryKey: orpc.expense.getExpenses.key(),
      });
      await queryClient.invalidateQueries({
        queryKey: ["warehouseQuickPurchase", "expenseCategories"],
      });
    },
    onError: (error) => toast.error(error.message || "Could not save expense"),
  });

  return (
    <div className="flex min-h-[calc(100vh-6.5rem)] flex-col gap-4 bg-slate-50/60">
      <div className="flex flex-col gap-3 border-b bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-950">
              Quick Purchase
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs md:w-[420px]">
          <div className="rounded-lg border bg-white px-3 py-2">
            <p className="text-slate-500">Rows</p>
            <p className="text-base font-semibold text-slate-950">
              {items.length}
            </p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2">
            <p className="text-slate-500">Subtotal</p>
            <p className="text-base font-semibold text-slate-950">
              ৳{formatMoney(subtotal)}
            </p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2">
            <p className="text-slate-500">Due</p>
            <p
              className={cn(
                "text-base font-semibold",
                dueAmount > 0 ? "text-red-600" : "text-emerald-600",
              )}
            >
              ৳{formatMoney(dueAmount)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-4 px-4 pb-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="space-y-4">
          <section className="rounded-lg border bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <Label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">
                  Product Selection Method
                </Label>
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_150px_190px]">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      ref={searchRef}
                      value={searchText}
                      onChange={(event) => {
                        setSearchText(event.target.value);
                        setSelectionMode("search");
                      }}
                      placeholder="Search Product / SKU"
                      className="h-9 pl-8"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 justify-center gap-2"
                    onClick={() => {
                      setSelectionMode("search");
                      searchRef.current?.focus();
                      toast.success("Barcode scan mode ready");
                    }}
                  >
                    <Barcode className="h-4 w-4" />
                    Scan Barcode
                  </Button>
                  <Button
                    type="button"
                    variant={selectionMode === "manual" ? "default" : "outline"}
                    className="h-9 justify-center gap-2"
                    onClick={() => setSelectionMode("manual")}
                  >
                    <Plus className="h-4 w-4" />
                    Manual Entry
                  </Button>
                </div>
              </div>
            </div>

            {selectionMode === "search" && (
              <div className="border-b bg-slate-50/80 px-4 py-3">
                {catalogQuery.isFetching ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Searching catalog...
                  </div>
                ) : variants.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No matching product found.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                    {variants.slice(0, 6).map((variant) => (
                      <button
                        key={variant.variantId}
                        type="button"
                        onClick={() => addVariantToRows(variant)}
                        className="flex min-h-16 items-center justify-between rounded-lg border bg-white px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {variant.coreProductName}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {[variant.brandName, variant.pack, variant.sku]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-emerald-700">
                          ৳{formatMoney(variant.unitPrice)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2">
                  <Package className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Step 1 - Select Product Structure
                  </h2>
                </div>
                <div className="grid gap-3 p-3 sm:grid-cols-2">
                  <Select
                    value={typeId ? String(typeId) : "none"}
                    onValueChange={(value) => {
                      setTypeId(value === "none" ? undefined : Number(value));
                      setCategoryId(undefined);
                      setSubCategoryId(undefined);
                      setCoreProductId(undefined);
                      setBrandId(undefined);
                      setPack(undefined);
                    }}
                  >
                    <SelectField
                      label="Type"
                      placeholder="Select type"
                      options={options?.types ?? []}
                    />
                  </Select>
                  <Select
                    value={categoryId ? String(categoryId) : "none"}
                    onValueChange={(value) => {
                      setCategoryId(
                        value === "none" ? undefined : Number(value),
                      );
                      setSubCategoryId(undefined);
                      setCoreProductId(undefined);
                      setBrandId(undefined);
                      setPack(undefined);
                    }}
                  >
                    <SelectField
                      label="Category"
                      placeholder="Select category"
                      options={options?.categories ?? []}
                    />
                  </Select>
                  <Select
                    value={subCategoryId ? String(subCategoryId) : "none"}
                    onValueChange={(value) => {
                      setSubCategoryId(
                        value === "none" ? undefined : Number(value),
                      );
                      setCoreProductId(undefined);
                      setBrandId(undefined);
                      setPack(undefined);
                    }}
                  >
                    <SelectField
                      label="Sub Category"
                      placeholder="Select sub category"
                      options={options?.subCategories ?? []}
                    />
                  </Select>
                  <Select
                    value={coreProductId ? String(coreProductId) : "none"}
                    onValueChange={(value) => {
                      setCoreProductId(
                        value === "none" ? undefined : Number(value),
                      );
                      setBrandId(undefined);
                      setPack(undefined);
                    }}
                  >
                    <SelectField
                      label="Core Identity"
                      placeholder="Select identity"
                      options={options?.coreProducts ?? []}
                    />
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2">
                  <ReceiptText className="h-4 w-4 text-blue-600" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    Step 2 - Select Variant
                  </h2>
                </div>
                <div className="grid gap-3 p-3 sm:grid-cols-2">
                  <Select
                    value={brandId ? String(brandId) : "none"}
                    onValueChange={(value) => {
                      setBrandId(value === "none" ? undefined : Number(value));
                      setPack(undefined);
                    }}
                  >
                    <SelectField
                      label="Brand"
                      placeholder="Select brand"
                      options={options?.brands ?? []}
                    />
                  </Select>
                  <Select
                    value={pack ?? "none"}
                    onValueChange={(value) =>
                      setPack(value === "none" ? undefined : value)
                    }
                  >
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500">
                        Pack / Weight
                      </Label>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select pack" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select pack</SelectItem>
                        {(options?.packs ?? []).map((packOption: string) => (
                          <SelectItem key={packOption} value={packOption}>
                            {packOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </div>
                  </Select>
                  <div className="sm:col-span-2 flex flex-col gap-2 rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-3 py-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase text-emerald-700">
                        Final Variant
                      </p>
                      <p className="truncate text-sm font-semibold text-emerald-950">
                        {finalVariantLabel || "Select brand and pack"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                      disabled={!selectedVariant}
                      onClick={() =>
                        selectedVariant && addVariantToRows(selectedVariant)
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Variant
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-950">
                  Item Entry Table
                </h2>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    setItems((previous) => [...previous, createEmptyRow()])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={clearAllRows}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">ID</th>
                    <th className="px-3 py-2 font-semibold">Product</th>
                    <th className="px-3 py-2 font-semibold">Unit Size</th>
                    <th className="px-3 py-2 font-semibold">Qty</th>
                    <th className="px-3 py-2 font-semibold">Total Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Total Price
                    </th>
                    <th className="px-3 py-2 text-center font-semibold">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rowsWithTotals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-3 py-10 text-center text-sm text-slate-500"
                      >
                        No rows added.
                      </td>
                    </tr>
                  ) : (
                    rowsWithTotals.map((item) => (
                      <tr key={item.rowId} className="align-middle">
                        <td className="px-3 py-2">
                          <Input
                            value={item.sku}
                            onChange={(event) =>
                              updateItem(item.rowId, "sku", event.target.value)
                            }
                            placeholder="SKU / ID"
                            className="h-8 w-32 font-mono text-xs"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            <Input
                              value={item.productName}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "productName",
                                  event.target.value,
                                )
                              }
                              placeholder="Product name"
                              className="h-8 min-w-48"
                            />
                            {item.variantLabel && (
                              <Badge
                                variant="outline"
                                className="h-5 rounded-md bg-slate-50 text-[11px]"
                              >
                                {item.variantLabel}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={item.unitSize}
                            onChange={(event) =>
                              updateItem(
                                item.rowId,
                                "unitSize",
                                event.target.value,
                              )
                            }
                            placeholder="200KG"
                            className="h-8 w-28"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={item.qty}
                            onChange={(event) =>
                              updateItem(item.rowId, "qty", event.target.value)
                            }
                            className="h-8 w-24"
                          />
                        </td>
                        <td className="px-3 py-2 font-medium tabular-nums text-slate-700">
                          {item.totalQtyLabel}
                        </td>
                        <td className="px-3 py-2">
                          <div className="ml-auto flex w-32 items-center gap-1">
                            <span className="text-xs text-slate-500">৳</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.totalPrice}
                              onChange={(event) =>
                                updateItem(
                                  item.rowId,
                                  "totalPrice",
                                  event.target.value,
                                )
                              }
                              className="h-8 text-right"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() =>
                              setItems((previous) =>
                                previous.filter(
                                  (row) => row.rowId !== item.rowId,
                                ),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <FileText className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold text-slate-950">
                Expense Entry
              </h2>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[260px_minmax(0,1fr)_180px]">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Expense Type</Label>
                <Select
                  value={expenseType || "none"}
                  onValueChange={(value) =>
                    setExpenseType(value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select expense type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select expense type</SelectItem>
                    {expenseTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Ledger Account</Label>
                <Select
                  value={ledgerAccountId ? String(ledgerAccountId) : "none"}
                  onValueChange={(value) => {
                    const nextId = value === "none" ? undefined : Number(value);
                    setLedgerAccountId(nextId);
                    setExpenseCategoryId(nextId);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Transport Cost" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select ledger account</SelectItem>
                    {expenseCategories.map((category) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name} Cost
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Amount</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">৳</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(event) => setExpenseAmount(event.target.value)}
                    className="h-9 text-right"
                  />
                </div>
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <Label className="text-xs text-slate-500">Note</Label>
                <Textarea
                  value={expenseNote}
                  onChange={(event) => setExpenseNote(event.target.value)}
                  className="min-h-16 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Date</Label>
                <Input
                  type="date"
                  value={expenseDate}
                  onChange={(event) => setExpenseDate(event.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={resetExpense}
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={saveExpenseDraft}
              >
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              <Button
                type="button"
                className="gap-1.5 bg-red-600 hover:bg-red-700"
                disabled={createExpenseMutation.isPending}
                onClick={() => createExpenseMutation.mutate()}
              >
                {createExpenseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Save Expense
              </Button>
            </div>
          </section>
        </main>

        <aside className="space-y-4">
          <section className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-950">
                Cost & Total
              </h2>
            </div>
            <div className="space-y-2 p-4">
              <TotalInputRow
                label="Subtotal"
                value={`৳ ${formatMoney(subtotal)}`}
                readOnly
              />
              <TotalInputRow
                label="Discount"
                value={discountInput}
                onChange={setDiscountInput}
              />
              <TotalInputRow
                label="VAT / Tax"
                value={taxInput}
                onChange={setTaxInput}
              />
              <TotalInputRow
                label="Delivery Charge"
                value={deliveryInput}
                onChange={setDeliveryInput}
              />
              <Separator className="my-3" />
              <div className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-3 text-white">
                <span className="text-sm font-semibold uppercase">Total</span>
                <span className="text-2xl font-bold tabular-nums">
                  ৳ {formatMoney(purchaseTotal)}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Truck className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-950">
                Payment & Supplier Info
              </h2>
            </div>
            <div className="space-y-3 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Payee</Label>
                <Select
                  value={supplierId ? String(supplierId) : "none"}
                  onValueChange={(value) =>
                    setSupplierId(value === "none" ? undefined : Number(value))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select Supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select Supplier</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                        {supplier.company ? ` (${supplier.company})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSupplier?.currentPayable && (
                  <p className="text-[11px] text-slate-500">
                    Current payable: ৳
                    {formatMoney(parseNumeric(selectedSupplier.currentPayable))}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Payment Date</Label>
                  <div className="relative">
                    <CalendarDays className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="date"
                      value={purchaseDate}
                      onChange={(event) => setPurchaseDate(event.target.value)}
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Reference No</Label>
                  <Input
                    value={referenceNo}
                    onChange={(event) => setReferenceNo(event.target.value)}
                    placeholder="Invoice No"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">
                  Payment Account
                </Label>
                <Select
                  value={paymentAccount ?? "none"}
                  onValueChange={(value) =>
                    setPaymentAccount(
                      value === "none" ? undefined : (value as PaymentAccount),
                    )
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Cash / Bank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Cash / Bank</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Payment Method</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => setPaymentMethod(method.key)}
                      className={cn(
                        "h-8 rounded-lg border text-xs font-semibold transition",
                        paymentMethod === method.key
                          ? method.activeClass
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Paid Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidInput}
                    onChange={(event) => setPaidInput(event.target.value)}
                    className="h-9 text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Due</Label>
                  <div
                    className={cn(
                      "flex h-9 items-center justify-end rounded-lg border px-2 text-sm font-semibold tabular-nums",
                      dueAmount > 0
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                    )}
                  >
                    ৳ {formatMoney(dueAmount)}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Note</Label>
                <Textarea
                  value={purchaseNote}
                  onChange={(event) => setPurchaseNote(event.target.value)}
                  placeholder="Optional purchase note"
                  className="min-h-16 resize-none"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-950">Action</h2>
            </div>
            <div className="space-y-2 p-4">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-1.5"
                onClick={resetPurchase}
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-1.5"
                onClick={savePurchaseDraft}
              >
                <Save className="h-4 w-4" />
                Save Draft
              </Button>
              <Button
                type="button"
                className="h-10 w-full justify-center gap-1.5 bg-emerald-600 font-semibold hover:bg-emerald-700"
                disabled={confirmPurchaseMutation.isPending}
                onClick={() => confirmPurchaseMutation.mutate()}
              >
                {confirmPurchaseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirm Purchase
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SelectField({
  label,
  placeholder,
  options,
}: {
  label: string;
  placeholder: string;
  options: CatalogOption[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-500">{label}</Label>
      <SelectTrigger className="h-9">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={String(option.id)}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </div>
  );
}

function TotalInputRow({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_130px] items-center gap-3 text-sm">
      <span className="text-right text-slate-500">{label}:</span>
      {readOnly ? (
        <span className="rounded-lg border bg-slate-50 px-2 py-1.5 text-right font-semibold tabular-nums text-slate-900">
          {value}
        </span>
      ) : (
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">৳</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            className="h-8 text-right"
          />
        </div>
      )}
    </div>
  );
}
