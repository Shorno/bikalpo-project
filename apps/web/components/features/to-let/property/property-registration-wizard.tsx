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
import { useEffect, useRef, useState } from "react";
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
import {
  normalizeBangladeshDistrict,
  normalizeBangladeshDivision,
} from "@/constants/bangladesh-locations";
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
import { client } from "@/utils/orpc";
import { PropertyLocationFields } from "./property-location-fields";
import { PropertyPhoneVerification } from "./property-phone-verification";
import { PropertyPageHeader } from "./property-ui";

const steps = [
  { id: 1, label: "Basic" },
  { id: 2, label: "Property" },
  { id: 3, label: "Verify" },
  { id: 4, label: "Review" },
] as const;

const registrationPropertyTypes = propertyTypes.filter(
  (option) => option.value !== "office",
);

const registrationFacilities = [
  { key: "hasParking", label: "Parking Available" },
  { key: "hasLift", label: "Lift Available" },
  { key: "hasSecurityGuard", label: "Security Guard" },
  { key: "hasCctv", label: "CCTV Camera" },
  { key: "hasGenerator", label: "Generator" },
  { key: "hasWaterSupply", label: "Water Supply" },
  { key: "hasGasConnection", label: "Gas Connection" },
  { key: "hasElectricity", label: "Electricity" },
] as const;

type RegistrationFacilityKey = (typeof registrationFacilities)[number]["key"];

const initialFacilitySelections: Record<
  RegistrationFacilityKey,
  boolean | null
> = {
  hasParking: null,
  hasLift: null,
  hasSecurityGuard: null,
  hasCctv: null,
  hasGenerator: null,
  hasWaterSupply: null,
  hasGasConnection: null,
  hasElectricity: null,
};

const PROPERTY_REGISTRATION_DRAFT_KEY =
  "bikalpo:to-let-property-registration:v1";

const initialValues: PropertyRegistrationValues = {
  name: "",
  coverImageUrl: "",
  ownerName: "",
  mobileNumber: "",
  email: "",
  propertyType: "apartment",
  division: "",
  district: "",
  area: "",
  fullAddress: "",
  nearbyLandmark: "",
  latitude: "",
  longitude: "",
  buildingType: "residential",
  totalFloors: 0,
  declaredTotalUnits: 0,
  hasParking: false,
  hasLift: false,
  hasSecurityGuard: false,
  hasCctv: false,
  hasGenerator: false,
  hasWaterSupply: false,
  hasGasConnection: false,
  hasElectricity: false,
  description: "",
  frontImageUrl: "",
  buildingImageUrl: "",
  phoneVerified: false,
  informationConfirmed: false,
  termsAccepted: false,
  propertyPolicyAccepted: false,
};

function restoreDraftValues(input: unknown): PropertyRegistrationValues | null {
  if (!input || typeof input !== "object") return null;
  const restored = { ...initialValues };
  const candidate = input as Record<string, unknown>;
  for (const key of Object.keys(initialValues) as Array<
    keyof PropertyRegistrationValues
  >) {
    const value = candidate[key];
    if (typeof value === typeof initialValues[key]) {
      Object.assign(restored, { [key]: value });
    }
  }
  if (!restored.propertyType || restored.propertyType === "office") {
    restored.propertyType = "apartment";
  }
  if (!restored.buildingType) restored.buildingType = "residential";
  const normalizedDivision = normalizeBangladeshDivision(restored.division);
  if (normalizedDivision) {
    restored.division = normalizedDivision;
    const normalizedDistrict = normalizeBangladeshDistrict(
      restored.district,
      normalizedDivision,
    );
    if (normalizedDistrict) restored.district = normalizedDistrict;
  }
  return restored;
}

function restoreFacilitySelections(input: unknown) {
  const restored = { ...initialFacilitySelections };
  if (!input || typeof input !== "object") return restored;

  const candidate = input as Record<string, unknown>;
  for (const { key } of registrationFacilities) {
    if (typeof candidate[key] === "boolean") {
      restored[key] = candidate[key];
    }
  }
  return restored;
}

const propertyBasicWithoutCoverSchema = propertyBasicSchema.omit({
  coverImageUrl: true,
});

function schemaForStep(step: number) {
  return step === 1
    ? propertyBasicWithoutCoverSchema
    : step === 2
      ? propertyBuildingSchema
      : step === 3
        ? propertyVerificationSchema
        : propertyReviewSchema;
}

function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

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

function FacilityRadioField({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: boolean | null;
  error?: string;
  onChange: (value: boolean) => void;
}) {
  const fieldName = `property-facility-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <fieldset
      aria-invalid={Boolean(error)}
      className={cn(
        "rounded-lg border px-4 py-3",
        error ? "border-red-300" : "border-gray-200",
      )}
    >
      <legend className="px-1 text-sm font-medium text-gray-900">
        {label}
      </legend>
      <div className="mt-2 flex items-center gap-6 text-sm text-gray-700">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={fieldName}
            checked={value === true}
            onChange={() => onChange(true)}
            className="size-4 accent-emerald-600"
          />
          Yes
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name={fieldName}
            checked={value === false}
            onChange={() => onChange(false)}
            className="size-4 accent-emerald-600"
          />
          No
        </label>
      </div>
      <FieldMessage message={error} />
    </fieldset>
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
  const [facilitySelections, setFacilitySelections] = useState(
    initialFacilitySelections,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [locating, setLocating] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        PROPERTY_REGISTRATION_DRAFT_KEY,
      );
      if (!stored) return;
      const draft = JSON.parse(stored) as {
        values?: unknown;
        facilitySelections?: unknown;
        currentStep?: unknown;
        completedSteps?: unknown;
      };
      const restoredValues = restoreDraftValues(draft.values);
      if (restoredValues) {
        setValues(restoredValues);
        setFacilitySelections(
          restoreFacilitySelections(draft.facilitySelections),
        );
        const restoredStep = Number(draft.currentStep);
        if (restoredStep >= 1 && restoredStep <= 4) {
          setCurrentStep(restoredStep);
        }
        if (Array.isArray(draft.completedSteps)) {
          setCompletedSteps(
            draft.completedSteps.filter(
              (step): step is number =>
                Number.isInteger(step) && step >= 1 && step <= 4,
            ),
          );
        }
        toast.success("Saved property registration restored");
      }
    } catch {
      window.localStorage.removeItem(PROPERTY_REGISTRATION_DRAFT_KEY);
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const changed = (
      Object.keys(initialValues) as Array<keyof PropertyRegistrationValues>
    ).some((key) => values[key] !== initialValues[key]);
    if (!changed && currentStep === 1) {
      window.localStorage.removeItem(PROPERTY_REGISTRATION_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(
      PROPERTY_REGISTRATION_DRAFT_KEY,
      JSON.stringify({
        values,
        facilitySelections,
        currentStep,
        completedSteps,
      }),
    );
  }, [completedSteps, currentStep, draftReady, facilitySelections, values]);

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

  const selectFacility = (key: RegistrationFacilityKey, value: boolean) => {
    setFacilitySelections((current) => ({ ...current, [key]: value }));
    update(key, value);
  };

  const updateFrontImage = (frontImageUrl: string) => {
    setValues((current) => ({ ...current, frontImageUrl }));
    setErrors((current) => {
      if (!current.frontImageUrl) return current;
      const next = { ...current };
      delete next.frontImageUrl;
      return next;
    });
  };

  const errorsForStep = (step: number) => {
    const result = schemaForStep(step).safeParse(values);
    const stepErrors = result.success
      ? {}
      : errorsFromIssues(result.error.issues);

    if (step === 2) {
      for (const { key } of registrationFacilities) {
        if (facilitySelections[key] === null) {
          stepErrors[key] = "Select Yes or No";
        }
      }
    }

    return stepErrors;
  };

  const validateCurrentStep = () => {
    const stepErrors = errorsForStep(currentStep);
    if (Object.keys(stepErrors).length === 0) {
      setErrors({});
      return true;
    }
    setErrors(stepErrors);
    toast.error("Please review the highlighted fields");
    return false;
  };

  const moveToStep = (step: number) => {
    setCurrentStep(step);
    setErrors({});
    window.requestAnimationFrame(() => headingRef.current?.focus());
  };

  const selectStep = (step: number) => {
    if (step <= currentStep || validateCurrentStep()) moveToStep(step);
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
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        if (
          latitude < 20.5 ||
          latitude > 26.7 ||
          longitude < 87.9 ||
          longitude > 92.7
        ) {
          setLocating(false);
          toast.error("The captured location is outside Bangladesh");
          return;
        }

        try {
          const location = await client.barikoi.reverseGeocode({
            latitude,
            longitude,
          });
          setValues((current) => {
            const division = location?.division
              ? normalizeBangladeshDivision(location.division)
              : current.division;
            const district = location?.district
              ? normalizeBangladeshDistrict(location.district, division)
              : current.district;
            return {
              ...current,
              latitude: latitude.toFixed(7),
              longitude: longitude.toFixed(7),
              division: division || current.division,
              district: district || current.district,
              area:
                location?.sub_district ||
                location?.thana ||
                location?.area ||
                current.area,
              fullAddress: current.fullAddress || location?.address || "",
            };
          });
          setErrors((current) => {
            const next = { ...current };
            for (const key of [
              "latitude",
              "longitude",
              "division",
              "district",
              "area",
            ]) {
              delete next[key];
            }
            return next;
          });
          toast.success("GPS location and address captured");
        } catch {
          update("latitude", latitude.toFixed(7));
          update("longitude", longitude.toFixed(7));
          toast.success("GPS coordinates captured");
        } finally {
          setLocating(false);
        }
      },
      (error) => {
        setLocating(false);
        toast.error(error.message || "Could not capture your location");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const submit = async () => {
    for (const step of [1, 2, 3, 4]) {
      const stepErrors = errorsForStep(step);
      if (Object.keys(stepErrors).length > 0) {
        moveToStep(step);
        setErrors(stepErrors);
        toast.error(`Please complete Step ${step} before registering`);
        return;
      }
    }

    const parsed = propertyRegistrationSchema.safeParse({
      ...values,
      coverImageUrl: values.coverImageUrl || values.frontImageUrl,
    });
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
        videoUrl: undefined,
      });
      const propertyCode = resultPropertyCode(result);
      window.localStorage.removeItem(PROPERTY_REGISTRATION_DRAFT_KEY);
      router.push(
        propertyCode
          ? `/account/to-let/properties/${propertyCode}?created=1`
          : "/account/to-let/properties",
      );
    } catch {
      // Mutation hook owns the user-facing error toast.
    }
  };

  const reviewFacilities = registrationFacilities
    .filter(({ key }) => key !== "hasElectricity")
    .map(({ key, label }) => [label, values[key]] as const);
  const availableReviewFacilities = reviewFacilities.filter(
    ([, available]) => available,
  );

  return (
    <div className="space-y-5">
      <PropertyPageHeader
        title="Create Property Management Account"
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
                    onClick={() => accessible && selectStep(step.id)}
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
                ? "Basic Information"
                : currentStep === 2
                  ? "Property Information"
                  : currentStep === 3
                    ? "Verification (Image and Video)"
                    : "Review Registration"}
            </h2>
          </div>

          {currentStep === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="property-name">Property Name *</Label>
                <Input
                  id="property-name"
                  value={values.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Enter Property Name"
                  aria-invalid={Boolean(errors.name)}
                />
                <FieldMessage message={errors.name} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="owner-name">Property Owner *</Label>
                <Input
                  id="owner-name"
                  value={values.ownerName}
                  onChange={(event) => update("ownerName", event.target.value)}
                  placeholder="Enter Owner Name"
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

              <div className="space-y-1.5">
                <Label htmlFor="property-email">Email Address</Label>
                <Input
                  id="property-email"
                  type="email"
                  value={values.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder="example@gmail.com"
                  aria-invalid={Boolean(errors.email)}
                />
                <FieldMessage message={errors.email} />
              </div>
              <div className="space-y-1.5">
                <Label>Property Type *</Label>
                <Select
                  value={values.propertyType}
                  onValueChange={(value) => update("propertyType", value)}
                >
                  <SelectTrigger aria-invalid={Boolean(errors.propertyType)}>
                    <SelectValue placeholder="Apartment" />
                  </SelectTrigger>
                  <SelectContent>
                    {registrationPropertyTypes.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldMessage message={errors.propertyType} />
              </div>

              <div className="sm:col-span-2">
                <PropertyLocationFields
                  division={values.division}
                  district={values.district}
                  area={values.area}
                  errors={errors}
                  onChange={update}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="full-address">Full Address *</Label>
                <Input
                  id="full-address"
                  value={values.fullAddress}
                  onChange={(event) =>
                    update("fullAddress", event.target.value)
                  }
                  placeholder="Enter Full Property Address"
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
                  placeholder="Example: Near Metro Station"
                  aria-invalid={Boolean(errors.nearbyLandmark)}
                />
                <FieldMessage message={errors.nearbyLandmark} />
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:col-span-2">
                <p className="text-sm font-medium text-gray-900">
                  Google Map Location
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={captureGps}
                  disabled={locating}
                  className="mt-3"
                >
                  {locating ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <LocateFixed />
                  )}
                  Capture GPS Location
                </Button>
                {values.latitude && values.longitude ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    GPS location captured
                  </p>
                ) : null}
                <FieldMessage message={errors.latitude ?? errors.longitude} />
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Building Type *</Label>
                  <Select
                    value={values.buildingType}
                    onValueChange={(value) => update("buildingType", value)}
                  >
                    <SelectTrigger aria-invalid={Boolean(errors.buildingType)}>
                      <SelectValue placeholder="Residential" />
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
                  <Label>Property Status *</Label>
                  <Select defaultValue="active">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="total-floors">Total Floors *</Label>
                  <Input
                    id="total-floors"
                    type="number"
                    min={1}
                    value={values.totalFloors || ""}
                    placeholder="05"
                    onChange={(event) =>
                      update("totalFloors", Number(event.target.value))
                    }
                    aria-invalid={Boolean(errors.totalFloors)}
                  />
                  <FieldMessage message={errors.totalFloors} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="declared-units">Total Units *</Label>
                  <Input
                    id="declared-units"
                    type="number"
                    min={1}
                    value={values.declaredTotalUnits || ""}
                    placeholder="20"
                    onChange={(event) =>
                      update("declaredTotalUnits", Number(event.target.value))
                    }
                    aria-invalid={Boolean(errors.declaredTotalUnits)}
                  />
                  <FieldMessage message={errors.declaredTotalUnits} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {registrationFacilities.map(({ key, label }) => (
                  <FacilityRadioField
                    key={key}
                    label={label}
                    value={facilitySelections[key]}
                    error={errors[key]}
                    onChange={(value) => selectFacility(key, value)}
                  />
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="property-description">
                  Property Description
                </Label>
                <Textarea
                  id="property-description"
                  value={values.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  placeholder="Optional description about this property"
                  rows={5}
                  aria-label="Property description"
                />
                <FieldMessage message={errors.description} />
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="space-y-6">
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
                  <Label>Building Photo</Label>
                  <ImageUploader
                    value={values.buildingImageUrl}
                    onChange={(url) => update("buildingImageUrl", url)}
                    folder="to-let/properties"
                    className="min-h-44"
                  />
                  <FieldMessage message={errors.buildingImageUrl} />
                </div>
              </div>

              <Section title="Phone Verification">
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
                    [
                      "Property Type",
                      optionLabel(propertyTypes, values.propertyType),
                    ],
                    ["Owner", values.ownerName],
                    [
                      "Location",
                      `${values.area}, ${values.district}, ${values.division}`,
                    ],
                    [
                      "Building Type",
                      optionLabel(buildingTypes, values.buildingType),
                    ],
                    ["Total Floors", String(values.totalFloors)],
                    ["Total Units", String(values.declaredTotalUnits)],
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

              <Section title="Facilities">
                {availableReviewFacilities.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableReviewFacilities.map(([label]) => (
                      <div
                        key={label}
                        className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                      >
                        <span className="flex size-5 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-white">
                          <Check className="size-3" />
                        </span>
                        {label}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No facilities selected.
                  </p>
                )}
              </Section>

              <Section title="Verification">
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    ["Property Photo Submitted", Boolean(values.frontImageUrl)],
                    ["OTP Verified", values.phoneVerified],
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
                            : "border-gray-300 bg-white text-transparent",
                        )}
                      >
                        <Check className="size-3" />
                      </span>
                      {label}
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Registration status">
                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                    <Check className="size-4" />
                  </span>
                  <div>
                    <p className="font-semibold">
                      Ready To Create Property Account
                    </p>
                    <p className="mt-0.5 text-sm text-emerald-700">
                      Review the confirmations below, then register the
                      property.
                    </p>
                  </div>
                </div>
              </Section>

              <Section title="Confirm registration">
                <div className="space-y-3">
                  {[
                    {
                      key: "informationConfirmed" as const,
                      label: "I confirm all information is correct",
                    },
                    {
                      key: "termsAccepted" as const,
                      label: "I agree to Property Terms & Conditions",
                    },
                    {
                      key: "propertyPolicyAccepted" as const,
                      label: "I agree to Bikalpo Property Policy",
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
                    Save &amp; Continue <ArrowRight />
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
