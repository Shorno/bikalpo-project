import { ListingViewRecorder } from "@/components/features/to-let/listing-view-recorder";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  ExternalLink,
  MapPin,
  Phone,
  ShieldCheck,
  Video,
  WalletCards,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestBookingButton } from "@/components/features/to-let/booking/request-booking-dialog";
import {
  ToLetDetailHero,
  ToLetDetailsSection,
  ToLetDetailsShell,
  ToLetFacilityItem,
  ToLetInfoTile,
  ToLetRentItem,
  ToLetSummaryRow,
} from "@/components/features/to-let/to-let-detail-layout";
import {
  getPublicToLetUnitListingByCode,
  getToLetQrUnitListingByCode,
} from "@/lib/public-data";

// Public display data uses the same cache window as product details.
// Booking mutations still validate current availability in the database.
export const revalidate = 30;

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
  return value === null ? "—" : `BDT ${value.toLocaleString("en-BD")}`;
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

export default async function PublicListingPage({
  params,
  searchParams,
}: PublicListingPageProps) {
  const [{ listingCode }, query] = await Promise.all([params, searchParams]);
  const { qrToken } = query ?? {};
  const listing = qrToken
    ? await getToLetQrUnitListingByCode(qrToken, listingCode, 0)
    : await getPublicToLetUnitListingByCode(listingCode, 30);

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
  const bookedAt = formatDate(listing.bookedAt);
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
    <div className="min-h-screen bg-zinc-50">
      <ListingViewRecorder key={`${listingCode}:${qrToken ?? "public"}`} listingCode={listingCode} qrToken={qrToken} />
      <nav
        aria-label="Breadcrumb"
        className="border-b border-zinc-200 bg-white"
      >
        <ol className="mx-auto flex min-h-12 max-w-7xl items-center gap-2 px-4 text-xs text-zinc-500 sm:px-6 lg:px-8">
          <li>
            <Link href="/" className="hover:text-blue-700">
              Home
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li>
            <Link href="/to-let" className="hover:text-blue-700">
              To-Let
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li className="max-w-40 truncate text-zinc-700 sm:max-w-none">
            {humanize(listing.unit.unitType)}
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li className="font-mono text-zinc-700">{listing.listingCode}</li>
        </ol>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <Link
            href={qrToken ? `/to-let/qr/${qrToken}` : "/to-let"}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-900 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-zinc-950 sm:text-xl">
              {listing.title}
            </h1>
            <p className="mt-0.5 font-mono text-xs text-zinc-500">
              {listing.listingCode}
            </p>
          </div>
        </header>

        <div className="mt-4">
          <ToLetDetailHero
            imageUrls={listing.imageUrls}
            imageAlt={listing.title}
            code={listing.listingCode}
            title={listing.title}
            propertyName={listing.property.name}
            location={`${listing.location}${
              listing.property.nearbyLandmark
                ? ` · Near ${listing.property.nearbyLandmark}`
                : ""
            }`}
            unitCode={listing.unitCode}
            unitName={listing.unit.name}
            category={humanize(listing.unit.unitType)}
            viewCount={listing.viewCount}
            size={`${listing.unit.sizeSqFt.toLocaleString("en-BD")} sq ft`}
            monthlyRent={
              listing.monthlyRent === null
                ? "Price hidden by owner"
                : money(listing.monthlyRent)
            }
            statusLabel={availability}
            statusTone={isBooked ? "amber" : "emerald"}
            dateLabel={isBooked ? "Booked on" : "Available from"}
            dateValue={
              isBooked
                ? (bookedAt ?? "Booking confirmed")
                : (availableFrom ?? listing.availableFrom)
            }
            statusDetail={
              isBooked
                ? `This Unit is booked, so new booking requests are closed. It remains visible until ${marketplaceVisibleUntil ?? "30 days after confirmation"}.`
                : "The property owner reviews each request before confirming the booking."
            }
            showHeading={false}
            actions={
              <div id="booking" className="grid w-full gap-2 sm:grid-cols-2">
                {isBooked ? (
                  <div className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
                    Booked · Requests closed
                  </div>
                ) : (
                  <RequestBookingButton
                    listingCode={listing.listingCode}
                    availableFrom={listing.availableFrom}
                    minimumDate={today}
                    {...(qrToken ? { qrToken } : {})}
                  />
                )}
                <a
                  href={`tel:${listing.contact.phone}`}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  Call owner
                </a>
              </div>
            }
          />
        </div>

        <div className="mt-5">
          <ToLetDetailsShell
            items={[
              { href: "#overview", label: "Unit Information" },
              { href: "#facilities", label: "Facilities" },
              { href: "#rent-information", label: "Rent" },
              { href: "#property-information", label: "Property" },
            ]}
          >
            <ToLetDetailsSection
              id="overview"
              icon={Building2}
              eyebrow="Overview"
              title="Unit Information"
              embedded
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ToLetInfoTile
                  label="Unit name / number"
                  value={listing.unit.name}
                />
                <ToLetInfoTile
                  label="Listing category"
                  value={humanize(listing.unit.unitType)}
                />
                <ToLetInfoTile
                  label="Floor number"
                  value={formatFloor(listing.unit.floorNumber)}
                />
                <ToLetInfoTile
                  label="Unit size"
                  value={`${listing.unit.sizeSqFt.toLocaleString("en-BD")} sq ft`}
                />
                <ToLetInfoTile label="Bedrooms" value={listing.unit.bedrooms} />
                <ToLetInfoTile
                  label="Bathrooms"
                  value={listing.unit.bathrooms}
                />
                <ToLetInfoTile
                  label="Balconies"
                  value={listing.unit.balconies}
                />
                <ToLetInfoTile
                  label="Preferred tenant"
                  value={tenantLabel(listing.preferredTenant)}
                />
                <ToLetInfoTile
                  label="Available from"
                  value={availableFrom ?? listing.availableFrom}
                />
                <ToLetInfoTile
                  label="Listing status"
                  value={isBooked ? "Booked" : "Active"}
                />
                {isBooked ? (
                  <>
                    <ToLetInfoTile
                      label="Booked on"
                      value={bookedAt ?? "Booking confirmed"}
                    />
                    <ToLetInfoTile
                      label="Visible until"
                      value={
                        marketplaceVisibleUntil ?? "30 days after confirmation"
                      }
                    />
                  </>
                ) : null}
                {publishedAt ? (
                  <ToLetInfoTile label="Published on" value={publishedAt} />
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <ToLetFacilityItem
                  label="Drawing room"
                  available={listing.unit.hasDrawingRoom}
                />
                <ToLetFacilityItem
                  label="Dining space"
                  available={listing.unit.hasDiningSpace}
                />
                <ToLetFacilityItem
                  label="Kitchen"
                  available={listing.unit.hasKitchen}
                />
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="text-sm font-semibold text-slate-900">
                  Property description
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">
                  {listing.description ||
                    "No description provided by the owner."}
                </p>
              </div>
            </ToLetDetailsSection>

            <ToLetDetailsSection
              id="facilities"
              icon={ShieldCheck}
              eyebrow="Facilities"
              title="Facilities"
              description="Property facilities are inherited by this Unit. Listing-specific items use the current rental offer."
              embedded
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <ToLetFacilityItem
                  label="Water supply"
                  available={listing.property.hasWaterSupply}
                  included={listing.property.hasWaterSupply}
                />
                <ToLetFacilityItem
                  label="Gas connection"
                  available={listing.property.hasGasConnection}
                  included={listing.property.hasGasConnection}
                />
                <ToLetFacilityItem
                  label="Electricity"
                  available={listing.property.hasElectricity}
                  included={listing.property.hasElectricity}
                />
                <ToLetFacilityItem
                  label="Internet"
                  available={listing.hasInternet}
                  included={listing.hasInternet}
                />
                <ToLetFacilityItem
                  label="Lift"
                  available={listing.property.hasLift}
                  included={listing.property.hasLift}
                />
                <ToLetFacilityItem
                  label="Parking"
                  available={listing.property.hasParking}
                  included={listing.property.hasParking}
                />
                <ToLetFacilityItem
                  label="Generator"
                  available={listing.property.hasGenerator}
                  included={listing.property.hasGenerator}
                />
                <ToLetFacilityItem
                  label="Security"
                  available={listing.property.hasSecurityGuard}
                  included={listing.property.hasSecurityGuard}
                />
                <ToLetFacilityItem
                  label="CCTV"
                  available={listing.property.hasCctv}
                  included={listing.property.hasCctv}
                />
                <ToLetFacilityItem
                  label="Furnished"
                  available={listing.unit.isFurnished}
                  included={listing.unit.isFurnished}
                />
              </div>
              {listing.otherFacilities ? (
                <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-700">
                  <span className="font-semibold text-slate-950">
                    Other facilities:{" "}
                  </span>
                  {listing.otherFacilities}
                </div>
              ) : null}
            </ToLetDetailsSection>

            <ToLetDetailsSection
              id="rent-information"
              icon={WalletCards}
              eyebrow="Rent information"
              title="Rental terms"
              description="The owner controls which prices are visible before booking confirmation."
              embedded
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ToLetRentItem
                  label="Monthly rent"
                  value={money(listing.monthlyRent)}
                />
                <ToLetRentItem
                  label="Advance"
                  value={money(listing.advanceAmount)}
                />
                <ToLetRentItem
                  label="Security deposit"
                  value={money(listing.securityDeposit)}
                />
                {charges.map((charge) => (
                  <ToLetRentItem
                    key={charge.label}
                    label={charge.label}
                    value={
                      charge.included ? "Included in rent" : money(charge.value)
                    }
                    included={charge.included}
                  />
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                <span className="font-semibold">Payment method:</span> Monthly
                OTP Verification activates after an approved booking and active
                contract.
              </div>
            </ToLetDetailsSection>

            <ToLetDetailsSection
              id="property-information"
              icon={MapPin}
              eyebrow="Property information"
              title={listing.property.name}
              embedded
            >
              <dl className="divide-y divide-slate-200 border-y border-slate-200 text-sm">
                <ToLetSummaryRow
                  label="Property ID"
                  value={listing.propertyCode}
                  mono
                />
                <ToLetSummaryRow
                  label="Unit ID"
                  value={listing.unitCode}
                  mono
                />
                <ToLetSummaryRow
                  label="Property type"
                  value={humanize(listing.property.propertyType)}
                />
                <ToLetSummaryRow
                  label="Building type"
                  value={humanize(listing.property.buildingType)}
                />
                <ToLetSummaryRow label="Location" value={listing.location} />
                {listing.property.nearbyLandmark ? (
                  <ToLetSummaryRow
                    label="Nearby landmark"
                    value={listing.property.nearbyLandmark}
                  />
                ) : null}
                <ToLetSummaryRow label="Owner" value={listing.contact.name} />
                <ToLetSummaryRow
                  label="Phone"
                  value={listing.contact.phone}
                  mono
                />
              </dl>

              {listing.videoUrl || mapHref ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {listing.videoUrl ? (
                    <a
                      href={listing.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:border-blue-300 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <MapPin className="size-4" aria-hidden="true" />
                      Open in Google Maps
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </ToLetDetailsSection>
          </ToLetDetailsShell>
        </div>
      </main>
    </div>
  );
}
