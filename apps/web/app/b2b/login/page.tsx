"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

export default function B2BLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpAutoFilling, setOtpAutoFilling] = useState(false);
  const [error, setError] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullPhone = `+880${phone.replace(/^0+/, "")}`;

  const handleSendOtp = async () => {
    if (!phone || phone.length < 11) return;
    setIsSending(true);
    setError("");

    try {
      await authClient.phoneNumber.sendOtp({ phoneNumber: fullPhone });
      setOtpSent(true);
      setOtpAutoFilling(true);

      // Auto-fill OTP from server
      try {
        const result = await client.devOtp.get({ phoneNumber: fullPhone });
        if (result?.code) {
          const digits = result.code.split("");
          digits.forEach((digit: string, index: number) => {
            setTimeout(() => {
              setOtpValues((prev) => {
                const newValues = [...prev];
                newValues[index] = digit;
                return newValues;
              });
              if (index === digits.length - 1) {
                setOtpAutoFilling(false);
              }
            }, 200 * (index + 1) + 800);
          });
        } else {
          setOtpAutoFilling(false);
        }
      } catch {
        setOtpAutoFilling(false);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send OTP");
      setOtpAutoFilling(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newValues = [...otpValues];
    newValues[index] = value;
    setOtpValues(newValues);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otpValues.join("");
    if (code.length !== 6) return;

    setIsVerifying(true);
    setError("");

    try {
      const result = await authClient.phoneNumber.verify({
        phoneNumber: fullPhone,
        code,
      });

      if (result.error) {
        setError(result.error.message || "Invalid OTP");
        setIsVerifying(false);
        return;
      }

      router.push("/b2b/status");
    } catch (err: any) {
      setError(err?.message || "Verification failed");
      setIsVerifying(false);
    }
  };

  return (
    <section className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#003178]/10 mb-4">
            <span
              className="material-symbols-outlined text-3xl text-[#003178]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              storefront
            </span>
          </div>
          <h1
            className="text-2xl font-extrabold text-gray-900 mb-2"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Seller Sign In
          </h1>
          <p className="text-gray-500 text-sm">
            Check your application status or access your account
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {/* Phone Input */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium text-gray-600">
                +880
              </div>
              <input
                type="tel"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length <= 11) setPhone(val);
                }}
                disabled={otpSent && !error}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm outline-none focus:border-[#003178] focus:ring-1 focus:ring-[#003178]/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* OTP Section */}
          {!otpSent ? (
            <button
              onClick={handleSendOtp}
              disabled={!phone || phone.length < 11 || isSending}
              className="w-full py-3 rounded-lg text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
              style={{
                background:
                  "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
              }}
            >
              {isSending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending OTP...
                </span>
              ) : (
                "Send OTP"
              )}
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-gray-500">
                Enter the 6-digit code sent to{" "}
                <strong className="text-gray-700">+880{phone}</strong>
              </p>

              {/* OTP Boxes */}
              <div className="flex justify-center gap-2">
                {otpValues.map((val, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      otpRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className={`w-12 h-14 text-center text-xl font-bold rounded-lg border-2 outline-none transition-all ${
                      val
                        ? "border-[#003178] bg-[#003178]/5 text-[#003178]"
                        : "border-gray-200 bg-gray-50"
                    } ${otpAutoFilling ? "animate-pulse" : ""} focus:border-[#003178] focus:ring-2 focus:ring-[#003178]/20`}
                  />
                ))}
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerify}
                disabled={otpValues.join("").length !== 6 || isVerifying || otpAutoFilling}
                className="w-full py-3 rounded-lg text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
                style={{
                  background:
                    "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                }}
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>

              {/* Resend */}
              <button
                onClick={() => {
                  setOtpSent(false);
                  setOtpValues(["", "", "", "", "", ""]);
                  setError("");
                }}
                className="w-full text-center text-xs text-[#003178] font-medium hover:underline"
              >
                Change phone number or resend OTP
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-center text-xs text-red-500 mt-3 font-medium">
              {error}
            </p>
          )}
        </div>

        {/* Footer Links */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/b2b/register"
              className="text-[#003178] font-semibold hover:underline"
            >
              Apply Now
            </Link>
          </p>
          <Link
            href="/b2b"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← Back to Bikalpo B2B
          </Link>
        </div>
      </div>
    </section>
  );
}
