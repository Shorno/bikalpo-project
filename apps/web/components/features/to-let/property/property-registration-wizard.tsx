"use client";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Loader2,
  LocateFixed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateToLetProperty } from "@/hooks/use-to-let-property-api";
import { cn } from "@/lib/utils";
import {
  buildingTypes,
  type PropertyRegistrationValues,
  propertyBasicSchema,
  propertyBuildingSchema,
  propertyRegistrationSchema,
  propertyReviewSchema,
  propertyTypes,
  propertyVerificationSchema,
} from "@/schema/to-let-property.schema";
import { IncludedExcludedButtons } from "./included-excluded-buttons";
import { PropertyPhoneVerification } from "./property-phone-verification";
import { PropertyPageHeader } from "./property-ui";

const steps = [
  { id: 1, label: "Basic" },
  { id: 2, label: "Property" },
  { id: 3, label: "Verify" },
  { id: 4, label: "Review" },
] as const;

const initialValues: PropertyRegistrationValues = {
  name: "",
  coverImageUrl: "",
  ownerName: "",
  mobileNumber: "",
  email: "",
  propertyType: "",
  division: "",
  district: "",
  area: "",
  fullAddress: "",
  nearbyLandmark: "",
  latitude: "",
  longitude: "",
  buildingType: "",
  totalFloors: 1,
  declaredTotalUnits: 1,
  hasParking: false,
  hasLift: false,
  hasSecurityGuard: false,
  hasCctv: false,
  hasGenerator: false,
  hasWaterSupply: true,
  hasGasConnection: false,
  hasElectricity: true,
  description: "",
  frontImageUrl: "",
  buildingImageUrl: "",
  videoUrl: "",
  phoneVerified: false,
  informationConfirmed: false,
  termsAccepted: false,
  propertyPolicyAccepted: false,
};

const propertyBasicWithoutCoverSchema = propertyBasicSchema.omit({
  coverImageUrl: true,
});

type FieldErrors = Record<string, string>;

function errorsFromIssues(
  issues: Array<{ path: PropertyKey[]; message: string }>,
) {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function FieldMessage({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  ) : null;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-gray-100 pb-6 last:border-0 last:pb-0">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
      <span>{label}</span>
      <IncludedExcludedButtons
        label={label}
        included={checked}
        onChange={onChange}
      />
    </div>
  );
}

function resultPropertyCode(result: unknown) {
  if (!result || typeof result !== "object") return null;
  if (
    "propertyCode" in result &&
    typeof (result as { propertyCode?: unknown }).propertyCode === "string"
  ) {
    return (result as { propertyCode: string }).propertyCode;
  }
  if ("property" in result) {
    const property = (result as { property?: unknown }).property;
    if (
      property &&
      typeof property === "object" &&
      "propertyCode" in property &&
      typeof (property as { propertyCode?: unknown }).propertyCode === "string"
    ) {
      return (property as { propertyCode: string }).propertyCode;
    }
  }
  return null;
}

export function PropertyRegistrationWizard() {
  const router = useRouter();
  const createProperty = useCreateToLetProperty();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [values, setValues] =
    useState<PropertyRegistrationValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [locating, setLocating] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const update = <K extends keyof PropertyRegistrationValues>(
    key: K,
    value: PropertyRegistrationValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updatePhone = (mobileNumber: string) => {
    setValues((current) => ({
      ...current,
      mobileNumber,
      phoneVerified:
        mobileNumber === current.mobileNumber ? current.phoneVerified : false,
    }));
  };

  const updateFrontImage = (frontImageUrl: string) => {
    setValues((current) => ({
      ...current,
      frontImageUrl,
      coverImageUrl: frontImageUrl,
    }));
    setErrors((current) => {
      if (!current.frontImageUrl && !current.coverImageUrl) return current;
      const next = { ...current };
      delete next.frontImageUrl;
      delete next.coverImageUrl;
      return next;
    });
  };

  const schemaForStep =
    currentStep === 1
      ? propertyBasicWithoutCoverSchema
      : currentStep === 2
        ? propertyBuildingSchema
        : currentStep === 3
          ? propertyVerificationSchema
          : propertyReviewSchema;

  const validateCurrentStep = () => {
    const result = schemaForStep.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    setErrors(errorsFromIssues(result.error.issues));
    toast.error("Please review the highlighted fields");
    return false;
  };

  const moveToStep = (step: number) => {
    setCurrentStep(step);
    setErrors({});
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const next = () => {
    if (!validateCurrentStep()) return;
    setCompletedSteps((current) =>
      current.includes(currentStep) ? current : [...current, currentStep],
    );
    moveToStep(Math.min(4, currentStep + 1));
  };

  const captureGps = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location capture is not supported by this browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update("latitude", position.coords.latitude.toFixed(7));
        update("longitude", position.coords.longitude.toFixed(7));
        setLocating(false);
        toast.success("GPS coordinates captured");
      },
      (error) => {
        setLocating(false);
        toast.error(error.message || "Could not capture your location");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const submit = async () => {
    const parsed = propertyRegistrationSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(errorsFromIssues(parsed.error.issues));
      toast.error("Please complete all registration requirements");
      return;
    }

    const { phoneVerified: _phoneVerified, ...payload } = parsed.data;
    try {
      const result = await createProperty.mutateAsync({
        ...payload,
        email: payload.email || undefined,
        nearbyLandmark: payload.nearbyLandmark || undefined,
        latitude: payload.latitude ? Number(payload.latitude) : undefined,
        longitude: payload.longitude ? Number(payload.longitude) : undefined,
        description: payload.description || undefined,
        buildingImageUrl: payload.buildingImageUrl || undefined,
        videoUrl: payload.videoUrl || undefined,
      });
      const propertyCode = resultPropertyCode(result);
      router.push(
        propertyCode
          ? `/account/to-let/properties/${propertyCode}?created=1`
          : "/account/to-let/properties",
      );
    } catch {
      // Mutation hook owns the user-facing error toast.
    }
  };

  return (
    <div className="space-y-5">
      <PropertyPageHeader
        title="Register Property"
        description="Create a permanent property identity and then add reusable units."
        backHref="/account/to-let/properties"
      />

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <nav
          aria-label="Property registration progress"
          className="border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6"
        >
          <ol className="flex items-center">
            {steps.map((step, index) => {
              const completed = completedSteps.includes(step.id);
              const active = currentStep === step.id;
              const accessible = completed || step.id <= currentStep;
              return (
                <li key={step.id} className="flex flex-1 items-center">
                  <button
                    type="button"
                    onClick={() => accessible && moveToStep(step.id)}
                    disabled={!accessible}
                    aria-current={active ? "step" : undefined}
                    className="flex min-w-0 flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                  >
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                        completed
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : active
                            ? "border-emerald-600 bg-white text-emerald-700 ring-4 ring-emerald-50"
                            : "border-gray-300 bg-white text-gray-400",
                      )}
                    >
                      {completed ? <Check className="size-4" /> : step.id}
                    </span>
                    <span
                      className={cn(
                        "hidden truncate text-xs font-medium sm:block",
                        active ? "text-emerald-700" : "text-gray-500",
                      )}
                    >
                      {step.label}
                    </span>
                  </button>
                  {index < steps.length - 1 ? (
                    <span
                      className={cn(
                        "mx-2 h-px flex-1 sm:mx-4",
                        completed ? "bg-emerald-500" : "bg-gray-200",
                      )}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="p-5 sm:p-7">
          <div className="mb-6 border-b border-gray-100 pb-5">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
              Step {currentStep} of 4
            </p>
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 text-lg font-semibold text-gray-900 outline-none"
            >
              {currentStep === 1
                ? "Basic information"
                : currentStep === 2
                  ? "Property information"
                  : currentStep === 3
                    ? "Verification"
                    : "Review registration"}
            </h2>
          </div>

          {currentStep === 1 ? (
            <div className="space-y-6">
              <Section
                title="Property identity"
                description="Add the property name and type."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="property-name">Property Name *</Label>
                    <Input
                      id="property-name"
                      value={values.name}
                      onChange={(event) => update("name", event.target.value)}
                      placeholder="e.g. Noor Villa"
                      aria-invalid={Boolean(errors.name)}
                    />
                    <FieldMessage message={errors.name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Property Type *</Label>
                    <Select
                      value={values.propertyType}
                      onValueChange={(value) => update("propertyType", value)}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.propertyType)}
                      >
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyTypes.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldMessage message={errors.propertyType} />
                  </div>
                </div>
              </Section>

              <Section title="Owner contact">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="owner-name">Property Owner *</Label>
                    <Input
                      id="owner-name"
                      value={values.ownerName}
                      onChange={(event) =>
                        update("ownerName", event.target.value)
                      }
                      placeholder="Owner full name"
                      aria-invalid={Boolean(errors.ownerName)}
                    />
                    <FieldMessage message={errors.ownerName} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mobile-number">Mobile Number *</Label>
                    <Input
                      id="mobile-number"
                      value={values.mobileNumber}
                      onChange={(event) => updatePhone(event.target.value)}
                      placeholder="01XXXXXXXXX"
                      inputMode="tel"
                      aria-invalid={Boolean(errors.mobileNumber)}
                    />
                    <FieldMessage message={errors.mobileNumber} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="property-email">Email Address</Label>
                    <Input
                      id="property-email"
                      type="email"
                      value={values.email}
                      onChange={(event) => update("email", event.target.value)}
                      placeholder="owner@example.com"
                      aria-invalid={Boolean(errors.email)}
                    />
                    <FieldMessage message={errors.email} />
                  </div>
                </div>
              </Section>

              <Section
                title="Property location"
                description="Enter administrative areas manually; GPS is optional."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="division">Division *</Label>
                    <Input
                      id="division"
                      value={values.division}
                      onChange={(event) =>
                        update("division", event.target.value)
                      }
                      placeholder="Dhaka"
                      aria-invalid={Boolean(errors.division)}
                    />
                    <FieldMessage message={errors.division} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="district">District *</Label>
                    <Input
                      id="district"
                      value={values.district}
                      onChange={(event) =>
                        update("district", event.target.value)
                      }
                      placeholder="Dhaka"
                      aria-invalid={Boolean(errors.district)}
                    />
                    <FieldMessage message={errors.district} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="area">Area / Upazila *</Label>
                    <Input
                      id="area"
                      value={values.area}
                      onChange={(event) => update("area", event.target.value)}
                      placeholder="Mohammadpur"
                      aria-invalid={Boolean(errors.area)}
                    />
                    <FieldMessage message={errors.area} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="full-address">Full Address *</Label>
                    <Textarea
                      id="full-address"
                      value={values.fullAddress}
                      onChange={(event) =>
                        update("fullAddress", event.target.value)
                      }
                      placeholder="House, road, block and neighborhood"
                      rows={3}
                      aria-invalid={Boolean(errors.fullAddress)}
                    />
                    <FieldMessage message={errors.fullAddress} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="landmark">Nearby Landmark</Label>
                    <Input
                      id="landmark"
                      value={values.nearbyLandmark}
                      onChange={(event) =>
                        update("nearbyLandmark", event.target.value)
                      }
                      placeholder="e.g. Near the bus stand"
                    />
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          GPS coordinates
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Optional. Allow browser location access while at the
                          property.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={captureGps}
                        disabled={locating}
                      >
                        {locating ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <LocateFixed />
                        )}
                        Capture GPS
                      </Button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Input
                        value={values.latitude}
                        onChange={(event) =>
                          update("latitude", event.target.value)
                        }
                        placeholder="Latitude"
                        inputMode="decimal"
                        aria-label="Latitude"
                      />
                      <Input
                        value={values.longitude}
                        onChange={(event) =>
                          update("longitude", event.target.value)
                        }
                        placeholder="Longitude"
                        inputMode="decimal"
                        aria-label="Longitude"
                      />
                    </div>
                  </div>
                </div>
              </Section>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-6">
              <Section title="Building details">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Building Type *</Label>
                    <Select
                      value={values.buildingType}
                      onValueChange={(value) => update("buildingType", value)}
                    >
                      <SelectTrigger
                        aria-invalid={Boolean(errors.buildingType)}
                      >
                        <SelectValue placeholder="Select building type" />
                      </SelectTrigger>
                      <SelectContent>
                        {buildingTypes.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldMessage message={errors.buildingType} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="total-floors">Total Floors *</Label>
                    <Input
                      id="total-floors"
                      type="number"
                      min={1}
                      value={values.totalFloors}
                      onChange={(event) =>
                        update("totalFloors", Number(event.target.value))
                      }
                      aria-invalid={Boolean(errors.totalFloors)}
                    />
                    <FieldMessage message={errors.totalFloors} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="declared-units">
                      Planned Total Units *
                    </Label>
                    <Input
                      id="declared-units"
                      type="number"
                      min={1}
                      value={values.declaredTotalUnits}
                      onChange={(event) =>
                        update("declaredTotalUnits", Number(event.target.value))
                      }
                      aria-invalid={Boolean(errors.declaredTotalUnits)}
                    />
                    <p className="text-xs text-gray-500">
                      This is capacity only. Created Unit records are counted
                      separately.
                    </p>
                    <FieldMessage message={errors.declaredTotalUnits} />
                  </div>
                </div>
              </Section>

              <Section
                title="Property facilities"
                description="Select building-level facilities available to units."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <ToggleField
                    label="Parking available"
                    checked={values.hasParking}
                    onChange={(value) => update("hasParking", value)}
                  />
                  <ToggleField
                    label="Lift available"
                    checked={values.hasLift}
                    onChange={(value) => update("hasLift", value)}
                  />
                  <ToggleField
                    label="Security guard"
                    checked={values.hasSecurityGuard}
                    onChange={(value) => update("hasSecurityGuard", value)}
                  />
                  <ToggleField
                    label="CCTV camera"
                    checked={values.hasCctv}
                    onChange={(value) => update("hasCctv", value)}
                  />
                  <ToggleField
                    label="Generator"
                    checked={values.hasGenerator}
                    onChange={(value) => update("hasGenerator", value)}
                  />
                  <ToggleField
                    label="Water supply"
                    checked={values.hasWaterSupply}
                    onChange={(value) => update("hasWaterSupply", value)}
                  />
                  <ToggleField
                    label="Gas connection"
                    checked={values.hasGasConnection}
                    onChange={(value) => update("hasGasConnection", value)}
                  />
                  <ToggleField
                    label="Electricity"
                    checked={values.hasElectricity}
                    onChange={(value) => update("hasElectricity", value)}
                  />
                </div>
              </Section>

              <Section title="Description">
                <Textarea
                  value={values.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  placeholder="Optional description about this property"
                  rows={5}
                  aria-label="Property description"
                />
                <FieldMessage message={errors.description} />
              </Section>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-6">
              <Section
                title="Verification media"
                description="Photos must be JPG, PNG or WebP. Video upload is not enabled yet."
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Property Front Image *</Label>
                    <ImageUploader
                      value={values.frontImageUrl}
                      onChange={updateFrontImage}
                      folder="to-let/properties"
                      className="min-h-44"
                    />
                    <FieldMessage
                      message={errors.frontImageUrl ?? errors.coverImageUrl}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Additional Building Image</Label>
                    <ImageUploader
                      value={values.buildingImageUrl}
                      onChange={(url) => update("buildingImageUrl", url)}
                      folder="to-let/properties"
                      className="min-h-44"
                    />
                    <FieldMessage message={errors.buildingImageUrl} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="video-url">
                      Building Video URL (optional)
                    </Label>
                    <Input
                      id="video-url"
                      type="url"
                      value={values.videoUrl}
                      onChange={(event) =>
                        update("videoUrl", event.target.value)
                      }
                      placeholder="https://... (up to 90 seconds recommended)"
                      aria-invalid={Boolean(errors.videoUrl)}
                    />
                    <p className="text-xs text-gray-500">
                      Paste a public video URL. Direct video upload will be
                      added in a later media upgrade.
                    </p>
                    <FieldMessage message={errors.videoUrl} />
                  </div>
                </div>
              </Section>

              <Section title="Phone verification">
                <PropertyPhoneVerification
                  phone={values.mobileNumber}
                  verified={values.phoneVerified}
                  onVerified={() => update("phoneVerified", true)}
                />
                <FieldMessage message={errors.phoneVerified} />
              </Section>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="space-y-6">
              <Section title="Property information">
                <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-4">
                  {[
                    ["Property Name", values.name],
                    ["Property Type", values.propertyType],
                    ["Owner", values.ownerName],
                    ["Mobile", values.mobileNumber],
                    ["Location", `${values.area}, ${values.district}`],
                    ["Building Type", values.buildingType],
                    ["Total Floors", String(values.totalFloors)],
                    ["Planned Units", String(values.declaredTotalUnits)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="grid gap-1 py-3 text-sm sm:grid-cols-[11rem_1fr]"
                    >
                      <dt className="text-gray-500">{label}</dt>
                      <dd className="font-medium text-gray-900">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Section>

              <Section title="Facilities and verification">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["Parking", values.hasParking],
                    ["Lift", values.hasLift],
                    ["Security guard", values.hasSecurityGuard],
                    ["CCTV", values.hasCctv],
                    ["Generator", values.hasGenerator],
                    ["Water supply", values.hasWaterSupply],
                    ["Gas connection", values.hasGasConnection],
                    ["Electricity", values.hasElectricity],
                    ["Front image submitted", Boolean(values.frontImageUrl)],
                    ["Phone verified", values.phoneVerified],
                  ].map(([label, done]) => (
                    <div
                      key={String(label)}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border",
                          done
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-gray-300 text-transparent",
                        )}
                      >
                        <Check className="size-3" />
                      </span>
                      {label}
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Confirm registration">
                <div className="space-y-3">
                  {[
                    {
                      key: "informationConfirmed" as const,
                      label: "I confirm all property information is correct.",
                    },
                    {
                      key: "termsAccepted" as const,
                      label: "I agree to the Property Terms & Conditions.",
                    },
                    {
                      key: "propertyPolicyAccepted" as const,
                      label: "I agree to the Bikalpo Property Policy.",
                    },
                  ].map((item) => (
                    <div key={item.key}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                        <Checkbox
                          checked={values[item.key]}
                          onCheckedChange={(checked) =>
                            update(item.key, checked === true)
                          }
                          className="mt-0.5"
                        />
                        <span>{item.label}</span>
                      </label>
                      <FieldMessage message={errors[item.key]} />
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          ) : null}

          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-7 border-t border-gray-200 bg-white px-5 py-4 sm:static sm:mx-0 sm:mb-0 sm:px-0 sm:pb-0">
            <div className="flex gap-3">
              {currentStep > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => moveToStep(currentStep - 1)}
                  disabled={createProperty.isPending}
                >
                  <ArrowLeft />
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                size="lg"
                onClick={currentStep === 4 ? submit : next}
                disabled={createProperty.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                {createProperty.isPending ? (
                  <>
                    <Loader2 className="animate-spin" /> Registering...
                  </>
                ) : currentStep === 4 ? (
                  <>
                    <Building2 /> Register Property
                  </>
                ) : (
                  <>
                    Continue <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
