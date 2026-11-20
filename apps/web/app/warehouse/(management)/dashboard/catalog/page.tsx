"use client";

import { resolveBrandCreationAction } from "@bikalpo-project/db/brand-creation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CatalogActionBar,
  CatalogFilterPanel,
  type CatalogListRow,
  CatalogListTable,
  CatalogPageHeader,
} from "@/components/features/product/components/catalog-layout";
import { FilterSelect } from "@/components/features/product/components/product-catalog-table";
import { SetupTableFooter } from "@/components/features/product-setup/setup-table-footer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { orpc } from "@/utils/orpc";

// ─── Types ─────────────────────────────────────────────────────

type CatalogVariant = {
  id: number;
  sku: string;
  unitLabel: string;
  weightKg: string;
  price: string;
  brandId: number | null;
  brand: { id: number; name: string } | null;
  inInventory: boolean;
};

type CatalogProduct = {
  id: number;
  name: string;
  variants: CatalogVariant[];
};

type CoreProduct = {
  id: number;
  name: string;
  slug: string;
  catalogCode: string;
  image: string;
  products: CatalogProduct[];
  adminBrandCount: number;
  warehouseBrandCount: number;
  warehouseAddableBrandCount: number;
  brandCreationMode: "single" | "batch";
};

type SubCategoryData = {
  id: number;
  name: string;
  slug: string;
  coreProducts: CoreProduct[];
};

type CatalogCategory = {
  id: number;
  name: string;
  slug: string;
  subCategories: SubCategoryData[];
  directCoreProducts: CoreProduct[];
};

type CatalogType = {
  id: number;
  name: string;
  slug: string;
  categories: CatalogCategory[];
};

/** One table row per core product, flattened from the type hierarchy. */
type FlatRow = {
  id: string;
  typeName: string;
  categoryName: string;
  subCategoryName: string | null;
  coreProduct: CoreProduct;
};

const ALL = "all";
const PAGE_SIZE = 20;

const toId = (value: string) => (value === ALL ? undefined : Number(value));
const toValue = (id: number | undefined) => (id == null ? ALL : String(id));

// ─── Main Page Component ───────────────────────────────────────

export default function WarehouseCatalogPage() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Filters
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    number | undefined
  >();
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    number | undefined
  >();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  // Search debounce
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  // ─── Queries ─────────────────────────────────────────────────

  const {
    data: catalogData,
    isLoading: loadingCatalog,
    isError: catalogError,
    error: catalogErrorMsg,
  } = useQuery({
    queryKey: [
      "warehouse",
      "getFullCatalog",
      {
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        search: debouncedSearch,
      },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getFullCatalog.call({
        typeId: selectedTypeId,
        categoryId: selectedCategoryId,
        subCategoryId: selectedSubCategoryId,
        search: debouncedSearch || undefined,
      }),
    retry: 2,
  });

  // ─── Derived Data ────────────────────────────────────────────

  const types: CatalogType[] = catalogData?.types ?? [];

  const allTypes = types.map((type) => ({ id: type.id, name: type.name }));

  const allCategories = selectedTypeId
    ? (types.find((type) => type.id === selectedTypeId)?.categories ?? [])
    : types.flatMap((type) => type.categories);

  const allSubCategories = selectedCategoryId
    ? (allCategories.find((category) => category.id === selectedCategoryId)
        ?.subCategories ?? [])
    : allCategories.flatMap((category) => category.subCategories);

  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = [];
    for (const type of types) {
      for (const category of type.categories) {
        for (const subCategory of category.subCategories) {
          for (const coreProduct of subCategory.coreProducts) {
            rows.push({
              id: `${type.id}-${category.id}-${subCategory.id}-${coreProduct.id}`,
              typeName: type.name,
              categoryName: category.name,
              subCategoryName: subCategory.name,
              coreProduct,
            });
          }
        }
        for (const coreProduct of category.directCoreProducts ?? []) {
          rows.push({
            id: `${type.id}-${category.id}-direct-${coreProduct.id}`,
            typeName: type.name,
            categoryName: category.name,
            subCategoryName: null,
            coreProduct,
          });
        }
      }
    }
    return rows;
  }, [types]);


  // Back to the first page whenever the result set changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter changes only
  useEffect(() => {
    setPage(1);
  }, [
    selectedTypeId,
    selectedCategoryId,
    selectedSubCategoryId,
    debouncedSearch,
  ]);

  const pageCount = Math.max(1, Math.ceil(flatRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows: CatalogListRow[] = flatRows
    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
    .map((row) => {
      const coreProduct = row.coreProduct;
      const action = resolveBrandCreationAction({
        mode: coreProduct.brandCreationMode,
        configuredBrandCount: coreProduct.warehouseBrandCount,
        addableBrandCount: coreProduct.warehouseAddableBrandCount,
      });
      return {
        key: row.id,
        systemId: coreProduct.catalogCode,
        type: row.typeName,
        category: row.categoryName,
        subCategory: row.subCategoryName,
        name: coreProduct.name,
        href: `/warehouse/dashboard/catalog/view/${coreProduct.id}`,
        add: {
          label: action.label,
          disabled: action.disabled,
          href: `/warehouse/dashboard/catalog/add/${coreProduct.id}`,
        },
      };
    });

  const hasActiveFilters = Boolean(
    search ||
      selectedTypeId ||
      selectedCategoryId ||
      selectedSubCategoryId,
  );
  const clearFilters = () => {
    setSearch("");
    setSelectedTypeId(undefined);
    setSelectedCategoryId(undefined);
    setSelectedSubCategoryId(undefined);
  };

  // ─── Page Layout ─────────────────────────────────────────────

  return (
    <div className="space-y-5 max-md:min-w-0 max-md:space-y-4">
      <CatalogPageHeader
        description="Browse available products and add them to your inventory."
        stats={[
          { label: "Products", value: flatRows.length },
          { label: "Types", value: types.length },
          {
            label: "Categories",
            value: types.flatMap((type) => type.categories).length,
          },
        ]}
      />

      <div className="min-w-0 space-y-4 md:space-y-5">
        <CatalogFilterPanel
          search={search}
          onSearchChange={setSearch}
          hasFilters={hasActiveFilters}
          onClear={clearFilters}
        >
          {[
            <FilterSelect
              key="type"
              compact={isMobile}
              label="Type"
              value={toValue(selectedTypeId)}
              options={allTypes}
              onValueChange={(value) => {
                setSelectedTypeId(toId(value));
                setSelectedCategoryId(undefined);
                setSelectedSubCategoryId(undefined);
              }}
            />,
            <FilterSelect
              key="category"
              compact={isMobile}
              label="Category"
              value={toValue(selectedCategoryId)}
              options={allCategories}
              onValueChange={(value) => {
                setSelectedCategoryId(toId(value));
                setSelectedSubCategoryId(undefined);
              }}
            />,
            <FilterSelect
              key="subCategory"
              compact={isMobile}
              label="Sub Category"
              value={toValue(selectedSubCategoryId)}
              options={allSubCategories}
              onValueChange={(value) => setSelectedSubCategoryId(toId(value))}
            />,
          ]}
        </CatalogFilterPanel>

        <CatalogActionBar>
          <Button asChild variant="outline" size="sm" className="max-md:min-h-11">
            <Link href="/warehouse/dashboard/catalog/requests">
              <Clock3 className="size-4" />
              Requests
            </Link>
          </Button>
          <Button asChild size="sm" className="max-md:min-h-11">
            <Link href="/warehouse/dashboard/catalog/requests">
              <Plus className="size-4" />
              Request Product
            </Link>
          </Button>
        </CatalogActionBar>

        <div className="space-y-4">
          <CatalogListTable
            rows={rows}
            isLoading={loadingCatalog}
            isError={catalogError}
            errorMessage={(catalogErrorMsg as any)?.message}
            onRetry={() =>
              queryClient.invalidateQueries({
                queryKey: ["warehouse", "getFullCatalog"],
              })
            }
            emptyDescription={
              search
                ? "No products match your search. Try different keywords."
                : "No products in the catalog yet."
            }
          />

          {!loadingCatalog && !catalogError ? (
            <SetupTableFooter
              ariaLabel="Catalog pagination"
              page={currentPage}
              pageSize={pageSize}
              total={flatRows.length}
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
