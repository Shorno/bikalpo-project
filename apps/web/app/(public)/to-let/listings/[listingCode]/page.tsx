import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestBookingDialog } from "@/components/features/to-let/booking/request-booking-dialog";
import { getPublicToLetUnitListingByCode } from "@/lib/public-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "To-Let Listing",
  description: "View an available verified property unit.",
};

interface PublicListingPageProps {
  params: Promise<{ listingCode: string }>;
}

function tenantLabel(value: string) {
  return value === "any"
    ? "Any tenant"
    : `${value.charAt(0).toUpperCase()}${value.slice(1)} preferred`;
}

function money(value: number | null) {
  return value === null ? "Hidden by owner" : `BDT ${value.toLocaleString()}`;
}

function whatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `88${digits}` : digits;
}

export default async function PublicListingPage({
  params,
}: PublicListingPageProps) {
  const { listingCode } = await params;
  const listing = await getPublicToLetUnitListingByCode(listingCode, 0);

  if (!listing) {
    notFound();
  }

  const images = listing.imageUrls.filter((imageUrl) => imageUrl.trim());
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
    listing.hasInternet && "Internet available",
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <Link
          href="/to-let"
          className="mb-6 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to listings
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <main className="space-y-6 lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <div className="grid gap-1 bg-slate-100 sm:grid-cols-2">
                {images.length > 0 ? (
                  images.slice(0, 4).map((imageUrl, index) => (
                    <div
                      key={imageUrl}
                      className={
                        index === 0
                          ? "relative aspect-video sm:col-span-2"
                          : "relative aspect-video"
                      }
                    >
                      <Image
                        src={imageUrl}
                        alt={`${listing.title} ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 66vw"
                        unoptimized={imageUrl.startsWith("http")}
                      />
                    </div>
                  ))
                ) : (
                  <div className="flex aspect-video items-center justify-center text-sm text-slate-500 sm:col-span-2">
                    No photo available
                  </div>
                )}
              </div>

              <div className="p-6">
                <p className="text-sm font-medium text-blue-600">
                  {listing.listingCode}
                </p>
                <h1 className="mt-1 text-2xl font-bold text-gray-900">
                  {listing.title}
                </h1>
                <p className="mt-2 flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-4 w-4 shrink-0" /> {listing.location}
                </p>

                <div className="mt-5 flex flex-wrap gap-3 text-sm text-gray-700">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                    {tenantLabel(listing.preferredTenant)}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                    Available from {listing.availableFrom}
                  </span>
                </div>

                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Description
                  </h2>
                  <p className="mt-2 whitespace-pre-line text-gray-700">
                    {listing.description || "No description provided."}
                  </p>
                </section>

                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Unit details
                  </h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Detail
                      label="Unit"
                      value={listing.unit.name}
                      icon={Building2}
                    />
                    <Detail
                      label="Size"
                      value={`${listing.unit.sizeSqFt.toLocaleString()} sq ft`}
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
                  </div>
                </section>

                {facilities.length > 0 && (
                  <section className="mt-8">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Facilities
                    </h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {facilities.map((facility) => (
                        <p
                          key={facility}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                          {facility}
                        </p>
                      ))}
                    </div>
                  </section>
                )}

                {listing.otherFacilities && (
                  <section className="mt-8">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Other facilities
                    </h2>
                    <p className="mt-2 whitespace-pre-line text-gray-700">
                      {listing.otherFacilities}
                    </p>
                  </section>
                )}
              </div>
            </div>
          </main>

          <aside className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">Monthly rent</p>
              <p className="mt-1 text-3xl font-bold text-emerald-600">
                {money(listing.monthlyRent)}
              </p>
              <p className="text-sm text-gray-500">per month</p>

              <div className="mt-5 space-y-3 border-t border-gray-100 pt-4 text-sm text-gray-700">
                <p>
                  <span className="font-medium">Advance:</span>{" "}
                  {money(listing.advanceAmount)}
                </p>
                <p>
                  <span className="font-medium">Security deposit:</span>{" "}
                  {money(listing.securityDeposit)}
                </p>
                {charges.map((charge) => (
                  <p key={charge.label}>
                    <span className="font-medium">{charge.label}:</span>{" "}
                    {charge.included ? "Included" : money(charge.value)}
                  </p>
                ))}
              </div>
              <RequestBookingDialog
                listingCode={listing.listingCode}
                title={listing.title}
                availableFrom={listing.availableFrom}
              />
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900">Property contact</h2>
              <p className="mt-3 text-sm font-medium text-gray-900">
                {listing.contact.name}
              </p>
              <a
                href={`tel:${listing.contact.phone}`}
                className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Phone className="h-4 w-4" /> Call {listing.contact.phone}
              </a>
              <a
                href={`https://wa.me/${whatsAppPhone(listing.contact.phone)}?text=${encodeURIComponent(`I am interested in ${listing.listingCode}: ${listing.title}`)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
              <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <CalendarDays className="h-4 w-4" /> Available from{" "}
                {listing.availableFrom}
              </p>
            </div>
          </aside>
        </div>
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
  icon: typeof Building2;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <Icon className="h-4 w-4 text-blue-600" />
      <p className="mt-2 text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}
