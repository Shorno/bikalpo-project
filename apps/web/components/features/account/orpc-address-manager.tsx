/**
 * ORPC-powered Address Manager — full CRUD for saved addresses.
 */
"use client";

import {
  Briefcase,
  Home,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddAddress,
  useDeleteAddress,
  useMyAddresses,
  useSetDefaultAddress,
  useUpdateAddress,
} from "@/hooks/use-customer-api";

const LABEL_ICONS: Record<string, React.ElementType> = {
  Home: Home,
  Office: Briefcase,
  Shop: MapPin,
};
type MyAddressesData = NonNullable<ReturnType<typeof useMyAddresses>["data"]>;
type ManagedAddress = MyAddressesData["addresses"][number];

export function OrpcAddressManager() {
  const { data, isLoading, isError } = useMyAddresses();
  const deleteAddress = useDeleteAddress();
  const setDefault = useSetDefaultAddress();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ManagedAddress | null>(
    null,
  );

  if (isLoading) return <AddressSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <MapPin className="h-10 w-10 text-gray-400 mb-3" />
        <p className="text-gray-500">Unable to load addresses.</p>
      </div>
    );
  }

  const addresses = data?.addresses ?? [];

  const openAdd = () => {
    setEditingAddress(null);
    setDialogOpen(true);
  };

  const openEdit = (addr: ManagedAddress) => {
    setEditingAddress(addr);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Addresses</h1>
          <p className="text-sm text-gray-500">
            Manage your shipping addresses
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <MapPin className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">
            No addresses yet
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Add a shipping address to get started.
          </p>
          <Button onClick={openAdd} variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add Your First Address
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {addresses.map((addr) => {
            const Icon = LABEL_ICONS[addr.label] || MapPin;
            return (
              <Card key={addr.id} className="relative">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-gray-500" />
                    {addr.label}
                    {addr.isDefault && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-emerald-100 text-emerald-700"
                      >
                        Default
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p className="font-medium">{addr.recipientName}</p>
                  <p className="text-gray-600">{addr.phone}</p>
                  <p className="text-gray-500">{addr.address}</p>
                  <p className="text-gray-500">
                    {addr.city}
                    {addr.area ? `, ${addr.area}` : ""}
                    {addr.postalCode ? ` - ${addr.postalCode}` : ""}
                  </p>

                  <div className="flex items-center gap-2 pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(addr)}
                      className="text-xs"
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    {!addr.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefault.mutate({ id: addr.id })}
                        disabled={setDefault.isPending}
                        className="text-xs text-emerald-600"
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Delete this address?")) {
                          deleteAddress.mutate({ id: addr.id });
                        }
                      }}
                      disabled={deleteAddress.isPending}
                      className="text-xs text-red-600 ml-auto"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "Edit Address" : "Add New Address"}
            </DialogTitle>
          </DialogHeader>
          <AddressForm
            address={editingAddress}
            onDone={() => {
              setDialogOpen(false);
              setEditingAddress(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddressForm({
  address,
  onDone,
}: {
  address?: ManagedAddress | null;
  onDone: () => void;
}) {
  const addAddress = useAddAddress();
  const updateAddress = useUpdateAddress();

  const [form, setForm] = useState({
    label: address?.label || "Home",
    recipientName: address?.recipientName || "",
    phone: address?.phone || "",
    address: address?.address || "",
    city: address?.city || "",
    area: address?.area || "",
    postalCode: address?.postalCode || "",
    isDefault: address?.isDefault || false,
  });

  const isPending = addAddress.isPending || updateAddress.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (address?.id) {
        await updateAddress.mutateAsync({ id: address.id, ...form });
      } else {
        await addAddress.mutateAsync(form);
      }
      onDone();
    } catch {
      // error handled in hooks
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm">Label</Label>
        <div className="flex gap-2">
          {["Home", "Office", "Shop"].map((l) => (
            <Button
              key={l}
              type="button"
              size="sm"
              variant={form.label === l ? "default" : "outline"}
              onClick={() => setForm((p) => ({ ...p, label: l }))}
            >
              {l}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Recipient Name *</Label>
          <Input
            value={form.recipientName}
            onChange={(e) =>
              setForm((p) => ({ ...p, recipientName: e.target.value }))
            }
            required
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone *</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Address *</Label>
        <Textarea
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          required
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">City *</Label>
          <Input
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            required
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Area</Label>
          <Input
            value={form.area}
            onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Postal Code</Label>
          <Input
            value={form.postalCode}
            onChange={(e) =>
              setForm((p) => ({ ...p, postalCode: e.target.value }))
            }
            className="h-9 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isDefault"
          checked={form.isDefault}
          onChange={(e) =>
            setForm((p) => ({ ...p, isDefault: e.target.checked }))
          }
          className="rounded border-gray-300"
        />
        <Label htmlFor="isDefault" className="text-sm">
          Set as default address
        </Label>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {address ? "Update Address" : "Save Address"}
      </Button>
    </form>
  );
}

function AddressSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
