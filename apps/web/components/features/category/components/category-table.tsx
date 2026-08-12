"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import {
  ActiveStatusBadge,
  SetupEntityTable,
  SetupToolbar,
} from "@/components/features/product-setup";
import type { CategoryWithSubcategories } from "./category-columns";
import NewCategoryDialog from "./new-category-dialog";

interface CategoryTableProps {
  columns: ColumnDef<CategoryWithSubcategories, unknown>[];
  data: CategoryWithSubcategories[];
  types?: { id: number; name: string }[];
}

export default function CategoryTable({
  columns,
  data,
  types = [],
}: CategoryTableProps) {
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  );
  const [type, setType] = useQueryState(
    "type",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      const matchesType = type === "all" || item.typeId === Number(type);
      const matchesStatus =
        status === "all" ||
        (status === "active" ? item.isActive : !item.isActive);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [data, search, status, type]);

  return (
    <div className="space-y-4">
      <SetupToolbar
        filterDefinitions={[
          {
            key: "type",
            label: "Type",
            value: type,
            onChange: (value) => void setType(value),
            options: [
              { value: "all", label: "All types" },
              ...types.map((option) => ({
                value: String(option.id),
                label: option.name,
              })),
            ],
            widthClassName: "md:w-44",
          },
          {
            key: "status",
            label: "Status",
            value: status,
            onChange: (value) => void setStatus(value),
            options: [
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
        hasActiveFilters={Boolean(search || type !== "all" || status !== "all")}
        onClear={() => {
          void setSearch("");
          void setType("all");
          void setStatus("all");
        }}
        onSearchChange={(value) => void setSearch(value)}
        searchPlaceholder="Search Category Name"
        searchValue={search}
      />
      <SetupEntityTable
        columns={columns}
        data={filteredData}
        emptyAction={
          data.length === 0 && !search && type === "all" && status === "all" ? (
            <NewCategoryDialog triggerLabel="Create First Category" />
          ) : undefined
        }
        emptyDescription={
          search || type !== "all" || status !== "all"
            ? "No Categories match the current search and filters."
            : "Create the first Category to begin building the product taxonomy."
        }
        emptyTitle={
          search || type !== "all" || status !== "all"
            ? "No matching Categories"
            : "No Category found"
        }
        getRowId={(row) => String(row.id)}
        mobile={{
          href: (row) => `/dashboard/admin/categories/${row.id}`,
          title: (row) => row.name,
          description: (row) => row.skuCode ?? "—",
          meta: (row) => [row.type?.name ?? "Legacy unassigned"],
          status: (row) => <ActiveStatusBadge isActive={row.isActive} />,
        }}
      />
    </div>
  );
}
