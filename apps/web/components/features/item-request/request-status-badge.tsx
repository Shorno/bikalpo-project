"use client";

import type { ItemRequestStatus } from "@bikalpo-project/db/schema";
import { Badge } from "@/components/ui/badge";

interface RequestStatusBadgeProps {
  status: ItemRequestStatus;
  className?: string;
}

const statusConfig: Record<
  ItemRequestStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
  },
  approved: {
    label: "Approved",
    variant: "default",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
  },
  suggested: {
    label: "Alternative Suggested",
    variant: "outline",
  },
};

export function RequestStatusBadge({
  status,
  className,
}: RequestStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
