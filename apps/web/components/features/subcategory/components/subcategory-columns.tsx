"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import DeleteSubcategoryDialog from "@/components/features/subcategory/components/delete-subcategory-dialog";
import EditSubcategoryDialog from "@/components/features/subcategory/components/edit-subcategory-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SubCategory } from "@/db/schema";

export const subcategoryColumns: ColumnDef<SubCategory>[] = [
  {
    accessorKey: "image",
    header: "Image",
    cell: ({ row }) => (
      <div className="w-16 h-16 relative">
        <Image
          src={row.getValue("image")}
          alt={row.getValue("name")}
          fill
          className="object-cover rounded-md"
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
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
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
    accessorKey: "slug",
    header: () => <div className="text-center">Slug</div>,
    cell: ({ row }) => (
      <div className="text-center text-muted-foreground">
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
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: "displayOrder",
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Display Order
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => (
      <div className="text-center">{row.getValue("displayOrder")}</div>
    ),
    size: 150,
  },
  {
    id: "actions",
    header: () => <div className="text-center">Actions</div>,
    enableHiding: false,
    cell: ({ row }) => {
      const subcategory = row.original;

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
              <EditSubcategoryDialog subcategory={subcategory} />
              <DropdownMenuSeparator />
              <DeleteSubcategoryDialog subcategory={subcategory} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
    size: 80,
  },
];
