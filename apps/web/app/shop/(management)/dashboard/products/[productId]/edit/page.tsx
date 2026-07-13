"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import ProductEditForm from "@/components/features/product/components/product-edit-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/utils/orpc";

const PRODUCTS_URL = "/dashboard/products";

export default function RetailerProductEditPage() {
  const queryClient = useQueryClient();
  const productId = Number(useParams<{ productId: string }>().productId);
  const { data, isLoading, error } = useQuery({
    queryKey: ["shopOwner", "product-edit", productId],
    queryFn: () =>
      (orpc.shopOwner as any).getShopOwnedProductForEdit.call({ productId }),
    enabled: Number.isInteger(productId) && productId > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[620px] w-full" />
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          This product does not belong to your retailer account or cannot be
          edited.
        </CardContent>
      </Card>
    );
  }

  const retailerProduct = data.product as any;
  const coreProduct = {
    ...retailerProduct.coreProduct,
    categoryId: retailerProduct.categoryId,
    subCategoryId: retailerProduct.subCategoryId,
    category: retailerProduct.category,
  };

  return (
    <ProductEditForm
      product={retailerProduct}
      editAdapter={{
        backHref: PRODUCTS_URL,
        coreProduct,
        variantOptions: data.options.variantOptions,
        productType: retailerProduct.category?.type,
        publishOnSave: true,
        onUpdate: async (payload: any) => {
          const variants = (payload.variantPrices ?? []).map((row: any) => ({
            variantOptionId: row.variantOptionId,
          }));
          return (orpc.shopOwner as any).updateShopOwnedProduct.call({
            productId,
            details: {
              name: payload.name,
              description: payload.description || null,
              shortDescription: payload.shortDescription || null,
              videoUrl: payload.videoUrl || null,
              image: payload.image,
              additionalImages: payload.additionalImages ?? [],
              features: payload.features ?? [],
              trackingType: payload.trackingType,
              returnPolicyEnabled: payload.returnPolicyEnabled,
              expiryEnabled: payload.expiryEnabled,
              damageControlEnabled: payload.damageControlEnabled,
              stockTrackingEnabled: payload.stockTrackingEnabled,
              minimumOrderEnabled: payload.minimumOrderEnabled,
              minimumOrderQty: String(payload.minimumOrderQty),
              inventoryUnit: payload.inventoryUnit,
              conversionEnabled: payload.conversionEnabled,
              inventoryLooseUnitEnabled: payload.inventoryLooseUnitEnabled,
              inventoryLooseUnit: payload.inventoryLooseUnit,
              isReturnablePack: payload.isReturnablePack,
              defaultPackDepositAmount: String(
                payload.defaultPackDepositAmount || "0",
              ),
              allowedPackBrands: payload.allowedPackBrands ?? [],
              allowedPackSizes: payload.allowedPackSizes ?? [],
              visibility: payload.visibility,
              status: payload.status,
            },
            variants,
          });
        },
        onUpdated: async () => {
          await queryClient.invalidateQueries({ queryKey: ["shopOwner"] });
        },
      }}
    />
  );
}
