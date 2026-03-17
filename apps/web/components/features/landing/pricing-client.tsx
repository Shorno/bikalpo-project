"use client";

import type { LandingPricingPlan } from "@bikalpo-project/db/schema";
import { useState } from "react";

type PricingClientProps = {
  plans: LandingPricingPlan[];
};

export function PricingClient({ plans }: PricingClientProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly",
  );

  return (
    <section
      id="pricing"
      className="py-12 sm:py-24"
      style={{ backgroundColor: "rgba(231,232,233,0.5)" }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2
            className="text-3xl font-bold mb-6"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Simple, Transparent Pricing
          </h2>
          <div className="inline-flex items-center p-1 bg-gray-200 rounded-lg">
            <button
              className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
                billingPeriod === "monthly"
                  ? "bg-white shadow-sm text-[#003178]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setBillingPeriod("monthly")}
            >
              Monthly
            </button>
            <button
              className={`px-6 py-2 rounded-md font-medium text-sm transition-all ${
                billingPeriod === "yearly"
                  ? "bg-white shadow-sm text-[#003178]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setBillingPeriod("yearly")}
            >
              Yearly
            </button>
          </div>
        </div>

        {plans.length > 0 ? (
          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan) => {
              const features = (plan.features as string[]) || [];
              const price =
                billingPeriod === "yearly" && plan.priceYearly
                  ? plan.priceYearly
                  : plan.priceMonthly;
              const suffix = billingPeriod === "yearly" ? "/yr" : "/mo";
              return (
                <div
                  key={plan.id}
                  className={`bg-white p-10 rounded-2xl flex flex-col ${
                    plan.isPopular
                      ? "border-2 border-[#003178] shadow-2xl relative"
                      : "border border-gray-200/30"
                  }`}
                >
                  {plan.isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#003178] text-white text-xs font-bold rounded-full">
                      MOST POPULAR
                    </div>
                  )}
                  <h3
                    className="text-xl font-bold mb-2"
                    style={{
                      fontFamily: "'Manrope', sans-serif",
                    }}
                  >
                    {plan.name}
                  </h3>
                  {plan.subtitle && (
                    <p className="text-sm text-gray-600 mb-6">
                      {plan.subtitle}
                    </p>
                  )}
                  <div className="mb-8">
                    <span className="text-4xl font-extrabold">
                      ৳{price.toLocaleString()}
                    </span>
                    <span className="text-gray-600">{suffix}</span>
                  </div>
                  <ul className="space-y-4 mb-10 flex-grow">
                    {features.map((feature, i) => (
                      <li
                        key={i}
                        className={`flex items-center gap-3 text-sm ${
                          plan.isPopular ? "font-semibold" : ""
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-base"
                          style={{
                            color: "#1b6d24",
                          }}
                        >
                          check
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`w-full py-3 rounded-lg font-bold transition-all ${
                      plan.isPopular
                        ? "text-white shadow-lg shadow-[#003178]/20 py-4"
                        : "border border-[#003178] text-[#003178] hover:bg-[#003178]/5"
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
        ) : (
          /* Fallback static pricing */
          <div className="grid lg:grid-cols-3 gap-8">
            {[
              {
                name: "Basic",
                subtitle: "For small businesses starting out.",
                price: 1500,
                priceYearly: 15000,
                features: ["5 Team Members", "Basic POS", "Email Support"],
                popular: false,
              },
              {
                name: "Standard",
                subtitle: "Advanced tools for growing teams.",
                price: 3500,
                priceYearly: 35000,
                features: [
                  "Unlimited Team Members",
                  "Advanced Inventory",
                  "SMS Automation",
                  "24/7 Priority Support",
                ],
                popular: true,
              },
              {
                name: "Premium",
                subtitle: "Complete ecosystem for enterprises.",
                price: 7000,
                priceYearly: 70000,
                features: [
                  "Full ERP Integration",
                  "Custom API Access",
                  "Dedicated Account Manager",
                ],
                popular: false,
              },
            ].map((plan) => {
              const displayPrice =
                billingPeriod === "yearly" ? plan.priceYearly : plan.price;
              const suffix = billingPeriod === "yearly" ? "/yr" : "/mo";
              return (
                <div
                  key={plan.name}
                  className={`bg-white p-10 rounded-2xl flex flex-col ${
                    plan.popular
                      ? "border-2 border-[#003178] shadow-2xl relative"
                      : "border border-gray-200/30"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#003178] text-white text-xs font-bold rounded-full">
                      MOST POPULAR
                    </div>
                  )}
                  <h3
                    className="text-xl font-bold mb-2"
                    style={{
                      fontFamily: "'Manrope', sans-serif",
                    }}
                  >
                    {plan.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">{plan.subtitle}</p>
                  <div className="mb-8">
                    <span className="text-4xl font-extrabold">
                      ৳{displayPrice.toLocaleString()}
                    </span>
                    <span className="text-gray-600">{suffix}</span>
                  </div>
                  <ul className="space-y-4 mb-10 flex-grow">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className={`flex items-center gap-3 text-sm ${
                          plan.popular ? "font-semibold" : ""
                        }`}
                      >
                        <span
                          className="material-symbols-outlined text-base"
                          style={{ color: "#1b6d24" }}
                        >
                          check
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={`w-full py-3 rounded-lg font-bold transition-all ${
                      plan.popular
                        ? "text-white shadow-lg shadow-[#003178]/20 py-4"
                        : "border border-[#003178] text-[#003178] hover:bg-[#003178]/5"
                    }`}
                    style={
                      plan.popular
                        ? {
                            background:
                              "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                          }
                        : {}
                    }
                  >
                    {plan.popular ? "Get Started Now" : "Choose Plan"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
