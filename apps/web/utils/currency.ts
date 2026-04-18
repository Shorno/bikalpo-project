/**
 * Format a number as a price with Bangladeshi Taka symbol.
 * e.g. formatPrice(1500) → "৳1,500"
 */
export function formatPrice(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "৳0";
  return `৳${num.toLocaleString("en-BD")}`;
}
