"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";
import { cn } from "@/lib/utils";

export type UserKycStatus = "verified" | "pending" | "failed" | "unverified";

export type UserRow = {
  id: string;
  applicationNumber: string | null;
  selectedPlan: string | null;
  planName: string;
  businessName: string;
  ownerName: string;
  phoneNumber: string | null;
  location: string | null;
  kycStatus: UserKycStatus;
  accountStatus: "active" | "pending" | "suspended";
  businessNature: string | null;
  businessNatureLabel: string;
  productTypeName: string | null;
  createdAt: Date | string;
};

const ACCOUNT_STYLES = {
  active: { label: "Active", dot: "bg-emerald-600" },
  pending: { label: "Pending", dot: "bg-amber-500" },
  suspended: { label: "Suspended", dot: "bg-red-500" },
} as const;

const KYC_STYLES = {
  verified: { label: "Verified", dot: "bg-emerald-600" },
  pending: { label: "Pending", dot: "bg-amber-500" },
  failed: { label: "Failed", dot: "bg-red-500" },
  unverified: { label: "Unverified", dot: "bg-muted-foreground/40" },
} as const;

function DotLabel({ config }: { config: { label: string; dot: string } }) {
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

function buildBaseColumns(
  listSegment: "retailers" | "wholesalers",
): ColumnDef<UserRow>[] {
  const isWholesaler = listSegment === "wholesalers";
  return [
    {
      accessorKey: "applicationNumber",
      header: "ID Number",
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium tracking-tight text-foreground">
          {row.original.applicationNumber || "—"}
        </span>
      ),
    },
    {
      accessorKey: "businessName",
      header: "Business Name",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-foreground">
            {row.original.businessName}
          </p>
          {!isWholesaler && (
            <p className="text-xs text-muted-foreground">
              {row.original.ownerName}
            </p>
          )}
        </div>
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
    ...(isWholesaler
      ? ([
          {
            accessorKey: "planName",
            header: "Plan",
            cell: ({ row }) => (
              <span className="text-sm text-muted-foreground">
                {row.original.planName}
              </span>
            ),
          },
        ] satisfies ColumnDef<UserRow>[])
      : ([
          {
            accessorKey: "kycStatus",
            header: "KYC",
            cell: ({ row }) => (
              <DotLabel
                config={
                  KYC_STYLES[row.original.kycStatus] ?? KYC_STYLES.unverified
                }
              />
            ),
          },
          {
            accessorKey: "accountStatus",
            header: "Status",
            cell: ({ row }) => (
              <DotLabel config={ACCOUNT_STYLES[row.original.accountStatus]} />
            ),
          },
        ] satisfies ColumnDef<UserRow>[])),
    {
      accessorKey: "businessNatureLabel",
      header: isWholesaler ? "Business Type" : "Business Nature",
      cell: ({ row }) => (
        <span
          className={
            isWholesaler
              ? "text-sm text-muted-foreground"
              : "text-xs font-medium uppercase tracking-wide text-muted-foreground"
          }
        >
          {row.original.businessNatureLabel}
        </span>
      ),
    },
    ...(!isWholesaler
      ? ([
          {
            accessorKey: "productTypeName",
            header: "Product Type",
            cell: ({ row }) => (
              <span className="text-sm text-muted-foreground">
                {row.original.productTypeName || "—"}
              </span>
            ),
          },
        ] satisfies ColumnDef<UserRow>[])
      : []),
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
          <Link
            href={`${ADMIN_BASE}/user-overview/${listSegment}/${row.original.id}`}
          >
            View
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      ),
    },
  ];
}

export const retailerColumns = buildBaseColumns("retailers");
export const wholesalerColumns = buildBaseColumns("wholesalers");
