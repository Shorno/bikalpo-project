"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, UserRound } from "lucide-react";
import { ToLetAccountLink } from "@/components/features/to-let/to-let-account-link";
import { LandingFooter } from "@/components/features/landing/landing-footer";

export function PublicFooter() {
  const pathname = usePathname();
  return <>
    <LandingFooter />
    {pathname === "/to-let" && <nav aria-label="To-Let mobile navigation" className="grid grid-cols-2 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <Link href="/" className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-primary"><Home className="size-5" aria-hidden="true" />Home</Link>
      <ToLetAccountLink href="/account/to-let" className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium"><UserRound className="size-5" aria-hidden="true" />Account</ToLetAccountLink>
    </nav>}
  </>;
}
