import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Table } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function SetupDetailHeader({
  backHref,
  backLabel,
  name,
  code,
  status,
  hierarchy,
  actions,
}: {
  backHref: string;
  backLabel: string;
  name: string;
  code?: ReactNode;
  status?: ReactNode;
  hierarchy?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="space-y-4 border-b pb-5">
      <Button asChild className="-ml-3 h-11 sm:h-9" variant="ghost">
        <Link href={backHref}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
      </Button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
            {status}
          </div>
          {(code || hierarchy) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {code && (
                <span className="font-mono text-xs tabular-nums">{code}</span>
              )}
              {hierarchy}
            </div>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function SetupMetricStrip({
  metrics,
}: {
  metrics: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <div
          className="border-b px-4 py-3 last:border-b-0 sm:border-r sm:[&:nth-child(even)]:border-r-0 lg:border-b-0 lg:[&:nth-child(even)]:border-r lg:last:border-r-0"
          key={`${metric.label}-${index}`}
        >
          <dt className="text-xs font-medium text-muted-foreground">
            {metric.label}
          </dt>
          <dd className="mt-1 font-mono text-sm font-semibold tabular-nums">
            {metric.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SetupSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border">
      <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function SetupEmptySection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function SetupRelatedTable({
  children,
  className,
  tableClassName,
}: {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table className={tableClassName}>{children}</Table>
    </div>
  );
}

export function SetupErrorState({
  title = "Unable to load setup data",
  description = "Check the connection and try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center"
      role="alert"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      {onRetry && (
        <Button
          className="mt-4 h-11 sm:h-9"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      )}
    </div>
  );
}
