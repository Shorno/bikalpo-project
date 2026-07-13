export type CartonItem = {
  variantId: number;
  sku: string;
  productName: string;
  brandName: string | null;
  variantLabel: string;
  weightKg: number;
  price: number;
  packCount: number;
  availableStock: number;
  totalStock: number;
  stockInCartons: number;
  availableForCarton: number;
  image: string | null;
  isLoose: boolean;
  operationalUnit: string;
};

export type CartonConfig = {
  id: number;
  variantId: number;
  packsPerCarton: number;
  cartonWeightKg: string | number;
  cartonPrice: string | number;
  cartonCostPrice?: string | number | null;
  deliveryCostPerCarton?: string | number | null;
  label?: string | null;
  isDefault: boolean;
  isActive: boolean;
  usageCount: number;
};
