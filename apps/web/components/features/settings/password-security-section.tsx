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
      className="relative mt-7 overflow-visible rounded-[1.25rem] bg-white md:mt-0 md:overflow-hidden md:rounded-xl md:border"
      aria-labelledby="password-security-heading"
    >
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between md:p-6">
        <div>
          <h2
            id="password-security-heading"
            className="absolute -top-6 left-1 flex items-center gap-2 text-sm font-bold tracking-tight text-gray-950 uppercase md:static md:text-lg md:font-semibold md:normal-case"
          >
            <ShieldCheck
              className="hidden size-5 text-emerald-700 md:block"
              aria-hidden="true"
            />
            <span className="md:hidden">Password and Security</span>
            <span className="hidden md:inline">
              Password &amp; login security
            </span>
          </h2>
          <p className="mt-1 hidden text-sm text-gray-500 md:block">
            Change your password, or create one by verifying your mobile number.
          </p>
        </div>
        <PasswordResetOtpDialog phoneNumber={phoneNumber} />
      </div>

      <div className="grid lg:grid-cols-2">
        <div className="p-4 md:p-6 lg:border-r">
          <h3 className="mb-5 text-sm font-semibold text-gray-950">Password</h3>
          <ChangePasswordForm />
        </div>
        <div className="border-t p-4 md:p-6 lg:border-t-0">
          <h3 className="mb-5 text-sm font-semibold text-gray-950">
            Login preferences
          </h3>
          <LoginSecurityPreferencesPanel />
        </div>
      </div>
    </section>
  );
}
