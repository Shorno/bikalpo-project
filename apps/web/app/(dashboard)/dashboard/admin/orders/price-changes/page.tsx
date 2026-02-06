import { format } from "date-fns";
import Link from "next/link";
import { getOrdersWithPriceChange } from "@/actions/order/admin-order-actions";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";

function formatPrice(price: string | number) {
  return `৳${Number(price).toLocaleString()}`;
}

export default async function PriceChangedOrdersPage() {
  const result = await getOrdersWithPriceChange();

  if (!result.success) {
    return (
      <div className="p-6">
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  const orders = result.orders ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Price-changed orders</h1>
          <p className="text-muted-foreground mt-1">
            Pending orders where admin updated the total (customer sees new
            price)
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`${ADMIN_BASE}/orders`}>Back to Orders</Link>
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No pending orders with price changes.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Order</th>
                <th className="text-left p-3 font-medium">Customer</th>
                <th className="text-right p-3 font-medium">Previous total</th>
                <th className="text-right p-3 font-medium">New total</th>
                <th className="text-left p-3 font-medium">Changed at</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="p-3 font-medium">{o.orderNumber}</td>
                  <td className="p-3">
                    {o.user?.name ?? o.user?.email ?? "—"}
                  </td>
                  <td className="p-3 text-right">
                    {o.previousTotal != null
                      ? formatPrice(o.previousTotal)
                      : "—"}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {formatPrice(o.total)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {o.totalPriceChangedAt
                      ? format(
                          new Date(o.totalPriceChangedAt),
                          "MMM d, yyyy HH:mm",
                        )
                      : "—"}
                  </td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`${ADMIN_BASE}/orders/${o.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
