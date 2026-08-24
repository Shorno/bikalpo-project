import { AlertCircle, ArrowLeft, Building2, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ListingStatus, PropertyStatus, UnitStatus } from "./types";

export function PropertyPageHeader({
  title,
  description,
  backHref,
  action,
}: {
  title: string;
  description?: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {backHref ? (
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={backHref} aria-label="Go back">
              <ArrowLeft />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const propertyStatusStyles: Record<PropertyStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-gray-200 bg-gray-100 text-gray-600",
  blocked: "border-red-200 bg-red-50 text-red-700",
};

const unitStatusStyles: Record<UnitStatus, string> = {
  vacant: "border-emerald-200 bg-emerald-50 text-emerald-700",
  booked: "border-blue-200 bg-blue-50 text-blue-700",
  occupied: "border-violet-200 bg-violet-50 text-violet-700",
  inactive: "border-gray-200 bg-gray-100 text-gray-600",
};

const listingStatusStyles: Record<ListingStatus, string> = {
  draft: "border-amber-200 bg-amber-50 text-amber-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paused: "border-blue-200 bg-blue-50 text-blue-700",
  closed: "border-gray-200 bg-gray-100 text-gray-600",
};

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", propertyStatusStyles[status])}
    >
      {status}
    </Badge>
  );
}

export function UnitStatusBadge({ status }: { status: UnitStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", unitStatusStyles[status])}
    >
      {status}
    </Badge>
  );
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("capitalize", listingStatusStyles[status])}
    >
      {status === "active" ? "Live" : status}
    </Badge>
  );
}

export function PropertyErrorState({
  message = "We could not load this property information.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-white p-8 text-center">
      <AlertCircle className="mx-auto size-10 text-red-400" />
      <h2 className="mt-3 font-semibold text-gray-900">Something went wrong</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{message}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function PropertiesListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2].map((item) => (
          <div
            key={item}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            <Skeleton className="aspect-[16/7] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PropertyDetailsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-60" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="space-y-5">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

export function PropertyEmptyState() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-10 text-center sm:p-14">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Building2 className="size-7" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-gray-900">
        No properties added yet
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
        Register your first property to create reusable units and prepare for
        To-Let listings.
      </p>
      <Button asChild className="mt-5 bg-emerald-600 hover:bg-emerald-700">
        <Link href="/account/to-let/properties/new">
          <Plus />
          Register Property
        </Link>
      </Button>
    </div>
  );
}

export function InlinePending({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="animate-spin" />
      {label}
    </span>
  );
}
