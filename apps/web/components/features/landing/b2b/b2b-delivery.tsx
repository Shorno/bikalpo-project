const deliveryFeatures = [
  {
    icon: "group_add",
    title: "Multiple Delivery Partners",
    description: "Multiple delivery partner add করার সুবিধা",
  },
  {
    icon: "badge",
    title: "Own Delivery Team",
    description: "নিজস্ব ডেলিভারি টিম যুক্ত করার অপশন",
  },
  {
    icon: "confirmation_number",
    title: "Platform Ticketing",
    description: "বিভিন্ন ডেলিভারি প্ল্যাটফর্ম টিকিটিং",
  },
  {
    icon: "route",
    title: "Order-to-Delivery Tracking",
    description: "Order-to-delivery সম্পূর্ণ tracking",
  },
  {
    icon: "monitoring",
    title: "Delivery Status Monitoring",
    description: "Delivery status real-time monitoring",
  },
];

export function B2bDelivery() {
  return (
    <section
      className="b2b-section"
      id="delivery"
      style={{
        background:
          "linear-gradient(180deg, #f8faff 0%, #f0f4ff 50%, #f8faff 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Visual */}
          <div className="relative order-2 lg:order-1">
            <div
              className="rounded-2xl p-8"
              style={{
                background: "linear-gradient(135deg, #0a1628 0%, #1a2744 100%)",
                boxShadow: "0 24px 60px rgba(0,0,0,0.15)",
              }}
            >
              {/* Delivery flow visualization */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-lg" style={{ color: "#42a5f5" }}>
                    local_shipping
                  </span>
                  <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>
                    Delivery Control Center
                  </span>
                </div>

                {/* Delivery partners */}
                {[
                  { name: "Pathao Courier", orders: 12, status: "Active", color: "#66bb6a" },
                  { name: "Own Team - Rahim", orders: 8, status: "On Route", color: "#42a5f5" },
                  { name: "SteadFast", orders: 5, status: "Active", color: "#66bb6a" },
                ].map((partner) => (
                  <div
                    key={partner.name}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(66,165,245,0.15)" }}
                      >
                        <span className="material-symbols-outlined text-sm" style={{ color: "#42a5f5" }}>
                          local_shipping
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                          {partner.name}
                        </div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {partner.orders} orders
                        </div>
                      </div>
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-full"
                      style={{
                        background: `${partner.color}1A`,
                        color: partner.color,
                      }}
                    >
                      {partner.status}
                    </span>
                  </div>
                ))}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[
                    { label: "In Transit", value: "25" },
                    { label: "Delivered", value: "142" },
                    { label: "Success", value: "96%" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="text-center p-2 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <div className="text-lg font-bold" style={{ color: "#42a5f5" }}>
                        {stat.value}
                      </div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Content */}
          <div className="order-1 lg:order-2">
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
                local_shipping
              </span>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#003178" }}
              >
                Delivery System
              </span>
            </div>
            <h2
              className="b2b-heading text-3xl sm:text-4xl mb-4"
              style={{ color: "#0f172a" }}
            >
              Flexible{" "}
              <span className="b2b-gradient-text">Delivery Control</span>
            </h2>
            <p className="b2b-subheading text-lg mb-10">
              Add your own delivery team or connect third-party delivery
              partners. Full control over the last mile.
            </p>

            <div className="space-y-3">
              {deliveryFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-md"
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{
                      color: "#00C853",
                      fontVariationSettings: "'FILL' 1",
                    }}
                  >
                    check_circle
                  </span>
                  <div>
                    <span
                      className="font-bold text-sm"
                      style={{
                        fontFamily: "'Manrope', sans-serif",
                        color: "#0f172a",
                      }}
                    >
                      {feature.title}
                    </span>
                    <span className="text-sm b2b-bn ml-2" style={{ color: "#64748b" }}>
                      — {feature.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
