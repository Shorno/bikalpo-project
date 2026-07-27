interface DirectCartInventoryInput {
  availableQuantity: number;
  requestedQuantity: number;
  retailPrice: number;
}

export function getDirectCartInventoryIssue({
  availableQuantity,
  requestedQuantity,
  retailPrice,
}: DirectCartInventoryInput): string | null {
  if (
    !Number.isFinite(availableQuantity) ||
    availableQuantity < requestedQuantity
  ) {
    return "This retailer does not have enough stock for the selected variant.";
  }

  if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
    return "This retailer has not configured a valid price for the selected variant.";
  }

  return null;
}

export function resolveDirectCartInventorySnapshot(
  input: DirectCartInventoryInput,
) {
  const issue = getDirectCartInventoryIssue(input);

  return {
    currentPrice:
      Number.isFinite(input.retailPrice) && input.retailPrice > 0
        ? input.retailPrice
        : 0,
    inStock: issue === null,
    issue,
  };
}
