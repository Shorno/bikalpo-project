"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ActiveStatusBadge,
  SetupRowActions,
  SetupToggleAction,
} from "@/components/features/product-setup";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";
import DeleteCoreProductDialog from "./delete-core-product-dialog";
import EditCoreProductDialog from "./edit-core-product-dialog";

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
        cell: ({ row }) => <CoreProductActions coreProduct={row.original} />,
      },
    ],
    [],
  );
}

function CoreProductActions({
  coreProduct,
}: {
  coreProduct: CoreProductWithRelations;
}) {
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <SetupRowActions
        deleteAction={
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setShowDelete(true)}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </DropdownMenuItem>
        }
        editAction={
          <DropdownMenuItem onSelect={() => setShowEdit(true)}>
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </DropdownMenuItem>
        }
        toggleAction={
          <SetupToggleAction
            isActive={coreProduct.isActive}
            mutationFn={() =>
              orpc.adminCoreProduct.toggleActive.call({ id: coreProduct.id })
            }
            onSuccess={() =>
              queryClient.invalidateQueries({
                queryKey: orpc.adminCoreProduct.getAll.key(),
              })
            }
          />
        }
        viewHref={`${ADMIN_BASE}/core-products/${coreProduct.id}`}
      />
      <EditCoreProductDialog
        coreProduct={coreProduct}
        onOpenChange={setShowEdit}
        open={showEdit}
      />
      <DeleteCoreProductDialog
        coreProduct={coreProduct}
        onOpenChange={setShowDelete}
        open={showDelete}
      />
    </>
  );
}
