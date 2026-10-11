"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import {
  ActiveStatusBadge,
  SetupViewButton,
} from "@/components/features/product-setup";
import { ADMIN_BASE } from "@/lib/routes";

export interface CoreProductWithRelations {
  id: number;
  sku: string;
  catalogCode: string;
  shortCode: string | null;
  name: string;
  slug: string;
  description: string | null;
  image: string;
  isActive: boolean;
  brandCreationMode: "single" | "batch";
  categoryId: number;
  subCategoryId: number | null;
  hasConfiguration?: boolean;
  configuredBrandCount?: number;
  addableBrandCount?: number;
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
        id: "catalogCode",
        header: "Catalog ID",
        cell: ({ row }) => (
          <span className="flex flex-col font-mono text-xs tabular-nums">
            <span>{row.original.catalogCode || row.original.sku}</span>
            {row.original.shortCode && (
              <span className="text-muted-foreground">
                {row.original.shortCode}
              </span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Product name",
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
            <SetupViewButton
              href={`${ADMIN_BASE}/core-products/${row.original.id}`}
            />
          </div>
        ),
      },
    ],
    [],
  );
}
