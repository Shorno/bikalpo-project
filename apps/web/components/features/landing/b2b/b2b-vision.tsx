import Link from "next/link";

export function B2bVision() {
  return (
    <section
      className="b2b-section"
      id="vision"
      style={{
        background:
          "linear-gradient(180deg, #0a0e27 0%, #111638 50%, #0a0e27 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Header */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ color: "#42a5f5" }}
            >
              rocket_launch
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "#90caf9" }}
            >
              Future Vision
            </span>
          </div>

          <h2
            className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-8"
            style={{ color: "#ffffff" }}
          >
            Turn Your Business Into a{" "}
            <span className="b2b-gradient-text-light">
              Digital Trade Network
            </span>
          </h2>

          {/* Bengali motivational text */}
          <div
            className="b2b-bn text-lg sm:text-xl mb-10 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            <p>আজ আপনি একটি দোকান চালান।</p>
            <p
              className="font-bold mt-2"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              আগামীকাল আপনি একটি নেটওয়ার্ক পরিচালনা করবেন।
            </p>
          </div>

          {/* Formula */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-12">
            {[
              { icon: "inventory_2", label: "Supply" },
              { icon: "add", label: "" },
              { icon: "shopping_cart", label: "Order" },
              { icon: "add", label: "" },
              { icon: "local_shipping", label: "Delivery" },
              { icon: "add", label: "" },
              { icon: "tune", label: "Control" },
              { icon: "drag_handle", label: "" },
              { icon: "trending_up", label: "Growth" },
            ].map((item, index) => (
              <div
                key={`formula-${index}`}
                className="flex flex-col items-center gap-2"
              >
                {item.label ? (
                  <>
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center"
                      style={{
                        background:
                          item.label === "Growth"
                            ? "linear-gradient(135deg, #00C853 0%, #69F0AE 100%)"
                            : "rgba(255,255,255,0.06)",
                        border:
                          item.label === "Growth"
                            ? "none"
                            : "1px solid rgba(255,255,255,0.1)",
                        color:
                          item.label === "Growth"
                            ? "#ffffff"
                            : "#90caf9",
                      }}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {item.icon}
                      </span>
                    </div>
                    <span
                      className="text-xs font-bold"
                      style={{
                        color:
                          item.label === "Growth"
                            ? "#69F0AE"
                            : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {item.label}
                    </span>
                  </>
                ) : (
                  <span
                    className="material-symbols-outlined text-2xl"
                    style={{
                      color:
                        item.icon === "drag_handle"
                          ? "#ffa726"
                          : "rgba(255,255,255,0.3)",
                    }}
                  >
                    {item.icon}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Demo CTA */}
          <div
            className="p-8 rounded-2xl mb-8"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h3
              className="text-xl font-bold mb-3"
              style={{
                fontFamily: "'Manrope', sans-serif",
                color: "#ffffff",
              }}
            >
              See how Bikalpo works
            </h3>
            <p
              className="text-sm mb-6"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Watch a quick demo to understand the full platform
            </p>
            <Link
              href="#"
              className="b2b-btn-white inline-flex"
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                play_circle
              </span>
              Watch Demo Video
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
