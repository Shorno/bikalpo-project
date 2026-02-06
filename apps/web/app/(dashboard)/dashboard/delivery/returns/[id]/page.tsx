import { format } from "date-fns";
import { ArrowLeft, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getReturnById } from "@/actions/returns/return-processing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DELIVERY_BASE } from "@/lib/routes";

function getStatusBadge(status: string) {
  const variant =
    status === "processed"
      ? "default"
      : status === "rejected"
        ? "destructive"
        : "secondary";

  return (
    <Badge variant={variant} className="text-[10px] sm:text-xs uppercase">
      {status}
    </Badge>
  );
}

interface ReturnItem {
  orderItemId: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: string;
  reason?: string;
  attachment?: string;
}

export default async function ReturnDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const returnId = parseInt(id, 10);

  if (Number.isNaN(returnId)) {
    return (
      <div className="flex flex-col items-center justify-center h-40 sm:h-64 gap-3">
        <p className="text-sm text-muted-foreground">Invalid return ID</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`${DELIVERY_BASE}/returns`}>Back to Returns</Link>
        </Button>
      </div>
    );
  }

  const result = await getReturnById(returnId);

  if (!result.success || !result.return) {
    return (
      <div className="flex flex-col items-center justify-center h-40 sm:h-64 gap-3">
        <Package className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          {result.error || "Return not found"}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href={`${DELIVERY_BASE}/returns`}>Back to Returns</Link>
        </Button>
      </div>
    );
  }

  const returnData = result.return;
  const items = (returnData.items || []) as ReturnItem[];

  return (
    <div className="flex flex-col gap-3 sm:gap-6">
      {/* Compact Header */}
      <div className="flex items-start gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 mt-0.5"
          asChild
        >
          <Link href={`${DELIVERY_BASE}/returns`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">
              Return #{returnData.id}
            </h1>
            {getStatusBadge(returnData.status)}
          </div>
          <p className="text-[10px] sm:text-sm text-muted-foreground">
            Order: {returnData.order?.orderNumber} •{" "}
            {format(new Date(returnData.createdAt), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <Card className="p-0">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-lg sm:text-xl font-bold">{items.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Items
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-primary/10">
              <p className="text-lg sm:text-xl font-bold text-primary">
                ৳{Number(returnData.totalAmount).toLocaleString()}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Total Amount
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <p className="text-sm sm:text-base font-semibold capitalize">
                {returnData.returnType}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Return Type
              </p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/50">
              {returnData.refundType ? (
                <>
                  <p className="text-sm sm:text-base font-semibold capitalize">
                    {returnData.refundType}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Refund Method
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm sm:text-base font-semibold text-muted-foreground">
                    -
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Refund Method
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer & Order Info */}
      <Card className="p-0">
        <CardContent className="p-3 sm:p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
            Customer & Order Info
          </p>
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Customer Info */}
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">
                  {returnData.user?.name || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">
                  {returnData.user?.phoneNumber || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium truncate max-w-[60%]">
                  {returnData.user?.email || "N/A"}
                </span>
              </div>
            </div>
            {/* Order Info */}
            <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm border-t sm:border-t-0 sm:border-l pt-3 sm:pt-0 sm:pl-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-medium">
                  {returnData.order?.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium">
                  {format(new Date(returnData.createdAt), "MMM d, yyyy h:mm a")}
                </span>
              </div>
              {returnData.processedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Processed</span>
                  <span className="font-medium">
                    {format(
                      new Date(returnData.processedAt),
                      "MMM d, yyyy h:mm a",
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Return Items */}
      <Card className="p-0">
        <CardContent className="p-3 sm:p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
            Return Items ({items.length})
          </p>

          {items.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
              <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No items in this return</p>
            </div>
          ) : (
            <>
              {/* Mobile: Card View */}
              <div className="sm:hidden space-y-2">
                {items.map((item, index) => (
                  <div
                    key={item.orderItemId}
                    className="border rounded-lg p-2.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {item.productName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          SKU-{item.productId}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Qty: {item.quantity}
                      </Badge>
                    </div>
                    {item.attachment && (
                      <a
                        href={item.attachment}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-12 h-12 rounded-md overflow-hidden bg-accent shrink-0"
                      >
                        <Image
                          height={600}
                          width={600}
                          src={item.attachment}
                          alt="Proof"
                          className="w-full h-full object-cover"
                        />
                      </a>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">
                        {item.reason?.replace("_", " ") || "N/A"}
                      </span>
                      <span className="font-semibold">
                        ৳
                        {(
                          item.quantity * Number(item.unitPrice)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table View */}
              <div className="hidden sm:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-16">Photo</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.orderItemId}>
                        <TableCell className="text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              SKU-{item.productId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="capitalize">
                          {item.reason?.replace("_", " ") || "N/A"}
                        </TableCell>
                        <TableCell>
                          {item.attachment ? (
                            <a
                              href={item.attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block w-10 h-10 rounded-md overflow-hidden bg-accent hover:opacity-80 transition-opacity"
                            >
                              <Image
                                width={400}
                                height={400}
                                src={item.attachment}
                                alt="Proof"
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              -
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          ৳{Number(item.unitPrice).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ৳
                          {(
                            item.quantity * Number(item.unitPrice)
                          ).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Reason & Notes */}
      {(returnData.reason || returnData.notes || returnData.adminNotes) && (
        <Card className="p-0">
          <CardContent className="p-3 sm:p-4 space-y-3">
            {returnData.reason && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Reason
                </p>
                <p className="text-sm">{returnData.reason}</p>
              </div>
            )}
            {returnData.notes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Notes
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {returnData.notes}
                </p>
              </div>
            )}
            {returnData.adminNotes && (
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                  Admin Notes
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {returnData.adminNotes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      {(returnData as any).attachments &&
        ((returnData as any).attachments as string[]).length > 0 && (
          <Card className="p-0">
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
                Attachments (
                {((returnData as any).attachments as string[]).length})
              </p>
              <div className="flex flex-wrap gap-2">
                {((returnData as any).attachments as string[]).map(
                  (url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative w-20 h-20 rounded-md overflow-hidden bg-accent hover:opacity-80 transition-opacity"
                    >
                      <Image
                        width={300}
                        height={300}
                        src={url}
                        alt={`Attachment ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </a>
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Processing Info */}
      {returnData.processor && (
        <Card className="p-0 bg-muted/30">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
              Processing Info
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processed by</span>
              <span className="font-medium">{returnData.processor.name}</span>
            </div>
            {returnData.restocked && returnData.restocked > 0 && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Items Restocked</span>
                <Badge variant="outline" className="text-xs">
                  {returnData.restocked} items
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
