import assert from "node:assert/strict";
import test from "node:test";
import {
  getPhoneAuthEmail,
  isPhoneAuthEmail,
  normalizeBangladeshPhoneNumber,
} from "./phone-identity";

test("normalizes supported Bangladesh phone formats to E.164", () => {
  assert.equal(normalizeBangladeshPhoneNumber("01851151827"), "+8801851151827");
  assert.equal(
    normalizeBangladeshPhoneNumber("8801851151827"),
    "+8801851151827",
  );
  assert.equal(
    normalizeBangladeshPhoneNumber("+8801851151827"),
    "+8801851151827",
  );
});

test("rejects malformed phone identities", () => {
  assert.equal(normalizeBangladeshPhoneNumber("invalid"), null);
  assert.equal(normalizeBangladeshPhoneNumber("1234567"), null);
  assert.equal(normalizeBangladeshPhoneNumber("+8801251151827"), null);
});

test("derives and recognizes phone-auth temporary emails", () => {
  assert.equal(getPhoneAuthEmail("01851151827"), "8801851151827@bikalpo.com");
  assert.equal(isPhoneAuthEmail("8801851151827@bikalpo.com"), true);
  assert.equal(isPhoneAuthEmail("customer@example.com"), false);
});
