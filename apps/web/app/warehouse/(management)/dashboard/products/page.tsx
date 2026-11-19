"use client";

import {
  OwnerProductList,
  type OwnerProductListResponse,
} from "@/components/features/product/owner-product-list";
import { orpc } from "@/utils/orpc";

const WH = "/warehouse/dashboard";

export default function WarehouseProductsPage() {
  return (
    <OwnerProductList
      queryKey={["warehouse", "getProductList"]}
      fetchList={(input) =>
        (orpc.warehouse as any).getProductList.call(
          input,
        ) as Promise<OwnerProductListResponse>
      }
      detailHref={(productId) => `${WH}/stock/product-${productId}`}
      addProductHref={`${WH}/catalog`}
    />
  );
}
