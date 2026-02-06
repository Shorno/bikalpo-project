import { getMyOrders } from "@/actions/order/order-actions";
import { OrderTabs } from "@/components/account/order-tabs";

export default async function AccountOrdersPage() {
  const { orders } = await getMyOrders();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Track and manage your orders
        </p>
      </div>

      <OrderTabs orders={orders || []} />
    </div>
  );
}
