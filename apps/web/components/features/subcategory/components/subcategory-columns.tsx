"use client";

import type { SubCategory } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import * as React from "react";
import { ADMIN_BASE } from "@/lib/routes";
import DeleteSubcategoryDialog from "@/components/features/subcategory/components/delete-subcategory-dialog";
import EditSubcategoryDialog from "@/components/features/subcategory/components/edit-subcategory-dialog";
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

export interface SubcategoryWithCategory extends SubCategory {
  category: {
    id: number;
    name: string;
    typeId: number | null;
    type?: { id: number; name: string } | null;
  };
}

export function useSubcategoryColumns() {
  const columns: ColumnDef<SubcategoryWithCategory>[] = [
    {
      accessorKey: "image",
      header: "Image",
      cell: ({ row }) => (
        <div className="w-12 h-12 relative rounded-lg overflow-hidden border shadow-sm">
          <Image
            src={row.getValue("image")}
            alt={row.getValue("name")}
            fill
            className="object-cover"
          />
        </div>
      ),
      enableSorting: false,
      size: 70,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
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
      accessorKey: "displayOrder",
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Order
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
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
      cell: ({ row }) => <SubcategoryActions subcategory={row.original} />,
    },
  ];

  return columns;
}

function SubcategoryActions({ subcategory }: { subcategory: SubcategoryWithCategory }) {
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
            <Link href={`${ADMIN_BASE}/subcategories/${subcategory.id}`}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <EditSubcategoryDialog subcategory={subcategory} />
          <DropdownMenuSeparator />
          <DeleteSubcategoryDialog subcategory={subcategory} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
