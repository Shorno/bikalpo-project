"use client";

import { CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

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
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const autoVerifiedPhoneRef = useRef("");
  const normalizedPhone = useMemo(() => toBangladeshE164(phone), [phone]);
  const isDevelopment = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (
      !isDevelopment ||
      verified ||
      !normalizedPhone ||
      autoVerifiedPhoneRef.current === normalizedPhone
    ) {
      return;
    }

    autoVerifiedPhoneRef.current = normalizedPhone;
    onVerified();
    toast.success("Phone automatically verified for local development");
  }, [isDevelopment, normalizedPhone, onVerified, verified]);

  const verifyWithCode = async (otpCode: string, automatic = false) => {
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Enter the 6-digit verification code");
      return false;
    }

    setVerifying(true);
    try {
      const result = await authClient.phoneNumber.verify({
        phoneNumber: normalizedPhone,
        code: otpCode,
        updatePhoneNumber: true,
      });
      if (result.error) {
        toast.error(result.error.message || "Invalid verification code");
        return false;
      }
      onVerified();
      toast.success(
        automatic ? "Phone number verified automatically" : "Phone verified",
      );
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verification failed",
      );
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const sendOtp = async () => {
    if (!/^\+8801\d{9}$/.test(normalizedPhone)) {
      toast.error("Enter a valid Bangladesh mobile number");
      return;
    }

    setSending(true);
    try {
      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: normalizedPhone,
      });
      if (result.error) {
        toast.error(result.error.message || "Could not send OTP");
        return;
      }
      setSent(true);
      setCooldown(45);
      toast.success("Verification code sent");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send OTP",
      );
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = () => verifyWithCode(code);

  if (verified) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Phone verified</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            {isDevelopment
              ? `Automatically verified for local development as ${normalizedPhone}.`
              : `Property contact verified as ${normalizedPhone}.`}
          </p>
        </div>
      </div>
    );
  }

  if (isDevelopment) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin" />
        <div>
          <p className="text-sm font-semibold">Verifying automatically</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            Local development skips the OTP. Production will require the 6-digit
            verification code.
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
            We will send a 6-digit code to {normalizedPhone}.
          </p>
        </div>
      </div>

      {!sent ? (
        <Button
          type="button"
          onClick={sendOtp}
          disabled={sending}
          className="mt-4 bg-emerald-600 hover:bg-emerald-700"
        >
          {(sending || verifying) && <Loader2 className="animate-spin" />}
          Send OTP
        </Button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit OTP"
              className="h-10 max-w-xs bg-white font-mono tracking-[0.3em]"
              aria-label="Verification code"
            />
            <Button
              type="button"
              onClick={() => verifyOtp()}
              disabled={verifying || code.length !== 6}
              className="h-10 bg-emerald-600 hover:bg-emerald-700"
            >
              {verifying && <Loader2 className="animate-spin" />}
              Verify OTP
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={sendOtp}
            disabled={sending || cooldown > 0}
            className="px-0 text-gray-600"
          >
            <RefreshCw className={sending ? "animate-spin" : ""} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </Button>
        </div>
      )}
    </div>
  );
}
