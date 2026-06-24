"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, MapPin, Package } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orpc } from "@/utils/orpc";
import {
  formatMoney,
  getDeliveryTypeLabel,
  getDisplayStatusLabel,
  getDisplayStatusTone,
} from "./delivery-utils";

type DeliveryInvoiceDrawerProps = {
  invoiceId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeliveryInvoiceDrawer({
  invoiceId,
  open,
  onOpenChange,
}: DeliveryInvoiceDrawerProps) {
  const { data, isLoading } = useQuery({
    ...orpc.warehouse.getDeliveryInvoiceDetail.queryOptions({
      input: { invoiceId: invoiceId ?? 0 },
    }),
    enabled: open && !!invoiceId,
  });

  const invoice = data?.invoice;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Details
          </SheetTitle>
          <SheetDescription>
            {invoice?.invoiceNumber ?? "Loading invoice…"}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !invoice ? (
          <div className="mt-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={getDisplayStatusTone(invoice.displayStatus)}>
                  {getDisplayStatusLabel(invoice.displayStatus)}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Order</span>
                <span className="font-mono">{invoice.order?.orderNumber ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Customer</span>
                <span className="text-right">
                  {invoice.customer.displayName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Delivery type</span>
                <span>{getDeliveryTypeLabel(invoice.deliveryType)}</span>
              </div>
              {invoice.order?.shippingArea ? (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Area</span>
                  <span className="flex items-center gap-1 text-right">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {invoice.order.shippingArea}
                  </span>
                </div>
              ) : null}
              {invoice.group ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Delivery group</span>
                  <span className="text-right">
                    {invoice.group.groupName}
                    {!invoice.group.deliverymanId ? (
                      <span className="block text-xs text-muted-foreground">
                        Rider not assigned —{" "}
                        <Link
                          href="/warehouse/dashboard/delivery-team"
                          className="underline underline-offset-2"
                        >
                          Delivery Team
                        </Link>
                      </span>
                    ) : null}
                  </span>
                </div>
              ) : null}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Package className="h-4 w-4" />
                Line items
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        {item.productSku ? (
                          <div className="text-xs text-muted-foreground">
                            {item.productSku}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 space-y-1 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>{formatMoney(invoice.deliveryCharge)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Grand total</span>
                  <span>{formatMoney(invoice.grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
