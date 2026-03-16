import { Lock, Shield } from "lucide-react";
import { ChangePasswordForm } from "@/components/account/change-password-form";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      {/* Password Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center">
            <Lock className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Change Password
            </h2>
            <p className="text-sm text-gray-500">
              Update your password to keep your account secure
            </p>
          </div>
        </div>

        <ChangePasswordForm />
      </div>

      {/* Security Info */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
            <Shield className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Security Tips
            </h2>
          </div>
        </div>

        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            Use a unique password that you don&apos;t use for other accounts
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            Include a mix of letters, numbers, and special characters
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            Avoid using personal information like birthdays or names
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            Change your password regularly for better security
          </li>
        </ul>
      </div>
    </div>
  );
}
