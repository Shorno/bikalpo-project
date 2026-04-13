"use client";

import type { Category, SubCategory } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import * as React from "react";
import { ADMIN_BASE } from "@/lib/routes";
import DeleteCategoryDialog from "@/components/features/category/components/delete-category-dialog";
import EditCategoryDialog from "@/components/features/category/components/edit-category-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface CategoryWithSubcategories extends Category {
  subCategory: SubCategory[];
  type?: { id: number; name: string } | null;
}

export function useCategoryColumns() {
  return React.useMemo<ColumnDef<CategoryWithSubcategories>[]>(
    () => [
      {
        accessorKey: "image",
        header: "Image",
        cell: ({ row }) => (
          <div className="w-14 h-14 relative rounded-lg overflow-hidden border shadow-sm">
            <Image
              src={row.getValue("image")}
              alt={row.getValue("name")}
              fill
              className="object-cover"
            />
          </div>
        ),
        enableSorting: false,
        size: 80,
      },
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
        header: ({ column }) => {
          return (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
              >
                Name
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="text-center font-medium">{row.getValue("name")}</div>
        ),
      },
      {
        id: "type",
        header: () => <div className="text-center">Type</div>,
        cell: ({ row }) => (
          <div className="text-center">
            {row.original.type ? (
              <Badge variant="outline">{row.original.type.name}</Badge>
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
        accessorKey: "isActive",
        header: () => <div className="text-center">Status</div>,
        cell: ({ row }) => {
          const isActive = row.getValue("isActive") as boolean;
          return (
            <div className="flex justify-center">
              <Badge
                variant={isActive ? "default" : "secondary"}
                className={cn(
                  "transition-colors",
                  isActive && "bg-green-600 hover:bg-green-700",
                )}
              >
                {isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          );
        },
        size: 100,
      },
      {
        id: "subcategoryCount",
        header: () => <div className="text-center">Subcategories</div>,
        cell: ({ row }) => {
          const count = row.original.subCategory.length;
          return (
            <div className="flex justify-center">
              <Badge variant="outline" className="font-mono">
                {count}
              </Badge>
            </div>
          );
        },
        size: 120,
      },
      {
        accessorKey: "displayOrder",
        header: ({ column }) => {
          return (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
              >
                Order
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="outline" className="font-mono">
              {row.getValue("displayOrder")}
            </Badge>
          </div>
        ),
        size: 100,
      },
      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        enableHiding: false,
        cell: ({ row }) => <CategoryActions category={row.original} />,
      },
    ],
    [],
  );
}

function CategoryActions({ category }: { category: CategoryWithSubcategories }) {
  const [showEdit, setShowEdit] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);

  return (
    <div className="flex items-center justify-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
        <Link href={`${ADMIN_BASE}/categories/${category.id}`}>
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

      <EditCategoryDialog
        category={category}
        open={showEdit}
        onOpenChange={setShowEdit}
      />
      <DeleteCategoryDialog
        category={category}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </div>
  );
}
