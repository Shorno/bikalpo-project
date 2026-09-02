import { z } from "zod";

export const LOGIN_VERIFICATION_OPTIONS = [
  { value: "otp_and_password", label: "OTP + Password" },
  { value: "otp_only", label: "OTP Only" },
  { value: "password_only", label: "Password Only" },
] as const;

export const AUTO_LOGOUT_OPTIONS = [
  { value: 15, label: "15 Minutes" },
  { value: 30, label: "30 Minutes" },
  { value: 60, label: "1 Hour" },
  { value: 120, label: "2 Hours" },
] as const;

export const loginSecurityPreferencesSchema = z.object({
  loginVerification: z.enum(["otp_and_password", "otp_only", "password_only"]),
  rememberTrustedDevice: z.boolean(),
  autoLogoutMinutes: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(120),
  ]),
  allowMultipleLoginDevices: z.boolean(),
});

export type LoginSecurityPreferences = z.infer<
  typeof loginSecurityPreferencesSchema
>;

export type StoredLoginSecurityPreferences = {
  loginVerification?: string | null;
  rememberTrustedDevice?: boolean | null;
  autoLogoutMinutes?: number | null;
  allowMultipleLoginDevices?: boolean | null;
};

export function normalizeLoginSecurityPreferences(
  values: StoredLoginSecurityPreferences,
): LoginSecurityPreferences {
  const result = loginSecurityPreferencesSchema.safeParse(values);
  if (result.success) return result.data;

  return {
    loginVerification: "otp_only",
    rememberTrustedDevice: true,
    autoLogoutMinutes: 30,
    allowMultipleLoginDevices: false,
  };
}

export function shouldApplyLoginSecurityPreferences(role?: string | null) {
  return role === "shop_owner";
}

export function loginSecurityPreferencesAreEqual(
  left: LoginSecurityPreferences,
  right: LoginSecurityPreferences,
) {
  return (
    left.loginVerification === right.loginVerification &&
    left.rememberTrustedDevice === right.rememberTrustedDevice &&
    left.autoLogoutMinutes === right.autoLogoutMinutes &&
    left.allowMultipleLoginDevices === right.allowMultipleLoginDevices
  );
}

export function getLoginSessionExpiresAt(
  autoLogoutMinutes: LoginSecurityPreferences["autoLogoutMinutes"],
  now = Date.now(),
) {
  return new Date(now + autoLogoutMinutes * 60 * 1000);
}
