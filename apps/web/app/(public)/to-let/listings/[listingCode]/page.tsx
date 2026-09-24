import {
  Building2,
  ChevronRight,
  ExternalLink,
  Info,
  MapPin,
  Phone,
  ShieldCheck,
  Video,
  WalletCards,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { toLetUnitCapabilities } from "@bikalpo-project/api/lib/tolet-categories";
import { checkAuth } from "@/utils/auth";
import { RequestBookingButton } from "@/components/features/to-let/booking/request-booking-dialog";
import { TenantRentalActions } from "@/components/features/to-let/booking/tenant-rental-actions";
import { HiddenAmount } from "@/components/features/to-let/hidden-amount";
import { ListingViewRecorder } from "@/components/features/to-let/listing-view-recorder";
import {
  ToLetDetailHero,
  ToLetDetailsSection,
  ToLetDetailsShell,
  ToLetFacilityRow,
  ToLetInfoTile,
  ToLetOptionTile,
  ToLetRentItem,
  ToLetYesNoTile,
} from "@/components/features/to-let/to-let-detail-layout";
import {
  getPublicToLetUnitListingByCode,
  getToLetQrUnitListingByCode,
} from "@/lib/public-data";

// Session checks must run on every request, never in a shared page cache.
// This authenticated page intentionally does not share a full-route cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "To-Let Listing",
  description: "View a current To-Let listing and its booking status.",
  robots: { index: false, follow: false },
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

function money(value: number | null) {
  return value === null ? <HiddenAmount /> : `৳${value.toLocaleString("en-BD")}`;
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

function ordinalSuffix(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) return "th";
  if (value % 10 === 1) return "st";
  if (value % 10 === 2) return "nd";
  if (value % 10 === 3) return "rd";
  return "th";
}

function formatFloor(floor: number) {
  if (floor === 0) return "Ground Floor";
  if (floor < 0) return `Basement ${Math.abs(floor)}`;
  return `${floor}${ordinalSuffix(floor)} Floor`;
}

const linkButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/20 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default async function PublicListingPage({
  params,
  searchParams,
}: PublicListingPageProps) {
  const [{ listingCode }, query] = await Promise.all([params, searchParams]);
  const qrToken =
    typeof query?.qrToken === "string" ? query.qrToken : undefined;
  const returnTo = qrToken
    ? `/to-let/qr/${encodeURIComponent(qrToken)}/listings/${encodeURIComponent(listingCode)}`
    : `/to-let/listings/${encodeURIComponent(listingCode)}`;
  // Protect direct URLs and RSC navigation, not only the card's click handler.
  if (!(await checkAuth())?.user) {
    redirect(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }
  const listing = qrToken
    ? await getToLetQrUnitListingByCode(qrToken, listingCode, 0)
    : await getPublicToLetUnitListingByCode(listingCode, 30);

  if (!listing) {
    notFound();
  }

  const availableFrom = formatDate(listing.availableFrom);
  const marketplaceVisibleUntil = formatDate(listing.marketplaceVisibleUntil);
  const isBooked = listing.marketplaceStatus === "booked";
  const today = todayInDhaka();
  const availability = isBooked
    ? "Booked"
    : listing.availableFrom <= today
      ? "Available now"
      : `Available from ${availableFrom}`;
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
  const capabilities = toLetUnitCapabilities(listing.unit.unitType);
  const tenantOptions = [
    { value: "family", label: "Family" },
    { value: "bachelor", label: "Bachelor" },
    { value: "office", label: "Office" },
    { value: "any", label: "Any" },
    ...(listing.preferredTenant === "female"
      ? [{ value: "female", label: "Female" }]
      : []),
  ];
  const inclusions = listing.facilityInclusions;
  const facilities = [
    { label: "Water Supply", available: listing.property.hasWaterSupply, included: inclusions?.water },
    { label: "Gas", available: listing.property.hasGasConnection, included: inclusions?.gas },
    { label: "Electricity", available: listing.property.hasElectricity, included: inclusions?.electricity },
    { label: "Internet", available: listing.hasInternet, included: inclusions?.internet },
    { label: "Lift", available: listing.property.hasLift, included: inclusions?.lift },
    { label: "Parking", available: listing.property.hasParking, included: inclusions?.parking },
    { label: "Generator", available: listing.property.hasGenerator, included: inclusions?.generator },
    { label: "Furnished", available: listing.unit.isFurnished, included: inclusions?.furnished },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <ListingViewRecorder
        key={`${listingCode}:${qrToken ?? "public"}`}
        listingCode={listingCode}
        qrToken={qrToken}
      />
      <nav
        aria-label="Breadcrumb"
        className="border-b border-border bg-card"
      >
        <ol className="site-container flex min-h-12 items-center gap-2 px-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <li>
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li>
            <Link href="/to-let" className="hover:text-primary">
              To-Let
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li className="max-w-40 truncate text-foreground sm:max-w-none">
            {humanize(listing.unit.unitType)}
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li className="font-mono text-foreground">{listing.listingCode}</li>
        </ol>
      </nav>

      <main className="site-container px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <h1 className="sr-only">{listing.title}</h1>
        <ToLetDetailHero
          tourUrl={listing.tourUrl}
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
          size={`${listing.unit.sizeSqFt.toLocaleString("en-BD")} Sq.ft`}
          monthlyRent={money(listing.monthlyRent)}
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
              : undefined
          }
          showHeading={false}
          documentOrder
          actions={
            <>
              <TenantRentalActions listingCode={listing.listingCode} />
              <a href={`tel:${listing.contact.phone}`} className={linkButtonClassName}>
                <Phone className="size-4" aria-hidden="true" />
                Call owner
              </a>
              {mapHref ? (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer"
                  className={linkButtonClassName}
                >
                  <MapPin className="size-4" aria-hidden="true" />
                  Google Maps
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </>
          }
        />

        <div className="mt-5">
          <ToLetDetailsShell
            items={[
              { href: "#unit-info", label: "Unit Info" },
              { href: "#facilities", label: "Facilities" },
              { href: "#rent-information", label: "Rent" },
            ]}
          >
            <ToLetDetailsSection
              id="unit-info"
              icon={Building2}
              title="Unit Info"
              embedded
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ToLetInfoTile
                  label="Unit Name / Number"
                  value={`${listing.unit.name} · ${listing.unitCode}`}
                />
                <ToLetInfoTile
                  label="Listing Category"
                  value={humanize(listing.unit.unitType)}
                />
                <ToLetInfoTile
                  label="Floor Number"
                  value={formatFloor(listing.unit.floorNumber)}
                />
                <ToLetInfoTile
                  label="Unit Size"
                  value={`${listing.unit.sizeSqFt.toLocaleString("en-BD")} Sq.ft`}
                />
                {capabilities.bedrooms ? (
                  <ToLetInfoTile label="Bedrooms" value={listing.unit.bedrooms} />
                ) : null}
                {capabilities.bathrooms ? (
                  <ToLetInfoTile label="Bathrooms" value={listing.unit.bathrooms} />
                ) : null}
                {capabilities.balconies ? (
                  <ToLetInfoTile label="Balcony" value={listing.unit.balconies} />
                ) : null}
                {capabilities.kitchen ? (
                  <ToLetYesNoTile label="Kitchen" value={listing.unit.hasKitchen} />
                ) : null}
                {capabilities.drawingRoom ? (
                  <ToLetYesNoTile
                    label="Drawing Room"
                    value={listing.unit.hasDrawingRoom}
                  />
                ) : null}
                {capabilities.diningSpace ? (
                  <ToLetYesNoTile
                    label="Dining Space"
                    value={listing.unit.hasDiningSpace}
                  />
                ) : null}
                <div className="sm:col-span-2">
                  <ToLetOptionTile
                    label="Preferred Tenant"
                    options={tenantOptions}
                    value={listing.preferredTenant}
                  />
                </div>
              </div>

              <div className="mt-5">
                <p className="text-sm font-medium text-foreground">
                  Property Description
                </p>
                <p className="mt-1 min-h-20 whitespace-pre-line rounded-md border border-border bg-muted/30 px-3 py-2 text-sm leading-7 text-foreground">
                  {listing.description || "No description provided by the owner."}
                </p>
              </div>

              {listing.videoUrl ? (
                <div className="mt-5">
                  <a
                    href={listing.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={linkButtonClassName}
                  >
                    <Video className="size-4" aria-hidden="true" />
                    Watch unit video
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
              ) : null}
            </ToLetDetailsSection>

            <ToLetDetailsSection
              id="facilities"
              icon={ShieldCheck}
              title="Facilities"
              embedded
            >
              <p className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span>
                  &ldquo;Included&rdquo; means the facility/charge is included
                  in the monthly rent. &ldquo;Excluded&rdquo; means the
                  facility/charge is not included in the monthly rent and may be
                  charged separately.
                </span>
              </p>
              <div className="mt-5 max-w-xl space-y-5">
                {facilities.map((facility) => (
                  <ToLetFacilityRow
                    key={facility.label}
                    label={facility.label}
                    available={facility.available}
                    included={facility.included}
                  />
                ))}
              </div>
              <div className="mt-5">
                <p className="text-sm font-medium text-foreground">
                  Other Facilities
                </p>
                <p className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm leading-6 text-foreground">
                  {listing.otherFacilities || "No other facilities provided."}
                </p>
              </div>
            </ToLetDetailsSection>

            <ToLetDetailsSection
              id="rent-information"
              icon={WalletCards}
              title="Rent Information"
              embedded
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <ToLetRentItem label="Rent" value={money(listing.monthlyRent)} />
                <ToLetRentItem label="Advance" value={money(listing.advanceAmount)} />
                <ToLetRentItem
                  label="Security Deposit"
                  value={money(listing.securityDeposit)}
                />
                <ToLetRentItem
                  label="Service Charge"
                  value={money(listing.serviceCharge)}
                />
                <ToLetRentItem label="Parking" value={money(listing.parkingCharge)} />
                <ToLetRentItem
                  label="Utility Charge"
                  value={money(listing.utilityCharge)}
                />
                <ToLetInfoTile label="Contact Person" value={listing.contact.name} />
                <ToLetInfoTile label="Contact Number" value={listing.contact.phone} />
                <div className="sm:col-span-2">
                  <ToLetInfoTile
                    label="Available From"
                    value={availableFrom ?? listing.availableFrom}
                  />
                </div>
              </div>

              <div
                id="booking"
                className="mt-6 flex justify-end border-t border-border pt-5"
              >
                {isBooked ? (
                  <div className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 sm:w-auto">
                    Booked · Requests closed
                  </div>
                ) : (
                  <div className="w-full sm:w-64">
                    <RequestBookingButton
                      listingCode={listing.listingCode}
                      availableFrom={listing.availableFrom}
                      minimumDate={today}
                      {...(qrToken ? { qrToken } : {})}
                    />
                  </div>
                )}
              </div>
            </ToLetDetailsSection>
          </ToLetDetailsShell>
        </div>
      </main>
    </div>
  );
}
