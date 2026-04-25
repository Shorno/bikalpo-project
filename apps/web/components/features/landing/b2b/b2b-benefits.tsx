"use client";

const benefits = [
  { icon: "group_add", bn: "বেশি কাস্টমার রিচ", en: "Greater Customer Reach", color: "#1565c0" },
  { icon: "person_add", bn: "নতুন অজানা কাস্টমার থেকে অর্ডার", en: "Orders From New Unknown Customers", color: "#2e7d32" },
  { icon: "savings", bn: "কম খরচে পণ্য সংগ্রহ", en: "Lower Product Sourcing Cost", color: "#ef6c00" },
  { icon: "trending_up", bn: "বেশি প্রফিট মার্জিন", en: "Higher Profit Margins", color: "#00838f" },
  { icon: "speed", bn: "দ্রুত স্টক মুভমেন্ট", en: "Faster Stock Movement", color: "#7b1fa2" },
  { icon: "account_balance_wallet", bn: "নিয়ন্ত্রিত বকেয়া ব্যবস্থাপনা", en: "Controlled Due Management", color: "#c62828" },
  { icon: "insights", bn: "ডেটা ভিত্তিক সিদ্ধান্ত গ্রহণ", en: "Data-Driven Decision Making", color: "#4527a0" },
  { icon: "phone_android", bn: "সম্পূর্ণ ডিজিটাল ব্যবসা নিয়ন্ত্রণ", en: "Complete Digital Business Control", color: "#003178" },
];

export function B2bBenefits() {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-[#0a0e27] via-[#111638] to-[#0a0e27]" id="benefits">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/10 mb-6">
            <span className="material-symbols-outlined text-sm text-[#42a5f5]">emoji_events</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#90caf9]">Real Benefits</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4 text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>
            What You <span className="bg-gradient-to-r from-white to-[#90caf9] bg-clip-text text-transparent">Actually Gain</span>
          </h2>
          <p className="text-lg text-white/50 leading-relaxed">Real, measurable improvements for your trade business.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((benefit) => (
            <div key={benefit.en} className="group p-8 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/15 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)] transition-all duration-300">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform" style={{ background: `${benefit.color}20`, color: benefit.color }}>
                <span className="material-symbols-outlined text-xl">{benefit.icon}</span>
              </div>
              <p className="font-bold text-sm text-white/90 mb-2" style={{ fontFamily: "'Hind Siliguri', sans-serif", lineHeight: 1.8 }}>{benefit.bn}</p>
              <p className="text-xs text-white/40">{benefit.en}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
