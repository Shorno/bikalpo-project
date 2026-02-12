/**
 * ORPC-powered Profile page — view & edit profile via ORPC.
 */
"use client";

import { Loader2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useProfile, useUpdateProfile } from "@/hooks/use-customer-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export function OrpcProfilePage() {
  const { data, isLoading, isError } = useProfile();
  const updateProfile = useUpdateProfile();
  const [editing, setEditing] = useState(false);

  const [formData, setFormData] = useState({
    businessName: "",
    ownerName: "",
    phoneNumber: "",
    vatNumber: "",
    address: "",
    facebook: "",
    whatsapp: "",
  });

  useEffect(() => {
    if (data?.profile) {
      const p = data.profile;
      setFormData({
        businessName: p.shopName || p.businessName || "",
        ownerName: p.ownerName || p.name || "",
        phoneNumber: p.phoneNumber || "",
        vatNumber: p.vatNumber || "",
        address: p.address || "",
        facebook: p.facebook || "",
        whatsapp: p.whatsapp || "",
      });
    }
  }, [data]);

  if (isLoading) return <ProfileSkeleton />;

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <User className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">
          Unable to load profile
        </h3>
        <p className="text-sm text-gray-500">Please try again later.</p>
      </div>
    );
  }

  const profile = data?.profile;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile.mutateAsync({
        businessName: formData.businessName,
        ownerName: formData.ownerName,
        phoneNumber: formData.phoneNumber || null,
        vatNumber: formData.vatNumber || null,
        address: formData.address || null,
        facebook: formData.facebook || null,
        whatsapp: formData.whatsapp || null,
      });
      setEditing(false);
    } catch {
      // error handled in hook
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">
            Manage your account information
          </p>
        </div>
        {!editing && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      {editing ? (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Business Name *</Label>
                  <Input
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        businessName: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Owner Name *</Label>
                  <Input
                    value={formData.ownerName}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, ownerName: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Phone Number</Label>
                  <Input
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        phoneNumber: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">VAT Number</Label>
                  <Input
                    value={formData.vatNumber}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, vatNumber: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, address: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Facebook</Label>
                  <Input
                    value={formData.facebook}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, facebook: e.target.value }))
                    }
                    placeholder="https://fb.com/..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">WhatsApp</Label>
                  <Input
                    value={formData.whatsapp}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, whatsapp: e.target.value }))
                    }
                    placeholder="+880..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <ProfileField
                label="Business Name"
                value={profile?.shopName || profile?.businessName}
              />
              <ProfileField
                label="Owner Name"
                value={profile?.ownerName || profile?.name}
              />
              <ProfileField label="Email" value={profile?.email} />
              <ProfileField label="Phone" value={profile?.phoneNumber} />
              <ProfileField label="Address" value={profile?.address} />
              <ProfileField label="VAT Number" value={profile?.vatNumber} />
              <ProfileField label="Facebook" value={profile?.facebook} />
              <ProfileField label="WhatsApp" value={profile?.whatsapp} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <span className="text-gray-500 text-xs">{label}</span>
      <p className="font-medium text-gray-900">{value || "—"}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="border rounded-lg p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
