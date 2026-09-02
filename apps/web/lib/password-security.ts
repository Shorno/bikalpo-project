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
