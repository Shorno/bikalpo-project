"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  CreditCard,
  Filter,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            Suppliers Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats ? `${stats.activeCount} Active Suppliers` : "Loading..."}
          </p>
        </div>
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
