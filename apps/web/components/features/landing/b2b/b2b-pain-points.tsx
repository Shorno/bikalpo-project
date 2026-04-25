"use client";

const painPoints = [
  { icon: "receipt_long", text: "Due হিসাব গুলিয়ে যায়", en: "Due tracking gets messy" },
  { icon: "trending_down", text: "লাভ-লোকসান পরিষ্কার বোঝা যায় না", en: "Profit/loss unclear" },
  { icon: "inventory", text: "প্রোডাক্ট মুভমেন্ট ট্র্যাক করা কঠিন", en: "Hard to track product movement" },
  { icon: "person_off", text: "অজানা কাস্টমার থেকে অর্ডার পাওয়া যায় না", en: "Can't get orders from unknown customers" },
  { icon: "group_off", text: "শুধুমাত্র পরিচিত কাস্টমারের উপর নির্ভরতা", en: "Dependent only on known customers" },
  { icon: "edit_note", text: "ম্যানুয়াল অর্ডার ও খাতা নির্ভর হিসাব", en: "Manual orders & ledger-based accounting" },
  { icon: "web", text: "আলাদা ওয়েবসাইট বানাতে বড় খরচ", en: "High cost to build a separate website" },
  { icon: "local_shipping", text: "ডেলিভারি ম্যানেজমেন্ট জটিল", en: "Complex delivery management" },
];

export function B2bPainPoints() {
  return (
    <section className="py-20 sm:py-28 bg-white" id="pain-points">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/[0.06] border border-red-500/10 mb-6">
            <span className="material-symbols-outlined text-sm text-red-500">warning</span>
            <span className="text-xs font-bold uppercase tracking-wider text-red-500">Common Challenges</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] mb-4 text-[#0f172a]" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Your Business Is Growing.{" "}
            <span className="text-red-500">But Your System Is Not.</span>
          </h2>
          <p className="text-lg text-slate-500 leading-relaxed">
            Most trade businesses in Bangladesh still run on manual processes. These problems are costing you money every day.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {painPoints.map((point) => (
            <div
              key={point.en}
              className="relative group p-8 rounded-2xl bg-[#fafbfc] border border-red-500/[0.08] hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,49,120,0.1)] hover:border-[#003178]/15 transition-all duration-300"
            >
              <div className="absolute top-0 left-6 right-6 h-[2px] rounded-b-full opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-red-500 to-transparent" />
              <div className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center bg-red-500/[0.08] text-red-500 mb-5 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">{point.icon}</span>
              </div>
              <p className="font-semibold text-sm text-[#1e293b] mb-2" style={{ fontFamily: "'Hind Siliguri', sans-serif", lineHeight: 1.8 }}>
                {point.text}
              </p>
              <p className="text-xs text-slate-400">{point.en}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
