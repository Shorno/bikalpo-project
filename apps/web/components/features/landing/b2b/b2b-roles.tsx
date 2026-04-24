"use client";

import { useState } from "react";

const roles = [
  {
    id: "warehouse",
    label: "Warehouse Owners",
    icon: "warehouse",
    color: "#003178",
    features: [
      { icon: "inventory_2", text: "Inventory management" },
      { icon: "hub", text: "Shop network control" },
      { icon: "account_balance_wallet", text: "Due tracking" },
      { icon: "bar_chart", text: "Profit & loss reports" },
      { icon: "receipt_long", text: "Transaction history" },
      { icon: "analytics", text: "Analytics dashboard" },
    ],
  },
  {
    id: "shop",
    label: "Shop Owners",
    icon: "storefront",
    color: "#2e7d32",
    features: [
      { icon: "search", text: "Verified warehouse search" },
      { icon: "compare", text: "Product & supply comparison" },
      { icon: "point_of_sale", text: "Digital sales recording" },
      { icon: "account_balance_wallet", text: "Due management" },
      { icon: "swap_horiz", text: "Inventory transfer" },
      { icon: "summarize", text: "Structured business reporting" },
    ],
  },
  {
    id: "restaurant",
    label: "Restaurants",
    icon: "restaurant",
    color: "#ef6c00",
    features: [
      { icon: "shopping_cart", text: "Bulk sourcing advantage" },
      { icon: "verified", text: "Stable supply chain" },
      { icon: "savings", text: "Predictable cost management" },
    ],
  },
];

export function B2bRoles() {
  const [activeRole, setActiveRole] = useState("warehouse");
  const activeData = roles.find((r) => r.id === activeRole) || roles[0];

  return (
    <section className="b2b-section b2b-section-white" id="roles">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(0,49,120,0.04)",
              border: "1px solid rgba(0,49,120,0.08)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ color: "#003178" }}
            >
              groups
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#003178" }}
            >
              Role-Based Control
            </span>
          </div>
          <h2
            className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-4"
            style={{ color: "#0f172a" }}
          >
            One Platform,{" "}
            <span className="b2b-gradient-text">Every Business Role</span>
          </h2>
          <p className="b2b-subheading text-lg">
            Whether you own a warehouse, shop, or restaurant — Bikalpo Trade
            gives you the exact tools you need.
          </p>
        </div>

        {/* Role Tabs */}
        <div className="flex justify-center gap-3 mb-12 flex-wrap">
          {roles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setActiveRole(role.id)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background:
                  activeRole === role.id
                    ? `linear-gradient(135deg, ${role.color} 0%, ${role.color}DD 100%)`
                    : "white",
                color: activeRole === role.id ? "#ffffff" : "#64748b",
                border: `1.5px solid ${activeRole === role.id ? role.color : "rgba(0,0,0,0.06)"}`,
                boxShadow:
                  activeRole === role.id
                    ? `0 4px 20px ${role.color}30`
                    : "none",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              <span className="material-symbols-outlined text-lg">
                {role.icon}
              </span>
              {role.label}
            </button>
          ))}
        </div>

        {/* Features display */}
        <div className="max-w-4xl mx-auto">
          <div
            className="rounded-2xl p-8 sm:p-12"
            style={{
              background: `linear-gradient(135deg, ${activeData.color}06 0%, ${activeData.color}03 100%)`,
              border: `1px solid ${activeData.color}15`,
            }}
          >
            <div className="flex items-center gap-4 mb-8">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${activeData.color} 0%, ${activeData.color}DD 100%)`,
                  color: "#ffffff",
                }}
              >
                <span className="material-symbols-outlined text-2xl">
                  {activeData.icon}
                </span>
              </div>
              <div>
                <h3
                  className="font-bold text-xl"
                  style={{
                    fontFamily: "'Manrope', sans-serif",
                    color: "#0f172a",
                  }}
                >
                  For {activeData.label}
                </h3>
                <p className="text-sm" style={{ color: "#64748b" }}>
                  Tailored tools and features for your business type
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {activeData.features.map((feature) => (
                <div
                  key={feature.text}
                  className="flex items-center gap-4 p-4 rounded-xl transition-all"
                  style={{
                    background: "rgba(255,255,255,0.8)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${activeData.color}0D`,
                      color: activeData.color,
                    }}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {feature.icon}
                    </span>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#334155" }}
                  >
                    {feature.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
