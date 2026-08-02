"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Loader2,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { useState } from "react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

function money(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });

  const customersQuery = useQuery(
    orpc.retailerPos.searchCustomers.queryOptions({
      input: { search: search || undefined },
    }),
  );
  const detailQuery = useQuery({
    ...orpc.retailerPos.getCustomerDetail.queryOptions({
      input: { customerKey: selectedKey ?? "pos:0" },
    }),
    enabled: selectedKey !== null,
  });
  const createMutation = useMutation({
    mutationFn: () =>
      orpc.retailerPos.createCustomer.call({
        name: form.name,
        phone: form.phone,
        address: form.address || undefined,
      }),
    onSuccess: ({ customer }) => {
      toast.success("POS Customer saved");
      setCreateOpen(false);
      setForm({ name: "", phone: "", address: "" });
      queryClient.invalidateQueries({
        queryKey: orpc.retailerPos.searchCustomers.key(),
      });
      setSelectedKey(`pos:${customer.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const customers = customersQuery.data?.customers ?? [];
  const linkedCount = customers.filter(
    (customer) => customer.source === "both",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Retail relationships
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Customer book
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Shop-scoped Counter Sale customers and consumers who have ordered
            from this shop.
          </p>
        </div>
        <Button
          className="bg-emerald-700 hover:bg-emerald-800"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" /> Add POS Customer
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={Users}
          label="Visible customers"
          value={String(customers.length)}
          tone="slate"
        />
        <Metric
          icon={Store}
          label="POS profiles"
          value={String(customers.filter((customer) => customer.id).length)}
          tone="emerald"
        />
        <Metric
          icon={ShoppingBag}
          label="POS + online"
          value={String(linkedCount)}
          tone="blue"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-slate-50/70 p-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, or address…"
              className="bg-white pl-9"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Relationship</th>
                <th className="px-5 py-3 font-medium">Address</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {customersQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-700" />
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <UserRound className="mx-auto mb-3 h-9 w-9 text-slate-300" />
                    <div className="font-medium">No customers found</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Add a POS Customer or wait for an online order.
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.key} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">
                        {customer.name}
                      </div>
                      {customer.isDefault && (
                        <div className="text-xs text-slate-500">
                          Default counter customer
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {customer.phone || "No phone"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <SourceBadge source={customer.source} />
                    </td>
                    <td className="max-w-xs truncate px-5 py-4 text-slate-500">
                      {customer.address || "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedKey(customer.key)}
                      >
                        History <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Sheet
        open={selectedKey !== null}
        onOpenChange={(open) => !open && setSelectedKey(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {detailQuery.data?.customer.name || "Customer history"}
            </SheetTitle>
            <SheetDescription>
              {detailQuery.data?.customer.phone || "No phone number"}
            </SheetDescription>
          </SheetHeader>
          {detailQuery.isLoading ? (
            <Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin" />
          ) : (
            detailQuery.data && (
              <div className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCell
                    label="Lifetime purchases"
                    value={`BDT ${money(detailQuery.data.summary.lifetimeValue)}`}
                  />
                  <SummaryCell
                    label="Outstanding"
                    value={`BDT ${money(detailQuery.data.summary.outstanding)}`}
                    warn={Number(detailQuery.data.summary.outstanding) > 0}
                  />
                  <SummaryCell
                    label="Counter receipts"
                    value={String(detailQuery.data.summary.counterPurchases)}
                  />
                  <SummaryCell
                    label="Online orders"
                    value={String(detailQuery.data.summary.onlinePurchases)}
                  />
                </div>
                <HistorySection
                  title="Counter Sales"
                  empty="No Counter Sales for this customer yet."
                >
                  {detailQuery.data.posSales.map((sale) => (
                    <HistoryRow
                      key={sale.id}
                      title={sale.invoiceNo}
                      date={sale.createdAt}
                      total={sale.total}
                      due={sale.status === "cancelled" ? null : sale.due}
                      cancelled={sale.status === "cancelled"}
                    />
                  ))}
                </HistorySection>
                <HistorySection
                  title="Fulfilled online orders"
                  empty="No fulfilled online orders for this customer."
                >
                  {detailQuery.data.onlineSales.map((sale) => (
                    <HistoryRow
                      key={sale.invoiceNo}
                      title={sale.orderNumber}
                      subtitle={sale.invoiceNo}
                      date={sale.createdAt}
                      total={sale.total}
                    />
                  ))}
                </HistorySection>
                <HistorySection
                  title="Payment history"
                  empty="No POS payments recorded."
                >
                  {detailQuery.data.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-xl border p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium capitalize">
                          {payment.entryType} · {payment.paymentMethod}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(payment.paidAt).toLocaleString("en-BD")}
                          {payment.transactionRef
                            ? ` · ${payment.transactionRef}`
                            : ""}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "font-semibold",
                          payment.entryType === "reversal" && "text-red-700",
                        )}
                      >
                        {payment.entryType === "reversal" ? "− " : ""}BDT{" "}
                        {money(payment.amount)}
                      </div>
                    </div>
                  ))}
                </HistorySection>
              </div>
            )
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add POS Customer</DialogTitle>
            <DialogDescription>
              Create a named customer for receipts and Due sales. Phone numbers
              are normalized to prevent duplicates within this shop.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                className="mt-1"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                className="mt-1"
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                form.name.trim().length < 2 ||
                form.phone.trim().length < 7 ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save customer
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
  tone: "slate" | "emerald" | "blue";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-100 text-emerald-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </div>
          <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
        <div className={cn("rounded-xl p-3", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: "pos" | "online" | "both" }) {
  const labels = { pos: "POS", online: "Online", both: "POS + online" };
  return (
    <Badge
      variant="outline"
      className={
        source === "both"
          ? "border-violet-200 bg-violet-50 text-violet-800"
          : source === "online"
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }
    >
      {labels[source]}
    </Badge>
  );
}

function SummaryCell({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        warn && "border-amber-200 bg-amber-50",
      )}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn("mt-1 font-semibold", warn && "text-amber-800")}>
        {value}
      </div>
    </div>
  );
}

function HistorySection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="space-y-2">
        {hasChildren ? (
          children
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-sm text-slate-500">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}

function HistoryRow({
  title,
  subtitle,
  date,
  total,
  due,
  cancelled,
}: {
  title: string;
  subtitle?: string | null;
  date: Date | string;
  total: string | number;
  due?: string | number | null;
  cancelled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-3 text-sm">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-slate-500">
          {subtitle ? `${subtitle} · ` : ""}
          {new Date(date).toLocaleString("en-BD")}
        </div>
      </div>
      <div className="text-right">
        <div
          className={cn(
            "font-semibold",
            cancelled && "line-through text-slate-400",
          )}
        >
          BDT {money(total)}
        </div>
        {due != null && Number(due) > 0 && (
          <div className="text-xs text-amber-700">Due BDT {money(due)}</div>
        )}
        {cancelled && <div className="text-xs text-red-700">Voided</div>}
      </div>
    </div>
  );
}
