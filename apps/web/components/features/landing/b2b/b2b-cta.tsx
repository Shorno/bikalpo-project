import Link from "next/link";

export function B2bCta() {
  return (
    <section className="b2b-section" style={{ background: "#ffffff" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #003178 0%, #0d47a1 40%, #1a237e 100%)",
            padding: "clamp(48px, 8vw, 96px) clamp(24px, 6vw, 64px)",
          }}
        >
          {/* Decorative elements */}
          <div
            className="absolute top-0 right-0 w-80 h-80 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
              transform: "translate(30%, -30%)",
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-64 h-64 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(0,200,83,0.08) 0%, transparent 70%)",
              transform: "translate(-30%, 30%)",
            }}
          />

          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{
                  color: "#69F0AE",
                  fontVariationSettings: "'FILL' 1",
                }}
              >
                bolt
              </span>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.8)" }}
              >
                Limited Trial Access Available
              </span>
            </div>

            <h2
              className="b2b-heading text-3xl sm:text-4xl lg:text-5xl mb-6"
              style={{ color: "#ffffff" }}
            >
              Ready to Digitize Your Trade Business?
            </h2>

            <p
              className="text-lg mb-10"
              style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.7 }}
            >
              Limited trial access available for verified businesses. Apply now
              and start your digital trade journey today.
            </p>

            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/b2b/register" className="b2b-btn-white">
                Apply Now
                <span className="material-symbols-outlined text-lg">
                  arrow_forward
                </span>
              </Link>
              <Link href="/contact" className="b2b-btn-outline-white">
                Contact Our Team
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
