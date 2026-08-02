import { Badge } from "@/components/ui/badge";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import type { DeliveryInvoiceWithDetails } from "./types";

interface InvoiceHeaderProps {
  item: DeliveryInvoiceWithDetails;
}

export function InvoiceHeader({ item }: InvoiceHeaderProps) {
  const orderNumber = item.invoice.order?.orderNumber;
  const isSplit = item.invoice.invoiceType === "split";

  return (
    <div className="flex items-start justify-between mb-3 sm:mb-4 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary/10 text-primary text-[10px] sm:text-sm font-bold shrink-0">
          {item.sequence}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-sm sm:text-base font-medium font-mono truncate">
              {orderNumber ?? item.invoice.invoiceNumber}
            </div>
            {isSplit ? (
              <Badge
                variant="outline"
                className="text-[10px] shrink-0 text-amber-700 bg-amber-50 border-amber-200"
              >
                Partial delivery
                {item.invoice.splitSequence
                  ? ` · Part ${item.invoice.splitSequence}`
                  : ""}
              </Badge>
            ) : null}
          </div>
          {orderNumber ? (
            <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
              Invoice: {item.invoice.invoiceNumber}
            </div>
          ) : null}
          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
            Delivery Recipient: {item.invoice.recipient.displayName}
          </div>
        </div>
      </div>
      <InvoiceStatusBadge status={item.status} />
    </div>
  );
}
