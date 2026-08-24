"use client";

import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit2,
  Eye,
  FileImage,
  Loader2,
  Megaphone,
  MessageSquareText,
  Phone,
  QrCode,
  RotateCcw,
  Share2,
  UserRound,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  bookingRequestsFromResponse,
  type ToLetBookingRequestView,
  type ToLetBookingStatus,
  useAcceptToLetBookingRequest,
  useOwnerToLetBookingRequests,
  useRejectToLetBookingRequest,
} from "@/hooks/use-to-let-booking-api";
import {
  useArchiveToLetUnit,
  useMyToLetProperty,
  useMyToLetUnitListing,
  useReactivateToLetUnit,
} from "@/hooks/use-to-let-property-api";
import {
  rentalFromResponse,
  useActivateToLetContract,
  useToLetRental,
} from "@/hooks/use-to-let-rental-api";
import { IncludedExcludedButtons } from "./included-excluded-buttons";
import { propertyFromResponse } from "./property-details-client";
import {
  ListingStatusBadge,
  PropertyDetailsSkeleton,
  PropertyErrorState,
  PropertyPageHeader,
  UnitStatusBadge,
} from "./property-ui";
import {
  humanize,
  type ToLetPropertyView,
  type ToLetUnitListingView,
  type ToLetUnitView,
} from "./types";

function listingFromResponse(data: unknown): ToLetUnitListingView | null {
  if (!data || typeof data !== "object" || !("listing" in data)) return null;
  const listing = (data as { listing?: unknown }).listing;
  return listing && typeof listing === "object"
    ? (listing as ToLetUnitListingView)
    : null;
}

type UnitOfferDisplay = {
  listingCode: string;
  description?: string | null;
  monthlyRent?: number | null;
  advanceAmount?: number | null;
  securityDeposit?: number | null;
  serviceCharge?: number | null;
  serviceChargeIncluded?: boolean;
  parkingCharge?: number | null;
  parkingChargeIncluded?: boolean;
  utilityCharge?: number | null;
  utilityChargeIncluded?: boolean;
  availableFrom?: string | null;
  preferredTenant?: string;
  hasInternet?: boolean;
  otherFacilities?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  status?: string;
};

function formatMoney(value: number | null) {
  return value === null
    ? "Price hidden"
    : `৳${new Intl.NumberFormat("en-BD").format(value)}`;
}

function formatBookingDate(value: string | null, includeTime = false) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function UnitGallery({
  unit,
  listingImages,
}: {
  unit: ToLetUnitView;
  listingImages: string[];
}) {
  const [activeImage, setActiveImage] = useState(0);
  const imageUrls = Array.from(
    new Set([...listingImages, ...unit.imageUrls].filter(Boolean)),
  );
  const selectedImage = imageUrls[activeImage] ?? imageUrls[0];

  if (!selectedImage) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
        No Unit photos added yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-gray-100 sm:aspect-video lg:aspect-[4/3]">
        <Image
          src={selectedImage}
          alt={`${unit.name} photo ${activeImage + 1}`}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 55vw"
          unoptimized={selectedImage.startsWith("http")}
        />
        {imageUrls.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Show previous Unit photo"
              onClick={() =>
                setActiveImage((current) =>
                  current === 0 ? imageUrls.length - 1 : current - 1,
                )
              }
              className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Show next Unit photo"
              onClick={() =>
                setActiveImage((current) =>
                  current === imageUrls.length - 1 ? 0 : current + 1,
                )
              }
              className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
          {activeImage + 1} / {imageUrls.length}
        </span>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Thumbnail gallery
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {imageUrls.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              aria-label={`Show photo ${index + 1}`}
              aria-pressed={activeImage === index}
              onClick={() => setActiveImage(index)}
              className={`relative size-16 shrink-0 overflow-hidden rounded-md border-2 ${
                activeImage === index
                  ? "border-emerald-600"
                  : "border-transparent"
              }`}
            >
              <Image
                src={url}
                alt=""
                fill
                className="object-cover"
                sizes="64px"
                unoptimized={url.startsWith("http")}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatFloorLabel(floorNumber: number) {
  if (floorNumber === 0) return "Ground Floor";
  if (floorNumber < 0) return `Basement ${Math.abs(floorNumber)}`;

  const lastTwoDigits = floorNumber % 100;
  const suffix =
    lastTwoDigits >= 11 && lastTwoDigits <= 13
      ? "th"
      : floorNumber % 10 === 1
        ? "st"
        : floorNumber % 10 === 2
          ? "nd"
          : floorNumber % 10 === 3
            ? "rd"
            : "th";

  return `${floorNumber}${suffix} Floor`;
}

const unitSectionNavigation = [
  { id: "unit-information", label: "Unit Information" },
  { id: "facilities", label: "Facilities" },
  { id: "rent", label: "Rent" },
  { id: "tenant", label: "Tenant" },
] as const;

const activeListingSectionNavigation = [
  ...unitSectionNavigation,
  { id: "booking-history", label: "Booking Requests" },
] as const;

function UnitInformationPanel({
  property,
  unit,
  offer,
}: {
  property: ToLetPropertyView;
  unit: ToLetUnitView;
  offer: UnitOfferDisplay | null;
}) {
  const listingStatus = offer?.status ?? unit.currentListing?.status ?? null;
  const photoCount = new Set(
    [
      ...(offer?.imageUrls ?? unit.currentListing?.imageUrls ?? []),
      ...unit.imageUrls,
      offer?.imageUrl ?? "",
    ].filter(Boolean),
  ).size;
  const overviewRows: Array<[string, ReactNode]> = [
    ["Property ID *", property.propertyCode],
    ["Property Name", property.name],
    ["Unit Name / Number *", unit.name],
    ["Listing Category *", humanize(unit.unitType)],
    ["Floor Number *", formatFloorLabel(unit.floorNumber)],
    ["Unit Size *", `${unit.sizeSqFt} sq ft`],
    ["Unit Photos *", `${photoCount} image${photoCount === 1 ? "" : "s"}`],
    [
      "Property Video (Optional)",
      property.videoUrl ? (
        <a
          key="property-video"
          href={property.videoUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-emerald-700 hover:underline"
        >
          View property video
        </a>
      ) : (
        "Not added"
      ),
    ],
    ["Balcony *", unit.balconies],
    ["Bathrooms *", unit.bathrooms],
    ["Drawing Room", unit.hasDrawingRoom ? "Yes" : "No"],
    ["Dining Space", unit.hasDiningSpace ? "Yes" : "No"],
    ["Kitchen", unit.hasKitchen ? "Yes" : "No"],
    [
      "Preferred Tenant *",
      offer?.preferredTenant ? humanize(offer.preferredTenant) : "Not selected",
    ],
    [
      "Available From",
      offer?.availableFrom
        ? formatBookingDate(offer.availableFrom)
        : "Not listed",
    ],
    ["Listing Status", listingStatus ? humanize(listingStatus) : "Not created"],
  ];
  const description =
    offer?.description ?? unit.description ?? property.description;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Overview
      </p>
      <h2 className="mt-1 text-xl font-semibold text-gray-900">
        Unit Information
      </h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {overviewRows.map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-sm font-medium text-gray-900">{label}</dt>
            <dd className="mt-1 flex min-h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-gray-100 pt-5">
        {description ? (
          <>
            <h3 className="text-sm font-semibold text-gray-900">
              Property Description
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
              {description}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">No description added.</p>
        )}
      </div>
    </section>
  );
}

function FacilitiesPanel({
  property,
  unit,
  offer,
}: {
  property: ToLetPropertyView;
  unit: ToLetUnitView;
  offer: UnitOfferDisplay | null;
}) {
  const facilities = [
    ["Water Supply", property.hasWaterSupply],
    ["Gas Connection", property.hasGasConnection],
    ["Electricity", property.hasElectricity],
    ["Internet", offer?.hasInternet ?? false],
    ["Lift", property.hasLift],
    ["Parking", property.hasParking],
    ["Generator", property.hasGenerator],
    ["Security", property.hasSecurityGuard],
    ["CCTV", property.hasCctv],
    ["Furnished", unit.isFurnished],
  ] as const;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Step 3
      </p>
      <h2 className="mt-1 font-semibold text-gray-900">Facilities</h2>
      <p className="mt-1 text-sm text-gray-500">
        Property facilities are inherited by this Unit. Listing-specific items
        use the current rental offer.
      </p>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {facilities.map(([label, available]) => (
          <div
            key={label}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p
                className={`mt-0.5 text-xs ${available ? "text-emerald-700" : "text-gray-500"}`}
              >
                {available ? "Available" : "Not available"}
              </p>
            </div>
            <IncludedExcludedButtons label={label} included={available} />
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Other Facilities
        </h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
          {offer?.otherFacilities || "No other facilities added."}
        </p>
      </div>
    </section>
  );
}

function RentPanel({
  property,
  offer,
  listingHref,
  canEdit,
}: {
  property: ToLetPropertyView;
  offer: UnitOfferDisplay | null;
  listingHref: string;
  canEdit: boolean;
}) {
  const displayMoney = (value: number | null | undefined) => {
    if (!offer) return "Not added";
    return value == null ? "Not available" : formatMoney(value);
  };
  const rentRows = [
    ["Rent *", displayMoney(offer?.monthlyRent)],
    ["Advance *", displayMoney(offer?.advanceAmount)],
    ["Security Deposit", displayMoney(offer?.securityDeposit)],
  ];
  const charges = [
    ["Service Charge", offer?.serviceCharge, offer?.serviceChargeIncluded],
    ["Parking", offer?.parkingCharge, offer?.parkingChargeIncluded],
    ["Utility Bill", offer?.utilityCharge, offer?.utilityChargeIncluded],
  ] as const;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Rent information
          </p>
          <h2 className="mt-1 font-semibold text-gray-900">
            Rental terms
            <span className="ml-1 font-normal text-gray-500">
              (after contract for tenant)
            </span>
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {offer
              ? `Terms captured from ${offer.listingCode}.`
              : "No rental Listing has been created for this Unit yet."}
          </p>
        </div>
        {canEdit ? (
          <Button variant="outline" asChild>
            <Link href={listingHref}>
              {offer ? "Edit rental Listing" : "Create Listing"}
            </Link>
          </Button>
        ) : null}
      </div>
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {rentRows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-1 font-semibold text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {charges.map(([label, amount, included]) => (
          <div key={label} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 font-semibold text-gray-900">
                  {displayMoney(amount)}
                </p>
              </div>
              <IncludedExcludedButtons
                label={label}
                included={Boolean(included)}
                className="min-w-40"
              />
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Payment Method</p>
          <p className="mt-1 font-semibold text-gray-900">Monthly OTP</p>
          <p className="mt-1 text-xs text-gray-500">
            Tenant confirms each monthly rent cycle with the owner OTP.
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Step 4 · Contact
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Contact Person</p>
            <p className="mt-1 font-semibold text-gray-900">
              {property.ownerName}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs text-gray-500">Contact Number</p>
            <a
              className="mt-1 inline-flex font-semibold text-emerald-700 hover:underline"
              href={`tel:${property.mobileNumber}`}
            >
              {property.mobileNumber}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

const bookingStatusStyles: Record<ToLetBookingStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-600",
};

function BookingStatusBadge({ status }: { status: ToLetBookingStatus }) {
  return (
    <Badge variant="outline" className={bookingStatusStyles[status]}>
      {humanize(status)}
    </Badge>
  );
}

function addOneYear(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function OwnerContractPanel({
  booking,
  propertyCode,
  unitCode,
}: {
  booking: ToLetBookingRequestView;
  propertyCode: string;
  unitCode: string;
}) {
  const startDefault =
    booking.desiredMoveInDate ?? new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(startDefault);
  const [endDate, setEndDate] = useState(addOneYear(startDefault));
  const [contractSigned, setContractSigned] = useState(false);
  const query = useToLetRental(booking.bookingCode);
  const activate = useActivateToLetContract();
  const contract = rentalFromResponse(query.data);

  if (query.isLoading) {
    return (
      <div className="mt-5 flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10 text-sm text-gray-500">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading rental contract
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Tenant ID / Reference", booking.bookingCode],
          ["Tenant Name", booking.contactName],
          ["Phone", booking.contactPhone],
          [
            "Contract Start",
            contract ? formatBookingDate(contract.startDate) : "Not signed yet",
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 break-words font-semibold text-gray-900">
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-500">Rental Agreement (Image)</p>
          <div className="mt-3 flex min-h-24 items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-white text-sm text-gray-500">
            <FileImage className="size-5 text-gray-400" />
            No agreement image uploaded
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs text-gray-500">Rental Contract</p>
              <p className="mt-1 font-semibold text-gray-900">
                {contract?.contractCode ?? "Pending activation"}
              </p>
            </div>
            {contract ? (
              <Badge className="bg-emerald-700 text-white">
                {humanize(contract.status)} · Unit{" "}
                {humanize(contract.unitStatus)}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-700"
              >
                Contract pending
              </Badge>
            )}
          </div>
          <p className="mt-3 text-sm text-gray-600">
            {contract
              ? `${formatBookingDate(contract.startDate)} – ${formatBookingDate(contract.endDate)} · Monthly Rent OTP on the 1st day`
              : "Accepting the Booking reserves the Unit. Activate the contract only after the agreement is signed."}
          </p>
        </div>
      </div>

      {!contract ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">
            Sign and activate rental contract
          </p>
          <p className="mt-1 text-xs leading-5 text-blue-800">
            The accepted Booking remains Booked until both parties sign.
            Activation then links the tenant, makes the Unit Occupied and
            creates the Monthly Rent OTP cycle on the 1st day of every month.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-700">
              Start date
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1 bg-white"
              />
            </label>
            <label className="text-xs font-medium text-gray-700">
              End date
              <Input
                type="date"
                min={startDate}
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="mt-1 bg-white"
              />
            </label>
          </div>
          <label
            htmlFor={`contract-signed-${booking.bookingCode}`}
            className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-blue-200 bg-white p-3 text-sm text-gray-700"
          >
            <Checkbox
              id={`contract-signed-${booking.bookingCode}`}
              checked={contractSigned}
              onCheckedChange={(checked) => setContractSigned(checked === true)}
              className="mt-0.5"
            />
            <span>
              I confirm the rental contract has been signed by the owner and
              tenant.
            </span>
          </label>
          <Button
            className="mt-3 bg-blue-700 hover:bg-blue-800"
            disabled={
              activate.isPending ||
              !startDate ||
              !endDate ||
              endDate < startDate ||
              !contractSigned
            }
            onClick={() =>
              activate.mutate({
                propertyCode,
                unitCode,
                bookingCode: booking.bookingCode,
                startDate,
                endDate,
                rentDueDay: 1,
                contractSigned: true,
              })
            }
          >
            {activate.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CheckCircle2 />
            )}
            Sign &amp; Activate Contract
          </Button>
        </div>
      ) : null}

      <div className="border-t border-gray-200 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">Payment History</h3>
          <span className="text-xs text-gray-500">Owner view</span>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Month</th>
                <th className="px-4 py-3 font-medium">Tenant Reference</th>
                <th className="px-4 py-3 font-medium">Tenant Name</th>
                <th className="px-4 py-3 font-medium">Rent</th>
                <th className="px-4 py-3 font-medium">OTP</th>
                <th className="px-4 py-3 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {contract?.payments.length ? (
                contract.payments.map((payment) => (
                  <tr key={payment.cycleMonth}>
                    <td className="px-4 py-3 text-gray-700">
                      {payment.cycleMonth.slice(0, 7)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {booking.bookingCode}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {booking.contactName}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatMoney(payment.amount)}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {payment.otp ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={
                          payment.status === "paid"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                        }
                      >
                        {humanize(payment.status)}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Payment history will appear after the contract starts.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OwnerBookingRequestCard({
  booking,
  isPending,
  onAccept,
  onReject,
}: {
  booking: ToLetBookingRequestView;
  isPending: boolean;
  onAccept: (bookingCode: string) => Promise<void>;
  onReject: (bookingCode: string, responseNote?: string) => Promise<void>;
}) {
  const [rejectNote, setRejectNote] = useState("");
  const snapshot = booking.offerSnapshot;

  return (
    <article className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">
              {booking.contactName}
            </h3>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {booking.bookingCode} · Requested{" "}
            {formatBookingDate(booking.createdAt, true)}
          </p>
        </div>
        <p className="text-right">
          <span className="block font-bold text-emerald-700">
            {formatMoney(snapshot.monthlyRent)}
          </span>
          <span className="text-xs text-gray-500">snapshot monthly rent</span>
        </p>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex items-start gap-2">
          <Phone className="mt-0.5 size-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Contact</p>
            <a
              href={`tel:${booking.contactPhone}`}
              className="font-medium text-gray-900 hover:text-emerald-700 hover:underline"
            >
              {booking.contactPhone}
            </a>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Preferred move-in</p>
            <p className="font-medium text-gray-900">
              {formatBookingDate(booking.desiredMoveInDate)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Megaphone className="mt-0.5 size-4 shrink-0 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Offer snapshot</p>
            <p className="font-medium text-gray-900">
              {snapshot.listingCode} · {snapshot.title}
            </p>
          </div>
        </div>
      </div>

      {booking.message ? (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <MessageSquareText className="size-3.5" /> Request message
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {booking.message}
          </p>
        </div>
      ) : null}

      {booking.responseNote ? (
        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Your response
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {booking.responseNote}
          </p>
        </div>
      ) : null}

      {booking.status === "pending" ? (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-200 pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={isPending}
              >
                <XCircle /> Reject
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Reject {booking.bookingCode}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  The requester will see the rejected status. You can optionally
                  include a short reason.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <label
                  htmlFor={`reject-note-${booking.bookingCode}`}
                  className="text-sm font-medium text-gray-900"
                >
                  Response note (optional)
                </label>
                <Textarea
                  id={`reject-note-${booking.bookingCode}`}
                  value={rejectNote}
                  onChange={(event) => setRejectNote(event.target.value)}
                  maxLength={500}
                  placeholder="Explain why this request cannot be accepted"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Keep pending
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isPending}
                  onClick={() =>
                    void onReject(
                      booking.bookingCode,
                      rejectNote.trim() || undefined,
                    )
                  }
                >
                  Reject request
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={isPending}
              >
                <CheckCircle2 /> Accept
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Accept {booking.bookingCode}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Accepting this request books {snapshot.unit.name} and removes
                  it from public availability. It does not activate a rental
                  contract.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Keep pending
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={() => void onAccept(booking.bookingCode)}
                >
                  Accept and book Unit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </article>
  );
}

function CurrentTenantSection({
  booking,
  propertyCode,
  unitCode,
  isLoading,
  isError,
  onRetry,
}: {
  booking: ToLetBookingRequestView | null;
  propertyCode: string;
  unitCode: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <UserRound className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-900">Current Tenant Info</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            The accepted Booking contact, signed contract dates and owner-only
            monthly payment history appear here.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-5 flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10 text-sm text-gray-500">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading tenant
          information
        </div>
      ) : isError ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Tenant information could not be loaded.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 bg-white"
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      ) : booking ? (
        <OwnerContractPanel
          booking={booking}
          propertyCode={propertyCode}
          unitCode={unitCode}
        />
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-gray-300 px-5 py-9 text-center">
          <UserRound className="mx-auto size-7 text-gray-400" />
          <h3 className="mt-3 font-medium text-gray-900">No current tenant</h3>
          <p className="mt-1 text-sm text-gray-500">
            This section will update after an owner accepts a Booking Request.
          </p>
        </div>
      )}
    </section>
  );
}

function OwnerBookingRequestsSection({
  propertyCode,
  unitCode,
}: {
  propertyCode: string;
  unitCode: string;
}) {
  const query = useOwnerToLetBookingRequests(propertyCode, unitCode);
  const acceptRequest = useAcceptToLetBookingRequest();
  const rejectRequest = useRejectToLetBookingRequest();
  const allBookings = [...bookingRequestsFromResponse(query.data)].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const pendingCount = allBookings.filter(
    (booking) => booking.status === "pending",
  ).length;
  const isMutating = acceptRequest.isPending || rejectRequest.isPending;

  const accept = async (bookingCode: string) => {
    try {
      await acceptRequest.mutateAsync({
        propertyCode,
        unitCode,
        bookingCode,
        responseNote: undefined,
      });
    } catch {
      // The mutation hook shows the server error.
    }
  };

  const reject = async (bookingCode: string, responseNote?: string) => {
    try {
      await rejectRequest.mutateAsync({
        propertyCode,
        unitCode,
        bookingCode,
        responseNote,
      });
    } catch {
      // The mutation hook shows the server error.
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <UserRound className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900">Booking Requests</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Review the available request history for this Listing cycle and
              accept or reject pending requests.
            </p>
          </div>
        </div>
        {!query.isLoading && !query.isError ? (
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700"
          >
            {pendingCount} pending · {allBookings.length} total
          </Badge>
        ) : null}
      </div>

      {query.isLoading ? (
        <div className="mt-5 flex items-center justify-center rounded-lg border border-dashed border-gray-200 py-10 text-sm text-gray-500">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading requests
        </div>
      ) : query.isError ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Booking requests could not be loaded.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 bg-white"
            onClick={() => query.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : allBookings.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-gray-300 px-5 py-9 text-center">
          <Clock3 className="mx-auto size-7 text-gray-400" />
          <h3 className="mt-3 font-medium text-gray-900">
            No booking requests yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            New requests for the current active Listing will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {allBookings.map((booking) => (
            <OwnerBookingRequestCard
              key={booking.bookingCode}
              booking={booking}
              isPending={isMutating}
              onAccept={accept}
              onReject={reject}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function UnitDetailsClient({
  propertyCode,
  unitCode,
}: {
  propertyCode: string;
  unitCode: string;
}) {
  const router = useRouter();
  const query = useMyToLetProperty(propertyCode);
  const listingQuery = useMyToLetUnitListing(propertyCode, unitCode);
  const bookingRequestsQuery = useOwnerToLetBookingRequests(
    propertyCode,
    unitCode,
  );
  const archive = useArchiveToLetUnit();
  const reactivateUnit = useReactivateToLetUnit();
  const [activeSection, setActiveSection] = useState("unit-information");
  const loadedProperty = propertyFromResponse(query.data);
  const loadedUnit = loadedProperty?.units?.find(
    (candidate: ToLetUnitView) => candidate.unitCode === unitCode,
  );
  const loadedListing = listingFromResponse(listingQuery.data);
  const showBookingRequests =
    loadedListing?.status === "active" && loadedUnit?.status === "vacant";
  const sectionNavigation = showBookingRequests
    ? activeListingSectionNavigation
    : unitSectionNavigation;

  useEffect(() => {
    if (query.isLoading || listingQuery.isLoading) return;

    const sections = sectionNavigation
      .map(({ id }) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleSection) setActiveSection(visibleSection.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 0.25, 0.5] },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [query.isLoading, listingQuery.isLoading, sectionNavigation]);

  if (query.isLoading || listingQuery.isLoading) {
    return <PropertyDetailsSkeleton />;
  }
  if (query.isError || listingQuery.isError) {
    return (
      <PropertyErrorState
        onRetry={() => {
          query.refetch();
          listingQuery.refetch();
        }}
      />
    );
  }

  const property = loadedProperty;
  const unit = loadedUnit;
  if (!property || !unit) {
    return <PropertyErrorState message="This unit could not be found." />;
  }
  const isBlocked = property.status === "blocked";
  const listing = loadedListing;
  const bookingRequests = bookingRequestsFromResponse(
    bookingRequestsQuery.data,
  );
  const acceptedBooking =
    bookingRequests.find((booking) => booking.status === "accepted") ?? null;
  const displayOffer: UnitOfferDisplay | null =
    listing ?? acceptedBooking?.offerSnapshot ?? unit.currentListing ?? null;
  const displayListing = listing ?? unit.currentListing ?? null;
  const latestListingCode = unit.currentListing?.listingCode;
  const hasAcceptedBooking = bookingRequests.some(
    (booking) =>
      booking.status === "accepted" &&
      booking.offerSnapshot.listingCode === latestListingCode,
  );
  const canReactivateOffline =
    !isBlocked &&
    unit.status === "booked" &&
    !bookingRequestsQuery.isLoading &&
    !bookingRequestsQuery.isError &&
    !hasAcceptedBooking;
  const listingHref = `/account/to-let/properties/${property.propertyCode}/units/${unit.unitCode}/listing`;
  const liveHref =
    listing?.status === "active"
      ? listing.visibility === "public"
        ? `/to-let/listings/${listing.listingCode}`
        : `/to-let/qr/${property.qrToken}`
      : null;
  const floorLabel = formatFloorLabel(unit.floorNumber);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const unavailableListingNotice =
    unit.status === "booked"
      ? "This Unit is booked. New listings are disabled until it becomes vacant again."
      : unit.status === "occupied"
        ? "This Unit is occupied. It must become vacant before it can be listed again."
        : "This Unit is inactive and cannot be listed.";

  const archiveUnit = async () => {
    try {
      await archive.mutateAsync({
        propertyCode: property.propertyCode,
        unitCode: unit.unitCode,
      });
      router.push(`/account/to-let/properties/${property.propertyCode}`);
    } catch {
      // Mutation hook displays the API error.
    }
  };

  const reactivateOfflineUnit = async () => {
    try {
      await reactivateUnit.mutateAsync({
        propertyCode: property.propertyCode,
        unitCode: unit.unitCode,
      });
    } catch {
      // Mutation hook displays the API error.
    }
  };

  const shareUnit = async () => {
    const sharePath =
      listing?.status === "active"
        ? listing.visibility === "public"
          ? `/to-let/listings/${listing.listingCode}`
          : `/to-let/qr/${property.qrToken}`
        : window.location.pathname;
    const url = new URL(sharePath, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({ title: unit.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Unit link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Could not share this Unit");
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Unit Details
        </p>
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500"
        >
          <Link href="/" className="hover:text-emerald-700 hover:underline">
            Home
          </Link>
          <ChevronRight className="size-3.5" />
          <Link
            href="/account/to-let/properties"
            className="hover:text-emerald-700 hover:underline"
          >
            Property
          </Link>
          <ChevronRight className="size-3.5" />
          <Link
            href={`/account/to-let/properties/${property.propertyCode}`}
            className="hover:text-emerald-700 hover:underline"
          >
            {property.name}
          </Link>
          <ChevronRight className="size-3.5" />
          <span aria-current="page" className="font-medium text-gray-700">
            {unit.name}
          </span>
        </nav>
      </div>

      <PropertyPageHeader
        title={`${unit.name} (${floorLabel})`}
        description={unit.unitCode}
        backHref={`/account/to-let/properties/${property.propertyCode}`}
        action={<UnitStatusBadge status={unit.status} />}
      />

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)] sm:p-6">
          <UnitGallery
            unit={unit}
            listingImages={displayListing?.imageUrls ?? []}
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-emerald-700">
                  {property.name}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">
                  {unit.name}
                </h2>
              </div>
              {displayListing ? (
                <ListingStatusBadge status={displayListing.status} />
              ) : null}
            </div>

            <dl className="mt-4 divide-y divide-gray-100 border-y border-gray-100">
              {[
                ["Property ID", property.propertyCode],
                ["Unit ID", unit.unitCode],
                ["Unit Name", unit.name],
                ["Category", humanize(unit.unitType)],
                ["Views (Post on)", displayListing?.viewCount ?? 0],
                ["Size", `${unit.sizeSqFt} sq ft`],
                [
                  "Monthly Rent",
                  displayListing
                    ? formatMoney(displayListing.monthlyRent)
                    : "Not listed",
                ],
                ["Status", humanize(unit.status)],
                [
                  "Last To-let",
                  displayListing?.publishedAt
                    ? formatBookingDate(String(displayListing.publishedAt))
                    : "Not published yet",
                ],
                [
                  "Last Updated",
                  unit.updatedAt
                    ? formatBookingDate(String(unit.updatedAt))
                    : "Not available",
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="grid grid-cols-[130px_1fr] gap-3 py-2 text-sm"
                >
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              {isBlocked ? <Button disabled>Property Blocked</Button> : null}
              {liveHref && !isBlocked ? (
                <Button variant="outline" asChild>
                  <Link href={liveHref} target="_blank" prefetch={false}>
                    {listing?.visibility === "public" ? <Eye /> : <QrCode />}
                    View Live
                  </Link>
                </Button>
              ) : null}
              {unit.status === "vacant" && !isBlocked ? (
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                  <Link href={listingHref}>
                    <Megaphone />
                    {listing ? "Manage Listing" : "Create Listing"}
                  </Link>
                </Button>
              ) : null}
              {isBlocked ? (
                <Button variant="outline" disabled>
                  <Edit2 /> Edit
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link
                    href={`/account/to-let/properties/${property.propertyCode}/units/${unit.unitCode}/edit`}
                  >
                    <Edit2 /> Edit
                  </Link>
                </Button>
              )}
              <Button variant="outline" onClick={shareUnit}>
                <Share2 /> Share
              </Button>
              {canReactivateOffline ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <RotateCcw /> Reactivate Unit
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Reactivate {unit.name}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This returns the offline-booked Unit to Vacant. You can
                        then create and publish a new listing from this Unit
                        Details page.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={reactivateUnit.isPending}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={reactivateUnit.isPending}
                        onClick={() => void reactivateOfflineUnit()}
                      >
                        {reactivateUnit.isPending ? (
                          <>
                            <Loader2 className="animate-spin" />
                            Reactivating...
                          </>
                        ) : (
                          <>
                            <RotateCcw /> Reactivate Unit
                          </>
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              {unit.status === "vacant" && !isBlocked ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Archive /> Remove Unit
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove {unit.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {listing
                          ? "The current Listing will be closed and pending requests will be rejected. The Unit will become inactive, while its permanent ID and history stay preserved."
                          : "The Unit will become inactive, while its permanent ID and history stay preserved."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={archive.isPending}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={archiveUnit}
                        disabled={archive.isPending}
                      >
                        {archive.isPending ? "Removing…" : "Remove Unit"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          </div>
        </div>

        {unit.status !== "vacant" ? (
          <div className="border-t border-amber-200 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-700 sm:px-6">
            {unavailableListingNotice}
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <nav
          aria-label="Unit details sections"
          className="sticky top-0 z-20 overflow-x-auto border-b border-gray-200 bg-white/95 px-3 backdrop-blur"
        >
          <div className="flex h-12 min-w-max items-center gap-2">
            {sectionNavigation.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-current={activeSection === id ? "location" : undefined}
                onClick={() => scrollToSection(id)}
                className={`h-12 border-b-2 px-3 text-sm font-medium transition-colors ${
                  activeSection === id
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-600 hover:text-gray-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>

        <div className="divide-y divide-gray-200">
          <div
            id="unit-information"
            className="scroll-mt-16 [&>section]:rounded-none [&>section]:border-0"
          >
            <UnitInformationPanel
              property={property}
              unit={unit}
              offer={displayOffer}
            />
          </div>
          <div
            id="facilities"
            className="scroll-mt-16 [&>section]:rounded-none [&>section]:border-0"
          >
            <FacilitiesPanel
              property={property}
              unit={unit}
              offer={displayOffer}
            />
          </div>
          <div
            id="rent"
            className="scroll-mt-16 [&>section]:rounded-none [&>section]:border-0"
          >
            <RentPanel
              property={property}
              offer={displayOffer}
              listingHref={listingHref}
              canEdit={!isBlocked && unit.status === "vacant"}
            />
          </div>
          <div
            id="tenant"
            className="scroll-mt-16 [&>section]:rounded-none [&>section]:border-0"
          >
            <CurrentTenantSection
              booking={acceptedBooking}
              propertyCode={property.propertyCode}
              unitCode={unit.unitCode}
              isLoading={bookingRequestsQuery.isLoading}
              isError={bookingRequestsQuery.isError}
              onRetry={() => bookingRequestsQuery.refetch()}
            />
          </div>
          {showBookingRequests ? (
            <div
              id="booking-history"
              className="scroll-mt-16 [&>section]:rounded-none [&>section]:border-0"
            >
              <OwnerBookingRequestsSection
                propertyCode={property.propertyCode}
                unitCode={unit.unitCode}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
