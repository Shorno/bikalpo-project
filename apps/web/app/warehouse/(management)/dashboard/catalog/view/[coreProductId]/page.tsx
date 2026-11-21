"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import {
  SellerCatalogProductView,
  type SellerCatalogView,
} from "@/components/features/product/seller-catalog-product-view";
import { orpc } from "@/utils/orpc";

const CATALOG_URL = "/warehouse/dashboard/catalog";

export default function WarehouseCatalogProductPage() {
  const coreProductId = Number(
    useParams<{ coreProductId: string }>().coreProductId,
  );
  return (
    <Suspense fallback={null}>
      <SellerCatalogProductView
        coreProductId={coreProductId}
        queryKey={["warehouse", "getCatalogProductView"]}
        fetchView={(input) =>
          (orpc.warehouse as any).getCatalogProductView.call(
            input,
          ) as Promise<SellerCatalogView>
        }
        catalogUrl={CATALOG_URL}
        addBrandProduct={(productId) =>
          (orpc.warehouse as any).addCatalogBrandProduct.call({
            productId,
          }) as Promise<{ productId: number }>
        }
        addHref={`${CATALOG_URL}/add/${coreProductId}`}
        editHref={(productId) =>
          `/warehouse/dashboard/products/${productId}/edit`
        }
      />
    </Suspense>
  );
}
