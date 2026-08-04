"use client";

import type { Category, SubCategory } from "@bikalpo-project/db/schema";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import DeleteCategoryDialog from "@/components/features/category/components/delete-category-dialog";
import EditCategoryDialog from "@/components/features/category/components/edit-category-dialog";
import {
  ActiveStatusBadge,
  SetupRowActions,
  SetupToggleAction,
} from "@/components/features/product-setup";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

export interface CategoryWithSubcategories extends Category {
  subCategory: SubCategory[];
  type?: { id: number; name: string } | null;
}

export function useCategoryColumns() {
  return useMemo<ColumnDef<CategoryWithSubcategories, unknown>[]>(
    () => [
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
        id: "type",
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
        header: "Category name",
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
        cell: ({ row }) => <CategoryActions category={row.original} />,
      },
    ],
    [],
  );
}

function CategoryActions({
  category,
}: {
  category: CategoryWithSubcategories;
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
            isActive={category.isActive}
            mutationFn={() =>
              orpc.category.toggleActive.call({ id: category.id })
            }
            onSuccess={() =>
              queryClient.invalidateQueries({
                queryKey: orpc.category.getAll.key(),
              })
            }
          />
        }
        viewHref={`${ADMIN_BASE}/categories/${category.id}`}
      />
      <EditCategoryDialog
        category={category}
        onOpenChange={setShowEdit}
        open={showEdit}
      />
      <DeleteCategoryDialog
        category={category}
        onOpenChange={setShowDelete}
        open={showDelete}
      />
    </>
  );
}
