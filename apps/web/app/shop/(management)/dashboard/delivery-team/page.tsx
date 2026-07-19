"use client";

import {
  Bike,
  KeyRound,
  Plus,
  ShieldBan,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateRetailDeliveryman,
  useDeleteRetailDeliveryman,
  useResetRetailDeliverymanPassword,
  useRetailDeliverymen,
  useToggleRetailDeliverymanBan,
  useUpdateRetailDeliveryman,
} from "@/hooks/use-shop-owner-api";

type Rider = NonNullable<
  ReturnType<typeof useRetailDeliverymen>["data"]
>["deliverymen"][number];

const emptyForm = {
  name: "",
  email: "",
  phoneNumber: "",
  serviceArea: "",
  password: "",
};

export default function RetailDeliveryTeamPage() {
  const query = useRetailDeliverymen();
  const create = useCreateRetailDeliveryman();
  const update = useUpdateRetailDeliveryman();
  const toggleBan = useToggleRetailDeliverymanBan();
  const resetPassword = useResetRetailDeliverymanPassword();
  const remove = useDeleteRetailDeliveryman();
  const [formOpen, setFormOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [editing, setEditing] = useState<Rider | null>(null);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState("");
  const riders = query.data?.deliverymen ?? [];

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };
  const openEdit = (rider: Rider) => {
    setEditing(rider);
    setForm({
      name: rider.name,
      email: rider.email,
      phoneNumber: rider.phoneNumber ?? "",
      serviceArea: rider.serviceArea ?? "",
      password: "",
    });
    setFormOpen(true);
  };
  const save = () => {
    if (editing) {
      update.mutate(
        {
          deliverymanId: editing.id,
          name: form.name,
          phoneNumber: form.phoneNumber || null,
          serviceArea: form.serviceArea || null,
        },
        {
          onSuccess: () => {
            toast.success("Rider updated");
            setFormOpen(false);
            query.refetch();
          },
          onError: (error) => toast.error(error.message),
        },
      );
      return;
    }
    create.mutate(
      {
        name: form.name,
        email: form.email,
        password: form.password,
        phoneNumber: form.phoneNumber || undefined,
        serviceArea: form.serviceArea || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Store rider created");
          setFormOpen(false);
          query.refetch();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <FulfillmentDesk
      adapter={RETAILER_FULFILLMENT_ADAPTER}
      activeHref="/dashboard/delivery-team"
      title="Delivery Team"
      description="Create and manage rider accounts owned by this store. Banned or busy riders are excluded from assignment at the shared fulfillment boundary."
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add rider
        </Button>
      }
    >
      <FulfillmentKpis
        items={[
          { label: "Store riders", value: riders.length, icon: Users },
          {
            label: "Available",
            value: riders.filter(
              (rider) => !rider.banned && !rider.activeGroupId,
            ).length,
            icon: UserCheck,
            tone: "emerald",
          },
          {
            label: "On assignment",
            value: riders.filter((rider) => rider.activeGroupId).length,
            icon: Bike,
            tone: "blue",
          },
          {
            label: "Banned",
            value: riders.filter((rider) => rider.banned).length,
            icon: ShieldBan,
            tone: "amber",
          },
        ]}
      />
      <FulfillmentPanel title="Store-owned riders">
        <FulfillmentState
          loading={query.isLoading}
          error={query.isError}
          empty={!query.isLoading && riders.length === 0}
          emptyTitle="No store riders yet"
          emptyCopy="Create the first rider account to start assigning Delivery Groups."
        />
        {riders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rider</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Service area</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="w-80" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {riders.map((rider) => (
                <TableRow key={rider.id}>
                  <TableCell>
                    <p className="font-medium">{rider.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {rider.email}
                    </p>
                  </TableCell>
                  <TableCell>{rider.phoneNumber || "—"}</TableCell>
                  <TableCell>
                    {rider.serviceArea || "All store areas"}
                  </TableCell>
                  <TableCell>
                    <FulfillmentStatus
                      status={
                        rider.banned
                          ? "cancelled"
                          : rider.activeGroupId
                            ? "assigned"
                            : "not_assigned"
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(rider)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRider(rider);
                          setNewPassword("");
                          setResetOpen(true);
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          toggleBan.mutate(
                            { deliverymanId: rider.id, banned: !rider.banned },
                            {
                              onSuccess: () => {
                                toast.success(
                                  rider.banned
                                    ? "Rider restored"
                                    : "Rider banned",
                                );
                                query.refetch();
                              },
                              onError: (error) => toast.error(error.message),
                            },
                          )
                        }
                      >
                        {rider.banned ? "Restore" : "Ban"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={Boolean(rider.activeGroupId)}
                        onClick={() => {
                          if (!window.confirm(`Delete ${rider.name}?`)) return;
                          remove.mutate(
                            { deliverymanId: rider.id },
                            {
                              onSuccess: () => {
                                toast.success("Rider deleted");
                                query.refetch();
                              },
                              onError: (error) => toast.error(error.message),
                            },
                          );
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </FulfillmentPanel>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit rider" : "Add store rider"}
            </DialogTitle>
            <DialogDescription>
              Rider accounts sign in to the canonical delivery portal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rider-name">Name</Label>
              <Input
                id="rider-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            {!editing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="rider-email">Email</Label>
                  <Input
                    id="rider-email"
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rider-password">Temporary password</Label>
                  <Input
                    id="rider-password"
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="rider-phone">Phone</Label>
              <Input
                id="rider-phone"
                value={form.phoneNumber}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phoneNumber: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rider-area">Service area</Label>
              <Input
                id="rider-area"
                value={form.serviceArea}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    serviceArea: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={
                !form.name.trim() ||
                (!editing && (!form.email || form.password.length < 8)) ||
                create.isPending ||
                update.isPending
              }
            >
              Save rider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset rider password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedRider?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !selectedRider ||
                newPassword.length < 8 ||
                resetPassword.isPending
              }
              onClick={() =>
                selectedRider &&
                resetPassword.mutate(
                  { deliverymanId: selectedRider.id, newPassword },
                  {
                    onSuccess: () => {
                      toast.success("Password reset");
                      setResetOpen(false);
                    },
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FulfillmentDesk>
  );
}
