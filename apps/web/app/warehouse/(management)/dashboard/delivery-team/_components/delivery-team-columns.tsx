"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  Ban,
  Eye,
  KeyRound,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type DeliverymanRow,
  getDeliverymanStatusLabel,
  getDeliverymanStatusTone,
} from "./delivery-team-utils";

const WH = "/warehouse/dashboard";

export type DeliveryTeamColumnActions = {
  onResetPassword: (rider: DeliverymanRow) => void;
  onToggleBan: (rider: DeliverymanRow) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
};

export function getDeliveryTeamColumns(
  actions: DeliveryTeamColumnActions,
): ColumnDef<DeliverymanRow>[] {
  return [
    {
      id: "rider",
      header: "Rider",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.original.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.email}
          </p>
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
      accessorKey: "deliveriesCount",
      header: "Deliveries",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.deliveriesCount}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getDeliverymanStatusTone(row.original.banned)}>
          {getDeliverymanStatusLabel(row.original.banned)}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Joined",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.createdAt), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const rider = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              asChild
            >
              <Link href={`${WH}/delivery-team/${rider.id}`}>
                <Eye className="h-3.5 w-3.5" />
                View
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => actions.onResetPassword(rider)}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Reset Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => actions.onToggleBan(rider)}>
                  {rider.banned ? (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Unban
                    </>
                  ) : (
                    <>
                      <Ban className="mr-2 h-4 w-4" />
                      Ban
                    </>
                  )}
                </DropdownMenuItem>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={(event) => event.preventDefault()}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {rider.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove this deliveryman. This
                        action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => actions.onDelete(rider.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {actions.isDeleting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
