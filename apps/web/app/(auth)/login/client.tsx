"use client";

import { isShopPortalRole } from "@bikalpo-project/auth/shop-staff-access";
import { AuthModal } from "@/components/features/auth/auth-modal";
import { PublicHeader } from "@/components/layout/public-header";
import { authClient } from "@/lib/auth-client";
import { getDeliverySubdomainUrl } from "@/lib/delivery-routing";
import { getSalesSubdomainUrl } from "@/lib/sales-routing";
import { getShopSubdomainUrl } from "@/lib/shop-routing";

function getSafeConsumerRedirect() {
  const redirect = new URLSearchParams(window.location.search).get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
    return null;
  }

  try {
    const target = new URL(redirect, window.location.origin);
    if (
      target.origin !== window.location.origin ||
      target.pathname.startsWith("//")
    ) {
      return null;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function LoginPageClient() {
  const handleComplete = async () => {
    // Read role cookie to determine redirect destination
    const roleCookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith("user-role="));
    let role = roleCookie?.split("=")[1];
    let warehouseId: string | null | undefined;

    try {
      const session = await authClient.getSession();
      const user = session.data?.user as
        | { role?: string; warehouseId?: string | null }
        | undefined;
      role = user?.role || role;
      warehouseId = user?.warehouseId;
    } catch {
      /* cookie fallback */
    }

    if (isShopPortalRole(role)) {
      window.location.href = `${getShopSubdomainUrl()}/dashboard`;
    } else if (role === "salesman") {
      window.location.href = `${getSalesSubdomainUrl()}/dashboard`;
    } else if (role === "deliveryman" && warehouseId) {
      window.location.href = `${getDeliverySubdomainUrl()}/dashboard`;
    } else if (role === "admin" || role === "deliveryman") {
      window.location.href = "/dashboard";
    } else if (!role || role === "consumer" || role === "customer") {
      window.location.href = getSafeConsumerRedirect() || "/";
    } else {
      window.location.href = "/";
    }
  };

  return (
    <>
      <PublicHeader />
      <div className="flex h-[calc(100vh-105px)] items-center justify-center bg-[#FAF6F6] p-4 md:p-10">
        <AuthModal isOpen={true} onClose={handleComplete} embedded />
      </div>
    </>
  );
}
