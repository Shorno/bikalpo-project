"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  Eye,
  Loader2,
  Megaphone,
  Pause,
  Plus,
  Search,
  Store,
  Tag,
  XCircle,
} from "lucide-react";
import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useState,
} from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

type OfferStatus = "active" | "scheduled" | "expired" | "draft";
type OfferType = "percentage" | "flat" | "buy_x_get_y";
type ApplyTo = "product" | "category" | "all_products";
type TargetType = "all_customers" | "specific_customers" | "area";
type Activation = "activate" | "draft";
type OfferCustomer = {
  key: string;
  linkedUserId: string | null;
  name: string;
  phone: string | null;
};

type OfferForm = {
  templateId: number | null;
  name: string;
  applyTo: ApplyTo;
  productId: number | null;
  variantId: number | null;
  categoryId: number | null;
  discountValue: string;
  minimumQuantity: string;
  maximumLimit: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  targetType: TargetType;
  targetCustomerKeys: string[];
  targetAreaIds: number[];
  activation: Activation;
};

type CreationOptions = {
  shop: { id: string; name: string };
  templates: Array<{
    id: number;
    name: string;
    type: OfferType;
    typeLabel: string;
    description: string;
    benefitType: string;
    benefitValue: string | null;
    minimumQuantity: number;
    maximumLimit: number | null;
    startDate: Date | null;
    endDate: Date | null;
    buyProducts: Array<{ quantity: number }>;
    getProducts: Array<{ quantity: number }>;
    expectedOrders: number;
  }>;
  variants: Array<{
    id: number;
    productId: number;
    productName: string;
    brandName: string;
    variantName: string;
    sku: string | null;
    categoryId: number;
    categoryName: string;
    price: number;
    availableQty: number;
    unitLabel: string;
  }>;
  categories: Array<{ id: number; name: string }>;
  areas: Array<{ id: number; name: string }>;
};

type OfferDetail = {
  id: number;
  code: string;
  templateId: number;
  name: string;
  product: string;
  typeLabel: string;
  discount: string;
  status: string;
  applyTo: string;
  productId: number | null;
  variantId: number | null;
  categoryId: number | null;
  discountValue: string | null;
  minimumQuantity: string;
  maximumLimit: number | null;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  targetType: string;
  targetCustomerKeys: string[];
  targetAreaIds: number[];
  applicableTo: string;
  performance: {
    ordersApplied: number;
    totalDiscount: number;
    salesGenerated: number;
  };
};

function isoDate(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function initialForm(): OfferForm {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);
  return {
    templateId: null,
    name: "",
    applyTo: "product",
    productId: null,
    variantId: null,
    categoryId: null,
    discountValue: "",
    minimumQuantity: "1",
    maximumLimit: "",
    startDate: isoDate(start),
    endDate: isoDate(end),
    allDay: true,
    startTime: "09:00",
    endTime: "21:00",
    targetType: "all_customers",
    targetCustomerKeys: [],
    targetAreaIds: [],
    activation: "activate",
  };
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function shortDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function longDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function dateInput(value: Date | string) {
  return isoDate(new Date(value));
}

const STATUS_OPTIONS: Array<{ value: OfferStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "expired", label: "Expired" },
  { value: "draft", label: "Draft" },
];

const TYPE_OPTIONS: Array<{ value: OfferType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "percentage", label: "Discount %" },
  { value: "flat", label: "Flat Discount" },
  { value: "buy_x_get_y", label: "Buy X Get Y" },
];

const DATE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
] as const;

export function RetailerOffersClient() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OfferStatus | "all">("all");
  const [type, setType] = useState<OfferType | "all">("all");
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | null>(
    null,
  );
  const [form, setForm] = useState<OfferForm>(initialForm);

  const dashboardQuery = useQuery(
    orpc.retailerOffer.getDashboard.queryOptions({
      input: {
        search: search || undefined,
        status: status === "all" ? undefined : status,
        type: type === "all" ? undefined : type,
        dateRange: dateRange ?? undefined,
      },
    }),
  );
  const optionsQuery = useQuery({
    ...orpc.retailerOffer.getCreationOptions.queryOptions({ input: {} }),
    enabled: creating,
  });
  const customersQuery = useQuery({
    ...orpc.retailerPos.searchCustomers.queryOptions({ input: {} }),
    enabled: creating && form.targetType === "specific_customers",
  });
  const detailQuery = useQuery({
    ...orpc.retailerOffer.getDetail.queryOptions({
      input: { id: selectedId ?? 1 },
    }),
    enabled: selectedId !== null,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.retailerOffer.getDashboard.key(),
    });
    await queryClient.invalidateQueries({
      queryKey: orpc.retailerOffer.getDetail.key(),
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.templateId) throw new Error("Select an offer template");
      const data = {
        name: form.name,
        applyTo: form.applyTo,
        variantId: form.applyTo === "product" ? form.variantId : null,
        categoryId: form.applyTo === "category" ? form.categoryId : null,
        discountValue: form.discountValue ? Number(form.discountValue) : null,
        minimumQuantity: Number(form.minimumQuantity),
        maximumLimit: form.maximumLimit ? Number(form.maximumLimit) : null,
        startDate: new Date(`${form.startDate}T00:00:00`).toISOString(),
        endDate: new Date(`${form.endDate}T23:59:59`).toISOString(),
        allDay: form.allDay,
        startTime: form.allDay ? null : form.startTime,
        endTime: form.allDay ? null : form.endTime,
        targetType: form.targetType,
        targetCustomerKeys: form.targetCustomerKeys,
        targetAreaIds: form.targetAreaIds,
      };
      if (editingId) {
        const result = await orpc.retailerOffer.update.call({
          id: editingId,
          data,
        });
        if (form.activation === "activate") {
          await orpc.retailerOffer.setAction.call({
            id: editingId,
            action: "activate",
          });
        }
        return result;
      }
      return orpc.retailerOffer.create.call({
        ...data,
        templateId: form.templateId,
        activation: form.activation,
      });
    },
    onSuccess: async () => {
      toast.success(editingId ? "Offer updated" : "Offer saved");
      await refresh();
      setCreating(false);
      setEditingId(null);
      setForm(initialForm());
    },
    onError: (error) => toast.error(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: (input: {
      id: number;
      action: "activate" | "pause" | "deactivate";
    }) => orpc.retailerOffer.setAction.call(input),
    onSuccess: async () => {
      toast.success("Offer status updated");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm());
    setCreating(true);
  };

  const openEdit = () => {
    const detail = detailQuery.data as OfferDetail | undefined;
    if (!detail) return;
    setForm({
      templateId: detail.templateId,
      name: detail.name,
      applyTo: detail.applyTo as ApplyTo,
      productId: detail.productId,
      variantId: detail.variantId,
      categoryId: detail.categoryId,
      discountValue: detail.discountValue ?? "",
      minimumQuantity: detail.minimumQuantity,
      maximumLimit: detail.maximumLimit ? String(detail.maximumLimit) : "",
      startDate: dateInput(detail.startDate),
      endDate: dateInput(detail.endDate),
      allDay: detail.allDay,
      startTime: detail.startTime ?? "09:00",
      endTime: detail.endTime ?? "21:00",
      targetType: detail.targetType as TargetType,
      targetCustomerKeys: detail.targetCustomerKeys,
      targetAreaIds: detail.targetAreaIds,
      activation: detail.status === "draft" ? "draft" : "activate",
    });
    setEditingId(detail.id);
    setSelectedId(null);
    setCreating(true);
  };

  if (creating) {
    return (
      <OfferCreation
        form={form}
        setForm={setForm}
        options={optionsQuery.data as CreationOptions | undefined}
        customers={customersQuery.data?.customers ?? []}
        loading={optionsQuery.isLoading}
        saving={saveMutation.isPending}
        editing={editingId !== null}
        onSave={() => saveMutation.mutate()}
        onCancel={() => {
          setCreating(false);
          setEditingId(null);
          setForm(initialForm());
        }}
      />
    );
  }

  const data = dashboardQuery.data;
  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            <Store className="h-3.5 w-3.5" /> Store: {data?.shop.name ?? "—"}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950">
            My Offers (Store / Warehouse)
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Showing: {data?.showing ?? "All Offers"}
          </p>
        </div>
        <Button onClick={openCreate} className="bg-blue-700 hover:bg-blue-800">
          <Plus className="mr-2 h-4 w-4" /> Create Offer
        </Button>
      </header>

      <section className="border-b border-zinc-200 pb-6">
        <SectionLabel icon={Search}>Search &amp; Filter</SectionLabel>
        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(260px,1.2fr)_1fr_1fr_1fr]">
          <div>
            <FieldLabel>Search</FieldLabel>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Offer Name / Product"
                className="pl-9"
              />
            </div>
          </div>
          <FilterGroup
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
          <FilterGroup
            label="Type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
          />
          <FilterGroup
            label="Date Range"
            options={DATE_OPTIONS}
            value={dateRange}
            onChange={(value) =>
              setDateRange(value === dateRange ? null : value)
            }
          />
        </div>
      </section>

      <section>
        <SectionLabel icon={Tag}>KPI Overview</SectionLabel>
        <div className="mt-4 grid grid-cols-2 border-l border-t border-zinc-200 lg:grid-cols-4">
          <Metric label="Total Offers" value={data?.kpis.total ?? 0} />
          <Metric label="Active" value={data?.kpis.active ?? 0} />
          <Metric label="Scheduled" value={data?.kpis.scheduled ?? 0} />
          <Metric label="Expired" value={data?.kpis.expired ?? 0} />
        </div>
      </section>

      <section>
        <SectionLabel icon={Megaphone}>Offer List</SectionLabel>
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  {[
                    "Offer ID",
                    "Offer Name",
                    "Product",
                    "Type",
                    "Discount",
                    "Validity",
                    "Status",
                    "Action",
                  ].map((label) => (
                    <th key={label} className="px-4 py-3 font-semibold">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {dashboardQuery.isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-700" />
                    </td>
                  </tr>
                ) : !data?.offers.length ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-zinc-500">
                      No offers found.
                    </td>
                  </tr>
                ) : (
                  data.offers.map((offer) => (
                    <tr key={offer.id} className="hover:bg-zinc-50/80">
                      <td className="px-4 py-4 font-mono text-xs text-zinc-600">
                        {offer.code}
                      </td>
                      <td className="px-4 py-4 font-semibold text-zinc-950">
                        {offer.name}
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-4 text-zinc-600">
                        {offer.product}
                      </td>
                      <td className="px-4 py-4">{offer.typeLabel}</td>
                      <td className="px-4 py-4 font-mono font-semibold tabular-nums">
                        {offer.discount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 font-mono text-xs tabular-nums">
                        {shortDate(offer.startDate)}–{shortDate(offer.endDate)}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={offer.status} />
                      </td>
                      <td className="px-4 py-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedId(offer.id)}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <SectionLabel icon={AlertTriangle}>Alerts</SectionLabel>
        <div className="mt-4 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
          <AlertRow
            count={data?.alerts.expiringToday ?? 0}
            label="Offers expiring today"
          />
          <AlertRow
            count={data?.alerts.lowPerformance ?? 0}
            label="Offer low performance"
          />
          <AlertRow
            count={data?.alerts.startingTomorrow ?? 0}
            label="Scheduled offer starting tomorrow"
          />
        </div>
      </section>

      <OfferDetailSheet
        open={selectedId !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        detail={detailQuery.data as OfferDetail | undefined}
        loading={detailQuery.isLoading}
        acting={actionMutation.isPending}
        onEdit={openEdit}
        onAction={(action) =>
          selectedId && actionMutation.mutate({ id: selectedId, action })
        }
      />
    </div>
  );
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Search;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
      <Icon className="h-4 w-4 text-blue-700" />
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-semibold text-zinc-700">
      {children}
    </label>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors",
              value === option.value
                ? "border-blue-700 bg-blue-700 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-r border-zinc-200 bg-white px-5 py-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-zinc-950">
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "border-blue-200 bg-blue-50 text-blue-700",
    scheduled: "border-sky-200 bg-sky-50 text-sky-700",
    expired: "border-zinc-200 bg-zinc-100 text-zinc-600",
    draft: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <Badge variant="outline" className={cn("capitalize", styles[status])}>
      {status}
    </Badge>
  );
}

function AlertRow({ count, label }: { count: number; label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-zinc-100 px-2 font-mono text-xs font-bold tabular-nums">
        {count}
      </span>
      <span className="text-sm text-zinc-700">{label}</span>
    </div>
  );
}

function OfferCreation({
  form,
  setForm,
  options,
  customers,
  loading,
  saving,
  editing,
  onSave,
  onCancel,
}: {
  form: OfferForm;
  setForm: Dispatch<SetStateAction<OfferForm>>;
  options: CreationOptions | undefined;
  customers: OfferCustomer[];
  loading: boolean;
  saving: boolean;
  editing: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const template = options?.templates.find(
    (item) => item.id === form.templateId,
  );
  const variant = options?.variants.find((item) => item.id === form.variantId);
  const selectedProductId = form.productId ?? variant?.productId ?? null;
  const products = [
    ...new Map(
      options?.variants.map((item) => [
        item.productId,
        {
          id: item.productId,
          name: `${item.brandName ? `${item.brandName} ` : ""}${item.productName}`,
        },
      ]) ?? [],
    ).values(),
  ].sort((left, right) => left.name.localeCompare(right.name));
  const productVariants =
    options?.variants.filter((item) => item.productId === selectedProductId) ??
    [];
  const category = options?.categories.find(
    (item) => item.id === form.categoryId,
  );
  const productLabel =
    form.applyTo === "all_products"
      ? "All Products"
      : form.applyTo === "category"
        ? (category?.name ?? "Select category")
        : variant
          ? `${variant.brandName ? `${variant.brandName} ` : ""}${variant.productName} · ${variant.variantName}`
          : "Select product";
  const discountLabel =
    template?.type === "percentage"
      ? `${form.discountValue || 0}% OFF`
      : template?.type === "flat"
        ? `৳ ${form.discountValue || 0} OFF`
        : `Buy ${form.minimumQuantity || 0} Get ${template?.getProducts.reduce((sum, item) => sum + item.quantity, 0) || 1}`;
  const averageDiscount =
    template?.type === "percentage" && variant
      ? (variant.price * Number(form.discountValue || 0)) / 100
      : template?.type === "flat"
        ? Number(form.discountValue || 0)
        : (variant?.price ?? 0);

  const selectTemplate = (id: number) => {
    const selected = options?.templates.find((item) => item.id === id);
    if (!selected) return;
    setForm((current) => ({
      ...current,
      templateId: id,
      name: current.name || selected.name,
      discountValue:
        selected.benefitType === "free_product"
          ? ""
          : String(selected.benefitValue ?? ""),
      minimumQuantity: String(selected.minimumQuantity || 1),
      maximumLimit: selected.maximumLimit ? String(selected.maximumLimit) : "",
      startDate: selected.startDate
        ? dateInput(selected.startDate)
        : current.startDate,
      endDate: selected.endDate ? dateInput(selected.endDate) : current.endDate,
    }));
  };

  if (loading)
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-blue-700" />
      </div>
    );

  return (
    <div className="pb-28">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="mb-3 flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-950"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> My Offers
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950">
            Create Offer (From Template)
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-500">
            <span>
              Store:{" "}
              <strong className="text-zinc-800">
                {options?.shop.name ?? "—"}
              </strong>
            </span>
            <span>
              Mode:{" "}
              <strong className="text-zinc-800">
                Template Based Offer Creation
              </strong>
            </span>
          </div>
        </div>
      </header>

      <div className="divide-y divide-zinc-200">
        <FormStep number="01" title="Select Offer Template">
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    {["Template Name", "Type", "Description", "Action"].map(
                      (label) => (
                        <th key={label} className="px-4 py-3 font-semibold">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {options?.templates.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(
                        item.id === form.templateId && "bg-blue-50/70",
                      )}
                    >
                      <td className="px-4 py-3 font-semibold">{item.name}</td>
                      <td className="px-4 py-3">{item.typeLabel}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {item.description}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          size="sm"
                          variant={
                            item.id === form.templateId ? "default" : "outline"
                          }
                          className={cn(
                            item.id === form.templateId &&
                              "bg-blue-700 hover:bg-blue-800",
                          )}
                          onClick={() => selectTemplate(item.id)}
                          disabled={editing}
                        >
                          {item.id === form.templateId ? (
                            <>
                              <Check className="mr-1 h-3.5 w-3.5" /> Selected
                            </>
                          ) : (
                            "Select"
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 text-sm text-zinc-600">
            Selected:{" "}
            <strong className="text-zinc-950">{template?.name ?? "—"}</strong>
          </div>
        </FormStep>

        <FormStep number="02" title="Select Product / Category">
          <FieldLabel>Apply Offer To</FieldLabel>
          <ChoiceRow
            options={[
              { value: "product", label: "Specific Product" },
              { value: "category", label: "Category" },
              { value: "all_products", label: "All Products" },
            ]}
            value={form.applyTo}
            onChange={(applyTo) =>
              setForm((current) => ({
                ...current,
                applyTo: applyTo as ApplyTo,
              }))
            }
          />
          {form.applyTo === "product" && (
            <div className="mt-5">
              <FieldLabel>Select Product</FieldLabel>
              <select
                value={selectedProductId ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    productId: event.target.value
                      ? Number(event.target.value)
                      : null,
                    variantId: null,
                  }))
                }
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:border-blue-700 focus:outline-none"
              >
                <option value="">Select product</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div className="mt-4">
                <FieldLabel>Variant</FieldLabel>
                <select
                  value={form.variantId ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      variantId: event.target.value
                        ? Number(event.target.value)
                        : null,
                    }))
                  }
                  disabled={!selectedProductId}
                  className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:border-blue-700 focus:outline-none disabled:bg-zinc-50"
                >
                  <option value="">Select variant</option>
                  {productVariants.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.variantName} — {item.sku ?? "No SKU"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {form.applyTo === "category" && (
            <div className="mt-5">
              <FieldLabel>Category</FieldLabel>
              <select
                value={form.categoryId ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    categoryId: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
                className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm focus:border-blue-700 focus:outline-none"
              >
                <option value="">Select category</option>
                {options?.categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </FormStep>

        <FormStep number="03" title="Configure Offer Details">
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              label="Offer Name"
              value={form.name}
              onChange={(name) => setForm((current) => ({ ...current, name }))}
            />
            <FormInput
              label="Discount Type"
              value={template?.typeLabel ?? ""}
              disabled
            />
            <FormInput
              label="Discount Value"
              type="number"
              value={form.discountValue}
              placeholder={
                template?.benefitType === "free_product" ? "Free" : "0"
              }
              disabled={template?.benefitType === "free_product"}
              onChange={(discountValue) =>
                setForm((current) => ({ ...current, discountValue }))
              }
            />
            <FormInput
              label="Minimum Quantity"
              type="number"
              value={form.minimumQuantity}
              onChange={(minimumQuantity) =>
                setForm((current) => ({ ...current, minimumQuantity }))
              }
            />
            <FormInput
              label="Maximum Limit (Optional)"
              type="number"
              value={form.maximumLimit}
              onChange={(maximumLimit) =>
                setForm((current) => ({ ...current, maximumLimit }))
              }
            />
          </div>
        </FormStep>

        <FormStep number="04" title="Set Validity">
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={(startDate) =>
                setForm((current) => ({ ...current, startDate }))
              }
            />
            <FormInput
              label="End Date"
              type="date"
              value={form.endDate}
              onChange={(endDate) =>
                setForm((current) => ({ ...current, endDate }))
              }
            />
          </div>
          <div className="mt-5">
            <FieldLabel>Time (Optional)</FieldLabel>
            <ChoiceRow
              options={[
                { value: "all", label: "All Day" },
                { value: "custom", label: "Custom Time" },
              ]}
              value={form.allDay ? "all" : "custom"}
              onChange={(value) =>
                setForm((current) => ({ ...current, allDay: value === "all" }))
              }
            />
          </div>
          {!form.allDay && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormInput
                label="Start Time"
                type="time"
                value={form.startTime}
                onChange={(startTime) =>
                  setForm((current) => ({ ...current, startTime }))
                }
              />
              <FormInput
                label="End Time"
                type="time"
                value={form.endTime}
                onChange={(endTime) =>
                  setForm((current) => ({ ...current, endTime }))
                }
              />
            </div>
          )}
        </FormStep>

        <FormStep number="05" title="Target Settings">
          <FieldLabel>Apply To</FieldLabel>
          <ChoiceRow
            options={[
              { value: "all_customers", label: "All Customers" },
              { value: "specific_customers", label: "Specific Customers" },
              { value: "area", label: "Area Based" },
            ]}
            value={form.targetType}
            onChange={(targetType) =>
              setForm((current) => ({
                ...current,
                targetType: targetType as TargetType,
              }))
            }
          />
          {form.targetType === "specific_customers" && (
            <div className="mt-5">
              <FieldLabel>Specific Customers</FieldLabel>
              <div className="max-h-52 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                {customers.map((customer) => (
                  <CheckRow
                    key={customer.key}
                    checked={customerTargetKeys(customer).some((key) =>
                      form.targetCustomerKeys.includes(key),
                    )}
                    label={customer.name}
                    detail={customer.phone ?? ""}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        targetCustomerKeys: toggleCustomerTargets(
                          current.targetCustomerKeys,
                          customer,
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          )}
          {form.targetType === "area" && (
            <div className="mt-5">
              <FieldLabel>Area</FieldLabel>
              <div className="max-h-52 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200">
                {options?.areas.map((area) => (
                  <CheckRow
                    key={area.id}
                    checked={form.targetAreaIds.includes(area.id)}
                    label={area.name}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        targetAreaIds: toggleValue(
                          current.targetAreaIds,
                          area.id,
                        ),
                      }))
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </FormStep>

        <FormStep number="06" title="Preview (Auto Generated)">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <FieldLabel>Offer Summary</FieldLabel>
              <div className="space-y-2 text-sm">
                <SummaryLine label={productLabel} value={discountLabel} />
                <SummaryLine
                  label="Minimum Purchase"
                  value={`${form.minimumQuantity || 0} Pack`}
                />
                <SummaryLine
                  label="Valid"
                  value={`${shortDate(new Date(`${form.startDate}T00:00:00`))} – ${shortDate(new Date(`${form.endDate}T00:00:00`))}`}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Estimated Impact</FieldLabel>
              <div className="space-y-2 text-sm">
                <SummaryLine
                  label="Avg Discount"
                  value={`৳ ${money(averageDiscount)} / Pack`}
                />
                <SummaryLine
                  label="Expected Orders"
                  value={`${template?.expectedOrders ?? 0}+`}
                />
              </div>
            </div>
          </div>
        </FormStep>

        <FormStep number="07" title="Activate Offer">
          <FieldLabel>Status</FieldLabel>
          <ChoiceRow
            options={[
              { value: "activate", label: "Activate Now" },
              { value: "draft", label: "Save as Draft" },
            ]}
            value={form.activation}
            onChange={(activation) =>
              setForm((current) => ({
                ...current,
                activation: activation as Activation,
              }))
            }
          />
        </FormStep>

        <section className="grid gap-5 py-7 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <h2 className="text-sm font-bold text-zinc-950">System Rules</h2>
          <ul className="space-y-2 text-sm text-zinc-700">
            <li>Template structure cannot be changed</li>
            <li>Only allowed fields editable</li>
            <li>Offer auto applies in POS / Orders</li>
            <li>Expired offers auto deactivate</li>
          </ul>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1500px] flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              document
                .getElementById("offer-step-06")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="bg-blue-700 hover:bg-blue-800"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Save Offer
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={`offer-step-${number}`}
      className="grid gap-5 py-7 lg:grid-cols-[13rem_minmax(0,1fr)]"
    >
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs font-bold text-blue-700">
          {number}
        </span>
        <h2 className="text-sm font-bold text-zinc-950">{title}</h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function ChoiceRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold",
            value === option.value
              ? "border-blue-700 bg-blue-50 text-blue-800"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
          )}
        >
          <span
            className={cn(
              "h-3.5 w-3.5 rounded-full border",
              value === option.value
                ? "border-[4px] border-blue-700"
                : "border-zinc-300",
            )}
          />
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </div>
  );
}

function CheckRow({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail?: string;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-blue-700"
      />
      <span className="flex-1 text-sm font-medium text-zinc-800">{label}</span>
      {detail && <span className="text-xs text-zinc-500">{detail}</span>}
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2">
      <span className="text-zinc-600">{label}</span>
      <strong className="font-mono text-right text-zinc-950 tabular-nums">
        {value}
      </strong>
    </div>
  );
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function customerTargetKeys(customer: OfferCustomer) {
  return [
    customer.key,
    ...(customer.linkedUserId ? [`consumer:${customer.linkedUserId}`] : []),
  ];
}

function toggleCustomerTargets(values: string[], customer: OfferCustomer) {
  const keys = customerTargetKeys(customer);
  if (keys.some((key) => values.includes(key))) {
    return values.filter((value) => !keys.includes(value));
  }
  return [...new Set([...values, ...keys])];
}

function OfferDetailSheet({
  open,
  onOpenChange,
  detail,
  loading,
  acting,
  onEdit,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: OfferDetail | undefined;
  loading: boolean;
  acting: boolean;
  onEdit: () => void;
  onAction: (action: "pause" | "deactivate") => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader className="border-b border-zinc-200">
          <SheetTitle>Offer Details</SheetTitle>
          <SheetDescription>{detail?.code ?? ""}</SheetDescription>
        </SheetHeader>
        {loading ? (
          <Loader2 className="mx-auto mt-24 h-7 w-7 animate-spin text-blue-700" />
        ) : (
          detail && (
            <div className="space-y-7 p-5">
              <DetailGrid
                rows={[
                  { label: "Offer Name", value: detail.name },
                  { label: "Product", value: detail.product },
                  { label: "Type", value: detail.typeLabel },
                  { label: "Discount", value: detail.discount },
                ]}
              />
              <DetailSection title="Validity">
                <DetailGrid
                  rows={[
                    { label: "Start Date", value: longDate(detail.startDate) },
                    { label: "End Date", value: longDate(detail.endDate) },
                  ]}
                />
              </DetailSection>
              <DetailSection title="Target">
                <DetailGrid
                  rows={[
                    { label: "Applicable To", value: detail.applicableTo },
                    {
                      label: "Minimum Qty",
                      value: `${money(detail.minimumQuantity)} Pack`,
                    },
                  ]}
                />
              </DetailSection>
              <DetailSection title="Performance Snapshot">
                <DetailGrid
                  rows={[
                    {
                      label: "Orders Applied",
                      value: String(detail.performance.ordersApplied),
                    },
                    {
                      label: "Total Discount",
                      value: `৳ ${money(detail.performance.totalDiscount)}`,
                    },
                    {
                      label: "Sales Generated",
                      value: `৳ ${money(detail.performance.salesGenerated)}`,
                    },
                  ]}
                />
              </DetailSection>
              <DetailSection title="Actions">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={onEdit} variant="outline">
                    Edit Offer
                  </Button>
                  <Button
                    onClick={() => onAction("pause")}
                    variant="outline"
                    disabled={acting || detail.status === "expired"}
                  >
                    <Pause className="mr-2 h-4 w-4" /> Pause
                  </Button>
                  <Button
                    onClick={() => onAction("deactivate")}
                    variant="outline"
                    disabled={acting || detail.status === "expired"}
                    className="text-red-700 hover:text-red-800"
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Deactivate
                  </Button>
                </div>
              </DetailSection>
            </div>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
        <CalendarDays className="h-3.5 w-3.5 text-blue-700" />
        {title}
      </div>
      {children}
    </section>
  );
}

function DetailGrid({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="bg-white p-4">
          <dt className="text-xs text-zinc-500">{row.label}</dt>
          <dd className="mt-1 font-semibold text-zinc-950">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
