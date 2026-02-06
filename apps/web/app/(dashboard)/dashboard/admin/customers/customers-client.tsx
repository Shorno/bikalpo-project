"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CalendarIcon,
  Check,
  Clock,
  Loader2,
  Search,
  ShoppingBag,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  approveCustomer,
  type CustomerFilters,
  getCustomerStats,
  getCustomersList,
  getPendingCustomers,
  type PendingCustomer,
  rejectCustomer,
} from "@/actions/customers/customer-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { customerColumns } from "./customer-columns";

export function CustomersClient() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("active");
  const [filters, setFilters] = useState<CustomerFilters>({
    page: 1,
    pageSize: 10,
  });
  const [searchInput, setSearchInput] = useState("");

  // Fetch customers list
  const { data: customersResult, isLoading: customersLoading } = useQuery({
    queryKey: ["customers-list", filters],
    queryFn: () => getCustomersList(filters),
  });

  // Fetch stats
  const { data: statsResult, isLoading: statsLoading } = useQuery({
    queryKey: ["customer-stats"],
    queryFn: getCustomerStats,
  });

  // Fetch pending customers
  const { data: pendingResult, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-customers"],
    queryFn: getPendingCustomers,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: approveCustomer,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Customer approved");
        queryClient.invalidateQueries({ queryKey: ["pending-customers"] });
        queryClient.invalidateQueries({ queryKey: ["customers-list"] });
        queryClient.invalidateQueries({ queryKey: ["customer-stats"] });
      } else {
        toast.error(result.error || "Failed to approve");
      }
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: rejectCustomer,
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Customer rejected");
        queryClient.invalidateQueries({ queryKey: ["pending-customers"] });
      } else {
        toast.error(result.error || "Failed to reject");
      }
    },
  });

  const customers =
    customersResult?.success && customersResult.data
      ? customersResult.data
      : [];
  const pagination = customersResult?.success
    ? customersResult.pagination
    : null;
  const stats = statsResult?.success ? statsResult.stats : null;
  const pendingCustomers = pendingResult?.success ? pendingResult.data : [];

  // TanStack Table
  const table = useReactTable({
    data: customers,
    columns: customerColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Handle search
  const handleSearch = () => {
    setFilters({ ...filters, search: searchInput || undefined, page: 1 });
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            View and manage your customers
          </p>
        </div>
        {pendingCustomers.length > 0 && (
          <Badge
            variant="secondary"
            className="text-yellow-600 border-yellow-600"
          >
            <Clock className="mr-1 size-3" />
            {pendingCustomers.length} pending
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            <Users className="mr-2 size-4" />
            Active Customers ({stats?.totalCustomers || 0})
          </TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            <Clock className="mr-2 size-4" />
            Pending Approval
            {pendingCustomers.length > 0 && (
              <span className="ml-2 rounded-full bg-yellow-500 px-2 py-0.5 text-xs text-white">
                {pendingCustomers.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="mt-4">
          {pendingLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : pendingCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
              <Check className="size-10 text-green-500 mb-3" />
              <p className="text-muted-foreground">No pending approvals</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Shop</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCustomers.map((customer: PendingCustomer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{customer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {customer.ownerName || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{customer.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {customer.phoneNumber || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{customer.shopName || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(customer.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => approveMutation.mutate(customer.id)}
                            disabled={
                              approveMutation.isPending ||
                              rejectMutation.isPending
                            }
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => rejectMutation.mutate(customer.id)}
                            disabled={
                              approveMutation.isPending ||
                              rejectMutation.isPending
                            }
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Active Customers Tab */}
        <TabsContent value="active" className="mt-4 space-y-4">
          {/* Stats Cards */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Customers
                </CardTitle>
                <Users className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    stats?.totalCustomers || 0
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  New This Month
                </CardTitle>
                <UserPlus className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    stats?.newThisMonth || 0
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Customers
                </CardTitle>
                <ShoppingBag className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? (
                    <span className="animate-pulse">...</span>
                  ) : (
                    stats?.activeCustomers || 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground">With orders</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Search by name, shop, email, phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="max-w-md"
              />
              <Button onClick={handleSearch} variant="secondary">
                <Search className="size-4" />
              </Button>
            </div>

            {/* Date Filters */}
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !filters.startDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {filters.startDate
                      ? format(filters.startDate, "dd MMM")
                      : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
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

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[140px] justify-start text-left font-normal",
                      !filters.endDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {filters.endDate ? format(filters.endDate, "dd MMM") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
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

              {(filters.search || filters.startDate || filters.endDate) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearchInput("");
                    setFilters({ page: 1, pageSize: 10 });
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Customers Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {customersLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={customerColumns.length}>
                        <div className="h-6 bg-muted animate-pulse rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={customerColumns.length}
                      className="h-24 text-center"
                    >
                      No customers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
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
                    setFilters({
                      ...filters,
                      page: (filters.page || 1) - 1,
                    })
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      page: (filters.page || 1) + 1,
                    })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
