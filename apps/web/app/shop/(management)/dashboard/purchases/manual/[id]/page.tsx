"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, RotateCcw, WalletCards, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { orpc } from "@/utils/orpc";
import { useState } from "react";
import { toast } from "sonner";

const money = (value: string | number | null | undefined) =>
  `Tk${Number(value ?? 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
const dateTime = (value: string | Date | null | undefined) =>
  value ? new Date(value).toLocaleString("en-GB") : "-";

export default function ManualPurchaseDetailPage() {
  const queryClient = useQueryClient();
  const purchaseId = Number(useParams<{ id: string }>().id);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "cash">("cash");
  const accounts = useQuery(orpc.finance.getPaymentAccounts.queryOptions({ input: {} }));
  const detail = useQuery(
    orpc.purchase.getManualDetail.queryOptions({
      enabled: Number.isInteger(purchaseId) && purchaseId > 0,
      input: { purchaseId },
    }),
  );
  const refresh = async () => {
    await Promise.all([
      detail.refetch(),
      queryClient.invalidateQueries({ queryKey: orpc.finance.getPaymentAccounts.key() }),
      queryClient.invalidateQueries({ queryKey: [["shopOwner", "getPurchaseReport"]] }),
      queryClient.invalidateQueries({ queryKey: [["shopOwner", "getAccountsPayableReport"]] }),
    ]);
  };
  const addPayment = useMutation({
    mutationFn: () => orpc.purchase.addManualPayment.call({
      amount: Number(paymentAmount),
      idempotencyKey: `manual-payment-${crypto.randomUUID()}`,
      paymentAccountId: Number(paymentAccountId),
      paymentMethod,
      purchaseId,
    }),
    onSuccess: async () => { toast.success("Purchase payment recorded"); setPaymentAmount(""); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const cancelPurchase = useMutation({
    mutationFn: () => orpc.purchase.cancelManual.call({ purchaseId, reason: "Cancelled from manual purchase details" }),
    onSuccess: async () => { toast.success("Purchase cancelled and connected records reversed"); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  const refund = useMutation({
    mutationFn: (input: { action: "approve" | "complete" | "process" | "request" | "verify"; amount?: number; paymentId: number }) =>
      orpc.purchase.advanceManualRefund.call({
        ...input,
        idempotencyKey: input.action === "complete" ? `manual-refund-${crypto.randomUUID()}` : undefined,
        paymentAccountId: input.action === "complete" ? Number(paymentAccountId) : undefined,
        reason: input.action === "request" ? "Refund requested from purchase details" : undefined,
      }),
    onSuccess: async (result) => { toast.success(`Refund stage: ${result.status.replaceAll("_", " ")}`); await refresh(); },
    onError: (error) => toast.error(error.message),
  });
  if (detail.isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }
  if (!detail.data || detail.isError) {
    return <div className="mx-auto max-w-5xl p-6"><p>Manual purchase could not be loaded.</p></div>;
  }

  const data = detail.data;
  const purchase = data.purchase;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button asChild size="icon" variant="ghost"><Link aria-label="Back to purchase report" href="/dashboard/reports/purchase"><ArrowLeft /></Link></Button>
          <div><h1 className="text-2xl font-bold">{purchase.purchaseNumber}</h1><p className="text-sm text-muted-foreground">{purchase.supplier.name} - {dateTime(purchase.receivedAt ?? purchase.createdAt)}</p></div>
        </div>
        <div className="flex gap-2 text-sm"><Status label={purchase.verificationStatus} /><Status label={purchase.status} /><Status label={purchase.paymentStatus} /></div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Purchase Total" value={money(purchase.total)} />
        <Metric label="Paid" value={money(purchase.paidAmount)} />
        <Metric label="Due" value={money(purchase.dueAmount)} />
        <Metric label="Bill Reference" value={purchase.supplierInvoiceNo || "-"} />
      </section>

      <section className="grid gap-4 border-y py-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label htmlFor="settlement-amount">Payment amount</Label><Input className="mt-2" id="settlement-amount" inputMode="decimal" onChange={(event) => setPaymentAmount(event.target.value)} placeholder={purchase.dueAmount} value={paymentAmount} /></div>
          <div><Label>Payment method</Label><Select onValueChange={(value) => setPaymentMethod(value as "bank" | "cash")} value={paymentMethod}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem></SelectContent></Select></div>
          <div><Label>Cash / Bank account</Label><Select onValueChange={setPaymentAccountId} value={paymentAccountId}><SelectTrigger className="mt-2 w-full"><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{(accounts.data?.paymentAccounts ?? []).filter((account) => account.type === paymentMethod).map((account) => <SelectItem key={account.id} value={account.id}>{account.name} ({money(account.balance)})</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {purchase.status !== "cancelled" && Number(purchase.dueAmount) > 0 ? <Button disabled={!paymentAccountId || Number(paymentAmount) <= 0 || addPayment.isPending} onClick={() => addPayment.mutate()}><WalletCards /> Add Payment</Button> : null}
          {purchase.status !== "cancelled" ? <Button disabled={cancelPurchase.isPending} onClick={() => cancelPurchase.mutate()} variant="destructive"><XCircle /> Cancel Purchase</Button> : null}
        </div>
      </section>

      <section className="space-y-3"><h2 className="font-semibold">Purchased Products</h2><div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">SKU</th><th className="px-3 py-3">Product</th><th className="px-3 py-3">Brand / Size</th><th className="px-3 py-3">Batch</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3 text-right">Unit Cost</th><th className="px-3 py-3 text-right">Total</th></tr></thead><tbody>{purchase.items.map((item) => <tr className="border-t" key={item.id}><td className="px-3 py-3">{item.sku || "-"}</td><td className="px-3 py-3 font-medium">{item.productName}</td><td className="px-3 py-3">{item.brandName || "-"} / {item.sizeLabel || "-"}</td><td className="px-3 py-3">{item.batchNo || "-"}</td><td className="px-3 py-3 text-right">{item.quantity} {item.quantityUnit}</td><td className="px-3 py-3 text-right">{money(item.unitCost)}</td><td className="px-3 py-3 text-right font-medium">{money(item.totalCost)}</td></tr>)}</tbody></table></div></section>

      <div className="grid gap-6 xl:grid-cols-2">
        <History title="Purchase History" rows={data.purchaseHistory.map((event) => ({ detail: event.description || event.eventType, id: `event-${event.id}`, meta: event.reference || "", time: dateTime(event.occurredAt) }))} />
        <section><h2 className="mb-3 font-semibold">Payment History</h2><div className="divide-y rounded-md border">{data.paymentHistory.length ? data.paymentHistory.map((payment) => {
          const prefix = `manual-payment:${payment.id}:`;
          const has = (type: string) => data.purchaseHistory.some((event) => event.idempotencyKey === `${prefix}${type}`);
          const nextAction = !has("refund_requested") ? "request" : !has("refund_verified") ? "verify" : !has("refund_approved") ? "approve" : !has("refund_processed") ? "process" : "complete";
          const refundable = Math.max(0, Number(payment.amount) - Number(payment.refundedAmount));
          return <div className="grid gap-2 p-3 text-sm" key={payment.id}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{payment.purchasePurpose || "payment"} - {money(payment.amount)} - {payment.status}</p><p className="text-xs text-muted-foreground">{payment.paymentMethod}{payment.referenceNo ? ` / ${payment.referenceNo}` : ""} - {dateTime(payment.completedAt ?? payment.createdAt)}</p></div>{purchase.status === "cancelled" && payment.entryType === "payment" && refundable > 0 ? <Button disabled={refund.isPending || (nextAction === "complete" && !paymentAccountId)} onClick={() => refund.mutate({ action: nextAction, amount: nextAction === "complete" ? refundable : undefined, paymentId: payment.id })} size="sm" variant="outline"><RotateCcw /> {nextAction === "complete" ? `Complete ${money(refundable)} Refund` : `${nextAction} refund`}</Button> : null}</div></div>;
        }) : <p className="p-4 text-sm text-muted-foreground">No records yet.</p>}</div></section>
        <History title="Inventory History" rows={data.inventoryHistory.map((movement) => ({ detail: `${movement.reason}: ${movement.quantity} ${movement.unit}`, id: `movement-${movement.id}`, meta: `${money(movement.unitCost)} each - ${movement.quantityBefore ?? "-"} to ${movement.quantityAfter ?? "-"}`, time: dateTime(movement.occurredAt) }))} />
        <History title="Accounting History" rows={data.accountingHistory.map((entry) => ({ detail: `${entry.journalNumber} - ${entry.memo || entry.transactionType}`, id: `journal-${entry.id}`, meta: entry.lines.map((line) => `${line.accountName}: Dr ${line.debit} / Cr ${line.credit}`).join("; "), time: dateTime(entry.postedAt) }))} />
      </div>
      {purchase.attachmentUrl ? <a className="inline-flex items-center gap-2 text-sm font-medium text-blue-700" href={purchase.attachmentUrl} rel="noreferrer" target="_blank"><FileText className="size-4" />{purchase.attachmentName || "View attachment"}</a> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md border p-4"><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-2 text-lg font-bold">{value}</p></div>; }
function Status({ label }: { label: string }) { return <span className="rounded-full border bg-muted/40 px-3 py-1 font-medium capitalize">{label.replaceAll("_", " ")}</span>; }
function History({ rows, title }: { rows: Array<{ detail: string; id: string; meta: string; time: string }>; title: string }) { return <section><h2 className="mb-3 font-semibold">{title}</h2><div className="divide-y rounded-md border">{rows.length ? rows.map((row) => <div className="grid gap-1 p-3 text-sm" key={row.id}><div className="flex justify-between gap-3"><span className="font-medium">{row.detail}</span><time className="shrink-0 text-xs text-muted-foreground">{row.time}</time></div><p className="break-words text-xs text-muted-foreground">{row.meta}</p></div>) : <p className="p-4 text-sm text-muted-foreground">No records yet.</p>}</div></section>; }
