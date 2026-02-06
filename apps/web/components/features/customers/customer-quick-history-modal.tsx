"use client";

import { format } from "date-fns";
import {
  Building2,
  Calendar,
  Clock,
  Mail,
  Package,
  Phone,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  type CustomerDetails,
  getCustomerDetails,
} from "@/actions/employee/get-assigned-customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/utils/currency";

interface CustomerQuickHistoryModalProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
    case "completed":
    case "delivered":
      return "bg-green-100 text-green-800";
    case "cancelled":
    case "rejected":
      return "bg-red-100 text-red-800";
    case "processing":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function CustomerQuickHistoryModal({
  customerId,
  open,
  onOpenChange,
}: CustomerQuickHistoryModalProps) {
  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && customerId) {
      setLoading(true);
      getCustomerDetails(customerId)
        .then((result) => {
          if (result.success && result.customer) {
            setCustomer(result.customer);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, customerId]);

  if (!customerId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Quick Customer History
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-4">
              {/* Customer Info Skeleton */}
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>

              {/* Stats Skeleton */}
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>

              {/* Orders Skeleton */}
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            </div>
          ) : customer ? (
            <div className="space-y-5">
              {/* Customer Info Header */}
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold truncate">
                    {customer.shopName || customer.name}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                    {customer.ownerName && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{customer.ownerName}</span>
                      </div>
                    )}
                    {customer.phoneNumber && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{customer.phoneNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground col-span-full sm:col-span-1">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Since {format(new Date(customer.createdAt), "MMM yyyy")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-medium uppercase">
                    Estimates
                  </p>
                  <p className="text-xl font-bold text-blue-700">
                    {customer.stats.totalEstimates}
                  </p>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-purple-600 font-medium uppercase">
                    Orders
                  </p>
                  <p className="text-xl font-bold text-purple-700">
                    {customer.stats.totalOrders}
                  </p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 font-medium uppercase">
                    Total Spent
                  </p>
                  <p className="text-lg font-bold text-green-700 truncate">
                    {formatPrice(customer.stats.totalSpent)}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-orange-600 font-medium uppercase">
                    Pending
                  </p>
                  <p className="text-lg font-bold text-orange-700 truncate">
                    {formatPrice(customer.stats.pendingAmount)}
                  </p>
                </div>
              </div>

              {/* Recent Orders */}
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Recent Orders
                </h4>
                {customer.orders.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No orders yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customer.orders.slice(0, 5).map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {order.orderNumber}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${getStatusColor(order.status)}`}
                            >
                              {order.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {format(new Date(order.createdAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold">
                            {formatPrice(order.total)}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              order.paymentStatus === "paid"
                                ? "text-green-600"
                                : "text-yellow-600"
                            }`}
                          >
                            {order.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Estimates */}
              {customer.estimates.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
                    Recent Estimates
                  </h4>
                  <div className="space-y-2">
                    {customer.estimates.slice(0, 3).map((estimate) => (
                      <div
                        key={estimate.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-sm">
                            {estimate.estimateNumber}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {format(
                              new Date(estimate.createdAt),
                              "MMM d, yyyy",
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatPrice(estimate.total)}
                          </p>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getStatusColor(estimate.status)}`}
                          >
                            {estimate.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Customer not found</p>
            </div>
          )}
        </div>

        <div className="pt-4 border-t mt-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4 mr-2" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
