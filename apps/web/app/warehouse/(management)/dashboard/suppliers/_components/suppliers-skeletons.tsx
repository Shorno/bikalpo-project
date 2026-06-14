import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TABLE_SKELETON_ROWS = 8;

export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 sm:rounded-xl sm:p-4">
      <div className="mb-1 flex items-center gap-2 sm:mb-2 sm:justify-between">
        <Skeleton className="h-3 w-16 sm:w-24" />
        <Skeleton className="h-6 w-6 rounded-md sm:h-7 sm:w-7 sm:rounded-lg" />
      </div>
      <Skeleton className="h-5 w-24 sm:h-7 sm:w-32" />
    </div>
  );
}

export function MetricCardsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

function SuppliersTableRowSkeleton() {
  return (
    <TableRow className="border-b border-border hover:bg-transparent">
      <TableCell className="min-w-[10rem] px-2 py-3 sm:px-4 sm:py-3.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-3 w-24" />
      </TableCell>
      <TableCell className="min-w-[6rem] px-2 py-3 sm:px-4 sm:py-3.5">
        <Skeleton className="h-6 w-16 rounded-full" />
      </TableCell>
      <TableCell className="min-w-[7.5rem] px-2 py-3 sm:px-4 sm:py-3.5">
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="min-w-[6.5rem] px-2 py-3 sm:px-4 sm:py-3.5">
        <Skeleton className="ml-auto h-4 w-20" />
      </TableCell>
      <TableCell className="min-w-[6.75rem] px-2 py-3 sm:px-4 sm:py-3.5">
        <Skeleton className="h-6 w-24 rounded-full" />
      </TableCell>
      <TableCell className="min-w-[5.5rem] px-2 py-3 sm:px-4 sm:py-3.5">
        <Skeleton className="ml-auto h-7 w-14" />
      </TableCell>
    </TableRow>
  );
}

export function SuppliersTableBodySkeleton({
  rows = TABLE_SKELETON_ROWS,
}: {
  rows?: number;
}) {
  return (
    <div className="min-w-0">
      <Table className="w-full min-w-[44rem]">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
            {[
              "Supplier Name",
              "Category",
              "Contact",
              "Total Purchase",
              "Status",
              "Action",
            ].map((col) => (
              <TableHead
                key={col}
                className={`h-auto px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:px-4 sm:py-3 ${
                  col === "Total Purchase" || col === "Action" ? "text-right" : ""
                }`}
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <SuppliersTableRowSkeleton key={i} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
