"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { getDeliverySubdomainUrl } from "@/lib/delivery-routing";
import { ADMIN_BASE } from "@/lib/routes";
import { getSalesSubdomainUrl } from "@/lib/sales-routing";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      window.location.href = "/";
      return;
    }

    const role = session.user.role;

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
      case "shop_owner": {
        // Update role cookie so proxy allows shop subdomain access
        document.cookie = `user-role=shop_owner;path=/;domain=.bikalpo.localhost;max-age=${60 * 60 * 24 * 30}`;
        const shopUrl =
          process.env.NEXT_PUBLIC_SHOP_SUBDOMAIN_URL ||
          "http://shop.bikalpo.localhost:3001";
        window.location.href = `${shopUrl}/dashboard`;
        return;
      }
      case "warehouse":
        window.location.href =
          process.env.NEXT_PUBLIC_WAREHOUSE_SUBDOMAIN_URL ||
          "http://warehouse.bikalpo.localhost:3001";
        return;
      case "consumer":
        // Consumers go to home page
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
