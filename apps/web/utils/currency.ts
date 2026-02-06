export function formatPrice(price: string | number): string {
  const numericPrice =
    typeof price === "string" ? Number.parseFloat(price) : price;

  return `৳${numericPrice.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
