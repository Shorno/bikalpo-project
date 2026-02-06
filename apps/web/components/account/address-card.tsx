"use client";

import { Edit2, MapPin, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteAddress,
  setDefaultAddress,
} from "@/actions/address/address-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Address } from "@/db/schema/address";

interface AddressCardProps {
  address: Address;
  onEdit: (address: Address) => void;
}

export function AddressCard({ address, onEdit }: AddressCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this address?")) return;

    setIsDeleting(true);
    const result = await deleteAddress(address.id);
    setIsDeleting(false);

    if (result.success) {
      toast.success("Address deleted");
    } else {
      toast.error(result.error || "Failed to delete");
    }
  };

  const handleSetDefault = async () => {
    setIsSettingDefault(true);
    const result = await setDefaultAddress(address.id);
    setIsSettingDefault(false);

    if (result.success) {
      toast.success("Default address updated");
    } else {
      toast.error(result.error || "Failed to set default");
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 relative">
      {/* Default Badge */}
      {address.isDefault && (
        <Badge className="absolute top-3 right-3 bg-blue-100 text-blue-700 hover:bg-blue-100">
          Default
        </Badge>
      )}

      {/* Label */}
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-4 w-4 text-gray-400" />
        <span className="font-semibold text-gray-900">{address.label}</span>
      </div>

      {/* Address Details */}
      <div className="space-y-1 text-sm text-gray-600 mb-4">
        <p className="font-medium text-gray-900">{address.recipientName}</p>
        <p>{address.phone}</p>
        <p>{address.address}</p>
        <p>
          {address.city}
          {address.area && `, ${address.area}`}
          {address.postalCode && ` - ${address.postalCode}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(address)}
          className="gap-1.5"
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
        {!address.isDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSetDefault}
            disabled={isSettingDefault}
            className="gap-1.5 ml-auto"
          >
            <Star className="h-3.5 w-3.5" />
            Set as Default
          </Button>
        )}
      </div>
    </div>
  );
}
