"use client";

import { authorizeShopPermission } from "@bikalpo-project/auth/shop-permissions";
import { StoreItemRequestInbox } from "@/components/storefront/store-item-requests";
import { Button } from "@/components/ui/button";
import { useShopMyAccess } from "@/hooks/use-shop-staff-api";
import { authClient } from "@/lib/auth-client";

export default function ItemRequestInboxPage() {
  const { data: session } = authClient.useSession();
  const access = useShopMyAccess();
  if (access.isError)
    return (
      <div className="p-6">
        <p role="alert">Couldn’t load store access.</p>
        <Button onClick={() => void access.refetch()}>Try again</Button>
      </div>
    );
  if (!session?.user || !access.data)
    return (
      <p role="status" className="p-6">
        Loading store access…
      </p>
    );
  return (
    <StoreItemRequestInbox
      key={session.user.id}
      viewerId={session.user.id}
      canRespond={authorizeShopPermission(
        access.data.permissions,
        "shop_support",
        "update",
      )}
    />
  );
}
