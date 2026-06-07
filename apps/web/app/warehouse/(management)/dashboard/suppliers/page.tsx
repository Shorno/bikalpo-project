"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Filter,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  Warehouse,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCancelWarehouseSupplierRequest,
  useDisconnectWarehouseSupplier,
  useLookupWarehouseSupplier,
  useMyWarehouseSuppliers,
  useRequestWarehouseSupplier,
} from "@/hooks/use-warehouse-supplier-connections";
import { orpc } from "@/utils/orpc";

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

function formatMoney(value: number) {
  return `৳ ${value.toLocaleString("en-BD")}`;
}

export default function SuppliersPage() {
  return (
    <Tabs defaultValue="warehouse" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Suppliers
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage connected warehouse suppliers and external vendor records.
          </p>
        </div>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="warehouse">Warehouse Suppliers</TabsTrigger>
          <TabsTrigger value="external">External Suppliers</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="warehouse" className="mt-0">
        <WarehouseSuppliersPanel />
      </TabsContent>
      <TabsContent value="external" className="mt-0">
        <ExternalSuppliersPanel />
      </TabsContent>
    </Tabs>
  );
}

function WarehouseSuppliersPanel() {
  const [statusTab, setStatusTab] = useState<"all" | "active" | "pending" | "disconnected">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { data, isLoading, isError } = useMyWarehouseSuppliers({
    status: statusTab,
    search: debouncedSearch,
  });
  const cancelMutation = useCancelWarehouseSupplierRequest();
  const disconnectMutation = useDisconnectWarehouseSupplier();

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__warehouseSupSearchTimer);
    (window as any).__warehouseSupSearchTimer = setTimeout(
      () => setDebouncedSearch(v),
      400,
    );
  }, []);

  const suppliers = data?.items ?? [];
  const counts = suppliers.reduce(
    (acc: Record<string, number>, item: any) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search warehouse suppliers..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <ConnectWarehouseSupplierDialog />
      </div>

      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">
            Connected
            {counts.active ? <span className="ml-1 text-[10px] opacity-70">{counts.active}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            {counts.pending ? <span className="ml-1 text-[10px] opacity-70">{counts.pending}</span> : null}
          </TabsTrigger>
          <TabsTrigger value="disconnected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
            <p className="font-medium text-red-600">Failed to load warehouse suppliers</p>
          </CardContent>
        </Card>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Warehouse className="w-14 h-14 text-muted-foreground/25 mx-auto mb-4" />
            <p className="text-lg font-semibold">No warehouse suppliers found</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              {debouncedSearch
                ? "No connected warehouse suppliers match your search"
                : "Request access by warehouse slug or id to build your supplier network"}
            </p>
            {!debouncedSearch && <ConnectWarehouseSupplierDialog />}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Slug / Code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier: any) => (
                  <TableRow key={supplier.connectionId}>
                    <TableCell>
                      <div className="font-medium">
                        {supplier.warehouseName || supplier.name || "Unnamed Warehouse"}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {supplier.warehouseAddress || "No address provided"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {supplier.warehouseSlug || supplier.warehouseId}
                      </span>
                    </TableCell>
                    <TableCell>
                      {supplier.phone ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {supplier.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" />
                        {supplier.status === "active" ? supplier.productCount : 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <WarehouseSupplierStatus status={supplier.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {supplier.status === "pending" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          disabled={cancelMutation.isPending}
                          onClick={() =>
                            cancelMutation.mutate({
                              connectionId: supplier.connectionId,
                            })
                          }
                        >
                          {cancelMutation.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : null}
                          Cancel
                        </Button>
                      ) : supplier.status === "active" ? (
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm">
                            <Link
                              href={`/warehouse/dashboard/order-from-supplier?warehouse=${encodeURIComponent(
                                supplier.warehouseSlug || supplier.warehouseId,
                              )}`}
                            >
                              <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                              Order
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={disconnectMutation.isPending}
                            onClick={() => {
                              if (confirm("Disconnect this warehouse supplier?")) {
                                disconnectMutation.mutate({
                                  connectionId: supplier.connectionId,
                                });
                              }
                            }}
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          Request Denied
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WarehouseSupplierStatus({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Connected
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 gap-1">
        <Clock className="w-3 h-3" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50 gap-1">
      <XCircle className="w-3 h-3" />
      Rejected
    </Badge>
  );
}

function ConnectWarehouseSupplierDialog() {
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
        <Button className="gap-1.5">
          <Plus className="w-4 h-4" />
          Add Warehouse Supplier
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={warehouseKey}
              onChange={(e) => setWarehouseKey(e.target.value)}
              placeholder="e.g. mims-distribution"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!warehouseKey.trim() || lookup.isLoading}>
            {lookup.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </form>

        <div className="min-h-[130px]">
          {lookup.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
              Searching...
            </div>
          ) : lookup.isError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-amber-700">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm font-medium">Warehouse not found</p>
              <p className="text-xs mt-1">Check the slug or id and try again.</p>
            </div>
          ) : lookup.data?.warehouse ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <Warehouse className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {lookup.data.warehouse.warehouseName || lookup.data.warehouse.name}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {lookup.data.warehouse.warehouseAddress || "No address provided"}
                  </p>
                  <p className="text-xs font-medium text-emerald-600 mt-1">
                    {lookup.data.warehouse.productCount} products available
                  </p>
                </div>
              </div>
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
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Request Access
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExternalSuppliersPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>({ ...emptyForm });

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__supSearchTimer);
    (window as any).__supSearchTimer = setTimeout(() => setDebouncedSearch(v), 400);
  }, []);

  // ── Queries ──
  const { data: suppliersData, isLoading } = useQuery({
    queryKey: ["warehouse", "suppliers", debouncedSearch, statusFilter, categoryFilter],
    queryFn: () =>
      orpc.warehouse.getSuppliers.call({
        search: debouncedSearch || undefined,
        status: statusFilter,
        categoryId: categoryFilter,
      }),
  });

  const { data: statsData } = useQuery({
    queryKey: ["warehouse", "supplierStats"],
    queryFn: () => orpc.warehouse.getSupplierStats.call({}),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["warehouse", "supplierCategories"],
    queryFn: () => orpc.warehouse.getSupplierCategories.call({}),
  });

  // ── Mutations ──
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["warehouse", "supplierStats"] });
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
    onError: (e: any) => toast.error(e.message || "Failed to create supplier"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: SupplierForm & { id: number }) =>
      orpc.warehouse.updateSupplier.call({
        ...data,
        categoryId: data.categoryId,
      }),
    onSuccess: () => {
      invalidateAll();
      resetForm();
      toast.success("Supplier updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update supplier"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => orpc.warehouse.deleteSupplier.call({ id }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Supplier deleted");
    },
  });

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleEdit = (s: any) => {
    setForm({
      name: s.name,
      company: s.company || "",
      contactPerson: s.contactPerson || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      notes: s.notes || "",
      creditLimit: s.creditLimit || "0",
      returnPackAgreement: s.returnPackAgreement ?? false,
      categoryId: s.categoryId ?? null,
    });
    setEditingId(s.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ ...form, id: editingId });
    } else {
      createMutation.mutate(form);
    }
  };

  const suppliers = suppliersData?.suppliers ?? [];
  const stats = statsData;
  const categories = categoriesData?.categories ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {stats ? `${stats.activeCount} Active External Suppliers` : "Loading..."}
        </p>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add New Supplier
        </Button>
      </div>

      {/* ── Search & Filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as any)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={categoryFilter ? String(categoryFilter) : "all"}
          onValueChange={(v) =>
            setCategoryFilter(v === "all" ? undefined : Number(v))
          }
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Financial KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Purchase</p>
              {stats ? (
                <p className="text-lg font-bold tabular-nums">
                  {formatMoney(stats.totalPurchase)}
                </p>
              ) : (
                <Skeleton className="h-6 w-24" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              {stats ? (
                <p className="text-lg font-bold tabular-nums text-emerald-600">
                  {formatMoney(stats.totalPaid)}
                </p>
              ) : (
                <Skeleton className="h-6 w-24" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payable</p>
              {stats ? (
                <p
                  className={`text-lg font-bold tabular-nums ${
                    stats.totalPayable > 0
                      ? "text-orange-600"
                      : "text-muted-foreground"
                  }`}
                >
                  {formatMoney(stats.totalPayable)}
                </p>
              ) : (
                <Skeleton className="h-6 w-24" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Supplier List ── */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-semibold">No suppliers found</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              {debouncedSearch
                ? "No suppliers match your search"
                : "Add your first supplier to start tracking purchases"}
            </p>
            {!debouncedSearch && (
              <Button
                onClick={() => {
                  resetForm();
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Total Purchase</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s: any) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <TableCell>
                      <Link
                        href={`/warehouse/dashboard/suppliers/${s.id}`}
                        className="block"
                      >
                        <div className="font-medium">{s.name}</div>
                        {s.company && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {s.company}
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {s.categoryName ? (
                        <Badge variant="outline" className="text-xs">
                          {s.categoryName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.phone ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {s.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(s.totalPurchase)}
                    </TableCell>
                    <TableCell>
                      {s.totalPurchase > 500000 ? (
                        <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-0.5">
                          <Star className="w-2.5 h-2.5" />
                          Top Supplier
                        </Badge>
                      ) : s.status === "active" ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50"
                        >
                          ✅ Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-red-600 border-red-200 bg-red-50"
                        >
                          ⚠ Suspended
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(s);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this supplier?"))
                              deleteMutation.mutate(s.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Add/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Supplier" : "Add New Supplier"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                    {categories.map((c: any) => (
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
                  placeholder="e.g. ACI Industries Ltd."
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input
                  placeholder="e.g. Mr. Karim"
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm({ ...form, contactPerson: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="supplier@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Credit Limit (৳)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={form.creditLimit}
                  onChange={(e) =>
                    setForm({ ...form, creditLimit: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input
                  placeholder="e.g. Tejgaon Industrial Area, Dhaka"
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Notes</Label>
                <Input
                  placeholder="Internal notes..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.returnPackAgreement}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        returnPackAgreement: e.target.checked,
                      })
                    }
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-foreground">
                    Return Pack Agreement (accepts empty pack returns)
                  </span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? "Update" : "Save"} Supplier
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
