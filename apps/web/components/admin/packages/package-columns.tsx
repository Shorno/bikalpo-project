"use client";

import type { LandingPricingPlan } from "@bikalpo-project/db/schema";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ColumnActions = {
  onEdit: (plan: LandingPricingPlan) => void;
  onDelete: (id: number) => void;
};

export function createPackageColumns({
  onEdit,
  onDelete,
}: ColumnActions): ColumnDef<LandingPricingPlan>[] {
  return [
    {
      accessorKey: "sortOrder",
      header: "Order",
      cell: ({ row }) => (
        <span className="text-muted-foreground font-mono text-sm">
          #{row.original.sortOrder}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Plan Name",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{row.original.name}</span>
          {row.original.isPopular && (
            <Badge className="bg-primary/10 text-primary border-0 text-xs">
              <Star className="h-3 w-3 mr-1" />
              Popular
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "priceMonthly",
      header: "Monthly Price",
      cell: ({ row }) => (
        <span className="font-mono font-semibold">
          ৳{row.original.priceMonthly.toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "priceYearly",
      header: "Yearly Price",
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.priceYearly
            ? `৳${row.original.priceYearly.toLocaleString()}`
            : "—"}
        </span>
      ),
    },
    {
      accessorKey: "features",
      header: "Features",
      cell: ({ row }) => {
        const features = (row.original.features as string[]) || [];
        return (
          <span className="text-sm text-muted-foreground">
            {features.length} feature{features.length !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          className={
            row.original.active
              ? "bg-emerald-100 text-emerald-700 border-0 text-xs"
              : "bg-gray-100 text-gray-600 border-0 text-xs"
          }
        >
          {row.original.active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onEdit(row.original)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600"
            onClick={() => onDelete(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
