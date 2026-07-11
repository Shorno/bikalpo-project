"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import * as React from "react";
import DeleteVariantOptionDialog from "@/components/features/variant-option/components/delete-variant-option-dialog";
import VariantOptionDialog from "@/components/features/variant-option/components/variant-option-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface VariantOptionRow {
  id: number;
  name: string;
  unit: string;
  size: string | null;
  variantType: "pack" | "loose";
  definitionKind: "measurement" | "loose" | "attribute" | null;
  definition: Record<string, unknown> | null;
  displayAlias: string | null;
  canonicalSignature: string | null;
  needsReview: boolean;
  structuralLocked: boolean;
  typeId: number | null;
  categoryId: number | null;
  skuCode: string | null;
  isActive: boolean;
  sortOrder: number;
  type: { id: number; name: string } | null;
  category: { id: number; name: string } | null;

  createdAt: Date;
  updatedAt: Date;
}

export function useVariantOptionColumns() {
  return React.useMemo<ColumnDef<VariantOptionRow>[]>(
    () => [
      {
        id: "index",
        header: () => <div className="text-center">#</div>,
        cell: ({ row }) => (
          <div className="text-center text-muted-foreground font-mono text-sm">
            {row.index + 1}
          </div>
        ),
        size: 50,
        enableSorting: false,
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
        header: ({ column }) => (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
            >
              Canonical Label
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-center font-medium">{row.getValue("name")}</div>
        ),
      },
      {
        accessorKey: "definitionKind",
        header: () => <div className="text-center">Definition</div>,
        cell: ({ row }) => (
          <div className="text-center">
            <Badge variant="outline" className="font-mono text-xs">
              {row.original.definitionKind ?? "Legacy"}
            </Badge>
          </div>
        ),
        size: 90,
      },
      {
        accessorKey: "displayAlias",
        header: () => <div className="text-center">Display Alias</div>,
        cell: ({ row }) => (
          <div className="text-center text-sm">
            {row.original.displayAlias || (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ),
        size: 80,
      },
      {
        id: "productType",
        header: () => <div className="text-center">Type</div>,
        cell: ({ row }) => (
          <div className="text-center">
            {row.original.type ? (
              <Badge variant="secondary" className="text-xs">
                {row.original.type.name}
              </Badge>
            ) : (
              <Badge className="text-xs bg-purple-600 hover:bg-purple-700">
                Global
              </Badge>
            )}
          </div>
        ),
        size: 120,
      },
      {
        id: "category",
        header: () => <div className="text-center">Category</div>,
        cell: ({ row }) => (
          <div className="text-center text-sm">
            {row.original.category ? (
              <Badge variant="outline" className="text-xs">
                {row.original.category.name}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ),
        size: 130,
      },
      {
        accessorKey: "structuralLocked",
        header: () => <div className="text-center">Structure</div>,
        cell: ({ row }) => {
          const locked = row.original.structuralLocked;
          return (
            <div className="flex justify-center">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  locked && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                )}
              >
                {locked ? "In use · locked" : row.original.needsReview ? "Needs review" : "Editable"}
              </Badge>
            </div>
          );
        },
        size: 110,
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
                  "transition-colors text-xs",
                  isActive && "bg-green-600 hover:bg-green-700",
                )}
              >
                {isActive ? "Active" : "Disabled"}
              </Badge>
            </div>
          );
        },
        size: 100,
      },

      {
        id: "actions",
        header: () => <div className="text-center">Actions</div>,
        enableHiding: false,
        cell: ({ row }) => <VariantOptionActions option={row.original} />,
      },
    ],
    [],
  );
}

function VariantOptionActions({ option }: { option: VariantOptionRow }) {
  const [showEdit, setShowEdit] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);

  return (
    <div className="flex items-center justify-center gap-1">
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

      <VariantOptionDialog
        mode="edit"
        variantOption={option}
        open={showEdit}
        onOpenChange={setShowEdit}
      />
      <DeleteVariantOptionDialog
        variantOption={option}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </div>
  );
}
