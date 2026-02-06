import { Badge } from "@/components/ui/badge";
import type {
  InvoiceDeliveryStatus,
  InvoicePaymentStatus,
} from "@/db/schema/invoice";

interface InvoicePaymentBadgeProps {
  status: InvoicePaymentStatus;
}

interface InvoiceDeliveryBadgeProps {
  status: InvoiceDeliveryStatus;
}

const paymentConfig: Record<
  InvoicePaymentStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  unpaid: { label: "Unpaid", variant: "destructive" },
  collected: { label: "Collected", variant: "default" },
  settled: { label: "Settled", variant: "outline" },
};

const deliveryConfig: Record<
  InvoiceDeliveryStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  not_assigned: { label: "Not Assigned", variant: "outline" },
  pending: { label: "Pending", variant: "secondary" },
  out_for_delivery: { label: "Out for Delivery", variant: "default" },
  delivered: { label: "Delivered", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export function InvoicePaymentBadge({ status }: InvoicePaymentBadgeProps) {
  const config = paymentConfig[status];
  return (
    <Badge variant={config.variant} className="uppercase">
      {config.label}
    </Badge>
  );
}

export function InvoiceDeliveryBadge({ status }: InvoiceDeliveryBadgeProps) {
  const config = deliveryConfig[status];
  return (
    <Badge variant={config.variant} className="uppercase">
      {config.label}
    </Badge>
  );
}
