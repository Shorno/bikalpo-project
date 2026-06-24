"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Loader2, MapPin, Package } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
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

function DetailRow({
  label,
  children,
  align = "end",
}: {
  label: string;
  children: ReactNode;
  align?: "start" | "end";
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-4 py-2.5">
      <dt className="pt-0.5 text-sm text-muted-foreground">{label}</dt>
      <dd
        className={`min-w-0 text-sm font-medium leading-snug ${
          align === "end" ? "text-right" : "text-left"
        }`}
      >
        {children}
      </dd>
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
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Invoice Details
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {invoice?.invoiceNumber ?? "Loading invoice…"}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !invoice ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <section className="rounded-lg border bg-muted/20 px-4">
                <dl>
                  <DetailRow label="Status">
                    <Badge variant={getDisplayStatusTone(invoice.displayStatus)}>
                      {getDisplayStatusLabel(invoice.displayStatus)}
                    </Badge>
                  </DetailRow>
                  <Separator />
                  <DetailRow label="Order">
                    <span className="break-all font-mono text-[13px] font-semibold">
                      {invoice.order?.orderNumber ?? "—"}
                    </span>
                  </DetailRow>
                  <Separator />
                  <DetailRow label="Customer">
                    <span className="break-words">
                      {invoice.customer.displayName}
                    </span>
                  </DetailRow>
                  <Separator />
                  <DetailRow label="Type">
                    {getDeliveryTypeLabel(invoice.deliveryType)}
                  </DetailRow>
                  {invoice.order?.shippingArea ? (
                    <>
                      <Separator />
                      <DetailRow label="Area">
                        <span className="inline-flex items-start justify-end gap-1.5 break-words">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {invoice.order.shippingArea}
                        </span>
                      </DetailRow>
                    </>
                  ) : null}
                  {invoice.group ? (
                    <>
                      <Separator />
                      <DetailRow label="Group">
                        <span className="break-words">{invoice.group.groupName}</span>
                        {!invoice.group.deliverymanId ? (
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            Rider not assigned —{" "}
                            <Link
                              href="/warehouse/dashboard/delivery-team"
                              className="font-medium underline underline-offset-2"
                            >
                              Delivery Team
                            </Link>
                          </p>
                        ) : null}
                      </DetailRow>
                    </>
                  ) : null}
                </dl>
              </section>

              <section className="mt-6">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Line items
                </div>

                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_5.5rem] gap-3 border-b bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Product</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Total</span>
                  </div>
                  <ul className="divide-y">
                    {invoice.items.map((item) => (
                      <li
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_2.75rem_5.5rem] gap-3 px-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            {item.productName}
                          </p>
                          {item.productSku ? (
                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                              {item.productSku}
                            </p>
                          ) : null}
                        </div>
                        <span className="self-start pt-0.5 text-right text-sm tabular-nums">
                          {item.quantity}
                        </span>
                        <span className="self-start pt-0.5 text-right text-sm font-medium tabular-nums">
                          {formatMoney(item.lineTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>

            <div className="shrink-0 border-t bg-muted/10 px-6 py-4">
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatMoney(invoice.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="tabular-nums">
                    {formatMoney(invoice.deliveryCharge)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4 pt-1 text-base font-semibold">
                  <span>Grand total</span>
                  <span className="tabular-nums">
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
