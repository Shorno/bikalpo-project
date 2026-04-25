"use client";

const capabilities = [
  { icon: "compare_arrows", title: "Real-time Price Comparison", description: "Compare prices across multiple suppliers instantly", color: "#1565c0", size: "large" as const },
  { icon: "warehouse", title: "Direct Warehouse Access", description: "Connect directly with verified warehouses", color: "#2e7d32", size: "normal" as const },
  { icon: "local_offer", title: "Smart Offer Engine", description: "Automated deals and discount management", color: "#ef6c00", size: "normal" as const },
  { icon: "account_balance_wallet", title: "Automated Due Tracking", description: "Never lose track of pending payments", color: "#7b1fa2", size: "normal" as const },
  { icon: "inventory_2", title: "Live Inventory Monitoring", description: "Real-time stock levels across locations", color: "#00838f", size: "normal" as const },
  { icon: "swap_horiz", title: "Secure Internal Transfer", description: "Transfer stock between outlets safely", color: "#4527a0", size: "large" as const },
  { icon: "admin_panel_settings", title: "Role-based Access Control", description: "Manage team permissions precisely", color: "#c62828", size: "normal" as const },
  { icon: "analytics", title: "Multi-level Dashboard", description: "Business insights at every level", color: "#1565c0", size: "normal" as const },
];

export function B2bSmartSupply() {
  return (
    <section className="py-20 sm:py-28 bg-white" id="smart-supply">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#003178]/[0.04] border border-[#003178]/[0.08] mb-6">
            <span className="material-symbols-outlined text-sm text-[#003178]">auto_awesome</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#003178]">Platform Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Built for <span className="bg-gradient-to-r from-[#003178] via-[#0d47a1] to-[#42a5f5] bg-clip-text text-transparent">Modern Business Control</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">Everything you need to manage supply, buying, and selling — in one powerful platform.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className={`group p-8 rounded-2xl bg-white border border-black/[0.06] hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,49,120,0.1)] hover:border-[#003178]/15 transition-all duration-300 ${cap.size === "large" ? "sm:col-span-2" : ""}`}
            >
              <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform" style={{ background: `${cap.color}0D`, color: cap.color }}>
                <span className="material-symbols-outlined text-xl">{cap.icon}</span>
              </div>
              <h3 className="font-bold text-base text-[#0f172a] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>{cap.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
