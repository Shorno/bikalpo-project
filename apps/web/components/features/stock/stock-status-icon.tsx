import {
  CircleAlert,
  CircleCheck,
  CircleX,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STOCK_STATUS_LABELS, type StockStatus } from "./realtime-stock-model";

const STATUS_STYLE: Record<
  StockStatus,
  { icon: LucideIcon; className: string; badge: string }
> = {
  in_stock: {
    icon: CircleCheck,
    className: "text-emerald-600 dark:text-emerald-400",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  low_stock: {
    icon: CircleAlert,
    className: "text-amber-500 dark:text-amber-400",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  out_of_stock: {
    icon: CircleX,
    className: "text-red-600 dark:text-red-400",
    badge:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
  },
  expired: {
    icon: TriangleAlert,
    className: "text-orange-600 dark:text-orange-400",
    badge:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300",
  },
};

/** Green tick, yellow alert, red cross or ⚠ expired, labelled for screen readers. */
export function StockStatusIcon({
  status,
  className,
}: {
  status: StockStatus;
  className?: string;
}) {
  const { icon: Icon, className: color } = STATUS_STYLE[status];
  const label = STOCK_STATUS_LABELS[status];
  return (
    <span title={label} className="inline-flex shrink-0">
      <Icon aria-hidden="true" className={cn("size-5", color, className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** The status as a labelled pill, for the product stock page. */
export function StockStatusBadge({ status }: { status: StockStatus }) {
  const { icon: Icon, badge } = STATUS_STYLE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        badge,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {STOCK_STATUS_LABELS[status]}
    </span>
  );
}
