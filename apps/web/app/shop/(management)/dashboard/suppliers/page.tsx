"use client";

import {
  AlertCircle,
  ArrowRight,
  Clock,
  Package,
  Phone,
  Search,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useMySuppliers } from "@/hooks/use-shop-owner-api";

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    clearTimeout((window as any).__supTimer);
    (window as any).__supTimer = setTimeout(() => setSearchDebounced(v), 400);
  }, []);

  const { data, isLoading, isError } = useMySuppliers(searchDebounced || undefined);
  const suppliers = data?.suppliers ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Wholesalers you purchase from</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/order-from-warehouse"><ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> New Order</Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-24" />
              <div className="flex gap-4"><Skeleton className="h-8 w-16" /><Skeleton className="h-8 w-20" /></div>
            </CardContent></Card>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Failed to load suppliers</p>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <Users className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-lg font-semibold">No suppliers yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {searchDebounced ? "No suppliers match your search" : "Place your first order to build your supplier network"}
          </p>
          {!searchDebounced && (
            <Button asChild><Link href="/dashboard/order-from-warehouse"><ShoppingCart className="mr-2 h-4 w-4" />Create Order</Link></Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s: any) => (
            <Link key={s.warehouseId} href={`/dashboard/suppliers/${s.warehouseId}`}>
              <Card className="hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{s.name}</h3>
                      {s.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {s.phone}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-2 rounded-md bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase">Orders</p>
                      <p className="text-sm font-bold tabular-nums">{s.totalOrders}</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                      <p className="text-sm font-bold tabular-nums">৳ {s.totalAmount.toLocaleString("en-BD")}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    {s.pendingCount > 0 ? (
                      <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50 gap-1">
                        <Clock className="w-2.5 h-2.5" /> {s.pendingCount} pending
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50">
                        All clear
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      Last: {s.lastOrderDate ? new Date(s.lastOrderDate).toLocaleDateString("en-BD", { day: "numeric", month: "short" }) : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
