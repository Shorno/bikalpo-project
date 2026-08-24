"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
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
  useMyToLetProperty,
  useUpdateToLetProperty,
} from "@/hooks/use-to-let-property-api";
import {
  buildingTypes,
  type PropertyEditableValues,
  propertyEditableSchema,
  propertyTypes,
} from "@/schema/to-let-property.schema";
import { IncludedExcludedButtons } from "./included-excluded-buttons";
import { propertyFromResponse } from "./property-details-client";
import { PropertyPhoneVerification } from "./property-phone-verification";
import {
  PropertyDetailsSkeleton,
  PropertyErrorState,
  PropertyPageHeader,
} from "./property-ui";
import { PropertyVideoField } from "./property-video-field";
import type { ToLetPropertyView } from "./types";

type Errors = Record<string, string>;

function initialEditValues(
  property: ToLetPropertyView,
): PropertyEditableValues {
  return {
    name: property.name,
    coverImageUrl: property.coverImageUrl,
    ownerName: property.ownerName,
    mobileNumber: property.mobileNumber,
    email: property.email ?? "",
    propertyType: property.propertyType,
    division: property.division,
    district: property.district,
    area: property.area,
    fullAddress: property.fullAddress,
    nearbyLandmark: property.nearbyLandmark ?? "",
    latitude: property.latitude ?? "",
    longitude: property.longitude ?? "",
    buildingType: property.buildingType,
    totalFloors: property.totalFloors,
    declaredTotalUnits: property.declaredTotalUnits,
    hasParking: property.hasParking,
    hasLift: property.hasLift,
    hasSecurityGuard: property.hasSecurityGuard,
    hasCctv: property.hasCctv,
    hasGenerator: property.hasGenerator,
    hasWaterSupply: property.hasWaterSupply,
    hasGasConnection: property.hasGasConnection,
    hasElectricity: property.hasElectricity,
    description: property.description ?? "",
    frontImageUrl: property.frontImageUrl,
    buildingImageUrl: property.buildingImageUrl ?? "",
    videoUrl: property.videoUrl ?? "",
    phoneVerified: true,
  };
}

function EditFieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  ) : null;
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EditToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm">
      {label}
      <IncludedExcludedButtons
        label={label}
        included={checked}
        onChange={onChange}
      />
    </div>
  );
}

function LoadedPropertyEditForm({ property }: { property: ToLetPropertyView }) {
  const router = useRouter();
  const mutation = useUpdateToLetProperty();
  const [values, setValues] = useState(() => initialEditValues(property));
  const [verifiedPhone, setVerifiedPhone] = useState(property.mobileNumber);
  const [errors, setErrors] = useState<Errors>({});

  const update = <K extends keyof PropertyEditableValues>(
    key: K,
    value: PropertyEditableValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const onPhoneChange = (mobileNumber: string) => {
    setValues((current) => ({
      ...current,
      mobileNumber,
      phoneVerified: mobileNumber === verifiedPhone,
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = propertyEditableSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      toast.error("Please review the highlighted fields");
      return;
    }

    const formData = parsed.data;
    try {
      await mutation.mutateAsync({
        propertyCode: property.propertyCode,
        data: {
          ...formData,
          email: formData.email || undefined,
          nearbyLandmark: formData.nearbyLandmark || undefined,
          latitude: formData.latitude ? Number(formData.latitude) : undefined,
          longitude: formData.longitude
            ? Number(formData.longitude)
            : undefined,
          description: formData.description || undefined,
          buildingImageUrl: formData.buildingImageUrl || undefined,
          videoUrl: formData.videoUrl || undefined,
        },
      });
      router.push(`/account/to-let/properties/${property.propertyCode}`);
    } catch {
      // Mutation hook displays the API error.
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <PropertyPageHeader
        title="Edit Property"
        description={`${property.name} · ${property.propertyCode}`}
        backHref={`/account/to-let/properties/${property.propertyCode}`}
      />

      <FormSection title="Property identity and contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-property-name">Property Name *</Label>
            <Input
              id="edit-property-name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              aria-invalid={Boolean(errors.name)}
            />
            <EditFieldError message={errors.name} />
          </div>
          <div className="space-y-1.5">
            <Label>Property Type *</Label>
            <Select
              value={values.propertyType}
              onValueChange={(value) => update("propertyType", value)}
            >
              <SelectTrigger aria-invalid={Boolean(errors.propertyType)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {propertyTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EditFieldError message={errors.propertyType} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-owner-name">Property Owner *</Label>
            <Input
              id="edit-owner-name"
              value={values.ownerName}
              onChange={(event) => update("ownerName", event.target.value)}
              aria-invalid={Boolean(errors.ownerName)}
            />
            <EditFieldError message={errors.ownerName} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-mobile">Mobile Number *</Label>
            <Input
              id="edit-mobile"
              value={values.mobileNumber}
              onChange={(event) => onPhoneChange(event.target.value)}
              aria-invalid={Boolean(errors.mobileNumber)}
            />
            <EditFieldError message={errors.mobileNumber} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-email">Email Address</Label>
            <Input
              id="edit-email"
              type="email"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
            <EditFieldError message={errors.email} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Property Cover Photo *</Label>
            <ImageUploader
              value={values.coverImageUrl}
              onChange={(url) => update("coverImageUrl", url)}
              folder="to-let/properties"
              className="min-h-44"
            />
            <EditFieldError message={errors.coverImageUrl} />
          </div>
        </div>
      </FormSection>

      {values.mobileNumber !== verifiedPhone ? (
        <FormSection title="Verify changed phone number">
          <PropertyPhoneVerification
            phone={values.mobileNumber}
            verified={values.phoneVerified}
            onVerified={() => {
              setVerifiedPhone(values.mobileNumber);
              update("phoneVerified", true);
            }}
          />
          <EditFieldError message={errors.phoneVerified} />
        </FormSection>
      ) : null}

      <FormSection title="Location">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["division", "Division"],
              ["district", "District"],
              ["area", "Area / Upazila"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={`edit-${key}`}>{label} *</Label>
              <Input
                id={`edit-${key}`}
                value={values[key]}
                onChange={(event) => update(key, event.target.value)}
                aria-invalid={Boolean(errors[key])}
              />
              <EditFieldError message={errors[key]} />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-full-address">Full Address *</Label>
            <Textarea
              id="edit-full-address"
              value={values.fullAddress}
              onChange={(event) => update("fullAddress", event.target.value)}
              rows={3}
              aria-invalid={Boolean(errors.fullAddress)}
            />
            <EditFieldError message={errors.fullAddress} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-landmark">Nearby Landmark</Label>
            <Input
              id="edit-landmark"
              value={values.nearbyLandmark}
              onChange={(event) => update("nearbyLandmark", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-latitude">Latitude</Label>
            <Input
              id="edit-latitude"
              value={values.latitude}
              onChange={(event) => update("latitude", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-longitude">Longitude</Label>
            <Input
              id="edit-longitude"
              value={values.longitude}
              onChange={(event) => update("longitude", event.target.value)}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Building information">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Building Type *</Label>
            <Select
              value={values.buildingType}
              onValueChange={(value) => update("buildingType", value)}
            >
              <SelectTrigger aria-invalid={Boolean(errors.buildingType)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {buildingTypes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EditFieldError message={errors.buildingType} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-floors">Total Floors *</Label>
            <Input
              id="edit-floors"
              type="number"
              min={1}
              value={values.totalFloors}
              onChange={(event) =>
                update("totalFloors", Number(event.target.value))
              }
              aria-invalid={Boolean(errors.totalFloors)}
            />
            <EditFieldError message={errors.totalFloors} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-units">Planned Total Units *</Label>
            <Input
              id="edit-units"
              type="number"
              min={1}
              value={values.declaredTotalUnits}
              onChange={(event) =>
                update("declaredTotalUnits", Number(event.target.value))
              }
              aria-invalid={Boolean(errors.declaredTotalUnits)}
            />
            <EditFieldError message={errors.declaredTotalUnits} />
          </div>
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            {(
              [
                ["hasParking", "Parking available"],
                ["hasLift", "Lift available"],
                ["hasSecurityGuard", "Security guard"],
                ["hasCctv", "CCTV camera"],
                ["hasGenerator", "Generator"],
                ["hasWaterSupply", "Water supply"],
                ["hasGasConnection", "Gas connection"],
                ["hasElectricity", "Electricity"],
              ] as const
            ).map(([key, label]) => (
              <EditToggle
                key={key}
                label={label}
                checked={values[key]}
                onChange={(checked) => update(key, checked)}
              />
            ))}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="edit-description">Property Description</Label>
            <Textarea
              id="edit-description"
              value={values.description}
              onChange={(event) => update("description", event.target.value)}
              rows={5}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Verification media">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Property Front Image *</Label>
            <ImageUploader
              value={values.frontImageUrl}
              onChange={(url) => update("frontImageUrl", url)}
              folder="to-let/properties"
              className="min-h-44"
            />
            <EditFieldError message={errors.frontImageUrl} />
          </div>
          <div className="space-y-1.5">
            <Label>Additional Building Image</Label>
            <ImageUploader
              value={values.buildingImageUrl}
              onChange={(url) => update("buildingImageUrl", url)}
              folder="to-let/properties"
              className="min-h-44"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Building Video (optional)</Label>
            <PropertyVideoField
              value={values.videoUrl}
              onChange={(url) => update("videoUrl", url)}
              disabled={mutation.isPending}
              invalid={Boolean(errors.videoUrl)}
            />
            <EditFieldError message={errors.videoUrl} />
          </div>
        </div>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white px-4 py-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={mutation.isPending || !values.phoneVerified}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save />
            )}
            {mutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function PropertyEditForm({ propertyCode }: { propertyCode: string }) {
  const query = useMyToLetProperty(propertyCode);
  if (query.isLoading) return <PropertyDetailsSkeleton />;
  if (query.isError) {
    return <PropertyErrorState onRetry={() => query.refetch()} />;
  }
  const property = propertyFromResponse(query.data);
  if (property?.status === "blocked") {
    return (
      <PropertyErrorState message="This property is blocked and cannot be edited." />
    );
  }
  return property ? (
    <LoadedPropertyEditForm property={property} />
  ) : (
    <PropertyErrorState message="This property could not be found." />
  );
}
