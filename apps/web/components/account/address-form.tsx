"use client";

import { useForm } from "@tanstack/react-form";
import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  type AddressFormData,
  addAddress,
  updateAddress,
} from "@/actions/address/address-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Address } from "@/db/schema/address";

interface AddressFormProps {
  address?: Address | null;
  onClose: () => void;
}

const labelOptions = ["Home", "Office", "Other"];

export function AddressForm({ address, onClose }: AddressFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!address;

  const form = useForm({
    defaultValues: {
      label: address?.label || "Home",
      recipientName: address?.recipientName || "",
      phone: address?.phone || "",
      address: address?.address || "",
      city: address?.city || "",
      area: address?.area || "",
      postalCode: address?.postalCode || "",
      isDefault: address?.isDefault || false,
    },
    onSubmit: async ({ value }) => {
      setIsSubmitting(true);

      const data: AddressFormData = {
        label: value.label,
        recipientName: value.recipientName,
        phone: value.phone,
        address: value.address,
        city: value.city,
        area: value.area || undefined,
        postalCode: value.postalCode || undefined,
        isDefault: value.isDefault,
      };

      const result = isEditing
        ? await updateAddress(address.id, data)
        : await addAddress(data);

      setIsSubmitting(false);

      if (result.success) {
        toast.success(isEditing ? "Address updated" : "Address added");
        onClose();
      } else {
        toast.error(result.error || "Something went wrong");
      }
    },
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEditing ? "Edit Address" : "Add New Address"}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Label Selection */}
        <form.Field name="label">
          {(field) => (
            <Field>
              <FieldLabel>Address Label</FieldLabel>
              <div className="flex gap-2">
                {labelOptions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => field.handleChange(label)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      field.state.value === label
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </form.Field>

        {/* Recipient Name */}
        <form.Field name="recipientName">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Recipient Name *</FieldLabel>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Full name"
              />
            </Field>
          )}
        </form.Field>

        {/* Phone */}
        <form.Field name="phone">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Phone Number *</FieldLabel>
              <Input
                id={field.name}
                type="tel"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
            </Field>
          )}
        </form.Field>

        {/* Address */}
        <form.Field name="address">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Street Address *</FieldLabel>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="House/Flat, Building, Street"
              />
            </Field>
          )}
        </form.Field>

        {/* City and Area */}
        <div className="grid grid-cols-2 gap-4">
          <form.Field name="city">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>City *</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="City"
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="area">
            {(field) => (
              <Field>
                <FieldLabel htmlFor={field.name}>Area</FieldLabel>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Area/Neighborhood"
                />
              </Field>
            )}
          </form.Field>
        </div>

        {/* Postal Code */}
        <form.Field name="postalCode">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Postal Code</FieldLabel>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Postal/ZIP Code"
              />
            </Field>
          )}
        </form.Field>

        {/* Set as Default */}
        <form.Field name="isDefault">
          {(field) => (
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={field.state.value}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
              />
              <label htmlFor="isDefault" className="text-sm text-gray-700">
                Set as default address
              </label>
            </div>
          )}
        </form.Field>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Update Address" : "Save Address"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
