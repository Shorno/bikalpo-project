"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isShopPortalRole } from "@bikalpo-project/auth/shop-staff-access";
import { authClient } from "@/lib/auth-client";
import { getDeliverySubdomainUrl } from "@/lib/delivery-routing";
import { ADMIN_BASE } from "@/lib/routes";
import { getSalesSubdomainUrl } from "@/lib/sales-routing";
import { getShopSubdomainUrl } from "@/lib/shop-routing";

export function DashboardRedirectClient() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      window.location.href = "/";
      return;
    }

    const role = session.user.role;
    if (isShopPortalRole(role)) {
      // biome-ignore lint/suspicious/noDocumentCookie: Proxy routing relies on this role cookie after client auth flows.
      document.cookie = `user-role=${role};path=/;domain=.bikalpo.localhost;max-age=${60 * 60 * 24 * 30}`;
      window.location.href = `${getShopSubdomainUrl()}/dashboard`;
      return;
    }

    switch (role) {
      case "admin":
        router.replace(ADMIN_BASE);
        break;
      case "salesman":
        window.location.href = `${getSalesSubdomainUrl()}/dashboard`;
        return;
      case "deliveryman":
        window.location.href = `${getDeliverySubdomainUrl()}/dashboard`;
        return;
      case "warehouse":
        window.location.href =
          process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL ||
          "http://warehouse.bikalpo.localhost:3001";
        return;
      case "consumer":
        router.replace("/");
        break;
      default:
        router.replace("/");
    }
  }, [session, isPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Redirecting to your dashboard...
        </p>
      </div>
    </div>
  );
}
