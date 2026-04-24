const networkNodes = [
  {
    from: "Warehouse",
    to: "Warehouse",
    type: "Transfer & Supply",
    icon: "warehouse",
    arrow: "⇄",
    color: "#1565c0",
  },
  {
    from: "Warehouse",
    to: "Shop / Restaurant",
    type: "Supply Only",
    icon: "storefront",
    arrow: "→",
    color: "#2e7d32",
  },
  {
    from: "Shop",
    to: "Shop",
    type: "Transfer Only",
    icon: "swap_horiz",
    arrow: "⇄",
    color: "#ef6c00",
  },
  {
    from: "Shop",
    to: "Consumer",
    type: "Retail Only",
    icon: "person",
    arrow: "→",
    color: "#7b1fa2",
  },
  {
    from: "Restaurant",
    to: "Warehouse",
    type: "Purchase Only",
    icon: "restaurant",
    arrow: "←",
    color: "#c62828",
  },
];

export function B2bNetwork() {
  return (
    <section
      className="b2b-section"
      id="network"
      style={{
        background:
          "linear-gradient(180deg, #f8faff 0%, #eef2ff 50%, #f8faff 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
            style={{
              background: "rgba(0,49,120,0.04)",
              border: "1px solid rgba(0,49,120,0.08)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ color: "#003178" }}
            >
              hub
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#003178" }}
            >
              Network Architecture
            </span>
          </div>
          <h2
            className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-4"
            style={{ color: "#0f172a" }}
          >
            Structured{" "}
            <span className="b2b-gradient-text">Digital Trade Network</span>
          </h2>
          <p className="b2b-subheading text-lg">
            Every connection is tracked, verified, and reportable.
          </p>
        </div>

        {/* Network flow visualization */}
        <div className="max-w-4xl mx-auto">
          <div className="grid gap-4">
            {networkNodes.map((node, index) => (
              <div
                key={`${node.from}-${node.to}-${node.type}`}
                className="b2b-card flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 group"
                style={{
                  animationDelay: `${index * 100}ms`,
                  borderLeft: `4px solid ${node.color}`,
                }}
              >
                {/* Icon */}
                <div
                  className="b2b-icon-box"
                  style={{
                    background: `${node.color}12`,
                    color: node.color,
                  }}
                >
                  <span className="material-symbols-outlined">{node.icon}</span>
                </div>

                {/* Flow description */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <span
                      className="font-bold text-base"
                      style={{
                        fontFamily: "'Manrope', sans-serif",
                        color: "#0f172a",
                      }}
                    >
                      {node.from}
                    </span>
                    <span
                      className="text-xl font-bold"
                      style={{ color: node.color }}
                    >
                      {node.arrow}
                    </span>
                    <span
                      className="font-bold text-base"
                      style={{
                        fontFamily: "'Manrope', sans-serif",
                        color: "#0f172a",
                      }}
                    >
                      {node.to}
                    </span>
                  </div>
                  <span
                    className="text-sm font-medium px-3 py-1 rounded-full"
                    style={{
                      background: `${node.color}0D`,
                      color: node.color,
                    }}
                  >
                    {node.type}
                  </span>
                </div>

                {/* All transactions recorded badge */}
                <div className="flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{
                      color: "#66bb6a",
                      fontVariationSettings: "'FILL' 1",
                    }}
                  >
                    check_circle
                  </span>
                  <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                    Digitally Recorded
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Result */}
          <div
            className="mt-10 p-6 rounded-2xl text-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,49,120,0.04) 0%, rgba(0,200,83,0.04) 100%)",
              border: "1px solid rgba(0,49,120,0.08)",
            }}
          >
            <p className="b2b-bn text-base font-medium" style={{ color: "#334155" }}>
              প্রতিটি ট্রেড মুভমেন্ট নিরাপদ, ট্র্যাকযোগ্য ও রিপোর্টযোগ্য।
            </p>
            <p className="text-sm mt-1" style={{ color: "#64748b" }}>
              Every trade movement is secure, trackable & reportable.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
