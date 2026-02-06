import Link from "next/link";
import OrderList from "@/components/features/orders/order-list";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";

export default function OrdersPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Orders</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track all customer orders
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`${ADMIN_BASE}/orders/price-changes`}>
            Price-changed orders
          </Link>
        </Button>
      </div>

      <OrderList />
    </div>
  );
}
