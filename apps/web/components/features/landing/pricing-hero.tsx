"use client";

export function PricingHero() {
  return null; // Toggle state is managed by parent — this is just the hero text
}

type PricingHeroSectionProps = {
  billingPeriod: "monthly" | "yearly";
  onToggle: (period: "monthly" | "yearly") => void;
};

export function PricingHeroSection({
  billingPeriod,
  onToggle,
}: PricingHeroSectionProps) {
  return (
    <header className="pt-24 pb-16 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl">
          <h1
            className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Bikalpo Pricing for Businesses
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed mb-8">
            Choose a plan that fits your business needs. Scale your inventory,
            manage multiple warehouses, and streamline operations with our
            architectural approach to commerce.
          </p>

          {/* Toggle */}
          <div className="flex items-center gap-4 bg-[#f3f4f5] p-1.5 rounded-xl w-fit">
            <button
              className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
                billingPeriod === "monthly"
                  ? "bg-white text-[#003178] shadow-sm"
                  : "text-gray-500 hover:bg-[#e7e8e9]"
              }`}
              onClick={() => onToggle("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-6 py-2 rounded-lg font-medium text-sm transition-all ${
                billingPeriod === "yearly"
                  ? "bg-white text-[#003178] shadow-sm"
                  : "text-gray-500 hover:bg-[#e7e8e9]"
              }`}
              onClick={() => onToggle("yearly")}
            >
              Yearly
            </button>
            <span className="text-xs font-bold text-[#1b6d24] bg-[#a0f399]/30 px-2 py-1 rounded-full ml-2">
              Save 20%
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
