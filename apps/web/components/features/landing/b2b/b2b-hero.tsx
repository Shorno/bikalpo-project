import Link from "next/link";

export function B2bHero() {
  return (
    <section
      className="b2b-section relative"
      style={{
        background:
          "linear-gradient(135deg, #f8faff 0%, #eef2ff 30%, #f0f4ff 60%, #f8f9fc 100%)",
        paddingTop: "60px",
        paddingBottom: "80px",
        overflow: "hidden",
      }}
    >
      {/* Decorative elements */}
      <div
        className="b2b-decoration-circle b2b-animate-float-slow"
        style={{
          width: "400px",
          height: "400px",
          top: "-100px",
          right: "-100px",
          background:
            "radial-gradient(circle, rgba(0,49,120,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        className="b2b-decoration-circle b2b-animate-float"
        style={{
          width: "300px",
          height: "300px",
          bottom: "-80px",
          left: "-80px",
          background:
            "radial-gradient(circle, rgba(0,200,83,0.05) 0%, transparent 70%)",
        }}
      />
      <div
        className="b2b-decoration-grid"
        style={{
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
          opacity: 0.5,
        }}
      />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <div>
            {/* Trust badge */}
            <div
              className="b2b-animate-fade-up inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8"
              style={{
                background: "rgba(0,49,120,0.04)",
                border: "1px solid rgba(0,49,120,0.08)",
              }}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{
                  color: "#003178",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                verified
              </span>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "#003178" }}
              >
                Approval Based Access • 30 Days Free Trial • No Setup Cost
              </span>
            </div>

            {/* Headline */}
            <h1
              className="b2b-heading b2b-animate-fade-up b2b-delay-100 text-4xl sm:text-5xl lg:text-6xl mb-6"
              style={{ color: "#0f172a" }}
            >
              Control Your Supply.{" "}
              <span className="b2b-gradient-text">Expand Your Market.</span>{" "}
              Increase Your Profit.
            </h1>

            {/* Subheadline */}
            <p
              className="b2b-animate-fade-up b2b-delay-200 text-lg mb-3 max-w-xl"
              style={{ color: "#475569", lineHeight: 1.7 }}
            >
              Bangladesh&apos;s Digital Wholesale Network — Warehouse, Shop &
              Restaurant
            </p>
            <p
              className="b2b-animate-fade-up b2b-delay-200 b2b-bn text-base mb-8 max-w-xl"
              style={{ color: "#64748b" }}
            >
              এক প্ল্যাটফর্মে সম্পূর্ণ ডিজিটাল ট্রেড ও অর্ডার সিস্টেম।
            </p>

            {/* CTAs */}
            <div className="b2b-animate-fade-up b2b-delay-300 flex flex-wrap gap-4">
              <Link href="/b2b/register" className="b2b-btn-primary">
                Apply for Free Trial
                <span className="material-symbols-outlined text-lg">
                  arrow_forward
                </span>
              </Link>
              <Link href="#how-it-works" className="b2b-btn-secondary">
                See How It Works
              </Link>
            </div>
          </div>

          {/* Right: Visual */}
          <div className="relative b2b-animate-fade-up b2b-delay-400">
            <div
              className="b2b-decoration-circle b2b-animate-float"
              style={{
                width: "200px",
                height: "200px",
                top: "-30px",
                right: "-30px",
                background:
                  "radial-gradient(circle, rgba(0,49,120,0.08) 0%, transparent 70%)",
              }}
            />
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #0a1628 0%, #1a2744 100%)",
                padding: "32px",
                boxShadow:
                  "0 32px 80px rgba(0,49,120,0.15), 0 0 0 1px rgba(255,255,255,0.05)",
              }}
            >
              {/* Mock Dashboard */}
              <div className="space-y-4">
                {/* Header bar */}
                <div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg" style={{ background: "linear-gradient(135deg, #003178, #1565c0)" }} />
                    <div>
                      <div className="h-3 w-24 rounded" style={{ background: "rgba(255,255,255,0.2)" }} />
                      <div className="h-2 w-16 rounded mt-1.5" style={{ background: "rgba(255,255,255,0.08)" }} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <div className="w-6 h-6 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Orders", value: "1,247", color: "#42a5f5" },
                    { label: "Revenue", value: "৳84K", color: "#66bb6a" },
                    { label: "Growth", value: "+23%", color: "#ffa726" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {stat.label}
                      </div>
                      <div className="text-lg font-bold" style={{ color: stat.color }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart placeholder */}
                <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-end gap-2 h-24 justify-between px-2">
                    {[40, 65, 45, 80, 60, 90, 75, 95, 70, 85, 92, 88].map(
                      (h, i) => (
                        <div
                          key={`bar-${i}`}
                          className="flex-1 rounded-t-sm"
                          style={{
                            height: `${h}%`,
                            background: `linear-gradient(180deg, rgba(66,165,245,${0.6 + (h / 100) * 0.4}) 0%, rgba(0,49,120,0.3) 100%)`,
                            minWidth: "6px",
                          }}
                        />
                      )
                    )}
                  </div>
                </div>

                {/* Order list */}
                <div className="space-y-2">
                  {[
                    { name: "Rahim Store", amount: "৳12,500", status: "Completed" },
                    { name: "Karim Mart", amount: "৳8,200", status: "Processing" },
                    { name: "City Grocers", amount: "৳15,800", status: "Pending" },
                  ].map((order) => (
                    <div
                      key={order.name}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: "rgba(0,49,120,0.3)",
                            color: "#90caf9",
                          }}
                        >
                          {order.name[0]}
                        </div>
                        <span
                          className="text-sm font-medium"
                          style={{ color: "rgba(255,255,255,0.7)" }}
                        >
                          {order.name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>
                          {order.amount}
                        </div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {order.status}
                        </div>
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
