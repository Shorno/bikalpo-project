"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import {
  ActiveStatusBadge,
  SetupEntityTable,
  SetupToolbar,
} from "@/components/features/product-setup";
import NewSubcategoryDialog from "./new-subcategory-dialog";
import type { SubcategoryWithCategory } from "./subcategory-columns";

interface SubcategoryTableProps {
  columns: ColumnDef<SubcategoryWithCategory, unknown>[];
  data: SubcategoryWithCategory[];
  types?: { id: number; name: string }[];
  categories?: { id: number; name: string; typeId: number | null }[];
}

export default function SubcategoryTable({
  columns,
  data,
  types = [],
  categories = [],
}: SubcategoryTableProps) {
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  );
  const [type, setType] = useQueryState(
    "type",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [category, setCategory] = useQueryState(
    "category",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );

  const filteredCategories = useMemo(
    () =>
      type === "all"
        ? categories
        : categories.filter((item) => item.typeId === Number(type)),
    [categories, type],
  );
  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      const matchesType =
        type === "all" || item.category.typeId === Number(type);
      const matchesCategory =
        category === "all" || item.categoryId === Number(category);
      const matchesStatus =
        status === "all" ||
        (status === "active" ? item.isActive : !item.isActive);
      return matchesSearch && matchesType && matchesCategory && matchesStatus;
    });
  }, [category, data, search, status, type]);

  return (
    <div className="space-y-4">
      <SetupToolbar
        filterDefinitions={[
          {
            key: "type",
            label: "Type",
            value: type,
            onChange: (value) => {
              void setType(value);
              void setCategory("all");
            },
            options: [
              { value: "all", label: "All types" },
              ...types.map((option) => ({
                value: String(option.id),
                label: option.name,
              })),
            ],
          },
          {
            key: "category",
            label: "Category",
            value: category,
            onChange: (value) => void setCategory(value),
            options: [
              { value: "all", label: "All categories" },
              ...filteredCategories.map((option) => ({
                value: String(option.id),
                label: option.name,
              })),
            ],
            widthClassName: "md:w-48",
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
        hasActiveFilters={Boolean(
          search || type !== "all" || category !== "all" || status !== "all",
        )}
        onClear={() => {
          void setSearch("");
          void setType("all");
          void setCategory("all");
          void setStatus("all");
        }}
        onSearchChange={(value) => void setSearch(value)}
        searchPlaceholder="Search Sub Category Name"
        searchValue={search}
      />
      <SetupEntityTable
        columns={columns}
        data={filteredData}
        emptyAction={
          data.length === 0 &&
          !search &&
          type === "all" &&
          category === "all" &&
          status === "all" ? (
            <NewSubcategoryDialog
              categories={categories}
              triggerLabel="Create First Sub Category"
              variant="standalone"
            />
          ) : undefined
        }
        emptyDescription={
          search || type !== "all" || category !== "all" || status !== "all"
            ? "No Sub Categories match the current search and filters."
            : "Create the first Sub Category below an existing Category."
        }
        emptyTitle={
          search || type !== "all" || category !== "all" || status !== "all"
            ? "No matching Sub Categories"
            : "No Sub Category found"
        }
        getRowId={(row) => String(row.id)}
        mobile={{
          href: (row) => `/dashboard/admin/subcategories/${row.id}`,
          title: (row) => row.name,
          description: (row) => row.skuCode ?? "—",
          meta: (row) => [row.category.name],
          status: (row) => <ActiveStatusBadge isActive={row.isActive} />,
        }}
      />
    </div>
  );
}
