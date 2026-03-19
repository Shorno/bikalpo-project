"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StepBusinessProfileProps {
  data: {
    businessType: string;
    shopName: string;
    businessCategory: string;
    yearsInBusiness: string;
    monthlyRevenue: string;
  };
  onUpdate: (data: StepBusinessProfileProps["data"]) => void;
  onNext: () => void;
  onBack: () => void;
}

const BUSINESS_TYPES = [
  {
    id: "retail",
    label: "Retail Shop",
    description: "Sell products directly to consumers",
    icon: "storefront",
  },
  {
    id: "restaurant",
    label: "Restaurant",
    description: "Food service & wholesale purchasing",
    icon: "restaurant",
  },
  {
    id: "warehouse",
    label: "Warehouse",
    description: "Bulk storage & distribution",
    icon: "warehouse",
  },
];

const BUSINESS_CATEGORIES = [
  "Grocery & FMCG",
  "Electronics",
  "Fashion & Clothing",
  "Pharmacy & Health",
  "Hardware & Tools",
  "Stationery & Books",
  "Food & Beverage",
  "Cosmetics & Beauty",
  "Mobile & Accessories",
  "Other",
];

export function StepBusinessProfile({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepBusinessProfileProps) {
  const canProceed = data.businessType && data.shopName && data.businessCategory;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#003178]/5 mb-4">
          <span
            className="material-symbols-outlined text-3xl text-[#003178]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            business_center
          </span>
        </div>
        <h2
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Tell Us About Your Business
        </h2>
        <p className="text-gray-500">
          Select your business type to personalize your experience
        </p>
      </div>

      {/* Business Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {BUSINESS_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => onUpdate({ ...data, businessType: type.id })}
            className={`
              relative p-5 rounded-xl border-2 text-left transition-all duration-200
              hover:shadow-md group
              ${
                data.businessType === type.id
                  ? "border-[#003178] bg-[#003178]/5 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }
            `}
          >
            {/* Selected indicator */}
            {data.businessType === type.id && (
              <div className="absolute top-3 right-3">
                <span
                  className="material-symbols-outlined text-[#003178] text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
              </div>
            )}

            <span
              className={`
                material-symbols-outlined text-3xl mb-3 block
                transition-colors duration-200
                ${
                  data.businessType === type.id
                    ? "text-[#003178]"
                    : "text-gray-400 group-hover:text-gray-600"
                }
              `}
              style={{
                fontVariationSettings:
                  data.businessType === type.id ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {type.icon}
            </span>
            <h3
              className={`font-bold text-sm mb-1 ${
                data.businessType === type.id
                  ? "text-[#003178]"
                  : "text-gray-900"
              }`}
            >
              {type.label}
            </h3>
            <p className="text-xs text-gray-500">{type.description}</p>
          </button>
        ))}
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Business Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Business Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.shopName}
            onChange={(e) => onUpdate({ ...data, shopName: e.target.value })}
            placeholder="Enter your business name"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178] transition-all"
          />
        </div>

        {/* Business Category */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Business Category <span className="text-red-500">*</span>
          </label>
          <Select
            value={data.businessCategory}
            onValueChange={(value) =>
              onUpdate({ ...data, businessCategory: value })
            }
          >
            <SelectTrigger className="w-full px-4 py-3 h-auto border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#003178]/20 focus:border-[#003178] transition-all">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Optional: Years in Business + Revenue */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Years in Business{" "}
              <span className="text-xs text-gray-400 font-normal">
                (Optional)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {["New", "1-3 years", "3+ years"].map((option) => (
                <button
                  key={option}
                  onClick={() =>
                    onUpdate({ ...data, yearsInBusiness: option })
                  }
                  className={`
                    px-3 py-2 rounded-lg text-xs font-medium border transition-all
                    ${
                      data.yearsInBusiness === option
                        ? "border-[#003178] bg-[#003178]/5 text-[#003178]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }
                  `}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Monthly Revenue{" "}
              <span className="text-xs text-gray-400 font-normal">
                (Optional)
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {["< ৳50K", "৳50K-2L", "৳2L+"].map((option) => (
                <button
                  key={option}
                  onClick={() =>
                    onUpdate({ ...data, monthlyRevenue: option })
                  }
                  className={`
                    px-3 py-2 rounded-lg text-xs font-medium border transition-all
                    ${
                      data.monthlyRevenue === option
                        ? "border-[#003178] bg-[#003178]/5 text-[#003178]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }
                  `}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
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
