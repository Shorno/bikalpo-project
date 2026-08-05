"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { ArrowRight } from "lucide-react";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BUSINESS_NATURES } from "@/constants/seller-registration";

import { cn } from "@/lib/utils";

export type ApplicationRow = {
  id: string;

  type: "seller" | "warehouse";

  applicationNumber: string | null;

  businessName: string;

  ownerName: string;

  phoneNumber: string;

  location: string | null;

  businessNature: string | null;

  businessType: string | null;

  status: "pending" | "approved" | "rejected";

  createdAt: Date | string;

  detailHref: string;
};

const STATUS_STYLES = {
  pending: { label: "Pending", dot: "bg-amber-500" },

  approved: { label: "Approved", dot: "bg-emerald-600" },

  rejected: { label: "Rejected", dot: "bg-red-500" },
} as const;

function formatNature(nature: string | null) {
  if (!nature) return "—";

  return (
    BUSINESS_NATURES.find((n) => n.id === nature)?.label ||
    nature.replace(/_/g, " ")
  );
}

function ApplicationStatus({ status }: { status: ApplicationRow["status"] }) {
  const config = STATUS_STYLES[status];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)}
        aria-hidden
      />
      {config.label}
    </span>
  );
}

export const applicationColumns: ColumnDef<ApplicationRow>[] = [
  {
    accessorKey: "applicationNumber",

    header: "Request ID",

    cell: ({ row }) => (
      <span className="font-mono text-xs font-medium tracking-tight text-foreground">
        {row.original.applicationNumber || "—"}
      </span>
    ),
  },

  {
    accessorKey: "ownerName",

    header: "Name",

    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">{row.original.ownerName}</p>
        <p className="text-xs text-muted-foreground">
          {row.original.businessName}
        </p>
      </div>
    ),
  },

  {
    accessorKey: "phoneNumber",

    header: "Phone",

    cell: ({ row }) => (
      <span className="text-sm tabular-nums text-foreground">
        {row.original.phoneNumber}
      </span>
    ),
  },

  {
    accessorKey: "location",

    header: "Location",

    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.location || "—"}
      </span>
    ),
  },

  {
    accessorKey: "businessNature",

    header: "Business Nature",

    cell: ({ row }) => (
      <span className="text-sm">
        {formatNature(row.original.businessNature)}
      </span>
    ),
  },

  {
    accessorKey: "businessType",

    header: "Business Type",

    cell: ({ row }) => (
      <span className="text-sm">{row.original.businessType || "—"}</span>
    ),
  },

  {
    accessorKey: "type",

    header: "Type",

    cell: ({ row }) => (
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {row.original.type === "warehouse" ? "Warehouse" : "Seller"}
      </span>
    ),
  },

  {
    accessorKey: "status",

    header: "Status",

    cell: ({ row }) => <ApplicationStatus status={row.original.status} />,
  },

  {
    id: "actions",

    header: "Action",

    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-xs"
        asChild
      >
        <Link href={row.original.detailHref}>
          View
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    ),
  },
];
