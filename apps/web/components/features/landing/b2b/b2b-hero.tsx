"use client";

import Link from "next/link";

export function B2bHero() {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden bg-gradient-to-br from-[#f8faff] via-[#eef2ff] to-[#f8f9fc]">
      {/* Decorative blurs */}
      <div className="absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full bg-[#003178]/[0.06] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-[#00C853]/[0.05] blur-3xl pointer-events-none" />
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,49,120,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,49,120,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <div>
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#003178]/[0.04] border border-[#003178]/[0.08] mb-8 animate-fade-in">
              <span
                className="material-symbols-outlined text-sm text-[#003178]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#003178]">
                Approval Based Access • 30 Days Free Trial • No Setup Cost
              </span>
            </div>

            {/* Headline */}
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.12] tracking-tight mb-6 text-[#0f172a]"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Control Your Supply.{" "}
              <span className="bg-gradient-to-r from-[#003178] via-[#0d47a1] to-[#42a5f5] bg-clip-text text-transparent">
                Expand Your Market.
              </span>{" "}
              Increase Your Profit.
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-slate-600 mb-2 max-w-xl leading-relaxed">
              Bangladesh&apos;s Digital Wholesale Network — Warehouse, Shop & Restaurant
            </p>
            <p
              className="text-base text-slate-500 mb-8 max-w-xl"
              style={{ fontFamily: "'Hind Siliguri', sans-serif", lineHeight: 1.8 }}
            >
              এক প্ল্যাটফর্মে সম্পূর্ণ ডিজিটাল ট্রেড ও অর্ডার সিস্টেম।
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4">
              <Link
                href="/b2b/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-br from-[#003178] to-[#0d47a1] text-white font-bold text-[15px] rounded-xl shadow-[0_4px_24px_rgba(0,49,120,0.25)] hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,49,120,0.35)] transition-all"
              >
                Apply for Free Trial
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-8 py-4 text-[#003178] font-bold text-[15px] rounded-xl border-2 border-[#003178]/20 hover:bg-[#003178]/[0.05] hover:border-[#003178]/40 hover:-translate-y-0.5 transition-all"
              >
                See How It Works
              </Link>
            </div>
          </div>

          {/* Right: Dashboard mock */}
          <div className="relative">
            <div className="absolute -top-8 -right-8 w-[200px] h-[200px] rounded-full bg-[#003178]/[0.08] blur-2xl pointer-events-none" />
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a1628] to-[#1a2744] p-8 shadow-[0_32px_80px_rgba(0,49,120,0.15)]">
              <div className="space-y-4">
                {/* Header bar */}
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#003178] to-[#1565c0]" />
                    <div>
                      <div className="h-3 w-24 rounded bg-white/20" />
                      <div className="h-2 w-16 rounded mt-1.5 bg-white/[0.08]" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded bg-white/[0.06]" />
                    <div className="w-6 h-6 rounded bg-white/[0.06]" />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Orders", value: "1,247", color: "text-[#42a5f5]" },
                    { label: "Revenue", value: "৳84K", color: "text-[#66bb6a]" },
                    { label: "Growth", value: "+23%", color: "text-[#ffa726]" },
                  ].map((stat) => (
                    <div key={stat.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-xs text-white/40 mb-1">{stat.label}</div>
                      <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                <div className="rounded-xl p-4 bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex items-end gap-2 h-24 justify-between px-2">
                    {[40, 65, 45, 80, 60, 90, 75, 95, 70, 85, 92, 88].map((h, i) => (
                      <div
                        key={`bar-${i}`}
                        className="flex-1 rounded-t-sm min-w-[6px]"
                        style={{
                          height: `${h}%`,
                          background: `linear-gradient(180deg, rgba(66,165,245,${0.6 + (h / 100) * 0.4}) 0%, rgba(0,49,120,0.3) 100%)`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Order list */}
                <div className="space-y-2">
                  {[
                    { name: "Rahim Store", amount: "৳12,500", status: "Completed" },
                    { name: "Karim Mart", amount: "৳8,200", status: "Processing" },
                    { name: "City Grocers", amount: "৳15,800", status: "Pending" },
                  ].map((order) => (
                    <div key={order.name} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-[#003178]/30 text-[#90caf9]">
                          {order.name[0]}
                        </div>
                        <span className="text-sm font-medium text-white/70">{order.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white/80">{order.amount}</div>
                        <div className="text-xs text-white/35">{order.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
