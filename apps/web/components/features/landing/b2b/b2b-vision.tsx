"use client";

import Link from "next/link";

export function B2bVision() {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-[#0a0e27] via-[#111638] to-[#0a0e27]" id="vision">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 mb-8">
            <span className="material-symbols-outlined text-sm text-[#42a5f5]">rocket_launch</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#90caf9]">Future Vision</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-8 text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Turn Your Business Into a{" "}
            <span className="bg-gradient-to-r from-white to-[#90caf9] bg-clip-text text-transparent">Digital Trade Network</span>
          </h2>

          <div className="text-lg sm:text-xl mb-10 leading-relaxed text-white/70" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
            <p>আজ আপনি একটি দোকান চালান।</p>
            <p className="font-bold mt-2 text-white/90">আগামীকাল আপনি একটি নেটওয়ার্ক পরিচালনা করবেন।</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
            {[
              { icon: "inventory_2", label: "Supply" }, { icon: "add", label: "" },
              { icon: "shopping_cart", label: "Order" }, { icon: "add", label: "" },
              { icon: "local_shipping", label: "Delivery" }, { icon: "add", label: "" },
              { icon: "tune", label: "Control" }, { icon: "drag_handle", label: "" },
              { icon: "trending_up", label: "Growth" },
            ].map((item, index) => (
              <div key={`formula-${index}`} className="flex flex-col items-center gap-2">
                {item.label ? (
                  <>
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${item.label === "Growth" ? "bg-gradient-to-br from-[#00C853] to-[#69F0AE] text-white" : "bg-white/[0.06] border border-white/10 text-[#90caf9]"}`}>
                      <span className="material-symbols-outlined text-xl">{item.icon}</span>
                    </div>
                    <span className={`text-xs font-bold ${item.label === "Growth" ? "text-[#69F0AE]" : "text-white/50"}`}>{item.label}</span>
                  </>
                ) : (
                  <span className={`material-symbols-outlined text-2xl ${item.icon === "drag_handle" ? "text-[#ffa726]" : "text-white/30"}`}>{item.icon}</span>
                )}
              </div>
            ))}
          </div>

          <div className="p-8 rounded-2xl bg-white/[0.04] border border-white/[0.08] mb-8">
            <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>See how Bikalpo works</h3>
            <p className="text-sm text-white/50 mb-6">Watch a quick demo to understand the full platform</p>
            <Link href="#" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#003178] font-bold text-[15px] rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.15)] transition-all">
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
              Watch Demo Video
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
