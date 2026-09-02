import { z } from "zod";
import { passwordValidation } from "../schema/auth.schema";

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Current password is required")
      .max(128, "Current password is too long"),
    newPassword: passwordValidation,
    confirmPassword: z
      .string()
      .min(1, "Please confirm your new password")
      .max(128, "Password confirmation is too long"),
  })
  .superRefine((data, context) => {
    if (data.newPassword === data.currentPassword) {
      context.addIssue({
        code: "custom",
        message: "New password must be different from current password",
        path: ["newPassword"],
      });
    }

    if (data.newPassword !== data.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const resetPasswordWithOtpSchema = z
  .object({
    otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
    newPassword: passwordValidation,
    confirmPassword: z
      .string()
      .min(1, "Please confirm your new password")
      .max(128, "Password confirmation is too long"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordWithOtpValues = z.infer<
  typeof resetPasswordWithOtpSchema
>;

export function getPasswordChangeErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  switch (error.code) {
    case "INVALID_PASSWORD":
      return "Your current password is incorrect.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "This account does not have a password to change.";
    case "SESSION_EXPIRED":
    case "UNAUTHORIZED":
      return "Your session has expired. Sign in again and retry.";
    case "TOO_MANY_REQUESTS":
      return "Too many attempts. Wait a moment and try again.";
    default:
      return (
        error.message || "Password could not be changed. Please try again."
      );
  }
}

export function getPasswordResetErrorMessage(error: {
  code?: string;
  message?: string;
}) {
  switch (error.code) {
    case "INVALID_OTP":
      return "That OTP is incorrect. Check the code and try again.";
    case "OTP_EXPIRED":
      return "That OTP has expired. Request a new code.";
    case "OTP_NOT_FOUND":
      return "Request a new OTP before resetting your password.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many incorrect attempts. Request a new OTP.";
    case "TOO_MANY_REQUESTS":
      return "Too many requests. Wait a moment before requesting another OTP.";
    case "PHONE_NUMBER_NOT_EXIST":
      return "No account is linked to this mobile number.";
    case "PASSWORD_POLICY_FAILED":
      return error.message || "Choose a stronger password and try again.";
    default:
      return error.message || "Password could not be reset. Please try again.";
  }
}

export function maskPhoneNumber(phoneNumber: string) {
  const compact = phoneNumber.replace(/\s/g, "");
  if (compact.length <= 4) return compact;

  const countryCode = compact.startsWith("+880") ? "+880" : "";
  return `${countryCode}${countryCode ? " " : ""}•••••• ${compact.slice(-4)}`;
}
