"use client";

import {
  CheckCircle2,
  Clock3,
  Layers3,
  PackagePlus,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FulfillmentDesk,
  FulfillmentKpis,
  FulfillmentPanel,
  FulfillmentState,
  FulfillmentStatus,
} from "@/components/features/fulfillment/fulfillment-desk";
import { RETAILER_FULFILLMENT_ADAPTER } from "@/components/features/fulfillment/owner-adapters";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import {
  useAddRetailInvoicesToGroup,
  useCreateRetailDeliveryGroup,
  useRetailAssignmentOverview,
  useRetailDeliveryInvoices,
} from "@/hooks/use-shop-owner-api";

const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

export default function RetailDeliveryManagementPage() {
  const [status, setStatus] = useState<
    | "all"
    | "not_assigned"
    | "pending"
    | "out_for_delivery"
    | "delivered"
    | "failed"
    | "returned"
  >("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [groupName, setGroupName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [riderId, setRiderId] = useState("unassigned");
  const invoicesQuery = useRetailDeliveryInvoices(status);
  const overviewQuery = useRetailAssignmentOverview();
  const createGroup = useCreateRetailDeliveryGroup();
  const addInvoices = useAddRetailInvoicesToGroup();
  const invoices = invoicesQuery.data?.invoices ?? [];
  const selectedRows = useMemo(
    () => invoices.filter((entry) => selected.has(entry.id)),
    [invoices, selected],
  );
  const openGroups = (overviewQuery.data?.groups ?? []).filter((group) =>
    ["pending_assignment", "assigned"].includes(group.status),
  );
  const availableRiders = (overviewQuery.data?.deliverymen ?? []).filter(
    (rider) => !rider.banned && !rider.hasActiveGroup,
  );

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = () => {
    const invoiceIds = [...selected];
    if (mode === "new") {
      createGroup.mutate(
        {
          groupName,
          invoiceIds,
          deliverymanId: riderId === "unassigned" ? undefined : riderId,
        },
        {
          onSuccess: () => {
            toast.success("Delivery Group created");
            setDialogOpen(false);
            setSelected(new Set());
            setGroupName("");
          },
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }
    addInvoices.mutate(
      { groupId: Number(groupId), invoiceIds },
      {
        onSuccess: () => {
          toast.success("Invoices added to Delivery Group");
          setDialogOpen(false);
          setSelected(new Set());
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <FulfillmentDesk
      adapter={RETAILER_FULFILLMENT_ADAPTER}
      activeHref="/dashboard/delivery-management"
      title="Delivery Management"
      description="Batch compatible consumer invoices into store-owned Delivery Groups. Add to an open group or create a new group and optionally assign an available store rider."
      actions={
        <Button
          disabled={selectedRows.length === 0}
          onClick={() => setDialogOpen(true)}
        >
          <PackagePlus className="mr-2 h-4 w-4" />
          Group selected ({selectedRows.length})
        </Button>
      }
    >
      <FulfillmentKpis
        items={[
          { label: "Total invoices", value: invoices.length, icon: Layers3 },
          {
            label: "Ready to group",
            value: invoices.filter(
              (entry) => entry.deliveryStatus === "not_assigned",
            ).length,
            icon: Clock3,
            tone: "amber",
          },
          {
            label: "In delivery",
            value: invoices.filter((entry) =>
              ["pending", "out_for_delivery"].includes(entry.deliveryStatus),
            ).length,
            icon: Truck,
            tone: "blue",
          },
          {
            label: "Delivered",
            value: invoices.filter(
              (entry) => entry.deliveryStatus === "delivered",
            ).length,
            icon: CheckCircle2,
            tone: "emerald",
          },
        ]}
      />
      <FulfillmentPanel
        title="Consumer invoices"
        actions={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as typeof status);
              setSelected(new Set());
            }}
          >
            <SelectTrigger className="w-48 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All invoices</SelectItem>
              <SelectItem value="not_assigned">Ready to group</SelectItem>
              <SelectItem value="pending">Grouped</SelectItem>
              <SelectItem value="out_for_delivery">Out for delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
        }
      >
        <FulfillmentState
          loading={invoicesQuery.isLoading}
          error={invoicesQuery.isError}
          empty={!invoicesQuery.isLoading && invoices.length === 0}
          emptyTitle="No delivery invoices"
        />
        {invoices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Invoice</TableHead>
                <TableHead>Delivery Recipient</TableHead>
                <TableHead>Delivery Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((entry) => {
                const selectable =
                  entry.deliveryStatus === "not_assigned" &&
                  !entry.deliveryGroupLink;
                return (
                  <TableRow
                    key={entry.id}
                    data-state={selected.has(entry.id) ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(entry.id)}
                        disabled={!selectable}
                        onCheckedChange={() => toggle(entry.id)}
                        aria-label={`Select ${entry.invoiceNumber}`}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{entry.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.order.orderNumber}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{entry.order.shippingName}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.order.shippingArea || entry.order.shippingCity}
                      </p>
                    </TableCell>
                    <TableCell>
                      {entry.deliveryGroupLink?.group?.groupName ?? (
                        <span className="text-muted-foreground">
                          Not grouped
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <FulfillmentStatus status={entry.deliveryStatus} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {money.format(Number(entry.grandTotal))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </FulfillmentPanel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create or extend a Delivery Group</DialogTitle>
            <DialogDescription>
              {selectedRows.length} compatible consumer invoice
              {selectedRows.length === 1 ? "" : "s"} selected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={mode}
                onValueChange={(value) => setMode(value as typeof mode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Create a new group</SelectItem>
                  <SelectItem
                    value="existing"
                    disabled={openGroups.length === 0}
                  >
                    Add to an open group
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {mode === "new" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="group-name">Group name</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="e.g. Dhanmondi morning route"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Store rider (optional)</Label>
                  <Select value={riderId} onValueChange={setRiderId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Assign later</SelectItem>
                      {availableRiders.map((rider) => (
                        <SelectItem key={rider.id} value={rider.id}>
                          {rider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Open group</Label>
                <Select value={groupId} onValueChange={setGroupId}>
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
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                createGroup.isPending ||
                addInvoices.isPending ||
                (mode === "new" ? !groupName.trim() : !groupId)
              }
            >
              Save group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FulfillmentDesk>
  );
}
