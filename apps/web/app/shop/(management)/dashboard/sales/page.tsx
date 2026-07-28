"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  ReceiptText,
  Search,
  ShoppingBag,
  Store,
  Undo2,
  WalletCards,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { downloadRetailerPosReceipt } from "@/lib/retailer-pos-receipt";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function printDetail(detail: any) {
  const popup = window.open("", "_blank", "width=440,height=720");
  if (!popup) return;
  popup.document.write(
    `<!doctype html><html><head><title>${detail.sale.invoiceNo}</title><style>body{font:12px Segoe UI,sans-serif;max-width:360px;margin:auto;padding:16px;color:#17201c}h2{text-align:center;margin:0}.muted{text-align:center;color:#68736d}.rule{border-top:1px dashed #999;margin:12px 0}.row{display:flex;justify-content:space-between;gap:12px;margin:5px 0}.strong{font-weight:700;font-size:14px}</style></head><body><h2>${detail.shop.name}</h2><div class="muted">${detail.shop.address || ""}</div><div class="rule"></div><b>${detail.sale.invoiceNo}</b><div>${new Date(detail.sale.createdAt).toLocaleString("en-BD")}</div><div>${detail.sale.customerName}</div><div class="rule"></div>${detail.sale.items.map((item: any) => `<div class="row"><span>${item.productName} × ${item.quantity}</span><span>BDT ${money(item.lineTotal)}</span></div>`).join("")}<div class="rule"></div><div class="row strong"><span>Total</span><span>BDT ${money(detail.sale.total)}</span></div><div class="row"><span>Paid</span><span>BDT ${money(detail.sale.paid)}</span></div><div class="row"><span>Due</span><span>BDT ${money(detail.sale.due)}</span></div></body></html>`,
  );
  popup.document.close();
  popup.focus();
  popup.print();
}

export default function RetailerSalesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | "pos" | "online">("all");
  const [status, setStatus] = useState<
    "all" | "completed" | "due" | "cancelled"
  >("all");
  const [payment, setPayment] = useState<
    "all" | "cash" | "bkash" | "nagad" | "bank" | "due"
  >("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const collectRequestId = useRef<string | null>(null);
  const [collectForm, setCollectForm] = useState({
    amount: "",
    paymentMethod: "cash" as "cash" | "bkash" | "nagad" | "bank",
    transactionRef: "",
    note: "",
  });
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  const input = useMemo(
    () => ({
      search: search || undefined,
      source,
      status,
      payment,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit: 20,
    }),
    [dateFrom, dateTo, page, payment, search, source, status],
  );
  const salesQuery = useQuery(
    orpc.retailerPos.listSales.queryOptions({ input }),
  );
  const detailQuery = useQuery({
    ...orpc.retailerPos.getSale.queryOptions({
      input: { saleId: selectedSaleId ?? 0 },
    }),
    enabled: selectedSaleId !== null,
  });

  const collectMutation = useMutation({
    mutationFn: () => {
      collectRequestId.current ||= crypto.randomUUID();
      return orpc.retailerPos.collectDue.call({
        saleId: selectedSaleId!,
        idempotencyKey: collectRequestId.current,
        amount: Number(collectForm.amount),
        paymentMethod: collectForm.paymentMethod,
        transactionRef: collectForm.transactionRef || undefined,
        note: collectForm.note || undefined,
      });
    },
    onSuccess: () => {
      collectRequestId.current = null;
      toast.success("Outstanding payment recorded");
      setCollectOpen(false);
      setCollectForm({
        amount: "",
        paymentMethod: "cash",
        transactionRef: "",
        note: "",
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listSales.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.getSale.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listReceivables.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });
  const voidMutation = useMutation({
    mutationFn: () =>
      orpc.retailerPos.voidSale.call({
        saleId: selectedSaleId!,
        reason: voidReason,
      }),
    onSuccess: () => {
      toast.success("Sale voided and stock restored");
      setVoidOpen(false);
      setVoidReason("");
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listSales.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.getSale.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.getCatalog.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const summary = salesQuery.data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Retail commerce
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Sales desk
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Counter receipts and completed online orders in one commercial
            record.
          </p>
        </div>
        <Button asChild className="bg-emerald-700 hover:bg-emerald-800">
          <a href="/dashboard/pos">
            <ShoppingBag className="mr-2 h-4 w-4" /> Open POS
          </a>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={ReceiptText}
          label="Transactions"
          value={String(summary?.count ?? 0)}
          tone="slate"
        />
        <Metric
          icon={WalletCards}
          label="Gross sales"
          value={`BDT ${money(summary?.total)}`}
          tone="emerald"
        />
        <Metric
          icon={Banknote}
          label="Paid"
          value={`BDT ${money(summary?.paid)}`}
          tone="blue"
        />
        <Metric
          icon={FileText}
          label="Outstanding"
          value={`BDT ${money(summary?.due)}`}
          tone="amber"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50/70 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_150px_150px_150px_150px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Receipt, customer, phone, order…"
                className="pl-9"
              />
            </div>
            <FilterSelect
              value={source}
              onChange={(value) => {
                setSource(value as typeof source);
                setPage(1);
              }}
              label="All sources"
              options={[
                { value: "pos", label: "Counter Sale" },
                { value: "online", label: "Online Order" },
              ]}
            />
            <FilterSelect
              value={status}
              onChange={(value) => {
                setStatus(value as typeof status);
                setPage(1);
              }}
              label="All statuses"
              options={[
                { value: "completed", label: "Completed" },
                { value: "due", label: "Due" },
                { value: "cancelled", label: "Cancelled" },
              ]}
            />
            <FilterSelect
              value={payment}
              onChange={(value) => {
                setPayment(value as typeof payment);
                setPage(1);
              }}
              label="All payments"
              options={[
                { value: "cash", label: "Cash" },
                { value: "bkash", label: "bKash" },
                { value: "nagad", label: "Nagad" },
                { value: "bank", label: "Bank" },
                { value: "due", label: "Due" },
              ]}
            />
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              aria-label="Date from"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              aria-label="Date to"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="border-b bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Receipt</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Due</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {salesQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
                  </td>
                </tr>
              ) : (salesQuery.data?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <Store className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                    <div className="font-medium">
                      No sales match these filters
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Complete a counter sale or clear the filters.
                    </div>
                  </td>
                </tr>
              ) : (
                salesQuery.data?.rows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">
                        {row.invoiceNo}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(row.date).toLocaleString("en-BD")}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{row.customerName}</div>
                      <div className="text-xs text-slate-500">
                        {row.customerPhone || "No phone"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        variant="outline"
                        className={
                          row.source === "pos"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-blue-200 bg-blue-50 text-blue-800"
                        }
                      >
                        {row.sourceLabel}
                      </Badge>
                      {row.sourceRef && (
                        <div className="mt-1 text-xs text-slate-500">
                          {row.sourceRef}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">{row.paymentLabel}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums">
                      BDT {money(row.total)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-amber-700">
                      {row.due > 0 ? `BDT ${money(row.due)}` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-4 text-right">
                      {row.kind === "pos" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedSaleId(row.id)}
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" /> View
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Order record
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t bg-slate-50/50 px-5 py-3 text-sm">
          <span className="text-slate-500">
            {salesQuery.data?.pagination.total ?? 0} results
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <span className="grid min-w-9 place-items-center text-xs">
              {page} / {salesQuery.data?.pagination.pages ?? 1}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= (salesQuery.data?.pagination.pages ?? 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <Sheet
        open={selectedSaleId !== null}
        onOpenChange={(open) => !open && setSelectedSaleId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Counter Sale</SheetTitle>
            <SheetDescription>
              {detailQuery.data?.sale.invoiceNo}
            </SheetDescription>
          </SheetHeader>
          {detailQuery.isLoading ? (
            <Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin" />
          ) : (
            detailQuery.data && (
              <div className="space-y-5 p-5">
                <div className="rounded-2xl bg-[#10241d] p-5 text-white">
                  <div className="text-sm text-white/60">Total</div>
                  <div className="mt-1 text-3xl font-semibold">
                    BDT {money(detailQuery.data.sale.total)}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <StatusBadge
                      status={
                        detailQuery.data.sale.status === "cancelled"
                          ? "cancelled"
                          : Number(detailQuery.data.sale.due) > 0
                            ? "due"
                            : "completed"
                      }
                      dark
                    />
                    <span className="text-sm text-white/60">
                      {detailQuery.data.sale.customerName}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Items
                  </h3>
                  <div className="divide-y rounded-xl border">
                    {detailQuery.data.sale.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between gap-3 p-3 text-sm"
                      >
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-xs text-slate-500">
                            {item.quantity} {item.unitLabel} × BDT{" "}
                            {money(item.unitPrice)}
                          </div>
                        </div>
                        <div className="font-semibold">
                          BDT {money(item.lineTotal)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border p-4 text-sm">
                  <DetailRow
                    label="Subtotal"
                    value={detailQuery.data.sale.subtotal}
                  />
                  <DetailRow
                    label="Discount"
                    value={detailQuery.data.sale.discount}
                    negative
                  />
                  <DetailRow label="VAT" value={detailQuery.data.sale.tax} />
                  <DetailRow label="Paid" value={detailQuery.data.sale.paid} />
                  <DetailRow
                    label="Outstanding"
                    value={detailQuery.data.sale.due}
                    strong
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payment history
                  </h3>
                  <div className="space-y-2">
                    {detailQuery.data.sale.payments.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">
                        No payment recorded yet.
                      </p>
                    ) : (
                      detailQuery.data.sale.payments.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between rounded-xl border p-3 text-sm"
                        >
                          <div>
                            <div className="font-medium capitalize">
                              {entry.entryType} · {entry.paymentMethod}
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(entry.paidAt).toLocaleString("en-BD")}
                              {entry.transactionRef
                                ? ` · ${entry.transactionRef}`
                                : ""}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "font-semibold",
                              entry.entryType === "reversal" && "text-red-700",
                            )}
                          >
                            {entry.entryType === "reversal" ? "−" : ""} BDT{" "}
                            {money(entry.amount)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                {detailQuery.data.sale.voidReason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <b>Void reason:</b> {detailQuery.data.sale.voidReason}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => printDetail(detailQuery.data)}
                  >
                    <Printer className="mr-2 h-4 w-4" /> Print
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadRetailerPosReceipt(detailQuery.data)}
                  >
                    <Download className="mr-2 h-4 w-4" /> PDF
                  </Button>
                  {Number(detailQuery.data.sale.due) > 0 &&
                    detailQuery.data.sale.status !== "cancelled" && (
                      <Button
                        className="bg-emerald-700 hover:bg-emerald-800"
                        onClick={() => {
                          collectRequestId.current = null;
                          setCollectForm((current) => ({
                            ...current,
                            amount: detailQuery.data!.sale.due,
                          }));
                          setCollectOpen(true);
                        }}
                      >
                        <Banknote className="mr-2 h-4 w-4" /> Collect Due
                      </Button>
                    )}
                  {detailQuery.data.sale.status !== "cancelled" && (
                    <Button
                      variant="destructive"
                      onClick={() => setVoidOpen(true)}
                    >
                      <Undo2 className="mr-2 h-4 w-4" /> Void sale
                    </Button>
                  )}
                </div>
              </div>
            )
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Outstanding Balance</DialogTitle>
            <DialogDescription>
              Record one payment against this Counter Sale.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                className="mt-1"
                type="number"
                min="0.01"
                step="0.01"
                value={collectForm.amount}
                onChange={(event) =>
                  setCollectForm({ ...collectForm, amount: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Payment method</Label>
              <Select
                value={collectForm.paymentMethod}
                onValueChange={(value: typeof collectForm.paymentMethod) =>
                  setCollectForm({ ...collectForm, paymentMethod: value })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bkash">bKash</SelectItem>
                  <SelectItem value="nagad">Nagad</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transaction reference</Label>
              <Input
                className="mt-1"
                value={collectForm.transactionRef}
                onChange={(event) =>
                  setCollectForm({
                    ...collectForm,
                    transactionRef: event.target.value,
                  })
                }
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Note</Label>
              <Input
                className="mt-1"
                value={collectForm.note}
                onChange={(event) =>
                  setCollectForm({ ...collectForm, note: event.target.value })
                }
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                Number(collectForm.amount) <= 0 || collectMutation.isPending
              }
              onClick={() => collectMutation.mutate()}
            >
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void this Counter Sale?</DialogTitle>
            <DialogDescription>
              This restores all sold stock and records compensating payment
              reversals. It cannot be partially applied.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason</Label>
            <Input
              className="mt-1"
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Describe why the sale is being voided"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>
              Keep sale
            </Button>
            <Button
              variant="destructive"
              disabled={voidReason.trim().length < 5 || voidMutation.isPending}
              onClick={() => voidMutation.mutate()}
            >
              Void and restore stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
  tone: "slate" | "emerald" | "blue" | "amber";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    blue: "bg-blue-100 text-blue-800",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">
            {value}
          </div>
        </div>
        <div className={cn("rounded-xl p-3", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusBadge({ status, dark }: { status: string; dark?: boolean }) {
  const style =
    status === "completed"
      ? dark
        ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "due"
        ? dark
          ? "border-amber-300/30 bg-amber-300/15 text-amber-100"
          : "border-amber-200 bg-amber-50 text-amber-800"
        : dark
          ? "border-red-300/30 bg-red-300/15 text-red-100"
          : "border-red-200 bg-red-50 text-red-800";
  return (
    <Badge variant="outline" className={style}>
      {status === "due"
        ? "Due"
        : status === "cancelled"
          ? "Cancelled"
          : "Completed"}
    </Badge>
  );
}

function DetailRow({
  label,
  value,
  negative,
  strong,
}: {
  label: string;
  value: string | number | null;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between py-1",
        strong && "mt-2 border-t pt-3 font-semibold",
      )}
    >
      <span className="text-slate-500">{label}</span>
      <span>
        {negative && Number(value) > 0 ? "− " : ""}BDT {money(value)}
      </span>
    </div>
  );
}
