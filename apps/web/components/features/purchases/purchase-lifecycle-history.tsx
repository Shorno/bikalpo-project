"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Box,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Loader2,
  PackageCheck,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { orpc } from "@/utils/orpc";

type HistoryTab = "purchase" | "payment" | "inventory" | "accounting";

const tabOptions: Array<{
  icon: typeof BookOpen;
  label: string;
  value: HistoryTab;
}> = [
  { icon: BookOpen, label: "Purchase", value: "purchase" },
  { icon: CircleDollarSign, label: "Payment", value: "payment" },
  { icon: Box, label: "Inventory", value: "inventory" },
  { icon: PackageCheck, label: "Accounting", value: "accounting" },
];

const badgeStyles: Record<string, string> = {
  accepted: "border-blue-200 bg-blue-50 text-blue-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  fully_paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  recognized: "border-emerald-200 bg-emerald-50 text-emerald-700",
  received: "border-emerald-200 bg-emerald-50 text-emerald-700",
  not_recognized: "border-gray-200 bg-gray-50 text-gray-600",
  outstanding: "border-amber-200 bg-amber-50 text-amber-700",
  partially_paid: "border-blue-200 bg-blue-50 text-blue-700",
  partially_received: "border-amber-200 bg-amber-50 text-amber-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  refund_pending: "border-orange-200 bg-orange-50 text-orange-700",
  refunded: "border-purple-200 bg-purple-50 text-purple-700",
  returned: "border-purple-200 bg-purple-50 text-purple-700",
  submitted: "border-gray-200 bg-gray-50 text-gray-700",
  unpaid: "border-red-200 bg-red-50 text-red-700",
};

function money(value: string | number | null | undefined) {
  return `Tk${Number(value ?? 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function label(value: string | null | undefined) {
  return (value ?? "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateTime(value: string | Date | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      className={
        badgeStyles[value] ?? "border-gray-200 bg-gray-50 text-gray-700"
      }
      variant="outline"
    >
      {label(value)}
    </Badge>
  );
}

function EmptyHistory({ message }: { message: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function DetailDialog({
  orderId,
  onOpenChange,
}: {
  orderId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<HistoryTab>("purchase");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const detailQuery = useQuery({
    enabled: orderId !== null,
    queryFn: () => orpc.purchaseLifecycle.getDetail.call({ orderId: orderId! }),
    queryKey: ["purchase-lifecycle-detail", orderId],
  });
  const detail = detailQuery.data as any;
  const accountsQuery = useQuery({
    enabled: orderId !== null && tab === "payment",
    queryFn: () => orpc.finance.getPaymentAccounts.call({}),
    queryKey: ["purchase-payment-accounts", orderId],
  });
  const paymentAccounts = accountsQuery.data?.paymentAccounts ?? [];
  const pendingPayment = detail?.paymentHistory?.find(
    (row: any) => row.entryType === "payment" && row.status === "pending",
  );
  const refundPending = detail?.paymentHistory?.find(
    (row: any) =>
      row.entryType === "payment" && row.status === "refund_pending",
  );
  const dueAmount = Number(detail?.order?.dueAmount ?? 0);
  const canPay =
    dueAmount > 0 &&
    !["cancelled", "returned"].includes(detail?.order?.status ?? "");

  useEffect(() => {
    if (!detail?.order) return;
    const nextAmount = pendingPayment
      ? Number(pendingPayment.amount)
      : Number(detail.order.dueAmount ?? 0);
    setPaymentAmount(nextAmount > 0 ? String(nextAmount) : "");
  }, [detail?.order, pendingPayment]);

  useEffect(() => {
    if (!paymentAccountId && paymentAccounts[0]) {
      setPaymentAccountId(paymentAccounts[0].id);
    }
  }, [paymentAccountId, paymentAccounts]);

  const refreshPurchase = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["purchase-lifecycle-detail", orderId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["purchase-lifecycle-history"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["purchase-payment-accounts"],
      }),
    ]);
  };
  const completePayment = useMutation({
    mutationFn: async () => {
      const account = paymentAccounts.find(
        (row) => row.id === paymentAccountId,
      );
      if (!account) throw new Error("Select a Cash or Bank account");
      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a payment amount greater than zero");
      }
      return orpc.purchaseLifecycle.completePayment.call({
        amount,
        idempotencyKey: crypto.randomUUID(),
        orderId: orderId!,
        paymentAccountId: Number(account.id),
        paymentId: pendingPayment?.id,
        paymentMethod: account.type === "cash" ? "cash" : "bank",
        referenceNo: paymentReference.trim() || undefined,
      });
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      toast.success("Purchase payment completed");
      setPaymentReference("");
      await refreshPurchase();
    },
  });
  const completeRefund = useMutation({
    mutationFn: async () => {
      const account = paymentAccounts.find(
        (row) => row.id === paymentAccountId,
      );
      if (!account) throw new Error("Select a Cash or Bank account");
      const amount =
        Number(refundPending.amount) -
        Number(refundPending.refundedAmount ?? 0);
      return orpc.purchaseLifecycle.completeRefund.call({
        amount,
        idempotencyKey: crypto.randomUUID(),
        paymentAccountId: Number(account.id),
        paymentId: refundPending.id,
        referenceNo: paymentReference.trim() || undefined,
      });
    },
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async () => {
      toast.success("Purchase refund completed");
      setPaymentReference("");
      await refreshPurchase();
    },
  });

  return (
    <Dialog open={orderId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none p-0 sm:h-[92dvh] sm:w-[94vw] sm:max-w-6xl sm:rounded-md">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>Purchase lifecycle</DialogTitle>
          <DialogDescription>
            {detail?.order?.orderNumber ?? "Loading permanent purchase history"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 border-b bg-muted/30 p-2 sm:grid-cols-4">
          {tabOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Button
                className="gap-2"
                key={option.value}
                onClick={() => setTab(option.value)}
                variant={tab === option.value ? "default" : "ghost"}
              >
                <Icon className="size-4" />
                {option.label}
              </Button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {detailQuery.isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : detailQuery.isError ? (
            <EmptyHistory message="The purchase history could not be loaded." />
          ) : tab === "purchase" ? (
            detail.purchaseHistory.length ? (
              <div className="divide-y border">
                {detail.purchaseHistory.map((event: any) => (
                  <div
                    className="grid gap-2 p-4 sm:grid-cols-[170px_1fr_auto]"
                    key={event.id}
                  >
                    <span className="text-xs text-muted-foreground">
                      {dateTime(event.occurredAt)}
                    </span>
                    <div>
                      <p className="font-medium">{event.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {label(event.category)} history
                      </p>
                    </div>
                    <StatusBadge value={event.toState ?? event.eventType} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHistory message="No purchase events have been recorded." />
            )
          ) : tab === "payment" ? (
            <div className="space-y-4">
              {canPay || refundPending ? (
                <section className="grid gap-4 border bg-muted/20 p-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="purchase-payment-amount">Amount</Label>
                    <Input
                      disabled={Boolean(refundPending)}
                      id="purchase-payment-amount"
                      inputMode="decimal"
                      max={
                        pendingPayment
                          ? Number(pendingPayment.amount)
                          : dueAmount
                      }
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      type="number"
                      value={
                        refundPending
                          ? String(
                              Number(refundPending.amount) -
                                Number(refundPending.refundedAmount ?? 0),
                            )
                          : paymentAmount
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cash or Bank account</Label>
                    <Select
                      onValueChange={setPaymentAccountId}
                      value={paymentAccountId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({money(account.balance)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="purchase-payment-reference">
                      Reference
                    </Label>
                    <Input
                      id="purchase-payment-reference"
                      onChange={(event) =>
                        setPaymentReference(event.target.value)
                      }
                      placeholder="Optional reference"
                      value={paymentReference}
                    />
                  </div>
                  {refundPending ? (
                    <Button
                      disabled={completeRefund.isPending || !paymentAccountId}
                      onClick={() => completeRefund.mutate()}
                    >
                      {completeRefund.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      Complete Refund
                    </Button>
                  ) : (
                    <Button
                      disabled={completePayment.isPending || !paymentAccountId}
                      onClick={() => completePayment.mutate()}
                    >
                      {completePayment.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {pendingPayment ? "Complete Payment" : "Pay Due"}
                    </Button>
                  )}
                </section>
              ) : null}

              {detail.paymentHistory.length ? (
                <div className="overflow-x-auto border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.paymentHistory.map((payment: any) => (
                        <TableRow key={payment.id}>
                          <TableCell>{dateTime(payment.createdAt)}</TableCell>
                          <TableCell>
                            {label(payment.purchasePurpose)}
                          </TableCell>
                          <TableCell>{label(payment.method)}</TableCell>
                          <TableCell>
                            {payment.referenceNo ??
                              payment.transactionId ??
                              "-"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge value={payment.status} />
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {money(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyHistory message="No payment has been recorded for this purchase." />
              )}
            </div>
          ) : tab === "inventory" ? (
            detail.inventoryHistory.length ? (
              <div className="overflow-x-auto border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit cost</TableHead>
                      <TableHead className="text-right">Total cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.inventoryHistory.map((movement: any) => (
                      <TableRow key={movement.id}>
                        <TableCell>{dateTime(movement.occurredAt)}</TableCell>
                        <TableCell>{label(movement.reason)}</TableCell>
                        <TableCell>#{movement.variantId}</TableCell>
                        <TableCell className="text-right">
                          {Number(movement.quantity).toLocaleString("en-BD")}{" "}
                          {movement.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          {money(movement.unitCost)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {money(movement.totalCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyHistory message="Inventory is recognized only after products are received." />
            )
          ) : detail.accountingHistory.length ? (
            <div className="space-y-3">
              {detail.accountingHistory.map((entry: any) => (
                <section className="border" key={entry.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 p-3">
                    <div>
                      <p className="font-semibold">{entry.entryNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.memo}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {dateTime(entry.postedAt)}
                    </span>
                  </div>
                  <div className="divide-y">
                    {entry.lines.map((line: any) => (
                      <div
                        className="grid grid-cols-[1fr_auto_auto] gap-4 px-3 py-2 text-sm"
                        key={line.id}
                      >
                        <span>
                          {line.description ??
                            `Account #${line.financeAccountId}`}
                        </span>
                        <span>Debit {money(line.debit)}</span>
                        <span>Credit {money(line.credit)}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyHistory message="No accounting journal has been posted for this purchase." />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PurchaseLifecycleHistory({
  description = "Track purchase, payment, inventory, and accounting states separately.",
  title = "Purchase History",
}: {
  description?: string;
  title?: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const historyQuery = useQuery({
    queryFn: () =>
      orpc.purchaseLifecycle.getHistory.call({
        limit: 20,
        page,
        search: search.trim() || undefined,
        status: status === "all" ? undefined : (status as any),
      }),
    queryKey: ["purchase-lifecycle-history", page, search, status],
  });
  const data = historyQuery.data as any;
  const purchases = data?.purchases ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-normal text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>

      <section className="grid gap-3 border bg-background p-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search purchase number"
            value={search}
          />
        </div>
        <Select
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          value={status}
        >
          <SelectTrigger>
            <SelectValue placeholder="All purchase states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All purchase states</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="partially_received">
              Partially received
            </SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </section>

      {historyQuery.isLoading ? (
        <div className="flex min-h-72 items-center justify-center border">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : historyQuery.isError ? (
        <EmptyHistory message="Purchase history could not be loaded. Try again after checking the server." />
      ) : purchases.length === 0 ? (
        <EmptyHistory message="No purchases match the selected filters." />
      ) : (
        <>
          <div className="hidden overflow-x-auto border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Purchase</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Inventory</TableHead>
                  <TableHead>Financial</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-14">
                    <span className="sr-only">View</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase: any) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="font-semibold">
                      {purchase.orderNumber}
                    </TableCell>
                    <TableCell>{purchase.sellerName}</TableCell>
                    <TableCell>{dateTime(purchase.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge value={purchase.purchaseStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={purchase.paymentStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={purchase.inventoryStatus} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={purchase.financialStatus} />
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {money(purchase.total)}
                    </TableCell>
                    <TableCell>
                      <Button
                        aria-label={`View ${purchase.orderNumber}`}
                        onClick={() => setSelectedOrderId(purchase.id)}
                        size="icon"
                        variant="outline"
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-3 md:hidden">
            {purchases.map((purchase: any) => (
              <article className="border bg-background p-4" key={purchase.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{purchase.orderNumber}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {purchase.sellerName}
                    </p>
                  </div>
                  <Button
                    aria-label={`View ${purchase.orderNumber}`}
                    onClick={() => setSelectedOrderId(purchase.id)}
                    size="icon"
                    variant="outline"
                  >
                    <Eye className="size-4" />
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="mb-1 text-muted-foreground">Purchase</p>
                    <StatusBadge value={purchase.purchaseStatus} />
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Payment</p>
                    <StatusBadge value={purchase.paymentStatus} />
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Inventory</p>
                    <StatusBadge value={purchase.inventoryStatus} />
                  </div>
                  <div>
                    <p className="mb-1 text-muted-foreground">Financial</p>
                    <StatusBadge value={purchase.financialStatus} />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    {dateTime(purchase.createdAt)}
                  </span>
                  <span className="font-semibold">{money(purchase.total)}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {data?.pagination && data.pagination.pages > 1 ? (
        <div className="flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.pages}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
              size="icon"
              variant="outline"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              disabled={page >= data.pagination.pages}
              onClick={() => setPage((value) => value + 1)}
              size="icon"
              variant="outline"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <DetailDialog
        orderId={selectedOrderId}
        onOpenChange={(open) => !open && setSelectedOrderId(null)}
      />
    </div>
  );
}
