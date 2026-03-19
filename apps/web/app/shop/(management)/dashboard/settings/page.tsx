"use client";

import {
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";

export default function ShopSettingsPage() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  const user = session?.user as any;
  const status = user?.sellerStatus || "pending";

  const statusColors: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700",
    pending: "bg-yellow-100 text-yellow-700",
    rejected: "bg-red-100 text-red-700",
    disabled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shop Profile</h1>

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Header */}
        <div className="p-6 border-b flex items-start gap-4">
          <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Store className="w-7 h-7 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              {user?.shopName || user?.name || "My Shop"}
              {status === "approved" && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
            </h2>
            <span
              className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColors[status] || statusColors.pending}`}
            >
              {status}
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="Owner Name"
            value={user?.ownerName || user?.name || "—"}
          />
          <InfoRow
            icon={<Mail className="w-4 h-4" />}
            label="Email"
            value={user?.email || "—"}
          />
          <InfoRow
            icon={<ShoppingBag className="w-4 h-4" />}
            label="Business Type"
            value={user?.businessType || "—"}
            capitalize
          />
          <InfoRow
            icon={<MapPin className="w-4 h-4" />}
            label="Shop Address"
            value={user?.shopAddress || "Not set"}
          />
          <InfoRow
            icon={<Globe className="w-4 h-4" />}
            label="Shop Slug"
            value={user?.shopSlug || "Not set"}
          />
          <InfoRow
            icon={<User className="w-4 h-4" />}
            label="Role"
            value={user?.role || "—"}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  capitalize,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-gray-400 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p
          className={`text-sm font-medium text-gray-900 ${capitalize ? "capitalize" : ""}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
