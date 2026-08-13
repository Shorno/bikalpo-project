import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  DoorOpen,
  ExternalLink,
  Eye,
  Layers3,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  ShieldCheck,
  Video,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestBookingButton } from "@/components/features/to-let/booking/request-booking-dialog";
import { PublicListingGallery } from "@/components/features/to-let/public-listing-gallery";
import {
  getPublicToLetUnitListingByCode,
  getToLetQrUnitListingByCode,
} from "@/lib/public-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "To-Let Listing",
  description: "View a current To-Let listing and its booking status.",
};

interface PublicListingPageProps {
  params: Promise<{ listingCode: string }>;
  searchParams?: Promise<{ qrToken?: string }>;
}

function humanize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function tenantLabel(value: string) {
  return value === "any" ? "Any tenant" : `${humanize(value)} preferred`;
}

function money(value: number | null) {
  return value === null
    ? "Hidden by owner"
    : `BDT ${value.toLocaleString("en-BD")}`;
}

function formatDate(value: string | Date | null) {
  if (!value) return null;

  const date =
    value instanceof Date
      ? value
      : new Date(
          /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
        );
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function todayInDhaka() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatFloor(floor: number) {
  if (floor === 0) return "Ground floor";
  if (floor < 0) return `Basement ${Math.abs(floor)}`;
  return `Floor ${floor}`;
}

function whatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `88${digits}` : digits;
}

export default async function PublicListingPage({
  params,
  searchParams,
}: PublicListingPageProps) {
  const { listingCode } = await params;
  const { qrToken } = (await searchParams) ?? {};
  const listing = qrToken
    ? await getToLetQrUnitListingByCode(qrToken, listingCode, 0)
    : await getPublicToLetUnitListingByCode(listingCode, 0);

  if (!listing) {
    notFound();
  }

  const charges = [
    {
      label: "Service charge",
      value: listing.serviceCharge,
      included: listing.serviceChargeIncluded,
    },
    {
      label: "Parking charge",
      value: listing.parkingCharge,
      included: listing.parkingChargeIncluded,
    },
    {
      label: "Utility charge",
      value: listing.utilityCharge,
      included: listing.utilityChargeIncluded,
    },
  ];
  const facilities = [
    listing.hasInternet && "Internet",
    listing.unit.hasDrawingRoom && "Drawing room",
    listing.unit.hasDiningSpace && "Dining space",
    listing.unit.hasKitchen && "Kitchen",
    listing.unit.isFurnished && "Furnished",
    listing.property.hasParking && "Parking",
    listing.property.hasLift && "Lift",
    listing.property.hasSecurityGuard && "Security guard",
    listing.property.hasCctv && "CCTV",
    listing.property.hasGenerator && "Generator",
    listing.property.hasWaterSupply && "Water supply",
    listing.property.hasGasConnection && "Gas connection",
    listing.property.hasElectricity && "Electricity",
  ].filter((facility): facility is string => Boolean(facility));
  const availableFrom = formatDate(listing.availableFrom);
  const marketplaceVisibleUntil = formatDate(listing.marketplaceVisibleUntil);
  const isBooked = listing.marketplaceStatus === "booked";
  const today = todayInDhaka();
  const availability = isBooked
    ? "Booked"
    : listing.availableFrom <= today
      ? "Available now"
      : `Available from ${availableFrom}`;
  const publishedAt = formatDate(listing.publishedAt);
  const latitude = Number(listing.property.latitude);
  const longitude = Number(listing.property.longitude);
  const hasCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    (latitude !== 0 || longitude !== 0);
  const mapHref = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    : null;

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <Link
          href={qrToken ? `/to-let/qr/${qrToken}` : "/to-let"}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {qrToken ? "Back to property" : "Back to listings"}
        </Link>

        <header className="mt-5 border-b border-border pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span
              className={`rounded-full px-3 py-1 ring-1 ${
                isBooked
                  ? "bg-amber-50 text-amber-700 ring-amber-200"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-200"
              }`}
            >
              {isBooked ? "Booked" : "Available to book"}
            </span>
            <span className="rounded-full bg-primary/8 px-3 py-1 text-primary">
              {tenantLabel(listing.preferredTenant)}
            </span>
            <span className="rounded-full bg-background px-3 py-1 text-muted-foreground ring-1 ring-border">
              {humanize(listing.unit.unitType)}
            </span>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
                {listing.listingCode}
              </p>
              <h1 className="mt-1 max-w-4xl text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                {listing.title}
              </h1>
              <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground sm:items-center">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary sm:mt-0" />
                <span>
                  {listing.location}
                  {listing.property.nearbyLandmark
                    ? ` · Near ${listing.property.nearbyLandmark}`
                    : ""}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="size-4" aria-hidden="true" />
                {listing.viewCount.toLocaleString("en-BD")} views
              </span>
              {publishedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  Published {publishedAt}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <PublicListingGallery
              imageUrls={listing.imageUrls}
              alt={listing.title}
            />
          </div>

          <aside className="self-stretch lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="space-y-4 lg:sticky lg:top-28">
              <section
                id="booking"
                className="scroll-mt-28 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Monthly rent
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-600">
                      {money(listing.monthlyRent)}
                    </p>
                    {listing.monthlyRent !== null ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        per month
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isBooked
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {availability}
                  </span>
                </div>

                <div className="mt-5 space-y-3 border-t border-border pt-4">
                  <ChargeRow
                    label="Advance"
                    value={money(listing.advanceAmount)}
                  />
                  <ChargeRow
                    label="Security deposit"
                    value={money(listing.securityDeposit)}
                  />
                  {charges.map((charge) => (
                    <ChargeRow
                      key={charge.label}
                      label={charge.label}
                      value={
                        charge.included
                          ? "Included in rent"
                          : money(charge.value)
                      }
                      included={charge.included}
                    />
                  ))}
                </div>

                {isBooked ? (
                  <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800">
                    Booked · New booking requests are closed
                  </div>
                ) : (
                  <RequestBookingButton
                    listingCode={listing.listingCode}
                    availableFrom={listing.availableFrom}
                    minimumDate={today}
                    {...(qrToken ? { qrToken } : {})}
                  />
                )}
                <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
                  {isBooked
                    ? `This listing remains visible as Booked${marketplaceVisibleUntil ? ` until ${marketplaceVisibleUntil}` : " for 30 days after confirmation"}.`
                    : "The owner reviews every request before a booking is confirmed."}
                </p>
              </section>

              <section className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <ShieldCheck className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-foreground">
                      Property contact
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {listing.contact.name}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a
                    href={`tel:${listing.contact.phone}`}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <Phone className="size-4" aria-hidden="true" /> Call
                  </a>
                  <a
                    href={`https://wa.me/${whatsAppPhone(listing.contact.phone)}?text=${encodeURIComponent(`I am interested in ${listing.listingCode}: ${listing.title}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    <MessageCircle className="size-4" aria-hidden="true" />
                    WhatsApp
                  </a>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  {listing.contact.phone}
                </p>
              </section>
            </div>
          </aside>

          <div className="space-y-6 lg:col-start-1">
            <section className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
              <SectionHeading
                icon={Building2}
                eyebrow="Unit overview"
                title={`${listing.property.name} · ${listing.unit.name}`}
              />
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Detail
                  label="Unit"
                  value={listing.unit.name}
                  icon={DoorOpen}
                />
                <Detail
                  label="Unit type"
                  value={humanize(listing.unit.unitType)}
                  icon={Building2}
                />
                <Detail
                  label="Floor"
                  value={formatFloor(listing.unit.floorNumber)}
                  icon={Layers3}
                />
                <Detail
                  label="Size"
                  value={`${listing.unit.sizeSqFt.toLocaleString("en-BD")} sq ft`}
                  icon={Ruler}
                />
                <Detail
                  label="Bedrooms"
                  value={String(listing.unit.bedrooms)}
                  icon={BedDouble}
                />
                <Detail
                  label="Bathrooms"
                  value={String(listing.unit.bathrooms)}
                  icon={Bath}
                />
                <Detail
                  label="Balconies"
                  value={String(listing.unit.balconies)}
                  icon={Building2}
                />
                <Detail
                  label={isBooked ? "Booking status" : "Available"}
                  value={
                    isBooked
                      ? "Booked"
                      : (availableFrom ?? listing.availableFrom)
                  }
                  icon={CalendarDays}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
              <SectionHeading
                icon={DoorOpen}
                eyebrow="About this listing"
                title="Description"
              />
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base">
                {listing.description || "No description provided by the owner."}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
              <SectionHeading
                icon={Check}
                eyebrow="What is available"
                title="Facilities"
              />
              {facilities.length > 0 ? (
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {facilities.map((facility) => (
                    <p
                      key={facility}
                      className="flex min-h-10 items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-sm font-medium text-emerald-800"
                    >
                      <Check
                        className="size-4 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                      {facility}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No facilities were specified by the owner.
                </p>
              )}
              {listing.otherFacilities ? (
                <div className="mt-5 border-t border-border pt-5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Other facilities
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground">
                    {listing.otherFacilities}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
              <SectionHeading
                icon={MapPin}
                eyebrow="Property information"
                title={listing.property.name}
              />
              <dl className="mt-5 divide-y divide-border border-y border-border text-sm">
                <PropertyRow label="Property ID" value={listing.propertyCode} />
                <PropertyRow label="Unit ID" value={listing.unitCode} />
                <PropertyRow
                  label="Property type"
                  value={humanize(listing.property.propertyType)}
                />
                <PropertyRow
                  label="Building type"
                  value={humanize(listing.property.buildingType)}
                />
                <PropertyRow label="Location" value={listing.location} />
                {listing.property.nearbyLandmark ? (
                  <PropertyRow
                    label="Nearby landmark"
                    value={listing.property.nearbyLandmark}
                  />
                ) : null}
              </dl>

              {listing.videoUrl || mapHref ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {listing.videoUrl ? (
                    <a
                      href={listing.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <Video className="size-4" aria-hidden="true" />
                      Watch property video
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                  {mapHref ? (
                    <a
                      href={mapHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <MapPin className="size-4" aria-hidden="true" />
                      Open in Google Maps
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-lg font-semibold text-foreground sm:text-xl">
          {title}
        </h2>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/30 p-3.5">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function ChargeRow({
  label,
  value,
  included = false,
}: {
  label: string;
  value: string;
  included?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          included
            ? "text-right font-semibold text-emerald-700"
            : "text-right font-semibold text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[160px_1fr] sm:gap-5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground sm:text-right">{value}</dd>
    </div>
  );
}
