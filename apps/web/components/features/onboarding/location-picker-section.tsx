"use client";

import { Check, Crosshair, Loader2, MapPin, Search } from "lucide-react";
import dynamic from "next/dynamic";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LocationData } from "@/constants/seller-registration";

import type { BarikoiPlace } from "@/hooks/use-barikoi-autocomplete";
import { useBarikoiAutocomplete } from "@/hooks/use-barikoi-autocomplete";
import { useBarikoiReverseGeocode } from "@/hooks/use-barikoi-reverse-geocode";

import { RegistrationFieldLabel } from "./registration-primitives";

const LocationPickerMap = dynamic(
  () => import("./location-picker-map").then((mod) => mod.LocationPickerMap),

  {
    ssr: false,

    loading: () => (
      <div className="flex h-[300px] w-full items-center justify-center rounded-lg border border-border bg-muted/30">
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    ),
  },
);

interface LocationPickerSectionProps {
  label: string;

  description?: string;

  data: LocationData;

  onUpdate: (data: LocationData) => void;

  required?: boolean;
}

export function LocationPickerSection({
  label,

  description,

  data,

  onUpdate,

  required = true,
}: LocationPickerSectionProps) {
  const {
    suggestions,
    isLoading: isSearchLoading,
    search,
    clearSuggestions,
  } = useBarikoiAutocomplete();
  const { reverseGeocode, isLoading: isResolving } = useBarikoiReverseGeocode();

  const [showSuggestions, setShowSuggestions] = useState(false);

  const [searchQuery, setSearchQuery] = useState(data.address || "");

  const [isLocating, setIsLocating] = useState(false);

  const [locationError, setLocationError] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchQuery(data.address || "");
  }, [data.address]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    search(value);

    setShowSuggestions(true);
  };

  const handleSelectPlace = async (place: BarikoiPlace) => {
    setLocationError("");
    clearSuggestions();
    setShowSuggestions(false);
    const resolved = await reverseGeocode(place.latitude, place.longitude);
    const address = resolved?.address || place.address;

    setSearchQuery(address);

    onUpdate({
      ...data,

      address,

      addressBn: "",

      area: resolved?.area || place.area || "",

      district: resolved?.district || "",

      division: resolved?.division || "",

      latitude: place.latitude,

      longitude: place.longitude,

      postCode: resolved?.postCode || String(place.postCode || ""),
    });
  };

  const handleUseCurrentLocation = () => {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Current location is not supported by this browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const { latitude, longitude } = coords;
        const isInBangladesh =
          latitude >= 20.5 &&
          latitude <= 26.7 &&
          longitude >= 87.9 &&
          longitude <= 92.7;

        if (!isInBangladesh) {
          setLocationError(
            "Your current location appears to be outside Bangladesh. Search for the business address or adjust the pin instead.",
          );
          setIsLocating(false);
          return;
        }

        const resolved = await reverseGeocode(latitude, longitude);
        if (!resolved) {
          setLocationError(
            "We found your coordinates but could not resolve the address. Try again or adjust the pin.",
          );
          setIsLocating(false);
          return;
        }

        setSearchQuery(resolved.address || "");
        onUpdate({
          ...data,
          address: resolved.address || "",
          addressBn: "",
          area: resolved.area || "",
          district: resolved.district || "",
          division: resolved.division || "",
          postCode: resolved.postCode || "",
          latitude,
          longitude,
        });
        setIsLocating(false);
      },
      () => {
        setLocationError(
          "We could not access your current location. Allow location access or search for the business address.",
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleMapPositionChange = (
    lat: number,

    lng: number,

    addressInfo?: {
      address: string;

      addressBn: string;

      area: string;

      district: string;

      division: string;

      postCode: string;
    },
  ) => {
    if (addressInfo) {
      setLocationError("");
      setSearchQuery(addressInfo.address);

      onUpdate({
        ...data,

        latitude: lat,

        longitude: lng,

        address: addressInfo.address,

        addressBn: addressInfo.addressBn,

        area: addressInfo.area,

        district: addressInfo.district,

        division: addressInfo.division,

        postCode: addressInfo.postCode,
      });
    } else {
      setLocationError(
        "The pin moved, but Barikoi could not resolve the address. Try again before saving.",
      );
      onUpdate({
        ...data,
        address: "",
        addressBn: "",
        area: "",
        district: "",
        division: "",
        postCode: "",
        latitude: lat,
        longitude: lng,
      });
    }
  };

  return (
    <div className="space-y-4">
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}

      <div ref={dropdownRef} className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RegistrationFieldLabel required={required} htmlFor="location-search">
            {label}
          </RegistrationFieldLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUseCurrentLocation}
            disabled={isLocating || isResolving}
          >
            {isLocating ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Crosshair className="size-3.5" aria-hidden="true" />
            )}
            {isLocating ? "Locating…" : "Use current location"}
          </Button>
        </div>

        <div className="relative mt-1.5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            id="location-search"
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search for address..."
            className="h-9 pl-9"
          />

          {(isSearchLoading || isResolving) && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover">
            {suggestions.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => handleSelectPlace(place)}
                className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {place.address}
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {place.area} • {place.city}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {locationError && (
        <p className="text-sm text-destructive" role="alert">
          {locationError}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-border">
        <LocationPickerMap
          latitude={data.latitude || 23.8103}
          longitude={data.longitude || 90.4125}
          onPositionChange={handleMapPositionChange}
        />
      </div>

      {data.address && (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Check className="h-4 w-4 text-primary" />
            Location selected
          </p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <span className="block text-xs text-muted-foreground">
                Address
              </span>

              <span className="font-medium text-foreground">
                {data.address}
              </span>
            </div>

            {data.area && (
              <div>
                <span className="block text-xs text-muted-foreground">
                  Area
                </span>

                <span className="font-medium text-foreground">{data.area}</span>
              </div>
            )}

            {data.district && (
              <div>
                <span className="block text-xs text-muted-foreground">
                  District
                </span>

                <span className="font-medium text-foreground">
                  {data.district}
                </span>
              </div>
            )}

            {data.division && (
              <div>
                <span className="block text-xs text-muted-foreground">
                  Division
                </span>

                <span className="font-medium text-foreground">
                  {data.division}
                </span>
              </div>
            )}

            {data.postCode && (
              <div>
                <span className="block text-xs text-muted-foreground">
                  Post code
                </span>

                <span className="font-medium text-foreground">
                  {data.postCode}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function isLocationComplete(location: LocationData): boolean {
  return Boolean(location.address && location.latitude && location.longitude);
}
