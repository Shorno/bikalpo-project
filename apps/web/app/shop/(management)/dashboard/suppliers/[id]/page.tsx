"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarDays,
  CreditCard,
  Eye,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Receipt,
  ShieldCheck,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useDaybookBills } from "@/components/dashboard/daybook/use-daybook-bills";
import { useDaybookExpenses } from "@/components/dashboard/daybook/use-daybook-expenses";
import { useDaybookSupplierAdvances } from "@/components/dashboard/daybook/use-daybook-supplier-advances";
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

function formatMoney(value: number | string | null | undefined) {
  return `Tk ${Number(value || 0).toLocaleString("en-BD", {
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function parsePaymentMethod(description: string | null) {
  if (!description) return "Cash";
  const value = description.toLowerCase();
  if (value.includes("bank")) return "Bank";
  if (value.includes("mobile") || value.includes("bkash")) return "Mobile";
  return "Cash";
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function purchaseStatusBadge(status: string, paymentType: string) {
  if (paymentType === "cash") {
    return (
      <Badge
        className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
        variant="outline"
      >
        Paid
      </Badge>
    );
  }

  const map: Record<string, { className: string; label: string }> = {
    received: {
      label: "Credit",
      className: "border-orange-200 bg-orange-50 text-orange-700",
    },
    draft: {
      label: "Draft",
      className: "border-gray-200 bg-gray-50 text-gray-600",
    },
    partial: {
      label: "Partial",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    cancelled: {
      label: "Cancelled",
      className: "border-red-200 bg-red-50 text-red-700",
    },
  };
  const config = map[status] || map.draft;

  return (
    <Badge className={`text-[10px] ${config.className}`} variant="outline">
      {config.label}
    </Badge>
  );
}

export default function SupplierDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const supplierId = Number(params.id);
  const isValidSupplierId = Number.isFinite(supplierId) && supplierId > 0;

  const [editOpen, setEditOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [form, setForm] = useState<SupplierForm>({
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
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["shopOwner", "supplierDetail", supplierId],
    queryFn: () =>
      orpc.shopOwner.getExternalSupplierDetail.call({ id: supplierId }),
    enabled: isValidSupplierId,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["shopOwner", "supplierCategories"],
    queryFn: () => orpc.shopOwner.getSupplierCategories.call({}),
  });

  const categories = categoriesData?.categories ?? [];
  const daybookBills = useDaybookBills("retailer");
  const daybookExpenses = useDaybookExpenses("retailer");
  const daybookSupplierAdvances = useDaybookSupplierAdvances("retailer");
  const supplierNameKey = normalizeName(data?.supplier?.name ?? "");
  const supplierBills = useMemo(
    () =>
      supplierNameKey
        ? daybookBills.filter(
            (bill) =>
              bill.partyType === "supplier" &&
              normalizeName(bill.partyName) === supplierNameKey,
          )
        : [],
    [daybookBills, supplierNameKey],
  );
  const supplierExpenses = useMemo(
    () =>
      supplierNameKey
        ? daybookExpenses.filter(
            (expense) => normalizeName(expense.payee) === supplierNameKey,
          )
        : [],
    [daybookExpenses, supplierNameKey],
  );
  const localSupplierAdvances = useMemo(
    () =>
      supplierNameKey
        ? daybookSupplierAdvances.filter(
            (advance) => normalizeName(advance.supplier) === supplierNameKey,
          )
        : [],
    [daybookSupplierAdvances, supplierNameKey],
  );

  const invalidateDetail = () => {
    queryClient.invalidateQueries({
      queryKey: ["shopOwner", "supplierDetail", supplierId],
    });
    queryClient.invalidateQueries({ queryKey: ["shopOwner", "suppliers"] });
    queryClient.invalidateQueries({ queryKey: ["shopOwner", "supplierStats"] });
  };

  const updateMutation = useMutation({
    mutationFn: (input: SupplierForm & { id: number }) =>
      orpc.shopOwner.updateSupplier.call(input),
    onSuccess: () => {
      invalidateDetail();
      setEditOpen(false);
      toast.success("Supplier updated");
    },
    onError: (error: any) => toast.error(error.message || "Update failed"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (status: "active" | "suspended") =>
      orpc.shopOwner.updateSupplier.call({
        id: supplierId,
        name: data!.supplier.name,
        status,
      }),
    onSuccess: () => {
      invalidateDetail();
      toast.success("Status updated");
    },
    onError: (error: any) =>
      toast.error(error.message || "Failed to update status"),
  });

  const openEditDialog = () => {
    if (!data) return;
    const supplier = data.supplier;
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
    setEditOpen(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    updateMutation.mutate({ ...form, id: supplierId });
  };

  if (isLoading) return <DetailSkeleton />;

  if (isError || !data || !isValidSupplierId) {
    return (
      <div className="space-y-4">
        <Button asChild size="sm" variant="ghost">
          <Link href="/dashboard/suppliers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-3 h-12 w-12 text-red-300" />
            <p className="font-medium text-muted-foreground">
              Supplier not found
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const {
    supplier,
    billHistory = [],
    purchaseHistory,
    productBreakdown,
    payments,
    supplierAdvances = [],
    totalBillValue = 0,
    totalPurchaseValue,
    totalPaid,
    totalSupplierAdvance = 0,
    currentPayable,
  } = data;
  const localBillTotal = supplierBills.reduce(
    (sum, bill) => sum + bill.total,
    0,
  );
  const localBillDue = supplierBills.reduce(
    (sum, bill) => sum + bill.amountDue,
    0,
  );
  const localExpenseTotal = supplierExpenses.reduce(
    (sum, expense) => sum + expense.total,
    0,
  );
  const localAdvanceTotal = localSupplierAdvances.reduce(
    (sum, advance) => sum + advance.amount,
    0,
  );

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="ghost">
        <Link href="/dashboard/suppliers">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Suppliers
        </Link>
      </Button>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
                  {supplier.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="truncate text-xl font-bold tracking-tight">
                      {supplier.name}
                    </h1>
                    {supplier.status === "active" ? (
                      <Badge
                        className="border-emerald-200 bg-emerald-50 text-xs text-emerald-600"
                        variant="outline"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        className="border-red-200 bg-red-50 text-xs text-red-600"
                        variant="outline"
                      >
                        Suspended
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[supplier.company, supplier.categoryName]
                      .filter(Boolean)
                      .join(" - ") || "No category assigned"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/dashboard/stock/add">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Stock
                </Link>
              </Button>
              <Button onClick={openEditDialog} size="sm" variant="outline">
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
              {supplier.status === "active" ? (
                <Button
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  disabled={toggleStatusMutation.isPending}
                  onClick={() => toggleStatusMutation.mutate("suspended")}
                  size="sm"
                  variant="outline"
                >
                  <Ban className="mr-1.5 h-3.5 w-3.5" />
                  Deactivate
                </Button>
              ) : (
                <Button
                  className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                  disabled={toggleStatusMutation.isPending}
                  onClick={() => toggleStatusMutation.mutate("active")}
                  size="sm"
                  variant="outline"
                >
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                  Activate
                </Button>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {supplier.phone && (
                <DetailField
                  icon={<Phone className="h-3.5 w-3.5" />}
                  label="Phone"
                  value={supplier.phone}
                />
              )}
              {supplier.email && (
                <DetailField
                  icon={<Mail className="h-3.5 w-3.5" />}
                  label="Email"
                  value={supplier.email}
                />
              )}
              {supplier.contactPerson && (
                <DetailField
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Contact Person"
                  value={supplier.contactPerson}
                />
              )}
              {supplier.address && (
                <DetailField
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Address"
                  value={supplier.address}
                />
              )}
              <DetailField
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Joined"
                value={formatDate(supplier.createdAt)}
              />
              <DetailField
                icon={<CreditCard className="h-3.5 w-3.5" />}
                label="Credit Limit"
                value={formatMoney(supplier.creditLimit)}
              />
              <DetailField
                highlight={currentPayable > 0}
                icon={<Wallet className="h-3.5 w-3.5" />}
                label="Current Payable"
                value={formatMoney(currentPayable)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
          label="Total Bill"
          value={formatMoney(Math.max(Number(totalBillValue), localBillTotal))}
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5 text-emerald-600" />}
          label="Expense Paid"
          value={formatMoney(Math.max(Number(totalPaid), localExpenseTotal))}
        />
        <SummaryCard
          icon={<CreditCard className="h-5 w-5 text-orange-500" />}
          label="Payable"
          value={formatMoney(Math.max(Number(currentPayable), localBillDue))}
        />
        <SummaryCard
          icon={<Receipt className="h-5 w-5 text-indigo-600" />}
          label="Purchases"
          value={formatMoney(totalPurchaseValue)}
        />
        <SummaryCard
          icon={<ShieldCheck className="h-5 w-5 text-cyan-600" />}
          label="Supplier Advance"
          value={formatMoney(
            Math.max(Number(totalSupplierAdvance), localAdvanceTotal),
          )}
        />
      </div>

      {currentPayable > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-orange-700">
              <AlertTriangle className="h-4 w-4" />
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            Bill History
            {(supplierBills.length > 0 || billHistory.length > 0) && (
              <Badge className="ml-1 text-[10px]" variant="secondary">
                {supplierBills.length + billHistory.length} bills
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supplierBills.length === 0 && billHistory.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No supplier bills yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-mono text-sm">
                      {bill.billNo}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(bill.paymentDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(bill.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {formatMoney(bill.totalPaid)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-orange-600">
                      {formatMoney(bill.amountDue)}
                    </TableCell>
                  </TableRow>
                ))}
                {billHistory.map((bill: any) => (
                  <TableRow key={`server-${bill.id}`}>
                    <TableCell className="font-mono text-sm">
                      {bill.description || "Supplier bill"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(bill.createdAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(bill.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      -
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      -
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            Expense History
            {supplierExpenses.length > 0 && (
              <Badge className="ml-1 text-[10px]" variant="secondary">
                {supplierExpenses.length} expenses
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {supplierExpenses.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No daybook expenses paid to this supplier yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-sm">
                      {formatDate(expense.paymentDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {expense.paymentAccountName}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-emerald-600">
                      {formatMoney(expense.total)}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                      {expense.referenceNo || expense.memo || "No reference"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            Supplier Advance
            {(localSupplierAdvances.length > 0 ||
              supplierAdvances.length > 0) && (
              <Badge className="ml-1 text-[10px]" variant="secondary">
                {localSupplierAdvances.length + supplierAdvances.length}{" "}
                advances
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {localSupplierAdvances.length === 0 &&
          supplierAdvances.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No supplier advance payments yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advance No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localSupplierAdvances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell className="font-mono text-sm">
                      {advance.advanceNo || "Advance"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(advance.paymentDate)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {advance.paymentAccountName}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(advance.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                {supplierAdvances.map((advance: any) => (
                  <TableRow key={`server-advance-${advance.id}`}>
                    <TableCell className="font-mono text-sm">
                      {advance.description || "Supplier advance"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(advance.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Server ledger
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(advance.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            Purchase History
            {purchaseHistory.length > 0 && (
              <Badge className="ml-1 text-[10px]" variant="secondary">
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
                {purchaseHistory.map((purchase: any) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {purchase.purchaseNumber}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(purchase.purchaseDate || purchase.createdAt)}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {purchase.itemCount}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(purchase.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {formatMoney(purchase.paid)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        purchase.due > 0
                          ? "font-medium text-orange-600"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatMoney(purchase.due)}
                    </TableCell>
                    <TableCell>
                      {purchaseStatusBadge(
                        purchase.status,
                        purchase.paymentType,
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        className="h-7 text-xs"
                        onClick={() => setSelectedPurchase(purchase)}
                        size="sm"
                        variant="ghost"
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

      <Dialog
        onOpenChange={(open) => !open && setSelectedPurchase(null)}
        open={!!selectedPurchase}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {selectedPurchase?.purchaseNumber}
            </DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="mt-1 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="mb-0.5 text-[11px] text-muted-foreground">
                    Date
                  </p>
                  <p className="text-sm font-semibold">
                    {formatDate(
                      selectedPurchase.purchaseDate ||
                        selectedPurchase.createdAt,
                    )}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="mb-0.5 text-[11px] text-muted-foreground">
                    Payment
                  </p>
                  <p className="text-sm font-semibold capitalize">
                    {selectedPurchase.paymentType}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="mb-0.5 text-[11px] text-muted-foreground">
                    Total
                  </p>
                  <p className="text-sm font-bold text-blue-600">
                    {formatMoney(selectedPurchase.total)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Items ({selectedPurchase.items?.length || 0})
                </p>
                {selectedPurchase.items?.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-right text-xs">
                          Qty
                        </TableHead>
                        <TableHead className="text-right text-xs">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPurchase.items.map(
                        (item: any, index: number) => (
                          <TableRow key={`${item.productName}-${index}`}>
                            <TableCell className="text-sm">
                              {item.productName}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {Number(item.quantity || 0).toLocaleString(
                                "en-BD",
                                { maximumFractionDigits: 2 },
                              )}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium tabular-nums">
                              {formatMoney(item.totalCost)}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-4 text-center text-sm italic text-muted-foreground">
                    No item details available
                  </p>
                )}
              </div>

              <div className="space-y-1.5 border-t pt-3">
                {Number(selectedPurchase.discount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="tabular-nums">
                      - {formatMoney(selectedPurchase.discount)}
                    </span>
                  </div>
                )}
                {Number(selectedPurchase.transportCost || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Transport / Tax
                    </span>
                    <span className="tabular-nums">
                      + {formatMoney(selectedPurchase.transportCost)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 text-sm font-bold">
                  <span>Grand Total</span>
                  <span className="tabular-nums">
                    {formatMoney(selectedPurchase.total)}
                  </span>
                </div>
              </div>

              {selectedPurchase.note && (
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Note
                  </p>
                  <p className="whitespace-pre-line text-sm">
                    {selectedPurchase.note}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            Product Supply Breakdown
            {productBreakdown.length > 0 && (
              <Badge className="ml-1 text-[10px]" variant="secondary">
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
                {productBreakdown.map((product: any) => (
                  <TableRow key={product.productName}>
                    <TableCell className="text-sm font-medium">
                      {product.productName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.totalQty.toLocaleString("en-BD", {
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatMoney(product.totalValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            Payment History
            {payments.length > 0 && (
              <Badge className="ml-1 text-[10px]" variant="secondary">
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
                {payments.map((payment: any) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">
                      {formatDate(payment.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className="text-[10px]" variant="outline">
                        {parsePaymentMethod(payment.description)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-emerald-600">
                      {formatMoney(payment.amount)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {payment.description || "No reference"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog onOpenChange={setEditOpen} open={editOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Supplier Name *</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
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
                  value={form.phone}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, company: event.target.value })
                  }
                  value={form.company}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact Person</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, contactPerson: event.target.value })
                  }
                  value={form.contactPerson}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
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
                  value={form.address}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Notes</Label>
                <Input
                  onChange={(event) =>
                    setForm({ ...form, notes: event.target.value })
                  }
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
                  <span className="text-sm">Return Pack Agreement</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={() => setEditOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={updateMutation.isPending} type="submit">
                Update Supplier
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
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
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="mb-1 text-[11px] leading-none text-muted-foreground">
          {label}
        </p>
        <p
          className={`truncate text-sm font-medium ${
            highlight ? "text-orange-600" : ""
          }`}
        >
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
            {Array.from({ length: 8 }).map((_, index) => (
              <div className="space-y-1" key={index}>
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
