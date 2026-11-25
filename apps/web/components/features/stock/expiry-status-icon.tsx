"use client";

import { CircleX, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPIRY_STATUS_LABELS, type ExpiryStatus } from "./expiry-stock-model";

export type SaveExpiryAlertDays = (input: {
  productId: number;
  alertDays: number;
}) => Promise<unknown>;

const STATUS_STYLE: Record<
  Exclude<ExpiryStatus, "ok">,
  { icon: typeof CircleX; className: string }
> = {
  expired: { icon: CircleX, className: "text-red-600 dark:text-red-400" },
  expiring: {
    icon: TriangleAlert,
    className: "text-amber-500 dark:text-amber-400",
  },
};

/** Red ✕ once expired, ⚠ while expiring (client mockup). */
export function ExpiryStatusIcon({
  status,
  className,
}: {
  status: ExpiryStatus;
  className?: string;
}) {
  if (status === "ok") return null;
  const { icon: Icon, className: color } = STATUS_STYLE[status];
  const label = EXPIRY_STATUS_LABELS[status];
  return (
    <span title={label} className="inline-flex shrink-0">
      <Icon aria-hidden="true" className={cn("size-5", color, className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

