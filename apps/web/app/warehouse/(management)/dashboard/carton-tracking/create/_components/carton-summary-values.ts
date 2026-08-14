const IRREGULAR_PLURALS: Record<string, string> = {
  box: "boxes",
  pouch: "pouches",
};

function displayQuantity(quantity: number) {
  return quantity.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  });
}

export function operationalUnitLabel(
  quantity: number,
  operationalUnit: string,
) {
  const unit = operationalUnit.trim().toLowerCase() || "unit";
  if (quantity === 1) return unit;
  return IRREGULAR_PLURALS[unit] ?? `${unit}s`;
}

export function operationalQuantityLabel(
  quantity: number,
  operationalUnit: string,
) {
  return `${displayQuantity(quantity)} ${operationalUnitLabel(quantity, operationalUnit)}`;
}

export function getCartonSellingPriceBreakdown(
  cartonPriceInput: string,
  quantity: number,
) {
  if (cartonPriceInput.trim() === "" || quantity <= 0) return null;
  const cartonPrice = Number(cartonPriceInput);
  if (!Number.isFinite(cartonPrice) || cartonPrice < 0) return null;
  return {
    cartonPrice,
    unitPrice: cartonPrice / quantity,
  };
}
