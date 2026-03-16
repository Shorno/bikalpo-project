"use client";

import type { Offer } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface OfferColumnProps {
  onEdit: (offer: Offer) => void;
  onDelete: (id: number) => void;
  onToggleActive: (id: number, active: boolean) => void;
}

export function createOfferColumns({
  onEdit,
  onDelete,
  onToggleActive,
}: OfferColumnProps): ColumnDef<Offer>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => {
        const offer = row.original;
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{offer.title}</span>
            {offer.description && (
              <span className="text-xs text-gray-600 line-clamp-1">
                {offer.description}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const offer = row.original;
        return <Badge variant="outline">{offer.type}</Badge>;
      },
    },
    {
      accessorKey: "discountPercentage",
      header: "Discount",
      cell: ({ row }) => {
        const offer = row.original;
        return (
          <Badge variant="secondary" className="font-semibold">
            {offer.discountPercentage}%
          </Badge>
        );
      },
    },
    {
      accessorKey: "badge",
      header: "Badge",
      cell: ({ row }) => {
        const offer = row.original;
        return offer.badge ? (
          <Badge className="bg-blue-600">{offer.badge}</Badge>
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
    {
      accessorKey: "priority",
      header: "Priority",
      cell: ({ row }) => {
        const offer = row.original;
        return <span className="font-mono text-sm">{offer.priority}</span>;
      },
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => {
        const offer = row.original;
        return (
          <Badge variant={offer.active ? "default" : "outline"}>
            {offer.active ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => {
        const offer = row.original;
        return (
          <span className="text-xs text-gray-600">
            {format(new Date(offer.createdAt), "MMM d, yyyy HH:mm")}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const offer = row.original;
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(offer)}
              title="Edit offer"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onToggleActive(offer.id, !offer.active)}
              title={offer.active ? "Deactivate" : "Activate"}
            >
              {offer.active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={() => onDelete(offer.id)}
              title="Delete offer"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        );
      },
      enableSorting: false,
    },
  ];
}
