import { InvoiceStatusBadge } from "./invoice-status-badge";
import type { DeliveryInvoiceWithDetails } from "./types";

interface InvoiceHeaderProps {
  item: DeliveryInvoiceWithDetails;
}

export function InvoiceHeader({ item }: InvoiceHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-3 sm:mb-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-primary/10 text-primary text-[10px] sm:text-sm font-bold shrink-0">
          {item.sequence}
        </div>
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-medium truncate">
            {item.invoice.invoiceNumber}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
            {item.invoice.customer?.name}
          </div>
        </div>
      </div>
      <InvoiceStatusBadge status={item.status} />
    </div>
  );
}
