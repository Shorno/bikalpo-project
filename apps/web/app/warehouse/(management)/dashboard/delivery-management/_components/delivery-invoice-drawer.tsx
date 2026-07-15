"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, MapPin, Package } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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

function DetailField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1.5 min-w-0 text-sm font-medium leading-snug">
        {children}
      </dd>
    </div>
  );
}

function InvoiceDrawerSkeleton() {
  return (
    <div className="space-y-8 px-6 py-6 sm:px-8">
      <div className="grid grid-cols-1 gap-6 border-y py-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-40" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

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
      <SheetContent
        side="right"
        className="flex flex-col gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl data-[side=right]:lg:max-w-[46rem]"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-5 pr-14 sm:px-8 sm:pr-16">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SheetTitle className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Invoice details
              </SheetTitle>
              <SheetDescription className="mt-1.5 font-mono text-xs tabular-nums">
                {invoice?.invoiceNumber ?? "Loading invoice…"}
              </SheetDescription>
            </div>
            {invoice ? (
              <Badge variant={getDisplayStatusTone(invoice.displayStatus)}>
                {getDisplayStatusLabel(invoice.displayStatus)}
              </Badge>
            ) : null}
          </div>
        </SheetHeader>

        {isLoading || !invoice ? (
          <InvoiceDrawerSkeleton />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
              <section aria-label="Invoice overview">
                <dl className="grid grid-cols-1 gap-x-10 gap-y-5 border-y py-5 sm:grid-cols-2">
                  <DetailField label="Order">
                    <span className="break-all font-mono text-[13px] font-semibold tabular-nums">
                      {invoice.order?.orderNumber ?? "—"}
                    </span>
                  </DetailField>
                  <DetailField label="Customer">
                    <span className="block break-words">
                      {invoice.customer.displayName}
                    </span>
                    {invoice.customer.phoneNumber ? (
                      <span className="mt-1 block font-mono text-xs font-normal text-muted-foreground tabular-nums">
                        {invoice.customer.phoneNumber}
                      </span>
                    ) : null}
                  </DetailField>
                  <DetailField label="Delivery type">
                    {getDeliveryTypeLabel(invoice.deliveryType)}
                  </DetailField>
                  <DetailField label="Delivery group">
                    {invoice.group ? (
                      <>
                        <span className="break-words">
                          {invoice.group.groupName}
                        </span>
                        {!invoice.group.deliverymanId ? (
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            Rider not assigned.{" "}
                            <Link
                              href="/warehouse/dashboard/delivery-team/assignments"
                              className="font-medium text-foreground underline underline-offset-2"
                            >
                              Assign orders
                            </Link>
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <span className="font-normal text-muted-foreground">
                        Not assigned
                      </span>
                    )}
                  </DetailField>
                  {invoice.order ? (
                    <DetailField label="Destination" wide>
                      <span className="flex items-start gap-2 font-normal">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="break-words">
                          {[
                            invoice.order.shippingAddress,
                            invoice.order.shippingArea,
                            invoice.order.shippingCity,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </span>
                      </span>
                    </DetailField>
                  ) : null}
                </dl>
              </section>

              <section className="mt-7" aria-labelledby="invoice-line-items">
                <div
                  id="invoice-line-items"
                  className="mb-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Line items
                  </div>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {invoice.items.length}{" "}
                    {invoice.items.length === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full table-fixed text-sm">
                    <thead className="border-b bg-muted/35 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th scope="col" className="w-auto px-4 py-2.5">
                          Product
                        </th>
                        <th scope="col" className="w-16 px-3 py-2.5 text-right">
                          Qty
                        </th>
                        <th
                          scope="col"
                          className="hidden w-28 px-3 py-2.5 text-right sm:table-cell"
                        >
                          Unit price
                        </th>
                        <th scope="col" className="w-28 px-4 py-2.5 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoice.items.map((item) => (
                        <tr key={item.id} className="align-top">
                          <td className="px-4 py-3.5">
                            <p className="font-medium leading-snug">
                              {item.productName}
                            </p>
                            {item.productSku ? (
                              <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                                {item.productSku}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                            {item.quantity}
                          </td>
                          <td className="hidden px-3 py-3.5 text-right font-mono tabular-nums sm:table-cell">
                            {formatMoney(item.unitPrice)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono font-medium tabular-nums">
                            {formatMoney(item.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="shrink-0 border-t bg-background px-6 py-4 sm:px-8 sm:py-5">
              <div className="ml-auto w-full space-y-2.5 text-sm sm:max-w-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(invoice.subtotal)}
                  </span>
                </div>
                {Number(invoice.discountAmount) > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="font-mono tabular-nums">
                      −{formatMoney(invoice.discountAmount)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(invoice.deliveryCharge)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4 pt-1 text-base font-semibold">
                  <span>Grand total</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(invoice.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
