"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [variantAliases, setVariantAliases] = useState<Record<number, string>>(
    {},
  );

  const configurationQuery = useQuery({
    queryKey: ["warehouse", "getWarehouseCoreConfiguration", { coreProductId }],
    queryFn: () =>
      (orpc.warehouse as any).getWarehouseCoreConfiguration.call({
        coreProductId,
      }),
    enabled: Number.isInteger(coreProductId) && coreProductId > 0,
  });

  const configureMutation = useMutation({
    mutationFn: (values: any) => {
      const selectedVariantIds = new Set(
        values.brands.flatMap((brand: any) =>
          brand.variants.map((variant: any) => variant.variantOptionId),
        ),
      );
      return (orpc.warehouse as any).configureWarehouseCoreProducts.call({
        coreProductId,
        expectedVersion: configurationQuery.data?.version ?? null,
        details: values.template,
        brands: values.brands.map((brand: any) => ({
          brandId: brand.brandId,
          variants: brand.variants.map((variant: any) => ({
            variantOptionId: variant.variantOptionId,
          })),
        })),
        variantAliases: Object.entries(variantAliases)
          .filter(
            ([variantOptionId, alias]) =>
              selectedVariantIds.has(Number(variantOptionId)) && alias.trim(),
          )
          .map(([variantOptionId, alias]) => ({
            variantOptionId: Number(variantOptionId),
            alias: alias.trim(),
          })),
      });
    },
  });

  const data = configurationQuery.data;
  useEffect(() => {
    if (!data?.variantAliases) return;
    setVariantAliases(
      Object.fromEntries(
        data.variantAliases.map((entry: any) => [
          entry.variantOptionId,
          entry.alias,
        ]),
      ),
    );
  }, [data?.variantAliases]);
  const currentBrands = data?.current ?? [];
  const presetBrands = data?.adminPreset?.brands ?? [];
  const configuration = data
    ? {
        core: data.core,
        template: {
          version: data.version,
          details: data.defaults,
        },
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
            productName:
              brand.productName ??
              `${brand.brandName || data.core.name} ${data.core.name}`,
            productSlug: "",
            productImage: data.core.image,
            status: brand.status ?? "active",
            variantOptions: brand.variants.map(
              (variant: any, index: number) => ({
                variantOptionId: variant.variantOptionId,
                variantOptionName:
                  variant.variantOptionName ??
                  data.options.variantOptions.find(
                    (option: any) => option.id === variant.variantOptionId,
                  )?.name ??
                  null,
                consumerPrice: "0",
                isActive: variant.isActive !== false,
                sortOrder: index,
                requiresDefinitionReview: variant.needsReview === true,
              }),
            ),
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
        productEditHref: (productId) => `${PRODUCTS_URL}/${productId}/edit`,
        presetBrands:
          data?.adminPreset?.available && normalizedPreset.length > 0
            ? normalizedPreset
            : undefined,
        reloadPresetLabel: "Reload Admin Preset",
        variantAliases,
        onVariantAliasChange: (variantOptionId, alias) =>
          setVariantAliases((current) => ({
            ...current,
            [variantOptionId]: alias,
          })),
        onConfigure: async (values) => configureMutation.mutateAsync(values),
        initialBrands:
          normalizedCurrent.length > 0 ? normalizedCurrent : normalizedPreset,
        onSaved: async () => {
          await queryClient.invalidateQueries({ queryKey: ["warehouse"] });
          await configurationQuery.refetch();
          if (data?.core?.brandCreationMode !== "single") {
            router.push(PRODUCTS_URL);
          }
        },
      }}
    />
  );
}
