"use client";

import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DispatchOrderRow } from "./dispatch-columns";

function formatMoney(value: string | number) {
  return `৳ ${Number(value || 0).toLocaleString("en-BD")}`;
}

function formatQty(qty: number, unit?: string | null) {
  if (!unit) return String(qty);
  return `${qty} ${unit}`;
}

type PartialInvoiceDialogProps = {
  open: boolean;
  order: DispatchOrderRow | null;
  quantities: Record<number, number>;
  actionLoading: string | null;
  onClose: () => void;
  onCreate: () => void;
  onQuantityChange: (
    orderItemId: number,
    remainingQty: number,
    nextQuantity: number,
  ) => void;
};

const thClass =
  "h-8 px-2.5 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const tdClass = "px-2.5 py-2 align-middle text-xs tabular-nums";

export function PartialInvoiceDialog({
  open,
  order,
  quantities,
  actionLoading,
  onClose,
  onCreate,
  onQuantityChange,
}: PartialInvoiceDialogProps) {
  const selectedTotal =
    order?.items.reduce((sum, item) => {
      const quantity = quantities[item.orderItemId] ?? 0;
      return sum + quantity * Number(item.unitPrice);
    }, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="space-y-1 border-b px-4 py-3">
          <DialogTitle className="text-sm font-semibold">
            Create Partial Invoice
          </DialogTitle>
          <DialogDescription className="text-xs">
            Dispatch quantities for {order?.orderNumber ?? "this order"}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-4 py-3">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full table-fixed text-xs">
              <thead className="border-b bg-muted/30">
                <tr>
                  <th className={cn(thClass, "w-[30%]")}>Product</th>
                  <th className={cn(thClass, "text-right")}>Ordered</th>
                  <th className={cn(thClass, "text-right")}>Packed</th>
                  <th className={cn(thClass, "text-right")}>Dispatched</th>
                  <th className={cn(thClass, "text-center")}>Dispatch Now</th>
                  <th className={cn(thClass, "text-right")}>Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order?.items.map((item) => {
                  const dispatchNow = quantities[item.orderItemId] ?? 0;
                  const orderedQty = item.approvedQty;
                  const packedQty = item.approvedQty;
                  const dispatchedQty = item.invoicedQty;
                  const remainingAfterDispatch = Math.max(
                    0,
                    item.remainingQty - dispatchNow,
                  );
                  const disabled = item.remainingQty <= 0;
                  const unit = item.productSku || null;

                  return (
                    <tr key={item.orderItemId} className="hover:bg-muted/20">
                      <td className={cn(tdClass, "whitespace-normal font-medium text-foreground")}>
                        {item.productName}
                      </td>
                      <td className={cn(tdClass, "text-right text-muted-foreground")}>
                        {formatQty(orderedQty, unit)}
                      </td>
                      <td className={cn(tdClass, "text-right text-muted-foreground")}>
                        {formatQty(packedQty, unit)}
                      </td>
                      <td className={cn(tdClass, "text-right text-muted-foreground")}>
                        {formatQty(dispatchedQty, unit)}
                      </td>
                      <td className={cn(tdClass, "text-center")}>
                        <input
                          type="number"
                          min={0}
                          max={item.remainingQty}
                          value={dispatchNow}
                          disabled={disabled}
                          onChange={(event) =>
                            onQuantityChange(
                              item.orderItemId,
                              item.remainingQty,
                              Number(event.target.value),
                            )
                          }
                          className={cn(
                            "mx-auto h-7 w-14 rounded border bg-background px-1 text-center text-xs font-medium tabular-nums outline-none",
                            "focus:border-ring focus:ring-1 focus:ring-ring/20",
                            "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                          )}
                        />
                      </td>
                      <td
                        className={cn(
                          tdClass,
                          "text-right font-medium",
                          remainingAfterDispatch > 0
                            ? "text-amber-700"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatQty(remainingAfterDispatch, unit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Partial Invoice Total
            </p>
            <p className="mt-0.5 text-lg font-bold leading-none tabular-nums text-foreground">
              {formatMoney(selectedTotal)}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0 gap-1.5 self-end bg-violet-600 px-4 text-xs hover:bg-violet-700 sm:self-auto"
            disabled={
              !order ||
              actionLoading === `partial-${order.id}` ||
              selectedTotal <= 0
            }
            onClick={onCreate}
          >
            {order && actionLoading === `partial-${order.id}` ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            Create Partial Invoice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
