"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { ADMIN_BASE, DELIVERY_BASE, SALES_BASE } from "@/lib/routes";

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
      case "customer": {
        window.location.href =
          process.env.NEXT_PUBLIC_APP_SUBDOMAIN_URL ||
          "http://app.b2b.localhost:3000";
        break;
      }
      case "guest":
        // Unapproved users - show pending approval
        router.replace("/pending-approval");
        break;
      default:
        // Fallback for unknown roles
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
