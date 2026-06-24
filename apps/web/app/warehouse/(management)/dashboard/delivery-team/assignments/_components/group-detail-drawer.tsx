"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Package, UserPlus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { orpc } from "@/utils/orpc";
import {
  type AssignmentGroupRow,
  canAssignRider,
  formatMoney,
  getGroupStatusLabel,
  getGroupStatusTone,
  getInvoiceStatusLabel,
  resolveCustomerDisplayName,
  rollUpAreaLabel,
} from "./assignment-utils";

type GroupDetailDrawerProps = {
  group: AssignmentGroupRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (group: AssignmentGroupRow) => void;
};

export function GroupDetailDrawer({
  group,
  open,
  onOpenChange,
  onAssign,
}: GroupDetailDrawerProps) {
  const { data, isLoading } = useQuery({
    ...orpc.deliveryman.getGroupById.queryOptions({
      input: { id: group?.id ?? 0 },
    }),
    enabled: open && !!group?.id,
  });

  const detail = data?.group;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base">
            {group?.groupName ?? "Group details"}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            {group ? `#${group.id}` : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !detail || !group ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <Badge variant={getGroupStatusTone(detail.status)}>
                  {getGroupStatusLabel(detail.status)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {detail.completedInvoices}/{detail.totalInvoices} delivered
                </span>
              </div>

              <section className="rounded-lg border bg-muted/20 px-4 py-3">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Area</p>
                    <p className="mt-0.5 flex items-center gap-1 font-medium">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {rollUpAreaLabel(
                        detail.invoices.map(
                          (link) => link.invoice?.order?.shippingArea,
                        ),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total amount</p>
                    <p className="mt-0.5 font-medium tabular-nums">
                      {formatMoney(
                        detail.invoices.reduce((sum, link) => {
                          const value = Number.parseFloat(
                            link.invoice?.grandTotal ?? "0",
                          );
                          return sum + (Number.isNaN(value) ? 0 : value);
                        }, 0),
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rider</p>
                    <p className="mt-0.5 font-medium">
                      {detail.deliveryman?.name ?? "Not assigned"}
                    </p>
                    {detail.deliveryman?.phoneNumber ? (
                      <p className="text-xs text-muted-foreground">
                        {detail.deliveryman.phoneNumber}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vehicle</p>
                    <p className="mt-0.5 font-medium capitalize">
                      {detail.vehicleType ?? "—"}
                    </p>
                  </div>
                </div>
              </section>

              {detail.status === "out_for_delivery" ? (
                <div className="mt-4">
                  <Link
                    href="/warehouse/dashboard/delivery-tracking"
                    className="text-sm font-medium underline underline-offset-2"
                  >
                    View in Delivery Tracking →
                  </Link>
                </div>
              ) : null}

              <section className="mt-6">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  Orders in group
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <div className="grid grid-cols-[minmax(0,1fr)_4rem_5.5rem] gap-3 border-b bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Order / Customer</span>
                    <span className="text-right">Items</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <ul className="divide-y">
                    {detail.invoices.map((link) => {
                      const inv = link.invoice;
                      if (!inv) return null;
                      const customerName = resolveCustomerDisplayName({
                        warehouseName: inv.customer?.warehouseName,
                        shopName: inv.customer?.shopName,
                        name: inv.customer?.name,
                        shippingName: inv.order?.shippingName,
                      });
                      return (
                        <li
                          key={link.id}
                          className="grid grid-cols-[minmax(0,1fr)_4rem_5.5rem] gap-3 px-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-muted-foreground">
                              {inv.order?.orderNumber ?? inv.invoiceNumber}
                            </p>
                            <p className="text-sm font-medium leading-snug">
                              {customerName}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {getInvoiceStatusLabel(link.status)}
                            </p>
                          </div>
                          <span className="self-start pt-0.5 text-right text-sm tabular-nums">
                            {inv.items?.length ?? 0}
                          </span>
                          <span className="self-start pt-0.5 text-right text-sm font-medium tabular-nums">
                            {formatMoney(inv.grandTotal)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            </div>

            {canAssignRider(detail.status) ? (
              <div className="shrink-0 border-t bg-muted/10 px-6 py-4">
                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={() => onAssign(group)}
                >
                  <UserPlus className="h-4 w-4" />
                  {detail.deliveryman ? "Reassign Rider" : "Assign Rider"}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
