"use client";

import {
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Save,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateShopLocation } from "@/hooks/use-shop-owner-api";
import { authClient } from "@/lib/auth-client";

const AddressPicker = dynamic(
  () =>
    import("@/components/shared/address-picker").then(
      (mod) => mod.AddressPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[250px] bg-muted animate-pulse rounded-lg flex items-center justify-center text-sm text-muted-foreground">
        Loading map...
      </div>
    ),
  },
);

export default function ShopSettingsPage() {
  const { data: session, isPending } = authClient.useSession();
  const updateLocationMutation = useUpdateShopLocation();

  const user = session?.user as any;
  const [lat, setLat] = useState(user?.shopLat || "");
  const [lng, setLng] = useState(user?.shopLng || "");

  // Sync when session loads
  if (user?.shopLat && !lat) setLat(user.shopLat);
  if (user?.shopLng && !lng) setLng(user.shopLng);

  const handleSaveLocation = async () => {
    if (!lat || !lng) return;
    await updateLocationMutation.mutateAsync({ lat, lng });
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

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

      {/* Location Picker Card */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Shop Location
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Pin your shop&apos;s exact location on the map. This is used to
            match you with nearby open orders.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Current coordinates */}
          {lat && lng && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">Current coordinates:</span>
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
              </code>
            </div>
          )}

          {/* Map */}
          <AddressPicker
            lat={lat}
            lng={lng}
            onLocationChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
            onAddressResolved={() => {}}
            height="300px"
          />

          {/* Save button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveLocation}
              disabled={!lat || !lng || updateLocationMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateLocationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Location
                </>
              )}
            </Button>
          </div>
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
