"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  PackageCheck,
  PackageOpen,
  Recycle,
  RotateCcw,
  ShoppingCart,
  X,
} from "lucide-react";
import { type ElementType, Fragment, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";

type ActionType = "damage" | "supplier_return" | "sale_application";

const ACTION_COPY: Record<ActionType, { title: string; verb: string }> = {
  damage: { title: "Create Damage", verb: "Move to damaged" },
  supplier_return: { title: "Return to Supplier", verb: "Return" },
  sale_application: { title: "Apply Sales", verb: "Apply" },
};

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: ElementType;
}) {
  return (
    <div className="border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-slate-950">
            {value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <div className="border border-teal-200 bg-teal-50 p-2.5 text-teal-700">
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

export function EmptyPackManagement() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [action, setAction] = useState<{
    variantId: number;
    variantLabel: string;
    available: number;
    type: ActionType;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const summaryQuery = useQuery(
    orpc.emptyPackManagement.getSummary.queryOptions({
      input: undefined,
    }),
  );
  const actionMutation = useMutation({
    mutationFn: (input: {
      variantId: number;
      action: ActionType;
      quantity: number;
      notes?: string;
    }) => orpc.emptyPackManagement.recordAction.call(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: orpc.emptyPackManagement.getSummary.queryOptions({
          input: undefined,
        }).queryKey,
      });
      toast.success("Empty cylinder balance updated");
      setAction(null);
      setQuantity(1);
      setNotes("");
    },
    onError: (error) =>
      toast.error(error.message || "Unable to update balance"),
  });

  const data = summaryQuery.data as any;
  const products: any[] = data?.products ?? [];
  const summary = data?.summary ?? {
    fullQty: 0,
    emptyQty: 0,
    inMarketQty: 0,
    totalQty: 0,
  };
  const today = new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
  }).format(data?.asOf ? new Date(data.asOf) : new Date());

  const openAction = (variant: any, type: ActionType) => {
    if (variant.emptyQty <= 0) {
      toast.error("No empty cylinders are available for this action");
      return;
    }
    setAction({
      variantId: variant.variantId,
      variantLabel: `${variant.brandName} · ${variant.unitLabel}`,
      available: variant.emptyQty,
      type,
    });
    setQuantity(1);
    setNotes("");
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="border border-slate-800 bg-slate-950 px-5 py-5 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-teal-300">
              <PackageOpen size={18} />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">
                Stock Control
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight">
              Empty Pack Management
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              New sales send a filled cylinder out. Exchange sales send one out
              and add one empty cylinder back to your balance.
            </p>
          </div>
          <div className="border-l-2 border-teal-400 pl-4 text-sm">
            <p className="font-bold text-white">{data?.storeName || "Store"}</p>
            <p className="mt-1 text-xs text-slate-400">Today · {today}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Filled"
          value={summary.fullQty}
          note="Sellable + reserved"
          icon={PackageCheck}
        />
        <MetricCard
          label="Empty"
          value={summary.emptyQty}
          note="Available for action"
          icon={Recycle}
        />
        <MetricCard
          label="In Market"
          value={summary.inMarketQty}
          note="New cylinders with buyers"
          icon={CircleGauge}
        />
        <MetricCard
          label="Tracked Total"
          value={summary.totalQty}
          note="Filled + empty + market"
          icon={ShoppingCart}
        />
      </div>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.12em] text-slate-900">
              Empty Pack List
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Expand a product to manage each cylinder variant.
            </p>
          </div>
          <span className="border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-600">
            {products.length} products
          </span>
        </div>

        {summaryQuery.isLoading ? (
          <div className="p-14 text-center text-sm text-slate-500">
            Loading cylinder balances…
          </div>
        ) : summaryQuery.isError ? (
          <div className="p-14 text-center text-sm font-medium text-red-600">
            Unable to load empty cylinder balances. Please refresh and try
            again.
          </div>
        ) : products.length === 0 ? (
          <div className="p-14 text-center">
            <PackageOpen className="mx-auto text-slate-300" size={38} />
            <p className="mt-3 font-bold text-slate-700">
              No returnable cylinder stock found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Exchange activity will appear here once a returnable variant is
              stocked.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100">
                <TableHead className="w-10" />
                <TableHead className="font-black text-slate-700">ID</TableHead>
                <TableHead className="font-black text-slate-700">
                  Name
                </TableHead>
                <TableHead className="font-black text-slate-700">
                  Variant
                </TableHead>
                <TableHead className="text-right font-black text-slate-700">
                  Total
                </TableHead>
                <TableHead className="text-right font-black text-slate-700">
                  Empty
                </TableHead>
                <TableHead className="text-right font-black text-slate-700">
                  In Market
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const expanded = expandedId === product.productId;
                return (
                  <Fragment key={product.productId}>
                    <TableRow
                      onClick={() =>
                        setExpandedId(expanded ? null : product.productId)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExpandedId(expanded ? null : product.productId);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                      className="cursor-pointer hover:bg-teal-50/50"
                    >
                      <TableCell>
                        {expanded ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-600">
                        {product.sku}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900">
                        {product.productName}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {product.variants.length} variant
                        {product.variants.length === 1 ? "" : "s"}
                      </TableCell>
                      <TableCell className="text-right font-black tabular-nums">
                        {product.totalQty}
                      </TableCell>
                      <TableCell className="text-right font-black tabular-nums text-teal-700">
                        {product.emptyQty}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className="group relative inline-flex cursor-help justify-end font-black tabular-nums text-amber-700"
                          tabIndex={product.orderIds.length > 0 ? 0 : -1}
                          aria-label={`${product.inMarketQty} cylinders in market${product.orderIds.length > 0 ? `. Orders: ${product.orderIds.join(", ")}` : ""}`}
                        >
                          {product.inMarketQty}
                          {product.orderIds.length > 0 && (
                            <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-64 border border-slate-700 bg-slate-950 p-3 text-left text-xs font-normal text-white shadow-xl group-hover:block group-focus:block">
                              <p className="mb-2 font-bold uppercase tracking-wider text-teal-300">
                                Order IDs
                              </p>
                              {product.orderIds.map((id: string) => (
                                <p
                                  key={id}
                                  className="font-mono text-slate-200"
                                >
                                  {id}
                                </p>
                              ))}
                            </div>
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow
                        key={`${product.productId}-details`}
                        className="bg-slate-50 hover:bg-slate-50"
                      >
                        <TableCell colSpan={7} className="p-0">
                          <div className="border-y border-slate-200 px-5 py-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Brand</TableHead>
                                  <TableHead>Variant</TableHead>
                                  <TableHead>SKU</TableHead>
                                  <TableHead className="text-right">
                                    Filled
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Empty
                                  </TableHead>
                                  <TableHead className="text-right">
                                    In Market
                                  </TableHead>
                                  <TableHead className="text-right">
                                    Action
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {product.variants.map((variant: any) => (
                                  <TableRow key={variant.variantId}>
                                    <TableCell className="font-bold">
                                      {variant.brandName}
                                    </TableCell>
                                    <TableCell>{variant.unitLabel}</TableCell>
                                    <TableCell className="font-mono text-xs">
                                      {variant.sku}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {variant.fullQty}
                                    </TableCell>
                                    <TableCell className="text-right font-bold tabular-nums text-teal-700">
                                      {variant.emptyQty}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-amber-700">
                                      {variant.inMarketQty}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex justify-end gap-1.5">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            openAction(variant, "damage")
                                          }
                                        >
                                          <AlertTriangle size={13} /> Damage
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            openAction(
                                              variant,
                                              "supplier_return",
                                            )
                                          }
                                        >
                                          <RotateCcw size={13} /> Supplier
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            openAction(
                                              variant,
                                              "sale_application",
                                            )
                                          }
                                        >
                                          Apply Sales
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {action && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          onMouseDown={() => setAction(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="empty-pack-action-title"
            className="w-full max-w-md border border-slate-300 bg-white shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3
                  id="empty-pack-action-title"
                  className="font-black text-slate-950"
                >
                  {ACTION_COPY[action.type].title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {action.variantLabel} · {action.available} empty available
                </p>
              </div>
              <button
                aria-label="Close action dialog"
                onClick={() => setAction(null)}
                className="p-1 text-slate-400 hover:text-slate-900"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Quantity
                </span>
                <input
                  type="number"
                  min={1}
                  max={action.available}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      Math.max(
                        1,
                        Math.min(
                          action.available,
                          Number(event.target.value) || 1,
                        ),
                      ),
                    )
                  }
                  className="w-full border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Note (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="w-full resize-none border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500"
                />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setAction(null)}>
                  Cancel
                </Button>
                <Button
                  disabled={actionMutation.isPending}
                  onClick={() =>
                    actionMutation.mutate({
                      variantId: action.variantId,
                      action: action.type,
                      quantity,
                      notes: notes.trim() || undefined,
                    })
                  }
                >
                  {actionMutation.isPending
                    ? "Saving…"
                    : `${ACTION_COPY[action.type].verb} ${quantity}`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
