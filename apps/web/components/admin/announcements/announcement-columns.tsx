"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import {
  CheckCircle2,
  Edit,
  MoreHorizontal,
  PauseCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { toggleAnnouncementActive } from "@/actions/announcement/update-announcement";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Announcement } from "@/db/schema/announcement";
import { cn } from "@/lib/utils";

const typeColors: Record<string, { bg: string; text: string; dot: string }> = {
  info: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  warning: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  alert: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

interface ColumnActionsProps {
  onEdit: (announcement: Announcement) => void;
  onDelete: (id: number) => void;
}

export const createAnnouncementColumns = ({
  onEdit,
  onDelete,
}: ColumnActionsProps): ColumnDef<Announcement>[] => [
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => {
      const announcement = row.original;
      const colors = typeColors[announcement.type || "info"];
      return (
        <div className="flex items-center gap-2 max-w-[250px]">
          <div className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
          <span className="font-medium truncate">{announcement.title}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => (
      <span className="text-muted-foreground max-w-[200px] truncate block">
        {row.original.description || "—"}
      </span>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.original.type || "info";
      const colors = typeColors[type];
      return (
        <Badge className={cn(colors.bg, colors.text, "border-0 capitalize")}>
          {type}
        </Badge>
      );
    },
  },
  {
    accessorKey: "active",
    header: "Status",
    cell: ({ row }) => {
      const active = row.original.active;
      return (
        <Badge
          className={
            active
              ? "bg-emerald-100 text-emerald-700 border-0"
              : "bg-gray-100 text-gray-600 border-0"
          }
        >
          {active ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) =>
      row.original.createdAt
        ? format(new Date(row.original.createdAt), "MMM d, yyyy")
        : "—",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const announcement = row.original;

      const handleToggle = async () => {
        const result = await toggleAnnouncementActive(
          announcement.id,
          !announcement.active,
        );
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.error);
        }
      };

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="size-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(announcement)}>
              <Edit className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggle}>
              {announcement.active ? (
                <>
                  <PauseCircle className="mr-2 size-4" />
                  Deactivate
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 size-4" />
                  Activate
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(announcement.id)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
