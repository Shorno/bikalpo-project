"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
import { useBarikoiAutocomplete } from "@/hooks/use-barikoi-autocomplete";
import type { BarikoiPlace } from "@/hooks/use-barikoi-autocomplete";

// Dynamically import the map component to avoid SSR issues with Leaflet
const LocationPickerMap = dynamic(
  () =>
    import("./location-picker-map").then((mod) => mod.LocationPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[300px] bg-gray-100 rounded-xl flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading map...</span>
      </div>
    ),
  }
);

interface StepShopSetupProps {
  data: {
    address: string;
    addressBn: string;
    division: string;
    district: string;
    area: string;
    postCode: string;
    latitude: number;
    longitude: number;
    shopContactNumber: string;
  };
  onUpdate: (data: StepShopSetupProps["data"]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepShopSetup({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepShopSetupProps) {
  const { suggestions, isLoading, search, clearSuggestions } =
    useBarikoiAutocomplete();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState(data.address || "");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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

  const handleMapPositionChange = (lat: number, lng: number, addressInfo?: {
    address: string;
    addressBn: string;
    area: string;
    district: string;
    division: string;
    postCode: string;
  }) => {
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

  const canProceed = data.address && data.latitude && data.longitude;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#003178]/5 mb-4">
          <span
            className="material-symbols-outlined text-3xl text-[#003178]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            location_on
          </span>
        </div>
        <h2
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Shop Location
        </h2>
        <p className="text-gray-500">
          Search your address or drop a pin on the map
        </p>
      </div>

      <div className="space-y-5">
        {/* Address Search with Autocomplete */}
        <div ref={dropdownRef} className="relative">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Shop Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search for your shop address..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178] transition-all"
            />
            {isLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-[#003178] rounded-full animate-spin" />
            )}
          </div>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
              {suggestions.map((place) => (
                <button
                  key={place.id}
                  onClick={() => handleSelectPlace(place)}
                  className="w-full px-4 py-3 text-left hover:bg-[#003178]/5 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                >
                  <span className="material-symbols-outlined text-[#003178] text-lg mt-0.5 shrink-0">
                    location_on
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {place.address}
                    </p>
                    {place.address_bn && (
                      <p className="text-xs text-gray-500 truncate">
                        {place.address_bn}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {place.area} • {place.city}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Map */}
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <LocationPickerMap
            latitude={data.latitude || 23.8103}
            longitude={data.longitude || 90.4125}
            onPositionChange={handleMapPositionChange}
          />
        </div>

        {/* Address Details (auto-populated) */}
        {data.address && (
          <div className="bg-[#003178]/5 rounded-xl p-4 space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="material-symbols-outlined text-[#003178] text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <span className="text-sm font-semibold text-[#003178]">
                Location Selected
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs block">Address</span>
                <span className="font-medium text-gray-900">
                  {data.address}
                </span>
              </div>
              {data.area && (
                <div>
                  <span className="text-gray-500 text-xs block">Area</span>
                  <span className="font-medium text-gray-900">
                    {data.area}
                  </span>
                </div>
              )}
              {data.district && (
                <div>
                  <span className="text-gray-500 text-xs block">District</span>
                  <span className="font-medium text-gray-900">
                    {data.district}
                  </span>
                </div>
              )}
              {data.postCode && (
                <div>
                  <span className="text-gray-500 text-xs block">
                    Post Code
                  </span>
                  <span className="font-medium text-gray-900">
                    {data.postCode}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shop Contact Number */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Shop Contact Number{" "}
            <span className="text-xs text-gray-400 font-normal">
              (Optional — if different from your phone)
            </span>
          </label>
          <input
            type="tel"
            value={data.shopContactNumber}
            onChange={(e) =>
              onUpdate({
                ...data,
                shopContactNumber: e.target.value.replace(/\D/g, ""),
              })
            }
            placeholder="01XXXXXXXXX"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178] transition-all"
          />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="px-6 py-3.5 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 py-3.5 rounded-lg text-white font-bold shadow-lg shadow-[#003178]/20 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
          }}
        >
          Continue
          <span className="material-symbols-outlined text-lg">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
