"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  ActiveStatusBadge,
  SetupEntityTable,
  SetupToolbar,
} from "@/components/features/product-setup";
import NewTypeDialog from "./new-type-dialog";
import type { ProductTypeRow } from "./product-type-columns";

interface ProductTypeTableProps {
  columns: ColumnDef<ProductTypeRow, unknown>[];
  data: ProductTypeRow[];
  page: number;
  pageSize: number;
  search: string;
  status: string;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSearchChange: (search: string) => void;
  onStatusChange: (status: string) => void;
}

export default function ProductTypeTable({
  columns,
  data,
  page,
  pageSize,
  search,
  status,
  total,
  onPageChange,
  onPageSizeChange,
  onSearchChange,
  onStatusChange,
}: ProductTypeTableProps) {
  const hasFilters = Boolean(search || status !== "all");

  return (
    <div className="space-y-4">
      <SetupToolbar
        filterDefinitions={[
          {
            key: "status",
            label: "Status",
            value: status,
            onChange: onStatusChange,
            options: [
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
        hasActiveFilters={hasFilters}
        onClear={() => {
          onSearchChange("");
          onStatusChange("all");
        }}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search Type Name"
        searchValue={search}
      />
      <SetupEntityTable
        columns={columns}
        data={data}
        emptyAction={!hasFilters && total === 0 ? <NewTypeDialog /> : undefined}
        emptyDescription={
          hasFilters
            ? "No Types match the current search and status filter."
            : "Create a Type to begin organizing the global product taxonomy."
        }
        emptyTitle={hasFilters ? "No matching Types" : "No Types found"}
        getRowId={(row) => String(row.id)}
        mobile={{
          href: (row) => `/dashboard/admin/types/${row.id}`,
          title: (row) => row.name,
          description: (row) => row.skuCode || "—",
          status: (row) => <ActiveStatusBadge isActive={row.isActive} />,
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange,
          onPageSizeChange,
        }}
      />
    </div>
  );
}
