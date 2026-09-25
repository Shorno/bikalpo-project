"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";

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

function buildBaseColumns(
  listSegment: "retailers" | "wholesalers",
): ColumnDef<UserRow>[] {
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
        <p className="font-medium text-foreground">
          {row.original.businessName}
        </p>
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
      accessorKey: "planName",
      header: "Plan",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.planName}
        </span>
      ),
    },
    {
      accessorKey: "businessNatureLabel",
      header: listSegment === "retailers" ? "Type" : "Business Type",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.businessNatureLabel}
        </span>
      ),
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
