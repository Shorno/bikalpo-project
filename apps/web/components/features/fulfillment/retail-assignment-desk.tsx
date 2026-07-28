"use client";

import { Bike, CheckCircle2, Clock3, Route, UserCheck } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAssignRetailDeliveryman,
  useRetailAssignmentOverview,
} from "@/hooks/use-shop-owner-api";
import {
  getRetailAssignmentViewHref,
  normalizeRetailAssignmentView,
  RETAIL_ASSIGNMENT_PATH,
} from "@/lib/retail-assignment-view";
import {
  FulfillmentDesk,
  FulfillmentKpis,
  FulfillmentPanel,
  FulfillmentState,
  FulfillmentStatus,
} from "./fulfillment-desk";
import { RETAILER_FULFILLMENT_ADAPTER } from "./owner-adapters";

type Overview = NonNullable<
  ReturnType<typeof useRetailAssignmentOverview>["data"]
>;
type Group = Overview["groups"][number];
type Rider = Overview["deliverymen"][number];

export function RetailAssignmentDesk() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = useRetailAssignmentOverview();
  const assign = useAssignRetailDeliveryman();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupId, setGroupId] = useState("");
  const [riderId, setRiderId] = useState("");
  const data = query.data;
  const groups = data?.groups ?? [];
  const riders = data?.deliverymen ?? [];
  const view = normalizeRetailAssignmentView(searchParams.get("view"));
  const openGroups = groups.filter((group) =>
    ["pending_assignment", "assigned"].includes(group.status),
  );
  const selectedGroup = groups.find((group) => String(group.id) === groupId);
  const eligibleRiders = riders.filter(
    (rider) =>
      !rider.banned &&
      (!rider.hasActiveGroup || rider.id === selectedGroup?.deliverymanId),
  );

  const activeGroupByRider = useMemo(
    () =>
      new Map(
        groups
          .filter(
            (group) =>
              group.deliverymanId &&
              ["assigned", "out_for_delivery", "partial"].includes(
                group.status,
              ),
          )
          .map((group) => [group.deliverymanId, group]),
      ),
    [groups],
  );

  const openGroupDialog = (group?: Group, rider?: Rider) => {
    setGroupId(group ? String(group.id) : "");
    setRiderId(rider?.id ?? group?.deliverymanId ?? "");
    setDialogOpen(true);
  };

  const changeView = (nextView: string) => {
    const viewHref = getRetailAssignmentViewHref(
      normalizeRetailAssignmentView(nextView),
      searchParams.toString(),
    );

    if (`${pathname}?${searchParams.toString()}` !== viewHref) {
      router.push(viewHref, { scroll: false });
    }
  };

  const submit = () =>
    assign.mutate(
      { groupId: Number(groupId), deliverymanId: riderId },
      {
        onSuccess: () => {
          toast.success("Rider assigned to Delivery Group");
          setDialogOpen(false);
          query.refetch();
        },
        onError: (error) => toast.error(error.message),
      },
    );

  const groupTable = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Delivery Group</TableHead>
          <TableHead>Invoices</TableHead>
          <TableHead>Areas</TableHead>
          <TableHead>Rider</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const areas = [
            ...new Set(
              group.invoices
                .map((link) => link.invoice?.order?.shippingArea)
                .filter(Boolean),
            ),
          ];
          return (
            <TableRow key={group.id}>
              <TableCell>
                <p className="font-medium">{group.groupName}</p>
                <p className="text-xs text-muted-foreground">
                  Group #{group.id}
                </p>
              </TableCell>
              <TableCell>{group.totalInvoices}</TableCell>
              <TableCell>{areas.join(", ") || "—"}</TableCell>
              <TableCell>
                {group.deliveryman?.name ?? (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <FulfillmentStatus status={group.status} />
              </TableCell>
              <TableCell>
                {["pending_assignment", "assigned"].includes(group.status) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openGroupDialog(group)}
                  >
                    {group.deliverymanId ? "Reassign" : "Assign"}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  const riderTable = (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rider</TableHead>
          <TableHead>Service area</TableHead>
          <TableHead>Current workload</TableHead>
          <TableHead>Availability</TableHead>
          <TableHead className="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {riders.map((rider) => {
          const activeGroup = activeGroupByRider.get(rider.id);
          return (
            <TableRow key={rider.id}>
              <TableCell>
                <p className="font-medium">{rider.name}</p>
                <p className="text-xs text-muted-foreground">
                  {rider.phoneNumber || rider.email}
                </p>
              </TableCell>
              <TableCell>{rider.serviceArea || "All store areas"}</TableCell>
              <TableCell>
                {activeGroup ? (
                  <>
                    <p className="font-medium">{activeGroup.groupName}</p>
                    <p className="text-xs text-muted-foreground">
                      {activeGroup.totalInvoices} invoices
                    </p>
                  </>
                ) : (
                  "No active group"
                )}
              </TableCell>
              <TableCell>
                <FulfillmentStatus
                  status={
                    rider.banned
                      ? "cancelled"
                      : rider.hasActiveGroup
                        ? "assigned"
                        : "not_assigned"
                  }
                />
              </TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    rider.banned ||
                    rider.hasActiveGroup ||
                    openGroups.length === 0
                  }
                  onClick={() => openGroupDialog(undefined, rider)}
                >
                  Assign group
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <FulfillmentDesk
      adapter={RETAILER_FULFILLMENT_ADAPTER}
      activeHref={RETAIL_ASSIGNMENT_PATH}
      title="Delivery Assignment"
      description="Assign each Delivery Group to an available store rider. Switch perspectives to work from the group queue or review rider capacity."
    >
      <FulfillmentKpis
        items={[
          {
            label: "Pending groups",
            value: data?.stats.pendingGroups ?? 0,
            icon: Clock3,
            tone: "amber",
          },
          {
            label: "Assigned groups",
            value: data?.stats.assignedGroups ?? 0,
            icon: Route,
            tone: "blue",
          },
          {
            label: "Active routes",
            value: data?.stats.activeGroups ?? 0,
            icon: Bike,
            tone: "blue",
          },
          {
            label: "Available riders",
            value: data?.stats.availableRiders ?? 0,
            icon: UserCheck,
            tone: "emerald",
          },
        ]}
      />
      <Tabs value={view} onValueChange={changeView} className="gap-0">
        <FulfillmentPanel
          title={view === "groups" ? "Delivery Group queue" : "Rider workload"}
          actions={
            <TabsList
              aria-label="Delivery assignment view"
              className="h-10 w-full bg-slate-100 p-1 sm:w-auto"
            >
              <TabsTrigger value="groups" className="gap-2 px-3 sm:min-w-44">
                <Route className="h-4 w-4" />
                By Delivery Group
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600 shadow-sm">
                  {openGroups.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="riders" className="gap-2 px-3 sm:min-w-36">
                <Bike className="h-4 w-4" />
                By Rider
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600 shadow-sm">
                  {data?.stats.availableRiders ?? 0}
                </span>
              </TabsTrigger>
            </TabsList>
          }
        >
          <TabsContent value="groups" className="m-0">
            <FulfillmentState
              loading={query.isLoading}
              error={query.isError}
              empty={!query.isLoading && groups.length === 0}
              emptyTitle="No Delivery Groups"
            />
            {groups.length > 0 ? groupTable : null}
          </TabsContent>
          <TabsContent value="riders" className="m-0">
            <FulfillmentState
              loading={query.isLoading}
              error={query.isError}
              empty={!query.isLoading && riders.length === 0}
              emptyTitle="No store riders"
            />
            {riders.length > 0 ? riderTable : null}
          </TabsContent>
        </FulfillmentPanel>
      </Tabs>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign store rider</DialogTitle>
            <DialogDescription>
              Select one available store rider for this Delivery Group. Riders
              who are banned or already handling an active group cannot be
              assigned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Delivery Group</Label>
              <Select
                value={groupId}
                onValueChange={(value) => {
                  setGroupId(value);
                  setRiderId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {openGroups.map((group) => (
                    <SelectItem key={group.id} value={String(group.id)}>
                      {group.groupName} · {group.totalInvoices} invoices
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Store rider</Label>
              <Select value={riderId} onValueChange={setRiderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an available rider" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleRiders.map((rider) => (
                    <SelectItem key={rider.id} value={rider.id}>
                      {rider.name}
                      {rider.serviceArea ? ` · ${rider.serviceArea}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!groupId || !riderId || assign.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FulfillmentDesk>
  );
}
