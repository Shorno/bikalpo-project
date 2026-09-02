import assert from "node:assert/strict";
import test from "node:test";
import {
  changePasswordSchema,
  getPasswordChangeErrorMessage,
  getPasswordResetErrorMessage,
  maskPhoneNumber,
  resetPasswordWithOtpSchema,
} from "./password-security";

test("accepts a strong new password that matches its confirmation", () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: "CurrentPass1",
    newPassword: "NewSecurePass2",
    confirmPassword: "NewSecurePass2",
  });

  assert.equal(result.success, true);
});

test("rejects a new password that matches the current password", () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: "CurrentPass1",
    newPassword: "CurrentPass1",
    confirmPassword: "CurrentPass1",
  });

  assert.equal(result.success, false);
  assert.equal(
    result.error?.issues.some(
      (issue) =>
        issue.path[0] === "newPassword" &&
        issue.message ===
          "New password must be different from current password",
    ),
    true,
  );
});

test("rejects a confirmation that does not match", () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: "CurrentPass1",
    newPassword: "NewSecurePass2",
    confirmPassword: "DifferentPass3",
  });

  assert.equal(result.success, false);
  assert.equal(
    result.error?.issues.some(
      (issue) =>
        issue.path[0] === "confirmPassword" &&
        issue.message === "Passwords do not match",
    ),
    true,
  );
});

test("rejects passwords that do not meet the shared server policy", () => {
  const result = changePasswordSchema.safeParse({
    currentPassword: "CurrentPass1",
    newPassword: "lowercaseonly",
    confirmPassword: "lowercaseonly",
  });

  assert.equal(result.success, false);
  assert.equal(
    result.error?.issues.some(
      (issue) =>
        issue.path[0] === "newPassword" &&
        issue.message === "Password must contain at least one uppercase letter",
    ),
    true,
  );
});

test("maps Better Auth failures to actionable messages", () => {
  assert.equal(
    getPasswordChangeErrorMessage({ code: "INVALID_PASSWORD" }),
    "Your current password is incorrect.",
  );
  assert.equal(
    getPasswordChangeErrorMessage({ code: "CREDENTIAL_ACCOUNT_NOT_FOUND" }),
    "This account does not have a password to change.",
  );
  assert.equal(
    getPasswordChangeErrorMessage({ message: "Request failed" }),
    "Request failed",
  );
});

test("accepts a six-digit OTP with a matching strong password", () => {
  const result = resetPasswordWithOtpSchema.safeParse({
    otp: "123456",
    newPassword: "NewSecurePass2",
    confirmPassword: "NewSecurePass2",
  });

  assert.equal(result.success, true);
});

test("rejects an incomplete OTP and mismatched reset password", () => {
  const result = resetPasswordWithOtpSchema.safeParse({
    otp: "123",
    newPassword: "NewSecurePass2",
    confirmPassword: "DifferentPass3",
  });

  assert.equal(result.success, false);
  assert.deepEqual(
    result.error?.issues.map((issue) => issue.path[0]),
    ["otp", "confirmPassword"],
  );
});

test("maps OTP reset errors and masks the account phone number", () => {
  assert.equal(
    getPasswordResetErrorMessage({ code: "INVALID_OTP" }),
    "That OTP is incorrect. Check the code and try again.",
  );
  assert.equal(
    getPasswordResetErrorMessage({ code: "TOO_MANY_ATTEMPTS" }),
    "Too many incorrect attempts. Request a new OTP.",
  );
  assert.equal(maskPhoneNumber("+8801841151827"), "+880 •••••• 1827");
});
