"use client";

import type { Brand } from "@bikalpo-project/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import DeleteBrandDialog from "@/components/features/brand/components/delete-brand-dialog";
import EditBrandDialog from "@/components/features/brand/components/edit-brand-dialog";
import {
  ActiveStatusBadge,
  SetupRowActions,
  SetupToggleAction,
} from "@/components/features/product-setup";
import { orpc } from "@/utils/orpc";

export interface BrandSetupRow extends Brand {
  categories: { id: number; name: string }[];
  productCount: number;
  coreIdentityCount: number;
  variantCount: number;
}

export function useBrandColumns(): ColumnDef<BrandSetupRow, unknown>[] {
  const queryClient = useQueryClient();
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
      header: "Brand name",
      cell: ({ row }) => (
        <Link
          className="font-medium hover:text-primary hover:underline"
          href={`/dashboard/admin/brands/${row.original.id}`}
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "categories",
      header: "Categories",
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
      header: "Used in",
      cell: ({ row }) => (
        <div className="font-mono text-xs tabular-nums">
          {row.original.productCount} products ·{" "}
          {row.original.coreIdentityCount} cores
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right">Action</div>,
      enableSorting: false,
      cell: ({ row }) => (
        <SetupRowActions
          deleteAction={<DeleteBrandDialog brand={row.original} />}
          editAction={<EditBrandDialog brand={row.original} />}
          toggleAction={
            <SetupToggleAction
              isActive={row.original.isActive}
              mutationFn={() =>
                orpc.brand.toggleActive.call({ id: row.original.id })
              }
              onSuccess={() =>
                queryClient.invalidateQueries({
                  queryKey: orpc.brand.getAdminAll.key(),
                })
              }
            />
          }
          viewHref={`/dashboard/admin/brands/${row.original.id}`}
        />
      ),
    },
  ];
}
