"use client";

import {
  Building2,
  Facebook,
  Loader2,
  MapPin,
  Phone,
  Save,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type ProfileFormData,
  updateProfile,
} from "@/actions/profile/profile-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProfileFormProps {
  initialData: {
    name: string;
    email: string;
    businessName: string | null;
    ownerName: string | null;
    phoneNumber: string | null;
    vatNumber: string | null;
    address: string | null;
    facebook: string | null;
    whatsapp: string | null;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    businessName: initialData.businessName || "",
    ownerName: initialData.ownerName || initialData.name || "",
    phoneNumber: initialData.phoneNumber || "",
    vatNumber: initialData.vatNumber || "",
    address: initialData.address || "",
    facebook: initialData.facebook || "",
    whatsapp: initialData.whatsapp || "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      const result = await updateProfile(formData as ProfileFormData);

      if (result.success) {
        toast.success("Profile updated successfully");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Read-only Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email Address
        </Label>
        <Input
          id="email"
          type="email"
          value={initialData.email}
          disabled
          className="bg-gray-50 text-gray-500"
        />
        <p className="text-xs text-gray-500">Email cannot be changed</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Business Name */}
        <div className="space-y-2">
          <Label
            htmlFor="businessName"
            className="text-sm font-medium text-gray-700"
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              Business Name <span className="text-red-500">*</span>
            </span>
          </Label>
          <Input
            id="businessName"
            name="businessName"
            value={formData.businessName}
            onChange={handleChange}
            placeholder="Enter business name"
            required
          />
        </div>

        {/* Owner Name */}
        <div className="space-y-2">
          <Label
            htmlFor="ownerName"
            className="text-sm font-medium text-gray-700"
          >
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              Owner Name <span className="text-red-500">*</span>
            </span>
          </Label>
          <Input
            id="ownerName"
            name="ownerName"
            value={formData.ownerName}
            onChange={handleChange}
            placeholder="Enter owner name"
            required
          />
        </div>

        {/* Phone Number */}
        <div className="space-y-2">
          <Label
            htmlFor="phoneNumber"
            className="text-sm font-medium text-gray-700"
          >
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              Phone Number
            </span>
          </Label>
          <Input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            value={formData.phoneNumber}
            onChange={handleChange}
            placeholder="e.g. +880 1XXXXXXXXX"
          />
        </div>

        {/* VAT/TIN Number */}
        <div className="space-y-2">
          <Label
            htmlFor="vatNumber"
            className="text-sm font-medium text-gray-700"
          >
            VAT/TIN Number
          </Label>
          <Input
            id="vatNumber"
            name="vatNumber"
            value={formData.vatNumber}
            onChange={handleChange}
            placeholder="Enter VAT or TIN number"
          />
        </div>

        {/* WhatsApp */}
        <div className="space-y-2">
          <Label
            htmlFor="whatsapp"
            className="text-sm font-medium text-gray-700"
          >
            WhatsApp Number
          </Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            value={formData.whatsapp}
            onChange={handleChange}
            placeholder="e.g. +880 1XXXXXXXXX"
          />
        </div>

        {/* Facebook */}
        <div className="space-y-2">
          <Label
            htmlFor="facebook"
            className="text-sm font-medium text-gray-700"
          >
            <span className="flex items-center gap-2">
              <Facebook className="h-4 w-4 text-gray-400" />
              Facebook Page URL
            </span>
          </Label>
          <Input
            id="facebook"
            name="facebook"
            type="url"
            value={formData.facebook}
            onChange={handleChange}
            placeholder="https://facebook.com/yourpage"
          />
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address" className="text-sm font-medium text-gray-700">
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            Business Address
          </span>
        </Label>
        <Textarea
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          placeholder="Enter full business address"
          rows={3}
        />
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-4 border-t">
        <Button type="submit" disabled={isPending} className="gap-2">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Update Profile
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
