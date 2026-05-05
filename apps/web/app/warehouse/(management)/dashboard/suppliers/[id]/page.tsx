"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Building2,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Eye,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Receipt,
  ShieldCheck,
  Tag,
  TrendingUp,
  User,
  Users,
  Wallet,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

function formatMoney(value: number) {
  return `৳ ${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function parsePaymentMethod(desc: string | null) {
  if (!desc) return "Cash";
  if (desc.toLowerCase().includes("bank")) return "Bank";
  if (desc.toLowerCase().includes("bkash") || desc.toLowerCase().includes("mobile"))
    return "bKash";
  return "Cash";
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const supplierId = Number(params.id);

  const [editOpen, setEditOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);

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
      orpc.warehouse.updateSupplier.call({ ...d, categoryId: d.categoryId }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "supplierDetail", supplierId],
      });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
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
      queryClient.invalidateQueries({
        queryKey: ["warehouse", "supplierDetail", supplierId],
      });
      queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
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

  const {
    supplier: sup,
    purchaseHistory,
    productBreakdown,
    payments,
    totalPurchaseValue,
    totalPaid,
    currentPayable,
  } = data;

  const statusBadge =
    sup.status === "active" ? (
      <Badge
        variant="outline"
        className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50"
      >
        ✅ Active
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="text-xs text-red-600 border-red-200 bg-red-50"
      >
        ⚠ Suspended
      </Badge>
    );

  const purchaseStatusBadge = (status: string, paymentType: string) => {
    if (paymentType === "cash") {
      return (
        <Badge
          variant="outline"
          className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200"
        >
          Paid
        </Badge>
      );
    }
    const map: Record<string, { cls: string; label: string }> = {
      received: {
        label: "Credit",
        cls: "text-orange-700 bg-orange-50 border-orange-200",
      },
      draft: {
        label: "Draft",
        cls: "text-gray-600 bg-gray-50 border-gray-200",
      },
      partial: {
        label: "Partial",
        cls: "text-amber-700 bg-amber-50 border-amber-200",
      },
      cancelled: {
        label: "Cancelled",
        cls: "text-red-700 bg-red-50 border-red-200",
      },
    };
    const cfg = map[status] || map.draft;
    return (
      <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>
        {cfg.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Back Nav ── */}
      <Button asChild variant="ghost" size="sm">
        <Link href="/warehouse/dashboard/suppliers">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Suppliers
        </Link>
      </Button>

      {/* ═══════════════════ SUPPLIER HEADER ═══════════════════ */}
      <Card>
        <CardContent className="pt-6">
          {/* Top row: Name + Status + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {sup.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-bold tracking-tight truncate">
                      {sup.name}
                    </h1>
                    {statusBadge}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {[sup.company, sup.categoryName ? `Category: ${sup.categoryName}` : null]
                      .filter(Boolean)
                      .join(" · ") || "No category assigned"}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button size="sm" asChild>
                <Link href="/warehouse/dashboard/quick-purchase">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Purchase
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
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
            </div>
          </div>

          {/* Detail fields */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sup.phone && (
                <DetailField icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={sup.phone} />
              )}
              {sup.email && (
                <DetailField icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={sup.email} />
              )}
              {sup.contactPerson && (
                <DetailField icon={<User className="w-3.5 h-3.5" />} label="Contact Person" value={sup.contactPerson} />
              )}
              {sup.address && (
                <DetailField icon={<MapPin className="w-3.5 h-3.5" />} label="Address" value={sup.address} />
              )}
              <DetailField
                icon={<CalendarDays className="w-3.5 h-3.5" />}
                label="Joined"
                value={formatDate(sup.createdAt)}
              />
              <DetailField
                icon={<CreditCard className="w-3.5 h-3.5" />}
                label="Credit Limit"
                value={formatMoney(parseFloat(sup.creditLimit || "0"))}
              />
              <DetailField
                icon={<Wallet className="w-3.5 h-3.5" />}
                label="Current Payable"
                value={formatMoney(currentPayable)}
                highlight={currentPayable > 0}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════ DUE ALERT ═══════════════════ */}
      {currentPayable > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-4 h-4" />
              Due Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs text-orange-600/80">Total Due</p>
                <p className="text-xl font-bold tabular-nums text-orange-700">
                  {formatMoney(currentPayable)}
                </p>
              </div>
              <div>
                <p className="text-xs text-orange-600/80">Total Purchase</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatMoney(totalPurchaseValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-orange-600/80">Total Paid</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-700">
                  {formatMoney(totalPaid)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════════════════ PURCHASE HISTORY ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            📋 Purchase History
            {purchaseHistory.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-1">
                {purchaseHistory.length} orders
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {purchaseHistory.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No purchase history yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseHistory.map((po: any) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {po.purchaseNumber}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(po.purchaseDate || po.createdAt)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {po.itemCount}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(po.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {formatMoney(po.paid)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${po.due > 0 ? "text-orange-600 font-medium" : "text-muted-foreground"}`}
                    >
                      {formatMoney(po.due)}
                    </TableCell>
                    <TableCell>
                      {purchaseStatusBadge(po.status, po.paymentType)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedPurchase(po)}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Purchase Detail Dialog ── */}
      <Dialog
        open={!!selectedPurchase}
        onOpenChange={(open) => !open && setSelectedPurchase(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {selectedPurchase?.purchaseNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4 mt-1">
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Date</p>
                  <p className="text-sm font-semibold">
                    {formatDate(selectedPurchase.purchaseDate || selectedPurchase.createdAt)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Payment</p>
                  <p className="text-sm font-semibold capitalize">
                    {selectedPurchase.paymentType}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-[11px] text-muted-foreground mb-0.5">Total</p>
                  <p className="text-sm font-bold text-blue-600">
                    {formatMoney(selectedPurchase.total)}
                  </p>
                </div>
              </div>

              {/* Items table */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Items ({selectedPurchase.items?.length || 0})
                </p>
                {selectedPurchase.items?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-xs text-right">Qty</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPurchase.items.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{item.productName}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">
                            {parseFloat(item.quantity || "0").toLocaleString("en-BD", { maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-sm text-right font-medium tabular-nums">
                            {formatMoney(parseFloat(item.totalCost || "0"))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">
                    No item details available
                  </p>
                )}
              </div>

              {/* Cost breakdown */}
              <div className="border-t pt-3 space-y-1.5">
                {parseFloat(selectedPurchase.discount || "0") > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="tabular-nums">
                      - {formatMoney(parseFloat(selectedPurchase.discount))}
                    </span>
                  </div>
                )}
                {parseFloat(selectedPurchase.transportCost || "0") > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transport / Tax</span>
                    <span className="tabular-nums">
                      + {formatMoney(parseFloat(selectedPurchase.transportCost))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{formatMoney(selectedPurchase.total)}</span>
                </div>
              </div>

              {/* Note */}
              {selectedPurchase.note && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wide font-semibold">Note</p>
                  <p className="text-sm whitespace-pre-line">{selectedPurchase.note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════ PRODUCT SUPPLY BREAKDOWN ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            📊 Product Supply Breakdown
            {productBreakdown.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-1">
                {productBreakdown.length} products
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {productBreakdown.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No products purchased yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead className="text-right">Total Qty</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productBreakdown.map((p: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">
                      {p.productName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.totalQty.toLocaleString("en-BD", {
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(p.totalValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ PAYMENT HISTORY ═══════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            💰 Payment History
            {payments.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-1">
                {payments.length} payments
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No payment history yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((pay: any) => (
                  <TableRow key={pay.id}>
                    <TableCell className="text-sm">
                      {formatDate(pay.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {parsePaymentMethod(pay.description)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-emerald-600">
                      {formatMoney(parseFloat(pay.amount || "0"))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {pay.description || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════ EDIT DIALOG ═══════════════════ */}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label>Supplier Name *</Label>
                <Input
                  required
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
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input
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
                  value={form.creditLimit}
                  onChange={(e) =>
                    setForm({ ...form, creditLimit: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
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
                  <span className="text-sm">Return Pack Agreement</span>
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

function DetailField({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground leading-none mb-1">{label}</p>
        <p className={`text-sm font-medium truncate ${highlight ? "text-orange-600" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-40" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
