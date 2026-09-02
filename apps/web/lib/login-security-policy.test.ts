import assert from "node:assert/strict";
import test from "node:test";
import {
  getLoginSessionExpiresAt,
  loginSecurityPreferencesAreEqual,
  loginSecurityPreferencesSchema,
  normalizeLoginSecurityPreferences,
} from "@bikalpo-project/auth/login-security-policy";

test("accepts supported login security preferences", () => {
  const result = loginSecurityPreferencesSchema.safeParse({
    loginVerification: "otp_and_password",
    rememberTrustedDevice: true,
    autoLogoutMinutes: 30,
    allowMultipleLoginDevices: false,
  });

  assert.equal(result.success, true);
});

test("rejects unsupported auto logout durations", () => {
  const result = loginSecurityPreferencesSchema.safeParse({
    loginVerification: "otp_only",
    rememberTrustedDevice: false,
    autoLogoutMinutes: 45,
    allowMultipleLoginDevices: true,
  });

  assert.equal(result.success, false);
});

test("normalizes missing database values to backward-compatible defaults", () => {
  assert.deepEqual(normalizeLoginSecurityPreferences({}), {
    loginVerification: "otp_only",
    rememberTrustedDevice: true,
    autoLogoutMinutes: 30,
    allowMultipleLoginDevices: false,
  });
});

test("compares every persisted preference", () => {
  const defaults = normalizeLoginSecurityPreferences({});

  assert.equal(loginSecurityPreferencesAreEqual(defaults, defaults), true);
  assert.equal(
    loginSecurityPreferencesAreEqual(defaults, {
      ...defaults,
      rememberTrustedDevice: false,
    }),
    false,
  );
});

test("calculates the selected session lifetime", () => {
  assert.equal(
    getLoginSessionExpiresAt(30, Date.UTC(2026, 8, 3)).toISOString(),
    "2026-09-03T00:30:00.000Z",
  );
});
