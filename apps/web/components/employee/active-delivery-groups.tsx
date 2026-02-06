"use client";

import { ArrowRight, MapPin, Package, Truck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DELIVERY_BASE } from "@/lib/routes";

// Use a flexible type that works with the actual data structure
interface ActiveDeliveryGroupsProps {
  groups: Array<{
    id: number;
    groupName: string;
    status: string;
    totalInvoices: number;
    completedInvoices: number;
    invoices: Array<{
      id: number;
      status: string;
      invoice?: {
        id: number;
        invoiceNumber: string;
        order?: {
          shippingAddress: string;
          shippingCity: string;
        } | null;
      } | null;
    }>;
  }>;
}

export function ActiveDeliveryGroups({ groups }: ActiveDeliveryGroupsProps) {
  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Active Delivery Groups</h2>
            <p className="text-xs text-muted-foreground">
              Your current delivery assignments
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-2xl bg-muted/30 shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
            <Package className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No active delivery groups
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Groups will appear here when assigned
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Active Delivery Groups</h2>
              <Badge variant="secondary" className="rounded-full text-xs px-2">
                {groups.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Your current delivery assignments
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs shadow-sm"
          asChild
        >
          <Link href={`${DELIVERY_BASE}/deliveries`}>
            View All
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>

      {/* Group Cards */}
      <div className="grid gap-3">
        {groups.map((group, index) => (
          <Card
            key={group.id}
            className="p-0 rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 overflow-hidden"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{group.groupName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className="h-5 text-[10px] px-1.5 bg-blue-50 text-blue-700 border-blue-200 rounded-full"
                      >
                        {group.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {group.completedInvoices}/{group.totalInvoices}{" "}
                        completed
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs px-3 shadow-sm shrink-0"
                  asChild
                >
                  <Link href={`${DELIVERY_BASE}/deliveries/${group.id}`}>
                    View
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>

              {/* Pending invoices */}
              {group.invoices.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Pending deliveries:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.invoices.slice(0, 3).map(
                      (delivery) =>
                        delivery.invoice && (
                          <div
                            key={delivery.id}
                            className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded-full border border-amber-200"
                          >
                            <span className="font-medium">
                              {delivery.invoice.invoiceNumber}
                            </span>
                            <MapPin className="h-3 w-3" />
                            <span className="truncate max-w-[80px]">
                              {delivery.invoice.order?.shippingCity}
                            </span>
                          </div>
                        ),
                    )}
                    {group.invoices.length > 3 && (
                      <span className="inline-flex items-center text-xs text-muted-foreground px-2 py-1">
                        +{group.invoices.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
