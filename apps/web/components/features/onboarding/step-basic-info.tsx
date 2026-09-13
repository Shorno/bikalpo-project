"use client";

import { Check, Eye, EyeOff, Loader2 } from "lucide-react";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";

import { Input } from "@/components/ui/input";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { client } from "@/utils/orpc";

import {
  RegistrationActions,
  RegistrationFieldLabel,
  RegistrationSection,
} from "./registration-primitives";

export interface StepBasicInfoData {
  phone: string;

  fullName: string;

  email: string;

  password: string;

  otpVerified: boolean;
}

interface StepBasicInfoProps {
  data: StepBasicInfoData;

  onUpdate: (data: StepBasicInfoData) => void;

  onNext: () => void;
}

export function StepBasicInfo({ data, onUpdate, onNext }: StepBasicInfoProps) {
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
      await authClient.phoneNumber.sendOtp({ phoneNumber: fullPhone });

      setOtpSent(true);

      setOtpAutoFilling(true);

      try {
        const result = await client.devOtp.get({ phoneNumber: fullPhone });

        if (result?.code) {
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
              200 * (index + 1) + 1000,
            );
          });
        } else {
          setOtpAutoFilling(false);
        }
      } catch {
        setOtpAutoFilling(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send OTP";

      setOtpError(message);

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

    e: React.KeyboardEvent<HTMLInputElement>,
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
      const result = await authClient.phoneNumber.verify({
        phoneNumber: fullPhone,

        code: enteredOtp,
      });

      if (result.error) {
        setOtpError(
          result.error.message ||
            "Unable to verify OTP. Please request a new code and try again.",
        );

        setIsVerifying(false);

        return;
      }

      onUpdate({ ...data, otpVerified: true });

      setIsVerifying(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Verification failed";

      setOtpError(message);

      setIsVerifying(false);
    }
  };

  const isOtpComplete = otpValues.every((v) => v !== "");

  const canProceed =
    data.otpVerified && data.fullName && data.password.length >= 6;

  return (
    <div className="w-full">
      <RegistrationSection
        title="Account verification"
        description="We will send a one-time code to verify your mobile number."
      >
        <FieldGroup>
          <Field>
            <RegistrationFieldLabel required htmlFor="phone">
              Mobile number
            </RegistrationFieldLabel>

            <div className="flex gap-2">
              <div className="flex h-9 items-center rounded-lg border border-input bg-muted px-3 text-sm font-medium text-muted-foreground">
                +880
              </div>

              <Input
                id="phone"
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
                className="h-9 flex-1"
                disabled={data.otpVerified}
              />

              {!data.otpVerified && (
                <Button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={
                    !data.phone ||
                    data.phone.length < 11 ||
                    otpAutoFilling ||
                    isSending
                  }
                  className="min-h-9 shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : otpSent ? (
                    "Resend"
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              )}
            </div>

            {data.otpVerified && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Check className="h-3.5 w-3.5" />
                Phone verified
              </p>
            )}
          </Field>

          {otpSent && !data.otpVerified && (
            <Field>
              <RegistrationFieldLabel>Enter OTP code</RegistrationFieldLabel>

              <div className="flex justify-center gap-2 sm:gap-3">
                {otpValues.map((value, index) => (
                  <Input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    aria-label={`OTP digit ${index + 1}`}
                    className={cn(
                      "h-11 w-10 text-center font-mono text-lg sm:h-12 sm:w-12",

                      otpAutoFilling && "animate-pulse",
                    )}
                  />
                ))}
              </div>

              <Button
                type="button"
                onClick={handleVerifyOtp}
                disabled={!isOtpComplete || isVerifying}
                className="w-full min-h-11"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify phone"
                )}
              </Button>

              {otpError && (
                <p
                  className="text-center text-xs font-medium text-destructive"
                  aria-live="polite"
                >
                  {otpError}
                </p>
              )}
            </Field>
          )}
        </FieldGroup>
      </RegistrationSection>

      {data.otpVerified && (
        <>
          <RegistrationSection
            title="Account details"
            description="Set the name, email, and password for your account."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <RegistrationFieldLabel required htmlFor="fullName">
                  Full name
                </RegistrationFieldLabel>
                <Input
                  id="fullName"
                  type="text"
                  value={data.fullName}
                  onChange={(e) =>
                    onUpdate({ ...data, fullName: e.target.value })
                  }
                  placeholder="Enter full name"
                  className="h-9 w-full"
                />
              </Field>

              <Field>
                <RegistrationFieldLabel optional htmlFor="email">
                  Email address
                </RegistrationFieldLabel>
                <Input
                  id="email"
                  type="email"
                  value={data.email}
                  onChange={(e) => onUpdate({ ...data, email: e.target.value })}
                  placeholder="example@gmail.com"
                  className="h-9 w-full"
                />
              </Field>

              <Field className="sm:col-span-2">
                <RegistrationFieldLabel required htmlFor="password">
                  Password
                </RegistrationFieldLabel>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={data.password}
                    onChange={(e) =>
                      onUpdate({ ...data, password: e.target.value })
                    }
                    placeholder="Min 6 characters"
                    className="h-9 w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
            </div>
          </RegistrationSection>

          <RegistrationActions
            showBack={false}
            onPrimary={onNext}
            primaryLabel="Continue"
            primaryDisabled={!canProceed}
          />
        </>
      )}
    </div>
  );
}
