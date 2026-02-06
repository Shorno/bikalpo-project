import { Badge } from "@/components/ui/badge";
import type { DeliveryInvoiceStatus } from "./types";

const statusConfig: Record<
  DeliveryInvoiceStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Pending", variant: "outline" },
  delivered: { label: "Delivered", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

interface InvoiceStatusBadgeProps {
  status: DeliveryInvoiceStatus;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <Badge variant={config.variant} className="text-[10px] sm:text-xs shrink-0">
      {config.label}
    </Badge>
  );
}
