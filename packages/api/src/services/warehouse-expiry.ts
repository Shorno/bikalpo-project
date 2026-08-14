export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class WarehouseExpiryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WarehouseExpiryValidationError";
  }
}

function isRealISODate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validateWarehouseStockTracking(input: {
  productName: string;
  trackingType: "none" | "batch" | "serial";
  expiryEnabled: boolean;
  batchNo?: string | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
}) {
  const batchNo = input.batchNo?.trim() || null;
  const manufactureDate = input.manufactureDate || null;
  const expiryDate = input.expiryDate || null;

  if (input.expiryEnabled && input.trackingType !== "batch") {
    throw new WarehouseExpiryValidationError(
      `${input.productName} must enable batch tracking before expiry tracking can be used`,
    );
  }
  if (input.trackingType === "batch" && !batchNo) {
    throw new WarehouseExpiryValidationError(
      `${input.productName} requires a batch / lot number`,
    );
  }
  if (input.trackingType !== "batch" && batchNo) {
    throw new WarehouseExpiryValidationError(
      `${input.productName} does not have batch tracking enabled`,
    );
  }
  if (input.expiryEnabled && !expiryDate) {
    throw new WarehouseExpiryValidationError(
      `${input.productName} requires an expiry date`,
    );
  }
  if (!input.expiryEnabled && (manufactureDate || expiryDate)) {
    throw new WarehouseExpiryValidationError(
      `${input.productName} does not have expiry tracking enabled`,
    );
  }
  if (manufactureDate && !isRealISODate(manufactureDate)) {
    throw new WarehouseExpiryValidationError(
      `${input.productName} has an invalid manufacture date`,
    );
  }
  if (expiryDate && !isRealISODate(expiryDate)) {
    throw new WarehouseExpiryValidationError(
      `${input.productName} has an invalid expiry date`,
    );
  }
  if (manufactureDate && expiryDate && expiryDate <= manufactureDate) {
    throw new WarehouseExpiryValidationError(
      `${input.productName} expiry date must be after its manufacture date`,
    );
  }

  return { batchNo, manufactureDate, expiryDate };
}
