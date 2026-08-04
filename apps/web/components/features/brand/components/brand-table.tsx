"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import {
  ActiveStatusBadge,
  SetupEntityTable,
  SetupToolbar,
} from "@/components/features/product-setup";
import type { BrandSetupRow } from "./brand-columns";
import NewBrandDialog from "./new-brand-dialog";

interface BrandTableProps {
  columns: ColumnDef<BrandSetupRow, unknown>[];
  data: BrandSetupRow[];
}

export default function BrandTable({ columns, data }: BrandTableProps) {
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  );
  const [category, setCategory] = useQueryState(
    "category",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const categories = useMemo(() => {
    const values = new Map<number, string>();
    for (const item of data) {
      for (const itemCategory of item.categories) {
        values.set(itemCategory.id, itemCategory.name);
      }
    }
    return [...values.entries()].map(([id, name]) => ({ id, name }));
  }, [data]);
  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch = !query || item.name.toLowerCase().includes(query);
      const matchesCategory =
        category === "all" ||
        item.categories.some((value) => value.id === Number(category));
      const matchesStatus =
        status === "all" ||
        (status === "active" ? item.isActive : !item.isActive);
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [category, data, search, status]);

  return (
    <div className="space-y-4">
      <SetupToolbar
        filterDefinitions={[
          {
            key: "category",
            label: "Category",
            value: category,
            onChange: (value) => void setCategory(value),
            options: [
              { value: "all", label: "All categories" },
              ...categories.map((option) => ({
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
          search || category !== "all" || status !== "all",
        )}
        onClear={() => {
          void setSearch("");
          void setCategory("all");
          void setStatus("all");
        }}
        onSearchChange={(value) => void setSearch(value)}
        searchPlaceholder="Search Brand Name"
        searchValue={search}
      />
      <SetupEntityTable
        columns={columns}
        data={filteredData}
        emptyAction={data.length === 0 ? <NewBrandDialog /> : undefined}
        emptyDescription="Create a brand to associate it with configured Core Identities and products."
        emptyTitle="No brands found"
        getRowId={(row) => String(row.id)}
        mobile={{
          href: (row) => `/dashboard/admin/brands/${row.id}`,
          title: (row) => row.name,
          description: (row) => row.skuCode ?? row.slug,
          meta: (row) => [
            row.categories.length > 0
              ? row.categories.map((item) => item.name).join(", ")
              : "No category usage",
            `${row.productCount.toLocaleString()} Product${row.productCount === 1 ? "" : "s"}`,
          ],
          status: (row) => <ActiveStatusBadge isActive={row.isActive} />,
        }}
      />
    </div>
  );
}
