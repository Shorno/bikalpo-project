import { redirect } from "next/navigation";

/** @deprecated Retained only for the legacy step-component type imports. */
export type CreateProductFormState = {
  typeId?: number;
  categoryId?: number;
  subCategoryId?: number;
  coreProductId?: number;
  brandIds: number[];
  variantSelections: Array<{ variantOptionId: number; brandId: number }>;
  pricing: Array<{
    variantOptionId: number;
    brandId: number;
    retailPrice: string;
  }>;
  isReturnablePack: boolean;
  expiryEnabled: boolean;
  damageControlEnabled: boolean;
  stockTrackingEnabled: boolean;
  trackingType: "none" | "batch" | "serial";
  openingStock: Array<{
    variantOptionId: number;
    brandId: number;
    quantity: number;
  }>;
  displayName: string;
  shortNote: string;
  status: "active" | "inactive" | "draft";
};

export default function LegacyRetailerCreateProductPage() {
  redirect("/dashboard/product-catalog");
}
