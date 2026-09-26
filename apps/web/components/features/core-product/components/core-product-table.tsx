"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import {
  ActiveStatusBadge,
  SetupActionRow,
  SetupEntityTable,
  SetupToolbar,
} from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";
import type { CoreProductWithRelations } from "./core-product-columns";
import NewCoreProductDialog from "./new-core-product-dialog";

interface CoreProductTableProps {
  columns: ColumnDef<CoreProductWithRelations, unknown>[];
  data: CoreProductWithRelations[];
}

export default function CoreProductTable({
  columns,
  data,
}: CoreProductTableProps) {
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
  const [subcategory, setSubcategory] = useQueryState(
    "subcategory",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withDefault("all").withOptions({ clearOnDefault: true }),
  );

  const types = useMemo(() => {
    const values = new Map<number, string>();
    for (const item of data) {
      if (item.category.type)
        values.set(item.category.type.id, item.category.type.name);
    }
    return [...values.entries()].map(([id, name]) => ({ id, name }));
  }, [data]);
  const categories = useMemo(() => {
    const values = new Map<number, string>();
    for (const item of data) {
      if (type === "all" || item.category.typeId === Number(type)) {
        values.set(item.category.id, item.category.name);
      }
    }
    return [...values.entries()].map(([id, name]) => ({ id, name }));
  }, [data, type]);
  const subcategories = useMemo(() => {
    const values = new Map<number, string>();
    for (const item of data) {
      if (
        item.subCategory &&
        (category === "all" || item.categoryId === Number(category))
      ) {
        values.set(item.subCategory.id, item.subCategory.name);
      }
    }
    return [...values.entries()].map(([id, name]) => ({ id, name }));
  }, [category, data]);
  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.composedSku?.toLowerCase().includes(query);
      const matchesType =
        type === "all" || item.category.typeId === Number(type);
      const matchesCategory =
        category === "all" || item.categoryId === Number(category);
      const matchesSubcategory =
        subcategory === "all" || item.subCategoryId === Number(subcategory);
      const matchesStatus =
        status === "all" ||
        (status === "active" ? item.isActive : !item.isActive);
      return (
        matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesSubcategory &&
        matchesStatus
      );
    });
  }, [category, data, search, status, subcategory, type]);

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
              void setSubcategory("all");
            },
            options: toFilterOptions("types", types),
          },
          {
            key: "category",
            label: "Category",
            value: category,
            onChange: (value) => {
              void setCategory(value);
              void setSubcategory("all");
            },
            options: toFilterOptions("categories", categories),
          },
          {
            key: "subcategory",
            label: "Sub Category",
            value: subcategory,
            onChange: (value) => void setSubcategory(value),
            options: toFilterOptions("Sub Categories", subcategories),
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
          search ||
            type !== "all" ||
            category !== "all" ||
            subcategory !== "all" ||
            status !== "all",
        )}
        onClear={() => {
          void setSearch("");
          void setType("all");
          void setCategory("all");
          void setSubcategory("all");
          void setStatus("all");
        }}
        onSearchChange={(value) => void setSearch(value)}
        searchPlaceholder="Search product name or SKU"
        searchValue={search}
      />
      <SetupActionRow>
        <Button asChild variant="outline">
          <Link href={`${ADMIN_BASE}/setup-requests`}>Review requests</Link>
        </Button>
        <NewCoreProductDialog />
      </SetupActionRow>
      <SetupEntityTable
        columns={columns}
        data={filteredData}
        emptyAction={data.length === 0 ? <NewCoreProductDialog /> : undefined}
        emptyDescription="Create a product within a Sub Category to define reusable brand and variant structure."
        emptyTitle="No products found"
        getRowId={(row) => String(row.id)}
        mobile={{
          columns: [
            { id: "composedSku", label: "SKU", width: "22%" },
            { id: "name", label: "Product", width: "32%" },
            { id: "category", label: "Category", width: "23%" },
            { id: "isActive", label: "Status", width: "23%" },
          ],
          href: (row) => `/dashboard/admin/core-products/${row.id}`,
          title: (row) => row.name,
          description: (row) => row.composedSku ?? row.sku,
          meta: (row) => [
            [row.category.type?.name, row.category.name, row.subCategory?.name]
              .filter(Boolean)
              .join(" / "),
            `${row.configuredBrandCount ?? 0} brands`,
          ],
          status: (row) => <ActiveStatusBadge isActive={row.isActive} />,
        }}
      />
    </div>
  );
}

function toFilterOptions(
  allLabel: string,
  options: { id: number; name: string }[],
) {
  return [
    { value: "all", label: `All ${allLabel}` },
    ...options.map((option) => ({
      value: String(option.id),
      label: option.name,
    })),
  ];
}
