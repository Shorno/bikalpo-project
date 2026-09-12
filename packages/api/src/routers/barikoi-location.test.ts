import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeBarikoiAutocompletePlace,
  normalizeBarikoiReversePlace,
} from "./barikoi-location";

test("autocomplete normalizes Barikoi's string coordinates", () => {
  const location = normalizeBarikoiAutocompletePlace({
    id: 2544160,
    address: "Sakib General Store, Hemayetpur, Savar",
    area: "Hemayetpur",
    city: "Savar",
    sub_district: "Savar",
    postCode: 1340,
    latitude: "23.92108033637304",
    longitude: "90.25554851974034",
  });

  assert.equal(location?.latitude, 23.92108033637304);
  assert.equal(location?.longitude, 90.25554851974034);
  assert.equal(location?.sub_district, "Savar");
});

test("reverse geocoding falls back to sub-district for Thana", () => {
  const location = normalizeBarikoiReversePlace({
    address: "Jamur Muchipara, Tetuljhora, Savar",
    area: "Tetuljhora",
    sub_district: "Savar",
    district: "Dhaka",
    division: "Dhaka",
  });

  assert.equal(location.thana, "Savar");
  assert.equal(location.area, "Tetuljhora");
});

test("the explicit Barikoi Thana takes precedence over sub-district", () => {
  const location = normalizeBarikoiReversePlace({
    thana: "Ashulia",
    sub_district: "Savar",
  });

  assert.equal(location.thana, "Ashulia");
});
