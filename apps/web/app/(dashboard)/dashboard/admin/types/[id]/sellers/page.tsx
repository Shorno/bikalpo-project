"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useParams } from "next/navigation";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import {
  ActiveStatusBadge,
  SetupDetailHeader,
  SetupEntityTable,
  SetupErrorState,
} from "@/components/features/product-setup";
import {
  normalizeTypeSellerRole,
  TypeSellerTabs,
} from "@/components/features/product-type/components/type-seller-tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

type SellerRow = {
  userId: string;
  displayName: string;
  deliveredOrderCount: number;
  averageRating: number;
  rowNumber: number;
};

export default function TypeSellersPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [roleParam, setRoleParam] = useQueryState(
    "role",
    parseAsString.withDefault("retailer").withOptions({ clearOnDefault: true }),
  );
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  );
  const [pageSize, setPageSize] = useQueryState(
    "size",
    parseAsInteger.withDefault(20).withOptions({ clearOnDefault: true }),
  );
  const activeRole = normalizeTypeSellerRole(roleParam);
  const normalizedPageSize = pageSize === 10 || pageSize === 50 ? pageSize : 20;
  const { data, isError, isFetching, isLoading, refetch } = useQuery({
    queryKey: [
      "adminProductType",
      "listSellers",
      id,
      activeRole,
      page,
      normalizedPageSize,
    ],
    queryFn: () =>
      orpc.adminProductType.listSellers.call({
        id,
        role: activeRole,
        page: Math.max(1, page),
        pageSize: normalizedPageSize,
      }),
    enabled: Number.isFinite(id),
    placeholderData: keepPreviousData,
  });
  const activePage = data?.pagination.page ?? Math.max(1, page);
  const activePageSize = data?.pagination.pageSize ?? normalizedPageSize;
  const rows: SellerRow[] = (data?.sellers ?? []).map((seller, index) => ({
    ...seller,
    rowNumber: (activePage - 1) * activePageSize + index + 1,
  }));
  const columns = useMemo<ColumnDef<SellerRow, unknown>[]>(
    () => [
      {
        accessorKey: "rowNumber",
        header: "Rank",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.rowNumber}
          </span>
        ),
        size: 72,
      },
      {
        accessorKey: "displayName",
        header: "Seller Name",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            className="font-medium hover:text-primary hover:underline"
            href={`${ADMIN_BASE}/users/${encodeURIComponent(row.original.userId)}`}
          >
            {row.original.displayName}
          </Link>
        ),
      },
      {
        accessorKey: "deliveredOrderCount",
        header: "Orders",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            {row.original.deliveredOrderCount.toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "averageRating",
        header: "Rating",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs tabular-nums">
            <span aria-hidden="true" className="text-amber-600">
              ★
            </span>{" "}
            {row.original.averageRating.toFixed(1)}
          </span>
        ),
      },
      {
        accessorKey: "userId",
        header: "User ID",
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline"
            href={`${ADMIN_BASE}/users/${encodeURIComponent(row.original.userId)}`}
          >
            {row.original.userId}
          </Link>
        ),
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (isError) return <SetupErrorState onRetry={() => void refetch()} />;
  if (!data) return null;

  const roleIsChanging = isFetching && data.role !== activeRole;
  return (
    <div className="space-y-5">
      <SetupDetailHeader
        backHref={`${ADMIN_BASE}/types/${id}?role=${activeRole}`}
        backLabel={`Back to ${data.type.name}`}
        name={`${data.type.name} sellers`}
        status={<ActiveStatusBadge isActive={data.type.isActive} />}
      />

      <div className="overflow-hidden rounded-lg border">
        <TypeSellerTabs
          onValueChange={(role) => {
            void setRoleParam(role);
            void setPage(1);
          }}
          value={activeRole}
        >
          {(role, label) =>
            role === activeRole ? (
              <div className="p-4">
                {roleIsChanging ? (
                  <Skeleton className="h-72 w-full" />
                ) : (
                  <SetupEntityTable
                    columns={columns}
                    data={rows}
                    emptyDescription={`No ${label.toLowerCase()} sellers are linked to this Type.`}
                    emptyTitle={`No ${label} sellers`}
                    getRowId={(row) => row.userId}
                    mobile={{
                      href: (row) =>
                        `${ADMIN_BASE}/users/${encodeURIComponent(row.userId)}`,
                      title: (row) => row.displayName,
                      description: (row) => row.userId,
                      meta: (row) => [
                        `${row.deliveredOrderCount.toLocaleString()} orders`,
                        `★ ${row.averageRating.toFixed(1)}`,
                      ],
                    }}
                    pageSizeOptions={[10, 20, 50]}
                    pagination={{
                      page: activePage,
                      pageSize: activePageSize,
                      total: data.pagination.total,
                      onPageChange: (nextPage) => void setPage(nextPage),
                      onPageSizeChange: (nextPageSize) => {
                        void setPageSize(nextPageSize);
                        void setPage(1);
                      },
                    }}
                  />
                )}
              </div>
            ) : null
          }
        </TypeSellerTabs>
      </div>
    </div>
  );
}
