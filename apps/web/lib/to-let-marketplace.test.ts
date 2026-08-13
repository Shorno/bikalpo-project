import assert from "node:assert/strict";
import test from "node:test";
import {
  filterToLetMarketplaceListings,
  parseToLetSearchParams,
  toLetMarketHref,
} from "./to-let-marketplace";

const listings = [
  {
    listingCode: "LST-100001",
    propertyCode: "PR-2026-100001",
    unitCode: "UNT-100001",
    title: "Green View",
    description: "Quiet family home",
    location: "Mohammadpur, Dhaka",
    property: {
      name: "Green View Property",
      area: "Mohammadpur",
      district: "Dhaka",
      division: "Dhaka",
    },
    unit: { name: "Ground A", unitType: "family_flat" },
  },
  {
    listingCode: "LST-100002",
    propertyCode: "PR-2026-100002",
    unitCode: "UNT-100002",
    title: "Secure Garage",
    description: null,
    location: "Dhanmondi, Dhaka",
    property: {
      name: "Lake House",
      area: "Dhanmondi",
      district: "Dhaka",
      division: "Dhaka",
    },
    unit: { name: "Parking 2", unitType: "garage" },
  },
];

test("duplicate and invalid search params are parsed without throwing", () => {
  assert.deepEqual(
    parseToLetSearchParams({
      q: [" Mohammadpur ", "ignored"],
      type: ["garage", "other"],
    }),
    { query: "Mohammadpur", selectedType: "garage" },
  );
  assert.deepEqual(parseToLetSearchParams({ type: "invalid" }), {
    query: "",
    selectedType: undefined,
  });
});

test("search includes listing, property and unit identities", () => {
  for (const query of ["LST-100001", "PR-2026-100001", "UNT-100001"]) {
    assert.equal(
      filterToLetMarketplaceListings(listings, query).filtered.length,
      1,
    );
  }
});

test("query matching happens before rental-type counts and filtering", () => {
  const result = filterToLetMarketplaceListings(listings, "Dhaka", "garage");
  assert.equal(result.queryMatched.length, 2);
  assert.deepEqual(
    result.filtered.map((listing) => listing.listingCode),
    ["LST-100002"],
  );
});

test("market links preserve encoded query and selected rental type", () => {
  assert.equal(
    toLetMarketHref("মিরপুর ১০", "other"),
    "/to-let?q=%E0%A6%AE%E0%A6%BF%E0%A6%B0%E0%A6%AA%E0%A7%81%E0%A6%B0+%E0%A7%A7%E0%A7%A6&type=other#listings",
  );
});
