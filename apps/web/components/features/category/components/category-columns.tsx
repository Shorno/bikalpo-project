"use client";

import type { Category, SubCategory } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { ActiveStatusBadge } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";

export interface CategoryWithSubcategories extends Category {
  subCategory: SubCategory[];
  type?: { id: number; name: string } | null;
}

export function useCategoryColumns() {
  return useMemo<ColumnDef<CategoryWithSubcategories, unknown>[]>(
    () => [
      {
        accessorKey: "skuCode",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.skuCode || "—"}
          </span>
        ),
      },
      {
        accessorFn: (row) => row.type?.name ?? "",
        id: "typeName",
        header: "Type",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.type?.name ?? (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Category Name",
        cell: ({ row }) => (
          <Link
            className="font-medium hover:text-primary hover:underline"
            href={`${ADMIN_BASE}/categories/${row.original.id}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <ActiveStatusBadge isActive={row.original.isActive} />
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button asChild className="h-9" size="sm" variant="ghost">
              <Link href={`${ADMIN_BASE}/categories/${row.original.id}`}>
                View
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );
}
