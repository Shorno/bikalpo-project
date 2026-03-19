import Link from "next/link";

export function CtaSection() {
  return (
    <section className="py-12 sm:py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div
          className="rounded-3xl p-12 lg:p-20 text-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #003178 0%, #0d47a1 100%)",
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <h2
            className="text-4xl lg:text-5xl font-extrabold text-white mb-6 relative z-10"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Ready to Transform Your Business?
          </h2>
          <p className="text-white/80 text-lg mb-10 max-w-2xl mx-auto relative z-10">
            Join thousands of successful entrepreneurs. Start your 14-day free
            trial today. No credit card required.
          </p>
          <div className="flex flex-wrap justify-center gap-6 relative z-10">
            <Link
              href="/b2b/register"
              className="px-10 py-4 bg-white text-[#003178] font-bold rounded-lg shadow-xl hover:scale-105 transition-transform"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="px-10 py-4 bg-[#0d47a1] text-white border border-white/20 font-bold rounded-lg hover:bg-[#0d47a1]/80 transition-colors"
            >
              Book a Meeting
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
