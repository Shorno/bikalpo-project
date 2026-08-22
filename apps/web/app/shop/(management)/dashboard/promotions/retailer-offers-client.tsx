"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Eye,
  Loader2,
  Megaphone,
  Package,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type TemplateProduct = {
  productId: number;
  variantId?: number;
  catalogVariantId?: number | null;
  ownerVariantId?: number | null;
  available?: boolean;
  name: string;
  variantName?: string;
  brandName?: string;
  sku?: string | null;
  category: string;
  regularPrice: string;
  quantity: number;
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
    buyProducts: TemplateProduct[];
    getProducts: TemplateProduct[];
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
  offerType: OfferType;
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
      applyTo:
        detail.offerType === "buy_x_get_y"
          ? "all_products"
          : (detail.applyTo as ApplyTo),
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

  const data = dashboardQuery.data;
  return (
    <div className="space-y-5 pb-10">
      <header className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Megaphone className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  My offers
                </h1>
                <Badge variant="outline" className="gap-1.5 font-normal">
                  <Store className="size-3" /> {data?.shop.name ?? "Store"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Showing {data?.showing ?? "All Offers"}
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="shrink-0 gap-2">
            <Plus className="size-4" /> Create offer
          </Button>
        </div>
        <div className="grid grid-cols-2 border-t bg-muted/20 [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(2n)]:border-r-0 md:grid-cols-4 md:[&>*]:border-b-0 md:[&>*:nth-child(2n)]:border-r md:[&>*:last-child]:border-r-0">
          <Metric label="Total Offers" value={data?.kpis.total ?? 0} />
          <Metric label="Active" value={data?.kpis.active ?? 0} />
          <Metric label="Scheduled" value={data?.kpis.scheduled ?? 0} />
          <Metric label="Expired" value={data?.kpis.expired ?? 0} />
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Search className="size-4 text-muted-foreground" />
            Search &amp; filter
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(18rem,1.25fr)_1fr_1fr_1fr]">
            <div>
              <FieldLabel>Offer name or product</FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search offers…"
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
              label="Date range"
              options={DATE_OPTIONS}
              value={dateRange}
              onChange={(value) =>
                setDateRange(value === dateRange ? null : value)
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Offer list</h2>
            <p className="text-xs text-muted-foreground">
              Store and warehouse offers
            </p>
          </div>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {data?.offers.length ?? 0} result
            {data?.offers.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
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
                  <th key={label} className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboardQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-primary" />
                  </td>
                </tr>
              ) : !data?.offers.length ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center">
                    <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-xl border bg-muted/30 text-muted-foreground">
                      <Megaphone className="size-5" />
                    </span>
                    <div className="text-sm font-semibold">No offers found</div>
                  </td>
                </tr>
              ) : (
                data.offers.map((offer) => (
                  <tr
                    key={offer.id}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                      {offer.code}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium">{offer.name}</div>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-4 text-muted-foreground">
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
      </section>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
          <AlertTriangle className="size-4 text-muted-foreground" /> Alerts
        </div>
        <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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
      <OfferCreation
        open={creating}
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
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium text-foreground">
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
            aria-pressed={value === option.value}
            className={cn(
              "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              value === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
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
    <div className="border-r px-5 py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
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
      <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-muted px-2 font-mono text-xs font-semibold tabular-nums">
        {count}
      </span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function OfferCreation({
  open,
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
  open: boolean;
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
  const isBuyXGetY = template?.type === "buy_x_get_y";
  const unavailableTemplateProducts = isBuyXGetY
    ? [...template.buyProducts, ...template.getProducts].filter(
        (item) => !item.available,
      )
    : [];
  const comboSummary = isBuyXGetY
    ? `${template.buyProducts
        .map(
          (item) =>
            `${item.brandName ? `${item.brandName} ` : ""}${item.variantName || item.name} ×${item.quantity}`,
        )
        .join(" + ")} → ${template.getProducts
        .map(
          (item) =>
            `${item.brandName ? `${item.brandName} ` : ""}${item.variantName || item.name} ×${item.quantity}`,
        )
        .join(" + ")}`
    : "";
  const productLabel = isBuyXGetY
    ? comboSummary
    : form.applyTo === "all_products"
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
      applyTo:
        selected.type === "buy_x_get_y" ? "all_products" : current.applyTo,
      productId: selected.type === "buy_x_get_y" ? null : current.productId,
      variantId: selected.type === "buy_x_get_y" ? null : current.variantId,
      categoryId: selected.type === "buy_x_get_y" ? null : current.categoryId,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) onCancel();
      }}
    >
      <DialogContent
        showCloseButton={!saving}
        className="flex max-h-[94vh] grid-rows-none flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Tag className="size-4.5" aria-hidden="true" />
            </span>
            <div>
              <DialogTitle className="text-lg">
                {editing ? "Edit offer" : "Create offer from template"}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                {options?.shop.name ?? "Store"} · Template Based Offer Creation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="thin-scrollbar flex-1 overflow-y-auto bg-background px-5 sm:px-7">
          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center">
              <Loader2 className="size-7 animate-spin text-primary" />
            </div>
          ) : (
            <div className="mx-auto max-w-3xl divide-y">
              <FormStep number="01" title="Select Offer Template">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-y text-sm">
                    <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                      <tr>
                        {["Template Name", "Type", "Description", "Action"].map(
                          (label) => (
                            <th
                              key={label}
                              className={cn(
                                "px-3 py-2.5 font-medium",
                                label === "Action" && "text-right",
                              )}
                            >
                              {label}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {options?.templates.map((item) => (
                        <tr
                          key={item.id}
                          className={cn(
                            "transition-colors hover:bg-muted/20",
                            item.id === form.templateId && "bg-primary/5",
                          )}
                        >
                          <td className="px-3 py-3 font-medium">{item.name}</td>
                          <td className="px-3 py-3">{item.typeLabel}</td>
                          <td className="max-w-md px-3 py-3 text-muted-foreground">
                            {item.description}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                item.id === form.templateId
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => selectTemplate(item.id)}
                              disabled={editing}
                            >
                              {item.id === form.templateId ? (
                                <>
                                  <Check className="mr-1 h-3.5 w-3.5" />{" "}
                                  Selected
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
                <div className="mt-3 text-sm text-muted-foreground">
                  Selected:{" "}
                  <strong className="text-foreground">
                    {template?.name ?? "—"}
                  </strong>
                </div>
              </FormStep>

              <FormStep
                number="02"
                title={
                  isBuyXGetY
                    ? "Buy & Get Products"
                    : "Select Product / Category"
                }
              >
                {isBuyXGetY ? (
                  <div className="space-y-6">
                    <TemplateProductTable
                      title="Buy products"
                      products={template.buyProducts}
                    />
                    <TemplateProductTable
                      title="Get products"
                      products={template.getProducts}
                    />
                    {unavailableTemplateProducts.length > 0 ? (
                      <p className="text-sm text-destructive">
                        {unavailableTemplateProducts.length} required variant
                        {unavailableTemplateProducts.length === 1
                          ? " is"
                          : "s are"}{" "}
                        not carried by this store. You can save a draft, but the
                        offer cannot be activated.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
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
                          aria-label="Select product"
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
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                            aria-label="Select variant"
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
                            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-muted/40 disabled:opacity-60"
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
                          aria-label="Select category"
                          value={form.categoryId ?? ""}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              categoryId: event.target.value
                                ? Number(event.target.value)
                                : null,
                            }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
                  </>
                )}
              </FormStep>

              <FormStep number="03" title="Configure Offer Details">
                <div className="space-y-4">
                  <FormInput
                    label="Offer Name"
                    value={form.name}
                    onChange={(name) =>
                      setForm((current) => ({ ...current, name }))
                    }
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
                    label={
                      isBuyXGetY
                        ? "Buy Quantity (Template)"
                        : "Minimum Quantity"
                    }
                    type="number"
                    value={form.minimumQuantity}
                    disabled={isBuyXGetY}
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
                <div className="space-y-4">
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
                      setForm((current) => ({
                        ...current,
                        allDay: value === "all",
                      }))
                    }
                  />
                </div>
                {!form.allDay && (
                  <div className="mt-4 space-y-4">
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
                    {
                      value: "specific_customers",
                      label: "Specific Customers",
                    },
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
                    <div className="max-h-52 divide-y overflow-y-auto rounded-lg border">
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
                    <div className="max-h-52 divide-y overflow-y-auto rounded-lg border">
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
                <div className="space-y-6">
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
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-background px-5 py-3">
          <div className="mx-auto flex max-w-3xl flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading || saving}
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
              disabled={
                saving ||
                (form.activation === "activate" &&
                  unavailableTemplateProducts.length > 0)
              }
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
      </DialogContent>
    </Dialog>
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
    <section id={`offer-step-${number}`} className="space-y-4 py-6">
      <div className="flex items-start gap-3">
        <span className="font-mono text-xs font-semibold text-primary">
          {number}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function TemplateProductTable({
  title,
  products,
}: {
  title: string;
  products: TemplateProduct[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium">{title}</h3>
      <div className="border-y">
        {products.map((product, index) => {
          const available = product.available === true;
          return (
            <div
              key={`${product.variantId ?? product.productId}-${index}`}
              className="grid gap-3 border-b px-1 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_5rem_7rem] sm:items-center"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Package className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {[product.brandName, product.variantName || product.name]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {product.variantName ? `${product.name} · ` : ""}
                    {product.sku || product.category}
                  </p>
                </div>
              </div>
              <div className="font-mono text-sm tabular-nums sm:text-center">
                ×{product.quantity}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "w-fit justify-self-start sm:justify-self-end",
                  available
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700",
                )}
              >
                {available ? "Available" : "Unavailable"}
              </Badge>
            </div>
          );
        })}
      </div>
    </div>
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
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold",
            value === option.value
              ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
              : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
          )}
        >
          <span
            className={cn(
              "h-3.5 w-3.5 rounded-full border",
              value === option.value
                ? "border-[4px] border-primary"
                : "border-border",
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
    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-primary"
      />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {detail && (
        <span className="text-xs text-muted-foreground">{detail}</span>
      )}
    </label>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2">
      <span className="text-muted-foreground">{label}</span>
      <strong className="font-mono text-right tabular-nums">{value}</strong>
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
        <SheetHeader className="border-b">
          <SheetTitle>Offer Details</SheetTitle>
          <SheetDescription>{detail?.code ?? ""}</SheetDescription>
        </SheetHeader>
        {loading ? (
          <Loader2 className="mx-auto mt-24 size-7 animate-spin text-primary" />
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
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <CalendarDays className="size-3.5 text-primary" />
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
    <dl className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="bg-background p-4">
          <dt className="text-xs text-muted-foreground">{row.label}</dt>
          <dd className="mt-1 font-semibold">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
