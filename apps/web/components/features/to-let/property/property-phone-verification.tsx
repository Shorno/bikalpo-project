"use client";

import { CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

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
  const [otpAutoFilling, setOtpAutoFilling] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const autoFillTimersRef = useRef<number[]>([]);
  const autoSendAttemptedRef = useRef(false);
  const normalizedPhone = useMemo(() => toBangladeshE164(phone), [phone]);
  const activePhoneRef = useRef(normalizedPhone);
  const isDevelopment = process.env.NODE_ENV === "development";
  const code = otpValues.join("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    activePhoneRef.current = normalizedPhone;
    for (const timer of autoFillTimersRef.current) {
      window.clearTimeout(timer);
    }
    autoFillTimersRef.current = [];
    setOtpValues([...EMPTY_OTP]);
    setOtpAutoFilling(false);
    setSent(false);
    setCooldown(0);
    autoSendAttemptedRef.current = false;

    return () => {
      for (const timer of autoFillTimersRef.current) {
        window.clearTimeout(timer);
      }
      autoFillTimersRef.current = [];
    };
  }, [normalizedPhone]);

  const verifyWithCode = async (otpCode: string) => {
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Enter the 6-digit verification code");
      return false;
    }

    const requestedPhone = normalizedPhone;
    setVerifying(true);
    try {
      const result = await authClient.phoneNumber.verify({
        phoneNumber: requestedPhone,
        code: otpCode,
        updatePhoneNumber: true,
      });
      if (activePhoneRef.current !== requestedPhone) return false;
      if (result.error) {
        toast.error(result.error.message || "Invalid verification code");
        return false;
      }
      onVerified();
      toast.success("Phone verified");
      return true;
    } catch (error) {
      if (activePhoneRef.current !== requestedPhone) return false;
      toast.error(
        error instanceof Error ? error.message : "Verification failed",
      );
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const sendOtp = useCallback(async () => {
    const isValidPhone = isDevelopment
      ? /^\+\d{5,15}$/.test(normalizedPhone)
      : /^\+8801\d{9}$/.test(normalizedPhone);

    if (!isValidPhone) {
      toast.error(
        isDevelopment
          ? "Enter a mobile number with at least 5 digits"
          : "Enter a valid Bangladesh mobile number",
      );
      return;
    }

    const requestedPhone = normalizedPhone;
    setSending(true);
    try {
      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: requestedPhone,
      });
      if (activePhoneRef.current !== requestedPhone) return;
      if (result.error) {
        toast.error(result.error.message || "Could not send OTP");
        return;
      }

      for (const timer of autoFillTimersRef.current) {
        window.clearTimeout(timer);
      }
      autoFillTimersRef.current = [];
      setOtpValues([...EMPTY_OTP]);
      setOtpAutoFilling(false);
      setSent(true);
      setCooldown(45);
      toast.success("Verification code sent");

      if (isDevelopment) {
        setOtpAutoFilling(true);
        try {
          const devOtp = await client.devOtp.get({
            phoneNumber: requestedPhone,
          });
          if (activePhoneRef.current !== requestedPhone) return;
          const digits = devOtp?.code?.replace(/\D/g, "").slice(0, 6).split("");

          if (digits?.length === 6) {
            digits.forEach((digit, index) => {
              const timer = window.setTimeout(
                () => {
                  setOtpValues((current) => {
                    const next = [...current];
                    next[index] = digit;
                    return next;
                  });
                  if (index === digits.length - 1) {
                    setOtpAutoFilling(false);
                  }
                },
                150 * (index + 1) + 600,
              );
              autoFillTimersRef.current.push(timer);
            });
          } else {
            setOtpAutoFilling(false);
          }
        } catch {
          setOtpAutoFilling(false);
          // Manual entry remains usable if the local helper is unavailable.
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not send OTP",
      );
    } finally {
      setSending(false);
    }
  }, [isDevelopment, normalizedPhone]);

  useEffect(() => {
    if (verified || sent || autoSendAttemptedRef.current) return;
    autoSendAttemptedRef.current = true;
    void sendOtp();
  }, [sendOtp, sent, verified]);

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
            We will send a 6-digit code to {normalizedPhone}.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="property-phone-otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => handleOtpChange(event.target.value)}
            disabled={!sent || otpAutoFilling || verifying}
            placeholder={sent ? "Enter OTP" : "Sending OTP..."}
            aria-label="OTP"
            aria-busy={otpAutoFilling}
            className={`h-11 max-w-sm bg-white font-mono text-base ${
              otpAutoFilling
                ? "animate-pulse border-emerald-300 bg-emerald-50"
                : code.length === 6
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : ""
            }`}
          />
          <Button
            type="button"
            onClick={() => verifyWithCode(code)}
            disabled={!sent || verifying || otpAutoFilling || code.length !== 6}
            className="h-10 bg-emerald-600 hover:bg-emerald-700"
          >
            {verifying && <Loader2 className="animate-spin" />}
            Verify OTP
          </Button>
        </div>
        {isDevelopment && otpAutoFilling && (
          <p
            className="text-xs text-emerald-700"
            role="status"
            aria-live="polite"
          >
            Filling the local development OTP automatically…
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={sendOtp}
          disabled={sending || cooldown > 0}
          className="px-0 text-gray-600"
        >
          <RefreshCw className={sending ? "animate-spin" : ""} />
          {sending
            ? "Sending OTP..."
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : sent
                ? "Resend code"
                : "Send OTP"}
        </Button>
      </div>
    </div>
  );
}
