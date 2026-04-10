"use client";

import type { Category, SubCategory } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ADMIN_BASE } from "@/lib/routes";
import DeleteCategoryDialog from "@/components/features/category/components/delete-category-dialog";
import EditCategoryDialog from "@/components/features/category/components/edit-category-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface CategoryWithSubcategories extends Category {
  subCategory: SubCategory[];
  type?: { id: number; name: string } | null;
}

export function useCategoryColumns() {
  const columns: ColumnDef<CategoryWithSubcategories>[] = [
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
  ];

  return columns;
}

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";

function CategoryActions({ category }: { category: CategoryWithSubcategories }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <div className="flex justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`${ADMIN_BASE}/categories/${category.id}`}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditCategoryDialog
        category={category}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <DeleteCategoryDialog
        category={category}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </div>
  );
}
