"use client";

import { useEffect, useRef, useState } from "react";

const stats = [
  { icon: "bar_chart", label: "Daily Orders", value: 1000, suffix: "+", display: "1,000+" },
  { icon: "warehouse", label: "Active Wholesalers", value: 500, suffix: "+", display: "500+" },
  { icon: "storefront", label: "Active Retailers", value: 2000, suffix: "+", display: "2,000+" },
  { icon: "local_shipping", label: "Delivery Success", value: 95, suffix: "%", display: "95%" },
  { icon: "repeat", label: "Repeat Rate", value: 85, suffix: "%", display: "85%" },
  { icon: "star", label: "User Rating", value: 4.6, suffix: "★", display: "4.6★" },
  { icon: "account_balance_wallet", label: "Monthly Transactions", value: 0, suffix: "", display: "Growing" },
  { icon: "chat_bubble", label: "User Satisfaction", value: 0, suffix: "", display: "Excellent" },
];

const testimonials = [
  { quote: "Bikalpo Trade made our wholesale business fully digital. No more khata hassle!", name: "Mohammad Rahim", role: "Warehouse Owner, Barisal" },
  { quote: "Now I get orders from customers I never knew. My sales increased 40% in 3 months.", name: "Karim Mia", role: "Shop Owner, Khulna" },
];

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [displayValue, setDisplayValue] = useState("0");
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const duration = 2000;
          const steps = 60;
          const increment = target / steps;
          let current = 0;
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              clearInterval(timer);
              if (target >= 1000) setDisplayValue(target.toLocaleString());
              else if (Number.isInteger(target)) setDisplayValue(String(target));
              else setDisplayValue(target.toFixed(1));
            } else {
              if (target >= 1000) setDisplayValue(Math.floor(current).toLocaleString());
              else if (Number.isInteger(target)) setDisplayValue(String(Math.floor(current)));
              else setDisplayValue(current.toFixed(1));
            }
          }, duration / steps);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, hasAnimated]);

  return (
    <div ref={ref} className="text-[2.5rem] font-extrabold leading-none bg-gradient-to-r from-[#003178] via-[#0d47a1] to-[#42a5f5] bg-clip-text text-transparent" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {displayValue}{suffix}
    </div>
  );
}

export function B2bTrust() {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-[#f8faff] via-[#eef2ff] to-[#f8faff]" id="trust">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#003178]/[0.04] border border-[#003178]/[0.08] mb-6">
            <span className="material-symbols-outlined text-sm text-[#003178]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#003178]">Trusted Platform</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Trusted by <span className="bg-gradient-to-r from-[#003178] to-[#42a5f5] bg-clip-text text-transparent">Growing Trade Businesses</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">Real businesses. Real growth. Real impact.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-8 rounded-2xl bg-white border border-black/[0.06] hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,49,120,0.1)] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-[#003178]/[0.06] text-[#003178]">
                <span className="material-symbols-outlined text-xl">{stat.icon}</span>
              </div>
              {stat.value > 0 ? (
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              ) : (
                <div className="text-xl font-extrabold bg-gradient-to-r from-[#003178] to-[#42a5f5] bg-clip-text text-transparent" style={{ fontFamily: "'Manrope', sans-serif" }}>{stat.display}</div>
              )}
              <p className="text-sm font-medium text-slate-500 mt-2">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {testimonials.map((t) => (
            <div key={t.name} className="p-8 rounded-2xl bg-gradient-to-br from-[#003178]/[0.02] to-[#00C853]/[0.02] border border-[#003178]/[0.08] hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,49,120,0.1)] transition-all duration-300">
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} className="material-symbols-outlined text-lg text-[#ffa726]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                ))}
              </div>
              <p className="text-base text-slate-700 mb-6 leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold bg-gradient-to-br from-[#003178] to-[#0d47a1]">{t.name[0]}</div>
                <div>
                  <div className="text-sm font-bold text-[#0f172a]">{t.name}</div>
                  <div className="text-xs text-slate-400">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-6 mt-12">
          {["Digitally Structured Trade Network", "Secure Cloud Infrastructure", "Bangladesh Focused Platform"].map((badge) => (
            <div key={badge} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#003178]/[0.04] border border-[#003178]/[0.08]">
              <span className="material-symbols-outlined text-sm text-[#00C853]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <span className="text-xs font-medium text-slate-700">{badge}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
