"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { ActiveStatusBadge } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";

export interface CoreProductWithRelations {
  id: number;
  sku: string;
  composedSku?: string;
  name: string;
  slug: string;
  description: string | null;
  image: string;
  isActive: boolean;
  categoryId: number;
  subCategoryId: number | null;
  hasConfiguration?: boolean;
  configuredBrandCount?: number;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: number;
    name: string;
    slug: string;
    typeId: number | null;
    type?: { id: number; name: string; skuCode?: string | null } | null;
  };
  subCategory: { id: number; name: string } | null;
}

export function useCoreProductColumns() {
  return useMemo<ColumnDef<CoreProductWithRelations, unknown>[]>(
    () => [
      {
        id: "composedSku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.composedSku || row.original.sku}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Core Identity name",
        cell: ({ row }) => (
          <Link
            className="font-medium hover:text-primary hover:underline"
            href={`${ADMIN_BASE}/core-products/${row.original.id}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "subCategory",
        header: "Sub Category",
        cell: ({ row }) => row.original.subCategory?.name ?? "—",
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => row.original.category.name,
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
              <Link href={`${ADMIN_BASE}/core-products/${row.original.id}`}>
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
