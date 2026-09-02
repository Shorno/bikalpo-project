import { ShieldCheck } from "lucide-react";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { PasswordResetOtpDialog } from "@/components/account/password-reset-otp-dialog";

export function PasswordSecuritySection({
  phoneNumber,
}: {
  phoneNumber?: string | null;
}) {
  return (
    <section
      id="password-security"
      className="overflow-hidden rounded-xl border bg-white"
      aria-labelledby="password-security-heading"
    >
      <div className="flex flex-col gap-4 border-b p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="password-security-heading"
            className="flex items-center gap-2 text-lg font-semibold text-gray-950"
          >
            <ShieldCheck
              className="size-5 text-emerald-700"
              aria-hidden="true"
            />
            Password &amp; login security
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Change your password, or create one by verifying your mobile number.
          </p>
        </div>
        <PasswordResetOtpDialog phoneNumber={phoneNumber} />
      </div>

      <div className="max-w-2xl p-6">
        <ChangePasswordForm />
      </div>
    </section>
  );
}
