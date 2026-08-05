"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import {
  SetupErrorState,
  SetupPageHeader,
  SetupPageShell,
} from "@/components/features/product-setup";
import NewTypeDialog from "@/components/features/product-type/components/new-type-dialog";
import { useProductTypeColumns } from "@/components/features/product-type/components/product-type-columns";
import { resolveProductTypeProfile } from "@/components/features/product-type/components/product-type-row";
import ProductTypeTable from "@/components/features/product-type/components/product-type-table";
import TableSkeleton from "@/components/table-skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { orpc } from "@/utils/orpc";

export default function ProductTypeList() {
  const columns = useProductTypeColumns();
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ clearOnDefault: true }),
  );
  const [pageSize, setPageSize] = useQueryState(
    "size",
    parseAsInteger.withDefault(10).withOptions({ clearOnDefault: true }),
  );
  const debouncedSearch = useDebounce(search.trim(), 300);
  const normalizedStatus =
    status === "active" || status === "inactive" ? status : "all";
  const normalizedPageSize = pageSize === 20 || pageSize === 50 ? pageSize : 10;
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: [
      "adminProductType",
      "listPage",
      debouncedSearch,
      normalizedStatus,
      page,
      normalizedPageSize,
    ],
    queryFn: () =>
      orpc.adminProductType.listPage.call({
        search: debouncedSearch || undefined,
        status: normalizedStatus,
        page: Math.max(1, page),
        pageSize: normalizedPageSize,
      }),
    placeholderData: keepPreviousData,
  });

  const activePage = data?.pagination.page ?? Math.max(1, page);
  const activePageSize = data?.pagination.pageSize ?? normalizedPageSize;
  const total = data?.pagination.total ?? 0;
  const rows = (data?.types ?? []).map((type) => ({
    ...type,
    fulfillmentProfile: resolveProductTypeProfile(type),
  }));

  const resetPage = () => void setPage(1);

  return (
    <SetupPageShell>
      <SetupPageHeader
        action={<NewTypeDialog />}
        count={total}
        description="Manage the global top-level classifications used by the product taxonomy."
        title="Types"
      />
      {isLoading ? (
        <TableSkeleton columns={4} />
      ) : isError ? (
        <SetupErrorState onRetry={() => void refetch()} />
      ) : (
        <ProductTypeTable
          columns={columns}
          data={rows}
          onPageChange={(nextPage) => void setPage(nextPage)}
          onPageSizeChange={(nextPageSize) => {
            void setPageSize(nextPageSize);
            resetPage();
          }}
          onSearchChange={(value) => {
            void setSearch(value);
            resetPage();
          }}
          onStatusChange={(value) => {
            void setStatus(value);
            resetPage();
          }}
          page={activePage}
          pageSize={activePageSize}
          search={search}
          status={normalizedStatus}
          total={total}
        />
      )}
    </SetupPageShell>
  );
}
