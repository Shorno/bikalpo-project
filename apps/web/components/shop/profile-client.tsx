/**
 * Client component for customer profile using Customer API
 */
"use client";

import { User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProfileForm } from "@/components/account/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-customer-api";

export function ProfileClient() {
  const { data, isLoading, isError } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (isError) {
      router.push("/login?redirect=/shop/account/profile");
    }
  }, [isError, router]);

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
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!data?.profile) {
    return null;
  }

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
              Manage your business information
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <ProfileForm initialData={data.profile} />
      </div>
    </div>
  );
}
