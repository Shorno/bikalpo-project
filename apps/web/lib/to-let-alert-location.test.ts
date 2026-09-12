import assert from "node:assert/strict";
import test from "node:test";
import {
  alertLocationError,
  alertLocationFieldOrder,
  alertPreferenceInteger,
  emptyAlertLocation,
  preferredAlertLocation,
  updateAlertLocation,
} from "./to-let-alert-location";

const selected = {
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Pallabi",
  area: "Rupnagar",
};

test("location fields follow the PDF hierarchy", () => {
  assert.deepEqual(alertLocationFieldOrder, [
    "division",
    "district",
    "upazila",
    "area",
  ]);
});

test("wildcards preserve any-location and partial location searches", () => {
  assert.equal(preferredAlertLocation(emptyAlertLocation), "Any location");
  assert.equal(
    preferredAlertLocation({ ...emptyAlertLocation, division: "Dhaka" }),
    "Dhaka",
  );
  assert.equal(preferredAlertLocation(selected), "Rupnagar, Pallabi, Dhaka");
  assert.equal(alertLocationError(selected), null);
  assert.equal(alertLocationError(emptyAlertLocation), null);
});

test("changing a parent clears every descendant but preserves its ancestors", () => {
  assert.deepEqual(updateAlertLocation(selected, "division", "Sylhet"), {
    division: "Sylhet",
    district: "",
    upazila: "",
    area: "",
  });
  assert.deepEqual(updateAlertLocation(selected, "district", "Gazipur"), {
    division: "Dhaka",
    district: "Gazipur",
    upazila: "",
    area: "",
  });
  assert.deepEqual(updateAlertLocation(selected, "upazila", "Mirpur"), {
    ...selected,
    upazila: "Mirpur",
    area: "",
  });
  assert.deepEqual(updateAlertLocation(selected, "district", ""), {
    division: "Dhaka",
    district: "",
    upazila: "",
    area: "",
  });
  assert.equal(updateAlertLocation(selected, "district", "Dhaka"), selected);
});

test("districts cannot cross division boundaries and child fields need parents", () => {
  assert.match(
    alertLocationError({ ...selected, division: "Sylhet" })!,
    /district/i,
  );
  assert.match(
    alertLocationError({ ...selected, division: "not a division" })!,
    /division/i,
  );
  assert.match(alertLocationError({ ...selected, district: "" })!, /district/i);
  assert.match(alertLocationError({ ...selected, upazila: "" })!, /Upazila/i);
});

test("unlisted locations remain supported within parent scope and API length limits", () => {
  assert.equal(
    alertLocationError({ ...selected, upazila: "New Thana", area: "New Area" }),
    null,
  );
  assert.match(alertLocationError({ ...selected, area: "X" })!, /2 characters/);
  assert.match(
    alertLocationError({ ...selected, area: "A".repeat(201) })!,
    /too long/,
  );
});

test("preference numbers are not silently truncated or coerced to zero", () => {
  for (const invalid of ["", "-1", "1.5", "2foo", "1e3", "Infinity"]) {
    assert.equal(alertPreferenceInteger(invalid, 100), null);
  }
  assert.equal(alertPreferenceInteger("0", 100), 0);
  assert.equal(alertPreferenceInteger(" 3 ", 100), 3);
  assert.equal(alertPreferenceInteger("100", 100), 100);
  assert.equal(alertPreferenceInteger("101", 100), null);
  assert.equal(alertPreferenceInteger("1000000", 1_000_000), 1_000_000);
  assert.equal(alertPreferenceInteger("1000001", 1_000_000), null);
});
