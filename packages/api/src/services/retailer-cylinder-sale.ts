export type RetailerCylinderSaleMode = "new" | "exchange";

function toCents(value: string | number, label: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} must be a non-negative amount`);
  }
  return Math.round(amount * 100);
}

function formatCents(value: number) {
  return (value / 100).toFixed(2);
}

export function resolveRetailerCylinderSale(input: {
  newUnitPrice: string | number;
  exchangeEnabled: boolean;
  exchangeCreditAmount: string | number;
  requestedMode: RetailerCylinderSaleMode;
  quantity: number;
}) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Cylinder quantity must be a positive whole number");
  }

  const newUnitPrice = toCents(input.newUnitPrice, "New price");
  const configuredCredit = toCents(
    input.exchangeCreditAmount,
    "Exchange Credit",
  );
  if (configuredCredit > newUnitPrice) {
    throw new Error("Exchange Credit cannot exceed the listed New price");
  }
  if (input.requestedMode === "exchange" && !input.exchangeEnabled) {
    throw new Error("Exchange is not enabled for this exact retailer variant");
  }

  const appliedCredit =
    input.requestedMode === "exchange" ? configuredCredit : 0;
  const effectiveUnitPrice = newUnitPrice - appliedCredit;

  return {
    mode: input.requestedMode,
    newUnitPrice: formatCents(newUnitPrice),
    exchangeCreditAmount: formatCents(configuredCredit),
    effectiveUnitPrice: formatCents(effectiveUnitPrice),
    expectedEmptyPackQty:
      input.requestedMode === "exchange" ? input.quantity : 0,
    lineTotal: formatCents(effectiveUnitPrice * input.quantity),
  };
}

export function settleRetailerCylinderReturns(
  input: Array<{
    orderItemId: number;
    expectedEmptyPackQty: number;
    acceptedEmptyPackQty: number;
    exchangeCreditAmount: string | number;
  }>,
) {
  const seen = new Set<number>();
  let totalBalance = 0;
  let totalCollectedEmptyPacks = 0;
  const lines = input.map((line) => {
    if (seen.has(line.orderItemId)) {
      throw new Error(`Order item ${line.orderItemId} is duplicated`);
    }
    seen.add(line.orderItemId);
    if (
      !Number.isInteger(line.expectedEmptyPackQty) ||
      line.expectedEmptyPackQty < 0 ||
      !Number.isInteger(line.acceptedEmptyPackQty) ||
      line.acceptedEmptyPackQty < 0 ||
      line.acceptedEmptyPackQty > line.expectedEmptyPackQty
    ) {
      throw new Error(
        "Accepted empty quantity must be between zero and expected",
      );
    }

    const convertedToNewQty =
      line.expectedEmptyPackQty - line.acceptedEmptyPackQty;
    const lineBalance =
      convertedToNewQty *
      toCents(line.exchangeCreditAmount, "Snapshotted Exchange Credit");
    totalBalance += lineBalance;
    totalCollectedEmptyPacks += line.acceptedEmptyPackQty;

    return {
      orderItemId: line.orderItemId,
      collectedEmptyPackQty: line.acceptedEmptyPackQty,
      convertedToNewQty,
      handoffBalance: formatCents(lineBalance),
    };
  });

  return {
    handoffBalance: formatCents(totalBalance),
    totalCollectedEmptyPacks,
    lines,
  };
}
