"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, MapPin, Package, UserPlus } from "lucide-react";
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
  canAssignGroupToRider,
  getRiderStatusLabel,
  getRiderStatusTone,
  type RiderOverviewRow,
} from "./rider-assignment-utils";
import {
  formatMoney,
  getAssignOrdersGroupHref,
  getGroupStatusLabel,
  getGroupStatusTone,
  getInvoiceStatusLabel,
  resolveCustomerDisplayName,
} from "../../assignments/_components/assignment-utils";

type RiderAssignmentDrawerProps = {
  rider: RiderOverviewRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssign: (rider: RiderOverviewRow) => void;
};

export function RiderAssignmentDrawer({
  rider,
  open,
  onOpenChange,
  onAssign,
}: RiderAssignmentDrawerProps) {
  const { data: profileData, isLoading: loadingProfile } = useQuery({
    ...orpc.warehouseEmployee.getDeliverymanById.queryOptions({
      input: { id: rider?.id ?? "" },
    }),
    enabled: open && !!rider?.id,
  });

  const activeGroupId = rider?.activeGroup?.id ?? 0;

  const { data: groupData, isLoading: loadingGroup } = useQuery({
    ...orpc.deliveryman.getGroupById.queryOptions({
      input: { id: activeGroupId },
    }),
    enabled: open && activeGroupId > 0,
  });

  const profile = profileData?.deliveryman;
  const groupDetail = groupData?.group;
  const isLoading =
    loadingProfile || (activeGroupId > 0 && loadingGroup) || !rider;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle className="text-base">
            {rider?.name ?? "Rider details"}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {rider?.phoneNumber ?? "Assignment overview"}
          </SheetDescription>
        </SheetHeader>

        {isLoading || !rider ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <Badge
                  variant={getRiderStatusTone(rider.status, rider.banned)}
                >
                  {getRiderStatusLabel(rider.status, rider.banned)}
                </Badge>
                {rider.activeGroup ? (
                  <span className="text-sm text-muted-foreground">
                    {rider.completedOrders}/{rider.totalOrders} delivered
                  </span>
                ) : null}
              </div>

              <section className="rounded-lg border bg-muted/20 px-4 py-3">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="mt-0.5 font-medium tabular-nums">
                      {rider.phoneNumber ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Service area</p>
                    <p className="mt-0.5 flex items-center gap-1 font-medium">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {profile?.serviceArea ?? rider.serviceArea ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total deliveries</p>
                    <p className="mt-0.5 font-medium tabular-nums">
                      {profile?.deliveriesCount ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vehicle</p>
                    <p className="mt-0.5 font-medium capitalize">
                      {rider.vehicleType ?? "—"}
                    </p>
                  </div>
                </div>
              </section>

              {rider.banned ? (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                  This rider is banned.{" "}
                  <Link
                    href={`/warehouse/dashboard/delivery-team/${rider.id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    Manage on Delivery Team
                  </Link>
                </div>
              ) : null}

              {rider.activeGroup && groupDetail ? (
                <section className="mt-6 space-y-4">
                  <section className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-muted-foreground">Current group</p>
                        <p className="mt-0.5 font-medium">
                          {rider.activeGroup.groupName}
                        </p>
                        <p className="mt-0.5 text-muted-foreground">
                          {rider.activeGroup.areaLabel}
                        </p>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                          #{rider.activeGroup.id}
                        </p>
                      </div>
                      <Badge variant={getGroupStatusTone(groupDetail.status)}>
                        {getGroupStatusLabel(groupDetail.status)}
                      </Badge>
                    </div>
                    <Link
                      href={getAssignOrdersGroupHref(rider.activeGroup.id)}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Open on Assign Orders
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </section>

                  <div>
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
                      {groupDetail.invoices.map((link) => {
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
                  </div>
                </section>
              ) : (
                <div className="mt-6 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  No active delivery group. Assign a pending group when this rider
                  is idle.
                </div>
              )}
            </div>

            {canAssignGroupToRider(rider) ? (
              <div className="shrink-0 border-t bg-muted/10 px-6 py-4">
                <Button
                  type="button"
                  className="w-full gap-2"
                  onClick={() => onAssign(rider)}
                >
                  <UserPlus className="h-4 w-4" />
                  Assign Group
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
