/**
 * ORPC-powered Address Selector for checkout — fetches addresses via ORPC
 * instead of server actions.
 */
"use client";

import { Check, Home, Briefcase, MapPin, Plus, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMyAddresses, useAddAddress } from "@/hooks/use-public-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const LABEL_ICONS: Record<string, React.ElementType> = {
  Home: Home,
  Office: Briefcase,
  Shop: MapPin,
};

interface OrpcAddressSelectorProps {
  selectedAddressId: number | null;
  onSelectAddress: (address: any | null) => void;
}

export function OrpcAddressSelector({
  selectedAddressId,
  onSelectAddress,
}: OrpcAddressSelectorProps) {
  const { data, isLoading } = useMyAddresses();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const addresses = data?.addresses ?? [];

  // Auto-select default address on first load
  useEffect(() => {
    if (addresses.length > 0 && selectedAddressId === null) {
      const defaultAddr =
        addresses.find((a: any) => a.isDefault) || addresses[0];
      onSelectAddress(defaultAddr);
    }
  }, [addresses, selectedAddressId, onSelectAddress]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading addresses...</span>
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="p-3 border border-dashed rounded-lg text-center text-sm text-gray-500">
        <p>No saved addresses.</p>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="mt-2">
              <Plus className="h-3 w-3 mr-1" />
              Add Address
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Address</DialogTitle>
            </DialogHeader>
            <QuickAddressForm onDone={() => setAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Select Address</Label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {addresses.map((addr: any) => {
          const Icon = LABEL_ICONS[addr.label] || MapPin;
          const isSelected = selectedAddressId === addr.id;
          return (
            <button
              key={addr.id}
              type="button"
              onClick={() => onSelectAddress(addr)}
              className={`relative text-left p-3 border rounded-lg transition-all ${
                isSelected
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
              )}
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-sm font-medium">{addr.label}</span>
                {addr.isDefault && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700"
                  >
                    Default
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-600">{addr.recipientName}</p>
              <p className="text-xs text-gray-500 truncate">{addr.address}</p>
              <p className="text-xs text-gray-500">
                {addr.city}
                {addr.area ? `, ${addr.area}` : ""}
              </p>
            </button>
          );
        })}

        {/* Use different address */}
        <button
          type="button"
          onClick={() => onSelectAddress(null)}
          className={`text-left p-3 border rounded-lg transition-all border-dashed ${
            selectedAddressId === null
              ? "border-emerald-500 bg-emerald-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">
              Use a different address
            </span>
          </div>
          <p className="text-xs text-gray-500">Enter address manually below</p>
        </button>
      </div>

      {/* Add new address inline */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Add New Address
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Address</DialogTitle>
          </DialogHeader>
          <QuickAddressForm onDone={() => setAddDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickAddressForm({ onDone }: { onDone: () => void }) {
  const addAddress = useAddAddress();
  const [form, setForm] = useState({
    label: "Home",
    recipientName: "",
    phone: "",
    address: "",
    city: "",
    area: "",
    postalCode: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addAddress.mutateAsync(form);
      onDone();
    } catch {
      // error toast handled in hook
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
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Recipient Name *</Label>
          <Input
            value={form.recipientName}
            onChange={(e) =>
              setForm((p) => ({ ...p, recipientName: e.target.value }))
            }
            required
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone *</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            required
            className="h-8 text-sm"
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
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">City *</Label>
          <Input
            value={form.city}
            onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
            required
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Area</Label>
          <Input
            value={form.area}
            onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={addAddress.isPending}>
        {addAddress.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        Save Address
      </Button>
    </form>
  );
}
