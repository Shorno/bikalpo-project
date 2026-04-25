"use client";

import { useState } from "react";

const roles = [
  {
    id: "warehouse", label: "Warehouse Owners", icon: "warehouse", color: "#003178",
    features: [
      { icon: "inventory_2", text: "Inventory management" }, { icon: "hub", text: "Shop network control" },
      { icon: "account_balance_wallet", text: "Due tracking" }, { icon: "bar_chart", text: "Profit & loss reports" },
      { icon: "receipt_long", text: "Transaction history" }, { icon: "analytics", text: "Analytics dashboard" },
    ],
  },
  {
    id: "shop", label: "Shop Owners", icon: "storefront", color: "#2e7d32",
    features: [
      { icon: "search", text: "Verified warehouse search" }, { icon: "compare", text: "Product & supply comparison" },
      { icon: "point_of_sale", text: "Digital sales recording" }, { icon: "account_balance_wallet", text: "Due management" },
      { icon: "swap_horiz", text: "Inventory transfer" }, { icon: "summarize", text: "Structured business reporting" },
    ],
  },
  {
    id: "restaurant", label: "Restaurants", icon: "restaurant", color: "#ef6c00",
    features: [
      { icon: "shopping_cart", text: "Bulk sourcing advantage" }, { icon: "verified", text: "Stable supply chain" },
      { icon: "savings", text: "Predictable cost management" },
    ],
  },
];

export function B2bRoles() {
  const [activeRole, setActiveRole] = useState("warehouse");
  const activeData = roles.find((r) => r.id === activeRole) || roles[0];

  return (
    <section className="py-20 sm:py-28 bg-white" id="roles">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#003178]/[0.04] border border-[#003178]/[0.08] mb-6">
            <span className="material-symbols-outlined text-sm text-[#003178]">groups</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#003178]">Role-Based Control</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            One Platform, <span className="bg-gradient-to-r from-[#003178] to-[#42a5f5] bg-clip-text text-transparent">Every Business Role</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">Whether you own a warehouse, shop, or restaurant — Bikalpo Trade gives you the exact tools you need.</p>
        </div>

        <div className="flex justify-center gap-3 mb-12 flex-wrap">
          {roles.map((role) => (
            <button
              key={role.id} type="button" onClick={() => setActiveRole(role.id)}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300"
              style={{
                background: activeRole === role.id ? `linear-gradient(135deg, ${role.color}, ${role.color}DD)` : "white",
                color: activeRole === role.id ? "#ffffff" : "#64748b",
                border: `1.5px solid ${activeRole === role.id ? role.color : "rgba(0,0,0,0.06)"}`,
                boxShadow: activeRole === role.id ? `0 4px 20px ${role.color}30` : "none",
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              <span className="material-symbols-outlined text-lg">{role.icon}</span>
              {role.label}
            </button>
          ))}
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl p-8 sm:p-12" style={{ background: `linear-gradient(135deg, ${activeData.color}06, ${activeData.color}03)`, border: `1px solid ${activeData.color}15` }}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${activeData.color}, ${activeData.color}DD)` }}>
                <span className="material-symbols-outlined text-2xl">{activeData.icon}</span>
              </div>
              <div>
                <h3 className="font-bold text-xl text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>For {activeData.label}</h3>
                <p className="text-sm text-slate-500">Tailored tools and features for your business type</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {activeData.features.map((feature) => (
                <div key={feature.text} className="flex items-center gap-4 p-4 rounded-xl bg-white/80 border border-black/[0.04]">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${activeData.color}0D`, color: activeData.color }}>
                    <span className="material-symbols-outlined text-lg">{feature.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
