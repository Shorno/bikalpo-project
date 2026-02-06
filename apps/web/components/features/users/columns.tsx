"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  Ban,
  Check,
  Monitor,
  MoreHorizontal,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  approveUser,
  banUser,
  setUserRole,
  unbanUser,
} from "@/app/(dashboard)/dashboard/admin/_actions/users/user-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getRoleConfig, type UserRole, type UserWithSessions } from "./types";
import { UserSessionsDialog } from "./user-sessions-dialog";

async function handleApprove(userId: string) {
  try {
    await approveUser(userId);
    toast.success("User approved successfully");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Failed to approve user",
    );
  }
}

async function handleSetRole(userId: string, role: UserRole) {
  try {
    await setUserRole(userId, role);
    toast.success(`Role changed to ${role}`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to set role");
  }
}

async function handleBan(userId: string) {
  try {
    await banUser(userId, "Banned by admin");
    toast.success("User banned");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to ban user");
  }
}

async function handleUnban(userId: string) {
  try {
    await unbanUser(userId);
    toast.success("User unbanned");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Failed to unban user",
    );
  }
}

export const userColumns: ColumnDef<UserWithSessions>[] = [
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
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.getValue("name")}</span>
        {row.original.banned && (
          <Badge variant="destructive" className="text-xs">
            Banned
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => <div className="lowercase">{row.getValue("email")}</div>,
  },
  {
    accessorKey: "shopName",
    header: "Shop Name",
    cell: ({ row }) => <div>{row.getValue("shopName") || "—"}</div>,
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue("role") as string | null;
      const config = getRoleConfig(role);
      return (
        <Badge variant="secondary" className={config.color}>
          {config.label}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "sessions",
    header: "Sessions",
    cell: ({ row, table }) => {
      const sessions = row.original.sessions;
      const activeSessions = sessions.filter(
        (s) => new Date() < new Date(s.expiresAt),
      );
      const sessionCount = activeSessions.length;
      const currentSessionId = (
        table.options.meta as { currentSessionId?: string } | undefined
      )?.currentSessionId;

      return (
        <UserSessionsDialog
          user={row.original}
          currentSessionId={currentSessionId}
        >
          <Button variant="ghost" size="sm" className="h-auto gap-2 px-2 py-1">
            <Monitor className="h-4 w-4" />
            <Badge
              variant={sessionCount > 0 ? "default" : "secondary"}
              className="text-xs"
            >
              {sessionCount}
            </Badge>
          </Button>
        </UserSessionsDialog>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Joined",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      return (
        <div className="text-muted-foreground">
          {date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row, table }) => {
      const user = row.original;
      const isGuest = user.role === "guest";
      const currentSessionId = (
        table.options.meta as { currentSessionId?: string } | undefined
      )?.currentSessionId;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>

            {/* Approve action for guests */}
            {isGuest && (
              <DropdownMenuItem onClick={() => handleApprove(user.id)}>
                <Check className="mr-2 h-4 w-4 text-green-600" />
                Approve as Customer
              </DropdownMenuItem>
            )}

            {/* View Profile */}
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/admin/users/${user.id}`}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                View Profile
              </Link>
            </DropdownMenuItem>

            {/* View Sessions */}
            <UserSessionsDialog user={user} currentSessionId={currentSessionId}>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Monitor className="mr-2 h-4 w-4" />
                View Sessions ({user.sessions.length})
              </DropdownMenuItem>
            </UserSessionsDialog>

            {/* Change role submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Shield className="mr-2 h-4 w-4" />
                Change Role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  onClick={() => handleSetRole(user.id, "guest")}
                >
                  Guest (Pending)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSetRole(user.id, "customer")}
                >
                  Customer
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSetRole(user.id, "salesman")}
                >
                  Salesman
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleSetRole(user.id, "deliveryman")}
                >
                  Deliveryman
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleSetRole(user.id, "admin")}
                  className="text-red-600"
                >
                  Admin
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            {/* Ban/Unban actions */}
            {user.banned ? (
              <DropdownMenuItem onClick={() => handleUnban(user.id)}>
                Unban User
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleBan(user.id)}
                className="text-red-600"
              >
                <Ban className="mr-2 h-4 w-4" />
                Ban User
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
