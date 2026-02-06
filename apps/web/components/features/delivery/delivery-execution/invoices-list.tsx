import { InvoiceCard } from "./invoice-card";
import type { ActionType, DeliveryInvoiceWithDetails } from "./types";

interface InvoicesListProps {
  invoices: DeliveryInvoiceWithDetails[];
  canTakeAction: boolean;
  onAction: (invoiceId: number, type: ActionType) => void;
}

export function InvoicesList({
  invoices,
  canTakeAction,
  onAction,
}: InvoicesListProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {invoices.map((item) => (
        <InvoiceCard
          key={item.id}
          item={item}
          canTakeAction={canTakeAction}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
