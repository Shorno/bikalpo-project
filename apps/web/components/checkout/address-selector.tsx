"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Home, Loader2, MapPin, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getMyAddresses } from "@/actions/address/address-actions";
import { AddressForm } from "@/components/account/address-form";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Address } from "@/db/schema/address";
import { cn } from "@/lib/utils";

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

  const { data, isLoading } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: async () => {
      const result = await getMyAddresses();
      return result.success ? result.addresses : [];
    },
  });

  const addresses = data || [];

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
    queryClient.invalidateQueries({ queryKey: ["my-addresses"] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        <span className="ml-2 text-sm text-gray-500">Loading addresses...</span>
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="w-full p-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-700 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Add a Saved Address</span>
        </button>

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
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Saved Addresses</p>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Add New
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {addresses.map((address) => {
          const isSelected = selectedAddressId === address.id;
          return (
            <button
              key={address.id}
              type="button"
              onClick={() => onSelectAddress(address)}
              className={cn(
                "relative p-3 rounded-lg border text-left transition-all",
                isSelected
                  ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                  : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50",
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}

              {/* Address label with icon */}
              <div className="flex items-center gap-1.5 mb-1">
                {address.label.toLowerCase() === "home" ? (
                  <Home className="h-3.5 w-3.5 text-gray-400" />
                ) : (
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                )}
                <span className="text-sm font-medium text-gray-900">
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
              <p className="text-xs text-gray-600 line-clamp-1">
                {address.recipientName} • {address.phone}
              </p>
              <p className="text-xs text-gray-500 line-clamp-1">
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
            "p-3 rounded-lg border text-left transition-all flex items-center justify-center gap-2",
            selectedAddressId === null
              ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
              : "border-dashed border-gray-300 hover:border-emerald-300 hover:bg-gray-50",
          )}
        >
          <Plus className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-600">Use a different address</span>
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
