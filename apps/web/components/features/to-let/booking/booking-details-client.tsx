"use client";

import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  Home,
  LockKeyhole,
  MessageSquareText,
  Phone,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  ToLetDetailHero,
  ToLetDetailsSection,
  ToLetDetailsShell,
  ToLetFacilityItem,
  ToLetInfoTile,
  ToLetRentItem,
} from "@/components/features/to-let/to-let-detail-layout";
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
  type ToLetAlertCategory,
  type ToLetRentalContractView,
  toLetAlertCategoryOptions,
  useAddToLetRentalComment,
  useCreateToLetAlert,
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

const rentalStatusPresentation: Record<
  ToLetRentalContractView["status"],
  {
    label: string;
    detail: string;
    className: string;
    icon: React.ElementType;
  }
> = {
  active: {
    label: "Occupied · Contract active",
    detail:
      "Your rental contract is active. Rent details and monthly payment records are available below.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  leaving: {
    label: "Leaving",
    detail:
      "Your leave request is scheduled and rental access continues until the contract access end date.",
    className: "border-blue-200 bg-blue-50 text-blue-800",
    icon: DoorOpen,
  },
  completed: {
    label: "Completed · Rental history",
    detail:
      "This rental has ended. Its contract and verified payment record remain in your rental history.",
    className: "border-gray-200 bg-gray-100 text-gray-700",
    icon: CheckCircle2,
  },
};

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function tenantLabel(value: string) {
  return value === "any" ? "Any tenant" : humanize(value);
}

function formatMoney(value: number | null) {
  return value === null
    ? "—"
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

function DetailsLoading() {
  return (
    <div
      className="space-y-5"
      role="status"
      aria-label="Loading booking details"
    >
      <span className="sr-only">Loading booking details</span>
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
        <span className="font-medium text-emerald-700">Verified</span>
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
      ) : (
        <span className="font-semibold text-emerald-700">Paid</span>
      )}
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
    <ToLetDetailsSection
      id="rental-comments"
      icon={MessageSquareText}
      eyebrow="Comments"
      title="Verified rental feedback"
      description="Read and share feedback about this property during your current rental period."
      embedded
    >
      <div className="space-y-3">
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
        onClick={async () => {
          try {
            await addComment.mutateAsync({
              bookingCode,
              body: body.trim(),
              rating,
            });
            setBody("");
          } catch {
            // The mutation hook displays the API error.
          }
        }}
      >
        <MessageSquareText className="size-4" /> Submit comment
      </Button>
    </ToLetDetailsSection>
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
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center">
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
  const rentalQuery = useToLetRental(booking.bookingCode);
  const contract = rentalFromResponse(rentalQuery.data);
  const status = contract
    ? rentalStatusPresentation[contract.status]
    : statusPresentation[booking.status];
  const leave = useRequestToLetLeave();
  const createAlert = useCreateToLetAlert();
  const [alertOpen, setAlertOpen] = useState(false);
  const [alert, setAlert] = useState<{
    preferredCategory: ToLetAlertCategory;
    preferredLocation: string;
    minimumSizeSqFt: number;
    minimumBedrooms: number;
    minimumBathrooms: number;
    minimumBalconies: number;
    balconyPreference: "required" | "optional" | "not_required";
    preferredFloor: string;
  }>({
    preferredCategory: snapshot.unit.unitType as ToLetAlertCategory,
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

  function openLeaveForm() {
    setAlertOpen(true);
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLSelectElement>("#alert-builder select");
      field?.focus({ preventScroll: true });
      document.getElementById("alert-builder")?.scrollIntoView({ block: "start" });
    });
    if (contract?.status === "active" && !leave.isPending) {
      leave.mutate({ bookingCode: booking.bookingCode });
    }
  }

  if (booking.rentalSummary?.status === "completed" || contract?.status === "completed" ||
      (booking.rentalSummary && rentalQuery.isError)) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <h1 className="text-xl font-semibold">Rental details unavailable</h1>
        <p className="mt-2 text-sm text-gray-500">Details access ends with the rental period. Completed rentals remain in Rental History. If your rental is still current, please try again.</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/account/to-let">Back to My Bookings</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild size="sm" variant="outline">
        <Link href="/account/to-let">
          <ArrowLeft className="size-4" /> Back to My Bookings
        </Link>
      </Button>

      <ToLetDetailHero
        documentOrder
        imageUrls={images}
        imageAlt={snapshot.title}
        code={booking.bookingCode}
        title={snapshot.title}
        propertyName={snapshot.property.name}
        location={snapshot.property.location}
        unitCode={snapshot.unit.unitCode}
        unitName={snapshot.unit.name}
        category={humanize(snapshot.unit.unitType)}
        size={`${snapshot.unit.sizeSqFt.toLocaleString("en-BD")} sq ft`}
        monthlyRent={formatMoney(contract?.monthlyRent ?? snapshot.monthlyRent)}
        statusLabel={status.label}
        statusTone={
          contract
            ? contract.status === "active"
              ? "emerald"
              : contract.status === "leaving"
                ? "blue"
                : "neutral"
            : booking.status === "pending"
              ? "amber"
              : booking.status === "accepted"
                ? "emerald"
                : booking.status === "rejected"
                  ? "red"
                  : "neutral"
        }
        dateLabel={
          booking.status === "accepted" || contract
            ? "Booked on"
            : "Requested on"
        }
        dateValue={formatDate(booking.respondedAt ?? booking.createdAt)}
        statusDetail={status.detail}
        actions={
          <>
            {contract?.status === "active" || contract?.status === "leaving" ? (
              <Button onClick={openLeaveForm} disabled={leave.isPending} aria-expanded={alertOpen} aria-controls="alert-builder">
                  <DoorOpen className="size-4" /> {leave.isPending ? "Scheduling…" : contract.status === "leaving" ? "Leaving · Create alert" : "Leave"}
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
          </>
        }
      />

      {contract ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
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

      <ToLetDetailsShell
        items={[
          { href: "#overview", label: "Unit Information" },
          { href: "#facilities", label: "Facilities" },
          { href: "#rent-information", label: "Rent" },
          ...(contract ? [{ href: "#payment-history", label: "Payment" }] : []),
          ...(alertOpen ? [{ href: "#alert-builder", label: "Alert" }] : []),
          ...(contract
            ? [{ href: "#rental-comments", label: "Comments" }]
            : []),
        ]}
      >
        <ToLetDetailsSection
          id="overview"
          icon={Home}
          eyebrow="Overview"
          title="Unit Information"
          embedded
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ToLetInfoTile
              label="Unit name / number"
              value={snapshot.unit.name}
            />
            <ToLetInfoTile
              label="Listing category"
              value={humanize(snapshot.unit.unitType)}
            />
            <ToLetInfoTile
              label="Floor number"
              value={`Floor ${snapshot.unit.floorNumber}`}
            />
            <ToLetInfoTile
              label="Unit size"
              value={`${snapshot.unit.sizeSqFt.toLocaleString()} sq ft`}
            />
            <ToLetInfoTile label="Bedrooms" value={snapshot.unit.bedrooms} />
            <ToLetInfoTile label="Bathrooms" value={snapshot.unit.bathrooms} />
            <ToLetInfoTile label="Balconies" value={snapshot.unit.balconies} />
            <ToLetInfoTile
              label="Preferred tenant"
              value={tenantLabel(snapshot.preferredTenant)}
            />
            <ToLetInfoTile
              label="Desired move-in"
              value={formatDate(booking.desiredMoveInDate)}
            />
            <ToLetInfoTile
              label={
                booking.status === "accepted" ? "Booked on" : "Requested on"
              }
              value={formatDate(booking.respondedAt ?? booking.createdAt, true)}
            />
            <ToLetInfoTile label="Listing status" value={status.label} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ToLetFacilityItem
              label="Drawing room"
              available={snapshot.unit.hasDrawingRoom}
            />
            <ToLetFacilityItem
              label="Dining space"
              available={snapshot.unit.hasDiningSpace}
            />
            <ToLetFacilityItem
              label="Kitchen"
              available={snapshot.unit.hasKitchen}
            />
          </div>

          <div className="mt-5 border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-900">Description</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
              {snapshot.unit.description ||
                snapshot.description ||
                snapshot.property.description ||
                "No description was captured with this booking."}
            </p>
          </div>
        </ToLetDetailsSection>

        <ToLetDetailsSection
          id="facilities"
          icon={ShieldCheck}
          eyebrow="Facilities"
          title="Facilities"
          description="Older booking snapshots may show Not recorded where the original request did not preserve a facility value."
          embedded
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <ToLetFacilityItem
              label="Water supply"
              available={facilities?.hasWaterSupply}
              included={facilities?.hasWaterSupply}
            />
            <ToLetFacilityItem
              label="Gas connection"
              available={facilities?.hasGasConnection}
              included={facilities?.hasGasConnection}
            />
            <ToLetFacilityItem
              label="Electricity"
              available={facilities?.hasElectricity}
              included={facilities?.hasElectricity}
            />
            <ToLetFacilityItem
              label="Internet"
              available={snapshot.hasInternet}
              included={snapshot.hasInternet}
            />
            <ToLetFacilityItem
              label="Lift"
              available={facilities?.hasLift}
              included={facilities?.hasLift}
            />
            <ToLetFacilityItem
              label="Parking"
              available={facilities?.hasParking}
              included={facilities?.hasParking}
            />
            <ToLetFacilityItem
              label="Generator"
              available={facilities?.hasGenerator}
              included={facilities?.hasGenerator}
            />
            <ToLetFacilityItem
              label="Security"
              available={facilities?.hasSecurityGuard}
              included={facilities?.hasSecurityGuard}
            />
            <ToLetFacilityItem
              label="CCTV"
              available={facilities?.hasCctv}
              included={facilities?.hasCctv}
            />
            <ToLetFacilityItem
              label="Furnished"
              available={snapshot.unit.isFurnished}
              included={snapshot.unit.isFurnished}
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
        </ToLetDetailsSection>

        <ToLetDetailsSection
          id="rent-information"
          icon={WalletCards}
          eyebrow="Rent information"
          title="Rental terms"
          description="These values were captured when this Booking Request was submitted. An active contract will become the final source of truth."
          embedded
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ToLetRentItem
              label="Monthly rent"
              value={formatMoney(contract?.monthlyRent ?? snapshot.monthlyRent)}
            />
            <ToLetRentItem
              label="Advance"
              value={formatMoney(
                contract?.advanceAmount ?? snapshot.advanceAmount,
              )}
            />
            <ToLetRentItem
              label="Security deposit"
              value={formatMoney(
                contract?.securityDeposit ?? snapshot.securityDeposit,
              )}
            />
            <ToLetRentItem
              label="Service charge"
              value={formatMoney(
                contract?.serviceCharge ?? snapshot.serviceCharge,
              )}
              included={snapshot.serviceChargeIncluded}
            />
            <ToLetRentItem
              label="Parking fee"
              value={formatMoney(
                contract?.parkingCharge ?? snapshot.parkingCharge,
              )}
              included={snapshot.parkingChargeIncluded}
            />
            <ToLetRentItem
              label="Utility bill"
              value={formatMoney(
                contract?.utilityCharge ?? snapshot.utilityCharge,
              )}
              included={snapshot.utilityChargeIncluded}
            />
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <LockKeyhole className="size-5 shrink-0" />
            {contract
              ? "Payment method: Monthly OTP Verification. Enter the receiver name and the owner-provided OTP for each rent cycle."
              : "Payment method: Monthly OTP Verification will activate only after a rental contract is active."}
          </div>
        </ToLetDetailsSection>

        {contract ? (
          <ToLetDetailsSection
            id="payment-history"
            icon={CalendarDays}
            eyebrow="Payment history"
            title="Monthly rent cycles"
            description="This private history is available because the booking is confirmed and a rental contract has been activated."
            embedded
          >
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <div className="grid grid-cols-[1fr_1.2fr_1fr_0.8fr] gap-2 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 sm:grid-cols-5">
                <span>Month</span>
                <span>Reference</span>
                <span>Rent</span>
                <span>OTP</span>
                <span className="hidden sm:block">Payment</span>
              </div>
              {contract.payments.length > 0 ? (
                contract.payments.map((payment) => (
                  <PaymentRow
                    key={payment.cycleMonth}
                    bookingCode={booking.bookingCode}
                    payment={payment}
                  />
                ))
              ) : (
                <p className="px-4 py-8 text-center text-sm text-gray-500">
                  No monthly rent cycle has been generated yet.
                </p>
              )}
            </div>
          </ToLetDetailsSection>
        ) : null}

        {alertOpen && <ToLetDetailsSection
          id="alert-builder"
          icon={Bell}
          eyebrow="Create To-Let alert"
          title="Prepare your next rental preference"
          description="Prefilled from your current rental. Save your category, location and minimum size to receive matching rental alerts. Closing this form does not cancel your scheduled leave."
          embedded
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-medium text-gray-700">
              Preferred category
              <select
                className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3"
                value={alert.preferredCategory}
                onChange={(event) =>
                  setAlert((current) => ({
                    ...current,
                    preferredCategory: event.target.value as ToLetAlertCategory,
                  }))
                }
              >
                {toLetAlertCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
              Details remain accessible through the contract end date. Save your next rental preferences separately.
            </p>
            {leave.isError && <p role="alert" className="text-sm text-red-600">{leave.error.message} <button type="button" className="underline" onClick={openLeaveForm}>Retry scheduling leave</button></p>}
            <Button variant="outline" onClick={() => setAlertOpen(false)}>Close form</Button>
            <Button
              disabled={createAlert.isPending || leave.isPending || leave.isError || (contract?.status !== "leaving" && !leave.isSuccess)}
              onClick={() =>
                createAlert.mutate(alert, { onSuccess: () => setAlertOpen(false) })
              }
            >
              <Bell className="size-4" />
              {createAlert.isPending ? "Saving…" : "Save alert"}
            </Button>
          </div>
        </ToLetDetailsSection>}

        {contract ? (
          <CommentsSection
            bookingCode={booking.bookingCode}
            contract={contract}
          />
        ) : null}
      </ToLetDetailsShell>
    </div>
  );
}
