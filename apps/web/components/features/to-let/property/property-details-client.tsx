"use client";

import {
  Building2,
  Check,
  Edit2,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import {
  useArchiveToLetProperty,
  useMyToLetProperty,
} from "@/hooks/use-to-let-property-api";
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
  const router = useRouter();
  const query = useMyToLetProperty(propertyCode);
  const archiveProperty = useArchiveToLetProperty();

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

  const deleteProperty = async () => {
    try {
      await archiveProperty.mutateAsync({ propertyCode });
      router.replace("/account/to-let/properties");
    } catch {
      // The mutation hook shows the API error.
    }
  };

  return (
    <div className="space-y-5">
      {created ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Property Registered Successfully</p>
              <p className="mt-0.5 text-sm text-emerald-700">
                Your permanent property account is ready. Add its physical units
                before publishing a To-Let listing.
              </p>
            </div>
          </div>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-emerald-200 bg-white/70 px-3 py-2">
              <dt className="text-xs text-emerald-700">Property ID</dt>
              <dd className="mt-0.5 font-semibold">{property.propertyCode}</dd>
            </div>
            <div className="rounded-md border border-emerald-200 bg-white/70 px-3 py-2">
              <dt className="text-xs text-emerald-700">Current Status</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-semibold">
                <Check className="size-4" /> Verified
              </dd>
            </div>
          </dl>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Next Step
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {units[0] ? (
                <Button
                  size="sm"
                  asChild
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Link
                    href={`/account/to-let/properties/${property.propertyCode}/units/${units[0].unitCode}/listing`}
                  >
                    Create To-Let Listing
                  </Link>
                </Button>
              ) : (
                <Button size="sm" disabled>
                  Create To-Let Listing · Add a unit first
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link
                  href={`/account/to-let/properties/${property.propertyCode}/edit`}
                >
                  <Edit2 /> Manage Property
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link
                  href={`/account/to-let/properties/${property.propertyCode}/units/new`}
                >
                  <Plus /> Add Property Units
                </Link>
              </Button>
            </div>
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
        title="My To-Let"
        description="Manage your property identity, physical units and rental listings."
        backHref="/account/to-let/properties"
        action={
          isBlocked ? (
            <Button disabled>Property Blocked</Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 /> Delete Property
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {property.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the property from My Properties, closes its
                    open listings, rejects pending booking requests, and removes
                    its vacant units. The permanent Property ID, QR, and history
                    stay preserved. A booked or occupied property cannot be
                    deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={archiveProperty.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={archiveProperty.isPending}
                    onClick={() => void deleteProperty()}
                  >
                    {archiveProperty.isPending ? (
                      <>
                        <Loader2 className="animate-spin" /> Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 /> Delete Property
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        }
      />

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="relative min-h-72 bg-gray-100 lg:min-h-full">
            <Image
              src={imageUrl}
              alt={`${property.name} property`}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 46vw"
              unoptimized={imageUrl.startsWith("http")}
            />
            <div className="absolute right-4 top-4">
              <PropertyStatusBadge status={property.status} />
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Building2 className="size-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Property Information
                </p>
                <h2 className="mt-1 text-xl font-semibold text-gray-900">
                  {property.name}
                </h2>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-500">
                  <MapPin className="mt-0.5 size-4 shrink-0" />
                  {property.fullAddress}, {property.area}, {property.district}
                </p>
              </div>
            </div>

            <dl className="mt-4">
              <InfoRow label="Property Name" value={property.name} />
              <InfoRow label="Property ID" value={property.propertyCode} />
              <InfoRow
                label="Property Type"
                value={humanize(property.propertyType)}
              />
              <InfoRow label="Owner Name" value={property.ownerName} />
              <InfoRow label="Mobile" value={property.mobileNumber} />
              <InfoRow label="Email" value={property.email || "Not provided"} />
              <InfoRow
                label="Location"
                value={`${property.area}, ${property.district}`}
              />
              <InfoRow label="Total Floors" value={property.totalFloors} />
              <InfoRow
                label="Total Units"
                value={property.declaredTotalUnits}
              />
              <InfoRow
                label="Property Status"
                value={
                  property.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <ShieldCheck className="size-4" />
                      Verified
                    </span>
                  ) : (
                    <PropertyStatusBadge status={property.status} />
                  )
                }
              />
            </dl>

            {!isBlocked ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-5">
                <Button variant="outline" asChild>
                  <Link
                    href={`/account/to-let/properties/${property.propertyCode}/edit`}
                  >
                    <Edit2 /> Edit Property
                  </Link>
                </Button>
                {units.length === 0 ? (
                  atCapacity ? (
                    <Button disabled>Unit Capacity Reached</Button>
                  ) : (
                    <Button
                      asChild
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Link
                        href={`/account/to-let/properties/${property.propertyCode}/units/new`}
                      >
                        <Plus /> Create Unit
                      </Link>
                    </Button>
                  )
                ) : (
                  <Button
                    asChild
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <a href="#property-units">
                      <Building2 /> Manage Units
                    </a>
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section id="property-units" className="scroll-mt-24 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My Property</h2>
            <p className="text-sm text-gray-500">
              Manage every Unit and its current To-Let Listing.
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
                <Plus /> {units.length === 0 ? "Create Unit" : "Create Units"}
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
                qrToken={property.qrToken}
                unit={unit}
                location={`${property.area}, ${property.district}`}
                propertyVideoUrl={property.videoUrl}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
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

        <div className="lg:sticky lg:top-24 lg:self-start">
          <PropertyQrCard
            propertyCode={property.propertyCode}
            qrToken={property.qrToken}
            propertyName={property.name}
            location={`${property.area}, ${property.district}`}
          />
        </div>
      </div>
    </div>
  );
}
