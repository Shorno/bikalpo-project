import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ADMIN_BASE } from "@/lib/routes";

type SetupPageHeaderProps = {
  title: string;
  description: string;
  count?: number;
  action?: ReactNode;
  secondaryActions?: ReactNode;
};

export function SetupPageHeader({
  title,
  description,
  count,
  action,
  secondaryActions,
}: SetupPageHeaderProps) {
  return (
    <header className="space-y-3 border-b pb-5">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        <Link className="hover:text-foreground" href={ADMIN_BASE}>
          Product System
        </Link>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span aria-current="page">Setup</span>
      </nav>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {count !== undefined && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {count.toLocaleString()} total
              </span>
            )}
          </div>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {(action || secondaryActions) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 [&_button]:min-h-11 sm:[&_button]:min-h-9">
            {secondaryActions}
            {action}
          </div>
        )}
      </div>
    </header>
  );
}
