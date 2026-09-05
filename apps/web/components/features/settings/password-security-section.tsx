import { ShieldCheck } from "lucide-react";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { LoginSecurityPreferencesPanel } from "@/components/account/login-security-preferences-panel";
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

      <div className="grid lg:grid-cols-2">
        <div className="p-6 lg:border-r">
          <h3 className="mb-5 text-sm font-semibold text-gray-950">Password</h3>
          <ChangePasswordForm />
        </div>
        <div className="border-t p-6 lg:border-t-0">
          <h3 className="mb-5 text-sm font-semibold text-gray-950">
            Login preferences
          </h3>
          <LoginSecurityPreferencesPanel />
        </div>
      </div>
    </section>
  );
}
