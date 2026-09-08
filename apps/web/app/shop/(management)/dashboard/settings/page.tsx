"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Clock3,
  FileCheck2,
  Loader2,
  Save,
  Settings2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PasswordSecuritySection } from "@/components/features/settings/password-security-section";
import { RetailerSubscriptionSection } from "@/components/features/settings/retailer-subscription";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateShopProfile } from "@/hooks/use-shop-owner-api";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export default function ShopSettingsPage() {
  const {
    data: session,
    isPending: isSessionPending,
    refetch,
  } = authClient.useSession();
  const user = session?.user;
  const profileQuery = useQuery({
    ...orpc.shopOwner.getMyRegistrationProfile.queryOptions(),
    enabled: Boolean(user?.id),
    retry: false,
  });
  const mutation = useUpdateShopProfile();
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setOpeningTime(user.shopOpeningTime || "");
    setClosingTime(user.shopClosingTime || "");
  }, [user?.id, user?.shopClosingTime, user?.shopOpeningTime]);

  const hasIncompleteHours = Boolean(openingTime) !== Boolean(closingTime);
  const hoursChanged =
    openingTime !== (user?.shopOpeningTime || "") ||
    closingTime !== (user?.shopClosingTime || "");

  const saveHours = async () => {
    await mutation.mutateAsync({
      openingTime: openingTime || null,
      closingTime: closingTime || null,
    });
    await refetch();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950">
          General Settings
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
          Manage the retail account, storefront availability, subscription, and
          login security.
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="grid gap-5 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
          {isSessionPending || profileQuery.isPending ? (
            <>
              <Skeleton className="size-16 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-80 max-w-full" />
              </div>
              <Skeleton className="h-9 w-32" />
            </>
          ) : (
            <>
              <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-xl bg-[#003178]/10 text-[#003178]">
                {user?.shopLogo ? (
                  <Image
                    src={user.shopLogo}
                    alt={`${user.shopName || "Retail business"} logo`}
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                ) : (
                  <FileCheck2 className="size-7" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-gray-950">
                    Registration Profile
                  </h2>
                  {profileQuery.data && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {profileQuery.data.profileCompletion}% complete
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  View or update the complete business registration for{" "}
                  <span className="font-medium text-gray-700">
                    {user?.shopName || "this retail account"}
                  </span>
                  .
                </p>
              </div>
              <Button
                asChild
                className="w-full bg-[#003178] hover:bg-[#00255c] sm:w-auto"
              >
                <Link href="/dashboard/settings/profile">
                  Open profile
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section
        className="overflow-hidden rounded-xl border border-gray-200 bg-white"
        aria-labelledby="storefront-settings-heading"
      >
        <div className="flex items-start gap-3 border-b bg-gray-50/70 p-5 sm:p-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#003178]/10 text-[#003178]">
            <Clock3 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="storefront-settings-heading"
              className="font-semibold text-gray-950"
            >
              Storefront hours
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Set the operating hours shown on the public storefront.
            </p>
          </div>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <div className="grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shop-opening-time">Opening time</Label>
              <Input
                id="shop-opening-time"
                type="time"
                value={openingTime}
                onChange={(event) => setOpeningTime(event.target.value)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-closing-time">Closing time</Label>
              <Input
                id="shop-closing-time"
                type="time"
                value={closingTime}
                onChange={(event) => setClosingTime(event.target.value)}
                disabled={mutation.isPending}
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
              onClick={() => void saveHours()}
              disabled={
                hasIncompleteHours || mutation.isPending || !hoursChanged
              }
              className="bg-[#003178] hover:bg-[#00255c]"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Save hours
            </Button>
          </div>
        </div>
      </section>

      <RetailerSubscriptionSection />
      <PasswordSecuritySection
        phoneNumber={user?.phoneNumberVerified ? user.phoneNumber : null}
      />

      <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Settings2
            className="mt-0.5 size-5 text-gray-500"
            aria-hidden="true"
          />
          <div>
            <h2 className="font-semibold text-gray-950">Team and controls</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              User permissions and operational controls remain available in
              their dedicated settings pages.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/user-roles">User management</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/user-roles#operational-controls">
                  Operational controls
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
