// Form-specific type for estimate items
// Uses number for decimal fields (form calculations need numbers, Drizzle uses strings)

export interface FormEstimateItem {
  productId: number;
  productName: string;
  productImage?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
}
