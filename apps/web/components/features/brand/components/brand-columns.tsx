"use client";

import type { Brand } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { ActiveStatusBadge } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";

export interface BrandSetupRow extends Brand {
  categories: { id: number; name: string }[];
  productCount: number;
  coreIdentityCount: number;
  variantCount: number;
}

export function useBrandColumns(): ColumnDef<BrandSetupRow, unknown>[] {
  return [
    {
      id: "skuCode",
      header: "SKU",
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums">
          {row.original.skuCode || "—"}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Brand Name",
      cell: ({ row }) => (
        <Link
          className="font-medium hover:text-primary hover:underline"
          href={`${ADMIN_BASE}/brands/${row.original.id}`}
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "categories",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.categories.length > 0
            ? row.original.categories.map((item) => item.name).join(", ")
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <ActiveStatusBadge isActive={row.original.isActive} />,
    },
    {
      id: "usedIn",
      header: "Used In",
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums">
          {row.original.productCount.toLocaleString()} Product
          {row.original.productCount === 1 ? "" : "s"}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Action</div>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button asChild className="h-9" size="sm" variant="ghost">
            <Link href={`${ADMIN_BASE}/brands/${row.original.id}`}>View</Link>
          </Button>
        </div>
      ),
    },
  ];
}
