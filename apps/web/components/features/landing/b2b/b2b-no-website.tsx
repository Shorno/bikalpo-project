const traditionalWay = [
  "Website development cost",
  "Developer hiring",
  "Hosting + maintenance",
  "Security management",
  "Separate customer service setup",
  "Order & delivery integration complexity",
];

const bikalpoWay = [
  "Instant business account activation",
  "Ready product listing system",
  "Built-in order management",
  "Built-in customer access",
  "Integrated offer engine",
  "Automated inventory tracking",
  "Centralized dashboard",
  "Zero development hassle",
];

export function B2bNoWebsite() {
  return (
    <section
      className="b2b-section"
      id="no-website"
      style={{
        background:
          "linear-gradient(180deg, #f0f4ff 0%, #f8faff 50%, #ffffff 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(255,109,0,0.06)",
              border: "1px solid rgba(255,109,0,0.12)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ color: "#FF6D00" }}
            >
              code_off
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#FF6D00" }}
            >
              Zero Development Cost
            </span>
          </div>
          <h2
            className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-4"
            style={{ color: "#0f172a" }}
          >
            No Website. No Developer.{" "}
            <span className="b2b-gradient-text">No Extra Cost.</span>
          </h2>
          <p className="b2b-subheading text-lg">
            Everything a separate website offers — and more — is already built
            into Bikalpo Trade.
          </p>
        </div>

        {/* Comparison */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Traditional */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: "rgba(239,83,80,0.02)",
              border: "1px solid rgba(239,83,80,0.1)",
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "rgba(239,83,80,0.1)",
                  color: "#ef5350",
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </div>
              <h3
                className="font-bold text-lg"
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  color: "#ef5350",
                }}
              >
                Traditional Way
              </h3>
            </div>
            <div className="space-y-4">
              {traditionalWay.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-base flex-shrink-0"
                    style={{ color: "#ef5350" }}
                  >
                    cancel
                  </span>
                  <span
                    className="text-sm"
                    style={{
                      color: "#94a3b8",
                      textDecoration: "line-through",
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-6 pt-4 text-center"
              style={{ borderTop: "1px solid rgba(239,83,80,0.1)" }}
            >
              <span
                className="text-sm font-bold"
                style={{ color: "#ef5350" }}
              >
                ৳50,000 — ৳5,00,000+ cost
              </span>
            </div>
          </div>

          {/* Bikalpo */}
          <div
            className="rounded-2xl p-8 relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,49,120,0.03) 0%, rgba(0,200,83,0.03) 100%)",
              border: "1px solid rgba(0,49,120,0.1)",
            }}
          >
            {/* Popular badge */}
            <div
              className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background:
                  "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                color: "#ffffff",
              }}
            >
              RECOMMENDED
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
                  color: "#ffffff",
                }}
              >
                <span className="material-symbols-outlined">check</span>
              </div>
              <h3
                className="font-bold text-lg"
                style={{
                  fontFamily: "'Manrope', sans-serif",
                  color: "#003178",
                }}
              >
                With Bikalpo Trade
              </h3>
            </div>
            <div className="space-y-4">
              {bikalpoWay.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-base flex-shrink-0"
                    style={{
                      color: "#00C853",
                      fontVariationSettings: "'FILL' 1",
                    }}
                  >
                    check_circle
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "#334155" }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="mt-6 pt-4 text-center"
              style={{ borderTop: "1px solid rgba(0,49,120,0.08)" }}
            >
              <span
                className="text-sm font-bold"
                style={{ color: "#00C853" }}
              >
                ৳0 setup • Free 30-day trial
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
