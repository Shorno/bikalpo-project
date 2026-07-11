"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import CoreProductConfigForm from "@/components/features/product/components/core-product-config-form";
import { orpc } from "@/utils/orpc";

const CATALOG_URL = "/warehouse/dashboard/catalog";
const PRODUCTS_URL = "/warehouse/dashboard/products";

export default function WarehouseCoreProductConfigPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const coreProductId = Number(
    useParams<{ coreProductId: string }>().coreProductId,
  );

  const configurationQuery = useQuery({
    queryKey: [
      "warehouse",
      "getWarehouseCoreConfiguration",
      { coreProductId },
    ],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseCoreConfiguration.call({
        coreProductId,
      }),
    enabled: Number.isInteger(coreProductId) && coreProductId > 0,
  });

  const configureMutation = useMutation({
    mutationFn: (brands: any[]) =>
      (orpc.warehouse as any).configureWarehouseCoreProducts.call({
        coreProductId,
        expectedVersion: configurationQuery.data?.version ?? null,
        details: configurationQuery.data?.defaults,
        brands: brands.map((brand) => ({
          brandId: brand.brandId,
          variants: brand.variants.map((variant: any) => ({
            variantOptionId: variant.variantOptionId,
          })),
        })),
      }),
  });

  const data = configurationQuery.data;
  const currentBrands = data?.current ?? [];
  const presetBrands = data?.adminPreset?.brands ?? [];
  const configuration = data
    ? {
        core: data.core,
        brands: currentBrands
          .filter((brand: any) => brand.brandId)
          .map((brand: any) => ({
            brandId: brand.brandId,
            brandName:
              brand.brandName ||
              data.options.brands.find(
                (option: any) => option.id === brand.brandId,
              )?.name ||
              "Unknown brand",
            brandLogo:
              data.options.brands.find(
                (option: any) => option.id === brand.brandId,
              )?.logo ?? null,
            productId: brand.productId ?? brand.sourceProductId ?? 0,
            productName: brand.productName ??
              `${brand.brandName || data.core.name} ${data.core.name}`,
            productSlug: "",
            productImage: data.core.image,
            status: brand.status ?? "active",
            variantOptions: brand.variants.map((variant: any, index: number) => ({
              variantOptionId: variant.variantOptionId,
              variantOptionName:
                data.options.variantOptions.find(
                  (option: any) => option.id === variant.variantOptionId,
                )?.name ?? null,
              consumerPrice: "0",
              isActive: variant.isActive !== false,
              sortOrder: index,
            })),
          })),
      }
    : undefined;

  const normalizedPreset = presetBrands.map((brand: any) => ({
    brandId: brand.brandId,
    variants: brand.variants.map((variant: any) => ({
      variantOptionId: variant.variantOptionId,
      consumerPrice: "0",
    })),
  }));
  const normalizedCurrent = currentBrands
    .filter((brand: any) => brand.status !== "inactive")
    .map((brand: any) => ({
      brandId: brand.brandId,
      variants: brand.variants
        .filter((variant: any) => variant.isActive !== false)
        .map((variant: any) => ({
          variantOptionId: variant.variantOptionId,
          consumerPrice: "0",
        })),
    }));

  return (
    <CoreProductConfigForm
      coreProductId={coreProductId}
      adapter={{
        configuration,
        brands: data?.options?.brands ?? [],
        variantOptions: data?.options?.variantOptions ?? [],
        isLoading: configurationQuery.isLoading,
        isError: configurationQuery.isError,
        listHref: CATALOG_URL,
        productEditHref: (productId) =>
          `${PRODUCTS_URL}/${productId}/edit`,
        presetBrands:
          data?.adminPreset?.available && normalizedPreset.length > 0
            ? normalizedPreset
            : undefined,
        reloadPresetLabel: "Reload Admin Preset",
        onConfigure: async (brands) => configureMutation.mutateAsync(brands),
        initialBrands:
          normalizedCurrent.length > 0 ? normalizedCurrent : normalizedPreset,
        onSaved: async () => {
          await queryClient.invalidateQueries({ queryKey: ["warehouse"] });
          router.push(PRODUCTS_URL);
        },
      }}
    />
  );
}
