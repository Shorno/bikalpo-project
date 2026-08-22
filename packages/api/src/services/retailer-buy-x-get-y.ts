export type BuyXGetYProduct = {
  variantId?: number;
  quantity: number;
};

export type BuyXGetYBasketLine = {
  variantId: number;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type BuyXGetYBenefitType =
  | "free_product"
  | "percentage_discount"
  | "fixed_price";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function aggregateRequirements(products: BuyXGetYProduct[]) {
  const requirements = new Map<number, number>();
  for (const product of products) {
    if (!product.variantId || product.quantity <= 0) return null;
    requirements.set(
      product.variantId,
      (requirements.get(product.variantId) ?? 0) + product.quantity,
    );
  }
  return requirements;
}

/**
 * Calculates a fixed-variant Buy X Get Y reward already present in the basket.
 * Requiring the reward line keeps inventory and order items accurate until the
 * storefront and POS explicitly support automatically adding reward products.
 */
export function calculateBuyXGetYDiscount(input: {
  lines: BuyXGetYBasketLine[];
  buyProducts: BuyXGetYProduct[];
  getProducts: BuyXGetYProduct[];
  benefitType: BuyXGetYBenefitType;
  benefitValue?: number | null;
  maxApplications?: number | null;
}) {
  const buyRequirements = aggregateRequirements(input.buyProducts);
  const getRequirements = aggregateRequirements(input.getProducts);
  if (
    !buyRequirements ||
    !getRequirements ||
    buyRequirements.size === 0 ||
    getRequirements.size === 0
  ) {
    return null;
  }

  const basketByVariant = new Map<
    number,
    { quantity: number; unitPrice: number; lineTotal: number }
  >();
  for (const line of input.lines) {
    const current = basketByVariant.get(line.variantId);
    basketByVariant.set(line.variantId, {
      quantity: (current?.quantity ?? 0) + line.quantity,
      unitPrice: Math.min(current?.unitPrice ?? line.unitPrice, line.unitPrice),
      lineTotal: (current?.lineTotal ?? 0) + line.lineTotal,
    });
  }

  const requiredPerApplication = new Map(buyRequirements);
  for (const [variantId, quantity] of getRequirements) {
    requiredPerApplication.set(
      variantId,
      (requiredPerApplication.get(variantId) ?? 0) + quantity,
    );
  }

  let applications = Number.POSITIVE_INFINITY;
  for (const [variantId, requiredQuantity] of requiredPerApplication) {
    const basketQuantity = basketByVariant.get(variantId)?.quantity ?? 0;
    applications = Math.min(
      applications,
      Math.floor(basketQuantity / requiredQuantity),
    );
  }
  if (input.maxApplications != null) {
    applications = Math.min(applications, input.maxApplications);
  }
  if (!Number.isFinite(applications) || applications < 1) return null;

  let rewardSubtotal = 0;
  let rewardQuantity = 0;
  for (const [variantId, quantity] of getRequirements) {
    const unitPrice = basketByVariant.get(variantId)?.unitPrice;
    if (unitPrice == null) return null;
    const eligibleQuantity = quantity * applications;
    rewardQuantity += eligibleQuantity;
    rewardSubtotal += unitPrice * eligibleQuantity;
  }

  let discountAmount = rewardSubtotal;
  if (input.benefitType === "percentage_discount") {
    discountAmount =
      rewardSubtotal *
      Math.min(Math.max(input.benefitValue ?? 0, 0), 100) *
      0.01;
  } else if (input.benefitType === "fixed_price") {
    discountAmount = Math.max(
      rewardSubtotal - Math.max(input.benefitValue ?? 0, 0) * rewardQuantity,
      0,
    );
  }

  const salesAmount = [...requiredPerApplication.keys()].reduce(
    (sum, variantId) => sum + (basketByVariant.get(variantId)?.lineTotal ?? 0),
    0,
  );
  discountAmount = roundMoney(Math.min(discountAmount, salesAmount));
  if (discountAmount <= 0) return null;

  return {
    applications,
    rewardQuantity,
    discountAmount,
    salesAmount: roundMoney(salesAmount),
  };
}
