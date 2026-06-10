"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { ADMIN_BASE } from "@/lib/routes";
import EditCoreProductDialog from "./edit-core-product-dialog";
import DeleteCoreProductDialog from "./delete-core-product-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface CoreProductWithRelations {
  id: number;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  image: string;
  categoryId: number;
  subCategoryId: number | null;
  supportsPack: boolean;
  supportsLoose: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: number;
    name: string;
    slug: string;
    typeId: number | null;
  };
  subCategory: {
    id: number;
    name: string;
  } | null;
  brands: {
    id: number;
    coreProductId: number;
    brandId: number;
    isDefault: boolean;
    brand: {
      id: number;
      name: string;
      logo: string;
    };
  }[];
}

export function useCoreProductColumns() {
  return React.useMemo<ColumnDef<CoreProductWithRelations>[]>(
    () => [
      {
        id: "composedSku",
        header: () => <div className="text-center">SKU</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-xs bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
              {(row.original as any).composedSku || row.original.sku}
            </Badge>
          </div>
        ),
        size: 140,
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              Core Identity Name
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-center font-medium">{row.getValue("name")}</div>
        ),
      },
      {
        id: "subCategory",
        header: () => <div className="text-center">Sub Category</div>,
        cell: ({ row }) => (
          <div className="text-center">
            {row.original.subCategory ? (
              <Badge variant="secondary" className="text-xs">
                {row.original.subCategory.name}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
        ),
        size: 140,
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
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        enableHiding: false,
        cell: ({ row }) => <CoreProductActions coreProduct={row.original} />,
      },
    ],
    [],
  );
}

function CoreProductActions({
  coreProduct,
}: {
  coreProduct: CoreProductWithRelations;
}) {
  const [showEdit, setShowEdit] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);

  return (
    <div className="flex items-center justify-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
        <Link href={`${ADMIN_BASE}/core-products/${coreProduct.id}`}>
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

      <EditCoreProductDialog
        coreProduct={coreProduct}
        open={showEdit}
        onOpenChange={setShowEdit}
      />
      <DeleteCoreProductDialog
        coreProduct={coreProduct}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </div>
  );
}
