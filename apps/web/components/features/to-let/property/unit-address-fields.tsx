"use client";

import type { UnitAddress } from "@bikalpo-project/api/lib/tolet-unit-address";
import { Loader2, LocateFixed } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  normalizeBangladeshDistrict,
  normalizeBangladeshDivision,
} from "@/constants/bangladesh-locations";
import { client } from "@/utils/orpc";
import { PropertyLocationFields } from "./property-location-fields";
import type { ToLetPropertyView } from "./types";

const emptyAddress: UnitAddress = {
  division: "",
  district: "",
  upazila: "",
  area: "",
  fullAddress: "",
  nearbyLandmark: "",
  latitude: null,
  longitude: null,
};

export function UnitAddressFields({
  property,
  value,
  onChange,
  errors,
}: {
  property: ToLetPropertyView;
  value: UnitAddress | null;
  onChange: (value: UnitAddress | null) => void;
  errors: Record<string, string>;
}) {
  const [draft, setDraft] = useState<UnitAddress>(value ?? emptyAddress);
  const [capturing, setCapturing] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const address = value ?? draft;
  const setLocation = (
    field: "division" | "district" | "upazila" | "area",
    next: string,
  ) => {
    // The shared picker emits separate child resets; apply them atomically here.
    if (!next) return;
    const updated = { ...address, [field]: next };
    if (field === "division") {
      updated.district = "";
      updated.upazila = "";
      updated.area = "";
    }
    if (field === "district") {
      updated.upazila = "";
      updated.area = "";
    }
    if (field === "upazila") updated.area = "";
    updated.latitude = null;
    updated.longitude = null;
    setDraft(updated);
    onChange(updated);
  };
  const errorFor = (key: string) => errors[`addressOverride.${key}`];
  const captureGps = () => {
    if (!navigator.geolocation) {
      setGpsError("Location capture is not supported on this device.");
      return;
    }
    setCapturing(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        if (
          latitude < 20.5 ||
          latitude > 26.7 ||
          longitude < 87.9 ||
          longitude > 92.7
        ) {
          setCapturing(false);
          setGpsError("The captured location is outside Bangladesh");
          return;
        }
        let updated = {
          ...address,
          latitude: latitude.toFixed(7),
          longitude: longitude.toFixed(7),
        };
        try {
          const location = await client.barikoi.reverseGeocode({
            latitude,
            longitude,
          });
          const division =
            normalizeBangladeshDivision(location?.division ?? "") ||
            address.division;
          const district =
            normalizeBangladeshDistrict(location?.district ?? "", division) ||
            (division === address.division ? address.district : "");
          const parentChanged =
            division !== address.division || district !== address.district;
          const upazila =
            location?.thana ||
            location?.sub_district ||
            (parentChanged ? "" : address.upazila);
          updated = {
            ...updated,
            division,
            district,
            upazila,
            area:
              location?.area ||
              (parentChanged || upazila !== address.upazila
                ? ""
                : address.area),
            fullAddress: address.fullAddress || location?.address || "",
          };
        } catch {
          // Keep captured coordinates if address lookup is unavailable, as registration does.
        }
        setDraft(updated);
        onChange(updated);
        setCapturing(false);
      },
      () => {
        setCapturing(false);
        setGpsError(
          "Could not capture location. Allow location access and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  return (
    <fieldset
      disabled={capturing}
      className="rounded-lg border border-gray-200 bg-white p-5 sm:p-6"
    >
      <h2 className="font-semibold text-gray-900">Unit address</h2>
      <fieldset className="mt-4 space-y-3">
        <legend className="sr-only">Choose which address this unit uses</legend>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="unit-address-source"
            checked={value === null}
            onChange={() => onChange(null)}
            className="size-4 accent-primary"
          />
          Use property registration address
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="unit-address-source"
            checked={value !== null}
            onChange={() => onChange(draft)}
            className="size-4 accent-primary"
          />
          Use a different address for this unit
        </label>
      </fieldset>
      {value === null ? (
        <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm">
          <p className="font-medium">{property.fullAddress}</p>
          <p className="mt-1 text-muted-foreground">
            {[
              property.area,
              property.upazila,
              property.district,
              property.division,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="mt-2 text-muted-foreground">
            This unit will use the property's address, including future address
            updates.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 sm:col-span-2">
            <PropertyLocationFields
              {...address}
              errors={{
                division: errorFor("division"),
                district: errorFor("district"),
                upazila: errorFor("upazila"),
                area: errorFor("area"),
              }}
              onChange={setLocation}
            />
          </div>
          {(
            [
              ["fullAddress", "Address", true],
              ["nearbyLandmark", "Nearby Landmark", false],
            ] as const
          ).map(([field, label, required]) => (
            <div
              key={field}
              className={
                field === "nearbyLandmark"
                  ? "order-3 space-y-1.5 sm:col-span-2"
                  : "space-y-1.5"
              }
            >
              <Label htmlFor={`unit-${field}`}>
                {label}
                {required ? " *" : ""}
              </Label>
              <Input
                id={`unit-${field}`}
                value={address[field]}
                placeholder={
                  field === "fullAddress"
                    ? "Enter Full Unit Address"
                    : "Example: Near Metro Station"
                }
                maxLength={field === "fullAddress" ? 1000 : 300}
                aria-invalid={Boolean(errorFor(field))}
                onChange={(event) => {
                  const updated = { ...address, [field]: event.target.value };
                  if (field === "fullAddress") {
                    updated.latitude = null;
                    updated.longitude = null;
                  }
                  setDraft(updated);
                  onChange(updated);
                }}
              />
              {errorFor(field) && (
                <p role="alert" className="text-xs text-red-600">
                  {errorFor(field)}
                </p>
              )}
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="unit-capture-gps">Google Map Location *</Label>
            <Button
              id="unit-capture-gps"
              type="button"
              variant="outline"
              disabled={capturing}
              onClick={captureGps}
              className="h-10 w-full justify-start font-normal"
            >
              {capturing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LocateFixed className="size-4" />
              )}
              Capture GPS Location
            </Button>
            <p className="text-xs text-muted-foreground">
              Capture only when you are at this unit's location.
            </p>
            {address.latitude && address.longitude && (
              <p className="text-xs font-medium text-emerald-700">
                GPS location captured
              </p>
            )}
            {(gpsError || errorFor("latitude")) && (
              <p role="alert" className="text-xs text-red-600">
                {gpsError || errorFor("latitude")}
              </p>
            )}
          </div>
        </div>
      )}
      {errors.addressOverride && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {errors.addressOverride}
        </p>
      )}
    </fieldset>
  );
}
