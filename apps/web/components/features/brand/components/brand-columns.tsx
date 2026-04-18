"use client";

import type { Brand } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import DeleteBrandDialog from "@/components/features/brand/components/delete-brand-dialog";
import EditBrandDialog from "@/components/features/brand/components/edit-brand-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function useBrandColumns() {
  const columns: ColumnDef<Brand>[] = [

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
      accessorKey: "slug",
      header: () => <div className="text-center">Slug</div>,
      cell: ({ row }) => (
        <div className="text-center text-muted-foreground">
          {row.getValue("slug")}
        </div>
      ),
    },

    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => {
        const brand = row.original;

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
                <EditBrandDialog brand={brand} />
                <DropdownMenuSeparator />
                <DeleteBrandDialog brand={brand} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return columns;
}
