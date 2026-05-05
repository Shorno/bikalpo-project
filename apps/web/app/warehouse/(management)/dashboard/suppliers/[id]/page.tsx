"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Building2,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  TrendingUp,
  User,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

function formatMoney(value: number) {
  return `৳ ${value.toLocaleString("en-BD")}`;
}

const purchaseStatusCfg: Record<string, { label: string; icon: string; cls: string }> = {
  draft: { label: "Draft", icon: "📝", cls: "text-gray-600 bg-gray-50 border-gray-200" },
  received: { label: "Received", icon: "✅", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  partial: { label: "Partial", icon: "🚚", cls: "text-amber-700 bg-amber-50 border-amber-200" },
  cancelled: { label: "Cancelled", icon: "❌", cls: "text-red-700 bg-red-50 border-red-200" },
};

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const supplierId = Number(params.id);

  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["warehouse", "supplierDetail", supplierId],
    queryFn: () => orpc.warehouse.getSupplierDetail.call({ id: supplierId }),
    enabled: !!supplierId,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["warehouse", "supplierCategories"],
    queryFn: () => orpc.warehouse.getSupplierCategories.call({}),
  });

  const categories = categoriesData?.categories ?? [];

  // Edit form state
  const [form, setForm] = useState({
    name: "",
    company: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    creditLimit: "0",
    returnPackAgreement: false,
    categoryId: null as number | null,
  });

  const updateMutation = useMutation({
    mutationFn: (d: typeof form & { id: number }) =>
      orpc.warehouse.updateSupplier.call({
        ...d,
        categoryId: d.categoryId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "supplierDetail", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "supplierStats"] });
      setEditOpen(false);
      toast.success("Supplier updated");
    },
    onError: (e: any) => toast.error(e.message || "Update failed"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (newStatus: "active" | "suspended") =>
      orpc.warehouse.updateSupplier.call({
        id: supplierId,
        name: data!.supplier.name,
        status: newStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse", "supplierDetail", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "supplierStats"] });
      toast.success("Status updated");
    },
  });

  const openEditDialog = () => {
    if (!data) return;
    const s = data.supplier;
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
    setEditOpen(true);
  };

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/warehouse/dashboard/suppliers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              Supplier not found
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { supplier: sup, orderStats, totalPurchaseValue, productsSupplied, lastPurchases } = data;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Button asChild variant="ghost" size="sm">
        <Link href="/warehouse/dashboard/suppliers">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Suppliers
        </Link>
      </Button>

      {/* ── Identity Card ── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold">{sup.name}</h1>
                  {sup.categoryName && (
                    <Badge variant="outline" className="text-xs">
                      {sup.categoryName}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      sup.status === "active"
                        ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                        : "text-red-600 border-red-200 bg-red-50"
                    }`}
                  >
                    {sup.status === "active" ? "✅ Active" : "⚠ Suspended"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                  {sup.company && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {sup.company}
                    </span>
                  )}
                  {sup.contactPerson && (
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {sup.contactPerson}
                    </span>
                  )}
                  {sup.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {sup.phone}
                    </span>
                  )}
                  {sup.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {sup.email}
                    </span>
                  )}
                  {sup.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {sup.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Actions Bar ── */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link href="/warehouse/dashboard/purchases/new">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Purchase Order
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={openEditDialog}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit Supplier
        </Button>
        {sup.status === "active" ? (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => toggleStatusMutation.mutate("suspended")}
            disabled={toggleStatusMutation.isPending}
          >
            <Ban className="mr-1.5 h-3.5 w-3.5" />
            Deactivate
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            onClick={() => toggleStatusMutation.mutate("active")}
            disabled={toggleStatusMutation.isPending}
          >
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Activate
          </Button>
        )}
        {sup.phone && (
          <Button variant="outline" size="sm" asChild>
            <a href={`tel:${sup.phone}`}>
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              Contact
            </a>
          </Button>
        )}
      </div>

      {/* ── Performance Stats ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {([
              { label: "Total Orders", value: orderStats.total, color: "text-foreground" },
              { label: "Received", value: orderStats.received, color: "text-emerald-600" },
              { label: "Draft", value: orderStats.draft, color: "text-gray-600" },
              { label: "Partial", value: orderStats.partial, color: "text-amber-600" },
              { label: "Cancelled", value: orderStats.cancelled, color: "text-red-600" },
            ] as const).map((s) => (
              <div key={s.label} className="text-center p-3 rounded-lg bg-muted/30">
                <p className={`text-xl font-bold tabular-nums ${s.color}`}>
                  {s.value}
                </p>
                <p className="text-[10px] text-muted-foreground uppercase mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Total Purchase Value ── */}
      <Card>
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              Total Purchase Value
            </p>
            <p className="text-2xl font-bold tabular-nums">
              {formatMoney(totalPurchaseValue)}
            </p>
          </div>
          {parseFloat(sup.currentPayable) > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">Outstanding Payable</p>
              <p className="text-lg font-bold tabular-nums text-orange-600">
                {formatMoney(parseFloat(sup.currentPayable))}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Products Supplied ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Products Supplied
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productsSupplied.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No products purchased yet
              </p>
            ) : (
              <div className="space-y-1.5">
                {productsSupplied.map((name: string, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/20 text-sm"
                  >
                    <span className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                      •
                    </span>
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Last Orders ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Last Orders
              </CardTitle>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href="/warehouse/dashboard/purchases">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lastPurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No purchase orders yet
              </p>
            ) : (
              <div className="space-y-2.5">
                {lastPurchases.map((po: any) => {
                  const cfg = purchaseStatusCfg[po.status] || purchaseStatusCfg.draft;
                  const itemsList = po.items ?? [];
                  return (
                    <div
                      key={po.id}
                      className="p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-sm font-semibold">
                          {po.purchaseNumber}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${cfg.cls}`}
                        >
                          {cfg.icon} {cfg.label}
                        </Badge>
                      </div>
                      {itemsList.length > 0 ? (
                        <div className="space-y-0.5">
                          {itemsList.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{item.productName} × {parseFloat(item.quantity || "0")}</span>
                              <span className="tabular-nums font-medium">
                                {formatMoney(parseFloat(item.totalCost || "0"))}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No item details</p>
                      )}
                      <div className="flex items-center justify-end mt-1 pt-1 border-t border-dashed">
                        <span className="tabular-nums text-xs font-semibold">
                          Total: {formatMoney(parseFloat(po.total || "0"))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({ ...form, id: supplierId });
            }}
            className="space-y-4 mt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Supplier Name *</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
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
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Company</Label>
                <Input
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Contact Person</Label>
                <Input
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm({ ...form, contactPerson: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Credit Limit (৳)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.creditLimit}
                  onChange={(e) =>
                    setForm({ ...form, creditLimit: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Input
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
                  <span className="text-sm">
                    Return Pack Agreement
                  </span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Update Supplier
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
