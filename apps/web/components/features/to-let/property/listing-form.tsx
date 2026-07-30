"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  Globe2,
  Loader2,
  PauseCircle,
  QrCode,
  Save,
  ShieldCheck,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  humanize,
  type ToLetPropertyView,
  type ToLetUnitListingView,
  type ToLetUnitView,
} from "./types";

const steps = [
  { id: 1, label: "Unit" },
  { id: 2, label: "Details" },
  { id: 3, label: "Facilities" },
  { id: 4, label: "Contact" },
  { id: 5, label: "Review" },
] as const;

const stepSchemas = [
  listingDraftSchema.pick({
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
          listing?.status === "active" ? (
            <Button variant="outline" asChild>
              <Link href={liveHref} target="_blank">
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
        <div className="space-y-5">
          <FormSection
            title="Step 1 · Unit Information"
            description="Confirm the selected Property and Unit before adding the rental price. These permanent details remain read-only."
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
                value={
                  unit.floorNumber === 0 ? "Ground floor" : unit.floorNumber
                }
              />
              <ReadonlyField
                label="Unit Size *"
                value={`${unit.sizeSqFt} sq ft`}
              />
            </div>
          </FormSection>

          <FormSection
            title="Listing and Pricing"
            description="Add the rental terms and choose which amounts visitors can see before a Contract is active."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="listing-title">Listing Title *</Label>
                <Input
                  id="listing-title"
                  value={values.title}
                  onChange={(event) => update("title", event.target.value)}
                  aria-invalid={Boolean(errors.title)}
                />
                <FieldError message={errors.title} />
              </div>
              <div>
                <MoneyField
                  id="monthly-rent"
                  label="Monthly Rent *"
                  value={values.monthlyRent}
                  error={errors.monthlyRent}
                  onChange={(value) => update("monthlyRent", value)}
                />
                <PriceVisibility
                  label="monthly rent"
                  checked={values.monthlyRentVisible}
                  onChange={(checked) => update("monthlyRentVisible", checked)}
                />
              </div>
              <div>
                <MoneyField
                  id="advance-amount"
                  label="Advance"
                  value={values.advanceAmount}
                  error={errors.advanceAmount}
                  onChange={(value) => update("advanceAmount", value)}
                />
                <PriceVisibility
                  label="advance"
                  checked={values.advanceAmountVisible}
                  onChange={(checked) =>
                    update("advanceAmountVisible", checked)
                  }
                />
              </div>
              <div>
                <MoneyField
                  id="security-deposit"
                  label="Security Deposit"
                  value={values.securityDeposit}
                  error={errors.securityDeposit}
                  onChange={(value) => update("securityDeposit", value)}
                />
                <PriceVisibility
                  label="security deposit"
                  checked={values.securityDepositVisible}
                  onChange={(checked) =>
                    update("securityDepositVisible", checked)
                  }
                />
              </div>
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
                  onChange={(checked) =>
                    update("serviceChargeIncluded", checked)
                  }
                />
                <PriceVisibility
                  label="service charge"
                  checked={values.serviceChargeVisible}
                  onChange={(checked) =>
                    update("serviceChargeVisible", checked)
                  }
                />
              </div>
              <div>
                <MoneyField
                  id="parking-charge"
                  label="Parking Charge"
                  value={values.parkingCharge}
                  error={errors.parkingCharge}
                  onChange={(value) => update("parkingCharge", value)}
                />
                <ChargeIncluded
                  label="Parking charge"
                  checked={values.parkingChargeIncluded}
                  onChange={(checked) =>
                    update("parkingChargeIncluded", checked)
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
              <div>
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
              <div className="space-y-1.5">
                <Label htmlFor="available-from">Available From *</Label>
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
        </div>
      ) : null}

      {currentStep === 2 ? (
        <FormSection
          title="Step 2 · Unit Details"
          description="Physical details come from the reusable Unit. Edit the Unit itself if any permanent information is incorrect."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ReadonlyField label="Bedrooms *" value={unit.bedrooms} />
            <ReadonlyField label="Bathrooms *" value={unit.bathrooms} />
            <ReadonlyField label="Balconies" value={unit.balconies} />
            <ReadonlyField
              label="Kitchen"
              value={unit.hasKitchen ? "Yes" : "No"}
            />
            <ReadonlyField
              label="Drawing Room"
              value={unit.hasDrawingRoom ? "Yes" : "No"}
            />
            <ReadonlyField
              label="Dining Space"
              value={unit.hasDiningSpace ? "Yes" : "No"}
            />
            <div className="space-y-1.5">
              <Label>Preferred Tenant *</Label>
              <Select
                value={values.preferredTenant}
                onValueChange={(value) =>
                  update(
                    "preferredTenant",
                    value as ToLetListingFormValues["preferredTenant"],
                  )
                }
              >
                <SelectTrigger aria-invalid={Boolean(errors.preferredTenant)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {preferredTenantOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.preferredTenant} />
            </div>
            <div className="flex min-h-10 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 lg:col-span-2">
              {unit.isFurnished ? "Furnished Unit" : "Unfurnished Unit"}
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="listing-description">Listing Description</Label>
              <Textarea
                id="listing-description"
                rows={8}
                value={values.description}
                onChange={(event) => update("description", event.target.value)}
                placeholder="Describe availability, access, neighborhood and tenant expectations."
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
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Water Supply", included: property.hasWaterSupply },
                {
                  label: "Gas Connection",
                  included: property.hasGasConnection,
                },
                { label: "Electricity", included: property.hasElectricity },
                {
                  label: "Internet",
                  included: values.hasInternet,
                  onChange: (included: boolean) =>
                    update("hasInternet", included),
                },
                { label: "Lift", included: property.hasLift },
                { label: "Parking", included: property.hasParking },
                { label: "Generator", included: property.hasGenerator },
                { label: "Security", included: property.hasSecurityGuard },
                { label: "CCTV", included: property.hasCctv },
                { label: "Furnished", included: unit.isFurnished },
              ].map((facility) => (
                <div
                  key={facility.label}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                >
                  <span>{facility.label}</span>
                  <IncludedExcludedButtons
                    label={facility.label}
                    included={facility.included}
                    onChange={facility.onChange}
                  />
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
            title="Unit Photos & Property Video"
            description="Unit photos are reused automatically. Add or remove media for this advertisement."
          >
            <AdditionalImagesUploader
              value={values.imageUrls}
              onChange={(urls) => update("imageUrls", urls)}
              folder="to-let/listings"
              maxFiles={12}
              compact
            />
            <FieldError message={errors.imageUrls} />
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="listing-video">Video URL (optional)</Label>
              <Input
                id="listing-video"
                type="url"
                value={values.videoUrl}
                onChange={(event) => update("videoUrl", event.target.value)}
                placeholder="https://..."
                aria-invalid={Boolean(errors.videoUrl)}
              />
              <FieldError message={errors.videoUrl} />
            </div>
          </FormSection>
        </div>
      ) : null}

      {currentStep === 4 ? (
        <div className="space-y-5">
          <FormSection
            title="Step 4 · Contact"
            description="The verified Property contact will receive calls and booking requests for this Listing."
          >
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <ShieldCheck className="mt-0.5 size-5 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-900">
                  {property.ownerName}
                </p>
                <p className="text-sm text-emerald-700">
                  {property.mobileNumber}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  The listing uses the verified Property contact. Change it from
                  Edit Property if needed.
                </p>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Listing visibility"
            description="Choose how visitors can discover this Unit."
          >
            <RadioGroup
              value={values.visibility}
              onValueChange={(value) =>
                update(
                  "visibility",
                  value as ToLetListingFormValues["visibility"],
                )
              }
              className="grid gap-3 sm:grid-cols-2"
            >
              {listingVisibilityOptions.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4",
                    values.visibility === option.value
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 bg-white",
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-1" />
                  <span>
                    <span className="flex items-center gap-2 font-medium text-gray-900">
                      {option.value === "public" ? (
                        <Globe2 className="size-4 text-emerald-600" />
                      ) : (
                        <QrCode className="size-4 text-emerald-600" />
                      )}
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <FieldError message={errors.visibility} />
          </FormSection>
        </div>
      ) : null}

      {currentStep === 5 ? (
        <div className="space-y-5">
          <FormSection title="Step 5 · Review & Publish">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Property", property.name],
                ["Unit", `${unit.name} · ${unit.unitCode}`],
                ["Category", humanize(unit.unitType)],
                ["Location", `${property.area}, ${property.district}`],
                ["Title", values.title],
                ["Monthly rent", formatMoney(values.monthlyRent)],
                ["Available from", values.availableFrom],
                ["Preferred tenant", humanize(values.preferredTenant)],
                ["Photos", `${values.imageUrls.length} uploaded`],
                ["Video", values.videoUrl ? "Added" : "Not added"],
                [
                  "Visibility",
                  values.visibility === "public" ? "Public + QR" : "QR Only",
                ],
                ["Contact", `${property.ownerName} · ${property.mobileNumber}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-gray-100 pt-5">
              <h3 className="text-sm font-semibold text-gray-900">
                Facilities
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
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
                    <Badge
                      key={String(label)}
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700"
                    >
                      <Check className="size-3" /> {label}
                    </Badge>
                  ))}
              </div>
              {values.otherFacilities ? (
                <p className="mt-3 text-sm leading-6 text-gray-600">
                  {values.otherFacilities}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {listing?.status === "active" ? (
                <Eye className="mt-0.5 size-5 shrink-0" />
              ) : (
                <Upload className="mt-0.5 size-5 shrink-0" />
              )}
              <p>
                {listing?.status === "active"
                  ? "This listing is live. Saving changes updates the live page immediately."
                  : "Publishing makes the listing live while the Unit remains Vacant. Booking will change Unit status in the next phase."}
              </p>
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
                  <Link href={liveHref} target="_blank">
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
          <Button
            type="button"
            variant="outline"
            onClick={currentStep === 1 ? () => router.back() : back}
            disabled={isPending}
          >
            <ArrowLeft /> {currentStep === 1 ? "Cancel" : "Back"}
          </Button>

          {currentStep < 5 ? (
            <Button
              type="button"
              onClick={next}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Continue <ArrowRight />
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => save(false)}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <Save />}
                {listing ? "Save Changes" : "Save Draft"}
              </Button>
              {listing?.status === "active" ? (
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
                        It will disappear from Public and QR pages. You can edit
                        and publish it again later.
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
