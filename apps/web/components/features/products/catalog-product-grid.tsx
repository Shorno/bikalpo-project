import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function CatalogProductGrid({
  children,
  withSidebar = false,
}: {
  children: ReactNode;
  withSidebar?: boolean;
}) {
  return (
    <div
      className={
        withSidebar
          ? "grid grid-cols-2 gap-[9px] min-[801px]:grid-cols-3 min-[801px]:gap-3.5 xl:grid-cols-4 2xl:grid-cols-5"
          : "grid grid-cols-2 gap-[9px] min-[801px]:grid-cols-5 min-[801px]:gap-3.5"
      }
    >
      {children}
    </div>
  );
}

export function CatalogProductCardSkeleton() {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#dce6f0] bg-white">
      <Skeleton className="h-[145px] w-full rounded-none min-[801px]:h-[185px]" />
      <div className="space-y-2 px-2 pt-2 pb-[9px] min-[801px]:px-3 min-[801px]:pt-[11px] min-[801px]:pb-[13px]">
        <Skeleton className="h-[30px] w-full min-[801px]:h-[35px]" />
        <Skeleton className="h-5 w-2/3" />
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-[26px] w-full min-[801px]:h-[29px]" />
          <Skeleton className="h-[26px] w-full min-[801px]:h-[29px]" />
        </div>
      </div>
    </div>
  );
}

export function CatalogProductsGridSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-36" />
      </div>
      <CatalogProductGrid withSidebar>
        {Array.from({ length: 12 }, (_, index) => (
          <CatalogProductCardSkeleton key={index} />
        ))}
      </CatalogProductGrid>
    </div>
  );
}
