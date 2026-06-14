"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  Loader2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Share2,
  ShieldCheck,
  PackageCheck,
  User,
  Wallet,
  Warehouse,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  useCancelWarehouseSupplierRequest,
  useDisconnectWarehouseSupplier,
  useMyWarehouseSuppliers,
} from "@/hooks/use-warehouse-supplier-connections";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { CollectSupplierDueDialog } from "../_components/collect-supplier-due-dialog";
import {
  buildPurchaseInvoiceHtml,
  buildPurchaseReceiptHtml,
  printHtmlContent,
  sharePurchaseDocument,
  type PurchasePrintData,
} from "../_components/purchase-print";
import { SupplierPaymentReceiptDialog } from "../_components/supplier-payment-receipt-dialog";
import { parseSupplierRouteId } from "../_lib/supplier-routes";

function formatMoney(value: number) {
  return `৳${value.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
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
  if (
    desc.toLowerCase().includes("bkash") ||
    desc.toLowerCase().includes("mobile")
  ) {
    return "bKash";
  }
  return "Cash";
}

function getPurchasePaymentStatus(paid: number, due: number) {
  return due > 0.001 ? "Partial" : "Paid";
}

type PurchaseHistoryRow = {
  id: number;
  purchaseNumber: string;
  purchaseDate: string | null;
  itemCount: number;
  total: number;
  paid: number;
  due: number;
  status: string;
  paymentType: string;
  discount?: string | null;
  transportCost?: string | null;
  note?: string | null;
  createdAt: string | Date;
  items?: { productName: string; quantity: string; totalCost: string }[];
};

function PurchasePaymentStatusPill({ paid, due }: { paid: number; due: number }) {
  const status = getPurchasePaymentStatus(paid, due);
  const isPaid = status === "Paid";
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        isPaid
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-amber-200 bg-amber-50 text-amber-700"
      }`}
    >
      {status}
    </span>
  );
}

function PurchaseDetailDialog({
  purchase,
  supplierId,
  supplierName,
  supplierPayable,
  warehouseLabel,
  onClose,
  onRefresh,
}: {
  purchase: PurchaseHistoryRow | null;
  supplierId: number;
  supplierName: string;
  supplierPayable: number;
  warehouseLabel: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const [isSharing, setIsSharing] = useState(false);
  const [collectDueOpen, setCollectDueOpen] = useState(false);
  const [paymentReceiptOpen, setPaymentReceiptOpen] = useState(false);
  const [lastPayment, setLastPayment] = useState<{
    amount: number;
    paymentMethod: string;
    referenceNo?: string;
  } | null>(null);
  const [paidAfterPayment, setPaidAfterPayment] = useState(0);
  const [dueAfterPayment, setDueAfterPayment] = useState(0);

  const payMutation = useMutation({
    mutationFn: (input: {
      amount: string;
      paymentMethod: "cash" | "bank" | "mobile_banking";
      referenceNo?: string;
      note?: string;
    }) =>
      orpc.supplierPayment.paySupplier.call({
        supplierId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        referenceNo: input.referenceNo,
        note: input.note,
        ownerType: "warehouse",
      }),
    onSuccess: (result, variables) => {
      const paidAmount = parseFloat(variables.amount);
      toast.success(result.message);
      setCollectDueOpen(false);
      setLastPayment({
        amount: paidAmount,
        paymentMethod: variables.paymentMethod,
        referenceNo: variables.referenceNo,
      });
      if (purchase) {
        setPaidAfterPayment(purchase.paid + paidAmount);
        setDueAfterPayment(Math.max(0, purchase.due - paidAmount));
      }
      setPaymentReceiptOpen(true);
      onRefresh();
      queryClient.invalidateQueries({
        queryKey: ["supplierPayment", "getPayableSummary"],
      });
    },
    onError: (e: Error) => toast.error(e.message || "Payment failed"),
  });

  const receiveMutation = useMutation({
    mutationFn: (purchaseId: number) =>
      orpc.warehouse.receivePurchase.call({ purchaseId }),
    onSuccess: () => {
      toast.success("Purchase received and stock updated");
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to receive purchase"),
  });

  const cancelMutation = useMutation({
    mutationFn: (purchaseId: number) =>
      orpc.warehouse.cancelPurchase.call({ purchaseId }),
    onSuccess: () => {
      toast.success("Purchase cancelled");
      onClose();
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to cancel purchase"),
  });

  const printData: PurchasePrintData | null = purchase
    ? {
        purchaseNumber: purchase.purchaseNumber,
        purchaseDate: purchase.purchaseDate,
        createdAt: purchase.createdAt,
        supplierName,
        warehouseLabel,
        items: purchase.items ?? [],
        total: purchase.total,
        paid: purchase.paid,
        due: purchase.due,
        discount: purchase.discount,
        transportCost: purchase.transportCost,
        note: purchase.note,
        paymentType: purchase.paymentType,
      }
    : null;

  const handlePrintInvoice = () => {
    if (!printData) return;
    printHtmlContent(buildPurchaseInvoiceHtml(printData));
  };

  const handlePrintReceipt = () => {
    if (!printData) return;
    printHtmlContent(buildPurchaseReceiptHtml(printData));
  };

  const handleShare = async () => {
    if (!printData) return;
    setIsSharing(true);
    try {
      const html = buildPurchaseInvoiceHtml(printData);
      await sharePurchaseDocument(
        html,
        `Purchase-${printData.purchaseNumber}.png`,
        `Purchase Invoice - ${printData.purchaseNumber}`,
        `Invoice ${printData.purchaseNumber} from ${printData.supplierName}. Total: ৳${printData.total.toLocaleString("en-BD")}.`,
      );
    } catch (error: unknown) {
      if ((error as { name?: string })?.name === "AbortError") return;
      console.error("Share failed:", error);
      toast.error("Failed to share invoice");
    } finally {
      setIsSharing(false);
    }
  };

  const collectibleDue = purchase
    ? Math.min(purchase.due, supplierPayable)
    : 0;
  const isDraft = purchase?.status === "draft";
  const canCollectDue = collectibleDue > 0.001;

  return (
    <>
    <Sheet open={!!purchase} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 shrink-0" />
            {purchase?.purchaseNumber}
          </SheetTitle>
        </SheetHeader>

        {purchase && (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Date</p>
                  <p className="text-xs font-semibold sm:text-sm">
                    {formatDate(purchase.purchaseDate || purchase.createdAt)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Status</p>
                  <div className="flex justify-center">
                    <PurchasePaymentStatusPill paid={purchase.paid} due={purchase.due} />
                  </div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Paid</p>
                  <p className="text-xs font-semibold tabular-nums text-emerald-600 sm:text-sm">
                    {formatMoney(purchase.paid)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="mb-0.5 text-[10px] text-muted-foreground">Due</p>
                  <p
                    className={`text-xs font-semibold tabular-nums sm:text-sm ${
                      purchase.due > 0 ? "text-orange-600" : "text-muted-foreground"
                    }`}
                  >
                    {formatMoney(purchase.due)}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Items ({purchase.items?.length ?? purchase.itemCount})
                </p>
                {purchase.items && purchase.items.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-right text-xs">Qty</TableHead>
                          <TableHead className="text-right text-xs">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchase.items.map((item, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{item.productName}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">
                              {parseFloat(item.quantity || "0").toLocaleString("en-BD", {
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium tabular-nums">
                              {formatMoney(parseFloat(item.totalCost || "0"))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm italic text-muted-foreground">
                    No item details available
                  </p>
                )}
              </div>

              <div className="space-y-1.5 border-t border-border pt-3">
                {parseFloat(purchase.discount || "0") > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="tabular-nums">
                      - {formatMoney(parseFloat(purchase.discount || "0"))}
                    </span>
                  </div>
                )}
                {parseFloat(purchase.transportCost || "0") > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transport / Tax</span>
                    <span className="tabular-nums">
                      + {formatMoney(parseFloat(purchase.transportCost || "0"))}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-sm font-bold">
                  <span>Grand Total</span>
                  <span className="tabular-nums">{formatMoney(purchase.total)}</span>
                </div>
              </div>

              {purchase.note ? (
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Note
                  </p>
                  <p className="whitespace-pre-line text-sm">{purchase.note}</p>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 border-t border-border bg-background px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
                <PurchaseActionButton
                  icon={Printer}
                  label="Print Invoice"
                  onClick={handlePrintInvoice}
                  className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                />
                <PurchaseActionButton
                  icon={Receipt}
                  label="Print Receipt"
                  onClick={handlePrintReceipt}
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                />
                <PurchaseActionButton
                  icon={Share2}
                  label={isSharing ? "Sharing..." : "Share"}
                  onClick={handleShare}
                  disabled={isSharing}
                  className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                />
                <PurchaseActionButton
                  icon={Banknote}
                  label="Pay"
                  onClick={() => setCollectDueOpen(true)}
                  disabled={!canCollectDue}
                  className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                />
                {isDraft && (
                  <>
                    <PurchaseActionButton
                      icon={PackageCheck}
                      label={receiveMutation.isPending ? "Receiving..." : "Receive Stock"}
                      onClick={() => {
                        if (confirm("Receive this purchase into stock?")) {
                          receiveMutation.mutate(purchase.id);
                        }
                      }}
                      disabled={receiveMutation.isPending}
                      className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    />
                    <PurchaseActionButton
                      icon={RotateCcw}
                      label={cancelMutation.isPending ? "Cancelling..." : "Cancel"}
                      onClick={() => {
                        if (confirm("Cancel this draft purchase?")) {
                          cancelMutation.mutate(purchase.id);
                        }
                      }}
                      disabled={cancelMutation.isPending}
                      className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    />
                  </>
                )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>

    {purchase && (
      <>
        <CollectSupplierDueDialog
          open={collectDueOpen}
          onOpenChange={setCollectDueOpen}
          dueAmount={purchase.due}
          maxAmount={supplierPayable}
          invoiceNumber={purchase.purchaseNumber}
          supplierName={supplierName}
          onCollect={(data) => payMutation.mutate(data)}
          isPending={payMutation.isPending}
        />
        <SupplierPaymentReceiptDialog
          open={paymentReceiptOpen}
          onOpenChange={setPaymentReceiptOpen}
          warehouseLabel={warehouseLabel}
          supplierName={supplierName}
          purchaseNumber={purchase.purchaseNumber}
          payment={lastPayment}
          invoiceTotal={purchase.total}
          totalPaidAfter={paidAfterPayment}
          remainingDue={dueAfterPayment}
        />
      </>
    )}
    </>
  );
}

function PurchaseActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  className?: string;
}) {
  const classes = `inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none ${className ?? ""}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      className={classes}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function getPublicStorefrontBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    return window.location.origin.replace("//warehouse.", "//");
  }
  return "http://bikalpo.localhost:3001";
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
    <div className="rounded-lg border border-border bg-card p-2 sm:rounded-xl sm:p-3">
      <div className="mb-0.5 flex items-center gap-2 sm:mb-1 sm:justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted sm:h-6 sm:w-6">
          <Icon className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
      <span className="block text-sm font-bold font-mono tabular-nums sm:text-lg">
        {value}
      </span>
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
      <span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="mb-1 text-[11px] leading-none text-muted-foreground">
          {label}
        </p>
        <p
          className={`truncate text-sm font-medium ${highlight ? "text-orange-600" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function DetailShell({
  name,
  subtitle,
  typeLabel,
  statusBadge,
  actions,
  children,
}: {
  name: string;
  subtitle?: string;
  typeLabel: string;
  statusBadge: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-3 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[36rem] lg:overflow-hidden">
      <div className="shrink-0 border-b border-border pb-3 sm:pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 h-8 px-2">
              <Link href="/warehouse/dashboard/suppliers">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Suppliers
              </Link>
            </Button>
            <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/warehouse/dashboard" className="hover:text-foreground">
                Warehouse
              </Link>
              <span>/</span>
              <Link
                href="/warehouse/dashboard/suppliers"
                className="hover:text-foreground"
              >
                Suppliers
              </Link>
              <span>/</span>
              <span className="truncate font-medium text-foreground">{name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                {name}
              </h1>
              <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {typeLabel}
              </span>
              {statusBadge}
            </div>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:gap-4">
        {children}
      </div>
    </div>
  );
}

export default function SupplierDetailPage() {
  const params = useParams();
  const rawId = String(params.id ?? "");
  const parsed = parseSupplierRouteId(rawId);

  if (!parsed) {
    return (
      <div className="w-full py-16 text-center">
        <AlertCircle className="mx-auto mb-3 size-10 text-red-300" />
        <p className="font-medium text-red-600">Invalid supplier link</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/warehouse/dashboard/suppliers">Back to Suppliers</Link>
        </Button>
      </div>
    );
  }

  if (parsed.kind === "warehouse") {
    return <WarehouseSupplierDetail connectionId={parsed.connectionId} />;
  }

  return <ExternalSupplierDetail supplierId={parsed.supplierId} />;
}

function ExternalSupplierDetail({ supplierId }: { supplierId: number }) {
  const queryClient = useQueryClient();
  const { data: sessionData } = authClient.useSession();
  const warehouseLabel =
    (sessionData?.user as { warehouseName?: string })?.warehouseName ||
    "Warehouse";
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseHistoryRow | null>(null);

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
    onError: (e: Error) => toast.error(e.message || "Update failed"),
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
      <div className="w-full py-16 text-center">
        <AlertCircle className="mx-auto mb-3 size-12 text-red-300" />
        <p className="font-medium text-muted-foreground">Supplier not found</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/warehouse/dashboard/suppliers">Back to Suppliers</Link>
        </Button>
      </div>
    );
  }

  const {
    supplier: sup,
    purchaseHistory,
    payments,
    totalPurchaseValue,
    totalPaid,
    currentPayable,
  } = data;

  const statusBadge =
    sup.status === "active" ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <XCircle className="h-3 w-3" />
        Inactive
      </span>
    );

  return (
    <DetailShell
      name={sup.name}
      subtitle={
        [sup.company, sup.categoryName ? `Category: ${sup.categoryName}` : null]
          .filter(Boolean)
          .join(" · ") || undefined
      }
      typeLabel="External"
      statusBadge={statusBadge}
      actions={
        <>
          <Button size="sm" asChild className="h-9">
            <Link href={`/warehouse/dashboard/quick-purchase?supplierId=${supplierId}`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Purchase
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={openEditDialog}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          {sup.status === "active" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-red-600 hover:bg-red-50"
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
              className="h-9 text-emerald-600 hover:bg-emerald-50"
              onClick={() => toggleStatusMutation.mutate("active")}
              disabled={toggleStatusMutation.isPending}
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Activate
            </Button>
          )}
        </>
      }
    >
      {/* Top band: KPIs + contact + payment history — fits without scroll */}
      <div className="grid shrink-0 gap-3 lg:grid-cols-3 lg:gap-4">
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard
              title="Total Purchase"
              value={formatMoney(totalPurchaseValue)}
              icon={DollarSign}
            />
            <MetricCard
              title="Total Paid"
              value={formatMoney(totalPaid)}
              icon={Wallet}
            />
            <MetricCard
              title="Payable"
              value={formatMoney(currentPayable)}
              icon={CreditCard}
            />
            <MetricCard
              title="Orders"
              value={purchaseHistory.length}
              icon={Receipt}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {sup.phone && (
                <DetailField icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={sup.phone} />
              )}
              {sup.email && (
                <DetailField icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={sup.email} />
              )}
              {sup.contactPerson && (
                <DetailField icon={<User className="h-3.5 w-3.5" />} label="Contact" value={sup.contactPerson} />
              )}
              {sup.address && (
                <DetailField icon={<MapPin className="h-3.5 w-3.5" />} label="Address" value={sup.address} />
              )}
              <DetailField
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Joined"
                value={formatDate(sup.createdAt)}
              />
            </div>
            {currentPayable > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50/60 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-orange-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Outstanding Payable
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-orange-700">
                  {formatMoney(currentPayable)}
                </span>
              </div>
            )}
          </div>
        </div>

        <SidePanel title="Payment History" count={payments.length} emptyMessage="No payments yet">
          {payments.map((pay) => (
            <div
              key={pay.id}
              className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2 last:border-0"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium">{formatDate(pay.createdAt)}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {parsePaymentMethod(pay.description)}
                  {pay.description ? ` · ${pay.description}` : ""}
                </p>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-emerald-600">
                {formatMoney(parseFloat(pay.amount || "0"))}
              </span>
            </div>
          ))}
        </SidePanel>
      </div>

      {/* Purchase history — only section that scrolls */}
      <ScrollableHistoryTable
        title="Purchase History"
        count={purchaseHistory.length}
        emptyMessage="No purchase history yet"
        headers={["Invoice", "Date", "Items", "Amount", "Paid", "Due", "Status", ""]}
        rows={purchaseHistory.map((po) => (
          <TableRow key={po.id} className="border-b border-border hover:bg-muted/30">
            <TableCell className="font-mono text-xs font-medium sm:text-sm">
              {po.purchaseNumber}
            </TableCell>
            <TableCell className="text-xs sm:text-sm">
              {formatDate(po.purchaseDate || po.createdAt)}
            </TableCell>
            <TableCell className="text-center text-xs tabular-nums">{po.itemCount}</TableCell>
            <TableCell className="text-right text-xs font-medium tabular-nums sm:text-sm">
              {formatMoney(po.total)}
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-emerald-600">
              {formatMoney(po.paid)}
            </TableCell>
            <TableCell
              className={`text-right text-xs tabular-nums ${po.due > 0 ? "font-medium text-orange-600" : "text-muted-foreground"}`}
            >
              {formatMoney(po.due)}
            </TableCell>
            <TableCell>
              <PurchasePaymentStatusPill paid={po.paid} due={po.due} />
            </TableCell>
            <TableCell className="text-right">
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
      />

      <PurchaseDetailDialog
        purchase={selectedPurchase}
        supplierId={supplierId}
        supplierName={sup.name}
        supplierPayable={currentPayable}
        warehouseLabel={warehouseLabel}
        onClose={() => setSelectedPurchase(null)}
        onRefresh={() => {
          queryClient.invalidateQueries({
            queryKey: ["warehouse", "supplierDetail", supplierId],
          });
          queryClient.invalidateQueries({ queryKey: ["warehouse", "suppliers"] });
          queryClient.invalidateQueries({
            queryKey: ["warehouse", "supplierStats"],
          });
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({ ...form, id: supplierId });
            }}
            className="mt-2 space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name *</Label>
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
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((c: { id: number; name: string }) => (
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
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DetailShell>
  );
}

function WarehouseSupplierDetail({ connectionId }: { connectionId: number }) {
  const cancelMutation = useCancelWarehouseSupplierRequest();
  const disconnectMutation = useDisconnectWarehouseSupplier();

  const { data, isLoading, isError } = useMyWarehouseSuppliers({
    status: "all",
    limit: 100,
  });

  const connection = useMemo(
    () => data?.items?.find((item) => item.connectionId === connectionId),
    [data?.items, connectionId],
  );

  const ordersQuery = useQuery({
    queryKey: ["warehouse", "getMyOrders", connection?.warehouseId],
    queryFn: () =>
      orpc.warehouse.getMyOrders.call({
        supplierWarehouseId: connection!.warehouseId,
        timeframe: "all",
        page: 1,
        limit: 100,
      }),
    enabled: !!connection?.warehouseId,
  });

  const orders = ordersQuery.data?.orders ?? [];
  const totalPurchase = orders.reduce(
    (sum, o) => sum + parseFloat(o.total || "0"),
    0,
  );

  if (isLoading) return <DetailSkeleton />;

  if (isError || !connection) {
    return (
      <div className="w-full py-16 text-center">
        <AlertCircle className="mx-auto mb-3 size-12 text-red-300" />
        <p className="font-medium text-muted-foreground">
          Warehouse supplier not found
        </p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/warehouse/dashboard/suppliers">Back to Suppliers</Link>
        </Button>
      </div>
    );
  }

  const name =
    connection.warehouseName || connection.name || "Unnamed Warehouse";
  const storefrontUrl = connection.warehouseSlug
    ? `${getPublicStorefrontBaseUrl()}/w/${connection.warehouseSlug}`
    : null;

  const statusBadge =
    connection.status === "active" ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Connected
      </span>
    ) : connection.status === "pending" ? (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <XCircle className="h-3 w-3" />
        Rejected
      </span>
    );

  const orderStatusClass: Record<string, string> = {
    pending: "text-amber-700 bg-amber-50 border-amber-200",
    confirmed: "text-blue-700 bg-blue-50 border-blue-200",
    processing: "text-indigo-700 bg-indigo-50 border-indigo-200",
    delivered: "text-emerald-700 bg-emerald-50 border-emerald-200",
    cancelled: "text-rose-700 bg-rose-50 border-rose-200",
  };

  return (
    <DetailShell
      name={name}
      subtitle={connection.warehouseSlug || connection.warehouseId}
      typeLabel="Warehouse"
      statusBadge={statusBadge}
      actions={
        <>
          {connection.status === "active" && storefrontUrl && (
            <Button size="sm" asChild className="h-9">
              <Link href={storefrontUrl}>Visit Storefront</Link>
            </Button>
          )}
          {connection.status === "active" && (
            <Button size="sm" variant="outline" asChild className="h-9">
              <Link href="/warehouse/dashboard/order-from-supplier">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Place Order
              </Link>
            </Button>
          )}
          {connection.status === "pending" && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-red-600"
              disabled={cancelMutation.isPending}
              onClick={() =>
                cancelMutation.mutate({ connectionId: connection.connectionId })
              }
            >
              {cancelMutation.isPending && (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              )}
              Cancel Request
            </Button>
          )}
          {connection.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={disconnectMutation.isPending}
              onClick={() => {
                if (confirm("Disconnect this warehouse supplier?")) {
                  disconnectMutation.mutate({
                    connectionId: connection.connectionId,
                  });
                }
              }}
            >
              Disconnect
            </Button>
          )}
        </>
      }
    >
      <div className="grid shrink-0 gap-3 lg:grid-cols-3 lg:gap-4">
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetricCard
              title="Total Purchase"
              value={formatMoney(totalPurchase)}
              icon={DollarSign}
            />
            <MetricCard title="Orders" value={orders.length} icon={Receipt} />
            <MetricCard
              title="Products"
              value={connection.status === "active" ? connection.productCount : 0}
              icon={Package}
            />
            <MetricCard
              title="Last Ordered"
              value={
                connection.lastOrderedAt
                  ? formatDate(connection.lastOrderedAt)
                  : "—"
              }
              icon={CalendarDays}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {connection.phone && (
                <DetailField
                  icon={<Phone className="h-3.5 w-3.5" />}
                  label="Phone"
                  value={connection.phone}
                />
              )}
              {connection.warehouseAddress && (
                <DetailField
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  label="Address"
                  value={connection.warehouseAddress}
                />
              )}
              <DetailField
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Warehouse ID"
                value={connection.warehouseSlug || connection.warehouseId}
              />
              <DetailField
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Connected"
                value={formatDate(connection.connectedAt || connection.createdAt)}
              />
            </div>
          </div>
        </div>

        <SidePanel
          title="Connection"
          emptyMessage="No connection details"
        >
          <div className="space-y-2 px-3 py-2 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium capitalize">{connection.status}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Products</span>
              <span className="font-medium tabular-nums">
                {connection.status === "active" ? connection.productCount : 0}
              </span>
            </div>
            {storefrontUrl && (
              <div className="pt-1">
                <Button asChild variant="outline" size="sm" className="h-8 w-full text-xs">
                  <Link href={storefrontUrl}>Open Storefront</Link>
                </Button>
              </div>
            )}
          </div>
        </SidePanel>
      </div>

      <ScrollableHistoryTable
        title="Order History"
        count={orders.length}
        emptyMessage="No orders placed with this warehouse supplier yet"
        headers={["Order #", "Date", "Items", "Total", "Status", "Action"]}
        isLoading={ordersQuery.isLoading}
        rows={orders.map((order) => (
          <TableRow key={order.id} className="border-b border-border hover:bg-muted/30">
            <TableCell className="font-mono text-xs font-medium sm:text-sm">
              {order.orderNumber}
            </TableCell>
            <TableCell className="text-xs sm:text-sm">
              {formatDate(order.createdAt)}
            </TableCell>
            <TableCell className="text-center text-xs tabular-nums">
              {order.items?.length ?? 0}
            </TableCell>
            <TableCell className="text-right text-xs font-medium tabular-nums sm:text-sm">
              {formatMoney(parseFloat(order.total || "0"))}
            </TableCell>
            <TableCell>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  orderStatusClass[order.status] ?? orderStatusClass.pending
                }`}
              >
                {order.status}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href={`/warehouse/dashboard/purchases/${order.id}`}>
                  View &rarr;
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      />
    </DetailShell>
  );
}

function SidePanel({
  title,
  count,
  emptyMessage,
  children,
}: {
  title: string;
  count?: number;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  const isEmpty = count !== undefined ? count === 0 : false;

  return (
    <div className="flex max-h-[14rem] flex-col overflow-hidden rounded-xl border border-border bg-card lg:max-h-none lg:h-full">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {count !== undefined && count > 0 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center px-3 py-6 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      )}
    </div>
  );
}

function ScrollableHistoryTable({
  title,
  count,
  emptyMessage,
  headers,
  rows,
  isLoading,
}: {
  title: string;
  count?: number;
  emptyMessage: string;
  headers: string[];
  rows: React.ReactNode[];
  isLoading?: boolean;
}) {
  const rightAligned = new Set([
    "Amount",
    "Paid",
    "Due",
    "Total",
    "Total Value",
    "Total Qty",
    "Action",
    "",
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {count !== undefined && count > 0 ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <Skeleton className="h-full min-h-[8rem] w-full" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-10 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <Table className="w-full min-w-[40rem]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                {headers.map((h) => (
                  <TableHead
                    key={h || "action"}
                    className={`h-auto px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:text-xs ${
                      rightAligned.has(h) ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>{rows}</TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex w-full flex-col gap-3 lg:h-[calc(100dvh-10.5rem)]">
      <Skeleton className="h-20 w-full shrink-0" />
      <div className="grid shrink-0 gap-3 lg:grid-cols-3">
        <Skeleton className="h-36 lg:col-span-2" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="min-h-0 flex-1 rounded-xl" />
    </div>
  );
}
