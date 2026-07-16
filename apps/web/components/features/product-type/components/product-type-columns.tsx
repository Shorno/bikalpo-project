"use client";

import {
  INVENTORY_BEHAVIOUR_LABELS,
  PRODUCT_TYPE_FAMILY_LABELS,
  type ProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import DeleteTypeDialog from "@/components/features/product-type/components/delete-type-dialog";
import EditTypeDialog from "@/components/features/product-type/components/edit-type-dialog";
import { resolveProductTypeProfile } from "@/components/features/product-type/components/product-type-row";
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
  inventoryBehaviour: keyof typeof INVENTORY_BEHAVIOUR_LABELS;
  family: keyof typeof PRODUCT_TYPE_FAMILY_LABELS;
  isActive: boolean;
  displayOrder: number;
  categoryCount: number;
  fulfillmentProfile?: ProductTypeFulfillmentProfile;
};

export function useProductTypeColumns() {
  const columns: ColumnDef<ProductTypeRow>[] = [
    {
      id: "skuCode",
      header: () => <div className="text-center">SKU</div>,
      cell: ({ row }) => (
        <div className="text-center">
          <Badge
            variant="outline"
            className="font-mono text-xs bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800"
          >
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
      id: "fulfillment",
      header: "Flow",
      cell: ({ row }) => {
        const profile = resolveProductTypeProfile(row.original);

        return (
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {PRODUCT_TYPE_FAMILY_LABELS[profile.family]}
            </div>
            <div className="text-xs text-muted-foreground">
              {INVENTORY_BEHAVIOUR_LABELS[row.original.inventoryBehaviour]}
            </div>
            <div className="text-xs text-muted-foreground">
              {profile.supportedModes.join(", ")}
            </div>
          </div>
        );
      },
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
                  <Link
                    href={`/dashboard/admin/types/${type.id}`}
                    className="flex items-center gap-2"
                  >
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
