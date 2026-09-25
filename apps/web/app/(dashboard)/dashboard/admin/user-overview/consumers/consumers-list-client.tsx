"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

type ConsumerRow = {
  id: string;
  idNumber: string;
  name: string;
  location: string;
  orderCount: number;
  lastOrder: Date | string | null;
  status: "Active" | "Blocked";
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const numberFormat = new Intl.NumberFormat("en-US");

function formatDate(value: Date | string | null) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

const columns: ColumnDef<ConsumerRow>[] = [
  {
    accessorKey: "idNumber",
    header: "ID Number",
    cell: ({ row }) => (
      <span className="font-mono text-xs font-medium">
        {row.original.idNumber}
      </span>
    ),
  },
  {
    accessorKey: "name",
    header: "Full Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  { accessorKey: "location", header: "Location" },
  {
    accessorKey: "orderCount",
    header: "Orders",
    cell: ({ row }) => (
      <span className="font-mono tabular-nums">
        {numberFormat.format(row.original.orderCount)}
      </span>
    ),
  },
  {
    accessorKey: "lastOrder",
    header: "Last Order",
    cell: ({ row }) => formatDate(row.original.lastOrder),
  },
  {
    id: "actions",
    header: "Action",
    cell: ({ row }) => (
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-8 gap-1 px-2 text-xs"
      >
        <Link href={`${ADMIN_BASE}/user-overview/consumers/${row.original.id}`}>
          View <ArrowRight className="size-3" aria-hidden />
        </Link>
      </Button>
    ),
  },
];

export function ConsumersListClient() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "blocked">("all");
  const [accountType, setAccountType] = useState<"all" | "consumer">("all");
  const [location, setLocation] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const overviewInput = useMemo(
    () => ({ search: appliedSearch, status, accountType, location }),
    [appliedSearch, status, accountType, location],
  );
  const listQuery = useQuery(
    orpc.adminConsumerManagement.list.queryOptions({
      input: { ...overviewInput, page, pageSize },
    }),
  );
  const overviewQuery = useQuery(
    orpc.adminConsumerManagement.overview.queryOptions({
      input: overviewInput,
    }),
  );
  const consumers = (listQuery.data?.consumers ?? []) as ConsumerRow[];
  const pagination = listQuery.data?.pagination;
  const summary = overviewQuery.data;
  const table = useReactTable({
    data: consumers,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pagination?.totalPages ?? 0,
  });
  const first = pagination?.totalCount ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, pagination?.totalCount ?? 0);

  return (
    <div className="min-w-0 space-y-6">
      <h1 className="sr-only">Consumers</h1>
      <section
        aria-label="Search and filter consumers"
        className="space-y-3 rounded-xl border bg-card p-4 sm:p-6"
      >
        <div className="relative w-full sm:max-w-2xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search consumers"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, email, phone or account ID..."
            className="h-10 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as typeof status);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Status" className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={accountType}
            onValueChange={(value) => {
              setAccountType(value as typeof accountType);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Account type" className="w-full sm:w-44">
              <SelectValue placeholder="Account Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Account Types</SelectItem>
              <SelectItem value="consumer">Consumer</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={location}
            onValueChange={(value) => {
              setLocation(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Location" className="w-full sm:w-48">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {(summary?.locations ?? []).map((place) => (
                <SelectItem key={place} value={place}>
                  {place}
                </SelectItem>
              ))}
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="w-full gap-2 sm:ml-auto sm:w-auto"
            onClick={() => {
              setSearch("");
              setAppliedSearch("");
              setStatus("all");
              setAccountType("all");
              setLocation("all");
              setPage(1);
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden /> Reset Filter
          </Button>
        </div>
      </section>

      <section aria-labelledby="consumer-summary" className="space-y-3">
        <h2
          id="consumer-summary"
          className="text-sm font-semibold tracking-tight"
        >
          Quick Summary
        </h2>
        <Card className="gap-0 border py-0 shadow-none ring-0">
          <CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/20 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3 text-sm font-semibold sm:text-base">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Users className="size-[18px]" aria-hidden />
              </span>
              Consumer User Performance
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!summary}
                  className="gap-2"
                >
                  <FileText className="size-4" aria-hidden /> View Report
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85dvh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Consumer Registration Report</DialogTitle>
                  <DialogDescription>
                    Registrations by day over the last 30 days.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                  {summary?.points.map((point) => (
                    <div
                      key={point.date}
                      className="flex justify-between border-b pb-2"
                    >
                      <span>{point.date}</span>
                      <span className="font-mono">{point.registrations}</span>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="px-4 py-5 sm:px-6 sm:py-6">
            {overviewQuery.isError && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                Could not load consumer performance.
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 sm:gap-x-10">
              <div>
                <dt className="text-sm text-muted-foreground">
                  Total Consumers
                </dt>
                <dd className="mt-1.5 font-mono text-3xl font-semibold">
                  {overviewQuery.isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    numberFormat.format(summary?.total ?? 0)
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Consumer Growth
                </dt>
                <dd className="mt-1.5 font-mono text-2xl font-semibold">
                  {overviewQuery.isLoading ? (
                    <Skeleton className="h-8 w-20" />
                  ) : summary?.growthPercent == null ? (
                    "—"
                  ) : (
                    `${summary.growthPercent > 0 ? "+" : ""}${summary.growthPercent}%`
                  )}
                </dd>
              </div>
            </dl>
            <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-2 border-t pt-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">New Users</dt>
                <dd className="font-mono font-medium">
                  {summary ? numberFormat.format(summary.newUsers) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Orders This Month</dt>
                <dd className="font-mono font-medium">
                  {summary ? numberFormat.format(summary.ordersThisMonth) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Blocked</dt>
                <dd className="font-mono font-medium">
                  {summary ? numberFormat.format(summary.blocked) : "—"}
                </dd>
              </div>
            </dl>
            <figure className="mt-6">
              <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                User Registration Growth
              </figcaption>
              {summary ? (
                <ChartContainer
                  config={{
                    registrations: {
                      label: "Registrations",
                      color: "var(--primary)",
                    },
                  }}
                  className="h-48 w-full aspect-auto"
                  aria-label="Daily consumer registrations in the last 30 days"
                >
                  <LineChart
                    accessibilityLayer
                    data={summary.points}
                    margin={{ top: 12, right: 14, bottom: 0, left: 14 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                      minTickGap={32}
                      interval="preserveStartEnd"
                      height={32}
                    />
                    <YAxis hide allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="registrations"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <Skeleton className="h-48 w-full" />
              )}
            </figure>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="consumer-list" className="space-y-3">
        <h2 id="consumer-list" className="text-sm font-semibold tracking-tight">
          Registered Consumer User List
        </h2>
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow
                    key={group.id}
                    className="bg-muted/30 hover:bg-muted/30"
                  >
                    {group.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="px-4 text-xs font-semibold uppercase tracking-wider"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {listQuery.isLoading ? (
                  Array.from({ length: 6 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={columns.length} className="px-4 py-3">
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : listQuery.isError ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-36 text-center text-destructive"
                    >
                      Could not load consumers.{" "}
                      <Button
                        variant="link"
                        onClick={() => void listQuery.refetch()}
                      >
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : consumers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-36 text-center text-muted-foreground"
                    >
                      No consumers match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4 py-3">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              {first}–{last} of {pagination?.totalCount ?? 0} consumers
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger aria-label="Rows per page" className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="20">20 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </Button>
              <span className="min-w-12 text-center text-xs tabular-nums">
                {page} / {Math.max(1, pagination?.totalPages ?? 1)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (pagination?.totalPages ?? 1)}
                onClick={() => setPage(page + 1)}
              >
                Next <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
