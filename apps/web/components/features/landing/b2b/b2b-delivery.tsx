"use client";

const deliveryFeatures = [
  { icon: "group_add", title: "Multiple Delivery Partners", description: "Multiple delivery partner add করার সুবিধা" },
  { icon: "badge", title: "Own Delivery Team", description: "নিজস্ব ডেলিভারি টিম যুক্ত করার অপশন" },
  { icon: "confirmation_number", title: "Platform Ticketing", description: "বিভিন্ন ডেলিভারি প্ল্যাটফর্ম টিকিটিং" },
  { icon: "route", title: "Order-to-Delivery Tracking", description: "Order-to-delivery সম্পূর্ণ tracking" },
  { icon: "monitoring", title: "Delivery Status Monitoring", description: "Delivery status real-time monitoring" },
];

export function B2bDelivery() {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-[#f8faff] via-[#f0f4ff] to-[#f8faff]" id="delivery">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative order-2 lg:order-1">
            <div className="rounded-2xl p-8 bg-gradient-to-br from-[#0a1628] to-[#1a2744] shadow-[0_24px_60px_rgba(0,0,0,0.15)]">
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                  <span className="material-symbols-outlined text-lg text-[#42a5f5]">local_shipping</span>
                  <span className="text-sm font-bold text-white/90">Delivery Control Center</span>
                </div>
                {[
                  { name: "Pathao Courier", orders: 12, status: "Active", color: "#66bb6a" },
                  { name: "Own Team - Rahim", orders: 8, status: "On Route", color: "#42a5f5" },
                  { name: "SteadFast", orders: 5, status: "Active", color: "#66bb6a" },
                ].map((partner) => (
                  <div key={partner.name} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#42a5f5]/15">
                        <span className="material-symbols-outlined text-sm text-[#42a5f5]">local_shipping</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white/85">{partner.name}</div>
                        <div className="text-xs text-white/40">{partner.orders} orders</div>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: `${partner.color}1A`, color: partner.color }}>{partner.status}</span>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[{ label: "In Transit", value: "25" }, { label: "Delivered", value: "142" }, { label: "Success", value: "96%" }].map((stat) => (
                    <div key={stat.label} className="text-center p-2 rounded-lg bg-white/[0.04]">
                      <div className="text-lg font-bold text-[#42a5f5]">{stat.value}</div>
                      <div className="text-xs text-white/40">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#003178]/[0.04] border border-[#003178]/[0.08] mb-6">
              <span className="material-symbols-outlined text-sm text-[#003178]">local_shipping</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#003178]">Delivery System</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Flexible <span className="bg-gradient-to-r from-[#003178] to-[#42a5f5] bg-clip-text text-transparent">Delivery Control</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-10">Add your own delivery team or connect third-party delivery partners. Full control over the last mile.</p>
            <div className="space-y-3">
              {deliveryFeatures.map((feature) => (
                <div key={feature.title} className="flex items-center gap-4 p-4 rounded-xl bg-white border border-black/[0.04] hover:shadow-md transition-shadow">
                  <span className="material-symbols-outlined text-lg text-[#00C853]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <div>
                    <span className="font-bold text-sm text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>{feature.title}</span>
                    <span className="text-sm text-slate-500 ml-2" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>— {feature.description}</span>
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
