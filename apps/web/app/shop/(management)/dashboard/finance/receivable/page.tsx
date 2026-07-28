"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  FileText,
  Loader2,
  ReceiptText,
  Search,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

type ReceivableRow = {
  saleId: number;
  invoiceNo: string;
  customerName: string;
  customerPhone: string | null;
  total: string;
  paid: string;
  due: string;
  createdAt: Date;
};

export default function ReceivablePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ReceivableRow | null>(null);
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    amount: "",
    paymentMethod: "cash" as "cash" | "bkash" | "nagad" | "bank",
    transactionRef: "",
    note: "",
  });
  const receivablesQuery = useQuery(
    orpc.retailerPos.listReceivables.queryOptions({
      input: { search: search || undefined },
    }),
  );

  const collectMutation = useMutation({
    mutationFn: () =>
      orpc.retailerPos.collectDue.call({
        saleId: selected!.saleId,
        idempotencyKey: paymentKey,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        transactionRef: form.transactionRef || undefined,
        note: form.note || undefined,
      }),
    onSuccess: () => {
      toast.success("Outstanding payment recorded");
      setSelected(null);
      setForm({
        amount: "",
        paymentMethod: "cash",
        transactionRef: "",
        note: "",
      });
      setPaymentKey(crypto.randomUUID());
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listReceivables.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.listSales.key(),
      });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.getSale.key(),
      });
    },
    onError: (error) => toast.error(error.message),
  });

  const summary = receivablesQuery.data?.summary;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Finance & accounts
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Receivables
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Open balances from shop-owned Counter Sales. Cancelled sales never
          appear here.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={Users}
          label="Customers owing"
          value={String(summary?.customers ?? 0)}
          tone="slate"
        />
        <Metric
          icon={ReceiptText}
          label="Open receipts"
          value={String(summary?.receipts ?? 0)}
          tone="blue"
        />
        <Metric
          icon={WalletCards}
          label="Total outstanding"
          value={`BDT ${money(summary?.due)}`}
          tone="amber"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50/70 p-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="bg-white pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search receipt, customer, or phone…"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Receipt</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 text-right font-medium">Sale total</th>
                <th className="px-5 py-3 text-right font-medium">Paid</th>
                <th className="px-5 py-3 text-right font-medium">
                  Outstanding
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {receivablesQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-700" />
                  </td>
                </tr>
              ) : (receivablesQuery.data?.rows.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <FileText className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                    <div className="font-medium">No Outstanding Balances</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Due Counter Sales will appear here automatically.
                    </div>
                  </td>
                </tr>
              ) : (
                receivablesQuery.data?.rows.map((row) => (
                  <tr key={row.saleId} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="font-semibold">{row.invoiceNo}</div>
                      <div className="text-xs text-slate-500">
                        {new Date(row.createdAt).toLocaleString("en-BD")}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{row.customerName}</div>
                      <div className="text-xs text-slate-500">
                        {row.customerPhone || "No phone"}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      BDT {money(row.total)}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-emerald-700">
                      BDT {money(row.paid)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-amber-800">
                      BDT {money(row.due)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700"
                        onClick={() => {
                          setSelected(row);
                          setForm((current) => ({
                            ...current,
                            amount: row.due,
                          }));
                          setPaymentKey(crypto.randomUUID());
                        }}
                      >
                        <Banknote className="mr-1.5 h-4 w-4" /> Collect
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Outstanding Balance</DialogTitle>
            <DialogDescription>
              {selected?.invoiceNo} · {selected?.customerName} · Maximum BDT{" "}
              {money(selected?.due)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <Input
                className="mt-1"
                type="number"
                min="0.01"
                max={selected?.due}
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Payment method</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(value: typeof form.paymentMethod) =>
                  setForm({ ...form, paymentMethod: value })
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
                value={form.transactionRef}
                onChange={(event) =>
                  setForm({ ...form, transactionRef: event.target.value })
                }
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Note</Label>
              <Input
                className="mt-1"
                value={form.note}
                onChange={(event) =>
                  setForm({ ...form, note: event.target.value })
                }
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              disabled={
                !selected ||
                Number(form.amount) <= 0 ||
                Number(form.amount) > Number(selected.due) ||
                collectMutation.isPending
              }
              onClick={() => collectMutation.mutate()}
            >
              {collectMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Record payment
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
  icon: typeof Users;
  label: string;
  value: string;
  tone: "slate" | "blue" | "amber";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
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
