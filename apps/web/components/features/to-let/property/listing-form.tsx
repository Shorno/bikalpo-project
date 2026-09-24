"use client";
import { toLetUnitCapabilities } from "@bikalpo-project/api/lib/tolet-categories";

import { isToLetPublicListingRenewalDue } from "@bikalpo-project/api/routers/helpers/tolet-marketplace-visibility";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  Info,
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
  preferredTenantOptions,
  type ToLetListingFormValues,
} from "@/schema/to-let-listing.schema";
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
  { id: 1, label: "Unit Details" },
  { id: 2, label: "Facility" },
  { id: 3, label: "Rent" },
  { id: 4, label: "Review" },
] as const;

const lastStep = steps.length;

const stepSchemas = [
  listingPublishSchema.pick({
    preferredTenant: true,
    description: true,
    imageUrls: true,
    videoUrl: true,
  }),
  listingDraftSchema.pick({
    hasInternet: true,
    facilityInclusions: true,
    otherFacilities: true,
  }),
  listingPublishSchema.pick({
    availableFrom: true,
    monthlyRent: true,
    advanceAmount: true,
    securityDeposit: true,
    serviceCharge: true,
    parkingCharge: true,
    utilityCharge: true,
  }),
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
    facilityInclusions: listing?.facilityInclusions ?? {},
    otherFacilities: listing?.otherFacilities ?? "",
    imageUrls: listing?.imageUrls ?? unit.imageUrls,
    videoUrl: listing?.videoUrl ?? "",
    tourUrl: listing?.tourUrl ?? "",
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
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex min-h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-medium text-foreground">
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
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
          ৳
        </span>
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0"
          value={value === 0 ? "" : String(value)}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
            onChange(digits ? Number(digits) : 0);
          }}
          className="pl-8"
          aria-invalid={Boolean(error)}
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

function YesNoField({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <RadioGroup
        value={value ? "yes" : "no"}
        disabled
        aria-label={label}
        className="flex min-h-10 items-center gap-6 rounded-md border border-border bg-muted/30 px-3"
      >
        {(["yes", "no"] as const).map((option) => (
          <span key={option} className="flex items-center gap-2 text-sm text-foreground">
            <RadioGroupItem value={option} className="disabled:opacity-100" />
            {option === "yes" ? "Yes" : "No"}
          </span>
        ))}
      </RadioGroup>
    </div>
  );
}

function InfoNote({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
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
  const capabilities = toLetUnitCapabilities(unit.unitType);
  const residentialUnit = capabilities.bedrooms;
  const showBathrooms = capabilities.bathrooms;
  const showBalconies = capabilities.balconies;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmed, setConfirmed] = useState(false);
  const facilities: ReadonlyArray<{
    key: keyof ToLetListingFormValues["facilityInclusions"];
    label: string;
    available: boolean;
    onChange?: (available: boolean) => void;
  }> = [
    { key: "water", label: "Water Supply", available: property.hasWaterSupply },
    { key: "gas", label: "Gas", available: property.hasGasConnection },
    { key: "electricity", label: "Electricity", available: property.hasElectricity },
    {
      key: "internet",
      label: "Internet",
      available: values.hasInternet,
      onChange: (available) => update("hasInternet", available),
    },
    { key: "lift", label: "Lift", available: property.hasLift },
    { key: "parking", label: "Parking", available: property.hasParking },
    { key: "generator", label: "Generator", available: property.hasGenerator },
    { key: "furnished", label: "Furnished", available: unit.isFurnished },
  ];
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

  const setAmountVisible = (visible: boolean) => {
    setValues((current) => ({
      ...current,
      monthlyRentVisible: visible,
      advanceAmountVisible: visible,
      securityDepositVisible: visible,
      serviceChargeVisible: visible,
      parkingChargeVisible: visible,
      utilityChargeVisible: visible,
    }));
  };

  const validateStep = () => {
    if (currentStep === lastStep) return true;
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
    setCurrentStep((step) => Math.min(lastStep, step + 1));
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
        router.push(
          `/account/to-let/properties/${property.propertyCode}/units/${unit.unitCode}`,
        );
        return;
      }
      setCurrentStep(lastStep);
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
        title={listing ? "Manage To-Let Listing" : "Create To-Let Listing"}
        description={`${property.name} · ${unit.name} · ${unit.unitCode}`}
        backHref={`/account/to-let/properties/${property.propertyCode}/units/${unit.unitCode}`}
        action={
          isPublicListingRenewalDue ? (
            <Button
              type="button"
              onClick={renewVisibility}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                <ExternalLink /> Open Listing Page
              </Link>
            </Button>
          ) : null
        }
      />

      {listing ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={listing.status} />
            <Badge variant="outline">
              {listing.visibility === "public" ? "Public" : "QR Only"}
            </Badge>
            <span className="font-mono text-xs text-muted-foreground">
              {listing.listingCode}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatMoney(listing.monthlyRent)} / month · {listing.viewCount}{" "}
            views
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Listing creation progress"
        className="rounded-lg border border-border bg-card px-3 py-4 sm:px-5"
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
                  aria-label={`Step ${step.id}: ${step.label}`}
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border text-xs font-semibold",
                      active
                        ? "border-emerald-600 text-emerald-700 ring-4 ring-emerald-50"
                        : completed
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    {completed ? <Check className="size-4" /> : step.id}
                  </span>
                  <span
                    className={cn(
                      "hidden text-xs sm:block",
                      active ? "text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </button>
                {index < steps.length - 1 ? (
                  <span
                    className={cn(
                      "mx-1 h-px flex-1 sm:mx-3",
                      completed ? "bg-emerald-500" : "bg-muted",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      {currentStep === 1 ? (
        <FormSection title="Step 1: Unit Details">
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadonlyField label="Property ID *" value={property.propertyCode} />
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
            {residentialUnit ? (
              <ReadonlyField label="Bedrooms *" value={unit.bedrooms} />
            ) : null}
            {showBathrooms ? (
              <ReadonlyField label="Bathrooms *" value={unit.bathrooms} />
            ) : null}
            {showBalconies ? (
              <ReadonlyField label="Balcony" value={unit.balconies} />
            ) : null}
            {residentialUnit ? (
              <>
                <YesNoField label="Kitchen" value={unit.hasKitchen} />
                <YesNoField label="Drawing Room" value={unit.hasDrawingRoom} />
                <YesNoField label="Dining Space" value={unit.hasDiningSpace} />
              </>
            ) : null}
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
                aria-describedby="preferred-tenant-help"
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
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground"
                    >
                      <RadioGroupItem
                        id={`preferred-${option.value}`}
                        value={option.value}
                      />
                      {option.label}
                    </label>
                  ))}
              </RadioGroup>
              <InfoNote id="preferred-tenant-help">
                Select the type of tenant you prefer for this unit. Select
                &ldquo;Any&rdquo; if there is no tenant-type restriction.
              </InfoNote>
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
      ) : null}

      {currentStep === 2 ? (
        <FormSection title="Step 2: Facilities">
          <div className="space-y-2">
            <InfoNote>Select the facilities available in this unit.</InfoNote>
            <InfoNote>
              &ldquo;Included&rdquo; means the facility/charge is included in
              the monthly rent. &ldquo;Excluded&rdquo; means the
              facility/charge is not included in the monthly rent and may be
              charged separately.
            </InfoNote>
          </div>
          <div className="mt-5 max-w-xl space-y-5">
            {facilities.map((facility) => {
              const id = `facility-${facility.key}`;
              const inclusion = values.facilityInclusions[facility.key];
              return (
                <div key={facility.key} className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {facility.label}
                  </p>
                  <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border border-border px-4 py-2">
                    <label
                      htmlFor={id}
                      className={cn(
                        "flex items-center gap-2 text-sm text-foreground",
                        facility.onChange ? "cursor-pointer" : "cursor-default",
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={facility.available}
                        disabled={!facility.onChange}
                        className="disabled:opacity-100"
                        onCheckedChange={(checked) =>
                          facility.onChange?.(checked === true)
                        }
                      />
                      {facility.label}
                    </label>
                    <RadioGroup
                      aria-label={`${facility.label} rent inclusion`}
                      disabled={!facility.available}
                      value={
                        !facility.available
                          ? "excluded"
                          : inclusion === true
                            ? "included"
                            : inclusion === false
                              ? "excluded"
                              : ""
                      }
                      onValueChange={(value) =>
                        update("facilityInclusions", {
                          ...values.facilityInclusions,
                          [facility.key]: value === "included",
                        })
                      }
                      className="flex w-auto gap-4"
                    >
                      {(["included", "excluded"] as const).map((option) => (
                        <label
                          key={option}
                          htmlFor={`${id}-${option}`}
                          className="flex cursor-pointer items-center gap-1.5 text-sm text-foreground"
                        >
                          <RadioGroupItem id={`${id}-${option}`} value={option} />
                          {option === "included" ? "Included" : "Excluded"}
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 space-y-1.5">
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
      ) : null}

      {currentStep === 3 ? (
        <FormSection title="Step 3: Rent">
          <div className="space-y-2">
            <Label>Amount Visibility</Label>
            <RadioGroup
              value={values.monthlyRentVisible ? "open" : "hide"}
              onValueChange={(value) => setAmountVisible(value === "open")}
              className="flex gap-6"
              aria-describedby="amount-visibility-help"
            >
              {(["open", "hide"] as const).map((option) => (
                <label
                  key={option}
                  htmlFor={`amount-${option}`}
                  className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <RadioGroupItem id={`amount-${option}`} value={option} />
                  {option === "open" ? "Open" : "Hide"}
                </label>
              ))}
            </RadioGroup>
            <InfoNote id="amount-visibility-help">
              Select &ldquo;Open&rdquo; when you want visitors to see the amount
              before contacting you. Select &ldquo;Hide&rdquo; when you do not
              want the amount publicly displayed.
            </InfoNote>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <MoneyField
              id="monthly-rent"
              label="Rent"
              value={values.monthlyRent}
              error={errors.monthlyRent}
              onChange={(value) => update("monthlyRent", value)}
            />
            <MoneyField
              id="advance-amount"
              label="Advance"
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
            <MoneyField
              id="service-charge"
              label="Service Charge"
              value={values.serviceCharge}
              error={errors.serviceCharge}
              onChange={(value) => update("serviceCharge", value)}
            />
            <MoneyField
              id="parking-charge"
              label="Parking"
              value={values.parkingCharge}
              error={errors.parkingCharge}
              onChange={(value) => update("parkingCharge", value)}
            />
            <MoneyField
              id="utility-charge"
              label="Utility Charge"
              value={values.utilityCharge}
              error={errors.utilityCharge}
              onChange={(value) => update("utilityCharge", value)}
            />
            <ReadonlyField label="Contact Person" value={property.ownerName} />
            <ReadonlyField label="Contact Number" value={property.mobileNumber} />
            <div className="space-y-1.5 sm:col-span-2">
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

      {currentStep === 4 ? (
        <div className="space-y-5">
          <FormSection title="Step 4: Review & Publish">
            <dl className="divide-y divide-border">
              {[
                ["Property", property.name],
                ["Unit", unit.name],
                ["Category", humanize(unit.unitType)],
                ["Location", `${property.area}, ${property.district}`],
                [
                  "Preferred Tenant",
                  preferredTenantOptions.find(
                    (option) => option.value === values.preferredTenant,
                  )?.label ?? values.preferredTenant,
                ],
                ["Rent", formatMoney(values.monthlyRent)],
                ["Advance", formatMoney(values.advanceAmount)],
                ["Contact Person", property.ownerName],
                ["Contact Number", property.mobileNumber],
                ["Available From", values.availableFrom],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"
                >
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">
                Facilities
              </h3>
              <div className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {[
                  ...facilities.map(
                    (facility) => [facility.label, facility.available] as const,
                  ),
                  ["Security", property.hasSecurityGuard] as const,
                  ["CCTV", property.hasCctv] as const,
                ]
                  .filter(([, available]) => available)
                  .map(([label]) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <Check className="size-4 text-emerald-600" /> {label}
                    </div>
                  ))}
              </div>
              {values.otherFacilities ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {values.otherFacilities}
                </p>
              ) : null}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">
                Publishing Information
              </h3>
              <dl className="mt-3 grid gap-1 sm:grid-cols-[10rem_1fr]">
                <dt className="text-sm text-muted-foreground">Price Visibility</dt>
                <dd className="text-sm font-medium text-foreground">
                  {values.monthlyRentVisible ? "Open" : "Hide"}
                </dd>
              </dl>
              <label
                htmlFor="listing-confirm"
                className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-foreground"
              >
                <Checkbox
                  id="listing-confirm"
                  checked={confirmed}
                  onCheckedChange={(checked) => setConfirmed(checked === true)}
                  className="mt-0.5"
                />
                I confirm that the information provided for this rental listing
                is accurate.
              </label>
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
                <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90">
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

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-card px-4 py-4 sm:static sm:mx-0 sm:rounded-lg sm:border sm:px-5">
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

          {currentStep < lastStep ? (
            <Button
              type="button"
              onClick={next}
              disabled={isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                  disabled={isPending || !confirmed}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isPending ? <Loader2 className="animate-spin" /> : null}
                  {listing?.status === "paused" ? "Publish Again" : "Publish"}
                  {isPending ? null : <ArrowRight />}
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
