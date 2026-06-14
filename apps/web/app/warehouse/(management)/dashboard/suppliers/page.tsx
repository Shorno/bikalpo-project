"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CreditCard,
  DollarSign,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  Star,
  Users,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useDebounce } from "@/hooks/use-debounce";
import {
  useLookupWarehouseSupplier,
  useMyWarehouseSuppliers,
  useRequestWarehouseSupplier,
} from "@/hooks/use-warehouse-supplier-connections";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import {
  MetricCardsGridSkeleton,
  SuppliersTableBodySkeleton,
} from "./_components/suppliers-skeletons";
import { supplierDetailHref } from "./_lib/supplier-routes";

const TOP_SUPPLIER_THRESHOLD = 500_000;
const SUPPLIERS_TABLE_MIN_WIDTH = "min-w-[52rem]";

type SupplierForm = {
  name: string;
  company: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  creditLimit: string;
  returnPackAgreement: boolean;
  categoryId: number | null;
};

const emptyForm: SupplierForm = {
  name: "",
  company: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  creditLimit: "0",
  returnPackAgreement: false,
  categoryId: null,
};

type StatusFilter = "all" | "active" | "inactive" | "top";

type UnifiedSupplier = {
  key: string;
  kind: "external" | "warehouse";
  linkId: number;
  name: string;
  category: string;
  contact: string | null;
  totalPurchase: number;
  displayStatus: "top" | "active" | "inactive" | "pending";
};

const statusPillConfig: Record<
  string,
  { label: string; dotClass: string; pillClass: string }
> = {
  top: {
    label: "Top Supplier",
    dotClass: "bg-amber-500",
    pillClass: "text-amber-700 bg-amber-50 border-amber-200",
  },
  active: {
    label: "Active",
    dotClass: "bg-emerald-500",
    pillClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  inactive: {
    label: "Inactive",
    dotClass: "bg-rose-500",
    pillClass: "text-rose-700 bg-rose-50 border-rose-200",
  },
  pending: {
    label: "Pending",
    dotClass: "bg-amber-500",
    pillClass: "text-amber-700 bg-amber-50 border-amber-200",
  },
};

function formatMoney(value: number) {
  return `৳${value.toLocaleString("en-BD")}`;
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-border/80 sm:rounded-xl sm:p-4">
      <div className="mb-1 flex items-center gap-2 sm:mb-2 sm:justify-between">
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:flex-none sm:text-xs sm:tracking-wider">
          {title}
        </span>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground sm:h-7 sm:w-7 sm:rounded-lg">
          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </div>
      </div>
      <span className="block truncate text-base font-bold font-mono tabular-nums tracking-tight text-foreground sm:text-xl">
        {value}
      </span>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function SupplierStatusPill({ status }: { status: UnifiedSupplier["displayStatus"] }) {
  const config = statusPillConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.pillClass}`}
    >
      {status === "top" ? (
        <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full ${config.dotClass}`} />
      )}
      {config.label}
    </span>
  );
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const { data: sessionData } = authClient.useSession();
  const warehouseName =
    (sessionData?.user as { warehouseName?: string })?.warehouseName ||
    "IFAD Distribution Hub";

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SupplierForm>({ ...emptyForm });

  const externalQuery = useQuery({
    queryKey: [
      "warehouse",
      "suppliers",
      debouncedSearch,
      categoryFilter,
    ],
    queryFn: () =>
      orpc.warehouse.getSuppliers.call({
        search: debouncedSearch.trim() || undefined,
        status: "all",
        categoryId: categoryFilter,
      }),
  });

  const warehouseQuery = useMyWarehouseSuppliers({
    status: "all",
    search: debouncedSearch,
    limit: 100,
  });

  const statsQuery = useQuery({
    queryKey: ["warehouse", "supplierStats"],
    queryFn: () => orpc.warehouse.getSupplierStats.call({}),
  });

  const payableSummaryQuery = useQuery({
    queryKey: ["supplierPayment", "getPayableSummary"],
    queryFn: () => orpc.supplierPayment.getPayableSummary.call({}),
  });

  const orderTotalsQuery = useQuery({
    queryKey: ["warehouse", "getMyOrders", "supplier-totals"],
    queryFn: () =>
      orpc.warehouse.getMyOrders.call({
        timeframe: "all",
        page: 1,
        limit: 500,
      }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["warehouse", "supplierCategories"],
    queryFn: () => orpc.warehouse.getSupplierCategories.call({}),
  });

  const warehousePurchaseTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const order of orderTotalsQuery.data?.orders ?? []) {
      const supplierId = order.warehouseId as string;
      if (!supplierId) continue;
      map[supplierId] = (map[supplierId] ?? 0) + parseFloat(order.total || "0");
    }
    return map;
  }, [orderTotalsQuery.data?.orders]);

  const unifiedSuppliers = useMemo(() => {
    const rows: UnifiedSupplier[] = [];

    for (const s of externalQuery.data?.suppliers ?? []) {
      const displayStatus: UnifiedSupplier["displayStatus"] =
        s.totalPurchase > TOP_SUPPLIER_THRESHOLD
          ? "top"
          : s.status === "active"
            ? "active"
            : "inactive";

      rows.push({
        key: `ext-${s.id}`,
        kind: "external",
        linkId: s.id,
        name: s.name,
        category: s.categoryName ?? "External",
        contact: s.phone ?? null,
        totalPurchase: s.totalPurchase,
        displayStatus,
      });
    }

    for (const w of warehouseQuery.data?.items ?? []) {
      const totalPurchase = warehousePurchaseTotals[w.warehouseId] ?? 0;
      let displayStatus: UnifiedSupplier["displayStatus"] = "inactive";
      if (w.status === "pending") displayStatus = "pending";
      else if (w.status === "active") {
        displayStatus =
          totalPurchase > TOP_SUPPLIER_THRESHOLD ? "top" : "active";
      }

      rows.push({
        key: `wh-${w.connectionId}`,
        kind: "warehouse",
        linkId: w.connectionId,
        name: w.warehouseName || w.name || "Unnamed Warehouse",
        category: "Warehouse",
        contact: w.phone ?? null,
        totalPurchase,
        displayStatus,
      });
    }

    return rows.sort((a, b) => {
      if (b.totalPurchase !== a.totalPurchase) {
        return b.totalPurchase - a.totalPurchase;
      }
      return a.name.localeCompare(b.name);
    });
  }, [
    externalQuery.data?.suppliers,
    warehouseQuery.data?.items,
    warehousePurchaseTotals,
  ]);

  const filteredSuppliers = useMemo(() => {
    return unifiedSuppliers.filter((s) => {
      if (statusFilter === "active") {
        return s.displayStatus === "active" || s.displayStatus === "top";
      }
      if (statusFilter === "inactive") {
        return s.displayStatus === "inactive";
      }
      if (statusFilter === "top") {
        return s.displayStatus === "top";
      }
      return true;
    });
  }, [unifiedSuppliers, statusFilter]);

  const activeCount = unifiedSuppliers.filter(
    (s) => s.displayStatus === "active" || s.displayStatus === "top",
  ).length;

  const stats = statsQuery.data;
  const categories = categoriesData?.categories ?? [];
  const overdueValue =
    payableSummaryQuery.data?.suppliers?.reduce(
      (sum: number, s: { currentPayable: string }) =>
        sum + parseFloat(s.currentPayable),
      0,
    ) ?? 0;

  const hasActiveFilters =
    statusFilter !== "all" ||
    categoryFilter !== undefined ||
    searchQuery.trim() !== "";

  const isLoading =
    externalQuery.isLoading ||
    warehouseQuery.isLoading ||
    orderTotalsQuery.isLoading;
  const isError = externalQuery.isError || warehouseQuery.isError;
  const isSearchEmpty =
    debouncedSearch.trim().length > 0 && filteredSuppliers.length === 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse", "supplierStats"] });
    queryClient.invalidateQueries({
      queryKey: orpc.warehouse.getMyWarehouseSuppliers.key(),
    });
    queryClient.invalidateQueries({ queryKey: ["warehouse", "getMyOrders"] });
    queryClient.invalidateQueries({
      queryKey: ["supplierPayment", "getPayableSummary"],
    });
  };

  const createMutation = useMutation({
    mutationFn: (data: SupplierForm) =>
      orpc.warehouse.createSupplier.call({
        ...data,
        categoryId: data.categoryId ?? undefined,
      }),
    onSuccess: () => {
      invalidateAll();
      resetForm();
      toast.success("Supplier created");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to create supplier"),
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const handleReset = () => {
    setStatusFilter("all");
    setCategoryFilter(undefined);
    setSearchQuery("");
  };

  return (
    <div className="w-full space-y-4 pb-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground sm:mb-1.5">
            <Link
              href="/warehouse/dashboard"
              className="transition-colors hover:text-foreground"
            >
              Warehouse
            </Link>
            <span>/</span>
            <span className="truncate font-medium text-foreground">Suppliers</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Suppliers Management
          </h1>
          <div className="mt-1.5 flex flex-col gap-1 text-xs text-muted-foreground sm:mt-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1.5 sm:text-sm">
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin size={13} className="shrink-0" />
              Warehouse:{" "}
              <span className="font-medium text-foreground">{warehouseName}</span>
            </span>
            <span className="hidden text-border sm:inline">•</span>
            <span className="inline-flex items-center gap-1">
              <Users size={13} className="shrink-0" />
              Total Suppliers:{" "}
              <span className="font-medium text-foreground">
                {isLoading ? "—" : `${activeCount} Active`}
              </span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <ConnectWarehouseSupplierDialog />
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="h-9 w-full bg-amber-600 text-xs font-semibold text-white hover:bg-amber-500/90 sm:w-auto"
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Add New Supplier
          </Button>
        </div>
      </div>

      {/* KPIs */}
      {statsQuery.isLoading && !stats ? (
        <MetricCardsGridSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            title="Total Purchase"
            value={formatMoney(stats?.totalPurchase ?? 0)}
            icon={DollarSign}
          />
          <MetricCard
            title="Total Paid"
            value={formatMoney(stats?.totalPaid ?? 0)}
            icon={CreditCard}
          />
          <MetricCard
            title="Payable"
            value={formatMoney(stats?.totalPayable ?? 0)}
            icon={Building2}
          />
          <MetricCard
            title="Overdue"
            value={formatMoney(overdueValue)}
            icon={AlertCircle}
          />
        </div>
      )}

      {/* Table */}
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
        <div className="space-y-3 border-b border-border p-4 sm:space-y-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Supplier List
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                External vendors and connected warehouse suppliers — click any row
                for details
              </p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Supplier name, phone, product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="-mx-4 flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:-mx-5 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
                Filter:
              </span>
              {(
                [
                  ["all", "All"],
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                  ["top", "Top Supplier"],
                ] as const
              ).map(([value, label]) => (
                <FilterPill
                  key={value}
                  active={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                </FilterPill>
              ))}
            </div>
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
                  Category:
                </span>
                {categories.map((c: { id: number; name: string }) => (
                  <FilterPill
                    key={c.id}
                    active={categoryFilter === c.id}
                    onClick={() =>
                      setCategoryFilter(
                        categoryFilter === c.id ? undefined : c.id,
                      )
                    }
                  >
                    {c.name}
                  </FilterPill>
                ))}
              </div>
            )}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 text-xs font-semibold"
                >
                  Reset filters
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-[360px] w-full flex-col">
          {isLoading ? (
            <SuppliersTableBodySkeleton />
          ) : isError ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
              <AlertCircle className="mb-2 size-10 text-red-300" />
              <p className="font-medium text-red-600">Failed to load suppliers</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center px-4 py-16 text-center">
              {isSearchEmpty ? (
                <Search className="mb-3 size-10 text-muted-foreground/40" />
              ) : (
                <Users className="mb-3 size-10 text-muted-foreground/40" />
              )}
              <p className="font-medium text-foreground">
                {isSearchEmpty ? "No matching suppliers" : "No suppliers found"}
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                {isSearchEmpty
                  ? `Nothing matched "${debouncedSearch.trim()}".`
                  : hasActiveFilters
                    ? "Try adjusting your filters."
                    : "Add an external supplier or connect a warehouse supplier to get started."}
              </p>
              {hasActiveFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="mt-4 h-8 text-xs"
                >
                  Reset filters
                </Button>
              ) : (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={() => setDialogOpen(true)}
                    className="h-8 bg-amber-600 text-xs text-white hover:bg-amber-500/90"
                    size="sm"
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add Supplier
                  </Button>
                  <ConnectWarehouseSupplierDialog triggerVariant="outline" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className={`w-full ${SUPPLIERS_TABLE_MIN_WIDTH}`}>
                <TableHeader>
                  <TableRow className="border-b border-border bg-muted/30 hover:bg-transparent">
                    {[
                      "Supplier Name",
                      "Type",
                      "Category",
                      "Contact",
                      "Total Purchase",
                      "Status",
                      "Action",
                    ].map((col) => (
                      <TableHead
                        key={col}
                        className={`h-auto whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:py-3 ${
                          col === "Total Purchase" || col === "Action"
                            ? "text-right"
                            : ""
                        }`}
                      >
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((s) => (
                    <TableRow
                      key={s.key}
                      className="border-b border-border transition-colors hover:bg-muted/30"
                    >
                      <TableCell className="px-3 py-3 align-middle sm:px-4 sm:py-3.5">
                        <Link
                          href={supplierDetailHref(s.kind, s.linkId)}
                          className="block min-w-[9rem]"
                        >
                          <p className="truncate text-sm font-semibold text-foreground">
                            {s.name}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell className="px-3 py-3 align-middle sm:px-4 sm:py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                            s.kind === "warehouse"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-border bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          {s.kind === "warehouse" ? "Warehouse" : "External"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3 align-middle sm:px-4 sm:py-3.5">
                        <span className="inline-flex rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                          {s.category}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-3 align-middle sm:px-4 sm:py-3.5">
                        {s.contact ? (
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {s.contact}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right align-middle font-mono text-xs font-bold tabular-nums sm:px-4 sm:py-3.5">
                        {formatMoney(s.totalPurchase)}
                      </TableCell>
                      <TableCell className="px-3 py-3 align-middle sm:px-4 sm:py-3.5">
                        <SupplierStatusPill status={s.displayStatus} />
                      </TableCell>
                      <TableCell className="px-3 py-3 text-right align-middle sm:px-4 sm:py-3.5">
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="text-xs font-semibold text-primary hover:bg-muted"
                        >
                          <Link href={supplierDetailHref(s.kind, s.linkId)}>
                            View &rarr;
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        setForm={setForm}
        categories={categories}
        onSubmit={handleSubmit}
        onCancel={resetForm}
        isPending={createMutation.isPending}
      />
    </div>
  );
}

function ConnectWarehouseSupplierDialog({
  triggerVariant = "default",
}: {
  triggerVariant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [warehouseKey, setWarehouseKey] = useState("");
  const [submittedKey, setSubmittedKey] = useState("");
  const lookup = useLookupWarehouseSupplier(submittedKey);
  const requestSupplier = useRequestWarehouseSupplier();

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const key = warehouseKey.trim();
    if (!key) return;
    setSubmittedKey(key);
  };

  const handleRequest = () => {
    const key = lookup.data?.warehouse?.warehouseSlug || submittedKey;
    if (!key) return;
    requestSupplier.mutate(
      { warehouseKey: key },
      {
        onSuccess: () => {
          setOpen(false);
          setWarehouseKey("");
          setSubmittedKey("");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className={`h-9 w-full gap-1.5 text-xs font-semibold sm:w-auto ${
            triggerVariant === "default"
              ? "bg-background text-foreground hover:bg-muted"
              : ""
          }`}
        >
          <Warehouse className="h-3.5 w-3.5" />
          Connect Warehouse
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Warehouse Supplier</DialogTitle>
          <DialogDescription>
            Enter the warehouse slug or id provided by your supplier warehouse.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={warehouseKey}
              onChange={(e) => setWarehouseKey(e.target.value)}
              placeholder="e.g. mims-distribution"
              className="pl-9"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={!warehouseKey.trim() || lookup.isLoading}
          >
            {lookup.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </form>
        <div className="min-h-[120px]">
          {lookup.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Searching...
            </div>
          ) : lookup.isError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-amber-700">
              <AlertCircle className="mx-auto mb-2 h-6 w-6" />
              <p className="text-sm font-medium">Warehouse not found</p>
            </div>
          ) : lookup.data?.warehouse ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="font-semibold">
                {lookup.data.warehouse.warehouseName ||
                  lookup.data.warehouse.name}
              </p>
              <p className="mt-1 text-xs text-emerald-600">
                {lookup.data.warehouse.productCount} products available
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Search for a warehouse supplier to preview it here.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleRequest}
            disabled={!lookup.data?.warehouse || requestSupplier.isPending}
          >
            {requestSupplier.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Request Access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SupplierFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  categories,
  onSubmit,
  onCancel,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: SupplierForm;
  setForm: React.Dispatch<React.SetStateAction<SupplierForm>>;
  categories: { id: number; name: string }[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Supplier</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="mt-2 space-y-4">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Supplier Name *</Label>
              <Input
                required
                placeholder="e.g. ACI Ltd."
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.categoryId ? String(form.categoryId) : "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    categoryId: v === "none" ? null : Number(v),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="e.g. 01711-223344"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input
                value={form.company}
                onChange={(e) =>
                  setForm({ ...form, company: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm({ ...form, address: e.target.value })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              Save Supplier
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
