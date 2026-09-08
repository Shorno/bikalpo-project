import { describe, expect, test } from "bun:test";
import { effectiveUnitAddress, unitAddressSchema, unitLocationLabel } from "./tolet-unit-address";

const property = { division: "Dhaka", district: "Dhaka", upazila: "Adabor", area: "Shyamoli", fullAddress: "10 Main Road", latitude: "23.7", longitude: "90.4" };
const custom = { division: "Barishal", district: "Barguna", upazila: "Bamna", area: "Bamna Bazar", fullAddress: "20 Unit Road", nearbyLandmark: "", latitude: null, longitude: null };

describe("unit address choice", () => {
  test("existing units inherit the current property address", () => {
    expect(effectiveUnitAddress(property, {})).toBe(property);
    expect(effectiveUnitAddress(property, { addressOverride: null })).toBe(property);
  });
  test("a custom address completely replaces the unit location, without changing its property", () => {
    expect(effectiveUnitAddress(property, { addressOverride: custom })).toBe(custom);
    expect(effectiveUnitAddress(property, { addressOverride: custom }).latitude).toBeNull();
    expect(unitLocationLabel(property, { addressOverride: custom })).toBe("Bamna Bazar, Bamna, Barguna, Barishal");
    expect(property.fullAddress).toBe("10 Main Road");
  });
  test("validates complete custom locations and coordinate pairs", () => {
    const complete = { ...custom, latitude: "22.4", longitude: "90.1" };
    expect(unitAddressSchema.safeParse(complete).success).toBe(true);
    expect(unitAddressSchema.safeParse(custom).success).toBe(false);
    for (const key of ["division", "district", "upazila", "area", "fullAddress"]) {
      expect(unitAddressSchema.safeParse({ ...complete, [key]: "" }).success).toBe(false);
    }
    expect(unitAddressSchema.safeParse({ ...custom, latitude: "23" }).success).toBe(false);
    expect(unitAddressSchema.safeParse({ ...custom, latitude: "99", longitude: "90" }).success).toBe(false);
  });
});
