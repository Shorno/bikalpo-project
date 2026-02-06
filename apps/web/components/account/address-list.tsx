"use client";

import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { AddressCard } from "@/components/account/address-card";
import { AddressForm } from "@/components/account/address-form";
import { Button } from "@/components/ui/button";
import type { Address } from "@/db/schema/address";

interface AddressListProps {
  addresses: Address[];
}

export function AddressList({ addresses }: AddressListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  if (isAdding || editingAddress) {
    return (
      <AddressForm
        address={editingAddress}
        onClose={() => {
          setIsAdding(false);
          setEditingAddress(null);
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-emerald-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Your Addresses
          </h2>
        </div>
        <Button
          onClick={() => setIsAdding(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Add Address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <MapPin className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 text-lg mb-2">No addresses saved</p>
          <p className="text-gray-400 text-sm mb-6">
            Add a delivery address to make checkout faster
          </p>
          <Button
            onClick={() => setIsAdding(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Add Your First Address
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <AddressCard
              key={addr.id}
              address={addr}
              onEdit={setEditingAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
