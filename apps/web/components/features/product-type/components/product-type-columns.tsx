"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import DeleteTypeDialog from "@/components/features/product-type/components/delete-type-dialog";
import EditTypeDialog from "@/components/features/product-type/components/edit-type-dialog";
import ToggleTypeDialog from "@/components/features/product-type/components/toggle-type-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ProductTypeRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  skuCode: string | null;
  enableBrand: boolean;
  enableColor: boolean;
  enableSize: boolean;
  enableDesign: boolean;
  enableVariant: boolean;
  inventoryBehaviour: "auto_break" | "loose_convert" | "fixed_pack";
  isActive: boolean;
  displayOrder: number;
  categoryCount: number;
};

const behaviourLabels: Record<string, string> = {
  auto_break: "Auto Break",
  loose_convert: "Loose Convert",
  fixed_pack: "Fixed Pack",
};

export function useProductTypeColumns() {
  const columns: ColumnDef<ProductTypeRow>[] = [
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
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.getValue("name")}</span>
          <span className="ml-2 text-xs text-muted-foreground font-mono">
            {row.original.slug}
          </span>
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
              {isActive ? "Active" : "Draft"}
            </Badge>
          </div>
        );
      },
      size: 100,
    },
    {
      id: "attributes",
      header: () => <div className="text-center">Attributes</div>,
      cell: ({ row }) => {
        const t = row.original;
        const attrs = [];
        if (t.enableBrand) attrs.push("Brand");
        if (t.enableColor) attrs.push("Color");
        if (t.enableSize) attrs.push("Size");
        if (t.enableDesign) attrs.push("Design");
        if (t.enableVariant) attrs.push("Variant");
        return (
          <div className="flex justify-center gap-1 flex-wrap">
            {attrs.map((a) => (
              <Badge key={a} variant="outline" className="text-[10px] px-1.5 py-0">
                {a}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "inventoryBehaviour",
      header: () => <div className="text-center">Inventory</div>,
      cell: ({ row }) => (
        <div className="text-center text-sm text-muted-foreground">
          {behaviourLabels[row.getValue("inventoryBehaviour") as string] || "—"}
        </div>
      ),
      size: 130,
    },
    {
      id: "categoryCount",
      header: () => <div className="text-center">Categories</div>,
      cell: ({ row }) => (
        <div className="text-center font-medium tabular-nums">
          {row.original.categoryCount}
        </div>
      ),
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
        <div className="text-center tabular-nums">{row.getValue("displayOrder")}</div>
      ),
      size: 80,
    },
    {
      id: "actions",
      header: () => <div className="text-center">Actions</div>,
      enableHiding: false,
      cell: ({ row }) => {
        const type = row.original;

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
                  <Link href={`/dashboard/admin/types/${type.id}`} className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <EditTypeDialog type={type} />
                <ToggleTypeDialog type={type} />
                <DropdownMenuSeparator />
                <DeleteTypeDialog type={type} />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  return columns;
}
