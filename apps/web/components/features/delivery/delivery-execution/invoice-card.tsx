import { Card, CardContent } from "@/components/ui/card";
import { InvoiceActionButtons } from "./invoice-action-buttons";
import { InvoiceHeader } from "./invoice-header";
import { InvoiceInfo } from "./invoice-info";
import { InvoiceItemsList } from "./invoice-items-list";
import type { ActionType, DeliveryInvoiceWithDetails } from "./types";

interface InvoiceCardProps {
  item: DeliveryInvoiceWithDetails;
  canTakeAction: boolean;
  onAction: (invoiceId: number, type: ActionType) => void;
}

export function InvoiceCard({
  item,
  canTakeAction,
  onAction,
}: InvoiceCardProps) {
  const isProcessed = item.status !== "pending";

  return (
    <Card className={`p-0 ${isProcessed ? "opacity-70 bg-muted/50" : ""}`}>
      <CardContent className="p-3 sm:p-4">
        <InvoiceHeader item={item} />
        <InvoiceInfo item={item} />
        <InvoiceItemsList items={item.invoice.items} />
        {!isProcessed && canTakeAction && (
          <InvoiceActionButtons
            onDelivered={() => onAction(item.id, "delivered")}
            onFailed={() => onAction(item.id, "failed")}
            onReturn={() => onAction(item.invoice.order?.id ?? 0, "return")}
          />
        )}
      </CardContent>
    </Card>
  );
}
