"use client";

import { resolveBrandCreationAction } from "@bikalpo-project/db/brand-creation";
import { Clock3, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequestProductModal } from "@/components/catalog/request-product-modal";
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
import { useCatalogHierarchy, useFilterOptions } from "@/hooks/use-catalog-api";
import { useIsMobile } from "@/hooks/use-mobile";

const ALL = "all";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

const toId = (value: string) => (value === ALL ? undefined : Number(value));
const toValue = (id: number | undefined) => (id == null ? ALL : String(id));

export default function ProductCatalogPage() {
  const isMobile = useIsMobile();
  const [selectedTypeId, setSelectedTypeId] = useState<number | undefined>();
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    number | undefined
  >();
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<
    number | undefined
  >();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const debouncedSearch = useDebounce(search, 400);

  const { data: filterData, isLoading: filtersLoading } = useFilterOptions();
  const {
    data,
    isLoading: loadingCatalog,
    isError: catalogError,
    error: catalogErrorMsg,
    refetch,
  } = useCatalogHierarchy({
    typeId: selectedTypeId,
    categoryId: selectedCategoryId,
    subCategoryId: selectedSubCategoryId,
    search: debouncedSearch || undefined,
    page,
    limit: rowsPerPage,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const types = filterData?.types ?? [];
  const allCategories = filterData?.categories ?? [];
  const allSubCategories = filterData?.subCategories ?? [];
  const totalCount = pagination?.totalCount ?? 0;
  const currentPage = pagination?.page ?? page;

  const categories = selectedTypeId
    ? allCategories.filter((category) => category.typeId === selectedTypeId)
    : allCategories;

  const categoryIds = new Set(categories.map((category) => category.id));
  const subCategories = allSubCategories.filter((subCategory) =>
    selectedCategoryId
      ? subCategory.categoryId === selectedCategoryId
      : categoryIds.has(subCategory.categoryId),
  );

  const rows: CatalogListRow[] = items.map((item) => {
    const action = resolveBrandCreationAction({
      mode: "single",
      configuredBrandCount: item.shopBrandCount,
      addableBrandCount: item.shopAddableBrandCount,
    });
    return {
      key: String(item.id),
      systemId: item.catalogCode,
      type: item.type?.name ?? "—",
      category: item.category?.name ?? "—",
      subCategory: item.subCategory?.name ?? null,
      name: item.name,
      href: `/dashboard/product-catalog/${item.id}`,
      add: {
        label: action.label,
        disabled: action.disabled,
        href: `/dashboard/product-catalog/add/${item.id}`,
      },
    };
  });

  const resetPage = () => setPage(1);
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
    resetPage();
  };

  return (
    <div className="space-y-5 max-md:min-w-0 max-md:space-y-4">
      <CatalogPageHeader
        description="Browse available products and add them to your shop."
        stats={[
          { label: "Products", value: totalCount },
          { label: "Types", value: types.length },
          { label: "Categories", value: allCategories.length },
        ]}
      />

      <div className="min-w-0 space-y-4 md:space-y-5">
        <CatalogFilterPanel
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            resetPage();
          }}
          hasFilters={hasActiveFilters}
          onClear={clearFilters}
        >
          {[
            <FilterSelect
              key="type"
              compact={isMobile}
              label="Type"
              value={toValue(selectedTypeId)}
              options={types}
              onValueChange={(value) => {
                setSelectedTypeId(toId(value));
                setSelectedCategoryId(undefined);
                setSelectedSubCategoryId(undefined);
                resetPage();
              }}
            />,
            <FilterSelect
              key="category"
              compact={isMobile}
              label="Category"
              value={toValue(selectedCategoryId)}
              options={categories}
              onValueChange={(value) => {
                setSelectedCategoryId(toId(value));
                setSelectedSubCategoryId(undefined);
                resetPage();
              }}
            />,
            <FilterSelect
              key="subCategory"
              compact={isMobile}
              label="Sub Category"
              value={toValue(selectedSubCategoryId)}
              options={subCategories}
              onValueChange={(value) => {
                setSelectedSubCategoryId(toId(value));
                resetPage();
              }}
            />,
          ]}
        </CatalogFilterPanel>

        <CatalogActionBar>
          <Button asChild variant="outline" size="sm" className="max-md:min-h-11">
            <Link href="/dashboard/product-catalog/requests">
              <Clock3 className="size-4" />
              Requests
            </Link>
          </Button>
          <RequestProductModal
            trigger={
              <Button size="sm" className="max-md:min-h-11">
                <Plus className="size-4" />
                Request Product
              </Button>
            }
          />
        </CatalogActionBar>

        <div className="space-y-4">
          <CatalogListTable
            rows={rows}
            isLoading={loadingCatalog || filtersLoading}
            isError={catalogError}
            errorMessage={catalogErrorMsg?.message}
            onRetry={() => refetch()}
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
              pageSize={rowsPerPage}
              total={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(pageSize) => {
                setRowsPerPage(pageSize);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
