"use client";

interface StepPlanSelectionProps {
  data: {
    selectedPlan: string;
  };
  onUpdate: (data: StepPlanSelectionProps["data"]) => void;
  onNext: () => void;
  onBack: () => void;
}

const PLANS = [
  {
    id: "free_trial",
    name: "Free Trial",
    price: "৳0",
    period: "14 days",
    description: "Try everything risk-free",
    badge: "Recommended",
    features: [
      "Up to 50 products",
      "Basic analytics",
      "B2B ordering",
      "Inventory management",
      "1 delivery man",
    ],
    highlighted: true,
  },
  {
    id: "starter",
    name: "Starter",
    price: "৳999",
    period: "per month",
    description: "For growing businesses",
    badge: null,
    features: [
      "Up to 200 products",
      "Advanced analytics",
      "B2B + B2C ordering",
      "Inventory tracking",
      "3 delivery men",
      "SMS notifications",
    ],
    highlighted: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "৳2,499",
    period: "per month",
    description: "For established sellers",
    badge: "Most Popular",
    features: [
      "Unlimited products",
      "Full analytics suite",
      "Open order system",
      "Auto-conversion engine",
      "Unlimited delivery men",
      "Priority support",
      "Custom reports",
    ],
    highlighted: false,
  },
];

export function StepPlanSelection({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepPlanSelectionProps) {
  // Default to free trial
  const selectedPlan = data.selectedPlan || "free_trial";

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#003178]/5 mb-4">
          <span
            className="material-symbols-outlined text-3xl text-[#003178]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            workspace_premium
          </span>
        </div>
        <h2
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          Choose Your Plan
        </h2>
        <p className="text-gray-500">
          Start with a free trial. No payment needed.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onUpdate({ selectedPlan: plan.id })}
            className={`
              relative p-5 rounded-xl border-2 text-left transition-all duration-200
              hover:shadow-lg group
              ${
                selectedPlan === plan.id
                  ? "border-[#003178] bg-white shadow-lg shadow-[#003178]/10"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }
            `}
          >
            {/* Badge */}
            {plan.badge && (
              <div
                className={`absolute -top-3 left-4 px-3 py-0.5 rounded-full text-xs font-bold
                  ${
                    plan.id === "free_trial"
                      ? "bg-green-500 text-white"
                      : "bg-[#003178] text-white"
                  }
                `}
              >
                {plan.badge}
              </div>
            )}

            {/* Selected indicator */}
            <div
              className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                ${
                  selectedPlan === plan.id
                    ? "border-[#003178] bg-[#003178]"
                    : "border-gray-300"
                }
              `}
            >
              {selectedPlan === plan.id && (
                <span className="material-symbols-outlined text-white text-xs">
                  check
                </span>
              )}
            </div>

            {/* Price */}
            <div className="mb-4 mt-2">
              <span
                className="text-3xl font-extrabold text-gray-900"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {plan.price}
              </span>
              <span className="text-sm text-gray-500 ml-1">
                / {plan.period}
              </span>
            </div>

            <h3 className="font-bold text-lg text-gray-900 mb-1">
              {plan.name}
            </h3>
            <p className="text-xs text-gray-500 mb-4">{plan.description}</p>

            {/* Features */}
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-2 text-sm text-gray-600"
                >
                  <span
                    className="material-symbols-outlined text-[#003178] text-base shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      {/* No payment note */}
      {selectedPlan === "free_trial" && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-2">
          <span className="material-symbols-outlined text-base">
            credit_card_off
          </span>
          No payment information required for the free trial
        </div>
      )}

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
          onClick={() => {
            if (!data.selectedPlan) {
              onUpdate({ selectedPlan: "free_trial" });
            }
            onNext();
          }}
          className="flex-1 py-3.5 rounded-lg text-white font-bold shadow-lg shadow-[#003178]/20 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
          }}
        >
          Review Application
          <span className="material-symbols-outlined text-lg">
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}
