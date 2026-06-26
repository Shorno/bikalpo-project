"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getDeliverySubdomainUrl } from "@/lib/delivery-routing";
import { client } from "@/utils/orpc";

type AuthStep = "phone" | "otp" | "name" | "done";

interface PhoneAuthFlowProps {
  onComplete: () => void;
}

export function PhoneAuthFlow({ onComplete }: PhoneAuthFlowProps) {
  const [step, setStep] = useState<AuthStep>("phone");
  const [phone, setPhone] = useState("");
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [name, setName] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [otpAutoFilling, setOtpAutoFilling] = useState(false);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const phoneInputRef = useRef<HTMLInputElement | null>(null);

  const fullPhone = `+880${phone.replace(/^0+/, "")}`;

  useEffect(() => {
    if (step === "phone") {
      setTimeout(() => phoneInputRef.current?.focus(), 200);
    }
  }, [step]);

  /* ── Send OTP ── */
  const handleSendOtp = async () => {
    if (!phone || phone.length < 11) return;
    setIsSending(true);
    setError("");

    try {
      await authClient.phoneNumber.sendOtp({ phoneNumber: fullPhone });
      setStep("otp");

      try {
        const result = await client.devOtp.get({ phoneNumber: fullPhone });
        if (result?.code) {
          setOtpAutoFilling(true);
          const digits = result.code.split("");
          digits.forEach((digit: string, index: number) => {
            setTimeout(
              () => {
                setOtpValues((prev) => {
                  const newValues = [...prev];
                  newValues[index] = digit;
                  return newValues;
                });
                if (index === digits.length - 1) {
                  setOtpAutoFilling(false);
                }
              },
              150 * (index + 1) + 600,
            );
          });
        }
      } catch {
        /* manual entry */
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send OTP");
    } finally {
      setIsSending(false);
    }
  };

  /* ── OTP handlers ── */
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newValues = [...otpValues];
    newValues[index] = value;
    setOtpValues(newValues);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  /* ── Verify OTP ── */
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

      const user = result.data?.user as
        | { name?: string; role?: string; warehouseId?: string | null }
        | undefined;

      // Fetch full session to reliably get the user role
      // (verify response may not include custom fields like role)
      let role = user?.role;
      let userName = user?.name;
      let warehouseId = user?.warehouseId;
      if (!role) {
        try {
          const session = await authClient.getSession();
          const sessionUser = session.data?.user as any;
          role = sessionUser?.role;
          warehouseId = sessionUser?.warehouseId;
          if (!userName && sessionUser?.name) userName = sessionUser.name;
        } catch {
          /* fallback */
        }
      }

      // Also try reading role from cookie (server sets it on sign-in hooks)
      if (!role) {
        const roleCookie = document.cookie
          .split("; ")
          .find((c) => c.startsWith("user-role="));
        role = roleCookie?.split("=")[1];
      }

      // Set user-role cookie for proxy routing (client-side fallback)
      if (role) {
        document.cookie = `user-role=${role};path=/;domain=.bikalpo.localhost;max-age=${60 * 60 * 24 * 30}`;
      }

      // Role-based redirect: send non-customer roles to their panels
      if (role && role !== "customer" && role !== "consumer") {
        setStep("done");
        const redirectUrl =
          role === "deliveryman" && warehouseId
            ? `${getDeliverySubdomainUrl()}/dashboard`
            : role === "deliveryman"
              ? "http://bikalpo.localhost:3001/deliveryman/dashboard"
              : role === "warehouse"
                ? "http://warehouse.bikalpo.localhost:3001/dashboard"
                : role === "shop_owner"
                  ? "http://shop.bikalpo.localhost:3001/dashboard"
                  : role === "admin" || role === "salesman"
                    ? "/dashboard"
                    : null;
        if (redirectUrl) {
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1500);
          return;
        }
      }

      if (userName && !userName.startsWith("+")) {
        setStep("done");
        setTimeout(onComplete, 1500);
      } else {
        setIsNewUser(true);
        setStep("name");
      }
    } catch (err: any) {
      setError(err?.message || "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  /* ── Save Name ── */
  const handleSaveName = async () => {
    if (!name.trim()) return;
    setIsSavingName(true);
    try {
      await authClient.updateUser({ name: name.trim() });
      setStep("done");
      setTimeout(onComplete, 1500);
    } catch {
      onComplete();
    } finally {
      setIsSavingName(false);
    }
  };

  const primaryBtnClass =
    "w-full py-3.5 rounded-xl text-white font-bold text-[15px] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] bg-[#1E62C3] hover:bg-[#1a56ad]";
  const primaryBtnStyle = { boxShadow: "0 2px 8px rgba(30, 98, 195, 0.25)" };
  const inputClass =
    "w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-white text-[15px] outline-none focus:border-[#1E62C3] focus:ring-2 focus:ring-[#1E62C3]/10 transition-all placeholder:text-gray-300";

  return (
    <div
      style={{ minHeight: "520px" }}
      className="flex flex-col justify-center"
    >
      {/* ===== STEP: PHONE ===== */}
      {step === "phone" && (
        <div>
          <h2 className="text-2xl md:text-[28px] font-extrabold text-gray-900 tracking-tight mb-1">
            Welcome!
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            Sign in or create an account to continue
          </p>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <div className="flex gap-2">
              <div className="flex items-center px-4 bg-gray-50 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 select-none">
                🇧🇩 +880
              </div>
              <input
                ref={phoneInputRef}
                type="tel"
                inputMode="numeric"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (val.length <= 11) setPhone(val);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendOtp();
                }}
                className={`flex-1 ${inputClass}`}
              />
            </div>
          </div>

          <button
            onClick={handleSendOtp}
            disabled={!phone || phone.length < 11 || isSending}
            className={`${primaryBtnClass} mb-5`}
            style={primaryBtnStyle}
          >
            {isSending ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Sending code...
              </span>
            ) : (
              "Continue"
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Social login buttons */}
          <div className="space-y-3 mb-6">
            <SocialButton icon={<GoogleIcon />} label="Continue with Google" />
            <SocialButton
              icon={<FacebookIcon />}
              label="Continue with Facebook"
            />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            By signing up, you agree to our{" "}
            <span className="text-[#1E62C3] cursor-pointer hover:underline">
              Terms and Conditions
            </span>{" "}
            and{" "}
            <span className="text-[#1E62C3] cursor-pointer hover:underline">
              Privacy Policy
            </span>
            .
          </p>
        </div>
      )}

      {/* ===== STEP: OTP ===== */}
      {step === "otp" && (
        <div>
          <button
            onClick={() => {
              setStep("phone");
              setOtpValues(["", "", "", "", "", ""]);
              setError("");
            }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>

          <h2 className="text-2xl md:text-[28px] font-extrabold text-gray-900 tracking-tight mb-1">
            Verify your number
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            We sent a 6-digit code to{" "}
            <strong className="text-gray-800">+880 {phone}</strong>
          </p>

          <div className="flex justify-start gap-3 mb-6">
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
                className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all ${
                  val
                    ? "border-[#1E62C3] bg-[#1E62C3]/5 text-[#1E62C3]"
                    : "border-gray-200 bg-gray-50 text-gray-400"
                } ${otpAutoFilling ? "animate-pulse" : ""} focus:border-[#1E62C3] focus:ring-2 focus:ring-[#1E62C3]/10`}
              />
            ))}
          </div>

          <button
            onClick={handleVerify}
            disabled={
              otpValues.join("").length !== 6 || isVerifying || otpAutoFilling
            }
            className={`${primaryBtnClass} mb-5`}
            style={primaryBtnStyle}
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Verifying...
              </span>
            ) : (
              "Verify & Continue"
            )}
          </button>

          <p className="text-sm text-gray-400">
            Didn&apos;t receive it?{" "}
            <button
              onClick={() => {
                setOtpValues(["", "", "", "", "", ""]);
                handleSendOtp();
              }}
              className="text-[#1E62C3] font-semibold hover:underline"
            >
              Resend code
            </button>
          </p>
        </div>
      )}

      {/* ===== STEP: NAME ===== */}
      {step === "name" && (
        <div>
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Phone verified
          </div>

          <h2 className="text-2xl md:text-[28px] font-extrabold text-gray-900 tracking-tight mb-1">
            What&apos;s your name?
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            This helps us personalize your experience
          </p>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Full Name
            </label>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
              }}
              // biome-ignore lint/a11y/noAutofocus: Existing auth flow intentionally focuses the name field after OTP verification.
              autoFocus
              className={inputClass}
            />
          </div>

          <button
            onClick={handleSaveName}
            disabled={!name.trim() || isSavingName}
            className={primaryBtnClass}
            style={primaryBtnStyle}
          >
            {isSavingName ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Saving...
              </span>
            ) : (
              "Start Shopping"
            )}
          </button>
        </div>
      )}

      {/* ===== STEP: DONE ===== */}
      {step === "done" && (
        <div className="text-center py-8">
          <div
            className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-full mb-5"
            style={{ animation: "authScaleIn 0.4s ease-out" }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
            {isNewUser ? "Welcome to Bikalpo! 🎉" : "Welcome back!"}
          </h2>
          <p className="text-gray-500 text-sm">Redirecting you now...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-center gap-2 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm font-medium">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}

/* ── Shared small components ── */

function Spinner() {
  return (
    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  );
}

function SocialButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      disabled
      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
