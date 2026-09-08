"use client";

import { computeProfileCompletion } from "@bikalpo-project/api/business-profile";
import type { sellerApplication } from "@bikalpo-project/db/schema";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ContactRound,
  Edit3,
  Loader2,
  MapPin,
  Save,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LocationPickerSection } from "@/components/features/onboarding/location-picker-section";
import { FinancialSettingsSection } from "@/components/features/settings/financial-settings-section";
import { PasswordSecuritySection } from "@/components/features/settings/password-security-section";
import {
  RetailerSubscriptionSection,
  useRetailerSubscription,
} from "@/components/features/settings/retailer-subscription";
import ImageUploader from "@/components/ImageUploader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { BUSINESS_NATURES } from "@/constants/seller-registration";
import {
  useUpdateBusinessContactInformation,
  useUpdateBusinessInformation,
  useUpdateShopLocation,
  useUpdateShopProfile,
} from "@/hooks/use-shop-owner-api";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

const AddressPicker = dynamic(
  () =>
    import("@/components/shared/address-picker").then(
      (mod) => mod.AddressPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[250px] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        Loading map...
      </div>
    ),
  },
);

const statusColors: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-700",
  disabled: "bg-gray-100 text-gray-600",
};

type BusinessApplication =
  | typeof sellerApplication.$inferSelect
  | null
  | undefined;
type ProfileUser = typeof authClient.$Infer.Session.user | undefined;

function displayValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "Not provided";
  return value.trim();
}

function formatLabel(value: unknown) {
  const text = displayValue(value);
  if (text === "Not provided") return text;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return "Not provided";
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return new Intl.DateTimeFormat("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function ShopSettingsPage() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const user = session?.user;
  const subscription = useRetailerSubscription();
  const {
    data: application,
    isPending: isApplicationPending,
    isError: isApplicationError,
    refetch: refetchApplication,
  } = useQuery({
    ...orpc.sellerApplication.getMyApplication.queryOptions(),
    enabled: Boolean(user?.id),
    retry: false,
  });
  const updateLocationMutation = useUpdateShopLocation();
  const updateProfileMutation = useUpdateShopProfile();

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [shopLogo, setShopLogo] = useState("");
  const [logoDialogOpen, setLogoDialogOpen] = useState(false);
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [openingTime, setOpeningTime] = useState("");
  const [closingTime, setClosingTime] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    setLat(user.shopLat || "");
    setLng(user.shopLng || "");
  }, [user?.id, user?.shopLat, user?.shopLng]);

  useEffect(() => {
    if (!user?.id) return;
    setOpeningTime(user?.shopOpeningTime || "");
    setClosingTime(user?.shopClosingTime || "");
  }, [user?.id, user?.shopClosingTime, user?.shopOpeningTime]);

  const handleSaveLocation = async () => {
    if (!lat || !lng) return;
    await updateLocationMutation.mutateAsync({ lat, lng });
  };

  const handleSaveProfile = async () => {
    await updateProfileMutation.mutateAsync({
      openingTime: openingTime || null,
      closingTime: closingTime || null,
    });
    await refetch();
  };

  if (isPending || (user?.id && isApplicationPending)) {
    return <BusinessProfileSkeleton />;
  }

  const status = user?.sellerStatus || application?.status;
  const hasIncompleteHours = Boolean(openingTime) !== Boolean(closingTime);
  const businessName = user?.shopName || application?.shopName;
  const businessNameLabel = displayValue(businessName);
  const businessType = user?.businessType || application?.businessType;
  const businessAddress = user?.shopAddress || application?.shopAddress;
  const email = application?.email || user?.email;
  const phoneNumber = application?.phoneNumber || user?.phoneNumber;
  const memberSince = user?.createdAt;
  const profileCompletion = computeProfileCompletion(application, user);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950">
          Business Profile
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Review the business information currently connected to your retail
          account.
        </p>
      </header>

      {isApplicationError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
        >
          Registration details could not be loaded. Some profile fields are
          unavailable.
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetchApplication()}
          >
            Retry
          </Button>
        </div>
      )}

      <section
        id="profile"
        className="overflow-hidden rounded-xl border bg-white"
        aria-labelledby="business-identity-heading"
      >
        <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="border-b bg-gray-50/70 p-6 lg:border-r lg:border-b-0">
            <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
              Company Logo
            </p>
            <div className="mt-4">
              <div className="relative flex h-36 items-center justify-center rounded-lg border bg-white">
                {user?.shopLogo ? (
                  <Image
                    src={user.shopLogo}
                    alt={`${businessNameLabel} company logo`}
                    fill
                    unoptimized
                    className="object-contain p-4"
                  />
                ) : (
                  <Building2
                    className="size-12 text-gray-300"
                    aria-label="No company logo"
                  />
                )}
              </div>
              <Dialog
                open={logoDialogOpen}
                onOpenChange={(open) => {
                  if (isLogoUploading || updateProfileMutation.isPending)
                    return;
                  setLogoDialogOpen(open);
                  if (open) setShopLogo(user?.shopLogo || "");
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-4 w-full">
                    Change Logo
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Change Logo</DialogTitle>
                    <DialogDescription>
                      Upload your company logo and save your changes.
                    </DialogDescription>
                  </DialogHeader>
                  <ImageUploader
                    value={shopLogo}
                    onChange={setShopLogo}
                    deleteOnRemove={false}
                    onUploadStateChange={setIsLogoUploading}
                    folder={`shop-logos/${user?.id || "shop"}`}
                    maxSizeMB={2}
                    disabled={
                      isLogoUploading || updateProfileMutation.isPending
                    }
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button
                        variant="outline"
                        disabled={
                          isLogoUploading || updateProfileMutation.isPending
                        }
                      >
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      disabled={
                        isLogoUploading || updateProfileMutation.isPending
                      }
                      onClick={async () => {
                        await updateProfileMutation.mutateAsync({
                          shopLogo: shopLogo || null,
                        });
                        await refetch();
                        setLogoDialogOpen(false);
                      }}
                    >
                      {updateProfileMutation.isPending && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      {isLogoUploading ? "Uploading logo..." : "Save Logo"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-8 p-6 sm:p-8">
            <div>
              <p className="font-mono text-xs font-semibold tracking-wide text-emerald-700">
                <span className="sr-only">Business ID: </span>
                {displayValue(application?.applicationNumber)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2
                  id="business-identity-heading"
                  className="text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl"
                >
                  {businessNameLabel}
                </h2>
                {status && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColors[status] || statusColors.disabled}`}
                  >
                    {status === "approved" && (
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    )}
                    {formatLabel(status)}
                  </span>
                )}
              </div>

              <dl className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                <IdentityItem
                  label="Type"
                  value={formatLabel(application?.businessCategory)}
                />
                <IdentityItem
                  label="Nature"
                  value={formatLabel(application?.businessNature)}
                />
                <div>
                  <dt className="text-xs text-gray-500">Profile completion</dt>
                  <dd className="mt-1 font-medium text-gray-900">
                    {profileCompletion}% Complete
                  </dd>
                  <progress
                    aria-label="Profile completion"
                    value={profileCompletion}
                    max={100}
                    className="mt-2 h-1.5 w-full accent-emerald-600"
                  />
                </div>
                <IdentityItem
                  label="Plan"
                  value={
                    subscription.data?.current?.planName || "Not available"
                  }
                />
                <IdentityItem label="Since" value={formatDate(memberSince)} />
              </dl>
            </div>

            <div className="flex justify-end border-t pt-5">
              <BusinessInformationDialog
                application={application}
                user={user}
                onSaved={refetch}
                triggerLabel="Edit Business Profile"
              />
            </div>
          </div>
        </div>
      </section>

      <nav
        aria-label="Business settings sections"
        className="flex gap-1 overflow-x-auto border-b"
      >
        <a
          href="#profile-information"
          aria-current="page"
          className="shrink-0 border-b-2 border-emerald-600 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          Profile
        </a>
        <a
          href="#storefront-settings"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          Settings
        </a>
        <a
          href="#financial-settings"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          Financial settings
        </a>
        <a
          href="#password-security"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          Password &amp; security
        </a>
        <Link
          href="/dashboard/user-roles"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          User management
        </Link>
        <Link
          href="/dashboard/user-roles#operational-controls"
          className="shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
        >
          Operational controls
        </Link>
      </nav>

      <section
        id="profile-information"
        className="grid overflow-hidden rounded-xl border bg-white md:grid-cols-2 xl:grid-cols-3"
        aria-label="Profile information"
      >
        <ProfileSection
          title="Business Info"
          icon={Building2}
          action={
            <BusinessInformationDialog
              application={application}
              user={user}
              onSaved={refetch}
            />
          }
        >
          <DetailRow label="Business Name" value={businessName} />
          <DetailRow label="Business Type" value={formatLabel(businessType)} />
          <DetailRow
            label="Business Category"
            value={application?.businessCategory}
          />
          <DetailRow label="Business Address" value={businessAddress} />
          <DetailRow label="District" value={application?.district} />
          <DetailRow label="Division" value={application?.division} />
          <DetailRow label="Thana" value={application?.thana} />
        </ProfileSection>

        <ProfileSection
          title="Contact Info"
          icon={ContactRound}
          action={
            <ContactInformationDialog application={application} user={user} />
          }
        >
          <DetailRow label="Mobile Number" value={phoneNumber} />
          <DetailRow label="WhatsApp" value={application?.whatsappNumber} />
          <DetailRow label="Email Address" value={email} />
          <DetailRow label="Facebook Page" value={application?.facebookUrl} />
          <DetailRow label="Messenger" value={application?.messengerUrl} />
          <DetailRow label="Website" value={application?.websiteUrl} />
          <DetailRow
            label="Telegram (Optional)"
            value={application?.telegramUrl}
          />
        </ProfileSection>

        <RetailerSubscriptionSection />
      </section>

      <section
        id="storefront-settings"
        className="overflow-hidden rounded-xl border bg-white"
        aria-labelledby="storefront-settings-heading"
      >
        <div className="border-b p-6">
          <h2
            id="storefront-settings-heading"
            className="flex items-center gap-2 text-lg font-semibold text-gray-950"
          >
            <Clock3 className="size-5 text-emerald-700" aria-hidden="true" />
            Storefront settings
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage the operating hours shown on your storefront.
          </p>
        </div>

        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:max-w-xl sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shop-opening-time">Opening time</Label>
              <Input
                id="shop-opening-time"
                type="time"
                value={openingTime}
                onChange={(event) => setOpeningTime(event.target.value)}
                disabled={updateProfileMutation.isPending}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-closing-time">Closing time</Label>
              <Input
                id="shop-closing-time"
                type="time"
                value={closingTime}
                onChange={(event) => setClosingTime(event.target.value)}
                disabled={updateProfileMutation.isPending}
                className="h-11"
              />
            </div>
          </div>

          {hasIncompleteHours && (
            <p className="text-sm text-red-600" role="alert">
              Set both opening and closing times, or clear both fields.
            </p>
          )}

          <div className="flex justify-end border-t pt-5">
            <Button
              onClick={handleSaveProfile}
              disabled={hasIncompleteHours || updateProfileMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save storefront settings
            </Button>
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-xl border bg-white"
        aria-labelledby="shop-location-heading"
      >
        <div className="border-b p-6">
          <h2
            id="shop-location-heading"
            className="flex items-center gap-2 text-lg font-semibold text-gray-950"
          >
            <MapPin className="size-5 text-emerald-700" aria-hidden="true" />
            Shop location
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Pin the exact shop location used to match nearby open orders.
          </p>
        </div>

        <div className="space-y-4 p-6">
          {lat && lng && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-gray-500">Current coordinates</span>
              <code className="rounded bg-gray-100 px-2 py-1 text-xs">
                {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
              </code>
            </div>
          )}

          <AddressPicker
            lat={lat}
            lng={lng}
            onLocationChange={(newLat, newLng) => {
              setLat(newLat);
              setLng(newLng);
            }}
            onAddressResolved={() => {}}
            height="300px"
          />

          <div className="flex justify-end">
            <Button
              onClick={handleSaveLocation}
              disabled={!lat || !lng || updateLocationMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateLocationMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving location...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save location
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      <FinancialSettingsSection />
      <PasswordSecuritySection
        phoneNumber={user?.phoneNumberVerified ? user.phoneNumber : null}
      />
    </div>
  );
}

const RETAIL_BUSINESS_NATURES = BUSINESS_NATURES.filter((nature) =>
  ["retail_shop", "manufacturer", "importer"].includes(nature.id),
);

const NOT_PROVIDED_VALUE = "__not_provided__";

function nullable(value: string) {
  return value.trim() || null;
}

function coordinateValue(value: unknown) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : 0;
}

function EditSectionButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 px-2.5 text-xs normal-case tracking-normal"
    >
      <Edit3 className="size-3.5" aria-hidden="true" />
      {props.children || "Edit"}
    </Button>
  );
}

function MissingRegistrationDialogContent({ section }: { section: string }) {
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Edit {section}</DialogTitle>
        <DialogDescription>
          This account does not have a linked business registration record, so
          these details cannot be saved yet.
        </DialogDescription>
      </DialogHeader>
      <div
        role="alert"
        className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950"
      >
        <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p className="text-sm leading-6">
          Contact support to link the original registration to this shop
          account, then return here to edit this section.
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button">Close</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function BusinessInformationDialog({
  application,
  user,
  onSaved,
  triggerLabel = "Edit Business Info",
}: {
  application: BusinessApplication;
  user: ProfileUser;
  onSaved: () => Promise<unknown>;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useUpdateBusinessInformation();
  const { data: productTypeData } = useQuery({
    ...orpc.adminProductType.getActiveTypes.queryOptions(),
    enabled: open,
  });
  const [form, setForm] = useState({
    shopName: "",
    ownerName: "",
    businessType: "",
    productTypeId: "",
    businessNature: "",
    shopAddress: "",
    area: "",
    thana: "",
    district: "",
    division: "",
    postCode: "",
    latitude: 0,
    longitude: 0,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      shopName: user?.shopName || application?.shopName || "",
      ownerName: user?.ownerName || application?.ownerName || "",
      businessType: user?.businessType || application?.businessType || "",
      productTypeId: application?.productTypeId
        ? String(application.productTypeId)
        : "",
      businessNature: application?.businessNature || "",
      shopAddress: user?.shopAddress || application?.shopAddress || "",
      area: application?.area || "",
      thana: application?.thana || "",
      district: application?.district || "",
      division: application?.division || "",
      postCode: application?.postCode || "",
      latitude: coordinateValue(application?.latitude || user?.shopLat),
      longitude: coordinateValue(application?.longitude || user?.shopLng),
    });
  }, [application, open, user]);

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await mutation.mutateAsync({
      shopName: form.shopName,
      ownerName: form.ownerName,
      businessType: form.businessType as "retail" | "restaurant",
      productTypeId: form.productTypeId ? Number(form.productTypeId) : null,
      businessNature: (form.businessNature || null) as
        | "retail_shop"
        | "manufacturer"
        | "importer"
        | null,
      shopAddress: form.shopAddress,
      area: nullable(form.area),
      thana: nullable(form.thana),
      district: nullable(form.district),
      division: nullable(form.division),
      postCode: nullable(form.postCode),
      latitude: form.latitude || null,
      longitude: form.longitude || null,
    });
    await onSaved();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <EditSectionButton>{triggerLabel}</EditSectionButton>
      </DialogTrigger>
      {!application ? (
        <MissingRegistrationDialogContent section="business information" />
      ) : (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit business information</DialogTitle>
            <DialogDescription>
              Update the business details originally submitted during
              registration.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="business-name" label="Business name">
                <Input
                  id="business-name"
                  value={form.shopName}
                  onChange={(event) => update("shopName", event.target.value)}
                  required
                  minLength={2}
                  maxLength={150}
                />
              </Field>
              <Field id="owner-name" label="Owner name">
                <Input
                  id="owner-name"
                  value={form.ownerName}
                  onChange={(event) => update("ownerName", event.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </Field>
              <Field id="business-type" label="Business type">
                <Select
                  value={form.businessType}
                  onValueChange={(value) => update("businessType", value)}
                >
                  <SelectTrigger id="business-type" className="h-9 w-full">
                    <SelectValue placeholder="Select a business type" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="business-category" label="Business category">
                <Select
                  value={form.productTypeId || NOT_PROVIDED_VALUE}
                  onValueChange={(value) =>
                    update(
                      "productTypeId",
                      value === NOT_PROVIDED_VALUE ? "" : value,
                    )
                  }
                >
                  <SelectTrigger id="business-category" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value={NOT_PROVIDED_VALUE}>
                      Not provided
                    </SelectItem>
                    {productTypeData?.types.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="business-nature" label="Business nature">
                <Select
                  value={form.businessNature || NOT_PROVIDED_VALUE}
                  onValueChange={(value) =>
                    update(
                      "businessNature",
                      value === NOT_PROVIDED_VALUE ? "" : value,
                    )
                  }
                >
                  <SelectTrigger id="business-nature" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value={NOT_PROVIDED_VALUE}>
                      Not provided
                    </SelectItem>
                    {RETAIL_BUSINESS_NATURES.map((nature) => (
                      <SelectItem key={nature.id} value={nature.id}>
                        {nature.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <LocationPickerSection
              label="Business location"
              description="Search with Barikoi, use your current location, or drag the map pin. Area, district, and division update automatically."
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
              onUpdate={(location) =>
                setForm((current) => ({
                  ...current,
                  shopAddress: location.address,
                  area: location.area,
                  thana: location.thana || "",
                  district: location.district,
                  division: location.division,
                  postCode: location.postCode,
                  latitude: location.latitude,
                  longitude: location.longitude,
                }))
              }
            />
            <Field id="business-thana" label="Thana">
              <Input
                id="business-thana"
                value={form.thana}
                onChange={(event) => update("thana", event.target.value)}
                maxLength={100}
              />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={
                  mutation.isPending ||
                  !form.businessType ||
                  !form.shopAddress ||
                  !form.latitude ||
                  !form.longitude
                }
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                Save business information
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

function ContactInformationDialog({
  application,
  user,
}: {
  application: BusinessApplication;
  user: ProfileUser;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useUpdateBusinessContactInformation();
  const [form, setForm] = useState({
    phoneNumber: "",
    email: "",
    whatsappNumber: "",
    facebookUrl: "",
    messengerUrl: "",
    websiteUrl: "",
    telegramUrl: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      phoneNumber: application?.phoneNumber || user?.phoneNumber || "",
      email: application?.email || user?.email || "",
      whatsappNumber: application?.whatsappNumber || "",
      facebookUrl: application?.facebookUrl || "",
      messengerUrl: application?.messengerUrl || "",
      websiteUrl: application?.websiteUrl || "",
      telegramUrl: application?.telegramUrl || "",
    });
  }, [application, open, user]);

  const update = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await mutation.mutateAsync({
      phoneNumber: form.phoneNumber,
      email: nullable(form.email),
      whatsappNumber: nullable(form.whatsappNumber),
      facebookUrl: nullable(form.facebookUrl),
      messengerUrl: nullable(form.messengerUrl),
      websiteUrl: nullable(form.websiteUrl),
      telegramUrl: nullable(form.telegramUrl),
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <EditSectionButton>Edit Contact Info</EditSectionButton>
      </DialogTrigger>
      {!application ? (
        <MissingRegistrationDialogContent section="contact information" />
      ) : (
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit contact information</DialogTitle>
            <DialogDescription>
              These are public business contacts. Your sign-in credentials will
              not change.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="contact-phone" label="Mobile number">
                <Input
                  id="contact-phone"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(event) =>
                    update("phoneNumber", event.target.value)
                  }
                  required
                  minLength={10}
                  maxLength={20}
                />
              </Field>
              <Field id="contact-whatsapp" label="WhatsApp">
                <Input
                  id="contact-whatsapp"
                  type="tel"
                  value={form.whatsappNumber}
                  onChange={(event) =>
                    update("whatsappNumber", event.target.value)
                  }
                  maxLength={20}
                />
              </Field>
            </div>
            <Field id="contact-email" label="Email Address">
              <Input
                id="contact-email"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                maxLength={320}
              />
            </Field>
            {(
              [
                ["facebookUrl", "Facebook Page"],
                ["messengerUrl", "Messenger"],
                ["websiteUrl", "Website"],
                ["telegramUrl", "Telegram (Optional)"],
              ] as const
            ).map(([field, label]) => (
              <Field key={field} id={`contact-${field}`} label={label}>
                <Input
                  id={`contact-${field}`}
                  type="url"
                  value={form[field]}
                  onChange={(event) => update(field, event.target.value)}
                  placeholder="https://"
                  maxLength={2048}
                />
              </Field>
            ))}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                Save contact information
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

function BusinessProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

function IdentityItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function ProfileSection({
  title,
  icon: Icon,
  children,
  className = "",
  action,
  description,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
  action: React.ReactNode;
  description?: string;
}) {
  return (
    <section
      className={`flex flex-col border-b p-6 last:border-b-0 md:border-r md:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0 ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-gray-950 uppercase">
          <Icon className="size-4 text-emerald-700" aria-hidden="true" />
          {title}
        </h2>
      </div>
      <dl className="mt-5 divide-y">{children}</dl>
      {description && (
        <p className="pt-3 text-xs leading-relaxed text-gray-500">
          {description}
        </p>
      )}
      <div className="mt-auto pt-5">{action}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-4">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="break-words text-sm font-medium text-gray-900 sm:text-right">
        {displayValue(value)}
      </dd>
    </div>
  );
}
