"use client";

import {
  Ban,
  Bath,
  BedDouble,
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Eye,
  History,
  Home,
  ListFilter,
  MapPin,
  Phone,
  Ruler,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ListingImageCarousel } from "@/components/features/to-let/listing-image-carousel";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  bookingRequestsFromResponse,
  type ToLetBookingRequestView,
  type ToLetBookingStatus,
  useCancelMyToLetBooking,
  useMyToLetBookings,
} from "@/hooks/use-to-let-booking-api";
import {
  type ToLetAlertCategory,
  toLetAlertCategoryOptions,
  useCreateToLetAlert,
} from "@/hooks/use-to-let-rental-api";

type BookingTab = "all" | "requests" | "current" | "history";

const statusConfig: Record<
  ToLetBookingStatus,
  { label: string; className: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3,
  },
  accepted: {
    label: "Booked",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    className: "border-red-200 bg-red-50 text-red-700",
    icon: XCircle,
  },
  cancelled: {
    label: "Cancelled",
    className: "border-gray-200 bg-gray-100 text-gray-600",
    icon: Ban,
  },
};

const tabs: Array<{
  value: BookingTab;
  label: string;
  icon: React.ElementType;
}> = [
  { value: "all", label: "All", icon: ListFilter },
  { value: "requests", label: "Booking Requests", icon: Clock3 },
  { value: "current", label: "Current Rental", icon: Home },
  { value: "history", label: "Rental History", icon: History },
];

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(value: number | null) {
  return value === null
    ? "Price hidden"
    : `৳${new Intl.NumberFormat("en-BD").format(value)}`;
}

function formatDate(value: string, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(date);
}

function filterBookings(bookings: ToLetBookingRequestView[], tab: BookingTab) {
  if (tab === "all") return bookings;
  if (tab === "requests") {
    return bookings.filter((booking) => !booking.rentalSummary);
  }
  if (tab === "current") {
    return bookings.filter(
      (booking) =>
        booking.rentalSummary?.status === "active" ||
        booking.rentalSummary?.status === "leaving",
    );
  }
  return bookings.filter(
    (booking) => booking.rentalSummary?.status === "completed",
  );
}

function BookingStatusBadge({ status }: { status: ToLetBookingStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon aria-hidden="true" />
      {config.label}
    </Badge>
  );
}

function RentalStatusBadge({
  status,
}: {
  status: "active" | "leaving" | "completed";
}) {
  const labels = {
    active: "Occupied",
    leaving: "Leaving",
    completed: "Completed",
  } as const;
  return (
    <Badge
      variant="outline"
      className={
        status === "completed"
          ? "border-gray-200 bg-gray-100 text-gray-600"
          : status === "leaving"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }
    >
      {labels[status]}
    </Badge>
  );
}

function EmptyBookings({ tab }: { tab: BookingTab }) {
  const emptyCopy: Record<BookingTab, { title: string; description: string }> =
    {
      all: {
        title: "No To-Let activity yet",
        description:
          "Booking requests, current rentals and completed rentals will appear here.",
      },
      requests: {
        title: "No booking requests",
        description:
          "Requests you send from a To-Let listing will appear here.",
      },
      current: {
        title: "No current rental",
        description:
          "An accepted booking appears here after its rental contract is activated.",
      },
      history: {
        title: "No rental history",
        description: "Rentals move here automatically after the contract ends.",
      },
    };
  const copy = emptyCopy[tab];

  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CalendarCheck className="size-6" />
      </span>
      <h2 className="mt-4 font-semibold text-gray-900">{copy.title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-500">
        {copy.description}
      </p>
      <Button asChild className="mt-5 bg-emerald-600 hover:bg-emerald-700">
        <Link href="/to-let">Browse To-Let listings</Link>
      </Button>
    </div>
  );
}

function BookingCard({
  booking,
  cancelling,
  onCancel,
}: {
  booking: ToLetBookingRequestView;
  cancelling: boolean;
  onCancel: (bookingCode: string) => Promise<void>;
}) {
  const snapshot = booking.offerSnapshot;
  const rental = booking.rentalSummary;
  const bookingImages = Array.from(
    new Set(
      [snapshot.imageUrl, ...(snapshot.unit.imageUrls ?? [])].filter(
        (value): value is string => Boolean(value?.trim()),
      ),
    ),
  );
  const unitFacts: Array<{ label: string; icon: React.ElementType }> = [];
  if (snapshot.unit.bedrooms > 0) {
    unitFacts.push({
      label: `${snapshot.unit.bedrooms} ${snapshot.unit.bedrooms === 1 ? "bed" : "beds"}`,
      icon: BedDouble,
    });
  }
  if (snapshot.unit.bathrooms > 0) {
    unitFacts.push({
      label: `${snapshot.unit.bathrooms} ${snapshot.unit.bathrooms === 1 ? "bath" : "baths"}`,
      icon: Bath,
    });
  }
  unitFacts.push({
    label: `${snapshot.unit.sizeSqFt.toLocaleString()} sq ft`,
    icon: Ruler,
  });
  const facilityLabels = [
    snapshot.property.facilities?.hasWaterSupply && "Water supply",
    snapshot.property.facilities?.hasGasConnection && "Gas connection",
    snapshot.property.facilities?.hasSecurityGuard && "Security",
    snapshot.property.facilities?.hasParking && "Parking",
    snapshot.property.facilities?.hasLift && "Lift",
    snapshot.hasInternet && "Internet",
  ].filter((value): value is string => Boolean(value));

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-gray-500">
            {booking.status === "accepted" ? "Booked" : "Requested"} on{" "}
            {formatDate(booking.respondedAt ?? booking.createdAt, true)}
          </p>
          <p className="mt-1 font-semibold text-gray-900">
            ID # {booking.bookingCode}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rental ? (
            <RentalStatusBadge status={rental.status} />
          ) : (
            <BookingStatusBadge status={booking.status} />
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={`/account/to-let/bookings/${booking.bookingCode}`}>
              <Eye className="size-4" /> View Details
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
        <ListingImageCarousel
          imageUrls={bookingImages}
          alt={snapshot.title}
          className="md:h-full md:min-h-64 md:aspect-auto"
          sizes="(max-width: 768px) 100vw, 208px"
          galleryHref={`/account/to-let/bookings/${booking.bookingCode}`}
        />

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-emerald-700">
                {humanize(snapshot.unit.unitType)} · {snapshot.listingCode}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                {snapshot.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {snapshot.property.name} · {snapshot.unit.name}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-lg font-bold text-emerald-700">
                {formatMoney(rental?.monthlyRent ?? snapshot.monthlyRent)}
              </p>
              <p className="text-xs text-gray-500">
                {rental ? "contract monthly rent" : "requested monthly rent"}
              </p>
            </div>
          </div>

          <p className="flex items-start gap-2 text-sm text-gray-600">
            <MapPin className="mt-0.5 size-4 shrink-0 text-gray-400" />
            {snapshot.property.location}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600">
            {unitFacts.map((fact) => {
              const Icon = fact.icon;
              return (
                <span
                  key={fact.label}
                  className="inline-flex items-center gap-1.5"
                >
                  <Icon className="size-4 text-gray-400" /> {fact.label}
                </span>
              );
            })}
          </div>

          {facilityLabels.length > 0 ? (
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Facilities:</span>{" "}
              {facilityLabels.slice(0, 3).join(" · ")}
              {facilityLabels.length > 3
                ? ` +${facilityLabels.length - 3} more`
                : ""}
            </p>
          ) : null}

          <div className="grid gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-gray-500">Move-in preference:</span>{" "}
              <span className="font-medium text-gray-900">
                {booking.desiredMoveInDate
                  ? formatDate(booking.desiredMoveInDate)
                  : "Not specified"}
              </span>
            </p>
            <p>
              <span className="text-gray-500">Available from:</span>{" "}
              <span className="font-medium text-gray-900">
                {formatDate(snapshot.availableFrom)}
              </span>
            </p>
          </div>

          {booking.message ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Your message
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                {booking.message}
              </p>
            </div>
          ) : null}

          {booking.status === "accepted" && !rental ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">The owner accepted your request.</p>
              <p className="mt-1 leading-6">
                The Unit is booked, but the rental contract is not active yet.
              </p>
              <a
                href={`tel:${snapshot.ownerContact.phone}`}
                className="mt-2 inline-flex items-center gap-1.5 font-semibold hover:underline"
              >
                <Phone className="size-4" /> Call {snapshot.ownerContact.name}
              </a>
            </div>
          ) : null}

          {booking.responseNote ? (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <p className="font-semibold text-gray-900">Owner response</p>
              <p className="mt-1 whitespace-pre-wrap leading-6 text-gray-600">
                {booking.responseNote}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500">
              Offer captured {formatDate(snapshot.capturedAt, true)}
            </p>
            {booking.status === "pending" ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={cancelling}
                  >
                    Cancel request
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Cancel this booking request?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      The owner will no longer be able to accept this request.
                      This action does not delete the request from your history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={cancelling}>
                      Keep request
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={cancelling}
                      onClick={() => void onCancel(booking.bookingCode)}
                    >
                      Cancel request
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <Link
                    href={`/account/to-let/bookings/${booking.bookingCode}`}
                  >
                    Rental details
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/to-let">Browse more</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function BookingsLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading My Bookings">
      <span className="sr-only">Loading My Bookings</span>
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 2 }).map((_, index) => (
        <Skeleton key={index} className="h-72 w-full" />
      ))}
    </div>
  );
}

function SetAlertPanel({ onSaved }: { onSaved: () => void }) {
  const createAlert = useCreateToLetAlert();
  const [form, setForm] = useState<{
    preferredCategory: ToLetAlertCategory;
    preferredLocation: string;
    minimumSizeSqFt: number;
    minimumBedrooms: number;
    minimumBathrooms: number;
    minimumBalconies: number;
    balconyPreference: "required" | "optional" | "not_required";
    preferredFloor: string;
  }>({
    preferredCategory: "family_flat",
    preferredLocation: "Dhaka",
    minimumSizeSqFt: 0,
    minimumBedrooms: 0,
    minimumBathrooms: 0,
    minimumBalconies: 0,
    balconyPreference: "optional" as "required" | "optional" | "not_required",
    preferredFloor: "any",
  });

  const save = async () => {
    try {
      await createAlert.mutateAsync(form);
      onSaved();
    } catch {
      // The mutation hook displays the API validation message.
    }
  };

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Bell className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold text-gray-900">Create To-Let Alert</h2>
          <p className="mt-1 text-sm text-gray-500">
            Save what you need. Matching notifications can use this preference
            when the notification service is connected.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-gray-700">
          Preferred category
          <select
            className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-3"
            value={form.preferredCategory}
            onChange={(event) =>
              setForm((current) => ({
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
        <label className="text-xs font-medium text-gray-700 sm:col-span-2">
          Preferred location
          <Input
            className="mt-1 bg-white"
            value={form.preferredLocation}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                preferredLocation: event.target.value,
              }))
            }
          />
        </label>
        <label className="text-xs font-medium text-gray-700">
          Minimum size (sq ft)
          <Input
            className="mt-1 bg-white"
            type="number"
            min={0}
            value={form.minimumSizeSqFt}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                minimumSizeSqFt: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="text-xs font-medium text-gray-700">
          Minimum bedrooms
          <Input
            className="mt-1 bg-white"
            type="number"
            min={0}
            value={form.minimumBedrooms}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                minimumBedrooms: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="text-xs font-medium text-gray-700">
          Minimum bathrooms
          <Input
            className="mt-1 bg-white"
            type="number"
            min={0}
            value={form.minimumBathrooms}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                minimumBathrooms: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="text-xs font-medium text-gray-700">
          Minimum balconies
          <Input
            className="mt-1 bg-white"
            type="number"
            min={0}
            value={form.minimumBalconies}
            onChange={(event) =>
              setForm((current) => ({
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
            value={form.balconyPreference}
            onChange={(event) =>
              setForm((current) => ({
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
            className="mt-1 bg-white"
            value={form.preferredFloor}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                preferredFloor: event.target.value,
              }))
            }
          />
        </label>
      </div>

      <div className="mt-4 flex justify-end gap-2 border-t border-emerald-100 pt-4">
        <Button variant="ghost" onClick={onSaved}>
          Close
        </Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          disabled={
            createAlert.isPending ||
            form.preferredCategory.trim().length === 0 ||
            form.preferredLocation.trim().length < 2
          }
          onClick={() => void save()}
        >
          <Bell className="size-4" />
          {createAlert.isPending ? "Saving…" : "Save Alert"}
        </Button>
      </div>
    </section>
  );
}

export function MyBookingsClient() {
  const query = useMyToLetBookings();
  const cancelBooking = useCancelMyToLetBooking();
  const [showAlert, setShowAlert] = useState(false);

  if (query.isLoading) return <BookingsLoading />;

  if (query.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-white px-6 py-10 text-center">
        <h1 className="text-xl font-semibold text-gray-900">
          Booking requests could not be loaded
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Please try again. Your saved requests have not been changed.
        </p>
        <Button
          variant="outline"
          className="mt-5"
          onClick={() => query.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const bookings = bookingRequestsFromResponse(query.data);
  const counts: Record<BookingTab, number> = {
    all: bookings.length,
    requests: filterBookings(bookings, "requests").length,
    current: filterBookings(bookings, "current").length,
    history: filterBookings(bookings, "history").length,
  };

  const cancel = async (bookingCode: string) => {
    try {
      await cancelBooking.mutateAsync({ bookingCode });
    } catch {
      // The mutation hook shows the server error.
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Track booking requests, confirmed units and your rental history.
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowAlert((open) => !open)}>
          <Bell className="size-4" />
          {showAlert ? "Close Alert" : "Set Alert"}
        </Button>
      </div>

      {showAlert ? <SetAlertPanel onSaved={() => setShowAlert(false)} /> : null}

      <Tabs defaultValue="all" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto w-max min-w-full justify-start bg-gray-100 p-1">
            {tabs.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                aria-label={`${label}, ${counts[value]} items`}
                className="min-h-10 shrink-0 gap-1.5 px-3 sm:gap-2"
              >
                <Icon className="size-4" />
                <span>{label}</span>
                <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700">
                  {counts[value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {tabs.map(({ value }) => {
          const filtered = filterBookings(bookings, value);
          return (
            <TabsContent key={value} value={value} className="mt-4">
              {filtered.length === 0 ? (
                <EmptyBookings tab={value} />
              ) : (
                <div className="space-y-4">
                  {filtered.map((booking) => (
                    <BookingCard
                      key={booking.bookingCode}
                      booking={booking}
                      cancelling={cancelBooking.isPending}
                      onCancel={cancel}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
