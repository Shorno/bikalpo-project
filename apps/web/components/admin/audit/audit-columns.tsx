"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Edit,
  Eye,
  FileText,
  LogIn,
  LogOut,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AuditActivity } from "@/types/audit";

interface UseAuditColumnsProps {
  onViewDetails: (activity: AuditActivity) => void;
}

export function useAuditColumns({ onViewDetails }: UseAuditColumnsProps) {
  const columns = useMemo<ColumnDef<AuditActivity>[]>(
    () => [
      {
        accessorKey: "logId",
        header: "Log ID",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.logId}</span>
        ),
      },
      {
        accessorKey: "timestamp",
        header: "Date & Time",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {new Date(row.original.timestamp).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(row.original.timestamp).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "userName",
        header: "User",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.userName}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.userEmail}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "userRole",
        header: "Role",
        cell: ({ row }) => {
          const role = row.original.userRole;
          const roleColors: Record<string, string> = {
            super_admin:
              "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
            admin:
              "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
            shop_owner:
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
            employee:
              "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
            delivery:
              "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
            salesman:
              "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
          };

          return (
            <Badge variant="secondary" className={roleColors[role] || ""}>
              {role?.replace("_", " ").toUpperCase()}
            </Badge>
          );
        },
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => {
          const action = row.original.action;
          const actionIcons: Record<string, any> = {
            login: <LogIn className="h-3 w-3" />,
            logout: <LogOut className="h-3 w-3" />,
            create: <Plus className="h-3 w-3" />,
            update: <Edit className="h-3 w-3" />,
            delete: <Trash2 className="h-3 w-3" />,
            approve: <ThumbsUp className="h-3 w-3" />,
            reject: <ThumbsDown className="h-3 w-3" />,
            payment: <DollarSign className="h-3 w-3" />,
            invoice: <FileText className="h-3 w-3" />,
          };

          const actionColors: Record<string, string> = {
            login:
              "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
            logout:
              "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
            create:
              "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
            update:
              "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
            delete: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
            approve:
              "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
            reject: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
            payment:
              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
            invoice:
              "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
          };

          return (
            <Badge
              variant="secondary"
              className={`flex items-center gap-1 w-fit ${actionColors[action] || ""}`}
            >
              {actionIcons[action]}
              {action.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        accessorKey: "module",
        header: "Module",
        cell: ({ row }) => (
          <span className="capitalize">{row.original.module}</span>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground max-w-xs truncate block">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const statusIcons: Record<string, any> = {
            success: <CheckCircle2 className="h-4 w-4 text-green-600" />,
            warning: <AlertTriangle className="h-4 w-4 text-orange-600" />,
            failed: <XCircle className="h-4 w-4 text-red-600" />,
          };

          const statusColors: Record<string, string> = {
            success:
              "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
            warning:
              "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
            failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
          };

          return (
            <Badge
              variant="secondary"
              className={`flex items-center gap-1 w-fit ${statusColors[status]}`}
            >
              {statusIcons[status]}
              {status.toUpperCase()}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(row.original)}
            className="flex items-center gap-1"
          >
            <Eye className="h-4 w-4" />
            View
          </Button>
        ),
      },
    ],
    [onViewDetails],
  );

  return columns;
}
