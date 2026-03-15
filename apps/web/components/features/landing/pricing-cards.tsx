import type { LandingPricingPlan } from "@bikalpo-project/db/schema";

type PricingCardsProps = {
    plans: LandingPricingPlan[];
    billingPeriod: "monthly" | "yearly";
};

const fallbackPlans = [
    {
        name: "Basic",
        priceMonthly: 599,
        priceYearly: 5999,
        features: [
            "Up to 2 Stores",
            "1 Central Warehouse",
            "1,000 Products",
        ],
        disabledFeatures: ["Enterprise Inventory"],
        isPopular: false,
        ctaText: "Get Started",
    },
    {
        name: "Standard",
        priceMonthly: 1199,
        priceYearly: 11999,
        features: [
            "Up to 10 Stores",
            "5 Regional Warehouses",
            "10,000 Products",
            "Standard Inventory Tools",
        ],
        disabledFeatures: [],
        isPopular: true,
        ctaText: "Choose Standard",
    },
    {
        name: "Premium",
        priceMonthly: 2399,
        priceYearly: 23999,
        features: [
            "Unlimited Stores",
            "Unlimited Warehouses",
            "Unlimited Products",
            "Enterprise Inventory",
        ],
        disabledFeatures: [],
        isPopular: false,
        ctaText: "Go Premium",
    },
];

export function PricingCards({ plans, billingPeriod }: PricingCardsProps) {
    const hasDynamicPlans = plans.length > 0;

    if (hasDynamicPlans) {
        return (
            <section className="px-6 pb-24">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                    {plans.map((plan) => {
                        const features = (plan.features as string[]) || [];
                        const price =
                            billingPeriod === "yearly" && plan.priceYearly
                                ? plan.priceYearly
                                : plan.priceMonthly;
                        const suffix =
                            billingPeriod === "yearly" ? "/yr" : "/mo";

                        return (
                            <div
                                key={plan.id}
                                className={`bg-white p-10 rounded-xl flex flex-col transition-all duration-300 ${
                                    plan.isPopular
                                        ? "border-2 border-[#003178] ring-4 ring-[#003178]/5 relative md:-translate-y-4 shadow-xl"
                                        : "border border-gray-200/10 hover:border-gray-300/40"
                                }`}
                            >
                                {plan.isPopular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#003178] text-white px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                                        Most Popular
                                    </div>
                                )}
                                <div className="mb-8">
                                    <h3
                                        className="text-xl font-bold mb-2"
                                        style={{
                                            fontFamily:
                                                "'Manrope', sans-serif",
                                        }}
                                    >
                                        {plan.name}
                                    </h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-extrabold">
                                            ৳{price.toLocaleString()}
                                        </span>
                                        <span className="text-gray-500 font-medium">
                                            {suffix}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-4 mb-10 flex-grow">
                                    {features.map((feature, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3"
                                        >
                                            <span
                                                className="material-symbols-outlined text-[#003178] text-xl"
                                            >
                                                check_circle
                                            </span>
                                            <span
                                                className={`text-sm ${
                                                    plan.isPopular
                                                        ? "text-gray-800 font-medium"
                                                        : "text-gray-500"
                                                }`}
                                            >
                                                {feature}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
                                        plan.isPopular
                                            ? "text-white shadow-lg shadow-[#003178]/20"
                                            : "border border-gray-300 hover:bg-[#f3f4f5]"
                                    }`}
                                    style={
                                        plan.isPopular
                                            ? {
                                                  background:
                                                      "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                                              }
                                            : {}
                                    }
                                >
                                    {plan.ctaText || "Choose Plan"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>
        );
    }

    // Fallback static plans
    return (
        <section className="px-6 pb-24">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                {fallbackPlans.map((plan) => {
                    const price =
                        billingPeriod === "yearly"
                            ? plan.priceYearly
                            : plan.priceMonthly;
                    const suffix = billingPeriod === "yearly" ? "/yr" : "/mo";

                    return (
                        <div
                            key={plan.name}
                            className={`bg-white p-10 rounded-xl flex flex-col transition-all duration-300 ${
                                plan.isPopular
                                    ? "border-2 border-[#003178] ring-4 ring-[#003178]/5 relative md:-translate-y-4 shadow-xl"
                                    : "border border-gray-200/10 hover:border-gray-300/40"
                            }`}
                        >
                            {plan.isPopular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#003178] text-white px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                                    Most Popular
                                </div>
                            )}
                            <div className="mb-8">
                                <h3
                                    className="text-xl font-bold mb-2"
                                    style={{
                                        fontFamily: "'Manrope', sans-serif",
                                    }}
                                >
                                    {plan.name}
                                </h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-3xl font-extrabold">
                                        ৳{price.toLocaleString()}
                                    </span>
                                    <span className="text-gray-500 font-medium">
                                        {suffix}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-4 mb-10 flex-grow">
                                {plan.features.map((f) => (
                                    <div
                                        key={f}
                                        className="flex items-center gap-3"
                                    >
                                        <span className="material-symbols-outlined text-[#003178] text-xl">
                                            check_circle
                                        </span>
                                        <span
                                            className={`text-sm ${
                                                plan.isPopular
                                                    ? "text-gray-800 font-medium"
                                                    : "text-gray-500"
                                            }`}
                                        >
                                            {f}
                                        </span>
                                    </div>
                                ))}
                                {plan.disabledFeatures.map((f) => (
                                    <div
                                        key={f}
                                        className="flex items-center gap-3"
                                    >
                                        <span className="material-symbols-outlined text-gray-300 text-xl">
                                            cancel
                                        </span>
                                        <span className="text-sm text-gray-400">
                                            {f}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <button
                                className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
                                    plan.isPopular
                                        ? "text-white shadow-lg shadow-[#003178]/20"
                                        : "border border-gray-300 hover:bg-[#f3f4f5]"
                                }`}
                                style={
                                    plan.isPopular
                                        ? {
                                              background:
                                                  "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                                          }
                                        : {}
                                }
                            >
                                {plan.ctaText}
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
