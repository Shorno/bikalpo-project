"use client";

import Link from "next/link";
import { type ComponentProps, forwardRef, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export const ToLetAccountLink = forwardRef<
  HTMLAnchorElement,
  Omit<ComponentProps<typeof Link>, "href"> & {
    href: string;
  }
>(function ToLetAccountLink({ href, onClick, ...props }, ref) {
  const { data: session, isPending } = authClient.useSession();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isCheckingSession = !isHydrated || isPending;
  const loginDestination = `/login?redirect=${encodeURIComponent(href)}`;
  const destination =
    !isCheckingSession && session?.user ? href : loginDestination;

  return (
    <Link
      ref={ref}
      href={destination}
      aria-disabled={isCheckingSession || undefined}
      onClick={(event) => {
        if (isCheckingSession) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    />
  );
});

ToLetAccountLink.displayName = "ToLetAccountLink";
