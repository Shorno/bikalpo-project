import { Card, CardContent } from "@/components/ui/card";
import { OrderActionButtons } from "./order-action-buttons";
import { OrderHeader } from "./order-header";
import { OrderInfo } from "./order-info";
import { OrderItemsList } from "./order-items-list";
import type { ActionType, DeliveryInvoiceWithDetails } from "./types";

interface OrderCardProps {
  item: DeliveryInvoiceWithDetails;
  canTakeAction: boolean;
  onAction: (invoiceId: number, type: ActionType) => void;
}

export function OrderCard({ item, canTakeAction, onAction }: OrderCardProps) {
  const isProcessed = item.status !== "pending";

  return (
    <Card className={`p-0 ${isProcessed ? "opacity-70 bg-muted/50" : ""}`}>
      <CardContent className="p-3 sm:p-4">
        <OrderHeader item={item} />
        <OrderInfo item={item} />
        <OrderItemsList items={item.invoice.items} />
        {!isProcessed && canTakeAction && (
          <OrderActionButtons
            onDelivered={() => onAction(item.id, "delivered")}
            onFailed={() => onAction(item.id, "failed")}
            onReturn={() => onAction(item.invoice.order?.id ?? 0, "return")}
          />
        )}
      </CardContent>
    </Card>
  );
}
