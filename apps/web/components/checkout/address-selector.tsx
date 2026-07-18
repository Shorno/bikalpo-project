"use client";

import type { Address } from "@bikalpo-project/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Home, Loader2, MapPin, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddressForm } from "@/components/account/address-form";
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
  const [addressesOpen, setAddressesOpen] = useState(false);
  const hasAutoSelected = useRef(false);
  const { data, isLoading } = useMyAddresses();
  const addresses = data?.addresses ?? [];
  const selectedAddress = addresses.find(
    (address) => address.id === selectedAddressId,
  );

  useEffect(() => {
    if (addresses.length === 0 || hasAutoSelected.current) return;
    const defaultAddress = addresses.find((address) => address.isDefault);
    hasAutoSelected.current = true;
    if (defaultAddress) {
      onSelectAddress(defaultAddress);
    } else {
      setAddressesOpen(true);
    }
  }, [addresses, onSelectAddress]);

  const handleAddressAdded = () => {
    setShowAddModal(false);
    queryClient.invalidateQueries({
      queryKey: orpc.customer.getMyAddresses.key(),
    });
  };

  const addressDialog = (
    <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Add new address</DialogTitle>
        </DialogHeader>
        <AddressForm onClose={handleAddressAdded} />
      </DialogContent>
    </Dialog>
  );

  if (isLoading) {
    return (
      <div
        className="flex min-h-14 animate-pulse items-center gap-3 rounded-lg bg-muted/55 px-4"
        role="status"
        aria-label="Loading saved addresses"
      >
        <Loader2 className="size-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">
          Loading saved addresses...
        </span>
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <>
        <div className="flex min-h-14 items-center justify-between gap-4 rounded-lg bg-muted/40 px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              No saved delivery addresses
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enter the delivery details below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Save an address
          </button>
        </div>
        {addressDialog}
      </>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              Saved addresses
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choose a saved address or enter a different one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add new
          </button>
        </div>

        {selectedAddress && !addressesOpen ? (
          <button
            type="button"
            onClick={() => setAddressesOpen(true)}
            className="flex w-full items-center gap-3 border-t px-4 py-3.5 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/9 text-primary">
              <Check className="size-4" aria-hidden="true" />
            </span>
            <AddressDetails address={selectedAddress} className="flex-1" />
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
              Change
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        ) : (
          <div
            className="grid gap-2 border-t p-3"
            role="radiogroup"
            aria-label="Saved delivery addresses"
          >
            {addresses.map((address) => {
              const isSelected = selectedAddressId === address.id;
              return (
                <button
                  key={address.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onSelectAddress(address);
                    setAddressesOpen(false);
                  }}
                  className={cn(
                    "flex min-h-16 items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                    isSelected && "border-primary/45 bg-primary/[0.055]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                      isSelected && "bg-primary/10 text-primary",
                    )}
                  >
                    {isSelected ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : address.label.toLowerCase() === "home" ? (
                      <Home className="size-4" aria-hidden="true" />
                    ) : (
                      <MapPin className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <AddressDetails address={address} className="flex-1" />
                  {address.isDefault && (
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Default
                    </span>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              role="radio"
              aria-checked={selectedAddressId === null}
              onClick={() => {
                onSelectAddress(null);
                setAddressesOpen(false);
              }}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-lg border px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                selectedAddressId === null &&
                  "border-primary/45 bg-primary/[0.055] text-foreground",
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-md bg-muted">
                <Plus className="size-4" aria-hidden="true" />
              </span>
              Use a different address
            </button>
          </div>
        )}
      </div>
      {addressDialog}
    </>
  );
}

function AddressDetails({
  address,
  className,
}: {
  address: Address;
  className?: string;
}) {
  return (
    <span className={cn("min-w-0", className)}>
      <span className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-foreground">
          {address.label}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {address.recipientName}
        </span>
      </span>
      <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">
        {address.address}, {address.city}
        {address.area && `, ${address.area}`}
      </span>
    </span>
  );
}
