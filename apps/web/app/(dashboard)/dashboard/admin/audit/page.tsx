"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  exportAuditActivities,
  getAuditActivities,
} from "@/actions/admin/audit-actions";
import ActivityDetailsModal from "@/components/admin/audit/activity-details-modal";
import { useAuditColumns } from "@/components/admin/audit/audit-columns";
import AuditTable from "@/components/admin/audit/audit-table";
import TableSkeleton from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ActionType,
  AuditActivity,
  ModuleType,
  UserRole,
} from "@/types/audit";

export default function AuditLogPage() {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Filter states
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [userRole, setUserRole] = useState<UserRole | "all">("all");
  const [actionType, setActionType] = useState<ActionType | "all">("all");
  const [module, setModule] = useState<ModuleType | "all">("all");
  const [search, setSearch] = useState("");

  // Set default date range (last 7 days)
  useState(() => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    setDateFrom(lastWeek.toISOString().split("T")[0]);
    setDateTo(today.toISOString().split("T")[0]);
  });

  const handleViewDetails = useCallback((activity: AuditActivity) => {
    setSelectedLogId(activity.logId);
    setDetailsModalOpen(true);
  }, []);

  const columns = useAuditColumns({ onViewDetails: handleViewDetails });

  // Build filters object
  const filters = {
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    userRole: userRole !== "all" ? userRole : undefined,
    actionType: actionType !== "all" ? actionType : undefined,
    module: module !== "all" ? module : undefined,
    search: search || undefined,
  };

  const {
    data: result,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["audit-activities", filters],
    queryFn: () => getAuditActivities(filters),
  });

  const activities = result?.activities || [];
  const total = result?.total || 0;

  const handleExport = async () => {
    toast.loading("Exporting audit activities...");
    try {
      const exportResult = await exportAuditActivities(filters);

      if (exportResult.success && exportResult.csv) {
        const blob = new Blob([exportResult.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Audit activities exported successfully");
      } else {
        toast.error(exportResult.error || "Failed to export activities");
      }
    } catch (_error) {
      toast.error("An error occurred during export");
    }
  };

  const handleRefresh = () => {
    refetch();
    toast.success("Activities refreshed");
  };

  const handleResetFilters = () => {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);
    setDateFrom(lastWeek.toISOString().split("T")[0]);
    setDateTo(today.toISOString().split("T")[0]);
    setUserRole("all");
    setActionType("all");
    setModule("all");
    setSearch("");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Audit Log / System Activity</h1>
            <p className="text-muted-foreground mt-1">
              Track all user actions and system usage across the platform
            </p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date From */}
            <div className="space-y-2">
              <Label htmlFor="dateFrom" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                From
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label htmlFor="dateTo" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                To
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* User Role */}
            <div className="space-y-2">
              <Label htmlFor="userRole">User Role</Label>
              <Select
                value={userRole}
                onValueChange={(value) =>
                  setUserRole(value as UserRole | "all")
                }
              >
                <SelectTrigger id="userRole">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="shop_owner">Shop Owner</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Type */}
            <div className="space-y-2">
              <Label htmlFor="actionType">Action Type</Label>
              <Select
                value={actionType}
                onValueChange={(value) =>
                  setActionType(value as ActionType | "all")
                }
              >
                <SelectTrigger id="actionType">
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                  <SelectItem value="reject">Reject</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Module */}
            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <Select
                value={module}
                onValueChange={(value) =>
                  setModule(value as ModuleType | "all")
                }
              >
                <SelectTrigger id="module">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="products">Products</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="settings">Settings</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="estimate">Estimate</SelectItem>
                  <SelectItem value="returns">Returns</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="search" className="flex items-center gap-1">
                <Search className="h-3 w-3" />
                Search
              </Label>
              <Input
                id="search"
                type="text"
                placeholder="User name, email, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 md:col-span-1">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResetFilters}
              >
                Reset Filters
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {activities.length} of {total} activities
        </p>
      </div>

      {/* Audit Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : (
        <AuditTable columns={columns} data={activities} />
      )}

      {/* Activity Details Modal */}
      <ActivityDetailsModal
        logId={selectedLogId}
        open={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedLogId(null);
        }}
      />
    </div>
  );
}
