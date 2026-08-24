"use client";

import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMPTY_OTP = ["", "", "", "", "", ""];

function toBangladeshE164(phone: string) {
  const trimmed = phone.trim();
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("880")) return `+${digits}`;
  if (digits.startsWith("0")) return `+88${digits}`;
  return `+880${digits}`;
}

export function PropertyPhoneVerification({
  phone,
  verified,
  onVerified,
}: {
  phone: string;
  verified: boolean;
  onVerified: () => void;
}) {
  const [otpValues, setOtpValues] = useState([...EMPTY_OTP]);
  const normalizedPhone = useMemo(() => toBangladeshE164(phone), [phone]);
  const code = otpValues.join("");

  const verifyWithCode = () => {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter any 6-digit verification code");
      return;
    }

    onVerified();
    toast.success("Phone verified");
  };

  const handleOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6).split("");
    setOtpValues(Array.from({ length: 6 }, (_, index) => digits[index] ?? ""));
  };

  if (verified) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Phone verified</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            Property contact verified as {normalizedPhone}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">
            Verify property contact
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Enter any 6-digit code to verify {normalizedPhone}.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          id="property-phone-otp"
          type="text"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => handleOtpChange(event.target.value)}
          placeholder="Enter any 6-digit code"
          aria-label="OTP"
          className={`h-11 max-w-sm bg-white font-mono text-base ${
            code.length === 6
              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
              : ""
          }`}
        />
        <Button
          type="button"
          onClick={verifyWithCode}
          disabled={code.length !== 6}
          className="h-10 bg-emerald-600 hover:bg-emerald-700"
        >
          Verify OTP
        </Button>
      </div>
    </div>
  );
}
