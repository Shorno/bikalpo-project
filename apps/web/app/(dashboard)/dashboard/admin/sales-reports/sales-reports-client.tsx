"use client";

import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  CalendarIcon,
  Download,
  FileText,
  IndianRupee,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getCustomersForFilter,
  getSalesByEmployee,
  getSalesmenForFilter,
  getSalesReportData,
  getSalesReportSummary,
  getSalesTrendData,
  type SalesReportFilters,
} from "@/actions/reports/sales-reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function SalesReportsClient() {
  const [filters, setFilters] = useState<SalesReportFilters>({
    startDate: subMonths(new Date(), 1),
    endDate: new Date(),
    page: 1,
    pageSize: 10,
  });

  // Fetch summary data
  const { data: summaryResult, isLoading: summaryLoading } = useQuery({
    queryKey: [
      "sales-report-summary",
      filters.startDate,
      filters.endDate,
      filters.customerId,
    ],
    queryFn: () => getSalesReportSummary(filters),
  });

  // Fetch table data
  const { data: tableResult, isLoading: tableLoading } = useQuery({
    queryKey: ["sales-report-data", filters],
    queryFn: () => getSalesReportData(filters),
  });

  // Fetch trend data
  const { data: trendResult } = useQuery({
    queryKey: ["sales-trend-data", filters.startDate, filters.endDate],
    queryFn: () =>
      getSalesTrendData({
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
  });

  // Fetch filter options
  const { data: customersResult } = useQuery({
    queryKey: ["customers-for-filter"],
    queryFn: getCustomersForFilter,
  });

  // Fetch salesmen for filter
  const { data: salesmenResult } = useQuery({
    queryKey: ["salesmen-for-filter"],
    queryFn: getSalesmenForFilter,
  });

  // Fetch sales by employee data
  const { data: salesByEmployeeResult } = useQuery({
    queryKey: ["sales-by-employee", filters.startDate, filters.endDate],
    queryFn: () =>
      getSalesByEmployee({
        startDate: filters.startDate,
        endDate: filters.endDate,
      }),
  });

  const summary = summaryResult?.success ? summaryResult.summary : null;
  const tableData =
    tableResult?.success && tableResult.data ? tableResult.data : [];
  const pagination = tableResult?.success ? tableResult.pagination : null;
  const trendData =
    trendResult?.success && trendResult.data ? trendResult.data : [];
  const customers =
    customersResult?.success && customersResult.data
      ? customersResult.data
      : [];
  const salesmen =
    salesmenResult?.success && salesmenResult.data ? salesmenResult.data : [];
  const salesByEmployee =
    salesByEmployeeResult?.success && salesByEmployeeResult.data
      ? salesByEmployeeResult.data
      : [];

  // Export to CSV
  const handleExportCSV = () => {
    if (!tableData || tableData.length === 0) return;

    const headers = [
      "Invoice ID",
      "Customer",
      "Shop",
      "Date",
      "Delivery Status",
      "Payment",
      "Amount",
    ];
    const rows = tableData.map((item) => [
      item.invoiceNumber,
      item.customerName,
      item.shopName || "",
      format(new Date(item.date), "dd/MM/yyyy"),
      item.deliveryStatus,
      item.paymentStatus,
      item.grandTotal.toString(),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Reports</h1>
          <p className="text-muted-foreground">
            View invoice and sales analytics
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          variant="outline"
          className="w-full sm:w-auto"
        >
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Date Range - Start */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !filters.startDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {filters.startDate
                    ? format(filters.startDate, "PPP")
                    : "Start Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.startDate}
                  onSelect={(date) =>
                    setFilters({ ...filters, startDate: date, page: 1 })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Date Range - End */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !filters.endDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {filters.endDate
                    ? format(filters.endDate, "PPP")
                    : "End Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filters.endDate}
                  onSelect={(date) =>
                    setFilters({ ...filters, endDate: date, page: 1 })
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Customer Filter */}
            <Select
              value={filters.customerId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  customerId: value === "all" ? undefined : value,
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                {customers?.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.shopName || customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Delivery Status Filter */}
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  status: value === "all" ? undefined : value,
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Delivery" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Delivery</SelectItem>
                <SelectItem value="not_assigned">Not Assigned</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="out_for_delivery">
                  Out for Delivery
                </SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Salesman Filter */}
            <Select
              value={filters.salesmanId || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  salesmanId: value === "all" ? undefined : value,
                  page: 1,
                })
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Salesmen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Salesmen</SelectItem>
                {salesmen?.map((salesman) => (
                  <SelectItem key={salesman.id} value={salesman.id}>
                    {salesman.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            <Button
              variant="ghost"
              onClick={() =>
                setFilters({
                  startDate: subMonths(new Date(), 1),
                  endDate: new Date(),
                  page: 1,
                  pageSize: 10,
                })
              }
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sales
            </CardTitle>
            <IndianRupee className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {summaryLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                `৳${(summary?.totalSales || 0).toLocaleString()}`
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              revenue generated
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
            <ShoppingCart className="size-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summaryLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                summary?.totalOrders || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              total processed
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
            <Users className="size-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {summaryLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                summary?.totalCustomers || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">unique buyers</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Invoices
            </CardTitle>
            <FileText className="size-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {summaryLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                summary?.totalInvoices || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              invoices created
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `৳${value.toLocaleString()}`,
                      "Sales",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalSales"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="orderCount"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales by Salesman Chart */}
      {salesByEmployee.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sales by Salesman</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByEmployee} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    type="number"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `৳${(value / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="employeeName"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `৳${value.toLocaleString()}`,
                      "Sales",
                    ]}
                  />
                  <Bar
                    dataKey="totalSales"
                    fill="hsl(var(--chart-2))"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Details Section - No Card Wrapper */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Invoice Details</h2>
        </div>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-6 bg-muted animate-pulse rounded" />
                    </TableCell>
                  </TableRow>
                ))
              ) : tableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                tableData.map((item) => (
                  <TableRow key={item.invoiceId}>
                    <TableCell className="font-medium">
                      {item.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{item.customerName}</span>
                        {item.shopName && (
                          <span className="text-xs text-muted-foreground">
                            {item.shopName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(item.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.deliveryStatus === "delivered"
                            ? "default"
                            : item.deliveryStatus === "out_for_delivery"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {item.deliveryStatus.replace("_", " ").toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.paymentStatus === "collected"
                            ? "default"
                            : item.paymentStatus === "settled"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {item.paymentStatus.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ৳{item.grandTotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.totalCount,
              )}{" "}
              of {pagination.totalCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page || 1) - 1 })
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setFilters({ ...filters, page: (filters.page || 1) + 1 })
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
