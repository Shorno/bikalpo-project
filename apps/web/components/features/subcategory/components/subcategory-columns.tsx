"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
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
import DeleteSubcategoryDialog from "@/components/features/subcategory/components/delete-subcategory-dialog";
import EditSubcategoryDialog from "@/components/features/subcategory/components/edit-subcategory-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

export interface SubcategoryWithCategory extends SubCategory {
  category: {
    id: number;
    name: string;
    typeId: number | null;
    type?: { id: number; name: string } | null;
  };
}

export function useSubcategoryColumns() {
  return useMemo<ColumnDef<SubcategoryWithCategory, unknown>[]>(
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
        accessorKey: "name",
        header: "Sub Category name",
        cell: ({ row }) => (
          <Link
            className="font-medium hover:text-primary hover:underline"
            href={`${ADMIN_BASE}/subcategories/${row.original.id}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => (
          <div>
            <div className="text-sm">{row.original.category.name}</div>
            {row.original.category.type && (
              <div className="text-xs text-muted-foreground">
                {row.original.category.type.name}
              </div>
            )}
          </div>
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
        cell: ({ row }) => <SubcategoryActions subcategory={row.original} />,
      },
    ],
    [],
  );
}

function SubcategoryActions({
  subcategory,
}: {
  subcategory: SubcategoryWithCategory;
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
            isActive={subcategory.isActive}
            mutationFn={() =>
              orpc.adminSubcategory.toggleActive.call({ id: subcategory.id })
            }
            onSuccess={() =>
              queryClient.invalidateQueries({
                queryKey: orpc.adminSubcategory.getAllGlobal.key(),
              })
            }
          />
        }
        viewHref={`${ADMIN_BASE}/subcategories/${subcategory.id}`}
      />
      <EditSubcategoryDialog
        onOpenChange={setShowEdit}
        open={showEdit}
        subcategory={subcategory}
      />
      <DeleteSubcategoryDialog
        onOpenChange={setShowDelete}
        open={showDelete}
        subcategory={subcategory}
      />
    </>
  );
}
