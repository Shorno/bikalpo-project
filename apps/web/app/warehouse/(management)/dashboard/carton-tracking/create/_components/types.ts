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
  image: string | null;
  isLoose: boolean;
};
