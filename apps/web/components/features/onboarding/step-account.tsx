"use client";

import { useState, useRef, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { client } from "@/utils/orpc";

interface StepAccountProps {
  data: {
    phone: string;
    fullName: string;
    email: string;
    password: string;
    otpVerified: boolean;
  };
  onUpdate: (data: StepAccountProps["data"]) => void;
  onNext: () => void;
}

export function StepAccount({ data, onUpdate, onNext }: StepAccountProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpAutoFilling, setOtpAutoFilling] = useState(false);
  const [otpError, setOtpError] = useState("");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fullPhone = `+880${data.phone.replace(/^0+/, "")}`;

  const handleSendOtp = async () => {
    if (!data.phone || data.phone.length < 11) return;
    setIsSending(true);
    setOtpError("");

    try {
      // Call real Better Auth phone plugin to send OTP
      await authClient.phoneNumber.sendOtp({ phoneNumber: fullPhone });
      setOtpSent(true);
      setOtpAutoFilling(true);

      // Auto-fill: fetch OTP from server and fill the input boxes
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
            }, 200 * (index + 1) + 1000);
          });
        } else {
          setOtpAutoFilling(false);
        }
      } catch {
        setOtpAutoFilling(false);
      }
    } catch (err: any) {
      setOtpError(err?.message || "Failed to send OTP");
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

    // Auto-focus next input
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

  const handleVerifyOtp = async () => {
    const enteredOtp = otpValues.join("");
    if (enteredOtp.length !== 6) return;

    setIsVerifying(true);
    setOtpError("");

    try {
      // Call real Better Auth phone verify — this creates the user + session
      const result = await authClient.phoneNumber.verify({
        phoneNumber: fullPhone,
        code: enteredOtp,
      });

      if (result.error) {
        setOtpError(result.error.message || "Invalid OTP");
        setIsVerifying(false);
        return;
      }

      onUpdate({ ...data, otpVerified: true });
      setIsVerifying(false);
    } catch (err: any) {
      setOtpError(err?.message || "Verification failed");
      setIsVerifying(false);
    }
  };

  const isOtpComplete = otpValues.every((v) => v !== "");
  const canProceed =
    data.otpVerified && data.fullName && data.password && data.password.length >= 6;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#003178]/5 mb-4">
          <span
            className="material-symbols-outlined text-3xl text-[#003178]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            phone_android
          </span>
        </div>
        <h2
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Create Your Account
        </h2>
        <p className="text-gray-500">
          Verify your phone number to get started
        </p>
      </div>

      {/* Phone + OTP Section */}
      <div className="space-y-5">
        {/* Phone Number */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
              +880
            </div>
            <input
              type="tel"
              value={data.phone}
              onChange={(e) =>
                onUpdate({
                  ...data,
                  phone: e.target.value.replace(/\D/g, ""),
                })
              }
              placeholder="1XXXXXXXXX"
              maxLength={11}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178] transition-all"
              disabled={data.otpVerified}
            />
            {!data.otpVerified && (
              <button
                onClick={handleSendOtp}
                disabled={!data.phone || data.phone.length < 11 || otpAutoFilling || isSending}
                className="px-4 py-3 bg-[#003178] text-white text-sm font-semibold rounded-lg hover:bg-[#003178]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
              >
                {isSending ? "Sending..." : otpSent ? "Resend" : "Send OTP"}
              </button>
            )}
          </div>
          {data.otpVerified && (
            <div className="flex items-center gap-1.5 mt-2 text-green-600">
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <span className="text-xs font-medium">Phone verified</span>
            </div>
          )}
        </div>

        {/* OTP Input */}
        {otpSent && !data.otpVerified && (
          <div className="animate-in slide-in-from-top-2 duration-300">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Enter OTP Code
            </label>
            <div className="flex gap-3 justify-center mb-3">
              {otpValues.map((value, index) => (
                <input
                  key={index}
                  ref={(el) => { otpRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={value}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={`
                    w-12 h-14 text-center text-xl font-bold border-2 rounded-xl
                    focus:outline-none focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178]
                    transition-all duration-200
                    ${
                      value
                        ? "border-[#003178] bg-[#003178]/5 text-[#003178]"
                        : "border-gray-200 bg-white text-gray-900"
                    }
                    ${otpAutoFilling ? "animate-pulse" : ""}
                  `}
                />
              ))}
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={!isOtpComplete || isVerifying}
              className="w-full py-3 bg-[#003178] text-white font-semibold rounded-lg hover:bg-[#003178]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">
                    verified
                  </span>
                  Verify & Continue
                </>
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">
              Dev mode: OTP auto-fills from server
            </p>
            {otpError && (
              <p className="text-center text-xs text-red-500 mt-1 font-medium">
                {otpError}
              </p>
            )}
          </div>
        )}

        {/* Rest of form (after OTP verified) */}
        {data.otpVerified && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            <div className="h-px bg-gray-100 my-2" />

            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={data.fullName}
                onChange={(e) =>
                  onUpdate({ ...data, fullName: e.target.value })
                }
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178] transition-all"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email{" "}
                <span className="text-xs text-gray-400 font-normal">
                  (Optional)
                </span>
              </label>
              <input
                type="email"
                value={data.email}
                onChange={(e) =>
                  onUpdate({ ...data, email: e.target.value })
                }
                placeholder="your@email.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178] transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={data.password}
                  onChange={(e) =>
                    onUpdate({ ...data, password: e.target.value })
                  }
                  placeholder="Min 6 characters"
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              {data.password && data.password.length < 6 && (
                <p className="text-xs text-amber-600 mt-1">
                  Password must be at least 6 characters
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Next Button */}
      {data.otpVerified && (
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full mt-8 py-3.5 rounded-lg text-white font-bold shadow-lg shadow-[#003178]/20 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
          }}
        >
          Continue
          <span className="material-symbols-outlined text-lg">
            arrow_forward
          </span>
        </button>
      )}
    </div>
  );
}
