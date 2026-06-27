"use client";

import { cn } from "@/lib/utils";

export type DispatchItemRow = {
  orderItemId: number;
  productName: string;
  productSku: string;
  approvedQty: number;
  invoicedQty: number;
  remainingQty: number;
  unitPrice: string;
};

type DispatchItemTableProps = {
  items: DispatchItemRow[];
  quantities: Record<number, number>;
  readOnly?: boolean;
  onQuantityChange?: (
    orderItemId: number,
    remainingQty: number,
    nextQuantity: number,
  ) => void;
};

function formatQty(qty: number, unit?: string | null) {
  if (!unit) return String(qty);
  return `${qty} ${unit}`;
}

const thClass =
  "h-9 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const tdClass = "px-3 py-2.5 align-middle text-xs tabular-nums";

export function DispatchItemTable({
  items,
  quantities,
  readOnly = false,
  onQuantityChange,
}: DispatchItemTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full table-fixed text-xs">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className={cn(thClass, "w-[30%]")}>Product</th>
            <th className={cn(thClass, "text-right")}>Ordered</th>
            <th className={cn(thClass, "text-right")}>Dispatched</th>
            <th className={cn(thClass, "text-center")}>Dispatch Now</th>
            <th className={cn(thClass, "text-right")}>Remaining</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => {
            const dispatchNow = quantities[item.orderItemId] ?? 0;
            const remainingAfterDispatch = Math.max(
              0,
              item.remainingQty - dispatchNow,
            );
            const disabled = item.remainingQty <= 0;
            const unit = item.productSku || null;

            return (
              <tr key={item.orderItemId} className="hover:bg-muted/20">
                <td
                  className={cn(
                    tdClass,
                    "whitespace-normal font-medium text-foreground",
                  )}
                >
                  {item.productName}
                </td>
                <td className={cn(tdClass, "text-right text-muted-foreground")}>
                  {formatQty(item.approvedQty, unit)}
                </td>
                <td className={cn(tdClass, "text-right text-muted-foreground")}>
                  {formatQty(item.invoicedQty, unit)}
                </td>
                <td className={cn(tdClass, "text-center")}>
                  {readOnly ? (
                    <span className="font-medium">{formatQty(dispatchNow, unit)}</span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={item.remainingQty}
                      value={dispatchNow}
                      disabled={disabled}
                      onChange={(event) =>
                        onQuantityChange?.(
                          item.orderItemId,
                          item.remainingQty,
                          Number(event.target.value),
                        )
                      }
                      className={cn(
                        "mx-auto h-8 w-14 rounded border bg-background px-1 text-center text-xs font-medium tabular-nums outline-none",
                        "focus:border-ring focus:ring-1 focus:ring-ring/20",
                        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
                      )}
                    />
                  )}
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
  );
}
