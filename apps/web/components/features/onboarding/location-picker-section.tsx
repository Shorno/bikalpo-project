"use client";

import dynamic from "next/dynamic";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useBarikoiAutocomplete } from "@/hooks/use-barikoi-autocomplete";
import type { BarikoiPlace } from "@/hooks/use-barikoi-autocomplete";
import type { LocationData } from "@/constants/seller-registration";
import { RegistrationFieldLabel } from "./registration-primitives";

const LocationPickerMap = dynamic(
  () =>
    import("./location-picker-map").then((mod) => mod.LocationPickerMap),
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
  const { suggestions, isLoading, search, clearSuggestions } =
    useBarikoiAutocomplete();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState(data.address || "");
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

  const handleSelectPlace = (place: BarikoiPlace) => {
    setSearchQuery(place.address);
    onUpdate({
      ...data,
      address: place.address,
      addressBn: place.address_bn || "",
      area: place.area || "",
      latitude: place.latitude,
      longitude: place.longitude,
      postCode: String(place.postCode || ""),
    });
    clearSuggestions();
    setShowSuggestions(false);
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
      onUpdate({
        ...data,
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
        <RegistrationFieldLabel required={required} htmlFor="location-search">
          {label}
        </RegistrationFieldLabel>
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
          {isLoading && (
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
                  {place.address_bn && (
                    <p className="truncate text-xs text-muted-foreground">
                      {place.address_bn}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {place.area} • {place.city}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
              <span className="block text-xs text-muted-foreground">Address</span>
              <span className="font-medium text-foreground">{data.address}</span>
            </div>
            {data.area && (
              <div>
                <span className="block text-xs text-muted-foreground">Area</span>
                <span className="font-medium text-foreground">{data.area}</span>
              </div>
            )}
            {data.district && (
              <div>
                <span className="block text-xs text-muted-foreground">District</span>
                <span className="font-medium text-foreground">{data.district}</span>
              </div>
            )}
            {data.division && (
              <div>
                <span className="block text-xs text-muted-foreground">Division</span>
                <span className="font-medium text-foreground">{data.division}</span>
              </div>
            )}
            {data.postCode && (
              <div>
                <span className="block text-xs text-muted-foreground">Post code</span>
                <span className="font-medium text-foreground">{data.postCode}</span>
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
