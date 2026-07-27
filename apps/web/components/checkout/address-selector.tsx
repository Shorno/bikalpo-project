"use client";

import type { Address } from "@bikalpo-project/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Home, Loader2, MapPin, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddressForm } from "@/components/account/address-form";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMyAddresses } from "@/hooks/use-customer-api";
import { cn } from "@/lib/utils";
import { orpc } from "@/utils/orpc";

interface AddressSelectorProps {
  selectedAddressId: number | null;
  onSelectAddress: (address: Address | null) => void;
}

export function AddressSelector({
  selectedAddressId,
  onSelectAddress,
}: AddressSelectorProps) {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const hasAutoSelected = useRef(false);

  const { data, isLoading } = useMyAddresses();

  const addresses = data?.addresses ?? [];

  // Auto-select default address ONLY on initial load (once)
  useEffect(() => {
    if (addresses.length > 0 && !hasAutoSelected.current) {
      const defaultAddress = addresses.find((addr) => addr.isDefault);
      if (defaultAddress) {
        hasAutoSelected.current = true;
        onSelectAddress(defaultAddress);
      }
    }
  }, [addresses, onSelectAddress]);

  const handleAddressAdded = () => {
    setShowAddModal(false);
    // Refetch addresses to get the newly added one
    queryClient.invalidateQueries({
      queryKey: orpc.customer.getMyAddresses.key(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-20 items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70">
        <Loader2 className="size-4 animate-spin text-emerald-600" />
        <span className="ml-2 text-sm text-slate-500">
          Loading saved addresses…
        </span>
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div>
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm">
              <Home className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Save an address for next time
              </p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                You can still enter delivery details manually below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add saved address
          </button>
        </div>

        {/* Add Address Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent
            className="sm:max-w-lg p-0 overflow-hidden"
            showCloseButton={false}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Add New Address</DialogTitle>
            </DialogHeader>
            <AddressForm onClose={handleAddressAdded} />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Saved addresses</p>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex min-h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add new
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {addresses.map((address) => {
          const isSelected = selectedAddressId === address.id;
          return (
            <button
              key={address.id}
              type="button"
              onClick={() => onSelectAddress(address)}
              className={cn(
                "relative min-h-24 rounded-xl border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 motion-reduce:transition-none",
                isSelected
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                  : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50",
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-emerald-600">
                  <Check className="size-3 text-white" aria-hidden="true" />
                </div>
              )}

              {/* Address label with icon */}
              <div className="mb-1.5 flex items-center gap-1.5 pr-6">
                {address.label.toLowerCase() === "home" ? (
                  <Home
                    className="size-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                ) : (
                  <MapPin
                    className="size-3.5 text-slate-400"
                    aria-hidden="true"
                  />
                )}
                <span className="text-sm font-semibold text-slate-900">
                  {address.label}
                </span>
                {address.isDefault && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-0"
                  >
                    Default
                  </Badge>
                )}
              </div>

              {/* Address details */}
              <p className="line-clamp-1 text-xs text-slate-600">
                {address.recipientName} • {address.phone}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                {address.address}, {address.city}
                {address.area && `, ${address.area}`}
              </p>
            </button>
          );
        })}

        {/* New address option */}
        <button
          type="button"
          onClick={() => onSelectAddress(null)}
          className={cn(
            "flex min-h-24 items-center justify-center gap-2 rounded-xl border p-3.5 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 motion-reduce:transition-none",
            selectedAddressId === null
              ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
              : "border-dashed border-slate-300 bg-white hover:border-emerald-300 hover:bg-slate-50",
          )}
        >
          <Plus className="size-4 text-slate-400" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-600">
            Enter another address
          </span>
        </button>
      </div>

      {/* Add Address Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent
          className="sm:max-w-lg p-0 overflow-hidden"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Add New Address</DialogTitle>
          </DialogHeader>
          <AddressForm onClose={handleAddressAdded} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
