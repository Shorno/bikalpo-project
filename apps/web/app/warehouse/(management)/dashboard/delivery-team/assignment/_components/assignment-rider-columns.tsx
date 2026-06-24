"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canAssignGroupToRider,
  getRiderStatusLabel,
  getRiderStatusTone,
  type RiderOverviewRow,
} from "./rider-assignment-utils";

export type RiderColumnActions = {
  onView: (rider: RiderOverviewRow) => void;
  onAssign: (rider: RiderOverviewRow) => void;
};

export function getRiderAssignmentColumns(
  actions: RiderColumnActions,
): ColumnDef<RiderOverviewRow>[] {
  return [
    {
      id: "rider",
      header: "Rider",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{row.original.name}</div>
          {row.original.banned ? (
            <div className="text-xs text-destructive">Account banned</div>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "phoneNumber",
      header: "Phone",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.phoneNumber ?? (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
      ),
    },
    {
      id: "groupArea",
      header: "Group / Area",
      cell: ({ row }) => (
        <div className="min-w-0">
          {row.original.activeGroup ? (
            <>
              <div className="truncate text-sm font-medium">
                {row.original.activeGroup.groupName}
              </div>
              <div className="text-xs text-muted-foreground">
                {row.original.activeGroup.areaLabel}
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              {row.original.serviceArea ?? row.original.areaLabel}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "orders",
      header: "Active Orders",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.status === "active"
            ? `${row.original.completedOrders}/${row.original.totalOrders}`
            : "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge
          variant={getRiderStatusTone(
            row.original.status,
            row.original.banned,
          )}
        >
          {getRiderStatusLabel(row.original.status, row.original.banned)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {canAssignGroupToRider(row.original) ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              onClick={() => actions.onAssign(row.original)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1"
            onClick={() => actions.onView(row.original)}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
        </div>
      ),
    },
  ];
}
