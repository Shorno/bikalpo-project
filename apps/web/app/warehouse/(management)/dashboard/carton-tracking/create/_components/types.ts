export type CartonItem = {
  variantId: number;
  sku: string;
  productName: string;
  brandName: string | null;
  variantLabel: string;
  weightKg: number;
  packCount: number;
  availableStock: number;
  totalStock: number;
  stockInCartons: number;
  availableForCarton: number;
  image: string | null;
  isLoose: boolean;
  operationalUnit: string;
};
