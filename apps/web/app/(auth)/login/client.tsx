"use client";

import { AuthModal } from "@/components/features/auth/auth-modal";
import { Navbar } from "@/components/layout/navbar";
import { authClient } from "@/lib/auth-client";
import { getDeliverySubdomainUrl } from "@/lib/delivery-routing";

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

    if (role === "shop_owner") {
      window.location.href = "http://shop.bikalpo.localhost:3001/dashboard";
    } else if (role === "deliveryman" && warehouseId) {
      window.location.href = `${getDeliverySubdomainUrl()}/dashboard`;
    } else if (
      role === "admin" ||
      role === "salesman" ||
      role === "deliveryman"
    ) {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/";
    }
  };

  return (
    <>
      <Navbar />
      <div className="flex h-[calc(100vh-105px)] items-center justify-center bg-[#FAF6F6] p-4 md:p-10">
        <AuthModal isOpen={true} onClose={handleComplete} embedded />
      </div>
    </>
  );
}
