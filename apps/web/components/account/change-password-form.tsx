"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordInputField } from "@/components/account/password-input-field";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
  type ChangePasswordValues,
  changePasswordSchema,
  getPasswordChangeErrorMessage,
} from "@/lib/password-security";

const INITIAL_VALUES: ChangePasswordValues = {
  confirmPassword: "",
  currentPassword: "",
  newPassword: "",
};

type PasswordFieldName = keyof ChangePasswordValues;
type PasswordFieldErrors = Partial<Record<PasswordFieldName, string>>;

export function ChangePasswordForm() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [visibleFields, setVisibleFields] = useState<
    Partial<Record<PasswordFieldName, boolean>>
  >({});
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});
  const [formMessage, setFormMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateValue = (field: PasswordFieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormMessage(null);
  };

  const toggleVisibility = (field: PasswordFieldName) => {
    setVisibleFields((current) => ({
      ...current,
      [field]: !current[field],
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const result = changePasswordSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: PasswordFieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as PasswordFieldName | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setFieldErrors(nextErrors);
      setFormMessage(null);
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);

    try {
      const { error } = await authClient.changePassword({
        currentPassword: result.data.currentPassword,
        newPassword: result.data.newPassword,
      });

      if (error) {
        const message = getPasswordChangeErrorMessage(error);
        setFormMessage({ tone: "error", text: message });
        toast.error(message);
        return;
      }

      setValues(INITIAL_VALUES);
      setVisibleFields({});
      setFieldErrors({});
      setFormMessage({
        tone: "success",
        text: "Your password has been changed successfully.",
      });
      toast.success("Password changed successfully");
    } catch {
      const message =
        "Password could not be changed. Check your connection and retry.";
      setFormMessage({ tone: "error", text: message });
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <PasswordInputField
        id="current-password"
        label="Current password"
        value={values.currentPassword}
        visible={Boolean(visibleFields.currentPassword)}
        onChange={(value) => updateValue("currentPassword", value)}
        onToggleVisibility={() => toggleVisibility("currentPassword")}
        autoComplete="current-password"
        error={fieldErrors.currentPassword}
        disabled={isSubmitting}
      />

      <PasswordInputField
        id="new-password"
        label="New password"
        value={values.newPassword}
        visible={Boolean(visibleFields.newPassword)}
        onChange={(value) => updateValue("newPassword", value)}
        onToggleVisibility={() => toggleVisibility("newPassword")}
        autoComplete="new-password"
        error={fieldErrors.newPassword}
        hint="Use 8–128 characters with uppercase, lowercase, and a number."
        disabled={isSubmitting}
      />

      <PasswordInputField
        id="confirm-password"
        label="Confirm new password"
        value={values.confirmPassword}
        visible={Boolean(visibleFields.confirmPassword)}
        onChange={(value) => updateValue("confirmPassword", value)}
        onToggleVisibility={() => toggleVisibility("confirmPassword")}
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
        disabled={isSubmitting}
      />

      {formMessage && (
        <p
          className={`rounded-lg px-3 py-2.5 text-sm ${
            formMessage.tone === "success"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
          role={formMessage.tone === "error" ? "alert" : "status"}
        >
          {formMessage.text}
        </p>
      )}

      <div className="flex justify-end border-t pt-5">
        <Button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto"
          disabled={isSubmitting}
        >
          {isSubmitting && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {isSubmitting ? "Changing password..." : "Change password"}
        </Button>
      </div>
    </form>
  );
}
