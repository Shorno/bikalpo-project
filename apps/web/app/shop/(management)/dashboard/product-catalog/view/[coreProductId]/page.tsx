"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import {
  SellerCatalogProductView,
  type SellerCatalogView,
} from "@/components/features/product/seller-catalog-product-view";
import { orpc } from "@/utils/orpc";

const CATALOG_URL = "/dashboard/product-catalog";

export default function RetailerCatalogProductPage() {
  const coreProductId = Number(
    useParams<{ coreProductId: string }>().coreProductId,
  );
  return (
    <Suspense fallback={null}>
      <SellerCatalogProductView
        coreProductId={coreProductId}
        queryKey={["shopOwner", "getCatalogProductView"]}
        fetchView={(input) =>
          orpc.shopOwner.getCatalogProductView.call(
            input,
          ) as Promise<SellerCatalogView>
        }
        catalogUrl={CATALOG_URL}
        fetchPrintLabels={(input) => orpc.shopOwner.getPrintLabels.call(input)}
        addBrandProduct={(productId) =>
          orpc.shopOwner.addCatalogBrandProduct.call({ productId }) as Promise<{
            productId: number;
          }>
        }
        addHref={`${CATALOG_URL}/add/${coreProductId}`}
        editHref={(productId) => `/dashboard/products/${productId}/edit`}
      />
    </Suspense>
  );
}
