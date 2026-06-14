import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const PIPELINE_STEPS = ["Submitted", "Accepted", "Waiting", "Picked", "Delivery", "Done"];
const TREND_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TABLE_SKELETON_ROWS = 8;
const TIMELINE_SKELETON_STEPS = 5;
const LINE_ITEM_SKELETON_ROWS = 4;

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-32" />
      <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function MetricCardsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PipelineTrackerSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-24 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
      </div>

      <div className="relative mt-6 px-4">
        <Skeleton className="absolute top-[14px] left-4 right-4 h-[3px] rounded-full" />
        <div className="relative z-10 grid grid-cols-6">
          {PIPELINE_STEPS.map((step) => (
            <div key={step} className="flex flex-col items-center text-center">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="mt-2.5 h-2.5 w-12" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}

function PurchasesTableRowSkeleton() {
  return (
    <TableRow className="border-b border-border hover:bg-transparent">
      <TableCell className="w-[18%] min-w-[125px] max-w-[150px] px-4 py-3.5">
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="w-[22%] min-w-[150px] max-w-[190px] px-4 py-3.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-1 h-3 w-20" />
      </TableCell>
      <TableCell className="w-[20%] min-w-[140px] max-w-[170px] px-4 py-3.5">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="mt-1 h-3 w-24" />
      </TableCell>
      <TableCell className="w-[12%] min-w-[85px] px-4 py-3.5">
        <Skeleton className="ml-auto h-4 w-16" />
      </TableCell>
      <TableCell className="w-[13%] min-w-[95px] px-4 py-3.5">
        <Skeleton className="h-6 w-20 rounded-full" />
      </TableCell>
      <TableCell className="w-[15%] min-w-[95px] px-4 py-3.5">
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell className="w-[10%] min-w-[75px] px-4 py-3.5">
        <Skeleton className="ml-auto h-7 w-14" />
      </TableCell>
    </TableRow>
  );
}

export function PurchasesTableBodySkeleton({ rows = TABLE_SKELETON_ROWS }: { rows?: number }) {
  return (
    <>
      <Table className="w-full table-fixed">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
            <TableHead className="h-auto w-[18%] min-w-[125px] max-w-[150px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order #
            </TableHead>
            <TableHead className="h-auto w-[22%] min-w-[150px] max-w-[190px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Supplier
            </TableHead>
            <TableHead className="h-auto w-[20%] min-w-[140px] max-w-[170px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Items
            </TableHead>
            <TableHead className="h-auto w-[12%] min-w-[85px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total
            </TableHead>
            <TableHead className="h-auto w-[13%] min-w-[95px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="h-auto w-[15%] min-w-[95px] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Date
            </TableHead>
            <TableHead className="h-auto w-[10%] min-w-[75px] px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Action
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <PurchasesTableRowSkeleton key={i} />
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-lg" />
          ))}
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </>
  );
}

export function TrendChartSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-3 w-36" />
      </div>
      <div className="space-y-4">
        {TREND_DAYS.map((day) => (
          <div key={day} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-border pt-3 text-center">
        <Skeleton className="mx-auto h-3 w-32" />
      </div>
    </div>
  );
}

export function PurchaseDetailPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-2" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-2" />
        <Skeleton className="h-3 w-24" />
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Line items */}
        <Card className="ring-border/60">
          <CardHeader className="border-b border-border pb-4">
            <Skeleton className="h-3 w-20" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
                  {["Product", "Requested", "Approved", "Unit Price", "Total"].map((col) => (
                    <TableHead
                      key={col}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: LINE_ITEM_SKELETON_ROWS }).map((_, i) => (
                  <TableRow key={i} className="border-b border-border hover:bg-transparent">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 shrink-0 rounded-md" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-8" />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Summary */}
          <Card className="ring-border/60">
            <CardHeader className="border-b border-border pb-4">
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-6 w-28" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="ring-border/60">
            <CardHeader className="border-b border-border pb-4">
              <Skeleton className="h-3 w-16" />
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {Array.from({ length: TIMELINE_SKELETON_STEPS }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
                  <div className="space-y-1.5 pb-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
