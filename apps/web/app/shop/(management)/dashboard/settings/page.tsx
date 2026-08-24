"use client";

import {
  CheckCircle2,
  Clock3,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Save,
  ShoppingBag,
  Store,
  User,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useUpdateShopLocation,
  useUpdateShopProfile,
} from "@/hooks/use-shop-owner-api";
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
  const { data: session, isPending, refetch } = authClient.useSession();
  const updateLocationMutation = useUpdateShopLocation();
  const updateProfileMutation = useUpdateShopProfile();

  const user = session?.user as any;
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [shopLogo, setShopLogo] = useState("");
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLat(user.shopLat || "");
    setLng(user.shopLng || "");
    setShopLogo(user.shopLogo || "");
    setOpeningTime(user.shopOpeningTime || "");
    setClosingTime(user.shopClosingTime || "");
  }, [
    user?.id,
    user?.shopClosingTime,
    user?.shopLat,
    user?.shopLng,
    user?.shopLogo,
    user?.shopOpeningTime,
  ]);

  const handleSaveLocation = async () => {
    if (!lat || !lng) return;
    await updateLocationMutation.mutateAsync({ lat, lng });
  };

  const handleSaveProfile = async () => {
    await updateProfileMutation.mutateAsync({
      shopLogo: shopLogo || null,
      openingTime: openingTime || null,
      closingTime: closingTime || null,
    });
    await refetch();
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
  const hasIncompleteHours = Boolean(openingTime) !== Boolean(closingTime);
  const profileImage = shopLogo || user?.image;

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
          {profileImage ? (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border bg-emerald-50">
              <Image
                src={profileImage}
                alt={`${user?.shopName || user?.name || "Shop"} logo`}
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <Store className="size-7 text-emerald-600" />
            </div>
          )}
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
        </div>
      </div>

      {/* Brand and hours card */}
      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ImageIcon className="size-5 text-emerald-600" />
            Storefront details
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Add your shop logo and tell customers when your store is open.
          </p>
        </div>

        <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1fr)]">
          <div className="space-y-3">
            <div>
              <Label>Shop logo</Label>
              <p className="mt-1 text-xs text-gray-500">
                Use a square PNG, JPG, WebP, or SVG for the best result.
              </p>
            </div>
            <ImageUploader
              value={shopLogo}
              onChange={setShopLogo}
              folder={`shop-logos/${user?.id || "shop"}`}
              maxSizeMB={2}
              disabled={updateProfileMutation.isPending}
              className="min-h-48 bg-emerald-50/30"
            />
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-medium text-emerald-950">
                  Daily operating hours
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-800/80">
                  These hours apply every day. Overnight schedules are
                  supported—for example, 6:00 PM to 2:00 AM.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shop-opening-time">Opening time</Label>
                <Input
                  id="shop-opening-time"
                  type="time"
                  value={openingTime}
                  onChange={(event) => setOpeningTime(event.target.value)}
                  disabled={updateProfileMutation.isPending}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shop-closing-time">Closing time</Label>
                <Input
                  id="shop-closing-time"
                  type="time"
                  value={closingTime}
                  onChange={(event) => setClosingTime(event.target.value)}
                  disabled={updateProfileMutation.isPending}
                  className="h-11"
                />
              </div>
            </div>

            {hasIncompleteHours && (
              <p className="text-sm text-red-600" role="alert">
                Set both opening and closing times, or clear both fields.
              </p>
            )}

            <div className="flex justify-end border-t pt-5">
              <Button
                onClick={handleSaveProfile}
                disabled={hasIncompleteHours || updateProfileMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 size-4" />
                    Save storefront details
                  </>
                )}
              </Button>
            </div>
          </div>
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
