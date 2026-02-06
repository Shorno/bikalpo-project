import { format } from "date-fns";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEstimateById } from "@/actions/estimate/get-estimates";
import { checkAuth } from "@/app/(dashboard)/dashboard/admin/_actions/auth/checkAuth";
import { ConvertOrderForm } from "@/components/features/estimates/convert-order-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default async function EstimateDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const session = await checkAuth();

  if (!session?.user) return null;

  const result = await getEstimateById(parseInt(id, 10));
  if (!result.success || !result.estimate) {
    notFound();
  }

  const estimate = result.estimate;

  // Verify ownership
  if (estimate.customerId !== session.user.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-red-600 font-medium">
          You are not authorized to view this estimate.
        </p>
        <Button asChild>
          <Link href="/account/estimates">Go Back</Link>
        </Button>
      </div>
    );
  }

  const isSent = estimate.status === "sent";
  const isApproved = estimate.status === "approved";
  const canConvert = isSent || isApproved;
  const config = statusConfig[estimate.status] || statusConfig.draft;

  // Ensure user object matches expected shape with nulls for undefined
  const formUser = {
    ...session.user,
    name: session.user.name || null,
    phoneNumber: session.user.phoneNumber || null,
    shopName: session.user.shopName || null,
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href="/account/estimates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Estimate Details</h1>
          <p className="text-sm text-gray-500">{estimate.estimateNumber}</p>
        </div>
      </div>

      {/* Desktop: Side by side, Mobile: Stacked */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Estimate Details - Left Side */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900">
                  {estimate.estimateNumber}
                </h3>
                <Badge
                  className={`${config.bg} ${config.color} border-0 text-xs shrink-0`}
                >
                  {config.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                <span>
                  Created: {format(new Date(estimate.createdAt), "MMM d, yyyy")}
                </span>
                {estimate.validUntil && (
                  <span>
                    Valid until:{" "}
                    {format(new Date(estimate.validUntil), "MMM d, yyyy")}
                  </span>
                )}
              </div>
            </div>

            {/* Items List */}
            <div className="divide-y divide-gray-50">
              {estimate.items.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-2.5"
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

            {/* Summary */}
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="text-gray-900">
                    {formatPrice(estimate.subtotal)}
                  </span>
                </div>
                {Number(estimate.discount) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Discount</span>
                    <span className="text-red-600">
                      -{formatPrice(estimate.discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-lg text-gray-900">
                    {formatPrice(estimate.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {estimate.notes && (
              <div className="border-t border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Notes
                </p>
                <p className="text-sm text-gray-700">{estimate.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Order Form - Right Side */}
        <div className="lg:col-span-2">
          {canConvert ? (
            <div className="lg:sticky lg:top-4">
              <ConvertOrderForm
                estimateId={estimate.id}
                user={formUser as any}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              {estimate.status === "converted" ? (
                <div className="text-center py-4">
                  <p className="font-medium text-green-600">
                    Converted to Order
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    This estimate has been converted to an order.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href="/account/orders">View Orders</Link>
                  </Button>
                </div>
              ) : estimate.status === "rejected" ? (
                <div className="text-center py-4">
                  <p className="font-medium text-red-600">Estimate Rejected</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Please contact support for more information.
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="font-medium text-gray-700">Awaiting Approval</p>
                  <p className="text-sm text-gray-500 mt-1">
                    You can place an order once this estimate is approved.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
