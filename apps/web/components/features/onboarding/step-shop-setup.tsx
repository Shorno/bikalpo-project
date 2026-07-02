"use client";

import { LocationPickerSection, isLocationComplete } from "./location-picker-section";

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
  const locationData = {
    address: data.address,
    addressBn: data.addressBn,
    division: data.division,
    district: data.district,
    area: data.area,
    postCode: data.postCode,
    latitude: data.latitude,
    longitude: data.longitude,
  };

  const canProceed = isLocationComplete(locationData);

  return (
    <div className="w-full max-w-2xl mx-auto">
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
        <LocationPickerSection
          label="Shop Address"
          description="Search your address or drop a pin on the map"
          data={locationData}
          onUpdate={(loc) => onUpdate({ ...data, ...loc })}
        />

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

      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="px-6 py-3.5 rounded-lg border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
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
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
