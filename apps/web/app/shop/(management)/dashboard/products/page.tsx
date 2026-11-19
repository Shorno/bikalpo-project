"use client";

import {
  OwnerProductList,
  type OwnerProductListResponse,
} from "@/components/features/product/owner-product-list";
import { orpc } from "@/utils/orpc";

export default function ShopProductsPage() {
  return (
    <OwnerProductList
      queryKey={["shopOwner", "getProductList"]}
      fetchList={(input) =>
        orpc.shopOwner.getProductList.call(
          input,
        ) as Promise<OwnerProductListResponse>
      }
      detailHref={(productId) => `/dashboard/products/${productId}`}
      addProductHref="/dashboard/product-catalog"
    />
  );
}
