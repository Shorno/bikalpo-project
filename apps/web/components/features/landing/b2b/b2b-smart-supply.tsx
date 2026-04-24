const capabilities = [
  {
    icon: "compare_arrows",
    title: "Real-time Price Comparison",
    description: "Compare prices across multiple suppliers instantly",
    color: "#1565c0",
    size: "large",
  },
  {
    icon: "warehouse",
    title: "Direct Warehouse Access",
    description: "Connect directly with verified warehouses",
    color: "#2e7d32",
    size: "normal",
  },
  {
    icon: "local_offer",
    title: "Smart Offer Engine",
    description: "Automated deals and discount management",
    color: "#ef6c00",
    size: "normal",
  },
  {
    icon: "account_balance_wallet",
    title: "Automated Due Tracking",
    description: "Never lose track of pending payments",
    color: "#7b1fa2",
    size: "normal",
  },
  {
    icon: "inventory_2",
    title: "Live Inventory Monitoring",
    description: "Real-time stock levels across locations",
    color: "#00838f",
    size: "normal",
  },
  {
    icon: "swap_horiz",
    title: "Secure Internal Transfer",
    description: "Transfer stock between outlets safely",
    color: "#4527a0",
    size: "large",
  },
  {
    icon: "admin_panel_settings",
    title: "Role-based Access Control",
    description: "Manage team permissions precisely",
    color: "#c62828",
    size: "normal",
  },
  {
    icon: "analytics",
    title: "Multi-level Dashboard",
    description: "Business insights at every level",
    color: "#1565c0",
    size: "normal",
  },
];

export function B2bSmartSupply() {
  return (
    <section className="b2b-section b2b-section-white" id="smart-supply">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
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
              auto_awesome
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#003178" }}
            >
              Platform Capabilities
            </span>
          </div>
          <h2
            className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-4"
            style={{ color: "#0f172a" }}
          >
            Built for{" "}
            <span className="b2b-gradient-text">Modern Business Control</span>
          </h2>
          <p className="b2b-subheading text-lg">
            Everything you need to manage supply, buying, and selling — in one
            powerful platform.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {capabilities.map((cap, index) => (
            <div
              key={cap.title}
              className={`b2b-card group ${cap.size === "large" ? "sm:col-span-2" : ""}`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div
                className="b2b-icon-box mb-5"
                style={{
                  background: `${cap.color}0D`,
                  color: cap.color,
                }}
              >
                <span className="material-symbols-outlined text-xl">
                  {cap.icon}
                </span>
              </div>
              <h3
                className="font-bold text-base mb-2"
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  color: "#0f172a",
                }}
              >
                {cap.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#64748b" }}>
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
