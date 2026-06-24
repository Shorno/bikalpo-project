"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Eye, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type AssignmentGroupRow,
  canAssignRider,
  formatMoney,
  getGroupStatusLabel,
  getGroupStatusTone,
} from "./assignment-utils";

export type AssignmentColumnActions = {
  onView: (group: AssignmentGroupRow) => void;
  onAssign: (group: AssignmentGroupRow) => void;
};

export function getAssignmentColumns(
  actions: AssignmentColumnActions,
): ColumnDef<AssignmentGroupRow>[] {
  return [
    {
      id: "groupId",
      header: "Group",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {row.original.groupName}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            #{row.original.id}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "areaLabel",
      header: "Area",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.areaLabel}</span>
      ),
    },
    {
      accessorKey: "totalInvoices",
      header: "Orders",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.totalInvoices}</span>
      ),
    },
    {
      accessorKey: "totalAmount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {formatMoney(row.original.totalAmount)}
        </span>
      ),
    },
    {
      id: "rider",
      header: "Rider",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.rider?.name ?? (
            <span className="text-muted-foreground">Not assigned</span>
          )}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getGroupStatusTone(row.original.status)}>
          {getGroupStatusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {canAssignRider(row.original.status) ? (
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
