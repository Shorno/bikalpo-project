"use client";

const networkNodes = [
  { from: "Warehouse", to: "Warehouse", type: "Transfer & Supply", icon: "warehouse", arrow: "⇄", color: "#1565c0" },
  { from: "Warehouse", to: "Shop / Restaurant", type: "Supply Only", icon: "storefront", arrow: "→", color: "#2e7d32" },
  { from: "Shop", to: "Shop", type: "Transfer Only", icon: "swap_horiz", arrow: "⇄", color: "#ef6c00" },
  { from: "Shop", to: "Consumer", type: "Retail Only", icon: "person", arrow: "→", color: "#7b1fa2" },
  { from: "Restaurant", to: "Warehouse", type: "Purchase Only", icon: "restaurant", arrow: "←", color: "#c62828" },
];

export function B2bNetwork() {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#f8faff]" id="network">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#003178]/[0.04] border border-[#003178]/[0.08] mb-6">
            <span className="material-symbols-outlined text-sm text-[#003178]">hub</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#003178]">Network Architecture</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Structured{" "}
            <span className="bg-gradient-to-r from-[#003178] via-[#0d47a1] to-[#42a5f5] bg-clip-text text-transparent">Digital Trade Network</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">Every connection is tracked, verified, and reportable.</p>
        </div>

        <div className="max-w-4xl mx-auto grid gap-4">
          {networkNodes.map((node) => (
            <div
              key={`${node.from}-${node.to}-${node.type}`}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-8 rounded-2xl bg-white border border-black/[0.06] hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,49,120,0.1)] transition-all duration-300"
              style={{ borderLeftWidth: "4px", borderLeftColor: node.color }}
            >
              <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center shrink-0" style={{ background: `${node.color}12`, color: node.color }}>
                <span className="material-symbols-outlined">{node.icon}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="font-bold text-base text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>{node.from}</span>
                  <span className="text-xl font-bold" style={{ color: node.color }}>{node.arrow}</span>
                  <span className="font-bold text-base text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>{node.to}</span>
                </div>
                <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ background: `${node.color}0D`, color: node.color }}>{node.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-[#66bb6a]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-xs font-medium text-slate-400">Digitally Recorded</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 rounded-2xl text-center bg-gradient-to-r from-[#003178]/[0.04] to-[#00C853]/[0.04] border border-[#003178]/[0.08] max-w-4xl mx-auto">
          <p className="text-base font-medium text-slate-700" style={{ fontFamily: "'Hind Siliguri', sans-serif", lineHeight: 1.8 }}>
            প্রতিটি ট্রেড মুভমেন্ট নিরাপদ, ট্র্যাকযোগ্য ও রিপোর্টযোগ্য।
          </p>
          <p className="text-sm mt-1 text-slate-500">Every trade movement is secure, trackable & reportable.</p>
        </div>
      </div>
    </section>
  );
}
