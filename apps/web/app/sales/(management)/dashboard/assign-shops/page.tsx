"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  type LucideIcon,
  Mail,
  Phone,
  Search,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SALES_PORTAL_BASE } from "@/lib/sales-routing";
import { orpc } from "@/utils/orpc";

type ShopType = "retailer" | "warehouse";
type TypeFilter = "all" | ShopType;

type AssignedShop = {
  id: string;
  customerType: ShopType;
  connectionId: number;
  displayName: string;
  contactName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  shopName: string | null;
  warehouseName: string | null;
  connectedAt: Date | string | null;
  assignedAt: Date | string;
  totalOrders: number;
  totalSpent: string;
  totalEstimates: number;
  lastActivityAt: Date | string | null;
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatMoney(value: string | number | null | undefined) {
  return `Tk ${Number(value ?? 0).toLocaleString("en-BD")}`;
}

function getShopTypeMeta(type: ShopType) {
  return type === "warehouse"
    ? {
        label: "Warehouse",
        icon: Building2,
        className: "border-sky-200 bg-sky-50 text-sky-700",
      }
    : {
        label: "Retail Shop",
        icon: Store,
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
}

function ShopTypeBadge({ type }: { type: ShopType }) {
  const meta = getShopTypeMeta(type);
  const Icon = meta.icon;

  return (
    <Badge variant="outline" className={`gap-1 ${meta.className}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <Card className="p-0">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export default function AssignedShopsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const { data, isLoading, error } = useQuery(
    orpc.salesman.getAssignedCustomers.queryOptions(),
  );

  const shops = (data?.customers ?? []) as AssignedShop[];

  const filteredShops = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return shops.filter((shop) => {
      const matchesType =
        typeFilter === "all" || shop.customerType === typeFilter;
      const haystack = [
        shop.displayName,
        shop.contactName,
        shop.email,
        shop.phoneNumber,
        shop.address,
        shop.shopName,
        shop.warehouseName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchesType &&
        (!normalizedSearch || haystack.includes(normalizedSearch))
      );
    });
  }, [shops, search, typeFilter]);

  const metrics = useMemo(
    () => ({
      total: shops.length,
      retailers: shops.filter((shop) => shop.customerType === "retailer")
        .length,
      warehouses: shops.filter((shop) => shop.customerType === "warehouse")
        .length,
      value: formatMoney(
        shops.reduce((sum, shop) => sum + Number(shop.totalSpent ?? 0), 0),
      ),
    }),
    [shops],
  );

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Failed to load assigned shops.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Assign Shops
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shops assigned to your SR profile by the warehouse team.
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-1">
          <Users className="h-3.5 w-3.5" />
          {filteredShops.length} visible
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Assigned Shops" value={metrics.total} icon={Users} />
        <MetricCard
          label="Retail Shops"
          value={metrics.retailers}
          icon={Store}
        />
        <MetricCard
          label="Warehouses"
          value={metrics.warehouses}
          icon={Building2}
        />
        <MetricCard label="Order Value" value={metrics.value} icon={Wallet} />
      </div>

      <div className="rounded-lg border bg-background">
        <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shop, contact, phone, email..."
              className="pl-9"
            />
          </div>
          <Select
            value={typeFilter}
            onValueChange={(value) => setTypeFilter(value as TypeFilter)}
          >
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Shop type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All shops</SelectItem>
              <SelectItem value="retailer">Retail shops</SelectItem>
              <SelectItem value="warehouse">Warehouses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredShops.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <Store className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium">No assigned shops found</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              Assigned shops appear here after the warehouse sales-team panel
              assigns active connected shops to your SR profile.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shop</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShops.map((shop) => (
                    <TableRow key={`${shop.customerType}-${shop.id}`}>
                      <TableCell>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{shop.displayName}</p>
                            <ShopTypeBadge type={shop.customerType} />
                          </div>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {shop.address ?? "No address"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p>{shop.contactName}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {shop.phoneNumber ?? "No phone"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <p>{formatDate(shop.assignedAt)}</p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="h-3 w-3" />
                            Last activity {formatDate(shop.lastActivityAt)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {shop.totalOrders}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(shop.totalSpent)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`${SALES_PORTAL_BASE}/assign-shops/${shop.id}`}
                          >
                            View
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 p-3 md:hidden">
              {filteredShops.map((shop) => (
                <Link
                  key={`${shop.customerType}-${shop.id}`}
                  href={`${SALES_PORTAL_BASE}/assign-shops/${shop.id}`}
                  className="block rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {shop.displayName}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {shop.contactName}
                      </p>
                    </div>
                    <ShopTypeBadge type={shop.customerType} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {shop.phoneNumber ?? "No phone"}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      {shop.email}
                    </span>
                    <span>{shop.totalOrders} orders</span>
                    <span className="text-right font-medium">
                      {formatMoney(shop.totalSpent)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
