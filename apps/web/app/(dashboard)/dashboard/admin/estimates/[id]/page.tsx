import { format } from "date-fns";
import { ArrowLeft, CheckCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEstimateById } from "@/actions/estimate/get-estimates";
import { AdminEstimateActions } from "@/components/features/estimates/admin-estimate-actions";
import { EstimateActionButtons } from "@/components/features/estimates/estimate-action-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminEstimateDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const result = await getEstimateById(Number(id));

  if (!result.success || !result.estimate) {
    notFound();
  }

  const { estimate } = result;
  const needsReview = estimate.status === "pending";

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/admin/estimates">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {needsReview ? "Review Estimate" : "Estimate Details"}{" "}
              {estimate.estimateNumber}
            </h1>
            <Badge
              variant={
                estimate.status === "approved" ||
                estimate.status === "converted"
                  ? "default"
                  : estimate.status === "rejected"
                    ? "destructive"
                    : estimate.status === "sent"
                      ? "secondary"
                      : "outline"
              }
            >
              {estimate.status.charAt(0).toUpperCase() +
                estimate.status.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Submitted by{" "}
            <span className="font-medium">{estimate.salesman?.name}</span> on{" "}
            {format(new Date(estimate.createdAt), "PPP")}
          </p>
        </div>

        <div className="flex gap-2">
          <AdminEstimateActions
            estimateId={estimate.id}
            status={estimate.status}
          />
          {estimate.status === "approved" && (
            <EstimateActionButtons estimate={estimate} />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Items Table - no card wrapper */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Items</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimate.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {item.productName}
                          </span>
                          {Number(item.discount) > 0 && (
                            <span className="text-xs text-muted-foreground">
                              Discount: ৳
                              {Number(item.discount).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        ৳{Number(item.unitPrice).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ৳{Number(item.totalPrice).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {estimate.notes && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Notes</h2>
              <div className="rounded-md border p-4">
                <p className="whitespace-pre-wrap text-sm">{estimate.notes}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <span className="font-medium block">
                {estimate.customer?.name}
              </span>
              <span className="text-muted-foreground block">
                {estimate.customer?.email}
              </span>
              <span className="text-muted-foreground block">
                {estimate.customer?.phoneNumber}
              </span>
              {estimate.customer?.shopName && (
                <span className="text-muted-foreground font-medium block">
                  Shop: {estimate.customer?.shopName}
                </span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>৳{Number(estimate.subtotal).toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span>-৳{Number(estimate.discount).toLocaleString()}</span>
              </div>

              <Separator />

              <div className="flex justify-between text-base font-medium">
                <span>Total</span>
                <span>৳{Number(estimate.total).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          {estimate.status === "converted" && estimate.convertedOrderId && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="size-4 text-green-600" />
                  <span className="font-medium text-green-800">
                    Converted to Order
                  </span>
                </div>
                <p className="text-sm text-green-700 mb-4">
                  This estimate was successfully converted to an order.
                </p>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  asChild
                >
                  <Link
                    href={`/dashboard/admin/orders/${estimate.convertedOrderId}`}
                  >
                    View Order
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
