import { Package } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center border rounded-2xl bg-muted/30 shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        No active delivery assignments
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        New delivery groups will appear here when assigned
      </p>
    </div>
  );
}
