"use client";

import { Building2, Mail, Phone, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/utils/currency";

interface CustomerDetailsCardProps {
  customer: {
    name: string;
    email: string;
    phoneNumber: string | null;
    shopName: string | null;
    ownerName: string | null;
    stats: {
      totalEstimates: number;
      totalOrders: number;
      totalSpent: string;
      pendingAmount: string;
    };
  };
}

export function CustomerDetailsCard({ customer }: CustomerDetailsCardProps) {
  return (
    <div className="space-y-4">
      {/* Customer Info */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-bold truncate">
            {customer.shopName || customer.name}
          </h2>
          <div className="flex flex-col gap-1 text-xs sm:text-sm text-muted-foreground">
            {customer.ownerName && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium text-foreground truncate">
                  {customer.ownerName}
                </span>
              </div>
            )}
            {customer.phoneNumber && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{customer.phoneNumber}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{customer.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">
              {customer.stats.totalEstimates}
            </p>
            <p className="text-xs text-muted-foreground">Estimates</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{customer.stats.totalOrders}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-green-600">
              {formatPrice(customer.stats.totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground">Total Spent</p>
          </CardContent>
        </Card>
        <Card className="p-0">
          <CardContent className="p-3 text-center">
            <p className="text-xl sm:text-2xl font-bold text-orange-600">
              {formatPrice(customer.stats.pendingAmount)}
            </p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
