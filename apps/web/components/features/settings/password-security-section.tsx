import { ShieldCheck } from "lucide-react";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export function PasswordSecuritySection() {
  return (
    <section
      id="password-security"
      className="overflow-hidden rounded-xl border bg-white"
      aria-labelledby="password-security-heading"
    >
      <div className="border-b p-6">
        <h2
          id="password-security-heading"
          className="flex items-center gap-2 text-lg font-semibold text-gray-950"
        >
          <ShieldCheck className="size-5 text-emerald-700" aria-hidden="true" />
          Password &amp; login security
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Verify your current password before choosing a new one.
        </p>
      </div>

      <div className="max-w-2xl p-6">
        <ChangePasswordForm />
      </div>
    </section>
  );
}
