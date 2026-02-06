import { OrderCard } from "./order-card";
import type { ActionType, DeliveryInvoiceWithDetails } from "./types";

interface OrdersListProps {
  orders: DeliveryInvoiceWithDetails[];
  canTakeAction: boolean;
  onAction: (invoiceId: number, type: ActionType) => void;
}

export function OrdersList({
  orders,
  canTakeAction,
  onAction,
}: OrdersListProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {orders.map((item) => (
        <OrderCard
          key={item.id}
          item={item}
          canTakeAction={canTakeAction}
          onAction={onAction}
        />
      ))}
    </div>
  );
}
