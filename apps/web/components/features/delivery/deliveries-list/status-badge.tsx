import { Badge } from "@/components/ui/badge";
import type { StatusBadgeProps } from "./types";

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const getVariant = () => {
    if (type === "group") {
      return status === "out_for_delivery" ? "default" : "secondary";
    }
    if (status === "delivered") return "default";
    if (status === "failed") return "destructive";
    return "secondary";
  };

  const displayStatus = type === "group" ? status.replace(/_/g, " ") : status;

  return (
    <Badge variant={getVariant()}>
      <span className="capitalize">{displayStatus}</span>
    </Badge>
  );
}
