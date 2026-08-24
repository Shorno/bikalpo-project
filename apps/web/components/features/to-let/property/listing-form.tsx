"use client";

import { isToLetPublicListingRenewalDue } from "@bikalpo-project/api/routers/helpers/tolet-marketplace-visibility";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  Loader2,
  PauseCircle,
  QrCode,
  Save,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import AdditionalImagesUploader from "@/components/AdditionalImagesUploader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateToLetUnitListing,
  useMyToLetProperty,
  useMyToLetUnitListing,
  usePauseToLetUnitListing,
  usePublishToLetUnitListing,
  useUpdateToLetUnitListing,
} from "@/hooks/use-to-let-property-api";
import { cn } from "@/lib/utils";
import {
  listingDraftSchema,
  listingPublishSchema,
  listingVisibilityOptions,
  preferredTenantOptions,
  type ToLetListingFormValues,
} from "@/schema/to-let-listing.schema";
import { IncludedExcludedButtons } from "./included-excluded-buttons";
import { propertyFromResponse } from "./property-details-client";
import {
  ListingStatusBadge,
  PropertyDetailsSkeleton,
  PropertyErrorState,
  PropertyPageHeader,
} from "./property-ui";
import { PropertyVideoField } from "./property-video-field";
import {
  humanize,
  type ToLetPropertyView,
  type ToLetUnitListingView,
  type ToLetUnitView,
} from "./types";

const steps = [
  { id: 1, label: "Unit" },
  { id: 2, label: "Details" },
  { id: 3, label: "Facility" },
  { id: 4, label: "Pricing" },
  { id: 5, label: "Review" },
] as const;

const stepSchemas = [
  listingPublishSchema.pick({
    title: true,
    monthlyRent: true,
    monthlyRentVisible: true,
    advanceAmount: true,
    advanceAmountVisible: true,
    securityDeposit: true,
    securityDepositVisible: true,
    serviceCharge: true,
    serviceChargeVisible: true,
    serviceChargeIncluded: true,
    parkingCharge: true,
    parkingChargeVisible: true,
    parkingChargeIncluded: true,
    utilityCharge: true,
    utilityChargeVisible: true,
    utilityChargeIncluded: true,
    availableFrom: true,
  }),
  listingDraftSchema.pick({
    preferredTenant: true,
    description: true,
  }),
  listingDraftSchema.pick({
    hasInternet: true,
    otherFacilities: true,
    imageUrls: true,
    videoUrl: true,
  }),
  listingDraftSchema.pick({ visibility: true }),
] as const;

type FieldErrors = Record<string, string>;

function listingFromResponse(data: unknown): ToLetUnitListingView | null {
  if (!data || typeof data !== "object" || !("listing" in data)) return null;
  const listing = (data as { listing?: unknown }).listing;
  return listing && typeof listing === "object"
    ? (listing as ToLetUnitListingView)
    : null;
}

function today() {
  const current = new Date();
  const local = new Date(
    current.getTime() - current.getTimezoneOffset() * 60000,
  );
  return local.toISOString().slice(0, 10);
}

function initialValues(
  property: ToLetPropertyView,
  unit: ToLetUnitView,
  listing: ToLetUnitListingView | null,
): ToLetListingFormValues {
  return {
    title: listing?.title ?? `${property.name} - ${unit.name}`,
    description: listing?.description ?? unit.description ?? "",
    monthlyRent: listing?.monthlyRent ?? 0,
    monthlyRentVisible: listing?.monthlyRentVisible ?? true,
    advanceAmount: listing?.advanceAmount ?? 0,
    advanceAmountVisible: listing?.advanceAmountVisible ?? true,
    securityDeposit: listing?.securityDeposit ?? 0,
    securityDepositVisible: listing?.securityDepositVisible ?? true,
    serviceCharge: listing?.serviceCharge ?? 0,
    serviceChargeVisible: listing?.serviceChargeVisible ?? true,
    serviceChargeIncluded: listing?.serviceChargeIncluded ?? false,
    parkingCharge: listing?.parkingCharge ?? 0,
    parkingChargeVisible: listing?.parkingChargeVisible ?? true,
    parkingChargeIncluded: listing?.parkingChargeIncluded ?? false,
    utilityCharge: listing?.utilityCharge ?? 0,
    utilityChargeVisible: listing?.utilityChargeVisible ?? true,
    utilityChargeIncluded: listing?.utilityChargeIncluded ?? false,
    availableFrom: listing?.availableFrom ?? today(),
    preferredTenant: listing?.preferredTenant ?? "any",
    hasInternet: listing?.hasInternet ?? false,
    otherFacilities: listing?.otherFacilities ?? "",
    imageUrls: listing?.imageUrls ?? unit.imageUrls,
    videoUrl: listing?.videoUrl ?? "",
    visibility: listing?.visibility ?? "public",
  };
}

function fieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-600">
      {message}
    </p>
  ) : null;
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ReadonlyField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <div className="flex min-h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-800">
        {value}
      </div>
    </div>
  );
}

function MoneyField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
          ৳
        </span>
        <Input
          id={id}
          type="number"
          min={0}
          step="1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="pl-8"
          aria-invalid={Boolean(error)}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

function ChargeIncluded({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
      <span>Included in monthly rent</span>
      <IncludedExcludedButtons
        label={`${label} in monthly rent`}
        included={checked}
        onChange={onChange}
      />
    </div>
  );
}

function PriceVisibility({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
      Show to visitors before contract
      <Switch
        aria-label={`Show ${label} to visitors before contract`}
        checked={checked}
        onCheckedChange={onChange}
      />
    </label>
  );
}

function formatMoney(value: number) {
  return `৳${value.toLocaleString("en-BD")}`;
}

function ordinalSuffix(value: number) {
  const remainder = Math.abs(value) % 100;
  if (remainder >= 11 && remainder <= 13) return "th";
  if (remainder % 10 === 1) return "st";
  if (remainder % 10 === 2) return "nd";
  if (remainder % 10 === 3) return "rd";
  return "th";
}

function formatFloor(value: number) {
  if (value === 0) return "Ground Floor";
  if (value < 0) return `Basement ${Math.abs(value)}`;
  return `${value}${ordinalSuffix(value)} Floor`;
}

function LoadedListingForm({
  property,
  unit,
  listing,
}: {
  property: ToLetPropertyView;
  unit: ToLetUnitView;
  listing: ToLetUnitListingView | null;
}) {
  const router = useRouter();
  const createListing = useCreateToLetUnitListing();
  const updateListing = useUpdateToLetUnitListing();
  const publishListing = usePublishToLetUnitListing();
  const pauseListing = usePauseToLetUnitListing();
  const [currentStep, setCurrentStep] = useState(1);
  const [values, setValues] = useState(() =>
    initialValues(property, unit, listing),
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const isPublicListingRenewalDue = listing
    ? isToLetPublicListingRenewalDue({
        listingStatus: listing.status,
        visibility: listing.visibility,
        unitStatus: unit.status,
        publishedAt: listing.publishedAt ? new Date(listing.publishedAt) : null,
        createdAt: new Date(listing.createdAt),
      })
    : false;

  const isPending =
    createListing.isPending ||
    updateListing.isPending ||
    publishListing.isPending ||
    pauseListing.isPending;

  const update = <K extends keyof ToLetListingFormValues>(
    key: K,
    value: ToLetListingFormValues[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validateStep = () => {
    if (currentStep === 5) return true;
    const schema = stepSchemas[currentStep - 1];
    const result = schema.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    setErrors(fieldErrors(result.error.issues));
    toast.error("Please review the highlighted listing fields");
    return false;
  };

  const next = () => {
    if (!validateStep()) return;
    setCurrentStep((step) => Math.min(5, step + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setErrors({});
    setCurrentStep((step) => Math.max(1, step - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async (publishAfterSave: boolean) => {
    const schema = publishAfterSave ? listingPublishSchema : listingDraftSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error.issues));
      toast.error(
        publishAfterSave
          ? "Complete the required fields before publishing"
          : "Please review the listing fields",
      );
      return;
    }

    try {
      let listingCode = listing?.listingCode;
      if (listingCode) {
        const result = await updateListing.mutateAsync({
          propertyCode: property.propertyCode,
          unitCode: unit.unitCode,
          listingCode,
          data: parsed.data,
        });
        listingCode = result.listing.listingCode;
      } else {
        const result = await createListing.mutateAsync({
          propertyCode: property.propertyCode,
          unitCode: unit.unitCode,
          data: parsed.data,
        });
        listingCode = result.listing.listingCode;
      }

      if (publishAfterSave) {
        await publishListing.mutateAsync({
          propertyCode: property.propertyCode,
          unitCode: unit.unitCode,
          listingCode,
        });
      }
      setCurrentStep(5);
      router.refresh();
    } catch {
      // Mutation hooks display the API error.
    }
  };

  const pause = async () => {
    if (!listing) return;
    try {
      await pauseListing.mutateAsync({
        propertyCode: property.propertyCode,
        unitCode: unit.unitCode,
        listingCode: listing.listingCode,
      });
      router.refresh();
    } catch {
      // Mutation hook displays the API error.
    }
  };

  const renewVisibility = async () => {
    if (!listing || !isPublicListingRenewalDue) return;
    try {
      await publishListing.mutateAsync({
        propertyCode: property.propertyCode,
        unitCode: unit.unitCode,
        listingCode: listing.listingCode,
      });
      router.refresh();
    } catch {
      // Mutation hook displays the API error.
    }
  };

  const liveHref =
    listing?.visibility === "public"
      ? `/to-let/listings/${listing.listingCode}`
      : `/to-let/qr/${property.qrToken}`;

  return (
    <div className="space-y-5">
      <PropertyPageHeader
        title={listing ? "Manage To-Let Listing" : "Create New Rental Listing"}
        description={`${property.name} · ${unit.name} · ${unit.unitCode}`}
        backHref={`/account/to-let/properties/${property.propertyCode}/units/${unit.unitCode}`}
        action={
          isPublicListingRenewalDue ? (
            <Button
              type="button"
              onClick={renewVisibility}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {publishListing.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Upload />
              )}
              Renew visibility
            </Button>
          ) : listing?.status === "active" ? (
            <Button variant="outline" asChild>
              <Link href={liveHref} target="_blank" prefetch={false}>
                <ExternalLink /> Open Live Page
              </Link>
            </Button>
          ) : null
        }
      />

      {listing ? (
        <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={listing.status} />
            <Badge variant="outline">
              {listing.visibility === "public" ? "Public" : "QR Only"}
            </Badge>
            <span className="font-mono text-xs text-gray-500">
              {listing.listingCode}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            {formatMoney(listing.monthlyRent)} / month · {listing.viewCount}{" "}
            views
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Listing creation progress"
        className="rounded-lg border border-gray-200 bg-white px-3 py-4 sm:px-5"
      >
        <ol className="flex items-center">
          {steps.map((step, index) => {
            const active = currentStep === step.id;
            const completed = currentStep > step.id;
            return (
              <li key={step.id} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrors({});
                    setCurrentStep(step.id);
                  }}
                  className="flex min-w-0 flex-col items-center gap-1"
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                      active
                        ? "border-emerald-600 text-emerald-700 ring-4 ring-emerald-50"
                        : completed
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-gray-300 text-gray-400",
                    )}
                  >
                    {completed ? <Check className="size-4" /> : step.id}
                  </span>
                  <span
                    className={cn(
                      "hidden text-xs sm:block",
                      active ? "text-emerald-700" : "text-gray-500",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      "mx-1 h-px flex-1 sm:mx-3",
                      completed ? "bg-emerald-500" : "bg-gray-200",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      {currentStep === 1 ? (
        <FormSection
          title="Step 1 · Unit Information"
          description="Create the rental post for this registered Property Unit. Permanent Unit details remain read-only."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadonlyField
              label="Property ID *"
              value={property.propertyCode}
            />
            <ReadonlyField label="Property Name" value={property.name} />
            <ReadonlyField
              label="Unit Name / Number *"
              value={`${unit.name} · ${unit.unitCode}`}
            />
            <ReadonlyField
              label="Listing Category *"
              value={humanize(unit.unitType)}
            />
            <ReadonlyField
              label="Floor Number *"
              value={formatFloor(unit.floorNumber)}
            />
            <ReadonlyField
              label="Unit Size *"
              value={`${unit.sizeSqFt.toLocaleString("en-BD")} Sq.ft`}
            />
            <MoneyField
              id="monthly-rent"
              label="Rent *"
              value={values.monthlyRent}
              error={errors.monthlyRent}
              onChange={(value) => update("monthlyRent", value)}
            />
            <MoneyField
              id="advance-amount"
              label="Advance *"
              value={values.advanceAmount}
              error={errors.advanceAmount}
              onChange={(value) => update("advanceAmount", value)}
            />
            <MoneyField
              id="security-deposit"
              label="Security Deposit"
              value={values.securityDeposit}
              error={errors.securityDeposit}
              onChange={(value) => update("securityDeposit", value)}
            />
            <div>
              <MoneyField
                id="service-charge"
                label="Service Charge"
                value={values.serviceCharge}
                error={errors.serviceCharge}
                onChange={(value) => update("serviceCharge", value)}
              />
              <ChargeIncluded
                label="Service charge"
                checked={values.serviceChargeIncluded}
                onChange={(checked) => update("serviceChargeIncluded", checked)}
              />
            </div>
            <div>
              <MoneyField
                id="parking-charge"
                label="Parking"
                value={values.parkingCharge}
                error={errors.parkingCharge}
                onChange={(value) => update("parkingCharge", value)}
              />
              <ChargeIncluded
                label="Parking"
                checked={values.parkingChargeIncluded}
                onChange={(checked) => update("parkingChargeIncluded", checked)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="available-from">Available From</Label>
              <Input
                id="available-from"
                type="date"
                value={values.availableFrom}
                onChange={(event) =>
                  update("availableFrom", event.target.value)
                }
                aria-invalid={Boolean(errors.availableFrom)}
              />
              <FieldError message={errors.availableFrom} />
            </div>
          </div>
        </FormSection>
      ) : null}

      {currentStep === 2 ? (
        <FormSection
          title="Step 2 · Unit Details"
          description="Physical details come from the reusable Unit. Edit the Unit itself if any permanent information is incorrect."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadonlyField label="Bedrooms *" value={unit.bedrooms} />
            <ReadonlyField label="Bathrooms *" value={unit.bathrooms} />
            {[
              ["Balcony", unit.balconies > 0],
              ["Kitchen", unit.hasKitchen],
              ["Drawing Room", unit.hasDrawingRoom],
              ["Dining Space", unit.hasDiningSpace],
            ].map(([label, included]) => (
              <div key={String(label)} className="space-y-1.5">
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <div className="flex min-h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3">
                  <IncludedExcludedButtons
                    label={String(label)}
                    included={Boolean(included)}
                  />
                </div>
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <Label>Preferred Tenant *</Label>
              <RadioGroup
                value={values.preferredTenant}
                onValueChange={(value) =>
                  update(
                    "preferredTenant",
                    value as ToLetListingFormValues["preferredTenant"],
                  )
                }
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                aria-invalid={Boolean(errors.preferredTenant)}
              >
                {preferredTenantOptions
                  .filter(
                    (option) =>
                      option.value !== "female" ||
                      values.preferredTenant === "female",
                  )
                  .map((option) => (
                    <label
                      key={option.value}
                      htmlFor={`preferred-${option.value}`}
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-gray-200 px-3 text-sm text-gray-700"
                    >
                      <RadioGroupItem
                        id={`preferred-${option.value}`}
                        value={option.value}
                      />
                      {option.label}
                    </label>
                  ))}
              </RadioGroup>
              <FieldError message={errors.preferredTenant} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="listing-description">Property Description</Label>
              <Textarea
                id="listing-description"
                rows={5}
                value={values.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Describe this unit"
                aria-invalid={Boolean(errors.description)}
              />
              <FieldError message={errors.description} />
            </div>
          </div>
        </FormSection>
      ) : null}

      {currentStep === 3 ? (
        <div className="space-y-5">
          <FormSection
            title="Step 3 · Facilities"
            description="Property and Unit facilities are shown automatically on the live listing."
          >
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                { label: "Water Supply", available: property.hasWaterSupply },
                {
                  label: "Gas Connection",
                  available: property.hasGasConnection,
                },
                { label: "Electricity", available: property.hasElectricity },
                {
                  label: "Internet",
                  available: values.hasInternet,
                  onChange: (available: boolean) =>
                    update("hasInternet", available),
                },
                { label: "Lift", available: property.hasLift },
                { label: "Parking", available: property.hasParking },
                { label: "Generator", available: property.hasGenerator },
                { label: "Security", available: property.hasSecurityGuard },
                { label: "CCTV", available: property.hasCctv },
                { label: "Furnished", available: unit.isFurnished },
              ].map((facility) => (
                <div
                  key={facility.label}
                  className="space-y-2 border-b border-gray-100 pb-4"
                >
                  <p className="text-sm font-medium text-gray-900">
                    {facility.label}
                  </p>
                  <label
                    htmlFor={`facility-${facility.label.toLowerCase().replaceAll(" ", "-")}`}
                    className={cn(
                      "flex min-h-9 items-center gap-2 text-sm text-gray-700",
                      facility.onChange ? "cursor-pointer" : "cursor-default",
                    )}
                  >
                    <Checkbox
                      id={`facility-${facility.label.toLowerCase().replaceAll(" ", "-")}`}
                      checked={facility.available}
                      disabled={!facility.onChange}
                      className="disabled:opacity-100"
                      onCheckedChange={(checked) =>
                        facility.onChange?.(checked === true)
                      }
                    />
                    Available
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="other-facilities">Other Facilities</Label>
              <Textarea
                id="other-facilities"
                rows={3}
                value={values.otherFacilities}
                onChange={(event) =>
                  update("otherFacilities", event.target.value)
                }
                placeholder="Rooftop, kids zone, garden, nearby services..."
              />
              <FieldError message={errors.otherFacilities} />
            </div>
          </FormSection>

          <FormSection
            title="Unit Photos & Listing Video"
            description="Upload at least one Unit photo before publishing. The optional video can be uploaded from your device or added as a public link."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>Unit Photos *</Label>
                <AdditionalImagesUploader
                  value={values.imageUrls}
                  onChange={(urls) => update("imageUrls", urls)}
                  folder="to-let/listings"
                  maxFiles={12}
                  hideTitle
                  compact
                />
                <FieldError message={errors.imageUrls} />
              </div>
              <div className="space-y-2">
                <Label>Unit / Listing Video (Optional)</Label>
                <PropertyVideoField
                  value={values.videoUrl}
                  onChange={(url) => update("videoUrl", url)}
                  invalid={Boolean(errors.videoUrl)}
                  subjectLabel="Unit / listing video"
                />
                <FieldError message={errors.videoUrl} />
              </div>
            </div>
          </FormSection>
        </div>
      ) : null}

      {currentStep === 4 ? (
        <div className="space-y-5">
          <FormSection title="Step 4 · Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <ReadonlyField
                label="Contact Person"
                value={property.ownerName}
              />
              <ReadonlyField
                label="Contact Number"
                value={property.mobileNumber}
              />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              The verified Property contact is used for calls and booking
              requests. Update it from Edit Property when needed.
            </p>
          </FormSection>

          <details className="rounded-lg border border-gray-200 bg-white">
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-gray-900 sm:px-6">
              Advanced publishing settings
            </summary>
            <div className="space-y-6 border-t border-gray-100 px-5 py-5 sm:px-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Listing visibility
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Choose where this active Listing can be discovered.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {listingVisibilityOptions.map((option) => {
                    const selected = values.visibility === option.value;
                    const Icon = option.value === "public" ? Eye : QrCode;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => update("visibility", option.value)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600",
                          selected
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-200 bg-white hover:border-emerald-300",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            selected
                              ? "bg-emerald-600 text-white"
                              : "bg-gray-100 text-gray-500",
                          )}
                        >
                          <Icon className="size-4.5" />
                        </span>
                        <span>
                          <span className="block font-medium text-gray-900">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-gray-600">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <FieldError message={errors.visibility} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Visitor price details
                </h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <PriceVisibility
                    label="monthly rent"
                    checked={values.monthlyRentVisible}
                    onChange={(checked) =>
                      update("monthlyRentVisible", checked)
                    }
                  />
                  <PriceVisibility
                    label="advance"
                    checked={values.advanceAmountVisible}
                    onChange={(checked) =>
                      update("advanceAmountVisible", checked)
                    }
                  />
                  <PriceVisibility
                    label="security deposit"
                    checked={values.securityDepositVisible}
                    onChange={(checked) =>
                      update("securityDepositVisible", checked)
                    }
                  />
                  <PriceVisibility
                    label="service charge"
                    checked={values.serviceChargeVisible}
                    onChange={(checked) =>
                      update("serviceChargeVisible", checked)
                    }
                  />
                  <PriceVisibility
                    label="parking charge"
                    checked={values.parkingChargeVisible}
                    onChange={(checked) =>
                      update("parkingChargeVisible", checked)
                    }
                  />
                </div>
              </div>

              <div className="max-w-xl">
                <MoneyField
                  id="utility-charge"
                  label="Utility Charge"
                  value={values.utilityCharge}
                  error={errors.utilityCharge}
                  onChange={(value) => update("utilityCharge", value)}
                />
                <ChargeIncluded
                  label="Utility charge"
                  checked={values.utilityChargeIncluded}
                  onChange={(checked) =>
                    update("utilityChargeIncluded", checked)
                  }
                />
                <PriceVisibility
                  label="utility charge"
                  checked={values.utilityChargeVisible}
                  onChange={(checked) =>
                    update("utilityChargeVisible", checked)
                  }
                />
              </div>
            </div>
          </details>
        </div>
      ) : null}

      {currentStep === 5 ? (
        <div className="space-y-5">
          <FormSection title="Step 5 · Review & Publish">
            <dl className="divide-y divide-gray-100">
              {[
                ["Property", property.name],
                ["Unit", unit.name],
                ["Category", humanize(unit.unitType)],
                ["Location", `${property.area}, ${property.district}`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"
                >
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Facilities
              </h3>
              <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {[
                  ["Water", property.hasWaterSupply],
                  ["Gas", property.hasGasConnection],
                  ["Electricity", property.hasElectricity],
                  ["Internet", values.hasInternet],
                  ["Lift", property.hasLift],
                  ["Parking", property.hasParking],
                  ["Generator", property.hasGenerator],
                  ["Security", property.hasSecurityGuard],
                  ["CCTV", property.hasCctv],
                  ["Furnished", unit.isFurnished],
                ]
                  .filter(([, available]) => available)
                  .map(([label]) => (
                    <div
                      key={String(label)}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <Check className="size-4 text-emerald-600" /> {label}
                    </div>
                  ))}
              </div>
              {values.otherFacilities ? (
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {values.otherFacilities}
                </p>
              ) : null}
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-900">Media</h3>
              <div className="mt-3 space-y-2 text-sm text-gray-700">
                <p className="flex items-center gap-2">
                  <Check className="size-4 text-emerald-600" />
                  {String(values.imageUrls.length).padStart(2, "0")} Photos
                  Uploaded
                </p>
                {values.videoUrl ? (
                  <p className="flex items-center gap-2">
                    <Check className="size-4 text-emerald-600" /> 01 Video
                    Uploaded
                  </p>
                ) : null}
              </div>
            </div>
          </FormSection>

          {listing?.status === "active" ? (
            <FormSection title="Listing Published Successfully">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">
                    {listing.listingCode}
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    Status · Active
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                  <Link href={liveHref} target="_blank" prefetch={false}>
                    <Eye /> View Listing
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                >
                  Edit Listing
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/to-let/qr/${property.qrToken}`} target="_blank">
                    <QrCode /> Share QR Code
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link
                    href={`/account/to-let/properties/${property.propertyCode}`}
                  >
                    Create Another Listing
                  </Link>
                </Button>
              </div>
            </FormSection>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white px-4 py-4 sm:static sm:mx-0 sm:rounded-lg sm:border sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={back}
              disabled={isPending}
            >
              <ArrowLeft /> Back
            </Button>
          ) : (
            <span />
          )}

          {currentStep < 5 ? (
            <Button
              type="button"
              onClick={next}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Save &amp; Continue <ArrowRight />
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              {listing?.status === "active" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => save(false)}
                    disabled={isPending}
                  >
                    {isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save />
                    )}
                    Save Changes
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-amber-700"
                        disabled={isPending}
                      >
                        <PauseCircle /> Unpublish
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Unpublish this listing?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          It will disappear from the To-Let landing/search
                          results and the Property QR page. You can edit and
                          publish it again later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={pause}>
                          Unpublish Listing
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => save(true)}
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Upload />
                  )}
                  {listing?.status === "paused"
                    ? "Publish Again"
                    : "Publish Listing"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ListingForm({
  propertyCode,
  unitCode,
}: {
  propertyCode: string;
  unitCode: string;
}) {
  const propertyQuery = useMyToLetProperty(propertyCode);
  const listingQuery = useMyToLetUnitListing(propertyCode, unitCode);

  if (propertyQuery.isLoading || listingQuery.isLoading) {
    return <PropertyDetailsSkeleton />;
  }
  if (propertyQuery.isError || listingQuery.isError) {
    return (
      <PropertyErrorState
        message="This Unit listing could not be loaded."
        onRetry={() => {
          propertyQuery.refetch();
          listingQuery.refetch();
        }}
      />
    );
  }

  const property = propertyFromResponse(propertyQuery.data);
  const unit = property?.units?.find(
    (candidate: ToLetUnitView) => candidate.unitCode === unitCode,
  );
  if (!property || !unit) {
    return <PropertyErrorState message="This Unit could not be found." />;
  }
  if (property.status === "blocked") {
    return (
      <PropertyErrorState message="This Property is blocked and cannot publish a listing." />
    );
  }
  if (unit.status !== "vacant") {
    return (
      <PropertyErrorState message="Only a Vacant Unit can publish a To-Let listing." />
    );
  }

  const listing = listingFromResponse(listingQuery.data);
  return (
    <LoadedListingForm
      key={listing?.listingCode ?? "new"}
      property={property}
      unit={unit}
      listing={listing}
    />
  );
}
