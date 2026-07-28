import { AlertCircle, Inbox, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { FulfillmentOwnerAdapter } from "./owner-adapters";

export function FulfillmentDesk({
  adapter,
  activeHref,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  adapter: FulfillmentOwnerAdapter;
  activeHref: string;
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <header className="rounded-2xl border bg-gradient-to-br from-white via-white to-emerald-50/60 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              {eyebrow ?? adapter.label}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
          {actions ? (
            <div className="flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
        <nav
          className="mt-6 flex gap-2 overflow-x-auto border-t pt-4"
          aria-label="Fulfillment stages"
        >
          {adapter.stages.map((stage, index) => {
            const Icon = stage.icon;
            const active = stage.href === activeHref;
            return (
              <Link
                key={stage.href}
                href={stage.href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[10px]",
                    active ? "bg-white/20" : "bg-slate-100",
                  )}
                >
                  {index + 1}
                </span>
                <Icon className="h-3.5 w-3.5" />
                {stage.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}

export function FulfillmentKpis({
  items,
}: {
  items: Array<{
    label: string;
    value: number | string;
    icon: LucideIcon;
    tone?: "slate" | "amber" | "blue" | "emerald";
  }>;
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
    emerald: "bg-emerald-100 text-emerald-800",
  } as const;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className="shadow-none">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {item.value}
                </p>
              </div>
              <span
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-xl",
                  tones[item.tone ?? "slate"],
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function FulfillmentPanel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b bg-slate-50/60">
        <CardTitle className="text-base">{title}</CardTitle>
        {actions}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export function FulfillmentState({
  loading,
  error,
  empty,
  emptyTitle = "Nothing here yet",
  emptyCopy = "Items will appear here when they reach this stage.",
}: {
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyCopy?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-3 p-8 text-sm text-red-700">
        <AlertCircle className="h-5 w-5" />
        Unable to load this fulfillment desk.
      </div>
    );
  }
  if (empty) {
    return (
      <div className="grid place-items-center px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100">
          <Inbox className="h-6 w-6 text-slate-500" />
        </span>
        <h3 className="mt-4 font-medium">{emptyTitle}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {emptyCopy}
        </p>
      </div>
    );
  }
  return null;
}

export function FulfillmentStatus({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Pending Approval",
    ready_for_dispatch: "Ready for Dispatch",
    invoiced: "Invoiced",
    not_assigned: "Not Grouped",
    pending_assignment: "Pending Assignment",
    assigned: "Assigned",
    out_for_delivery: "Out for Delivery",
    ready_for_pickup: "Ready for Pickup",
    delivered: "Delivered",
    picked_up: "Picked Up",
    completed: "Completed",
    failed: "Failed",
    returned: "Returned",
    cancelled: "Cancelled",
  };
  const success = ["delivered", "picked_up", "completed"].includes(status);
  const danger = ["failed", "returned", "cancelled"].includes(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap font-medium",
        success && "border-emerald-200 bg-emerald-50 text-emerald-800",
        danger && "border-red-200 bg-red-50 text-red-800",
        !success && !danger && "border-blue-200 bg-blue-50 text-blue-800",
      )}
    >
      {labels[status] ?? status.replaceAll("_", " ")}
    </Badge>
  );
}

export function DeskLinkButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button asChild variant="outline">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
