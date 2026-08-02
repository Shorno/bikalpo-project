import { cn } from "@/lib/utils";

export function CartRetailerLabel({
  shopName,
  className,
}: {
  shopName?: string | null;
  className?: string;
}) {
  if (!shopName) return null;

  return (
    <p className={cn("truncate text-xs font-medium text-slate-600", className)}>
      Sold by {shopName}
    </p>
  );
}
