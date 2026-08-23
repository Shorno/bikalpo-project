"use client";



import { Check, Eye, EyeOff, ImagePlus, Loader2 } from "lucide-react";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";

import { Field, FieldGroup } from "@/components/ui/field";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { authClient } from "@/lib/auth-client";

import { GENDERS } from "@/constants/seller-registration";

import type { LocationData } from "@/constants/seller-registration";

import { client } from "@/utils/orpc";

import { cn } from "@/lib/utils";

import {

  RegistrationActions,

  RegistrationFieldLabel,

  RegistrationSection,

} from "./registration-primitives";

import {

  LocationPickerSection,

  isLocationComplete,

} from "./location-picker-section";



export interface StepBasicInfoData {

  phone: string;

  fullName: string;

  email: string;

  password: string;

  otpVerified: boolean;

  profilePhoto: File | null;

  profilePhotoPreview: string;

  dateOfBirth: string;

  gender: string;

  personalLocation: LocationData;

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

  const photoInputRef = useRef<HTMLInputElement>(null);



  const fullPhone = `+880${data.phone.replace(/^0+/, "")}`;



  useEffect(() => {

    return () => {

      if (data.profilePhotoPreview) {

        URL.revokeObjectURL(data.profilePhotoPreview);

      }

    };

  }, [data.profilePhotoPreview]);



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

      const message = err instanceof Error ? err.message : "Verification failed";

      setOtpError(message);

      setIsVerifying(false);

    }

  };



  const handlePhotoSelect = (file: File) => {

    if (data.profilePhotoPreview) {

      URL.revokeObjectURL(data.profilePhotoPreview);

    }

    onUpdate({

      ...data,

      profilePhoto: file,

      profilePhotoPreview: URL.createObjectURL(file),

    });

  };



  const isOtpComplete = otpValues.every((v) => v !== "");

  const canProceed =

    data.otpVerified &&

    data.fullName &&

    data.password.length >= 6 &&

    isLocationComplete(data.personalLocation);



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

                    !data.phone || data.phone.length < 11 || otpAutoFilling || isSending

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

                <p className="text-center text-xs font-medium text-destructive" aria-live="polite">

                  {otpError}

                </p>

              )}

            </Field>

          )}

        </FieldGroup>

      </RegistrationSection>



      {data.otpVerified && (

        <>

          <RegistrationSection title="Profile" description="Your name and contact details.">
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

              <Field>
                <RegistrationFieldLabel optional htmlFor="dob">
                  Date of birth
                </RegistrationFieldLabel>
                <DatePicker
                  id="dob"
                  value={data.dateOfBirth}
                  onChange={(dateOfBirth) =>
                    onUpdate({ ...data, dateOfBirth })
                  }
                  placeholder="Select date of birth"
                  disableFuture
                />
              </Field>

              <Field>
                <RegistrationFieldLabel optional htmlFor="profile-photo">
                  Profile photo
                </RegistrationFieldLabel>
                <input
                  ref={photoInputRef}
                  id="profile-photo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoSelect(file);
                  }}
                />
                <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-background px-2">
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40"
                  >
                    {data.profilePhotoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={data.profilePhotoPreview}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {data.profilePhoto?.name || "Optional — JPG or PNG"}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 px-2.5 text-xs"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    Browse
                  </Button>
                </div>
              </Field>

              <Field className="sm:col-span-2">
                <RegistrationFieldLabel optional>Gender</RegistrationFieldLabel>
                <RadioGroup
                  value={data.gender}
                  onValueChange={(value) => onUpdate({ ...data, gender: value })}
                  className="flex flex-wrap gap-x-6 gap-y-2"
                >
                  {GENDERS.map((g) => (
                    <div key={g.id} className="flex items-center gap-2">
                      <RadioGroupItem value={g.id} id={`gender-${g.id}`} />
                      <Label htmlFor={`gender-${g.id}`} className="font-normal">
                        {g.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
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



          <RegistrationSection

            title="Personal location"

            description="Search your address or drop a pin on the map."

          >

            <LocationPickerSection

              label="Personal address"

              data={data.personalLocation}

              onUpdate={(personalLocation) =>

                onUpdate({ ...data, personalLocation })

              }

            />

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

