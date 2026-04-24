const painPoints = [
  {
    icon: "receipt_long",
    text: "Due হিসাব গুলিয়ে যায়",
    en: "Due tracking gets messy",
  },
  {
    icon: "trending_down",
    text: "লাভ-লোকসান পরিষ্কার বোঝা যায় না",
    en: "Profit/loss unclear",
  },
  {
    icon: "inventory",
    text: "প্রোডাক্ট মুভমেন্ট ট্র্যাক করা কঠিন",
    en: "Hard to track product movement",
  },
  {
    icon: "person_off",
    text: "অজানা কাস্টমার থেকে অর্ডার পাওয়া যায় না",
    en: "Can't get orders from unknown customers",
  },
  {
    icon: "group_off",
    text: "শুধুমাত্র পরিচিত কাস্টমারের উপর নির্ভরতা",
    en: "Dependent only on known customers",
  },
  {
    icon: "edit_note",
    text: "ম্যানুয়াল অর্ডার ও খাতা নির্ভর হিসাব",
    en: "Manual orders & ledger-based accounting",
  },
  {
    icon: "web",
    text: "আলাদা ওয়েবসাইট বানাতে বড় খরচ",
    en: "High cost to build a separate website",
  },
  {
    icon: "local_shipping",
    text: "ডেলিভারি ম্যানেজমেন্ট জটিল",
    en: "Complex delivery management",
  },
];

export function B2bPainPoints() {
  return (
    <section className="b2b-section b2b-section-white" id="pain-points">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(239,83,80,0.06)",
              border: "1px solid rgba(239,83,80,0.1)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ color: "#ef5350" }}
            >
              warning
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#ef5350" }}
            >
              Common Challenges
            </span>
          </div>
          <h2 className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-4" style={{ color: "#0f172a" }}>
            Your Business Is Growing.{" "}
            <span style={{ color: "#ef5350" }}>But Your System Is Not.</span>
          </h2>
          <p className="b2b-subheading text-lg">
            Most trade businesses in Bangladesh still run on manual processes.
            These problems are costing you money every day.
          </p>
        </div>

        {/* Pain points grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {painPoints.map((point, index) => (
            <div
              key={point.en}
              className="b2b-card group relative"
              style={{
                animationDelay: `${index * 100}ms`,
                background: "#fafbfc",
                borderColor: "rgba(239,83,80,0.08)",
              }}
            >
              {/* Red indicator */}
              <div
                className="absolute top-0 left-6 right-6 h-[2px] rounded-b-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "linear-gradient(90deg, transparent, #ef5350, transparent)" }}
              />
              <div
                className="b2b-icon-box mb-5"
                style={{
                  background: "rgba(239,83,80,0.08)",
                  color: "#ef5350",
                }}
              >
                <span className="material-symbols-outlined text-xl">
                  {point.icon}
                </span>
              </div>
              <p
                className="b2b-bn font-semibold text-sm mb-2"
                style={{ color: "#1e293b", lineHeight: 1.8 }}
              >
                {point.text}
              </p>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                {point.en}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
