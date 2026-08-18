import type { FulfillmentMode } from "@bikalpo-project/db/fulfillment";
import type {
  ProductFeatureGroup,
  QuantitySelectorOption,
} from "@bikalpo-project/db/schema";
import type { WarehouseStorefrontSaleMode } from "@/lib/warehouse-storefront-cart";

export interface WarehouseStorefrontDetailVariant {
  id: number;
  inventoryId: number;
  sku: string | null;
  globalSku: string | null;
  unitLabel: string;
  quantitySelectorLabel: string | null;
  price: number;
  weightKg: string | number | null;
  packagingType: string | null;
  origin: string | null;
  shelfLife: string | null;
  orderMin: string | number | null;
  orderMax: string | number | null;
  orderIncrement: string | number | null;
  orderUnit: string | null;
  quantitySelectorOptions: QuantitySelectorOption[] | null;
  sortOrder: number | null;
  stockQuantity: number;
  availableQty: number;
  retailPrice: number;
  variantType: string | null;
  packType: string | null;
  color: string | null;
  size: string | null;
  isActive: boolean;
  fulfillmentMode?: FulfillmentMode;
  targetVariantId?: number | null;
  canExchange: boolean;
  cylinderSale: {
    exchangeEnabled: boolean;
    exchangeCreditAmount: number;
    defaultMode: WarehouseStorefrontSaleMode;
  } | null;
}

export interface WarehouseStorefrontProductDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  size: string;
  image: string;
  images: string[];
  features: ProductFeatureGroup[] | null;
  inStock: boolean;
  stockQuantity: number;
  lowestPrice: number;
  category: { name: string; slug: string };
  subCategory: { name: string; slug: string } | null;
  brand: { id: number; name: string; slug: string } | null;
  variants: WarehouseStorefrontDetailVariant[];
}

export interface WarehouseStorefrontIdentity {
  id: string;
  name: string;
  warehouseName: string | null;
  warehouseSlug: string | null;
  warehouseAddress: string | null;
  image: string | null;
}
