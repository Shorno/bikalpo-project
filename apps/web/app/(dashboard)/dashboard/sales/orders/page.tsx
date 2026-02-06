import Link from "next/link";
import { getUpcomingOrdersForSalesman } from "@/actions/order/salesman-order-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SALES_BASE } from "@/lib/routes";

function formatDeliveryDate(d: Date) {
  const dt = new Date(d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  dt.setHours(0, 0, 0, 0);
  if (dt.getTime() === today.getTime()) return "Today";
  if (dt.getTime() === tomorrow.getTime()) return "Tomorrow";
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function statusLabel(s: string) {
  if (s === "processing") return "Packed";
  if (s === "confirmed") return "Pending";
  return s;
}

export default async function SalesOrdersPage() {
  const result = await getUpcomingOrdersForSalesman();
  const orders = result.success ? result.orders : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Upcoming Deliveries
        </h1>
        <p className="text-muted-foreground">
          Orders from your customers that are confirmed or being packed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Upcoming Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No upcoming orders.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o, i) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {o.orderNumber}
                    </TableCell>
                    <TableCell>
                      {o.user?.shopName || o.user?.name || "—"}
                    </TableCell>
                    <TableCell>
                      {formatDeliveryDate(
                        o.confirmedAt
                          ? new Date(o.confirmedAt)
                          : new Date(o.createdAt),
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{statusLabel(o.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`${SALES_BASE}/orders/${o.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
