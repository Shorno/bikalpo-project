"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function AlertDashboardLink() {
  const { data: session, isPending } = authClient.useSession();
  const destination = "/account/to-let/alerts";
  return <Link
    href={session?.user ? destination : `/login?redirect=${encodeURIComponent(destination)}`}
    aria-disabled={isPending || undefined}
    onClick={event => { if (isPending) event.preventDefault(); }}
    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  >My To-Let Alerts <ArrowRight className="size-4" aria-hidden="true" /></Link>;
}
