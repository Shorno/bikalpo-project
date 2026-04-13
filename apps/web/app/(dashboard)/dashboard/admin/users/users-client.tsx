"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Ban,
  Eye,
  Loader2,
  Search,
  ShieldCheck,
  Store,
  Users,
  Users2,
  Warehouse,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

type StatusFilter = "all" | "active" | "suspended";

interface UserListClientProps {
  role: "warehouse" | "shop_owner";
  title: string;
  description: string;
}

export function UserListClient({ role, title, description }: UserListClientProps) {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  // Fetch users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    ...orpc.adminUserManagement.list.queryOptions({
      input: {
        role,
        status: statusFilter,
        search: searchQuery || undefined,
        page,
        pageSize: 20,
      },
    }),
  });

  // Fetch stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    ...orpc.adminUserManagement.getStats.queryOptions({
      input: { role },
    }),
  });

  const users = usersData?.users ?? [];
  const pagination = usersData?.pagination;
  const stats = statsData?.stats;

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1);
  };

  const isWarehouse = role === "warehouse";

  const getStatusBadge = (banned: boolean | null) => {
    if (banned) {
      return (
        <Badge variant="destructive" className="gap-1">
          <Ban className="size-3" />
          Suspended
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <ShieldCheck className="size-3" />
        Active
      </Badge>
    );
  };

  const getDisplayName = (u: (typeof users)[0]) => {
    if (u.role === "warehouse") {
      return {
        primary: u.warehouseName || u.name,
        secondary: u.ownerName || u.name,
      };
    }
    return {
      primary: u.shopName || u.name,
      secondary: u.ownerName || u.name,
    };
  };

  const getLocation = (u: (typeof users)[0]) => {
    if (u.role === "warehouse") return u.warehouseAddress || "—";
    return u.shopAddress || "—";
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total {isWarehouse ? "Wholesalers" : "Retailers"}
            </CardTitle>
            <Users2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                stats?.total || 0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <ShieldCheck className="size-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                stats?.active || 0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspended</CardTitle>
            <Ban className="size-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? (
                <span className="animate-pulse">...</span>
              ) : (
                stats?.suspended || 0
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New This Month</CardTitle>
            <Users className="size-4 text-blue-500" />
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
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Search by name, phone, email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="max-w-md"
          />
          <Button onClick={handleSearch} variant="secondary">
            <Search className="size-4" />
          </Button>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val as StatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        {(searchQuery || statusFilter !== "all") && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearchInput("");
              setSearchQuery("");
              setStatusFilter("all");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Users Table */}
      {usersLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
          {isWarehouse ? (
            <Warehouse className="size-10 text-muted-foreground mb-3" />
          ) : (
            <Store className="size-10 text-muted-foreground mb-3" />
          )}
          <p className="text-muted-foreground">
            No {isWarehouse ? "wholesaler" : "retailer"} users found
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {isWarehouse ? "Warehouse / Owner" : "Shop / Owner"}
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const display = getDisplayName(u);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{display.primary}</p>
                        <p className="text-xs text-muted-foreground">
                          {display.secondary}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">
                        {u.phoneNumber || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate text-sm" title={getLocation(u)}>
                        {getLocation(u)}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(u.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>{getStatusBadge(u.banned)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`${ADMIN_BASE}/users/${u.id}`}>
                          <Eye className="size-4 mr-1" />
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

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
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
