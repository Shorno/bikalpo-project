"use client";

const traditionalWay = [
  "Website development cost", "Developer hiring", "Hosting + maintenance",
  "Security management", "Separate customer service setup", "Order & delivery integration complexity",
];

const bikalpoWay = [
  "Instant business account activation", "Ready product listing system", "Built-in order management",
  "Built-in customer access", "Integrated offer engine", "Automated inventory tracking",
  "Centralized dashboard", "Zero development hassle",
];

export function B2bNoWebsite() {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-[#f0f4ff] via-[#f8faff] to-white" id="no-website">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF6D00]/[0.06] border border-[#FF6D00]/[0.12] mb-6">
            <span className="material-symbols-outlined text-sm text-[#FF6D00]">code_off</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF6D00]">Zero Development Cost</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            No Website. No Developer.{" "}
            <span className="bg-gradient-to-r from-[#003178] to-[#42a5f5] bg-clip-text text-transparent">No Extra Cost.</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">Everything a separate website offers — and more — is already built into Bikalpo Trade.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="rounded-2xl p-8 bg-red-500/[0.02] border border-red-500/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500">
                <span className="material-symbols-outlined">close</span>
              </div>
              <h3 className="font-bold text-lg text-red-500" style={{ fontFamily: "'Manrope', sans-serif" }}>Traditional Way</h3>
            </div>
            <div className="space-y-4">
              {traditionalWay.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-base shrink-0 text-red-500">cancel</span>
                  <span className="text-sm text-slate-400 line-through">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 text-center border-t border-red-500/10">
              <span className="text-sm font-bold text-red-500">৳50,000 — ৳5,00,000+ cost</span>
            </div>
          </div>

          <div className="rounded-2xl p-8 relative overflow-hidden bg-gradient-to-br from-[#003178]/[0.03] to-[#00C853]/[0.03] border border-[#003178]/10">
            <div className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-br from-[#003178] to-[#0d47a1] text-white">RECOMMENDED</div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#003178] to-[#0d47a1] text-white">
                <span className="material-symbols-outlined">check</span>
              </div>
              <h3 className="font-bold text-lg text-[#003178]" style={{ fontFamily: "'Manrope', sans-serif" }}>With Bikalpo Trade</h3>
            </div>
            <div className="space-y-4">
              {bikalpoWay.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-base shrink-0 text-[#00C853]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-sm font-medium text-slate-700">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 text-center border-t border-[#003178]/[0.08]">
              <span className="text-sm font-bold text-[#00C853]">৳0 setup • Free 30-day trial</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
