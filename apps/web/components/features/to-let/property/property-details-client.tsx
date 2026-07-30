"use client";

import {
  Building2,
  Check,
  Edit2,
  ExternalLink,
  MapPin,
  Plus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useMyToLetProperty } from "@/hooks/use-to-let-property-api";
import { PropertyQrCard } from "./property-qr-card";
import {
  PropertyDetailsSkeleton,
  PropertyErrorState,
  PropertyPageHeader,
  PropertyStatusBadge,
} from "./property-ui";
import { humanize, type ToLetPropertyView, type ToLetUnitView } from "./types";
import { UnitCard } from "./unit-card";

export function propertyFromResponse(data: unknown): ToLetPropertyView | null {
  if (!data || typeof data !== "object") return null;
  if ("property" in data) {
    const property = (data as { property?: unknown }).property;
    return property && typeof property === "object"
      ? (property as ToLetPropertyView)
      : null;
  }
  return data as ToLetPropertyView;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-gray-100 py-3 text-sm last:border-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

const facilityLabels: Array<[keyof ToLetPropertyView, string]> = [
  ["hasParking", "Parking"],
  ["hasLift", "Lift"],
  ["hasSecurityGuard", "Security guard"],
  ["hasCctv", "CCTV"],
  ["hasGenerator", "Generator"],
  ["hasWaterSupply", "Water supply"],
  ["hasGasConnection", "Gas connection"],
  ["hasElectricity", "Electricity"],
];

export function PropertyDetailsClient({
  propertyCode,
  created = false,
}: {
  propertyCode: string;
  created?: boolean;
}) {
  const query = useMyToLetProperty(propertyCode);

  if (query.isLoading) return <PropertyDetailsSkeleton />;
  if (query.isError) {
    return (
      <PropertyErrorState
        message="This property could not be found in your account."
        onRetry={() => query.refetch()}
      />
    );
  }

  const property = propertyFromResponse(query.data);
  if (!property) {
    return (
      <PropertyErrorState message="This property could not be found in your account." />
    );
  }

  const units = (property.units ?? []) as ToLetUnitView[];
  const unitCount = property.unitCount ?? units.length;
  const atCapacity = unitCount >= property.declaredTotalUnits;
  const isBlocked = property.status === "blocked";
  const imageUrl = property.coverImageUrl || "/placeholder-image.svg";

  return (
    <div className="space-y-5">
      {created ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="size-4" />
          </span>
          <div>
            <p className="font-semibold">Property registered successfully</p>
            <p className="mt-0.5 text-sm text-emerald-700">
              Permanent Property ID {property.propertyCode} is now active. You
              can create its physical units below.
            </p>
          </div>
        </div>
      ) : null}

      {isBlocked ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This property is blocked. Its identity and history are preserved, but
          property and unit changes are disabled.
        </div>
      ) : null}

      <PropertyPageHeader
        title={property.name}
        description={property.propertyCode}
        backHref="/account/to-let/properties"
        action={
          isBlocked ? (
            <Button disabled>Property Blocked</Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link
                  href={`/account/to-let/properties/${property.propertyCode}/edit`}
                >
                  <Edit2 /> Edit Property
                </Link>
              </Button>
              {atCapacity ? (
                <Button disabled>Unit Capacity Reached</Button>
              ) : (
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                  <Link
                    href={`/account/to-let/properties/${property.propertyCode}/units/new`}
                  >
                    <Plus /> Create Unit
                  </Link>
                </Button>
              )}
            </div>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="relative aspect-[16/7] bg-gray-100">
              <Image
                src={imageUrl}
                alt={`${property.name} property`}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 66vw"
                unoptimized={imageUrl.startsWith("http")}
              />
              <div className="absolute right-4 top-4">
                <PropertyStatusBadge status={property.status} />
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <Building2 className="size-5" />
                </span>
                <div>
                  <h2 className="font-semibold text-gray-900">
                    Property information
                  </h2>
                  <p className="mt-0.5 flex items-start gap-1.5 text-sm text-gray-500">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {property.fullAddress}, {property.area}, {property.district}
                  </p>
                </div>
              </div>

              <dl className="mt-4">
                <InfoRow label="Property ID" value={property.propertyCode} />
                <InfoRow
                  label="Property Type"
                  value={humanize(property.propertyType)}
                />
                <InfoRow label="Owner" value={property.ownerName} />
                <InfoRow label="Mobile" value={property.mobileNumber} />
                {property.email ? (
                  <InfoRow label="Email" value={property.email} />
                ) : null}
                <InfoRow
                  label="Building Type"
                  value={humanize(property.buildingType)}
                />
                <InfoRow label="Total Floors" value={property.totalFloors} />
                <InfoRow
                  label="Units"
                  value={`${unitCount} of ${property.declaredTotalUnits} created`}
                />
                {property.nearbyLandmark ? (
                  <InfoRow
                    label="Nearby Landmark"
                    value={property.nearbyLandmark}
                  />
                ) : null}
              </dl>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">Facilities</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facilityLabels.map(([key, label]) => {
                const available = Boolean(property[key]);
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      available
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-400"
                    }`}
                  >
                    <Check className="size-3.5" /> {label}
                  </div>
                );
              })}
            </div>
            {property.description ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {property.description}
              </p>
            ) : null}
            {property.videoUrl ? (
              <a
                href={property.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
              >
                View building video <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </section>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <PropertyQrCard
            propertyCode={property.propertyCode}
            qrToken={property.qrToken}
          />
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Property Units
            </h2>
            <p className="text-sm text-gray-500">
              Reusable physical spaces for future To-Let listings.
            </p>
          </div>
          {isBlocked ? (
            <Button variant="outline" disabled>
              Property Blocked
            </Button>
          ) : atCapacity ? (
            <Button variant="outline" disabled>
              Unit Capacity Reached
            </Button>
          ) : (
            <Button variant="outline" asChild>
              <Link
                href={`/account/to-let/properties/${property.propertyCode}/units/new`}
              >
                <Plus />{" "}
                {units.length === 0 ? "Create First Unit" : "Create Unit"}
              </Link>
            </Button>
          )}
        </div>

        {units.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
            <Building2 className="mx-auto size-10 text-gray-300" />
            <h3 className="mt-3 font-semibold text-gray-900">
              No units created yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Add the first physical unit for this property.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {units.map((unit) => (
              <UnitCard
                key={unit.unitCode}
                propertyCode={property.propertyCode}
                unit={unit}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
