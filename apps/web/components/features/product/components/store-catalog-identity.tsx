"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";
import { ProductEditorSection } from "./product-editor-ui";
import {
  type StoreIdentityOptions,
  type StoreIdentitySelection,
  StoreIdentityPicker,
} from "./store-identity-picker";

type StoreKind = "shop" | "warehouse";

/** The seller's identity endpoints, by portal. */
function storeIdentityApi(kind: StoreKind) {
  const api = (kind === "shop" ? orpc.shopOwner : orpc.warehouse) as any;
  return kind === "shop"
    ? {
        queryKey: ["shopOwner", "getShopIdentityOptions"],
        options: () =>
          api.getShopIdentityOptions.call() as Promise<StoreIdentityOptions>,
        createSubCategory: (input: { categoryId: number; name: string }) =>
          api.createShopSubCategory.call(input),
        createCoreProduct: (input: {
          categoryId: number;
          subCategoryId: number | null;
          name: string;
        }) => api.createShopCoreProduct.call(input),
      }
    : {
        queryKey: ["warehouse", "getWarehouseIdentityOptions"],
        options: () =>
          api.getWarehouseIdentityOptions.call() as Promise<StoreIdentityOptions>,
        createSubCategory: (input: { categoryId: number; name: string }) =>
          api.createWarehouseSubCategory.call(input),
        createCoreProduct: (input: {
          categoryId: number;
          subCategoryId: number | null;
          name: string;
        }) => api.createWarehouseCoreProduct.call(input),
      };
}

/**
 * Editable Type / Category / Sub category / Core identity for a seller's
 * catalog Add page. Choosing or adding a core identity opens its Add page.
 */
export function StoreCatalogIdentity({
  kind,
  addHref,
  initial,
}: {
  kind: StoreKind;
  addHref: (coreProductId: number) => string;
  initial?: StoreIdentitySelection;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = storeIdentityApi(kind);
  const optionsQuery = useQuery({
    queryKey: api.queryKey,
    queryFn: api.options,
  });

  if (optionsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading catalog...
      </div>
    );
  }

  return (
    <StoreIdentityPicker
      key={initial?.coreProductId ?? "new"}
      options={optionsQuery.data}
      initial={initial}
      onCoreProductChosen={(coreProductId) => {
        if (coreProductId !== initial?.coreProductId) {
          router.push(addHref(coreProductId));
        }
      }}
      createSubCategory={async (input) => {
        const result = await api.createSubCategory(input);
        await queryClient.invalidateQueries({ queryKey: api.queryKey });
        return result.subCategory;
      }}
      createCoreProduct={async (input) => {
        const result = await api.createCoreProduct(input);
        await queryClient.invalidateQueries({ queryKey: api.queryKey });
        return result.coreProduct;
      }}
    />
  );
}

/** The picker as it starts from a core product's configuration. */
export function storeIdentityFromCore(core: any): StoreIdentitySelection {
  return {
    typeId: core?.category?.typeId ?? core?.category?.type?.id ?? null,
    categoryId: core?.categoryId ?? core?.category?.id ?? null,
    subCategoryId: core?.subCategoryId ?? core?.subCategory?.id ?? null,
    coreProductId: core?.id ?? null,
  };
}

/**
 * Seller Create Product before a core identity is chosen: the same top bar
 * and Product Information card as the Add page, with nothing picked yet.
 */
export function StoreCreateProductStart({
  kind,
  listHref,
  addHref,
}: {
  kind: StoreKind;
  listHref: string;
  addHref: (coreProductId: number) => string;
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-2.5">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href={listHref} aria-label="Back to catalog">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              Products <span className="opacity-50">/</span> New product
            </p>
            <h1 className="truncate text-base font-semibold leading-tight">
              New product
            </h1>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[1500px] px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.62fr)_minmax(420px,1fr)] lg:items-start">
          <div className="rounded-xl border bg-card">
            <ProductEditorSection
              title="Product Information"
              description="Choose the core product this listing is based on."
            >
              <StoreCatalogIdentity kind={kind} addHref={addHref} />
            </ProductEditorSection>
            <p className="border-t px-5 py-4 text-[13px] text-muted-foreground sm:px-6">
              Pick or add the core identity to set the brand, sizes and prices.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
