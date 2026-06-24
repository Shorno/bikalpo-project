"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { orpc } from "@/utils/orpc";
import {
  type DeliveryInvoiceRow,
  formatMoney,
  suggestGroupName,
} from "./delivery-utils";

type GroupMode = "create" | "existing";

type InternalGroupModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: DeliveryInvoiceRow[];
  onSuccess: (result: { riderAssigned: boolean }) => void;
};

export function InternalGroupModal({
  open,
  onOpenChange,
  invoices,
  onSuccess,
}: InternalGroupModalProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<GroupMode>("create");
  const [groupName, setGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [deliverymanId, setDeliverymanId] = useState<string>("");

  const invoiceIds = useMemo(() => invoices.map((inv) => inv.id), [invoices]);
  const shippingArea = invoices[0]?.order?.shippingArea ?? undefined;

  useEffect(() => {
    if (open && invoices.length > 0) {
      setGroupName(suggestGroupName(invoices));
      setMode("create");
      setSelectedGroupId("");
      setDeliverymanId("");
    }
  }, [open, invoices]);

  const { data: openGroupsResult, isLoading: loadingGroups } = useQuery({
    ...orpc.warehouse.getOpenDeliveryGroups.queryOptions({ input: {} }),
    enabled: open,
  });

  const { data: deliverymenResult, isLoading: loadingDeliverymen } = useQuery({
    ...orpc.deliveryman.getForAssignment.queryOptions({
      input: { orderShippingArea: shippingArea },
    }),
    enabled: open && mode === "create",
  });

  const createMutation = useMutation(
    orpc.deliveryman.createGroup.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: orpc.warehouse.getDeliveryManagementInvoices.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.warehouse.getOpenDeliveryGroups.queryKey(),
        });
      },
    }),
  );

  const addMutation = useMutation(
    orpc.deliveryman.addInvoicesToGroup.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: orpc.warehouse.getDeliveryManagementInvoices.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: orpc.warehouse.getOpenDeliveryGroups.queryKey(),
        });
      },
    }),
  );

  const isSubmitting = createMutation.isPending || addMutation.isPending;
  const openGroups = openGroupsResult?.groups ?? [];
  const deliverymen = deliverymenResult?.deliverymen ?? [];

  const totalAmount = invoices.reduce(
    (sum, inv) => sum + Number.parseFloat(inv.grandTotal || "0"),
    0,
  );

  const handleSubmit = async () => {
    if (invoiceIds.length === 0) {
      toast.error("No invoices selected");
      return;
    }

    try {
      if (mode === "create") {
        if (!groupName.trim()) {
          toast.error("Group name is required");
          return;
        }
        await createMutation.mutateAsync({
          groupName: groupName.trim(),
          invoiceIds,
          deliverymanId: deliverymanId || undefined,
        });
        toast.success("Delivery group created");
        onSuccess({ riderAssigned: !!deliverymanId });
      } else {
        if (!selectedGroupId) {
          toast.error("Select a delivery group");
          return;
        }
        await addMutation.mutateAsync({
          groupId: Number.parseInt(selectedGroupId, 10),
          invoiceIds,
        });
        const targetGroup = openGroups.find(
          (group) => String(group.id) === selectedGroupId,
        );
        toast.success("Invoices added to delivery group");
        onSuccess({ riderAssigned: !!targetGroup?.hasRider });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save delivery group",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Internal Delivery</DialogTitle>
          <DialogDescription>
            {invoiceIds.length} invoice{invoiceIds.length === 1 ? "" : "s"} ·{" "}
            {formatMoney(totalAmount)} total
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as GroupMode)}
          className="gap-3"
        >
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem value="create" id="group-mode-create" />
            <div className="flex-1 space-y-3">
              <Label htmlFor="group-mode-create" className="font-medium">
                Create new group
              </Label>
              {mode === "create" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="group-name">Group name</Label>
                    <Input
                      id="group-name"
                      value={groupName}
                      onChange={(event) => setGroupName(event.target.value)}
                      placeholder="Area or route name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="deliveryman">Assign rider (optional)</Label>
                    <Select
                      value={deliverymanId || "none"}
                      onValueChange={(value) =>
                        setDeliverymanId(value === "none" ? "" : value)
                      }
                    >
                      <SelectTrigger id="deliveryman">
                        <SelectValue placeholder="Assign later in Delivery Team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Assign later</SelectItem>
                        {deliverymen.map((dm) => (
                          <SelectItem
                            key={dm.id}
                            value={dm.id}
                            disabled={dm.hasActiveGroup}
                          >
                            {dm.name}
                            {dm.hasActiveGroup ? " (busy)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      <Link
                        href="/warehouse/dashboard/delivery-team"
                        className="underline underline-offset-2"
                      >
                        Assign later in Delivery Team
                      </Link>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem value="existing" id="group-mode-existing" />
            <div className="flex-1 space-y-3">
              <Label htmlFor="group-mode-existing" className="font-medium">
                Add to existing group
              </Label>
              {mode === "existing" ? (
                <Select
                  value={selectedGroupId}
                  onValueChange={setSelectedGroupId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        loadingGroups ? "Loading groups…" : "Select group"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {openGroups.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No open groups
                      </SelectItem>
                    ) : (
                      openGroups.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.groupName} ({group.totalInvoices} invoices)
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          </div>
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              isSubmitting ||
              (mode === "create" && loadingDeliverymen) ||
              (mode === "existing" && loadingGroups)
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : mode === "create" ? (
              "Create Delivery Group"
            ) : (
              "Add to Group"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
