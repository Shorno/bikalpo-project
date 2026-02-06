import { User } from "lucide-react";
import { redirect } from "next/navigation";
import { getProfile } from "@/actions/profile/profile-actions";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata = {
  title: "Profile Settings",
};

export default async function ProfilePage() {
  const profile = await getProfile();

  if (!profile) {
    redirect("/login?redirect=/account/profile");
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
        <ProfileForm initialData={profile} />
      </div>
    </div>
  );
}
