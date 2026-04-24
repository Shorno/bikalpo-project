const benefits = [
  {
    icon: "group_add",
    bn: "বেশি কাস্টমার রিচ",
    en: "Greater Customer Reach",
    color: "#1565c0",
  },
  {
    icon: "person_add",
    bn: "নতুন অজানা কাস্টমার থেকে অর্ডার",
    en: "Orders From New Unknown Customers",
    color: "#2e7d32",
  },
  {
    icon: "savings",
    bn: "কম খরচে পণ্য সংগ্রহ",
    en: "Lower Product Sourcing Cost",
    color: "#ef6c00",
  },
  {
    icon: "trending_up",
    bn: "বেশি প্রফিট মার্জিন",
    en: "Higher Profit Margins",
    color: "#00838f",
  },
  {
    icon: "speed",
    bn: "দ্রুত স্টক মুভমেন্ট",
    en: "Faster Stock Movement",
    color: "#7b1fa2",
  },
  {
    icon: "account_balance_wallet",
    bn: "নিয়ন্ত্রিত বকেয়া ব্যবস্থাপনা",
    en: "Controlled Due Management",
    color: "#c62828",
  },
  {
    icon: "insights",
    bn: "ডেটা ভিত্তিক সিদ্ধান্ত গ্রহণ",
    en: "Data-Driven Decision Making",
    color: "#4527a0",
  },
  {
    icon: "phone_android",
    bn: "সম্পূর্ণ ডিজিটাল ব্যবসা নিয়ন্ত্রণ",
    en: "Complete Digital Business Control",
    color: "#003178",
  },
];

export function B2bBenefits() {
  return (
    <section
      className="b2b-section"
      id="benefits"
      style={{
        background:
          "linear-gradient(180deg, #0a0e27 0%, #111638 50%, #0a0e27 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ color: "#42a5f5" }}
            >
              emoji_events
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#90caf9" }}
            >
              Real Benefits
            </span>
          </div>
          <h2
            className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-4"
            style={{ color: "#ffffff" }}
          >
            What You{" "}
            <span className="b2b-gradient-text-light">Actually Gain</span>
          </h2>
          <p
            className="text-lg"
            style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.7 }}
          >
            Real, measurable improvements for your trade business.
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.en}
              className="b2b-card-dark group"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform"
                style={{
                  background: `${benefit.color}20`,
                  color: benefit.color,
                }}
              >
                <span className="material-symbols-outlined text-xl">
                  {benefit.icon}
                </span>
              </div>
              <p
                className="b2b-bn font-bold text-sm mb-2"
                style={{ color: "rgba(255,255,255,0.9)" }}
              >
                {benefit.bn}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {benefit.en}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
