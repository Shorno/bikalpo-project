"use client";

import { retailerBusinessLocationSchema } from "@bikalpo-project/api/routers/helpers/retailer-profile-fields";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ContactRound,
  FileText,
  Loader2,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LocationPickerSection } from "@/components/features/onboarding/location-picker-section";
import { FinancialSettingsSection } from "@/components/features/settings/financial-settings-section";
import { PropertyLocationFields } from "@/components/features/to-let/property/property-location-fields";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizeBangladeshDistrict,
  normalizeBangladeshDivision,
} from "@/constants/bangladesh-locations";
import {
  BUSINESS_NATURES,
  GENDERS,
  MONTHLY_SALES_VOLUME,
  YEARS_IN_BUSINESS,
} from "@/constants/seller-registration";
import { useUpdateRegistrationProfile } from "@/hooks/use-shop-owner-api";
import { authClient } from "@/lib/auth-client";
import { fileToDataUrl } from "@/lib/cloudinary";
import {
  abandonProfileDocumentSession,
  activateProfileDocumentSession,
  cleanupProfileDocument,
  drainProfileDocumentCleanup,
  queueProfileDocumentCleanup,
  releaseProfileDocumentSession,
  retainProfileDocument,
} from "@/lib/profile-document-cleanup";
import { getPublicIdFromUrl } from "@/utils/getPublicIdFromUrl";
import { client, orpc } from "@/utils/orpc";

type ProfileForm = {
  profilePhotoUrl: string;
  ownerName: string;
  dateOfBirth: string;
  gender: string;
  personalAddress: string;
  personalArea: string;
  personalDistrict: string;
  personalDivision: string;
  personalPostCode: string;
  personalLatitude: number;
  personalLongitude: number;
  shopLogo: string;
  shopName: string;
  businessType: string;
  productTypeId: string;
  businessNature: string;
  yearsInBusiness: string;
  monthlyRevenue: string;
  binNumber: string;
  tinNumber: string;
  tradeLicenseNumber: string;
  shopAddress: string;
  area: string;
  thana: string;
  district: string;
  division: string;
  postCode: string;
  latitude: number;
  longitude: number;
  phoneNumber: string;
  email: string;
  whatsappNumber: string;
  facebookUrl: string;
  messengerUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  telegramUrl: string;
  tiktokUrl: string;
  twitterUrl: string;
  tradeLicenseDocument: string;
  nidDocument: string;
  shopPhoto: string;
  storeFrontPhoto: string;
  warehousePhoto: string;
};

type BusinessLocationErrors = Partial<
  Record<"division" | "district" | "upazila" | "area", string>
>;

const DOCUMENT_FIELDS = [
  ["nidDocument", "National ID (NID)"],
  ["tradeLicenseDocument", "Trade license"],
  ["shopPhoto", "Shop photo"],
  ["storeFrontPhoto", "Storefront photo"],
  ["warehousePhoto", "Warehouse photo (optional)"],
] as const satisfies ReadonlyArray<readonly [keyof ProfileForm, string]>;

async function deleteCloudinaryAsset(url: string, knownPublicId?: string) {
  const publicId = knownPublicId || getPublicIdFromUrl(url);
  if (!publicId) return true;
  return cleanupProfileDocument(publicId);
}

const EMPTY_FORM: ProfileForm = {
  profilePhotoUrl: "",
  ownerName: "",
  dateOfBirth: "",
  gender: "",
  personalAddress: "",
  personalArea: "",
  personalDistrict: "",
  personalDivision: "",
  personalPostCode: "",
  personalLatitude: 0,
  personalLongitude: 0,
  shopLogo: "",
  shopName: "",
  businessType: "retail",
  productTypeId: "",
  businessNature: "",
  yearsInBusiness: "",
  monthlyRevenue: "",
  binNumber: "",
  tinNumber: "",
  tradeLicenseNumber: "",
  shopAddress: "",
  area: "",
  thana: "",
  district: "",
  division: "",
  postCode: "",
  latitude: 0,
  longitude: 0,
  phoneNumber: "",
  email: "",
  whatsappNumber: "",
  facebookUrl: "",
  messengerUrl: "",
  instagramUrl: "",
  websiteUrl: "",
  telegramUrl: "",
  tiktokUrl: "",
  twitterUrl: "",
  tradeLicenseDocument: "",
  nidDocument: "",
  shopPhoto: "",
  storeFrontPhoto: "",
  warehousePhoto: "",
};

const RETAIL_BUSINESS_NATURES = BUSINESS_NATURES.filter((nature) =>
  ["retail_shop", "manufacturer", "importer"].includes(nature.id),
);

function text(value: string | null | undefined) {
  return value || "";
}

function coordinate(value: string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formFromProfile(
  profile: Awaited<
    ReturnType<typeof client.shopOwner.getMyRegistrationProfile>
  >,
): ProfileForm {
  const { account, application } = profile;
  const documents = application.documentUrls ?? {};
  const division = normalizeBangladeshDivision(text(application.division));
  return {
    profilePhotoUrl: text(application.profilePhotoUrl || account.image),
    ownerName: text(application.ownerName || account.ownerName || account.name),
    dateOfBirth: text(application.dateOfBirth),
    gender: text(application.gender),
    personalAddress: text(application.personalAddress),
    personalArea: text(application.personalArea),
    personalDistrict: text(application.personalDistrict),
    personalDivision: text(application.personalDivision),
    personalPostCode: text(application.personalPostCode),
    personalLatitude: coordinate(application.personalLatitude),
    personalLongitude: coordinate(application.personalLongitude),
    shopLogo: text(account.shopLogo),
    shopName: text(account.shopName || application.shopName),
    businessType: text(
      account.businessType || application.businessType || "retail",
    ),
    productTypeId: application.productTypeId
      ? String(application.productTypeId)
      : "",
    businessNature: text(application.businessNature),
    yearsInBusiness: text(application.yearsInBusiness),
    monthlyRevenue: text(application.monthlyRevenue),
    binNumber: text(application.binNumber),
    tinNumber: text(application.tinNumber),
    tradeLicenseNumber: text(application.tradeLicenseNumber),
    shopAddress: text(account.shopAddress || application.shopAddress),
    area: text(application.area),
    thana: text(application.thana),
    district: normalizeBangladeshDistrict(text(application.district), division),
    division,
    postCode: text(application.postCode),
    latitude: coordinate(application.latitude || account.shopLat),
    longitude: coordinate(application.longitude || account.shopLng),
    phoneNumber: text(application.phoneNumber),
    email: text(application.email),
    whatsappNumber: text(application.whatsappNumber),
    facebookUrl: text(application.facebookUrl),
    messengerUrl: text(application.messengerUrl),
    instagramUrl: text(application.instagramUrl),
    websiteUrl: text(application.websiteUrl),
    telegramUrl: text(application.telegramUrl),
    tiktokUrl: text(application.tiktokUrl),
    twitterUrl: text(application.twitterUrl),
    tradeLicenseDocument: text(documents.tradeLicense),
    nidDocument: text(documents.nid),
    shopPhoto: text(documents.shopPhoto),
    storeFrontPhoto: text(documents.storeFront),
    warehousePhoto: text(documents.warehouse),
  };
}

function FormSection({
  children,
  description,
  icon: Icon,
  id,
  title,
}: {
  children: React.ReactNode;
  description: string;
  icon: typeof UserRound;
  id?: string;
  title: string;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white"
    >
      <div className="flex items-start gap-3 border-b bg-gray-50/70 px-5 py-4 sm:px-6">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#003178]/10 text-[#003178]">
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-950">{title}</h2>
          <p className="mt-0.5 text-sm leading-5 text-gray-500">
            {description}
          </p>
        </div>
      </div>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  );
}

function FormField({
  children,
  hint,
  id,
  label,
}: {
  children: React.ReactNode;
  hint?: string;
  id: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs leading-5 text-gray-500">{hint}</p>}
    </div>
  );
}

function DocumentUploadField({
  disabled,
  folder,
  label,
  onChange,
  onUploadingChange,
  value,
}: {
  disabled: boolean;
  folder: string;
  label: string;
  onChange: (value: string, publicId?: string) => void;
  onUploadingChange: (uploading: boolean) => void;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please choose a file smaller than 5 MB");
      return;
    }
    setUploading(true);
    onUploadingChange(true);
    try {
      const result = await client.cloudinary.upload({
        file: await fileToDataUrl(file),
        folder,
      });
      if (!result.success) throw new Error(result.error);
      onChange(result.url, result.publicId);
      toast.success(`${label} uploaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          {value ? (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block max-w-md truncate text-xs text-[#003178] hover:underline"
            >
              View current file
            </a>
          ) : (
            <p className="mt-1 text-xs text-gray-500">No file provided</p>
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading && <Loader2 className="size-4 animate-spin" />}
            {value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={disabled || uploading}
              onClick={() => onChange("")}
              aria-label={`Remove ${label}`}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RetailerRegistrationProfileEditor() {
  const router = useRouter();
  const { refetch: refetchSession } = authClient.useSession();
  const profileQuery = useQuery({
    ...orpc.shopOwner.getMyRegistrationProfile.queryOptions(),
    retry: false,
  });
  const profileData = profileQuery.data;
  const { data: productTypeData } = useQuery({
    ...orpc.adminProductType.getActiveTypes.queryOptions(),
  });
  const mutation = useUpdateRegistrationProfile();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<ProfileForm>(EMPTY_FORM);
  const [activeUploads, setActiveUploads] = useState(0);
  const [financialEditorDirty, setFinancialEditorDirty] = useState(false);
  const [showLocationErrors, setShowLocationErrors] = useState(false);
  const uploadedDocuments = useRef(new Map<string, string>());
  const cleanupSessionId = useRef(crypto.randomUUID());
  const navigationApproved = useRef(false);
  const restoringHistory = useRef(false);

  useEffect(() => {
    if (!profileData) return;
    const next = formFromProfile(profileData);
    setForm(next);
    setInitialForm(next);

    const sectionId = window.location.hash.slice(1);
    if (sectionId) {
      window.requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ block: "start" });
      });
    }
  }, [profileData]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );
  const hasUnsavedChanges = isDirty || financialEditorDirty;
  const locationResult = retailerBusinessLocationSchema.safeParse(form);
  const locationErrors: BusinessLocationErrors = {};
  if (!locationResult.success) {
    for (const issue of locationResult.error.issues) {
      const field = issue.path[0] === "thana" ? "upazila" : issue.path[0];
      if (
        field === "division" ||
        field === "district" ||
        field === "upazila" ||
        field === "area"
      ) {
        locationErrors[field] = issue.message;
      }
    }
  }

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || navigationApproved.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const confirmNavigation = () =>
      window.confirm("Discard your unsaved registration profile changes?");

    const protectLinkNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor =
        target instanceof Element
          ? target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!anchor || anchor.download || anchor.target === "_blank") return;

      const currentUrl = new URL(window.location.href);
      const destinationUrl = new URL(anchor.href, currentUrl);
      const staysOnDocument =
        destinationUrl.origin === currentUrl.origin &&
        destinationUrl.pathname === currentUrl.pathname &&
        destinationUrl.search === currentUrl.search;
      if (staysOnDocument) return;

      if (!confirmNavigation()) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      navigationApproved.current = true;
      abandonProfileDocumentSession(cleanupSessionId.current);
    };

    const protectHistoryNavigation = () => {
      if (restoringHistory.current) {
        restoringHistory.current = false;
        return;
      }

      if (confirmNavigation()) {
        navigationApproved.current = true;
        abandonProfileDocumentSession(cleanupSessionId.current);
        return;
      }

      restoringHistory.current = true;
      window.history.forward();
    };

    document.addEventListener("click", protectLinkNavigation, true);
    window.addEventListener("popstate", protectHistoryNavigation);
    return () => {
      document.removeEventListener("click", protectLinkNavigation, true);
      window.removeEventListener("popstate", protectHistoryNavigation);
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    activateProfileDocumentSession(cleanupSessionId.current);
    void drainProfileDocumentCleanup();
    const heartbeat = window.setInterval(
      () => activateProfileDocumentSession(cleanupSessionId.current),
      30_000,
    );
    return () => window.clearInterval(heartbeat);
  }, []);

  const update = (field: keyof ProfileForm, value: string | number) =>
    setForm((current) => ({ ...current, [field]: value }));

  const onUploadStateChange = (uploading: boolean) => {
    setActiveUploads((count) => Math.max(0, count + (uploading ? 1 : -1)));
  };

  const updateDocument = (
    field: keyof ProfileForm,
    value: string,
    publicId?: string,
  ) => {
    const previousUrl = String(form[field] || "");
    const previousUploadId = uploadedDocuments.current.get(previousUrl);
    if (previousUploadId && previousUrl !== value) {
      uploadedDocuments.current.delete(previousUrl);
      void deleteCloudinaryAsset(previousUrl, previousUploadId);
    }
    if (value && publicId) {
      uploadedDocuments.current.set(value, publicId);
      queueProfileDocumentCleanup(publicId, cleanupSessionId.current);
    }
    update(field, value);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!locationResult.success) {
      setShowLocationErrors(true);
      const firstField = Object.keys(locationErrors)[0];
      document.getElementById(`property-${firstField}`)?.focus();
      return;
    }
    try {
      await mutation.mutateAsync({
        applicant: {
          profilePhotoUrl: nullable(form.profilePhotoUrl),
          ownerName: form.ownerName,
          dateOfBirth: nullable(form.dateOfBirth),
          gender: nullable(form.gender) as "male" | "female" | "other" | null,
          personalAddress: nullable(form.personalAddress),
          personalArea: nullable(form.personalArea),
          personalDistrict: nullable(form.personalDistrict),
          personalDivision: nullable(form.personalDivision),
          personalPostCode: nullable(form.personalPostCode),
          personalLatitude: form.personalLatitude || null,
          personalLongitude: form.personalLongitude || null,
        },
        business: {
          shopLogo: nullable(form.shopLogo),
          shopName: form.shopName,
          businessType: form.businessType as "retail" | "restaurant",
          productTypeId: form.productTypeId ? Number(form.productTypeId) : null,
          businessNature: nullable(form.businessNature) as
            | "retail_shop"
            | "manufacturer"
            | "importer"
            | null,
          yearsInBusiness: nullable(form.yearsInBusiness),
          monthlyRevenue: nullable(form.monthlyRevenue),
          binNumber: nullable(form.binNumber),
          tinNumber: nullable(form.tinNumber),
          tradeLicenseNumber: nullable(form.tradeLicenseNumber),
          shopAddress: form.shopAddress,
          ...locationResult.data,
          postCode: nullable(form.postCode),
          latitude: form.latitude || null,
          longitude: form.longitude || null,
        },
        contacts: {
          phoneNumber: form.phoneNumber,
          email: nullable(form.email),
          whatsappNumber: nullable(form.whatsappNumber),
          facebookUrl: nullable(form.facebookUrl),
          messengerUrl: nullable(form.messengerUrl),
          instagramUrl: nullable(form.instagramUrl),
          websiteUrl: nullable(form.websiteUrl),
          telegramUrl: nullable(form.telegramUrl),
          tiktokUrl: nullable(form.tiktokUrl),
          twitterUrl: nullable(form.twitterUrl),
        },
        documents: {
          tradeLicense: nullable(form.tradeLicenseDocument),
          nid: nullable(form.nidDocument),
          shopPhoto: nullable(form.shopPhoto),
          storeFront: nullable(form.storeFrontPhoto),
          warehouse: nullable(form.warehousePhoto),
        },
      });
      for (const publicId of uploadedDocuments.current.values()) {
        retainProfileDocument(publicId);
      }
      uploadedDocuments.current.clear();
      releaseProfileDocumentSession(cleanupSessionId.current);

      const supersededDocuments = DOCUMENT_FIELDS.flatMap(([field]) => {
        const previousUrl = String(initialForm[field] || "");
        return previousUrl && previousUrl !== form[field] ? [previousUrl] : [];
      });
      const cleanupResults = await Promise.allSettled(
        supersededDocuments.map((url) => deleteCloudinaryAsset(url)),
      );
      if (
        cleanupResults.some(
          (result) => result.status === "rejected" || !result.value,
        )
      ) {
        toast.warning(
          "Profile saved, but an old document could not be removed. Please contact support.",
        );
      }
      await refetchSession();
      router.push("/dashboard/settings/profile");
    } catch {
      // The mutation hook keeps the page open and presents the server error.
    }
  };

  if (profileQuery.isPending) return <EditorSkeleton />;

  if (profileQuery.isError || !profileData) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
        <h1 className="text-xl font-semibold text-amber-950">
          Registration profile unavailable
        </h1>
        <p className="mt-2 text-sm text-amber-800">
          The profile must be available before it can be edited.
        </p>
        <Button asChild className="mt-5">
          <Link href="/dashboard/settings/profile">Back to profile</Link>
        </Button>
      </div>
    );
  }

  const isSaving = mutation.isPending || activeUploads > 0;
  const uploadFolder = `registration-profiles/${profileData.account.id}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <form
        id="registration-profile-form"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Button
              asChild
              variant="ghost"
              className="-ml-3 mb-2 text-gray-600"
            >
              <Link href="/dashboard/settings/profile">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Registration Profile
              </Link>
            </Button>
            <h1 className="text-2xl font-bold tracking-tight text-gray-950">
              Edit Registration Profile
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Update the information connected to your registration. Document
              changes will be submitted for verification.
            </p>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Application {profileData.application.applicationNumber || "record"}
          </div>
        </div>

        <FormSection
          id="applicant-information"
          title="Applicant information"
          description="The owner identity and personal location recorded during registration."
          icon={UserRound}
        >
          <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <div>
              <Label>Profile photo</Label>
              <div className="mt-2">
                <ImageUploader
                  value={form.profilePhotoUrl}
                  onChange={(value) => update("profilePhotoUrl", value)}
                  folder={`${uploadFolder}/profile-photo`}
                  maxSizeMB={3}
                  deleteOnRemove={false}
                  disabled={isSaving}
                  onUploadStateChange={onUploadStateChange}
                />
              </div>
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2">
              <FormField id="owner-name" label="Owner name">
                <Input
                  id="owner-name"
                  value={form.ownerName}
                  onChange={(event) => update("ownerName", event.target.value)}
                  minLength={2}
                  maxLength={100}
                  required
                />
              </FormField>
              <FormField id="date-of-birth" label="Date of birth">
                <Input
                  id="date-of-birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    update("dateOfBirth", event.target.value)
                  }
                />
              </FormField>
              <FormField id="gender" label="Gender">
                <Select
                  value={form.gender || "not_provided"}
                  onValueChange={(value) =>
                    update("gender", value === "not_provided" ? "" : value)
                  }
                >
                  <SelectTrigger id="gender" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_provided">Not provided</SelectItem>
                    {GENDERS.map((gender) => (
                      <SelectItem key={gender.id} value={gender.id}>
                        {gender.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>

          <LocationPickerSection
            label="Personal location"
            inputId="personal-location-search"
            description="Search for the owner's home location or drag the map pin."
            data={{
              address: form.personalAddress,
              addressBn: "",
              area: form.personalArea,
              thana: "",
              district: form.personalDistrict,
              division: form.personalDivision,
              postCode: form.personalPostCode,
              latitude: form.personalLatitude,
              longitude: form.personalLongitude,
            }}
            onUpdate={(location) =>
              setForm((current) => ({
                ...current,
                personalAddress: location.address,
                personalArea: location.area,
                personalDistrict: location.district,
                personalDivision: location.division,
                personalPostCode: location.postCode,
                personalLatitude: location.latitude,
                personalLongitude: location.longitude,
              }))
            }
          />
        </FormSection>

        <BusinessInformationFormSection
          form={form}
          locationErrors={showLocationErrors ? locationErrors : {}}
          setForm={setForm}
          update={update}
          uploadFolder={uploadFolder}
          isSaving={isSaving}
          onUploadStateChange={onUploadStateChange}
          productTypes={productTypeData?.types ?? []}
        />

        <FormSection
          id="tax-and-license"
          title="Tax and license"
          description="Business identifiers submitted for verification and compliance."
          icon={ShieldCheck}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="bin-number" label="BIN number">
              <Input
                id="bin-number"
                value={form.binNumber}
                onChange={(event) => update("binNumber", event.target.value)}
                maxLength={100}
              />
            </FormField>
            <FormField id="tin-number" label="TIN number">
              <Input
                id="tin-number"
                value={form.tinNumber}
                onChange={(event) => update("tinNumber", event.target.value)}
                maxLength={100}
              />
            </FormField>
            <FormField id="trade-license-number" label="Trade license number">
              <Input
                id="trade-license-number"
                value={form.tradeLicenseNumber}
                onChange={(event) =>
                  update("tradeLicenseNumber", event.target.value)
                }
                maxLength={100}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection
          id="contact-information"
          title="Business contacts"
          description="Public contact details and social channels customers can use."
          icon={ContactRound}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="public-phone"
              label="Public phone"
              hint="This does not change the phone number used to sign in."
            >
              <Input
                id="public-phone"
                type="tel"
                value={form.phoneNumber}
                onChange={(event) => update("phoneNumber", event.target.value)}
                minLength={10}
                maxLength={20}
                required
              />
            </FormField>
            <FormField
              id="public-email"
              label="Public email"
              hint="This does not change the email address used to sign in."
            >
              <Input
                id="public-email"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                maxLength={320}
              />
            </FormField>
            <FormField id="whatsapp" label="WhatsApp">
              <Input
                id="whatsapp"
                type="tel"
                value={form.whatsappNumber}
                onChange={(event) =>
                  update("whatsappNumber", event.target.value)
                }
                maxLength={20}
              />
            </FormField>
            {[
              ["facebookUrl", "Facebook", "facebook-url"],
              ["messengerUrl", "Messenger", "messenger-url"],
              ["instagramUrl", "Instagram", "instagram-url"],
              ["websiteUrl", "Website", "website-url"],
              ["telegramUrl", "Telegram", "telegram-url"],
              ["tiktokUrl", "TikTok", "tiktok-url"],
              ["twitterUrl", "X (Twitter)", "twitter-url"],
            ].map(([field, label, id]) => (
              <FormField key={field} id={id} label={label}>
                <Input
                  id={id}
                  type="url"
                  value={form[field as keyof ProfileForm] as string}
                  onChange={(event) =>
                    update(field as keyof ProfileForm, event.target.value)
                  }
                  placeholder="https://"
                  maxLength={2048}
                />
              </FormField>
            ))}
          </div>
        </FormSection>

        <FormSection
          id="verification-documents"
          title="Verification documents"
          description="Replacing or removing a document sends the profile back for verification."
          icon={FileText}
        >
          <div className="space-y-3">
            {DOCUMENT_FIELDS.map(([field, label]) => (
              <DocumentUploadField
                key={field}
                label={label}
                value={String(form[field] || "")}
                onChange={(value, publicId) =>
                  updateDocument(field, value, publicId)
                }
                folder={`${uploadFolder}/documents`}
                disabled={mutation.isPending}
                onUploadingChange={onUploadStateChange}
              />
            ))}
          </div>
        </FormSection>
      </form>

      <FinancialSettingsSection
        inlineEditor
        onEditorDirtyChange={setFinancialEditorDirty}
        sectionId="banking-information"
      />

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-3 md:pl-[calc(var(--sidebar-width)+1rem)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <p
            className="hidden text-sm text-gray-500 sm:block"
            aria-live="polite"
          >
            {activeUploads > 0
              ? "Finish uploading files before saving."
              : financialEditorDirty
                ? "Save or cancel the open financial account changes."
                : isDirty
                  ? "You have unsaved changes."
                  : "No unsaved changes."}
          </p>
          <div className="ml-auto flex gap-3">
            {isSaving ? (
              <Button type="button" variant="outline" disabled>
                Cancel
              </Button>
            ) : (
              <Button asChild type="button" variant="outline">
                <Link href="/dashboard/settings/profile">Cancel</Link>
              </Button>
            )}
            <Button
              type="submit"
              form="registration-profile-form"
              disabled={!isDirty || isSaving || financialEditorDirty}
              className="min-w-32 bg-[#003178] hover:bg-[#00255c]"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Save profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-[32rem] max-w-full" />
      </div>
      <Skeleton className="h-[28rem] rounded-xl" />
      <Skeleton className="h-[34rem] rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function BusinessInformationFormSection({
  form,
  locationErrors,
  isSaving,
  onUploadStateChange,
  productTypes,
  setForm,
  update,
  uploadFolder,
}: {
  form: ProfileForm;
  locationErrors: BusinessLocationErrors;
  isSaving: boolean;
  onUploadStateChange: (uploading: boolean) => void;
  productTypes: Array<{ id: number; name: string }>;
  setForm: React.Dispatch<React.SetStateAction<ProfileForm>>;
  update: (field: keyof ProfileForm, value: string | number) => void;
  uploadFolder: string;
}) {
  return (
    <FormSection
      id="business-information"
      title="Business information"
      description="Business identity, registration category, operating history, and storefront logo."
      icon={Building2}
    >
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div>
          <Label>Company logo</Label>
          <div className="mt-2">
            <ImageUploader
              value={form.shopLogo}
              onChange={(value) => update("shopLogo", value)}
              folder={`${uploadFolder}/shop-logo`}
              maxSizeMB={3}
              deleteOnRemove={false}
              disabled={isSaving}
              onUploadStateChange={onUploadStateChange}
            />
          </div>
        </div>
        <div className="grid content-start gap-4 sm:grid-cols-2">
          <FormField id="shop-name" label="Business name">
            <Input
              id="shop-name"
              value={form.shopName}
              onChange={(event) => update("shopName", event.target.value)}
              minLength={2}
              maxLength={150}
              required
            />
          </FormField>
          <FormField id="business-type" label="Platform type">
            <Select
              value={form.businessType}
              onValueChange={(value) => update("businessType", value)}
            >
              <SelectTrigger id="business-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail Shop</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="product-type" label="Product type">
            <Select
              value={form.productTypeId || "not_provided"}
              onValueChange={(value) =>
                update("productTypeId", value === "not_provided" ? "" : value)
              }
            >
              <SelectTrigger id="product-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_provided">Not provided</SelectItem>
                {productTypes.map((productType) => (
                  <SelectItem
                    key={productType.id}
                    value={String(productType.id)}
                  >
                    {productType.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="business-nature" label="Business nature">
            <Select
              value={form.businessNature || "not_provided"}
              onValueChange={(value) =>
                update("businessNature", value === "not_provided" ? "" : value)
              }
            >
              <SelectTrigger id="business-nature" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_provided">Not provided</SelectItem>
                {RETAIL_BUSINESS_NATURES.map((nature) => (
                  <SelectItem key={nature.id} value={nature.id}>
                    {nature.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="years-in-business" label="Years in business">
            <Select
              value={form.yearsInBusiness || "not_provided"}
              onValueChange={(value) =>
                update("yearsInBusiness", value === "not_provided" ? "" : value)
              }
            >
              <SelectTrigger id="years-in-business" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_provided">Not provided</SelectItem>
                {YEARS_IN_BUSINESS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField id="monthly-revenue" label="Monthly sales volume">
            <Select
              value={form.monthlyRevenue || "not_provided"}
              onValueChange={(value) =>
                update("monthlyRevenue", value === "not_provided" ? "" : value)
              }
            >
              <SelectTrigger id="monthly-revenue" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_provided">Not provided</SelectItem>
                {MONTHLY_SALES_VOLUME.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      <fieldset disabled={isSaving} className="min-w-0 space-y-4">
        <legend className="mb-2 text-sm font-medium">Business location</legend>
        <p className="text-sm text-muted-foreground">
          Select your division, district, upazila or thana, and area, then enter
          the full business address.
        </p>
        <PropertyLocationFields
          division={form.division}
          district={form.district}
          upazila={form.thana}
          area={form.area}
          errors={locationErrors}
          onChange={(field, value) => {
            const formField = field === "upazila" ? "thana" : field;
            setForm((current) =>
              current[formField] === value
                ? current
                : {
                    ...current,
                    [formField]: value,
                    postCode: "",
                    latitude: 0,
                    longitude: 0,
                  },
            );
          }}
        />
        <FormField id="business-address" label="Full Address *">
          <Textarea
            id="business-address"
            value={form.shopAddress}
            onChange={(event) => {
              const shopAddress = event.target.value;
              setForm((current) =>
                current.shopAddress === shopAddress
                  ? current
                  : { ...current, shopAddress, latitude: 0, longitude: 0 },
              );
            }}
            placeholder="Enter full business address"
            minLength={5}
            maxLength={500}
            rows={3}
            required
          />
        </FormField>
        <FormField id="business-post-code" label="Post code (optional)">
          <Input
            id="business-post-code"
            value={form.postCode}
            onChange={(event) => update("postCode", event.target.value)}
            maxLength={20}
            className="sm:max-w-xs"
          />
        </FormField>
        <Collapsible className="rounded-lg border p-4">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-between px-0 hover:bg-transparent"
            >
              Map location (optional)
              <ChevronDown className="size-4" aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <p className="text-sm text-muted-foreground">
            {form.latitude && form.longitude
              ? "A map pin is saved for this address."
              : "You can save without a map pin. Add one for directions."}
          </p>
          <CollapsibleContent className="pt-4">
            <LocationPickerSection
              label="Find on map"
              inputId="business-location-search"
              description="Search for the business address, use your current location, or drag the map pin to update the location fields."
              required={false}
              summaryLocationLevel="thana"
              data={{
                address: form.shopAddress,
                addressBn: "",
                area: form.area,
                thana: form.thana,
                district: form.district,
                division: form.division,
                postCode: form.postCode,
                latitude: form.latitude,
                longitude: form.longitude,
              }}
              onUpdate={(location) => {
                const division = normalizeBangladeshDivision(location.division);
                setForm((current) => ({
                  ...current,
                  shopAddress: location.address,
                  area: location.area,
                  thana: location.thana || "",
                  district: normalizeBangladeshDistrict(
                    location.district,
                    division,
                  ),
                  division,
                  postCode: location.postCode,
                  latitude: location.latitude,
                  longitude: location.longitude,
                }));
              }}
            />
          </CollapsibleContent>
        </Collapsible>
      </fieldset>
    </FormSection>
  );
}
