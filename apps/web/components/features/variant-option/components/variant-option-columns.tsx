"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ActiveStatusBadge,
  SetupRowActions,
  SetupToggleAction,
} from "@/components/features/product-setup";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { orpc } from "@/utils/orpc";
import DeleteVariantOptionDialog from "./delete-variant-option-dialog";
import VariantOptionDialog from "./variant-option-dialog";

export interface VariantOptionRow {
  id: number;
  name: string;
  unit: string;
  size: string | null;
  variantType: "pack" | "loose";
  definitionKind: string | null;
  definition: Record<string, unknown> | null;
  displayAlias: string | null;
  canonicalSignature: string | null;
  needsReview: boolean;
  structuralLocked: boolean;
  productUsageCount: number;
  coreIdentityUsageCount: number;
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
  return useMemo<ColumnDef<VariantOptionRow, unknown>[]>(
    () => [
      {
        id: "skuCode",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.skuCode || "—"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Variant name",
        cell: ({ row }) => (
          <Link
            className="font-medium hover:text-primary hover:underline"
            href={`/dashboard/admin/variant-options/${row.original.id}`}
          >
            {row.original.name}
          </Link>
        ),
      },
      { accessorKey: "unit", header: "Unit" },
      {
        accessorKey: "size",
        header: "Size",
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.size ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
          <ActiveStatusBadge isActive={row.original.isActive} />
        ),
      },
      {
        id: "usedIn",
        header: "Used in",
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.productUsageCount} products ·{" "}
            {row.original.coreIdentityUsageCount} cores
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        enableSorting: false,
        cell: ({ row }) => <VariantOptionActions option={row.original} />,
      },
    ],
    [],
  );
}

function VariantOptionActions({ option }: { option: VariantOptionRow }) {
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <SetupRowActions
        deleteAction={
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setShowDelete(true)}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Delete
          </DropdownMenuItem>
        }
        editAction={
          <DropdownMenuItem onSelect={() => setShowEdit(true)}>
            <Pencil aria-hidden="true" className="size-4" />
            Edit
          </DropdownMenuItem>
        }
        toggleAction={
          <SetupToggleAction
            isActive={option.isActive}
            mutationFn={() =>
              orpc.adminVariantOption.toggleActive.call({ id: option.id })
            }
            onSuccess={() =>
              queryClient.invalidateQueries({
                queryKey: orpc.adminVariantOption.getAll.key(),
              })
            }
          />
        }
        viewHref={`/dashboard/admin/variant-options/${option.id}`}
      />
      <VariantOptionDialog
        mode="edit"
        onOpenChange={setShowEdit}
        open={showEdit}
        variantOption={option}
      />
      <DeleteVariantOptionDialog
        onOpenChange={setShowDelete}
        open={showDelete}
        variantOption={option}
      />
    </>
  );
}
