import { describe, expect, test } from "bun:test";
import { toLetCategoryLabel, toLetUnitCapabilities, toLetUnitTypes } from "./tolet-categories";
import { facilityInclusion, normalizeFacilityInclusions, toLetFacilityInclusionsSchema } from "./tolet-facilities";

describe("client document categories", () => {
  test("new categories work without discarding legacy values", () => {
    for (const value of ["family_sublet", "bachelor_sublet", "factory", "sublet", "warehouse"] as const) expect(toLetUnitTypes).toContain(value);
    expect(toLetCategoryLabel("warehouse")).toBe("Godown / Warehouse");
  });
  test("sublet rooms are retained; factories have no bedrooms", () => {
    expect(toLetUnitCapabilities("family_sublet").bedrooms).toBe(true);
    expect(toLetUnitCapabilities("bachelor_sublet").kitchen).toBe(true);
    expect(toLetUnitCapabilities("factory").bedrooms).toBe(false);
    expect(toLetUnitCapabilities("factory").bathrooms).toBe(true);
  });
});

describe("facility availability and inclusion are independent", () => {
  test("does not invent inclusion on legacy listings", () => expect(facilityInclusion(null, "water")).toBeNull());
  test("preserves excluded available facilities", () => expect(facilityInclusion({ water: false }, "water")).toBe(false));
  test("unknown facility keys are rejected", () => expect(toLetFacilityInclusionsSchema.safeParse({ arbitrary: true }).success).toBe(false));
  test("unavailable cannot be included", () => expect(normalizeFacilityInclusions({ water: true, gas: false }, { water: false, gas: true })).toEqual({ water: false, gas: false }));
});
