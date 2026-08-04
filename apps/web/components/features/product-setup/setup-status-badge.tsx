import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SetupStatus = "active" | "inactive" | "pending" | "approved" | "rejected";

const labels: Record<SetupStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function SetupStatusBadge({
  status,
  className,
}: {
  status: SetupStatus;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "rounded-md border px-2 py-0.5 text-[11px] font-medium shadow-none",
        status === "active" &&
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300",
        status === "inactive" && "border-border bg-muted text-muted-foreground",
        status === "pending" &&
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        status === "approved" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "rejected" &&
          "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
        className,
      )}
      variant="outline"
    >
      {labels[status]}
    </Badge>
  );
}

export function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return <SetupStatusBadge status={isActive ? "active" : "inactive"} />;
}
