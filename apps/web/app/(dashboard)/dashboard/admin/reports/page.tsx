import { Bike, CalendarCheck, Package, Users } from "lucide-react";
import { headers } from "next/headers";
import {
  getEmployeePerformanceReport,
  getTeamOverview,
} from "@/actions/reports/employee-reports";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";

export default async function ReportsPage() {
  const _session = await auth.api.getSession({
    headers: await headers(),
  });

  const [overviewResult, performanceResult] = await Promise.all([
    getTeamOverview(),
    getEmployeePerformanceReport(),
  ]);

  const overview = overviewResult.overview!;
  const reports = performanceResult.reports || [];

  const salesmen = reports.filter((r) => r.role === "salesman");
  const deliverymen = reports.filter((r) => r.role === "deliveryman");

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Reports & Analytics
          </h1>
          <p className="text-muted-foreground">
            Overview of team performance and daily activity.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Salesmen
            </CardTitle>
            <Users className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.salesmenCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Deliverymen
            </CardTitle>
            <Bike className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overview.deliverymenCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estimates Today
            </CardTitle>
            <CalendarCheck className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.todayEstimates}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Deliveries Today
            </CardTitle>
            <Package className="text-muted-foreground size-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.todayDeliveries}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="salesmen" className="space-y-4">
        <TabsList>
          <TabsTrigger value="salesmen">Salesmen Performance</TabsTrigger>
          <TabsTrigger value="deliverymen">Deliverymen Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="salesmen" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sales Metrics</CardTitle>
              <CardDescription>
                Performance based on estimate conversion and sales value.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Estimates</TableHead>
                    <TableHead>Converted</TableHead>
                    <TableHead>Conversion Rate</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesmen.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    salesmen.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{emp.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {emp.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{emp.totalEstimates}</TableCell>
                        <TableCell>{emp.convertedEstimates}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                (emp.conversionRate || 0) >= 50
                                  ? "text-green-600 font-medium"
                                  : (emp.conversionRate || 0) >= 30
                                    ? "text-yellow-600"
                                    : ""
                              }
                            >
                              {emp.conversionRate}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ৳{Number(emp.totalSalesValue).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliverymen" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Metrics</CardTitle>
              <CardDescription>
                Performance based on successful deliveries and efficiency.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Failed</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead className="text-right">Avg / Day</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliverymen.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    deliverymen.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{emp.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {emp.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{emp.totalDeliveries}</TableCell>
                        <TableCell className="text-green-600">
                          {emp.completedDeliveries}
                        </TableCell>
                        <TableCell className="text-red-600">
                          {emp.failedDeliveries}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (emp.successRate || 0) >= 95
                                ? "default"
                                : (emp.successRate || 0) >= 80
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {emp.successRate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {emp.avgDeliveriesPerDay}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
