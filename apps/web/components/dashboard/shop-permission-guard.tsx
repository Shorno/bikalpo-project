"use client";

import { canPermissionMapAccessPath } from "@bikalpo-project/auth/shop-permissions";
import { LockKeyholeIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useShopMyAccess } from "@/hooks/use-shop-staff-api";

export function ShopPermissionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const access = useShopMyAccess();

  if (access.isPending) {
    return <div className="h-40 animate-pulse rounded-xl border bg-muted/40" />;
  }
  if (
    access.isError ||
    !access.data ||
    (access.data.actor !== "owner" &&
      !canPermissionMapAccessPath(access.data.permissions, pathname))
  ) {
    return (
      <div className="mx-auto flex min-h-[420px] max-w-xl flex-col items-center justify-center rounded-2xl border bg-card p-10 text-center shadow-sm">
        <div className="mb-4 rounded-full bg-amber-50 p-3 text-amber-700">
          <LockKeyholeIcon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">This page is not in your role</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the shop owner to add this page to your assigned role. The sidebar
          only shows pages you can open.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link href="/dashboard">Return to dashboard</Link>
        </Button>
      </div>
    );
  }

  return children;
}
