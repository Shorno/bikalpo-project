"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Syncs the user's role from their auth session to a `user-role` cookie.
 * The proxy middleware reads this cookie to route users to the correct
 * subdomain (e.g. shop_owner → shop subdomain).
 *
 * This component should be placed in the root layout so it runs on every page.
 */
export function RoleCookieSync() {
  const { data: session } = authClient.useSession();

  useEffect(() => {
    const role = session?.user?.role;
    if (role) {
      // Set cookie with domain so it's shared across subdomains
      const domain = window.location.hostname.replace(/^(shop|b2b)\./, "");
      document.cookie = `user-role=${role}; path=/; domain=.${domain}; max-age=${60 * 60 * 24 * 30}`; // 30 days
    }
  }, [session?.user?.role]);

  return null;
}
