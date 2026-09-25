"use client";

import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { BUSINESS_NATURES } from "@/constants/seller-registration";
import { useDebounce } from "@/hooks/use-debounce";
import { orpc } from "@/utils/orpc";
import { MissingValue } from "../../_components/user-detail-content";
import { applicationColumns } from "./application-columns";

const STATUSES = ["all", "active", "verified", "pending", "suspended"] as const;
type Status = (typeof STATUSES)[number];
const PAGE_SIZE = 20;

export function ApprovalClient() {
  const [params, setParams] = useQueryStates(
    {
      status: parseAsString.withDefault("all"),
      businessType: parseAsString.withDefault("all"),
      district: parseAsString.withDefault("all"),
      q: parseAsString.withDefault(""),
      page: parseAsInteger.withDefault(1),
      // Existing overview links can scope requests; expose their removable scope.
      type: parseAsString.withDefault("all"),
      nature: parseAsString.withDefault("all"),
      referral: parseAsString.withDefault("all"),
    },
    { clearOnDefault: true },
  );
  const status: Status = STATUSES.includes(params.status as Status)
    ? (params.status as Status)
    : params.status === "approved"
      ? "active"
      : "all";
  const type =
    params.type === "seller" || params.type === "warehouse"
      ? params.type
      : "all";
  const nature =
    params.nature === "unspecified" ||
    BUSINESS_NATURES.some((item) => item.id === params.nature)
      ? (params.nature as
          | "unspecified"
          | (typeof BUSINESS_NATURES)[number]["id"])
      : "all";
  const referral =
    params.referral === "direct" || params.referral === "invited"
      ? params.referral
      : "all";
  const search = useDebounce(params.q.trim(), 250);
  const page = Math.max(1, params.page);
  const filters = {
    search: search || undefined,
    status,
    type,
    businessNature: nature,
    referral,
    businessType:
      params.businessType === "all" ? undefined : params.businessType,
    district: params.district === "all" ? undefined : params.district,
  } as const;
  const overview = useQuery(
    orpc.adminApplication.getOverview.queryOptions({ input: filters }),
  );
  const options = useQuery(
    orpc.adminApplication.getFilterOptions.queryOptions(),
  );
  const requests = useQuery(
    orpc.adminApplication.list.queryOptions({
      input: { ...filters, page, limit: PAGE_SIZE },
    }),
  );
  const items = requests.data?.items ?? [];
  const total = requests.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (requests.data && page > totalPages)
      void setParams({ page: totalPages });
  }, [requests.data, page, totalPages, setParams]);
  const table = useReactTable({
    data: items,
    columns: applicationColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  });
  const reset = () =>
    void setParams({
      status: null,
      businessType: null,
      district: null,
      q: null,
      page: null,
      type: null,
      nature: null,
      referral: null,
    });
  const scope = [
    ...(type !== "all"
      ? [
          {
            key: "type" as const,
            label: type === "warehouse" ? "Warehouses" : "Retailers",
          },
        ]
      : []),
    ...(nature !== "all"
      ? [
          {
            key: "nature" as const,
            label:
              BUSINESS_NATURES.find((item) => item.id === nature)?.label ||
              "Unspecified nature",
          },
        ]
      : []),
    ...(referral !== "all"
      ? [
          {
            key: "referral" as const,
            label:
              referral === "invited" ? "Invited requests" : "Direct requests",
          },
        ]
      : []),
  ];
  const businessTypes = [
    ...new Set([
      ...(options.data?.businessTypes ?? []),
      ...(params.businessType !== "all" ? [params.businessType] : []),
    ]),
  ];
  const locations = [
    ...new Set([
      ...(options.data?.districts ?? []),
      ...(params.district !== "all" ? [params.district] : []),
    ]),
  ];
  const kpis = [
    {
      label: "Total Requests",
      value: overview.data?.total,
      hint: "Requests matching the current search and filters.",
    },
    {
      label: "Frozen",
      value: overview.data?.frozen,
      hint: "Frozen request status is not currently recorded.",
    },
    {
      label: "Suspended",
      value: overview.data?.suspended,
      hint: "Matching requests whose linked account is suspended.",
    },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <h1 className="sr-only">Approval</h1>
      <section
        aria-label="Request filters"
        className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Search requests by name, ID, business or phone"
            placeholder="Search by name, ID, business or phone..."
            value={params.q}
            onChange={(event) =>
              void setParams({ q: event.target.value, page: 1 })
            }
            className="h-9 bg-background pl-9"
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full space-y-2 sm:w-40">
            <Label htmlFor="request-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                void setParams({ status: value, page: 1 })
              }
            >
              <SelectTrigger id="request-status" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "all"
                      ? "All"
                      : value.charAt(0).toUpperCase() + value.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 sm:w-52">
            <Label htmlFor="request-business-type">Business Type</Label>
            <Select
              value={params.businessType}
              onValueChange={(value) =>
                void setParams({ businessType: value, page: 1 })
              }
            >
              <SelectTrigger id="request-business-type" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {businessTypes.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-2 sm:w-44">
            <Label htmlFor="request-location">Location</Label>
            <Select
              value={params.district}
              onValueChange={(value) =>
                void setParams({ district: value, page: 1 })
              }
            >
              <SelectTrigger id="request-location" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {locations.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="h-9 w-full sm:ml-auto sm:w-auto"
            onClick={reset}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Reset Filter
          </Button>
        </div>
        {scope.length > 0 && (
          <div
            role="group"
            aria-label="Filters from overview"
            className="flex flex-wrap gap-2"
          >
            {scope.map((item) => (
              <Button
                key={item.key}
                variant="secondary"
                size="sm"
                onClick={() => void setParams({ [item.key]: null, page: 1 })}
                aria-label={"Remove " + item.label + " filter"}
              >
                {item.label}
                <X className="size-3" aria-hidden />
              </Button>
            ))}
          </div>
        )}
        {options.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 text-sm"
          >
            <p>Could not load filter options.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void options.refetch()}
            >
              Retry filters
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="request-summary-heading" className="space-y-3">
        <h2
          id="request-summary-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Quick Summary
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              title={kpi.hint}
              className="rounded-xl border bg-card p-5 sm:p-6"
            >
              <dt className="text-sm text-muted-foreground">{kpi.label}</dt>
              <dd className="mt-2 font-mono text-3xl font-semibold tabular-nums">
                {overview.isPending ? (
                  <Skeleton className="h-9 w-20" />
                ) : kpi.value == null ? (
                  <MissingValue />
                ) : (
                  kpi.value.toLocaleString("en-US")
                )}
              </dd>
            </div>
          ))}
        </dl>
        {overview.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 text-sm"
          >
            <p>Could not load the summary.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void overview.refetch()}
            >
              Retry summary
            </Button>
          </div>
        )}
      </section>

      <section
        aria-labelledby="request-list-heading"
        className="min-w-0 space-y-3"
      >
        <h2
          id="request-list-heading"
          className="text-sm font-semibold tracking-tight"
        >
          Retailer Request List
        </h2>
        <div
          className="min-w-0 overflow-hidden rounded-xl border bg-card"
          aria-busy={requests.isFetching}
        >
          {requests.isPending ? (
            <div
              role="status"
              aria-label="Loading requests"
              className="space-y-4 p-5"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-7 w-full" />
              ))}
            </div>
          ) : requests.isError ? (
            <div
              role="alert"
              className="flex min-h-60 flex-col items-center justify-center gap-3 p-6 text-center"
            >
              <AlertCircle
                className="size-8 text-muted-foreground"
                aria-hidden
              />
              <p>Could not load requests.</p>
              <Button variant="outline" onClick={() => void requests.refetch()}>
                Retry requests
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 p-6 text-center">
              <Inbox className="size-8 text-muted-foreground" aria-hidden />
              <p className="font-medium">No requests found</p>
              <p className="text-sm text-muted-foreground">
                No requests match the current search and filters.
              </p>
              <Button variant="outline" size="sm" onClick={reset}>
                Reset Filter
              </Button>
            </div>
          ) : (
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
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
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
                ))}
              </TableBody>
            </Table>
          )}
          {!requests.isPending && !requests.isError && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, total)} of {total} requests
              </p>
              <nav
                aria-label="Request pagination"
                className="flex items-center gap-3"
              >
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => void setParams({ page: page - 1 })}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-sm tabular-nums">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => void setParams({ page: page + 1 })}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </nav>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
