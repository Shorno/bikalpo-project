"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Image as ImageIcon, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getEstimatesByCustomer } from "@/actions/estimate/get-estimates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/utils/currency";

const statusConfig: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  draft: { color: "text-gray-700", bg: "bg-gray-100", label: "Draft" },
  pending: { color: "text-yellow-700", bg: "bg-yellow-50", label: "Pending" },
  sent: { color: "text-blue-700", bg: "bg-blue-50", label: "Received" },
  approved: { color: "text-green-700", bg: "bg-green-50", label: "Approved" },
  rejected: { color: "text-red-700", bg: "bg-red-50", label: "Rejected" },
  converted: {
    color: "text-purple-700",
    bg: "bg-purple-50",
    label: "Converted",
  },
  pending_admin_approval: {
    color: "text-orange-700",
    bg: "bg-orange-50",
    label: "Pending Approval",
  },
};

function canPlaceOrder(status: string) {
  return status === "sent" || status === "approved";
}

function EstimatesSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ))}
    </div>
  );
}

interface EstimateItem {
  id: number;
  productName: string;
  productImage: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface Estimate {
  id: number;
  estimateNumber: string;
  status: string;
  total: string;
  createdAt: string | Date;
  validUntil?: string | Date | null;
  items: EstimateItem[];
}

function EstimateCard({ estimate }: { estimate: Estimate }) {
  const itemCount = estimate.items?.length || 0;
  const showPlaceOrder = canPlaceOrder(estimate.status);
  const config = statusConfig[estimate.status] || statusConfig.draft;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-gray-300 transition-colors">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        {/* Top row: Estimate number and status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 truncate">
            {estimate.estimateNumber}
          </h3>
          <Badge
            className={`${config.bg} ${config.color} border-0 text-xs shrink-0`}
          >
            {config.label}
          </Badge>
        </div>

        {/* Bottom row: Date, Total, and Action */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{format(new Date(estimate.createdAt), "MMM d, yyyy")}</span>
            <span>•</span>
            <span className="font-semibold text-gray-900">
              {formatPrice(estimate.total)}
            </span>
          </div>
          {showPlaceOrder ? (
            <Button
              asChild
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Link href={`/account/estimates/${estimate.id}`}>
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Place</span> Order
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Link href={`/account/estimates/${estimate.id}`}>Details</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Items List */}
      {itemCount > 0 && (
        <div className="divide-y divide-gray-50">
          {estimate.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50"
            >
              <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden shrink-0 flex items-center justify-center">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt={item.productName}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.productName}
                </p>
                <p className="text-xs text-gray-500">
                  {formatPrice(item.unitPrice)} × {item.quantity}
                </p>
              </div>
              <div className="text-sm font-semibold text-gray-900 shrink-0">
                {formatPrice(item.totalPrice)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CustomerEstimatesPage() {
  const { data: result, isLoading } = useQuery({
    queryKey: ["customer-estimates"],
    queryFn: () => getEstimatesByCustomer(),
  });

  const estimates = result?.success ? result.estimates : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Estimates</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          View your price estimates and place orders
        </p>
      </div>

      {isLoading ? (
        <EstimatesSkeleton />
      ) : estimates?.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <FileText className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">No estimates yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Estimates will appear here when you request pricing.
          </p>
          <Button
            asChild
            size="sm"
            className="mt-4 bg-emerald-600 hover:bg-emerald-700"
          >
            <Link href="/products">Browse Products</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {estimates?.map((estimate) => (
            <EstimateCard key={estimate.id} estimate={estimate as Estimate} />
          ))}
        </div>
      )}
    </div>
  );
}
