"use client";

import { Loader2, Phone, Save, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile, useUpdateProfile } from "@/hooks/use-customer-api";

export function ConsumerProfileClient() {
  const { data, isLoading, isError } = useProfile();
  const updateProfile = useUpdateProfile();
  const router = useRouter();

  const [formData, setFormData] = useState({
    ownerName: "",
    phoneNumber: "",
    whatsapp: "",
  });

  useEffect(() => {
    if (data?.profile) {
      setFormData({
        ownerName: data.profile.ownerName || data.profile.name || "",
        phoneNumber: data.profile.phoneNumber || "",
        whatsapp: data.profile.whatsapp || "",
      });
    }
  }, [data]);

  useEffect(() => {
    if (isError) {
      router.push("/login?redirect=/account/profile");
    }
  }, [isError, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.profile) return;

    await updateProfile.mutateAsync({
      ownerName: formData.ownerName,
      phoneNumber: formData.phoneNumber || null,
      whatsapp: formData.whatsapp || null,
      // Pass through existing business fields unchanged
      businessName: data.profile.businessName || "",
      vatNumber: data.profile.vatNumber || null,
      address: data.profile.address || null,
      facebook: data.profile.facebook || null,
    });

    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!data?.profile) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Profile Settings
            </h1>
            <p className="text-sm text-gray-500">
              Manage your personal information
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Read-only Email */}
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={data.profile.email}
              disabled
              className="bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-500">Email cannot be changed</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Full Name */}
            <div className="space-y-2">
              <Label
                htmlFor="ownerName"
                className="text-sm font-medium text-gray-700"
              >
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  Full Name <span className="text-red-500">*</span>
                </span>
              </Label>
              <Input
                id="ownerName"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                placeholder="Enter your name"
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
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              type="submit"
              disabled={updateProfile.isPending}
              className="gap-2"
            >
              {updateProfile.isPending ? (
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
      </div>
    </div>
  );
}
