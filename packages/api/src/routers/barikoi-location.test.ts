import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBarikoiReversePlace } from "./barikoi-location";

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
