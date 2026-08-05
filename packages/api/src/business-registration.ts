export const BUSINESS_NATURES = [
  "retail_shop",
  "wholesaler",
  "distributor",
  "manufacturer",
  "importer",
] as const;

export type BusinessNature = (typeof BUSINESS_NATURES)[number];
export type BusinessApplicationPath = "seller" | "warehouse";
export type BusinessPortalRole = "shop_owner" | "warehouse";

export const SHOP_OWNER_BUSINESS_NATURES = [
  "retail_shop",
  "manufacturer",
  "importer",
] as const satisfies readonly BusinessNature[];

export const WAREHOUSE_OWNER_BUSINESS_NATURES = [
  "wholesaler",
  "distributor",
] as const satisfies readonly BusinessNature[];

const WAREHOUSE_NATURE_SET = new Set<BusinessNature>(
  WAREHOUSE_OWNER_BUSINESS_NATURES,
);

export function resolveBusinessRegistration(nature: BusinessNature): {
  applicationPath: BusinessApplicationPath;
  portalRole: BusinessPortalRole;
} {
  if (WAREHOUSE_NATURE_SET.has(nature)) {
    return { applicationPath: "warehouse", portalRole: "warehouse" };
  }

  return { applicationPath: "seller", portalRole: "shop_owner" };
}

export function assertBusinessNatureMatchesApplicationPath(
  nature: BusinessNature | undefined,
  applicationPath: BusinessApplicationPath,
): void {
  if (!nature) return;

  const expected = resolveBusinessRegistration(nature).applicationPath;
  if (expected === applicationPath) return;

  const expectedLabel =
    expected === "warehouse"
      ? "warehouse owner application"
      : "shop owner application";
  throw new Error(`${nature} requires a ${expectedLabel}`);
}
