"use client";

import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Home,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  bookingRequestsFromResponse,
  type ToLetBookingRequestView,
  type ToLetBookingStatus,
  useMyToLetBookings,
} from "@/hooks/use-to-let-booking-api";
import {
  rentalFromResponse,
  type ToLetRentalContractView,
  useAddToLetRentalComment,
  useRequestToLetLeave,
  useToLetRental,
  useVerifyToLetRentPayment,
} from "@/hooks/use-to-let-rental-api";

const statusPresentation: Record<
  ToLetBookingStatus,
  {
    label: string;
    detail: string;
    className: string;
    icon: React.ElementType;
  }
> = {
  pending: {
    label: "Request pending",
    detail: "Waiting for the property owner to review your booking request.",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock3,
  },
  accepted: {
    label: "Booked · Contract pending",
    detail:
      "The owner accepted this request and reserved the Unit. Occupancy starts only after a rental contract is activated.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Request closed",
    detail: "The property owner did not accept this booking request.",
    className: "border-red-200 bg-red-50 text-red-800",
    icon: XCircle,
  },
  cancelled: {
    label: "Request cancelled",
    detail: "You cancelled this booking request. It remains in your history.",
    className: "border-gray-200 bg-gray-100 text-gray-700",
    icon: XCircle,
  },
};

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(value: number | null) {
  return value === null
    ? "Hidden before contract"
    : `৳${new Intl.NumberFormat("en-BD").format(value)}`;
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function Section({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-emerald-700 uppercase">
              {eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-gray-500">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function FacilityItem({
  label,
  available,
}: {
  label: string;
  available: boolean | undefined;
}) {
  const recorded = typeof available === "boolean";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
          available
            ? "text-emerald-700"
            : recorded
              ? "text-gray-500"
              : "text-amber-700"
        }`}
      >
        {available ? (
          <Check className="size-4" />
        ) : recorded ? (
          <X className="size-4" />
        ) : (
          <Clock3 className="size-4" />
        )}
        {available ? "Available" : recorded ? "Not available" : "Not recorded"}
      </span>
    </div>
  );
}

function RentItem({
  label,
  amount,
  included,
}: {
  label: string;
  amount: number | null;
  included?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatMoney(amount)}
          </p>
        </div>
        {typeof included === "boolean" ? (
          <Badge
            variant="outline"
            className={
              included
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-white text-gray-600"
            }
          >
            {included ? "Included" : "Excluded"}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function DetailsLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function PaymentRow({
  bookingCode,
  payment,
}: {
  bookingCode: string;
  payment: ToLetRentalContractView["payments"][number];
}) {
  const [referenceName, setReferenceName] = useState("");
  const [otp, setOtp] = useState("");
  const verify = useVerifyToLetRentPayment();

  return (
    <div className="grid gap-3 border-t border-gray-100 px-4 py-4 text-sm sm:grid-cols-[0.8fr_1.2fr_0.8fr_1fr_auto] sm:items-center">
      <span className="font-medium text-gray-900">
        {payment.cycleMonth.slice(0, 7)}
      </span>
      {payment.status === "pending" ? (
        <Input
          value={referenceName}
          onChange={(event) => setReferenceName(event.target.value)}
          placeholder="Payment receiver"
        />
      ) : (
        <span>{payment.referenceName}</span>
      )}
      <span>{formatMoney(payment.amount)}</span>
      {payment.status === "pending" ? (
        <Input
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(event) =>
            setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          placeholder="6-digit OTP"
        />
      ) : (
        <span className="font-semibold text-emerald-700">Paid</span>
      )}
      {payment.status === "pending" ? (
        <Button
          size="sm"
          disabled={
            verify.isPending ||
            referenceName.trim().length < 2 ||
            otp.length !== 6
          }
          onClick={() =>
            verify.mutate({
              bookingCode,
              cycleMonth: payment.cycleMonth,
              referenceName: referenceName.trim(),
              otp,
            })
          }
        >
          Verify
        </Button>
      ) : null}
    </div>
  );
}

function CommentsSection({
  bookingCode,
  contract,
}: {
  bookingCode: string;
  contract: ToLetRentalContractView;
}) {
  const [body, setBody] = useState("");
  const [rating, setRating] = useState(5);
  const addComment = useAddToLetRentalComment();

  return (
    <Section
      icon={MessageSquareText}
      eyebrow="Comments"
      title="Verified rental feedback"
      description="Comments are linked to this active or completed rental contract."
    >
      <div id="rental-comments" className="space-y-3">
        {contract.comments.length > 0 ? (
          contract.comments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-4"
            >
              <div className="flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>
                  {comment.isMine ? "Your comment" : "Rental comment"}
                </span>
                <span>{formatDate(comment.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {comment.body}
              </p>
              {comment.rating ? (
                <p className="mt-2 text-xs font-semibold text-amber-600">
                  Rating: {comment.rating}/5
                </p>
              ) : null}
            </article>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-500">
            No comments yet.
          </p>
        )}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write a review or property feedback"
          maxLength={2000}
        />
        <label className="text-xs font-medium text-gray-700">
          Rating
          <select
            className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3"
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value}/5
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button
        className="mt-3"
        disabled={addComment.isPending || body.trim().length < 3}
        onClick={() =>
          addComment.mutate({ bookingCode, body: body.trim(), rating })
        }
      >
        <MessageSquareText className="size-4" /> Submit comment
      </Button>
    </Section>
  );
}

export function BookingDetailsClient({ bookingCode }: { bookingCode: string }) {
  const query = useMyToLetBookings();

  if (query.isLoading) return <DetailsLoading />;

  const booking = bookingRequestsFromResponse(query.data).find(
    (row) => row.bookingCode === bookingCode,
  );

  if (query.isError || !booking) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
        <Building2 className="mx-auto size-10 text-gray-300" />
        <h1 className="mt-4 text-xl font-semibold text-gray-900">
          Booking details could not be loaded
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          This booking may not belong to your account, or it is unavailable.
        </p>
        <Button asChild variant="outline" className="mt-5">
          <Link href="/account/to-let">Back to My Bookings</Link>
        </Button>
      </div>
    );
  }

  return <BookingDetails booking={booking} />;
}

function BookingDetails({ booking }: { booking: ToLetBookingRequestView }) {
  const snapshot = booking.offerSnapshot;
  const status = statusPresentation[booking.status];
  const StatusIcon = status.icon;
  const rentalQuery = useToLetRental(booking.bookingCode);
  const contract = rentalFromResponse(rentalQuery.data);
  const leave = useRequestToLetLeave();
  const [alert, setAlert] = useState<{
    preferredCategory: string;
    preferredLocation: string;
    minimumSizeSqFt: number;
    minimumBedrooms: number;
    minimumBathrooms: number;
    minimumBalconies: number;
    balconyPreference: "required" | "optional" | "not_required";
    preferredFloor: string;
  }>({
    preferredCategory: snapshot.unit.unitType,
    preferredLocation: snapshot.property.location,
    minimumSizeSqFt: snapshot.unit.sizeSqFt,
    minimumBedrooms: snapshot.unit.bedrooms,
    minimumBathrooms: snapshot.unit.bathrooms,
    minimumBalconies: snapshot.unit.balconies,
    balconyPreference: snapshot.unit.balconies > 0 ? "required" : "optional",
    preferredFloor: "any",
  });
  const facilities = snapshot.property.facilities;
  const images = Array.from(
    new Set(
      [snapshot.imageUrl, ...(snapshot.unit.imageUrls ?? [])].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            asChild
            size="icon"
            variant="outline"
            aria-label="Back to My Bookings"
          >
            <Link href="/account/to-let">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <p className="text-xs font-semibold text-emerald-700">
              {booking.bookingCode}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">
              {snapshot.unit.name}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {snapshot.property.name} · {snapshot.listingCode}
            </p>
          </div>
        </div>
        <Badge variant="outline" className={status.className}>
          <StatusIcon className="size-4" /> {status.label}
        </Badge>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
          <div className="relative min-h-72 bg-gray-100 sm:min-h-96">
            {images[0] ? (
              <Image
                src={images[0]}
                alt={snapshot.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 55vw"
                unoptimized={images[0].startsWith("http")}
              />
            ) : (
              <div className="flex h-full min-h-72 items-center justify-center text-gray-300">
                <Building2 className="size-12" />
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between gap-6 p-5 sm:p-6">
            <div>
              <p className="text-xs font-semibold text-emerald-700">
                {humanize(snapshot.unit.unitType)}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-gray-900">
                {snapshot.title}
              </h2>
              <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-gray-600">
                <MapPin className="mt-1 size-4 shrink-0 text-gray-400" />
                {snapshot.property.location}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <InfoTile label="Unit ID" value={snapshot.unit.unitCode} />
                <InfoTile
                  label="Size"
                  value={`${snapshot.unit.sizeSqFt.toLocaleString()} sq ft`}
                />
                <InfoTile
                  label="Monthly rent"
                  value={formatMoney(snapshot.monthlyRent)}
                />
                <InfoTile
                  label={
                    booking.status === "accepted" ? "Booked on" : "Requested on"
                  }
                  value={formatDate(booking.respondedAt ?? booking.createdAt)}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-5">
              <div
                className={`rounded-lg border p-3 text-sm ${status.className}`}
              >
                <p className="font-semibold">{status.label}</p>
                <p className="mt-1 leading-6">{status.detail}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {contract?.status === "active" ? (
                  <Button asChild>
                    <a href="#alert-builder">
                      <DoorOpen className="size-4" /> Leave
                    </a>
                  </Button>
                ) : (
                  <Button
                    disabled
                    title="Leave starts after an active rental contract"
                  >
                    <DoorOpen className="size-4" /> Leave
                  </Button>
                )}
                {contract ? (
                  <Button asChild variant="outline">
                    <a href="#rental-comments">
                      <MessageSquareText className="size-4" /> Comment
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    title="A rental contract is required"
                  >
                    <MessageSquareText className="size-4" /> Comment
                  </Button>
                )}
                {booking.status === "accepted" ? (
                  <Button asChild variant="outline">
                    <a href={`tel:${snapshot.ownerContact.phone}`}>
                      <Phone className="size-4" /> Call owner
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {images.length > 1 ? (
          <div className="flex gap-3 overflow-x-auto border-t border-gray-100 p-4">
            {images.slice(1, 6).map((imageUrl) => (
              <div
                key={imageUrl}
                className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-gray-100"
              >
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="112px"
                  unoptimized={imageUrl.startsWith("http")}
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {contract ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">
                {contract.contractCode} · {humanize(contract.status)}
              </p>
              <p className="mt-1 leading-6">
                Contract {formatDate(contract.startDate)} –{" "}
                {formatDate(contract.endDate)} · rent due day{" "}
                {contract.rentDueDay}
              </p>
            </div>
            <Badge className="bg-emerald-700 text-white">
              Unit {humanize(contract.unitStatus)}
            </Badge>
          </div>
          {contract.status === "leaving" ? (
            <p className="mt-3 rounded-lg bg-white/70 p-3">
              Leave is scheduled. Rental access remains available until{" "}
              {formatDate(contract.accessEndsAt)}.
            </p>
          ) : null}
        </div>
      ) : null}

      <Section icon={Home} eyebrow="Overview" title="Unit and rental overview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <InfoTile label="Unit name / number" value={snapshot.unit.name} />
          <InfoTile
            label="Listing category"
            value={humanize(snapshot.unit.unitType)}
          />
          <InfoTile
            label="Floor number"
            value={`Floor ${snapshot.unit.floorNumber}`}
          />
          <InfoTile
            label="Unit size"
            value={`${snapshot.unit.sizeSqFt.toLocaleString()} sq ft`}
          />
          <InfoTile label="Bedrooms" value={snapshot.unit.bedrooms} />
          <InfoTile label="Bathrooms" value={snapshot.unit.bathrooms} />
          <InfoTile label="Balconies" value={snapshot.unit.balconies} />
          <InfoTile
            label="Preferred tenant"
            value={humanize(snapshot.preferredTenant)}
          />
          <InfoTile
            label="Desired move-in"
            value={formatDate(booking.desiredMoveInDate)}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <FacilityItem
            label="Drawing room"
            available={snapshot.unit.hasDrawingRoom}
          />
          <FacilityItem
            label="Dining space"
            available={snapshot.unit.hasDiningSpace}
          />
          <FacilityItem label="Kitchen" available={snapshot.unit.hasKitchen} />
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase">
            Description
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
            {snapshot.unit.description ||
              snapshot.description ||
              snapshot.property.description ||
              "No description was captured with this booking."}
          </p>
        </div>
      </Section>

      <Section
        icon={ShieldCheck}
        eyebrow="Facilities"
        title="Facilities captured with this rental offer"
        description="Older booking snapshots may show Not recorded where the original request did not preserve a facility value."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FacilityItem
            label="Water supply"
            available={facilities?.hasWaterSupply}
          />
          <FacilityItem
            label="Gas connection"
            available={facilities?.hasGasConnection}
          />
          <FacilityItem
            label="Electricity"
            available={facilities?.hasElectricity}
          />
          <FacilityItem label="Internet" available={snapshot.hasInternet} />
          <FacilityItem label="Lift" available={facilities?.hasLift} />
          <FacilityItem label="Parking" available={facilities?.hasParking} />
          <FacilityItem
            label="Generator"
            available={facilities?.hasGenerator}
          />
          <FacilityItem
            label="Security"
            available={facilities?.hasSecurityGuard}
          />
          <FacilityItem label="CCTV" available={facilities?.hasCctv} />
          <FacilityItem
            label="Furnished"
            available={snapshot.unit.isFurnished}
          />
        </div>
        {snapshot.otherFacilities ? (
          <div className="mt-4 rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
            <span className="font-semibold text-gray-900">
              Other facilities:{" "}
            </span>
            {snapshot.otherFacilities}
          </div>
        ) : null}
      </Section>

      <Section
        icon={WalletCards}
        eyebrow="Rent information"
        title="Offer price snapshot"
        description="These values were captured when this Booking Request was submitted. An active contract will become the final source of truth."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RentItem
            label="Monthly rent"
            amount={contract?.monthlyRent ?? snapshot.monthlyRent}
          />
          <RentItem
            label="Advance"
            amount={contract?.advanceAmount ?? snapshot.advanceAmount}
          />
          <RentItem
            label="Security deposit"
            amount={contract?.securityDeposit ?? snapshot.securityDeposit}
          />
          <RentItem
            label="Service charge"
            amount={contract?.serviceCharge ?? snapshot.serviceCharge}
            included={snapshot.serviceChargeIncluded}
          />
          <RentItem
            label="Parking fee"
            amount={contract?.parkingCharge ?? snapshot.parkingCharge}
            included={snapshot.parkingChargeIncluded}
          />
          <RentItem
            label="Utility bill"
            amount={contract?.utilityCharge ?? snapshot.utilityCharge}
            included={snapshot.utilityChargeIncluded}
          />
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <LockKeyhole className="size-5 shrink-0" />
          Payment method: Monthly OTP Verification will activate only after a
          rental contract is active.
        </div>
      </Section>

      <Section
        icon={CalendarDays}
        eyebrow="Payment history"
        title="Monthly rent cycles"
        description="Payment history must stay private until the booking is confirmed and the rental contract becomes active."
      >
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr] gap-2 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 sm:grid-cols-5">
            <span>Month</span>
            <span>Reference</span>
            <span>Rent</span>
            <span>OTP</span>
            <span className="hidden sm:block">Payment</span>
          </div>
          {contract ? (
            contract.payments.map((payment) => (
              <PaymentRow
                key={payment.cycleMonth}
                bookingCode={booking.bookingCode}
                payment={payment}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
              <LockKeyhole className="size-9 text-gray-300" />
              <p className="mt-3 font-semibold text-gray-900">
                Contract activation required
              </p>
              <p className="mt-1 max-w-md text-sm leading-6 text-gray-500">
                No payment record is generated from a Booking Request alone.
              </p>
            </div>
          )}
        </div>
      </Section>

      <Section
        icon={Bell}
        eyebrow="Create To-Let alert"
        title="Prepare your next rental preference"
        description="This preview is prefilled from the current Unit. Saving alerts requires the upcoming notification service."
      >
        <div
          id="alert-builder"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className="text-xs font-medium text-gray-700">
            Preferred category
            <Input
              className="mt-1"
              value={alert.preferredCategory}
              onChange={(event) =>
                setAlert((current) => ({
                  ...current,
                  preferredCategory: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Preferred location
            <Input
              className="mt-1"
              value={alert.preferredLocation}
              onChange={(event) =>
                setAlert((current) => ({
                  ...current,
                  preferredLocation: event.target.value,
                }))
              }
            />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Minimum size
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={alert.minimumSizeSqFt}
              onChange={(event) =>
                setAlert((current) => ({
                  ...current,
                  minimumSizeSqFt: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Bedrooms
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={alert.minimumBedrooms}
              onChange={(event) =>
                setAlert((current) => ({
                  ...current,
                  minimumBedrooms: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Bathrooms
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={alert.minimumBathrooms}
              onChange={(event) =>
                setAlert((current) => ({
                  ...current,
                  minimumBathrooms: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Minimum balconies
            <Input
              className="mt-1"
              type="number"
              min={0}
              value={alert.minimumBalconies}
              onChange={(event) =>
                setAlert((current) => ({
                  ...current,
                  minimumBalconies: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="text-xs font-medium text-gray-700">
            Balcony preference
            <select
              className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3"
              value={alert.balconyPreference}
              onChange={(event) =>
                setAlert((current) => ({
                  ...current,
                  balconyPreference: event.target.value as
                    | "required"
                    | "optional"
                    | "not_required",
                }))
              }
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
              <option value="not_required">Not required</option>
            </select>
          </label>
          <label className="text-xs font-medium text-gray-700">
            Preferred floor
            <Input
              className="mt-1"
              value={alert.preferredFloor}
              onChange={(event) =>
                setAlert((current) => ({
                  ...current,
                  preferredFloor: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5">
          <p className="text-xs text-gray-500">
            Leaving remains scheduled until the contract end date. Your next
            rental preference will be saved at the same time.
          </p>
          <Button
            disabled={contract?.status !== "active" || leave.isPending}
            onClick={() =>
              leave.mutate({ bookingCode: booking.bookingCode, alert })
            }
          >
            <Bell className="size-4" />
            {leave.isPending ? "Scheduling…" : "Schedule Leave & Create Alert"}
          </Button>
        </div>
      </Section>

      {contract ? (
        <CommentsSection
          bookingCode={booking.bookingCode}
          contract={contract}
        />
      ) : null}
    </div>
  );
}
