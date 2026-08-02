"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  Filter,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useState } from "react";
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

function formatMoney(value: number | string | null | undefined) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "suspended"
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SupplierForm>({ ...emptyForm });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    window.clearTimeout((window as any).__retailerSupplierSearchTimer);
    (window as any).__retailerSupplierSearchTimer = window.setTimeout(
      () => setDebouncedSearch(value.trim()),
      400,
    );
  }, []);

  const { data: suppliersData, isLoading } = useQuery({
    queryKey: [
      "shopOwner",
      "suppliers",
      debouncedSearch,
      statusFilter,
      categoryFilter,
    ],
    queryFn: () =>
      orpc.shopOwner.getSuppliers.call({
        search: debouncedSearch || undefined,
        status: statusFilter,
        categoryId: categoryFilter,
      }),
  });

  const { data: statsData } = useQuery({
    queryKey: ["shopOwner", "supplierStats"],
    queryFn: () => orpc.shopOwner.getSupplierStats.call({}),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["shopOwner", "supplierCategories"],
    queryFn: () => orpc.shopOwner.getSupplierCategories.call({}),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["shopOwner", "suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["shopOwner", "supplierStats"] });
    queryClient.invalidateQueries({
      queryKey: orpc.supplierPayment.getPayableSummary.key(),
    });
  };

  const resetForm = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setDialogOpen(false);
  };

  const createMutation = useMutation({
    mutationFn: (data: SupplierForm) =>
      orpc.shopOwner.createSupplier.call(data),
    onSuccess: () => {
      invalidateAll();
      resetForm();
      toast.success("Supplier created");
    },
    onError: (error: any) =>
      toast.error(error.message || "Failed to create supplier"),
  });

  const updateMutation = useMutation({
    mutationFn: (data: SupplierForm & { id: number }) =>
      orpc.shopOwner.updateSupplier.call(data),
    onSuccess: () => {
      invalidateAll();
      resetForm();
      toast.success("Supplier updated");
    },
    onError: (error: any) =>
      toast.error(error.message || "Failed to update supplier"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => orpc.shopOwner.deleteSupplier.call({ id }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Supplier deleted");
    },
    onError: (error: any) =>
      toast.error(error.message || "Failed to delete supplier"),
  });

  const handleEdit = (supplier: any) => {
    setForm({
      name: supplier.name,
      company: supplier.company || "",
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      creditLimit: supplier.creditLimit || "0",
      returnPackAgreement: supplier.returnPackAgreement ?? false,
      categoryId: supplier.categoryId ?? null,
    });
    setEditingId(supplier.id);
    setDialogOpen(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (editingId) {
      updateMutation.mutate({ ...form, id: editingId });
      return;
    }

    createMutation.mutate(form);
  };

  const suppliers = suppliersData?.suppliers ?? [];
  const stats = statsData;
  const categories = categoriesData?.categories ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Users className="h-6 w-6 text-emerald-600" />
            Suppliers
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage retailer supplier records, payable balances, and purchase
            activity.
          </p>
        </div>

        <Button
          className="gap-1.5"
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add New Supplier
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Search by name, company, or phone..."
            value={search}
          />
        </div>

        <Tabs
          onValueChange={(value) =>
            setStatusFilter(value as typeof statusFilter)
          }
          value={statusFilter}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="suspended">Suspended</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          onValueChange={(value) =>
            setCategoryFilter(value === "all" ? undefined : Number(value))
          }
          value={categoryFilter ? String(categoryFilter) : "all"}
        >
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category: any) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/30">
              <TrendingUp className="h-5 w-5 text-blue-600" />
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
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
              <Wallet className="h-5 w-5 text-emerald-600" />
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
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-950/30">
              <CreditCard className="h-5 w-5 text-orange-500" />
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

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton className="h-12 w-full" key={index} />
            ))}
          </CardContent>
        </Card>
      ) : suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto mb-4 h-14 w-14 text-muted-foreground/20" />
            <p className="text-lg font-semibold">No suppliers found</p>
            <p className="mb-6 mt-1 text-sm text-muted-foreground">
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
                {suppliers.map((supplier: any) => (
                  <TableRow
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    key={supplier.id}
                  >
                    <TableCell>
                      <Link
                        className="block"
                        href={`/dashboard/suppliers/${supplier.id}`}
                      >
                        <div className="font-medium">{supplier.name}</div>
                        {supplier.company && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {supplier.company}
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {supplier.categoryName ? (
                        <Badge className="text-xs" variant="outline">
                          {supplier.categoryName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          None
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {supplier.phone ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {supplier.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          None
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(supplier.totalPurchase)}
                    </TableCell>
                    <TableCell>
                      {supplier.totalPurchase > 500000 ? (
                        <Badge className="gap-0.5 border-amber-200 bg-amber-100 text-[10px] text-amber-700 hover:bg-amber-100">
                          <Star className="h-2.5 w-2.5" />
                          Top Supplier
                        </Badge>
                      ) : supplier.status === "active" ? (
                        <Badge
                          className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-600"
                          variant="outline"
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          className="border-red-200 bg-red-50 text-[10px] text-red-600"
                          variant="outline"
                        >
                          Suspended
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          className="h-7 w-7"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEdit(supplier);
                          }}
                          size="icon"
                          variant="ghost"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          className="h-7 w-7 text-red-500 hover:bg-red-50 hover:text-red-600"
                          disabled={deleteMutation.isPending}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm("Delete this supplier?")) {
                              deleteMutation.mutate(supplier.id);
                            }
                          }}
                          size="icon"
                          variant="ghost"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Supplier" : "Add New Supplier"}
            </DialogTitle>
          </DialogHeader>
          <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Supplier Name *</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="e.g. ACI Ltd."
                  required
                  value={form.name}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      categoryId: value === "none" ? null : Number(value),
                    })
                  }
                  value={form.categoryId ? String(form.categoryId) : "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((category: any) => (
                      <SelectItem key={category.id} value={String(category.id)}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                  placeholder="e.g. 01711-223344"
                  value={form.phone}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, company: event.target.value })
                  }
                  placeholder="e.g. ACI Industries Ltd."
                  value={form.company}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, contactPerson: event.target.value })
                  }
                  placeholder="e.g. Mr. Karim"
                  value={form.contactPerson}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                  placeholder="supplier@company.com"
                  type="email"
                  value={form.email}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Credit Limit (Tk)</Label>
                <Input
                  min="0"
                  onChange={(event) =>
                    setForm({ ...form, creditLimit: event.target.value })
                  }
                  placeholder="0"
                  step="0.01"
                  type="number"
                  value={form.creditLimit}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, address: event.target.value })
                  }
                  placeholder="e.g. Tejgaon Industrial Area, Dhaka"
                  value={form.address}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notes</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
                  placeholder="Internal notes..."
                  value={form.notes}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    checked={form.returnPackAgreement}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    onChange={(event) =>
                      setForm({
                        ...form,
                        returnPackAgreement: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <span className="text-sm text-foreground">
                    Return Pack Agreement (accepts empty pack returns)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={resetForm} type="button" variant="outline">
                Cancel
              </Button>
              <Button
                disabled={createMutation.isPending || updateMutation.isPending}
                type="submit"
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
