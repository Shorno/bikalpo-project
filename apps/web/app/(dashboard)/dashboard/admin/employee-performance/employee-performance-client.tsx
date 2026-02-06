"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Bike,
  CalendarIcon,
  CheckCircle,
  ClipboardList,
  Download,
  Package,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { getEmployeePerformanceReport } from "@/actions/reports/employee-reports";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { EmployeeTable } from "./employee-table";
import { PerformanceCharts } from "./performance-charts";

export function EmployeePerformanceClient() {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [activeTab, setActiveTab] = useState<"deliveryman" | "salesman">(
    "deliveryman",
  );

  // Fetch deliveryman performance data
  const {
    data: deliverymenData,
    isLoading: loadingDeliverymen,
    refetch: refetchDeliverymen,
  } = useQuery({
    queryKey: ["employee-performance", "deliveryman", startDate, endDate],
    queryFn: async () => {
      const result = await getEmployeePerformanceReport({
        role: "deliveryman",
        startDate,
        endDate,
      });
      return result.success ? result.reports || [] : [];
    },
  });

  // Fetch salesman performance data
  const {
    data: salesmenData,
    isLoading: loadingSalesmen,
    refetch: refetchSalesmen,
  } = useQuery({
    queryKey: ["employee-performance", "salesman", startDate, endDate],
    queryFn: async () => {
      const result = await getEmployeePerformanceReport({
        role: "salesman",
        startDate,
        endDate,
      });
      return result.success ? result.reports || [] : [];
    },
  });

  const deliverymen = deliverymenData || [];
  const salesmen = salesmenData || [];

  const handleRefresh = () => {
    if (activeTab === "deliveryman") {
      refetchDeliverymen();
    } else {
      refetchSalesmen();
    }
  };

  const handleExport = () => {
    const employees = activeTab === "deliveryman" ? deliverymen : salesmen;
    const headers =
      activeTab === "deliveryman"
        ? ["Name", "Total Deliveries", "Completed", "Failed", "Success Rate"]
        : [
            "Name",
            "Total Estimates",
            "Approved",
            "Converted",
            "Conv Rate",
            "Sales Value",
          ];

    const rows = employees.map((emp) =>
      activeTab === "deliveryman"
        ? [
            emp.name,
            emp.totalDeliveries || 0,
            emp.completedDeliveries || 0,
            emp.failedDeliveries || 0,
            `${emp.successRate || 0}%`,
          ]
        : [
            emp.name,
            emp.totalEstimates || 0,
            emp.approvedEstimates || 0,
            emp.convertedEstimates || 0,
            `${emp.conversionRate || 0}%`,
            emp.totalSalesValue || 0,
          ],
    );

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab}-performance-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  // Deliveryman metrics
  const totalDeliveries = deliverymen.reduce(
    (sum, emp) => sum + (emp.totalDeliveries || 0),
    0,
  );
  const completedDeliveries = deliverymen.reduce(
    (sum, emp) => sum + (emp.completedDeliveries || 0),
    0,
  );
  const failedDeliveries = deliverymen.reduce(
    (sum, emp) => sum + (emp.failedDeliveries || 0),
    0,
  );
  const deliverySuccessRate =
    totalDeliveries > 0
      ? Math.round((completedDeliveries / totalDeliveries) * 100)
      : 0;

  // Salesman metrics
  const totalEstimates = salesmen.reduce(
    (sum, emp) => sum + (emp.totalEstimates || 0),
    0,
  );
  const approvedEstimates = salesmen.reduce(
    (sum, emp) => sum + (emp.approvedEstimates || 0),
    0,
  );
  const convertedEstimates = salesmen.reduce(
    (sum, emp) => sum + (emp.convertedEstimates || 0),
    0,
  );
  const totalSalesValue = salesmen.reduce(
    (sum, emp) => sum + (emp.totalSalesValue || 0),
    0,
  );
  const conversionRate =
    totalEstimates > 0
      ? Math.round((convertedEstimates / totalEstimates) * 100)
      : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date Filter Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Date Range */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[150px] justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "MMM d, yyyy")
                      : "Start Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground text-center hidden sm:block">
                to
              </span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-[150px] justify-start text-left font-normal",
                      !endDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "MMM d, yyyy") : "End Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as "deliveryman" | "salesman")
        }
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="deliveryman" className="gap-2">
            <Bike className="h-4 w-4" />
            <span className="hidden sm:inline">Deliverymen</span>
            <span className="sm:hidden">Delivery</span>
          </TabsTrigger>
          <TabsTrigger value="salesman" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Salesmen</span>
            <span className="sm:hidden">Sales</span>
          </TabsTrigger>
        </TabsList>

        {/* Deliveryman Tab */}
        <TabsContent value="deliveryman" className="space-y-4">
          {/* Deliveryman Stats Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Deliveries
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalDeliveries}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  by {deliverymen.length} deliverymen
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Successful
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {completedDeliveries}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {deliverySuccessRate}% success rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {failedDeliveries}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  need re-delivery
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Returns</CardTitle>
                <RotateCcw className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {failedDeliveries}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  processed returns
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Deliveryman Charts */}
          <PerformanceCharts employees={deliverymen} roleFilter="deliveryman" />

          {/* Deliveryman Table */}
          {/** biome-ignore lint/a11y/useValidAriaRole: *working */}
          <EmployeeTable
            employees={deliverymen}
            loading={loadingDeliverymen}
            role="deliveryman"
          />
        </TabsContent>

        {/* Salesman Tab */}
        <TabsContent value="salesman" className="space-y-4">
          {/* Salesman Stats Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Estimates
                </CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalEstimates}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  by {salesmen.length} salesmen
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Approved</CardTitle>
                <CheckCircle className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {approvedEstimates}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  awaiting conversion
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Converted</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {convertedEstimates}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {conversionRate}% conversion rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Sales Value
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ৳{totalSalesValue.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  total revenue
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Salesman Charts */}
          <PerformanceCharts employees={salesmen} roleFilter="salesman" />

          {/* Salesman Table */}
          {/** biome-ignore lint/a11y/useValidAriaRole: <works> */}
          <EmployeeTable
            employees={salesmen}
            loading={loadingSalesmen}
            role="salesman"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
