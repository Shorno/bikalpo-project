import { notFound } from "next/navigation";
import { ProductDetailsView } from "@/components/features/products/product-details-view";
import type { DetailVariant } from "@/components/features/products/trade-product-detail-client";
import { getWarehouseProductDetail } from "@/lib/public-data";
import type { WarehouseStorefrontProductDetail } from "@/types/warehouse-storefront";
import { WarehouseProductDetailActions } from "./warehouse-product-detail-actions";

interface WarehouseProductDetailPageProps {
  warehouseSlug: string;
  productSlug: string;
  storefrontPath: string;
  cartPath: string;
}

export async function WarehouseProductDetailPage({
  warehouseSlug,
  productSlug,
  storefrontPath,
  cartPath,
}: WarehouseProductDetailPageProps) {
  const detail = await getWarehouseProductDetail(warehouseSlug, productSlug);

  if (!detail?.product || !detail.product.category || !detail.warehouse) {
    notFound();
  }

  const product = detail.product as WarehouseStorefrontProductDetail;
  const warehouseName =
    detail.warehouse.warehouseName || detail.warehouse.name || "Warehouse";
  const categoryHref = `${storefrontPath}?category=${encodeURIComponent(product.category.slug)}`;
  const variants: DetailVariant[] = product.variants.map((variant) => ({
    id: variant.id,
    sku: variant.sku,
    unitLabel: variant.unitLabel || variant.quantitySelectorLabel || "Unit",
    price: String(variant.retailPrice),
    weightKg: variant.weightKg == null ? null : String(variant.weightKg),
    packagingType: variant.packagingType,
    origin: variant.origin,
    shelfLife: variant.shelfLife,
    orderMin: variant.orderMin == null ? null : String(variant.orderMin),
    orderMax: variant.orderMax == null ? null : String(variant.orderMax),
    orderIncrement:
      variant.orderIncrement == null ? null : String(variant.orderIncrement),
    orderUnit: variant.orderUnit,
    quantitySelectorOptions: variant.quantitySelectorOptions,
    sortOrder: variant.sortOrder,
    stockQuantity: variant.availableQty,
    variantType: variant.variantType,
    packType: variant.packType,
    isActive: variant.isActive,
    cylinderSale: variant.cylinderSale,
  }));

  return (
    <ProductDetailsView
      product={{
        id: product.id,
        name: product.name,
        price: String(product.lowestPrice),
        image: product.image,
        images: product.images,
        size: product.size || variants[0]?.unitLabel || "Unit",
        description: product.description,
        features: product.features,
        inStock: product.inStock,
        stockQuantity: product.stockQuantity,
        category: product.category,
        subCategory: product.subCategory,
        brand: product.brand,
      }}
      variants={variants}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: warehouseName, href: storefrontPath },
        { label: product.category.name, href: categoryHref },
        { label: product.name },
      ]}
      categoryHref={categoryHref}
      purchaseMode="direct"
      actionSlot={
        <WarehouseProductDetailActions
          product={product}
          warehouseSlug={warehouseSlug}
          storefrontPath={storefrontPath}
          cartPath={cartPath}
        />
      }
    />
  );
}
