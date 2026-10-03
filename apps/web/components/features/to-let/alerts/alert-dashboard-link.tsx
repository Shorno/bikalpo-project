"use client";

import { Bell } from "lucide-react";
import { toLetPrimaryButton } from "@/components/features/to-let/to-let-button";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function AlertDashboardLink() {
  const { data: session, isPending } = authClient.useSession();
  const destination = "/account/to-let/alerts";
  return <Link
    href={session?.user ? destination : `/login?redirect=${encodeURIComponent(destination)}`}
    aria-disabled={isPending || undefined}
    onClick={event => { if (isPending) event.preventDefault(); }}
    className={`${toLetPrimaryButton} min-h-11 shrink-0 px-5`}
  ><Bell className="size-4" aria-hidden="true" /> My To-Let Alerts</Link>;
}
