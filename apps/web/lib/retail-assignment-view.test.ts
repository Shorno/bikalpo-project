import assert from "node:assert/strict";
import test from "node:test";
import {
  getRetailAssignmentViewHref,
  normalizeRetailAssignmentView,
} from "./retail-assignment-view";

test("defaults missing and unknown assignment views to Delivery Groups", () => {
  assert.equal(normalizeRetailAssignmentView(undefined), "groups");
  assert.equal(normalizeRetailAssignmentView(null), "groups");
  assert.equal(normalizeRetailAssignmentView("unknown"), "groups");
});

test("recognizes the rider workload view", () => {
  assert.equal(normalizeRetailAssignmentView("riders"), "riders");
});

test("builds the canonical retailer assignment URL and preserves other filters", () => {
  assert.equal(
    getRetailAssignmentViewHref("groups"),
    "/dashboard/delivery-team/assignments?view=groups",
  );
  assert.equal(
    getRetailAssignmentViewHref("riders", "status=available&view=groups"),
    "/dashboard/delivery-team/assignments?status=available&view=riders",
  );
});
