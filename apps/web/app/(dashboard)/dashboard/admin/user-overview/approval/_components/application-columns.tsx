"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BUSINESS_NATURES } from "@/constants/seller-registration";
import type { client } from "@/utils/orpc";

export type ApplicationRow = Awaited<
  ReturnType<typeof client.adminApplication.list>
>["items"][number];

export const applicationColumns: ColumnDef<ApplicationRow>[] = [
  {
    accessorKey: "applicationNumber",
    header: "ID Number",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.original.applicationNumber || row.original.id}
      </span>
    ),
  },
  {
    accessorKey: "ownerName",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.ownerName}</span>
    ),
  },
  {
    accessorKey: "location",
    header: "Location",
    cell: ({ row }) => row.original.location || "—",
  },
  {
    accessorKey: "businessNature",
    header: "Business Nature",
    cell: ({ row }) =>
      BUSINESS_NATURES.find(
        (nature) => nature.id === row.original.businessNature,
      )?.label ||
      row.original.businessNature ||
      "—",
  },
  {
    accessorKey: "productTypeName",
    header: "Business Type",
    cell: ({ row }) => row.original.productTypeName || "—",
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
          href={row.original.detailHref}
          aria-label={
            "View request " +
            (row.original.applicationNumber || row.original.ownerName)
          }
        >
          View <ArrowRight className="size-3" aria-hidden />
        </Link>
      </Button>
    ),
  },
];
