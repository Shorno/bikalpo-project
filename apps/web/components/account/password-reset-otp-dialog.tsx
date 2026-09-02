"use client";

import {
  CheckCircle2,
  Loader2,
  MessageSquareText,
  RotateCw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PasswordInputField } from "@/components/account/password-input-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import {
  getPasswordResetErrorMessage,
  maskPhoneNumber,
  type ResetPasswordWithOtpValues,
  resetPasswordWithOtpSchema,
} from "@/lib/password-security";
import { client } from "@/utils/orpc";

const INITIAL_VALUES: ResetPasswordWithOtpValues = {
  confirmPassword: "",
  newPassword: "",
  otp: "",
};

type ResetField = keyof ResetPasswordWithOtpValues;
type ResetErrors = Partial<Record<ResetField, string>>;

export function PasswordResetOtpDialog({
  phoneNumber,
}: {
  phoneNumber?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<ResetErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const updateValue = (field: ResetField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  };

  const resetDialog = () => {
    setValues(INITIAL_VALUES);
    setErrors({});
    setMessage(null);
    setOtpSent(false);
    setIsComplete(false);
    setShowNewPassword(false);
    setShowConfirmation(false);
  };

  const requestOtp = async () => {
    if (!phoneNumber || isSending) return;

    setIsSending(true);
    setMessage(null);

    try {
      const { error } = await authClient.phoneNumber.requestPasswordReset({
        phoneNumber,
      });
      if (error) {
        setMessage(getPasswordResetErrorMessage(error));
        return;
      }

      setOtpSent(true);
      toast.success("Password reset OTP sent");

      if (process.env.NODE_ENV === "development") {
        try {
          const result = await client.devOtp.get({ phoneNumber });
          if (result?.code) updateValue("otp", result.code);
        } catch {
          // Device OTP auto-fill remains available through autocomplete.
        }
      }
    } catch {
      setMessage("The OTP could not be sent. Check your connection and retry.");
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) return;

    resetDialog();
    if (phoneNumber) void requestOtp();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phoneNumber || isResetting) return;

    const result = resetPasswordWithOtpSchema.safeParse(values);
    if (!result.success) {
      const nextErrors: ResetErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as ResetField | undefined;
        if (field && !nextErrors[field]) nextErrors[field] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setIsResetting(true);
    setMessage(null);
    try {
      const { error } = await authClient.phoneNumber.resetPassword({
        phoneNumber,
        otp: result.data.otp,
        newPassword: result.data.newPassword,
      });
      if (error) {
        setMessage(getPasswordResetErrorMessage(error));
        return;
      }

      setValues(INITIAL_VALUES);
      setIsComplete(true);
      toast.success("Password created successfully");
    } catch {
      setMessage(
        "The password could not be reset. Check your connection and retry.",
      );
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => handleOpenChange(true)}
      >
        <MessageSquareText className="size-4" aria-hidden="true" />
        Reset with OTP
      </Button>

      <DialogContent className="sm:max-w-lg">
        {isComplete ? (
          <>
            <DialogHeader>
              <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle>Password created</DialogTitle>
              <DialogDescription>
                You can now use your mobile number and new password to sign in.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button">Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset password with OTP</DialogTitle>
              <DialogDescription>
                We will verify your account mobile number before creating a new
                password.
              </DialogDescription>
            </DialogHeader>

            {!phoneNumber ? (
              <div
                className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                role="alert"
              >
                No mobile number is linked to this account. Add and verify a
                mobile number before resetting your password.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-xs font-medium text-emerald-800">
                    {otpSent
                      ? "OTP sent to account mobile"
                      : isSending
                        ? "Sending OTP to account mobile"
                        : "Account mobile number"}
                  </p>
                  <p className="mt-1 font-semibold text-emerald-950">
                    {maskPhoneNumber(phoneNumber)}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="password-reset-otp">6-digit OTP</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void requestOtp()}
                      disabled={isSending || isResetting}
                      className="h-auto px-2 py-1 text-xs"
                    >
                      {isSending ? (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <RotateCw className="size-3.5" aria-hidden="true" />
                      )}
                      {otpSent ? "Resend OTP" : "Send OTP"}
                    </Button>
                  </div>
                  <Input
                    id="password-reset-otp"
                    value={values.otp}
                    onChange={(event) =>
                      updateValue(
                        "otp",
                        event.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="Enter OTP"
                    aria-invalid={Boolean(errors.otp)}
                    aria-describedby={
                      errors.otp ? "password-reset-otp-error" : undefined
                    }
                    disabled={isSending || isResetting}
                    className="h-11 text-base tracking-[0.35em] sm:text-sm"
                    required
                  />
                  {errors.otp && (
                    <p
                      id="password-reset-otp-error"
                      className="text-xs text-red-600"
                      role="alert"
                    >
                      {errors.otp}
                    </p>
                  )}
                  <p className="text-xs leading-5 text-gray-500">
                    Your phone can fill this code automatically from the SMS.
                  </p>
                </div>

                <PasswordInputField
                  id="otp-new-password"
                  label="New password"
                  value={values.newPassword}
                  onChange={(value) => updateValue("newPassword", value)}
                  visible={showNewPassword}
                  onToggleVisibility={() =>
                    setShowNewPassword((current) => !current)
                  }
                  autoComplete="new-password"
                  error={errors.newPassword}
                  hint="Use 8–128 characters with uppercase, lowercase, and a number."
                  disabled={isResetting}
                />

                <PasswordInputField
                  id="otp-confirm-password"
                  label="Confirm new password"
                  value={values.confirmPassword}
                  onChange={(value) => updateValue("confirmPassword", value)}
                  visible={showConfirmation}
                  onToggleVisibility={() =>
                    setShowConfirmation((current) => !current)
                  }
                  autoComplete="new-password"
                  error={errors.confirmPassword}
                  disabled={isResetting}
                />

                {message && (
                  <p
                    className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700"
                    role="alert"
                  >
                    {message}
                  </p>
                )}

                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isResetting}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={isSending || isResetting || !otpSent}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isResetting && (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {isResetting ? "Resetting password..." : "Create password"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
