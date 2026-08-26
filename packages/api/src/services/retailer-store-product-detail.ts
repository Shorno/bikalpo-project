import { isWarehouseCylinderExchangeAvailable } from "@bikalpo-project/db/fulfillment";
import type {
  ProductFeatureGroup,
  QuantitySelectorOption,
} from "@bikalpo-project/db/schema";

interface StoreIdentity {
  id: string;
  name: string;
  shopName: string | null;
  shopSlug: string | null;
  shopAddress: string | null;
  businessType: string | null;
  image: string | null;
  shopLat: string | null;
  shopLng: string | null;
  phoneNumber?: string | null;
}

interface StoreProduct {
  id: number;
  coreProductId: number | null;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  image: string | null;
  size: string | null;
  features: ProductFeatureGroup[] | null;
  creatorSource: string | null;
  createdById: string | null;
  isReturnablePack?: boolean | null;
  category: {
    name: string;
    slug: string;
    type?: {
      family?: string | null;
      name?: string | null;
      slug?: string | null;
    } | null;
  } | null;
  subCategory: { name: string; slug: string } | null;
  brand: { id: number; name: string; slug: string } | null;
  images: Array<{ imageUrl: string }>;
}

interface StoreProductVariant {
  id: number;
  sku: string | null;
  unitLabel: string | null;
  quantitySelectorLabel: string | null;
  price: string | number | null;
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
  variantType: string | null;
  packType: string | null;
  isActive: boolean;
  exchangeEnabled?: boolean | null;
  exchangeCreditAmount?: string | number | null;
  inventory: {
    availableQty: string | number;
    retailPrice: string | number;
  } | null;
}

interface BuildStoreProductDetailInput {
  shop: StoreIdentity;
  product: StoreProduct;
  variants: StoreProductVariant[];
}

function toFiniteNumber(value: string | number | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildStoreProductDetail({
  shop,
  product,
  variants,
}: BuildStoreProductDetailInput) {
  const availableVariants = variants
    .filter(
      (variant) =>
        variant.isActive &&
        variant.inventory !== null &&
        toFiniteNumber(variant.inventory.retailPrice) > 0,
    )
    .sort(
      (left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.id - right.id,
    )
    .map((variant) => {
      const availableQty = toFiniteNumber(variant.inventory?.availableQty);
      const retailPrice = toFiniteNumber(variant.inventory?.retailPrice);
      const exchangeEnabled = isWarehouseCylinderExchangeAvailable({
        isReturnablePack: product.isReturnablePack,
        family: product.category?.type?.family,
        name: product.category?.type?.name,
        slug: product.category?.type?.slug,
        exchangeEnabled: variant.exchangeEnabled,
      });
      const exchangeCreditAmount = exchangeEnabled
        ? Math.min(
            retailPrice,
            Math.max(0, toFiniteNumber(variant.exchangeCreditAmount)),
          )
        : 0;

      return {
        ...variant,
        price: retailPrice,
        basePrice: toFiniteNumber(variant.price),
        stockQuantity: availableQty,
        availableQty,
        retailPrice,
        inventory: {
          availableQty,
          retailPrice,
        },
        cylinderSale: {
          exchangeEnabled,
          exchangeCreditAmount,
          defaultMode: exchangeEnabled
            ? ("exchange" as const)
            : ("new" as const),
          newUnitPrice: retailPrice,
          effectiveExchangeUnitPrice: Math.max(
            0,
            retailPrice - exchangeCreditAmount,
          ),
        },
      };
    });

  if (availableVariants.length === 0) {
    return null;
  }

  const totalAvailableQty = availableVariants.reduce(
    (total, variant) => total + variant.availableQty,
    0,
  );

  return {
    shop,
    product: {
      ...product,
      images: product.images.map((image) => image.imageUrl),
      variants: availableVariants,
      lowestRetailPrice: Math.min(
        ...availableVariants.map((variant) => variant.retailPrice),
      ),
      totalAvailableQty,
      stockQuantity: totalAvailableQty,
      inStock: totalAvailableQty > 0,
      variantCount: availableVariants.length,
    },
  };
}
