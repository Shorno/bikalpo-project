"use client";

import { Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SetupRowActions({
  viewHref,
  viewLabel = "View details",
  editAction,
  toggleAction,
  deleteAction,
}: {
  viewHref: string;
  viewLabel?: string;
  editAction?: ReactNode;
  toggleAction?: ReactNode;
  deleteAction?: ReactNode;
}) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="size-10" size="icon" variant="ghost">
            <MoreHorizontal aria-hidden="true" className="size-4" />
            <span className="sr-only">Open row actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem asChild>
            <Link href={viewHref}>
              <Eye aria-hidden="true" className="size-4" />
              {viewLabel}
            </Link>
          </DropdownMenuItem>
          {editAction}
          {toggleAction}
          {deleteAction && <DropdownMenuSeparator />}
          {deleteAction}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
