"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useMemo } from "react";
import {
  ActiveStatusBadge,
  SetupEntityTable,
  SetupToolbar,
} from "@/components/features/product-setup";
import type { VariantOptionRow } from "./variant-option-columns";

interface VariantOptionTableProps {
  columns: ColumnDef<VariantOptionRow, unknown>[];
  data: VariantOptionRow[];
  types?: { id: number; name: string }[];
  categories?: { id: number; name: string; typeId: number | null }[];
  emptyAction?: ReactNode;
}

export default function VariantOptionTable({
  columns,
  data,
  types = [],
  categories = [],
  emptyAction,
}: VariantOptionTableProps) {
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
  const [unit, setUnit] = useQueryState(
    "unit",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [structure, setStructure] = useQueryState(
    "structure",
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
  const units = useMemo(
    () => [...new Set(data.map((item) => item.unit))].sort(),
    [data],
  );
  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.displayAlias?.toLowerCase().includes(query) ||
        item.skuCode?.toLowerCase().includes(query);
      const matchesType = type === "all" || item.typeId === Number(type);
      const matchesCategory =
        category === "all" || item.categoryId === Number(category);
      const matchesUnit = unit === "all" || item.unit === unit;
      const matchesStructure =
        structure === "all" || item.variantType === structure;
      const matchesStatus =
        status === "all" ||
        (status === "active" ? item.isActive : !item.isActive);
      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesUnit &&
        matchesStructure &&
        matchesStatus
      );
    });
  }, [category, data, search, status, structure, type, unit]);

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
            options: withAllOption(
              "types",
              types.map((item) => ({
                value: String(item.id),
                label: item.name,
              })),
            ),
          },
          {
            key: "category",
            label: "Category",
            value: category,
            onChange: (value) => void setCategory(value),
            options: withAllOption(
              "categories",
              filteredCategories.map((item) => ({
                value: String(item.id),
                label: item.name,
              })),
            ),
          },
          {
            key: "unit",
            label: "Unit",
            value: unit,
            onChange: (value) => void setUnit(value),
            options: withAllOption(
              "units",
              units.map((value) => ({ value, label: value })),
            ),
          },
          {
            key: "structure",
            label: "Pack / Loose",
            value: structure,
            onChange: (value) => void setStructure(value),
            options: withAllOption("structures", [
              { value: "pack", label: "Pack" },
              { value: "loose", label: "Loose" },
            ]),
          },
          {
            key: "status",
            label: "Status",
            value: status,
            onChange: (value) => void setStatus(value),
            options: withAllOption("statuses", [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]),
          },
        ]}
        hasActiveFilters={Boolean(
          search ||
            type !== "all" ||
            category !== "all" ||
            unit !== "all" ||
            structure !== "all" ||
            status !== "all",
        )}
        onClear={() => {
          void setSearch("");
          void setType("all");
          void setCategory("all");
          void setUnit("all");
          void setStructure("all");
          void setStatus("all");
        }}
        onSearchChange={(value) => void setSearch(value)}
        searchPlaceholder="Search variant name or SKU"
        searchValue={search}
      />
      <SetupEntityTable
        columns={columns}
        data={filteredData}
        emptyAction={data.length === 0 ? emptyAction : undefined}
        emptyDescription="Create a canonical variant definition and scope it to a Type or Category."
        emptyTitle="No variants found"
        getRowId={(row) => String(row.id)}
        mobile={{
          href: (row) => `/dashboard/admin/variant-options/${row.id}`,
          title: (row) => row.name,
          description: (row) =>
            row.skuCode ?? row.canonicalSignature ?? "Canonical variant",
          meta: (row) => [
            [row.size, row.unit].filter(Boolean).join(" "),
            row.variantType === "pack" ? "Pack" : "Loose",
            `${row.productUsageCount} products`,
          ],
          status: (row) => <ActiveStatusBadge isActive={row.isActive} />,
        }}
      />
    </div>
  );
}

function withAllOption(
  label: string,
  options: { value: string; label: string }[],
) {
  return [{ value: "all", label: `All ${label}` }, ...options];
}
