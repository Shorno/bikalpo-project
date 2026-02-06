import { Badge } from "@/components/ui/badge";
import type { DeliveryInvoiceStatus } from "./types";

interface OrderStatusBadgeProps {
  status: DeliveryInvoiceStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const variant =
    status === "delivered"
      ? "default"
      : status === "failed"
        ? "destructive"
        : "secondary";

  return (
    <Badge variant={variant}>
      <span className="capitalize">{status}</span>
    </Badge>
  );
}
