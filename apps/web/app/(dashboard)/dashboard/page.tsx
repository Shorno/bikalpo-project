"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { ADMIN_BASE, DELIVERY_BASE, SALES_BASE, WAREHOUSE_BASE } from "@/lib/routes";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;

    if (!session) {
      router.replace("/login");
      return;
    }

    const role = session.user.role;

    switch (role) {
      case "admin":
        router.replace(ADMIN_BASE);
        break;
      case "salesman":
        router.replace(SALES_BASE);
        break;
      case "deliveryman":
        router.replace(DELIVERY_BASE);
        break;
      case "shop_owner":
        router.replace(ADMIN_BASE);
        break;
      case "warehouse":
        router.replace(WAREHOUSE_BASE);
        break;
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
