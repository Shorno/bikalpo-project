import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CategoryTableSkeletonProps {
  columns?: number;
  rows?: number;
}

export default function TableSkeleton({
  columns = 4,
  rows = 5,
}: CategoryTableSkeletonProps) {
  return (
    <div className="w-full">
      {/* Filter and button skeleton */}
      <div className="flex items-center justify-between py-4 gap-2">
        <Skeleton className="h-10 max-w-sm w-full" />
        <Skeleton className="h-10 w-[120px]" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, index) => (
                <TableHead key={index}>
                  <Skeleton className="h-4 w-[100px]" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <Skeleton className="h-20 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="space-x-2">
          <Skeleton className="h-9 w-[100px] inline-block" />
          <Skeleton className="h-9 w-[100px] inline-block" />
        </div>
      </div>
    </div>
  );
}
