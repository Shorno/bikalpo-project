"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Globe,
  Mail,
  MapPin,
  Package,
  Phone,
  Split,
  Truck,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getInvoiceById } from "@/actions/invoice/invoice-actions";
import {
  InvoiceDeliveryBadge,
  InvoicePaymentBadge,
} from "@/components/features/invoices/invoice-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatPrice(price: string | number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(price));
}

function formatDate(date: Date | string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function InvoiceDetailSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="bg-gray-50/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column Skeleton */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader className="border-b border-gray-100 py-4">
              <div className="flex justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
              <div className="p-6 border-t border-gray-100">
                <div className="flex flex-col items-end gap-3 max-w-xs ml-auto">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Separator className="my-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column Skeleton */}
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="border-b border-gray-100 py-4">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const invoiceId = Number(params.id);

  const { data: result, isLoading } = useQuery({
    queryKey: ["admin-invoice", invoiceId],
    queryFn: () => getInvoiceById(invoiceId),
    enabled: !!invoiceId,
  });

  if (isLoading) {
    return <InvoiceDetailSkeleton />;
  }

  if (!result?.success || !result.invoice) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg border border-dashed text-center">
          <div className="bg-red-50 p-4 rounded-full mb-4">
            <FileText className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Invoice not found
          </h1>
          <p className="text-gray-500 mb-6 max-w-md">
            The invoice you are looking for does not exist or has been deleted.
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/admin/invoices">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const invoice = result.invoice;

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild className="h-9 w-9">
            <Link href="/dashboard/admin/invoices">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/dashboard/admin/invoices"
              className="hover:text-foreground transition-colors"
            >
              Invoices
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">
              {invoice.invoiceNumber}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {invoice.invoiceNumber}
            </h1>
            {invoice.invoiceType === "split" && (
              <Badge
                variant="outline"
                className="bg-purple-50 text-purple-700 border-purple-200"
              >
                Split Invoice
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {invoice.invoiceType === "main" && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/admin/invoices/${invoice.id}/partial`}>
                  <Package className="h-4 w-4 mr-2" />
                  Create Partial Invoice
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/invoices/${invoiceId}/pdf`} download>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats/Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-50/50 border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-md border border-gray-100 shadow-sm">
                <Truck className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery
                </p>
                <div className="mt-1">
                  <InvoiceDeliveryBadge status={invoice.deliveryStatus} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50/50 border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-md border border-gray-100 shadow-sm">
                <CreditCard className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </p>
                <div className="mt-1">
                  <InvoicePaymentBadge status={invoice.paymentStatus} />
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {formatPrice(invoice.grandTotal)}
              </p>
              <p className="text-xs text-gray-500">Total Amount</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50/50 border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-md border border-gray-100 shadow-sm">
                <FileText className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </p>
                <div className="mt-1">
                  <Badge variant="outline" className="capitalize">
                    {invoice.invoiceType === "split"
                      ? `Split #${invoice.splitSequence}`
                      : invoice.invoiceType}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Items Table */}
          <Card className="shadow-sm border-gray-200 overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <CardTitle className="text-base font-medium">
                    Invoice Items
                  </CardTitle>
                </div>
                <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-full border border-gray-200">
                  {invoice.items?.length || 0} Items
                </span>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-gray-50/30">
                    <TableHead className="w-[45%] pl-6">
                      Product Details
                    </TableHead>
                    <TableHead className="text-center w-[15%]">
                      Quantity
                    </TableHead>
                    <TableHead className="text-right w-[20%]">
                      Unit Price
                    </TableHead>
                    <TableHead className="text-right w-[20%] pr-6">
                      Total
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items?.map((item) => (
                    <TableRow key={item.id} className="hover:bg-gray-50/50">
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {item.productName}
                          </span>
                          {item.productSku && (
                            <span className="text-xs text-gray-500 font-mono mt-0.5">
                              SKU: {item.productSku}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] py-1 bg-gray-100 rounded-md text-sm font-medium text-gray-700">
                          {item.quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right py-4 tabular-nums text-gray-600">
                        {formatPrice(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4 font-semibold tabular-nums text-gray-900">
                        {formatPrice(item.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!invoice.items || invoice.items.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-24 text-center text-gray-500"
                      >
                        No items found in this invoice.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Invoice Summary Footer */}
            <div className="bg-gray-50/30 p-6 border-t border-gray-100">
              <div className="flex flex-col items-end gap-3 max-w-xs ml-auto">
                <div className="flex justify-between w-full text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium tabular-nums">
                    {formatPrice(invoice.subtotal)}
                  </span>
                </div>

                {Number(invoice.discountAmount) > 0 && (
                  <div className="flex justify-between w-full text-sm text-emerald-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Discount
                    </span>
                    <span className="font-medium tabular-nums">
                      -{formatPrice(invoice.discountAmount)}
                    </span>
                  </div>
                )}

                {Number(invoice.deliveryCharge) > 0 && (
                  <div className="flex justify-between w-full text-sm">
                    <span className="text-gray-500">Delivery Charge</span>
                    <span className="font-medium tabular-nums">
                      +{formatPrice(invoice.deliveryCharge)}
                    </span>
                  </div>
                )}

                {Number(invoice.taxAmount) > 0 && (
                  <div className="flex justify-between w-full text-sm">
                    <span className="text-gray-500">Tax / VAT</span>
                    <span className="font-medium tabular-nums">
                      +{formatPrice(invoice.taxAmount)}
                    </span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between w-full text-base">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold tabular-nums text-primary text-lg">
                    {formatPrice(invoice.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Notes Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {invoice.customerNotes && (
              <Card className="shadow-sm border-amber-100 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Customer Note
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-amber-800/80 leading-relaxed">
                    {invoice.customerNotes}
                  </p>
                </CardContent>
              </Card>
            )}

            {invoice.adminNotes && (
              <Card className="shadow-sm border-blue-100 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-900 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Admin Note
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-800/80 leading-relaxed">
                    {invoice.adminNotes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Partial Invoices Section */}
          {invoice.invoiceType === "main" &&
            invoice.splitInvoices &&
            invoice.splitInvoices.length > 0 && (
              <Card className="shadow-sm border-purple-200 overflow-hidden">
                <CardHeader className="bg-purple-50/30 border-b border-purple-100 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Split className="h-4 w-4 text-purple-600" />
                      <CardTitle className="text-base font-medium text-purple-900">
                        Partial Deliveries
                      </CardTitle>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-white text-purple-700 border-purple-200"
                    >
                      {invoice.splitInvoices.length}{" "}
                      {invoice.splitInvoices.length === 1
                        ? "Delivery"
                        : "Deliveries"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {invoice.splitInvoices.map((splitInvoice, index) => (
                      <div
                        key={splitInvoice.id}
                        className="p-4 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 text-sm font-semibold">
                              {index + 1}
                            </div>
                            <div>
                              <Link
                                href={`/dashboard/admin/invoices/${splitInvoice.id}`}
                                className="font-medium text-gray-900 hover:text-primary hover:underline"
                              >
                                {splitInvoice.invoiceNumber}
                              </Link>
                              <div className="flex items-center gap-2 mt-1">
                                <InvoiceDeliveryBadge
                                  status={splitInvoice.deliveryStatus}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900">
                              {formatPrice(splitInvoice.grandTotal)}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatDate(splitInvoice.createdAt)}
                            </p>
                          </div>
                        </div>
                        {splitInvoice.items &&
                          splitInvoice.items.length > 0 && (
                            <div className="ml-11 space-y-1">
                              {splitInvoice.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <span className="text-gray-600">
                                    {item.productName}
                                  </span>
                                  <span className="text-gray-500">
                                    Qty:{" "}
                                    <span className="font-medium text-gray-700">
                                      {item.quantity}
                                    </span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Parent Invoice Reference (for split invoices) */}
          {invoice.invoiceType === "split" && invoice.parentInvoice && (
            <Card className="shadow-sm border-purple-200 bg-purple-50/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-purple-900 flex items-center gap-2">
                  <Split className="h-4 w-4" />
                  Part of Main Invoice
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/dashboard/admin/invoices/${invoice.parentInvoice.id}`}
                  className="flex items-center justify-between p-3 rounded-md bg-white border border-purple-200 hover:border-purple-300 hover:bg-purple-50/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-purple-100 rounded border border-purple-200 text-purple-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold uppercase text-purple-600">
                        Main Invoice
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {invoice.parentInvoice.invoiceNumber}
                      </span>
                    </div>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-purple-400 rotate-180" />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar Context */}
        <div className="space-y-6">
          {/* Customer Card */}
          <Card className="shadow-sm border-gray-200 overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <Link
                      href={`/dashboard/sales/customers/${invoice.customer?.id}`}
                      className="font-medium text-gray-900 hover:underline hover:text-primary transition-colors block"
                    >
                      {invoice.customer?.shopName || "N/A"}
                    </Link>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Shop Name
                    </span>
                  </div>
                </div>

                <Separator className="bg-gray-100" />

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700">
                      {invoice.customer?.ownerName ||
                        invoice.customer?.name ||
                        "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-gray-400 shrink-0" />
                    <a
                      href={`tel:${invoice.customer?.phoneNumber}`}
                      className="text-gray-700 hover:text-primary transition-colors"
                    >
                      {invoice.customer?.phoneNumber || "N/A"}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-gray-400 shrink-0" />
                    <a
                      href={`mailto:${invoice.customer?.email}`}
                      className="text-gray-700 hover:text-primary transition-colors truncate"
                    >
                      {invoice.customer?.email || "N/A"}
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery Card */}
          <Card className="shadow-sm border-gray-200 overflow-hidden">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-500" />
                Delivery Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 mb-1">
                      Shipping Address
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                      {invoice.order?.shippingAddress || "No address provided"}
                    </p>
                    {(invoice.order?.shippingArea ||
                      invoice.order?.shippingCity) && (
                      <p className="text-gray-500 mt-1">
                        {[
                          invoice.order?.shippingArea,
                          invoice.order?.shippingCity,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                {invoice.deliveryman && (
                  <>
                    <Separator className="bg-gray-100" />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Assigned To
                      </p>
                      <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-md border border-gray-100">
                        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {invoice.deliveryman.name}
                          </p>
                          {(invoice.vehicleType || invoice.vehicleInfo) && (
                            <p className="text-xs text-gray-500">
                              {[invoice.vehicleType, invoice.vehicleInfo]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          )}
                          {invoice.expectedDeliveryAt && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Expected: {formatDate(invoice.expectedDeliveryAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline / Order Info */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-4">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="relative pl-4 border-l-2 border-gray-100 space-y-6">
                {/* Created */}
                <div className="relative">
                  <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow-sm" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      Invoice Created
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(invoice.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Approved */}
                {invoice.approvedAt && (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 shadow-sm" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        Order Approved
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(invoice.approvedAt)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Delivered */}
                {invoice.deliveredAt ? (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          Delivered
                        </span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] h-4 px-1"
                        >
                          Completed
                        </Badge>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDate(invoice.deliveredAt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white bg-gray-200" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-400">
                        Delivery Pending
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {invoice.order && (
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Link
                    href={`/dashboard/admin/orders/${invoice.order.id}`}
                    className="flex items-center justify-between p-3 rounded-md bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-white rounded border border-gray-200 text-gray-500 group-hover:text-primary group-hover:border-primary/50 transition-colors">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold uppercase text-gray-500">
                          Associated Order
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {invoice.order.orderNumber}
                        </span>
                      </div>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-gray-400 rotate-180" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
