import { describe, expect, test } from "bun:test";
import {
  bangladeshDivisions,
  districtsForDivision,
} from "./bangladesh-locations";
import data from "./property-location-data.json";
import {
  areasForUpazila,
  upazilasForDistrict,
} from "./property-location-options";

describe("client document property locations", () => {
  test("offers district-specific upazilas and thana-specific areas", () => {
    expect(upazilasForDistrict("Dhaka", "Dhaka")).toContain("Adabor");
    expect(areasForUpazila("Dhaka", "Dhaka", "Adabor")).toContain(
      "Japan Garden City",
    );
    expect(areasForUpazila("Dhaka", "Dhaka", "adabor")).not.toContain(
      "Bamna Bazar",
    );
    expect(
      areasForUpazila("Barishal", "Barguna", "Bamna").length,
    ).toBeGreaterThan(0);
  });
  test("does not leak lists across parents or unknown values", () => {
    expect(upazilasForDistrict("Sylhet", "Dhaka")).toEqual([]);
    expect(areasForUpazila("Dhaka", "Dhaka", "Not listed")).toEqual([]);
    expect(upazilasForDistrict("", "Dhaka")).toEqual([]);
  });
  test("does not promote unions to upazilas", () => {
    expect(upazilasForDistrict("Dhaka", "Manikganj")).not.toContain(
      "Betila-Mitra",
    );
    expect(areasForUpazila("Dhaka", "Manikganj", "Manikganj Sadar")).toContain(
      "Betila-Mitra",
    );
  });
  test("all districts are canonical and options have no duplicate or invalid labels", () => {
    const districts = bangladeshDivisions.flatMap((division) => [
      ...districtsForDivision(division),
    ]);
    for (const [district, upazilas] of Object.entries(data)) {
      expect(districts).toContain(district);
      expect(
        new Set(Object.keys(upazilas).map((name) => name.toLowerCase())).size,
      ).toBe(Object.keys(upazilas).length);
      for (const [name, areas] of Object.entries(upazilas)) {
        expect(name.length).toBeGreaterThan(1);
        expect(name.length).toBeLessThanOrEqual(150);
        expect(new Set(areas.map((area) => area.toLowerCase())).size).toBe(
          areas.length,
        );
        for (const area of areas) {
          expect(area.length).toBeGreaterThan(1);
          expect(area.length).toBeLessThanOrEqual(150);
        }
      }
    }
  });
});
