"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { ADMIN_BASE } from "@/lib/routes";
import DeleteSubcategoryDialog from "@/components/features/subcategory/components/delete-subcategory-dialog";
import EditSubcategoryDialog from "@/components/features/subcategory/components/edit-subcategory-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SubcategoryWithCategory extends SubCategory {
  category: {
    id: number;
    name: string;
    typeId: number | null;
    type?: { id: number; name: string } | null;
  };
}

export function useSubcategoryColumns() {
  return React.useMemo<ColumnDef<SubcategoryWithCategory>[]>(
    () => [
      {
        id: "skuCode",
        header: () => <div className="text-center">SKU</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-xs bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
              {row.original.skuCode || "—"}
            </Badge>
          </div>
        ),
        size: 70,
      },
      {
        accessorKey: "name",
        header: () => <div className="text-center">Name</div>,
        cell: ({ row }) => (
          <div className="text-center font-medium">{row.getValue("name")}</div>
        ),
      },
      {
        id: "category",
        header: () => <div className="text-center">Category</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="outline">{row.original.category.name}</Badge>
          </div>
        ),
        size: 140,
      },
      {
        id: "type",
        header: () => <div className="text-center">Type</div>,
        cell: ({ row }) => (
          <div className="text-center">
            {row.original.category.type ? (
              <Badge variant="secondary" className="text-xs">
                {row.original.category.type.name}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
        ),
        size: 120,
      },
      {
        accessorKey: "slug",
        header: () => <div className="text-center">Slug</div>,
        cell: ({ row }) => (
          <div className="text-center text-muted-foreground font-mono text-sm">
            {row.getValue("slug")}
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        enableHiding: false,
        cell: ({ row }) => <SubcategoryActions subcategory={row.original} />,
      },
    ],
    [],
  );
}

function SubcategoryActions({ subcategory }: { subcategory: SubcategoryWithCategory }) {
  const [showEdit, setShowEdit] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);

  return (
    <div className="flex items-center justify-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
        <Link href={`${ADMIN_BASE}/subcategories/${subcategory.id}`}>
          <Eye className="h-4 w-4" />
          <span className="sr-only">View</span>
        </Link>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setShowEdit(true)}
      >
        <Pencil className="h-4 w-4" />
        <span className="sr-only">Edit</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => setShowDelete(true)}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete</span>
      </Button>

      <EditSubcategoryDialog
        subcategory={subcategory}
        open={showEdit}
        onOpenChange={setShowEdit}
      />
      <DeleteSubcategoryDialog
        subcategory={subcategory}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </div>
  );
}
