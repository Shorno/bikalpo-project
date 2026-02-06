import Link from "next/link";
import { getEmployeeStats } from "@/actions/employee/get-employee-stats";
import { getUpcomingOrdersForSalesman } from "@/actions/order/salesman-order-actions";
import { EmployeeStats } from "@/components/employee/employee-stats";
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

export default async function EmployeeDashboard() {
  const [statsResult, upcomingResult] = await Promise.all([
    getEmployeeStats(),
    getUpcomingOrdersForSalesman(5),
  ]);

  if (!statsResult.success) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <p className="text-muted-foreground">Failed to load stats</p>
      </div>
    );
  }

  const stats = statsResult.stats;
  const upcoming = upcomingResult.success ? upcomingResult.orders : [];
  const isSalesman = stats?.role === "salesman";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <EmployeeStats stats={stats} />

      {isSalesman && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Order</CardTitle>
            <p className="text-sm text-muted-foreground">
              Orders from your customers that are confirmed or being packed.
            </p>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No upcoming orders.
              </p>
            ) : (
              <>
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
                    {upcoming.map((o, i) => (
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
                          <Badge variant="secondary">
                            {statusLabel(o.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`${SALES_BASE}/orders/${o.id}`}>
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-3">
                  <Button variant="link" className="h-auto p-0" asChild>
                    <Link href={`${SALES_BASE}/orders`}>
                      View All Deliveries
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
