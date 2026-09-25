"use client";

import type {
  INVENTORY_BEHAVIOUR_LABELS,
  PRODUCT_TYPE_FAMILY_LABELS,
  ProductTypeFulfillmentProfile,
} from "@bikalpo-project/db/fulfillment";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import {
  ActiveStatusBadge,
  SetupViewButton,
} from "@/components/features/product-setup";

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

export function useProductTypeColumns(): ColumnDef<ProductTypeRow, unknown>[] {
  return [
    {
      id: "skuCode",
      header: "SKU",
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums">
          {row.original.skuCode || "—"}
        </span>
      ),
      enableSorting: false,
      size: 96,
    },
    {
      accessorKey: "name",
      header: "Type name",
      cell: ({ row }) => (
        <Link
          className="font-medium hover:text-primary hover:underline"
          href={`/dashboard/admin/types/${row.original.id}`}
        >
          {row.original.name}
        </Link>
      ),
      enableSorting: false,
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => <ActiveStatusBadge isActive={row.original.isActive} />,
      enableSorting: false,
      size: 120,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Action</div>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <SetupViewButton href={`/dashboard/admin/types/${row.original.id}`} />
        </div>
      ),
      size: 80,
    },
  ];
}
